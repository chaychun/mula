"use client";

import { useRef, useCallback, useEffect } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useTheme } from "@/components/theme-provider";
import { languageMap } from "./languageMap";

interface BlankPosition {
  index: number;
  line: number; // 1-based
  startColumn: number; // 1-based
  endColumn: number; // 1-based, exclusive (startColumn + marker length)
}

/** Parse starterCode to find all ___ positions */
function findBlanks(code: string): BlankPosition[] {
  const blanks: BlankPosition[] = [];
  const lines = code.split("\n");
  let blankIndex = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    let searchFrom = 0;
    while (true) {
      const col = line.indexOf("___", searchFrom);
      if (col === -1) break;
      blanks.push({
        index: blankIndex++,
        line: lineIdx + 1,
        startColumn: col + 1,
        endColumn: col + 4, // ___ is 3 chars
      });
      searchFrom = col + 3;
    }
  }
  return blanks;
}

/**
 * Given starter code blanks and optional initial values, compute:
 * 1. The code string with blanks replaced by values (or kept as ___)
 * 2. The adjusted ranges for each blank in the resulting code
 */
function buildInitialState(
  starterCode: string,
  blanks: BlankPosition[],
  initialValues?: Record<string, string>
): { code: string; ranges: BlankPosition[] } {
  if (!initialValues || Object.keys(initialValues).length === 0) {
    return { code: starterCode, ranges: blanks };
  }

  const lines = starterCode.split("\n");
  const adjustedRanges: BlankPosition[] = [];

  // Group blanks by line for position adjustment
  const blanksByLine = new Map<number, BlankPosition[]>();
  for (const blank of blanks) {
    const lineGroup = blanksByLine.get(blank.line) || [];
    lineGroup.push(blank);
    blanksByLine.set(blank.line, lineGroup);
  }

  for (const [lineNum, lineBlanks] of blanksByLine) {
    let line = lines[lineNum - 1];
    let columnShift = 0; // Track how much the column has shifted from replacements

    for (const blank of lineBlanks) {
      const value = initialValues[String(blank.index)] ?? "___";
      const adjustedStart = blank.startColumn + columnShift;
      const adjustedEnd = adjustedStart + value.length;

      // Replace in the line string
      const beforeBlank = line.substring(0, adjustedStart - 1);
      const afterBlank = line.substring(adjustedStart - 1 + 3); // skip original ___
      line = beforeBlank + value + afterBlank;

      adjustedRanges.push({
        index: blank.index,
        line: lineNum,
        startColumn: adjustedStart,
        endColumn: adjustedEnd,
      });

      columnShift += value.length - 3; // difference from original ___ (3 chars)
    }

    lines[lineNum - 1] = line;
  }

  // Add blanks that weren't on grouped lines (shouldn't happen, but safety)
  for (const blank of blanks) {
    if (!adjustedRanges.find((r) => r.index === blank.index)) {
      adjustedRanges.push(blank);
    }
  }

  adjustedRanges.sort((a, b) => a.index - b.index);
  return { code: lines.join("\n"), ranges: adjustedRanges };
}

interface FillInBlankEditorProps {
  starterCode: string;
  language: string;
  onBlankValuesChange: (blankValues: Record<string, string>) => void;
  initialBlankValues?: Record<string, string>;
}

