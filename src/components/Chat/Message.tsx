"use client";

import type { Message } from "@/lib/types";
import { MarkdownContent } from "./MarkdownContent";
import { ToolCallBlock } from "./ToolCallBlock";

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2 ${
          isUser
            ? "bg-blue-500 text-white"
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        }`}
      >
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
  );
}
