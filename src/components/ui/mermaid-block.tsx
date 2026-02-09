"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { useEffect, useId, useRef, useState } from "react";
import { CodeBlock, CodeBlockCode, CodeBlockHeader } from "./code-block";

// Approximate hex values matching the oklch design system palette
const THEME_VARS = {
  light: {
    primaryColor: "#f5f5f4", // muted — warm off-white node fill
    primaryTextColor: "#1c1917", // foreground — near-black warm
    primaryBorderColor: "#e7e5e4", // border — light stone
    lineColor: "#78716c", // muted-foreground — warm gray
    textColor: "#1c1917",
    mainBkg: "#f5f5f4",
    nodeBorder: "#e7e5e4",
    clusterBkg: "#fafaf9", // slightly lighter than muted
    edgeLabelBackground: "#ffffff",
    noteBkgColor: "#fef9c3", // subtle yellow tint for notes
    noteTextColor: "#1c1917",
    noteBorderColor: "#e7e5e4",
    actorBkg: "#f5f5f4",
    actorTextColor: "#1c1917",
    actorBorder: "#e7e5e4",
    actorLineColor: "#a8a29e",
    signalColor: "#1c1917",
    signalTextColor: "#1c1917",
    labelBoxBkgColor: "#f5f5f4",
    labelBoxBorderColor: "#e7e5e4",
    labelTextColor: "#1c1917",
    loopTextColor: "#78716c",
    activationBorderColor: "#e7e5e4",
    activationBkgColor: "#fafaf9",
    sequenceNumberColor: "#78716c",
    // Mind map + flowchart node scale colors (levels 0–11)
    cScale0: "#f5f5f4",
    cScale1: "#fafaf9",
    cScale2: "#e7e5e4",
    cScale3: "#f5f5f4",
    cScale4: "#fafaf9",
    cScale5: "#e7e5e4",
    cScale6: "#f5f5f4",
    cScale7: "#fafaf9",
    cScale8: "#e7e5e4",
    cScale9: "#f5f5f4",
    cScale10: "#fafaf9",
    cScale11: "#e7e5e4",
    cScaleLabel0: "#1c1917",
    cScaleLabel1: "#1c1917",
    cScaleLabel2: "#1c1917",
    cScaleLabel3: "#1c1917",
    cScaleLabel4: "#1c1917",
    cScaleLabel5: "#1c1917",
    cScaleLabel6: "#1c1917",
    cScaleLabel7: "#1c1917",
    cScaleLabel8: "#1c1917",
    cScaleLabel9: "#1c1917",
    cScaleLabel10: "#1c1917",
    cScaleLabel11: "#1c1917",
  },
  dark: {
    primaryColor: "#292524", // card — dark warm
    primaryTextColor: "#fafaf9", // foreground — near-white
    primaryBorderColor: "#44403c", // slightly lighter than card
    lineColor: "#a8a29e", // muted-foreground — stone gray
    textColor: "#fafaf9",
    mainBkg: "#292524",
    nodeBorder: "#44403c",
    clusterBkg: "#1c1917", // background
    edgeLabelBackground: "#292524",
    noteBkgColor: "#3a3330", // muted — dark warm
    noteTextColor: "#fafaf9",
    noteBorderColor: "#44403c",
    actorBkg: "#292524",
    actorTextColor: "#fafaf9",
    actorBorder: "#44403c",
    actorLineColor: "#78716c",
    signalColor: "#fafaf9",
    signalTextColor: "#fafaf9",
    labelBoxBkgColor: "#292524",
    labelBoxBorderColor: "#44403c",
    labelTextColor: "#fafaf9",
    loopTextColor: "#a8a29e",
    activationBorderColor: "#44403c",
    activationBkgColor: "#3a3330",
    sequenceNumberColor: "#a8a29e",
    // Mind map + flowchart node scale colors (levels 0–11)
    cScale0: "#292524",
    cScale1: "#3a3330",
    cScale2: "#44403c",
    cScale3: "#292524",
    cScale4: "#3a3330",
    cScale5: "#44403c",
    cScale6: "#292524",
    cScale7: "#3a3330",
    cScale8: "#44403c",
    cScale9: "#292524",
    cScale10: "#3a3330",
    cScale11: "#44403c",
    // Ensure scale text is readable
    cScaleLabel0: "#fafaf9",
    cScaleLabel1: "#fafaf9",
    cScaleLabel2: "#fafaf9",
    cScaleLabel3: "#fafaf9",
    cScaleLabel4: "#fafaf9",
    cScaleLabel5: "#fafaf9",
    cScaleLabel6: "#fafaf9",
    cScaleLabel7: "#fafaf9",
    cScaleLabel8: "#fafaf9",
    cScaleLabel9: "#fafaf9",
    cScaleLabel10: "#fafaf9",
    cScaleLabel11: "#fafaf9",
  },
} as const;

