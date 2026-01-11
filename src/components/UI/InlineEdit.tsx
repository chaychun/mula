"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface InlineEditProps {
  value: string;
  onSave: (newValue: string) => void;
  onCancel: () => void;
  isEditing: boolean;
  placeholder?: string;
  className?: string;
}

export function InlineEdit({
  value,
  onSave,
  onCancel,
  isEditing,
  placeholder = "Enter name...",
  className = "",
}: InlineEditProps) {
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef(false);

  useEffect(() => {
    if (isEditing) {
      setEditValue(value);
      savedRef.current = false;
      // Small delay to ensure the input is rendered before focusing
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isEditing, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const trimmed = editValue.trim();
        if (trimmed) {
          savedRef.current = true;
          onSave(trimmed);
        } else {
          onCancel();
        }
      } else if (e.key === "Escape") {
        onCancel();
      }
    },
    [editValue, onSave, onCancel]
  );

  const handleBlur = useCallback(() => {
    // Prevent double-save if already saved via Enter key
    if (savedRef.current) {
      savedRef.current = false;
      return;
    }
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      onCancel();
    }
  }, [editValue, value, onSave, onCancel]);

  if (!isEditing) {
    return <span className={cn("truncate flex-1", className)}>{value}</span>;
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={cn(
        "flex-1 px-1 py-0 text-xs border rounded-none bg-background border-primary outline-none",
        className
      )}
    />
  );
}
