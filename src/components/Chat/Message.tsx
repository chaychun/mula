"use client";

import type { Message } from "@/lib/types";
import { MarkdownContent } from "./MarkdownContent";
import { ToolCallBlock } from "./ToolCallBlock";

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  // Use contentBlocks if available for interleaved rendering
  if (message.contentBlocks && message.contentBlocks.length > 0) {
    return (
      <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[85%] px-4 py-2 ${
            isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
          }`}
        >
          <div className="space-y-2">
            {message.contentBlocks.map((block, index) => {
              if (block.type === "text") {
                return (
                  <div key={`text-${index}`} className="text-sm">
                    <MarkdownContent content={block.text} />
                  </div>
                );
              }
              if (block.type === "tool_call") {
                return <ToolCallBlock key={block.toolCall.id} toolCall={block.toolCall} />;
              }
              return null;
            })}
          </div>
        </div>
      </div>
    );
  }

  // Fallback to legacy rendering (tool calls first, then content)
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] px-4 py-2 ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        }`}
      >
        <div className="space-y-2">
          {/* Tool calls */}
          {message.toolCalls?.map((toolCall) => (
            <ToolCallBlock key={toolCall.id} toolCall={toolCall} />
          ))}

          {/* Message content with markdown */}
          {message.content && (
            <div className="text-sm">
              <MarkdownContent content={message.content} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
