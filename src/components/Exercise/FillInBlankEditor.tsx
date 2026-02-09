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
  endColumn: number; // 1-based, exclusive
}

const MIN_BLANK_WIDTH = 3;

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
 * Replace every ___ with the corresponding initial value (or empty string).
 * Returns the resulting code and the adjusted blank ranges.
 */
function buildInitialState(
  starterCode: string,
  blanks: BlankPosition[],
  initialValues?: Record<string, string>
): { code: string; ranges: BlankPosition[] } {
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
    let columnShift = 0;

    for (const blank of lineBlanks) {
      // Use initial value if available, otherwise empty string (not ___)
      const value = initialValues?.[String(blank.index)] ?? "";
      const adjustedStart = blank.startColumn + columnShift;
      const adjustedEnd = adjustedStart + value.length;

      const beforeBlank = line.substring(0, adjustedStart - 1);
      const afterBlank = line.substring(adjustedStart - 1 + 3); // skip original ___
      line = beforeBlank + value + afterBlank;

      adjustedRanges.push({
        index: blank.index,
        line: lineNum,
        startColumn: adjustedStart,
        endColumn: adjustedEnd,
      });

      columnShift += value.length - 3;
    }

    lines[lineNum - 1] = line;
  }

  // Safety: add blanks not on grouped lines
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
  // Tracking collection: pure range tracking, never visually modified
  const trackingCollectionRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  // Visual collection: rebuilt on each change for styling + min-width padding
  const visualCollectionRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
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

  /** Extract current blank values from tracking decoration ranges */
  const extractBlankValues = useCallback(() => {
    const editor = editorRef.current;
    const tracking = trackingCollectionRef.current;
    if (!editor || !tracking) return;

    const model = editor.getModel();
    if (!model) return;

    const values: Record<string, string> = {};
    for (let i = 0; i < blankCountRef.current; i++) {
      const range = tracking.getRange(i);
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

      // Set up restriction zones (editable areas, everything else is read-only)
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

      // Tracking collection: stable range tracking via stickiness
      const trackingDecorations = initialRanges.map((range) => ({
        range: new monaco.Range(range.line, range.startColumn, range.line, range.endColumn),
        options: {
          stickiness: monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
        },
      }));
      trackingCollectionRef.current = editor.createDecorationsCollection(trackingDecorations);

      // Visual collection: dynamic styling with min-width padding
      visualCollectionRef.current = editor.createDecorationsCollection([]);

      const updateVisuals = () => {
        const tracking = trackingCollectionRef.current;
        const visual = visualCollectionRef.current;
        if (!tracking || !visual) return;

        const decos: Monaco.editor.IModelDeltaDecoration[] = [];
        for (let i = 0; i < blankCountRef.current; i++) {
          const range = tracking.getRange(i);
          if (!range) continue;
          const value = model.getValueInRange(range);
          const padChars = Math.max(0, MIN_BLANK_WIDTH - value.length);

          decos.push({
            range,
            options: {
              className: "fill-in-blank-editable",
              ...(padChars > 0
                ? {
                    after: {
                      content: "\u00A0".repeat(padChars),
                      inlineClassName: "fill-in-blank-padding",
                    },
                  }
                : {}),
            },
          });
        }
        visual.set(decos);
      };

      // Listen for content changes directly on the model
      modelListenerRef.current = model.onDidChangeContent(() => {
        requestAnimationFrame(() => {
          updateVisuals();
          extractBlankValues();
        });
      });

      // Focus the first blank
      if (initialRanges.length > 0) {
        editor.setPosition({
          lineNumber: initialRanges[0].line,
          column: initialRanges[0].startColumn,
        });
        editor.focus();
      }

      // Tab navigation between blanks using live tracking positions
      editor.addAction({
        id: "next-blank",
        label: "Jump to next blank",
        keybindings: [monaco.KeyCode.Tab],
        run: (ed) => {
          const tracking = trackingCollectionRef.current;
          if (!tracking) return;

          const pos = ed.getPosition();
          if (!pos) return;

          let currentIdx = -1;
          for (let i = 0; i < blankCountRef.current; i++) {
            const range = tracking.getRange(i);
            if (range && range.containsPosition(pos)) {
              currentIdx = i;
              break;
            }
          }

          const nextIdx = (currentIdx + 1) % blankCountRef.current;
          const nextRange = tracking.getRange(nextIdx);
          if (nextRange) {
            ed.setPosition({
              lineNumber: nextRange.startLineNumber,
              column: nextRange.startColumn,
            });
          }
        },
      });

      // Initial visual update and value extraction
      requestAnimationFrame(() => {
        updateVisuals();
        extractBlankValues();
      });
    } catch (err) {
      console.error("Failed to initialize constrained editor:", err);
    }
  };

  // Clean up on unmount
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