export default function FillInBlankEditor({
  starterCode,
  language,
  onBlankValuesChange,
  initialBlankValues,
}: FillInBlankEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const constrainedInstanceRef = useRef<any>(null);
  // Decoration collection tracks blank ranges as the user types
  const decorationCollectionRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const blankCountRef = useRef(0);
  const modelListenerRef = useRef<Monaco.IDisposable | null>(null);
  const { resolvedTheme } = useTheme();

  const monacoLanguage = languageMap[language.toLowerCase()] || "plaintext";

  const blanks = findBlanks(starterCode);
  const { code: initialCode, ranges: initialRanges } = buildInitialState(
    starterCode,
    blanks,
    initialBlankValues
  );

  /** Extract current blank values from decoration-tracked ranges */
  const extractBlankValues = useCallback(() => {
    const editor = editorRef.current;
    const collection = decorationCollectionRef.current;
    if (!editor || !collection) return;

    const model = editor.getModel();
    if (!model) return;

    const values: Record<string, string> = {};
    for (let i = 0; i < blankCountRef.current; i++) {
      const range = collection.getRange(i);
      if (range) {
        values[String(i)] = model.getValueInRange(range);
      }
    }
    onBlankValuesChange(values);
  }, [onBlankValuesChange]);

  const handleEditorMount: OnMount = async (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    blankCountRef.current = blanks.length;

    try {
      const { default: constrainedEditor } = await import("constrained-editor-plugin");
      const instance = constrainedEditor(monaco);
      constrainedInstanceRef.current = instance;
      instance.initializeIn(editor);

      const model = editor.getModel();
      if (!model) return;

      // Build restriction ranges from the (possibly adjusted) initial ranges
      const restrictions = initialRanges.map((range, idx) => ({
        range: [range.line, range.startColumn, range.line, range.endColumn] as [
          number,
          number,
          number,
          number,
        ],
        label: `blank-${idx}`,
        allowMultiline: false,
      }));

      instance.addRestrictionsTo(model, restrictions);

      // Create tracked decorations for blank zones — these move as the user types
      const decorations = initialRanges.map((range) => ({
        range: new monaco.Range(range.line, range.startColumn, range.line, range.endColumn),
        options: {
          className: "fill-in-blank-editable",
          stickiness: monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
        },
      }));
      decorationCollectionRef.current = editor.createDecorationsCollection(decorations);

      // Listen for content changes directly on the model — more reliable than
      // @monaco-editor/react's onChange when constrained-editor-plugin is active
      modelListenerRef.current = model.onDidChangeContent(() => {
        requestAnimationFrame(() => extractBlankValues());
      });

      // Focus the first blank
      if (initialRanges.length > 0) {
        editor.setPosition({
          lineNumber: initialRanges[0].line,
          column: initialRanges[0].startColumn,
        });
        editor.focus();
      }

      // Tab navigation between blanks using live decoration positions
      editor.addAction({
        id: "next-blank",
        label: "Jump to next blank",
        keybindings: [monaco.KeyCode.Tab],
        run: (ed) => {
          const collection = decorationCollectionRef.current;
          if (!collection) return;

          const pos = ed.getPosition();
          if (!pos) return;

          // Find which blank the cursor is currently in
          let currentIdx = -1;
          for (let i = 0; i < blankCountRef.current; i++) {
            const range = collection.getRange(i);
            if (range && range.containsPosition(pos)) {
              currentIdx = i;
              break;
            }
          }

          const nextIdx = (currentIdx + 1) % blankCountRef.current;
          const nextRange = collection.getRange(nextIdx);
          if (nextRange) {
            ed.setPosition({
              lineNumber: nextRange.startLineNumber,
              column: nextRange.startColumn,
            });
          }
        },
      });

      // Always extract initial blank values so state is populated even if user
      // submits without typing (otherwise blankValues stays as {})
      requestAnimationFrame(() => extractBlankValues());
    } catch (err) {
      console.error("Failed to initialize constrained editor:", err);
    }
  };

  // Clean up constrained editor and model listener on unmount
  useEffect(() => {
    return () => {
      modelListenerRef.current?.dispose();
      if (constrainedInstanceRef.current) {
        try {
          constrainedInstanceRef.current.disposeConstrainer();
        } catch {
          // Plugin may already be disposed
        }
      }
    };
  }, []);

  return (
    <div className="h-[200px] border-b border-border">
      <Editor
        height="100%"
        language={monacoLanguage}
        defaultValue={initialCode}
        onMount={handleEditorMount}
        theme={resolvedTheme === "dark" ? "vs-dark" : "vs-light"}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          automaticLayout: true,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          padding: { top: 8, bottom: 8 },
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
        }}
      />
    </div>
  );
}
