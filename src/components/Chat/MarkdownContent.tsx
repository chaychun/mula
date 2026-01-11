"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { memo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "@/components/theme-provider";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MarkdownContentProps {
  content: string;
}

// Custom light theme matching the Lyra stone/yellow palette
const lightTheme = {
  'pre[class*="language-"]': {
    background: "oklch(0.97 0.001 106.424)",
    color: "oklch(0.147 0.004 49.25)",
  },
  'code[class*="language-"]': {
    background: "oklch(0.97 0.001 106.424)",
    color: "oklch(0.147 0.004 49.25)",
  },
  comment: { color: "oklch(0.553 0.013 58.071)" },
  prolog: { color: "oklch(0.553 0.013 58.071)" },
  doctype: { color: "oklch(0.553 0.013 58.071)" },
  cdata: { color: "oklch(0.553 0.013 58.071)" },
  punctuation: { color: "oklch(0.421 0.095 57.708)" },
  property: { color: "oklch(0.577 0.245 27.325)" },
  tag: { color: "oklch(0.577 0.245 27.325)" },
  boolean: { color: "oklch(0.577 0.245 27.325)" },
  number: { color: "oklch(0.577 0.245 27.325)" },
  constant: { color: "oklch(0.577 0.245 27.325)" },
  symbol: { color: "oklch(0.577 0.245 27.325)" },
  deleted: { color: "oklch(0.577 0.245 27.325)" },
  selector: { color: "oklch(0.681 0.162 75.834)" },
  "attr-name": { color: "oklch(0.681 0.162 75.834)" },
  string: { color: "oklch(0.681 0.162 75.834)" },
  char: { color: "oklch(0.681 0.162 75.834)" },
  builtin: { color: "oklch(0.681 0.162 75.834)" },
  inserted: { color: "oklch(0.681 0.162 75.834)" },
  operator: { color: "oklch(0.421 0.095 57.708)" },
  entity: { color: "oklch(0.421 0.095 57.708)" },
  url: { color: "oklch(0.421 0.095 57.708)" },
  ".language-css .token.string": { color: "oklch(0.421 0.095 57.708)" },
  ".style .token.string": { color: "oklch(0.421 0.095 57.708)" },
  atrule: { color: "oklch(0.852 0.199 91.936)" },
  "attr-value": { color: "oklch(0.852 0.199 91.936)" },
  keyword: { color: "oklch(0.852 0.199 91.936)" },
  function: { color: "oklch(0.554 0.135 66.442)" },
  "class-name": { color: "oklch(0.554 0.135 66.442)" },
  regex: { color: "oklch(0.681 0.162 75.834)" },
  important: { color: "oklch(0.681 0.162 75.834)", fontWeight: "bold" },
  variable: { color: "oklch(0.421 0.095 57.708)" },
};

export const MarkdownContent = memo(function MarkdownContent({ content }: MarkdownContentProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-lg font-semibold mt-6 mb-3 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-semibold mt-5 mb-2.5 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold mt-4 mb-2 first:mt-0">{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-xs font-semibold mt-3 mb-1.5 first:mt-0">{children}</h4>
        ),
        p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc ml-5 mb-3 space-y-1.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal ml-5 mb-3 space-y-1.5">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-primary hover:underline underline-offset-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary/50 pl-4 py-1 my-3 text-muted-foreground italic">
            {children}
          </blockquote>
        ),
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ className, children }) => {
          const match = /language-(\w+)/.exec(className || "");
          const language = match ? match[1] : "";
          const codeString = String(children).replace(/\n$/, "");

          // Check if this is a code block (has language class or contains newlines)
          const isCodeBlock = match || codeString.includes("\n");

          if (isCodeBlock) {
            return (
              <div className="my-4 ring-1 ring-border overflow-hidden [&_*]:!rounded-none">
                {language && (
                  <div className="bg-muted/80 text-muted-foreground text-[10px] font-medium uppercase tracking-wider px-3 py-1.5 border-b border-border">
                    {language}
                  </div>
                )}
                <SyntaxHighlighter
                  style={isDark ? oneDark : lightTheme}
                  language={language || "text"}
                  PreTag="div"
                  codeTagProps={{
                    style: { borderRadius: 0 },
                  }}
                  customStyle={{
                    margin: 0,
                    borderRadius: 0,
                    fontSize: "0.75rem",
                    lineHeight: "1.6",
                    padding: "1rem",
                    background: isDark ? undefined : "oklch(0.97 0.001 106.424)",
                  }}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            );
          }
          return (
            <code className="px-1.5 py-0.5 bg-yellow-100/50 dark:bg-yellow-900/20 rounded-md text-[0.9em] font-mono border border-yellow-200/50 dark:border-yellow-700/30">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <>{children}</>,
        table: ({ children }) => (
          <ScrollArea orientation="horizontal" className="my-4">
            <table className="w-full border-collapse text-xs">{children}</table>
          </ScrollArea>
        ),
        thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
        th: ({ children }) => (
          <th className="border border-border px-3 py-2 font-semibold text-left">{children}</th>
        ),
        td: ({ children }) => <td className="border border-border px-3 py-2">{children}</td>,
        hr: () => <hr className="my-6 border-border" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
});
