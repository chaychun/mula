"use client";

import { useRef } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useTheme } from "@/components/theme-provider";

// Map language names to Monaco language identifiers
const languageMap: Record<string, string> = {
  swift: "swift",
  python: "python",
  typescript: "typescript",
  javascript: "javascript",
  ts: "typescript",
  js: "javascript",
  py: "python",
  java: "java",
  go: "go",
  rust: "rust",
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  csharp: "csharp",
  "c#": "csharp",
  ruby: "ruby",
  php: "php",
  html: "html",
  css: "css",
  json: "json",
  sql: "sql",
};

interface ExerciseEditorProps {
  code: string;
  language: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}

export default function ExerciseEditor({
  code,
  language,
  onChange,
  disabled = false,
}: ExerciseEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const { resolvedTheme } = useTheme();

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  // Note: We rely on Monaco's controlled `value` prop for external updates.
  // The @monaco-editor/react library handles value changes automatically.
  // We don't use a useEffect with setValue() because it resets cursor position.

  const monacoLanguage = languageMap[language.toLowerCase()] || "plaintext";

  return (
    <div className="h-[200px] border-b border-border">
      <Editor
        height="100%"
        language={monacoLanguage}
        value={code}
        onChange={(value) => onChange(value || "")}
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
          readOnly: disabled,
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
