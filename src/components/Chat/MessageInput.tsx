"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, Bug } from "@phosphor-icons/react";
import { PromptInput, PromptInputTextarea, PromptInputActions } from "@/components/ui/prompt-input";

const showDevTools = process.env.NEXT_PUBLIC_DEV_TOOLS === "true";

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  testingMode?: boolean;
  onTestingModeChange?: (enabled: boolean) => void;
}

export default function MessageInput({
  onSend,
  disabled = false,
  placeholder = "What would you like to learn?",
  testingMode,
  onTestingModeChange,
}: MessageInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setInput("");
    }
  };

  return (
    <PromptInput value={input} onValueChange={setInput} onSubmit={handleSubmit} disabled={disabled}>
      <PromptInputTextarea placeholder={placeholder} />
      <PromptInputActions className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          {showDevTools && onTestingModeChange && (
            <button
              type="button"
              onClick={() => onTestingModeChange(!testingMode)}
              className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium transition-colors ${
                testingMode
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bug size={12} weight={testingMode ? "fill" : "regular"} />
              Testing
            </button>
          )}
          <span className="text-[10px] text-muted-foreground">Press Enter to send</span>
        </div>
        <Button size="icon-sm" onClick={handleSubmit} disabled={disabled || !input.trim()}>
          <ArrowUp size={16} weight="bold" />
        </Button>
      </PromptInputActions>
    </PromptInput>
  );
}