// CSS overrides for diagram elements that don't respect themeVariables
const ER_OVERRIDES_LIGHT = `
  .attributeBoxOdd { fill: #ffffff !important; stroke: #e7e5e4 !important; }
  .attributeBoxEven { fill: #f5f5f4 !important; stroke: #e7e5e4 !important; }
  .entityBox { fill: #f5f5f4 !important; stroke: #e7e5e4 !important; }
  .entityLabel { fill: #1c1917 !important; }
  .relationshipLabelBox { fill: #ffffff !important; }
  .relationshipLabel { fill: #1c1917 !important; }
`;

const ER_OVERRIDES_DARK = `
  .attributeBoxOdd { fill: #292524 !important; stroke: #44403c !important; }
  .attributeBoxEven { fill: #3a3330 !important; stroke: #44403c !important; }
  .entityBox { fill: #292524 !important; stroke: #44403c !important; }
  .entityLabel { fill: #fafaf9 !important; }
  .attributeBoxOdd text, .attributeBoxEven text { fill: #fafaf9 !important; }
  .relationshipLabelBox { fill: #1c1917 !important; }
  .relationshipLabel { fill: #fafaf9 !important; }
`;

type MermaidBlockProps = {
  code: string;
  className?: string;
};

function MermaidBlock({ code, className }: MermaidBlockProps) {
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const renderIdBase = useId();
  const renderCountRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        const isDark = resolvedTheme === "dark";
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: isDark ? THEME_VARS.dark : THEME_VARS.light,
          fontFamily: "var(--font-sans)",
        });

        renderCountRef.current += 1;
        const id = `mermaid-${renderIdBase.replace(/:/g, "")}-${renderCountRef.current}`;
        const { svg: renderedSvg } = await mermaid.render(id, code);

        // Force sharp corners to match --radius: 0 design system
        // Inject CSS overrides for ER diagrams and other elements that ignore themeVariables
        const erOverrides = isDark ? ER_OVERRIDES_DARK : ER_OVERRIDES_LIGHT;
        const sharpSvg = renderedSvg
          .replace(/rx="[\d.]+"/g, 'rx="0"')
          .replace(/ry="[\d.]+"/g, 'ry="0"')
          .replace("</style>", `${erOverrides}</style>`);

        if (!cancelled) {
          setSvg(sharpSvg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
          setSvg(null);
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [code, resolvedTheme, renderIdBase]);

  if (error) {
    return (
      <div className="my-4">
        <CodeBlock>
          <CodeBlockHeader language="mermaid" />
          <div className="px-3 py-1.5 text-[10px] text-destructive bg-destructive/10 border-b border-border">
            Diagram error: {error}
          </div>
          <CodeBlockCode code={code} language="text" />
        </CodeBlock>
      </div>
    );
  }

  return (
    <div className={cn("my-4", className)}>
      <div className="ring-1 ring-border bg-card text-card-foreground overflow-clip">
        <div className="flex items-center justify-between bg-muted/80 border-b border-border px-3 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            mermaid
          </span>
          <button
            type="button"
            onClick={() => setShowSource((s) => !s)}
            className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {showSource ? "Diagram" : "Source"}
          </button>
        </div>

        {showSource ? (
          <CodeBlockCode code={code} language="mermaid" />
        ) : svg ? (
          <div
            className="flex justify-center p-4 [&>svg]:max-w-full [&>svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="flex justify-center p-4">
            <div className="text-xs text-muted-foreground">Rendering diagram...</div>
          </div>
        )}
      </div>
    </div>
  );
}

export { MermaidBlock };
