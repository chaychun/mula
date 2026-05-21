"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUpIcon } from "@phosphor-icons/react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  usePromptInput,
} from "@/components/ui/prompt-input";

function FocusOnSignal({ signal }: { signal: unknown }) {
  const { textareaRef } = usePromptInput();
  useEffect(() => {
    textareaRef.current?.focus();
  }, [signal, textareaRef]);
  return null;
}

const showDevTools = process.env.NODE_ENV === "development";

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  submitDisabled?: boolean;
  placeholder?: string;
  testingMode?: boolean;
  onTestingModeChange?: (enabled: boolean) => void;
  value?: string;
  onValueChange?: (value: string) => void;
  leadingActions?: ReactNode;
  focusSignal?: unknown;
}

export default function MessageInput({
  onSend,
  disabled = false,
  submitDisabled = false,
  placeholder = "What would you like to learn?",
  testingMode,
  onTestingModeChange,
  value,
  onValueChange,
  leadingActions,
  focusSignal,
}: MessageInputProps) {
  const [internalInput, setInternalInput] = useState("");
  const isControlled = value !== undefined && onValueChange !== undefined;
  const input = isControlled ? value : internalInput;
  const setInput = isControlled ? onValueChange : setInternalInput;
  const cannotSend = disabled || submitDisabled;

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (trimmed && !cannotSend) {
      onSend(trimmed);
      setInput("");
    }
  };

  return (
    <PromptInput value={input} onValueChange={setInput} onSubmit={handleSubmit} disabled={disabled}>
      {focusSignal !== undefined && <FocusOnSignal signal={focusSignal} />}
      <PromptInputTextarea placeholder={placeholder} />
      <PromptInputActions className="flex items-center justify-between px-3 py-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {leadingActions ?? (
            <span className="text-[10px] text-muted-foreground">Press Enter to send</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {showDevTools && onTestingModeChange && (
            <label
              htmlFor="testing-mode"
              className="flex items-center gap-1.5 cursor-pointer select-none"
            >
              <Checkbox
                id="testing-mode"
                checked={testingMode ?? false}
                onCheckedChange={(checked) => onTestingModeChange(checked === true)}
                className="size-3.5"
              />
              <span className="text-[10px] text-muted-foreground">testing mode</span>
            </label>
          )}
          <Button size="icon-sm" onClick={handleSubmit} disabled={cannotSend || !input.trim()}>
            <ArrowUpIcon size={16} weight="bold" />
          </Button>
        </div>
      </PromptInputActions>
    </PromptInput>
  );
}
