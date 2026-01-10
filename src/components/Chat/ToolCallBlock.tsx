"use client";

import { useState, useEffect } from "react";
import type { ToolCall } from "@/lib/types";

interface ToolCallBlockProps {
  toolCall: ToolCall;
}

const OUTPUT_PREVIEW_LIMIT = 500;

export function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [isExpanded, setIsExpanded] = useState(toolCall.status === "error");
  const [showFullOutput, setShowFullOutput] = useState(false);

  // Auto-expand when status changes to error
  useEffect(() => {
    if (toolCall.status === "error") {
      setIsExpanded(true);
    }
  }, [toolCall.status]);

  const statusIcon = {
    pending: "...",
    completed: "\u2713",
    error: "\u2717",
  }[toolCall.status];

  const statusColor = {
    pending: "text-yellow-500",
    completed: "text-green-500",
    error: "text-red-500",
  }[toolCall.status];

  // Format tool name for display (remove mcp__ prefix)
  const displayName = toolCall.name.replace(/^mcp__[^_]+__/, "");

  return (
    <div className="my-2 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden text-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs">
            {isExpanded ? "\u25BC" : "\u25B6"}
          </span>
          <span className="font-mono text-xs">{displayName}</span>
        </div>
        <span className={`font-mono ${statusColor}`}>{statusIcon}</span>
      </button>

      {isExpanded && (
        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 text-xs border-t border-gray-200 dark:border-gray-700">
          <div className="mb-2">
            <span className="font-semibold text-gray-600 dark:text-gray-400">
              Input:
            </span>
            <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {toolCall.output && (
            <div>
              <span className="font-semibold text-gray-600 dark:text-gray-400">
                Output:
              </span>
              <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto max-h-40 overflow-y-auto">
                {showFullOutput || toolCall.output.length <= OUTPUT_PREVIEW_LIMIT
                  ? toolCall.output
                  : toolCall.output.slice(0, OUTPUT_PREVIEW_LIMIT) + "..."}
              </pre>
              {toolCall.output.length > OUTPUT_PREVIEW_LIMIT && (
                <button
                  onClick={() => setShowFullOutput(!showFullOutput)}
                  className="mt-1 text-blue-500 hover:underline text-xs"
                >
                  {showFullOutput ? "Show less" : "Show full output"}
                </button>
              )}
            </div>
          )}
          {toolCall.error && (
            <div className="text-red-500 mt-2">
              <span className="font-semibold">Error:</span> {toolCall.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
