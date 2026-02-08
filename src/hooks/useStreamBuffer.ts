import { useState, useEffect, useRef } from "react";

/**
 * Buffers streaming text and releases it word by word.
 *
 * Designed for the Claude Agent SDK which delivers text in large chunks
 * (one per turn), not token by token. The interval runs continuously
 * while there's content, reading the latest text from a ref so it
 * always picks up new chunks without needing effect restarts.
 */
export function useStreamBuffer(content: string, speed: number = 30): string {
  const contentRef = useRef(content);
  contentRef.current = content;

  const [revealedLen, setRevealedLen] = useState(0);
  const hasContent = content.length > 0;

  // Single interval that runs whenever there's content to reveal.
  // Deps only include the empty↔non-empty transition — content growth
  // is picked up via contentRef without restarting the interval.
  useEffect(() => {
    if (!hasContent) {
      setRevealedLen(0);
      return;
    }

    const id = setInterval(() => {
      setRevealedLen((prev) => {
        const latest = contentRef.current;
        const target = latest.length;
        if (prev >= target) return prev; // caught up, no-op (skips re-render)

        // Advance to next word boundary
        const nextSpace = latest.indexOf(" ", prev + 1);
        const nextNewline = latest.indexOf("\n", prev + 1);
        let boundary = target;
        if (nextSpace !== -1) boundary = Math.min(boundary, nextSpace + 1);
        if (nextNewline !== -1) boundary = Math.min(boundary, nextNewline + 1);
        return boundary;
      });
    }, speed);

    return () => clearInterval(id);
  }, [hasContent, speed]);

  if (!content) return "";
  return content.slice(0, Math.min(revealedLen, content.length));
}
