"use client";

import type { ConceptQuestion } from "@/lib/types";
import { CheckCircle, XCircle, WarningCircle } from "@phosphor-icons/react";

interface ConceptQuestionBlockProps {
  question: ConceptQuestion;
  onAnswer?: (questionId: string, optionIndex: number) => void;
  disabled?: boolean;
}

export default function ConceptQuestionBlock({
  question,
  onAnswer,
  disabled,
}: ConceptQuestionBlockProps) {
  const isAnswered = question.selectedOptionIndex !== null;

  return (
    <div className="my-4 ring-1 ring-border overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="bg-primary/10 px-4 py-2 flex items-center justify-between border-b border-border">
        <h3 className="font-semibold text-primary text-sm">Concept Check</h3>
      </div>

      {/* Question */}
      <div className="p-4 space-y-3">
        <p className="text-sm font-medium">{question.question}</p>

        {/* Options */}
        <div className="space-y-2">
          {question.options.map((option, index) => {
            const isSelected = question.selectedOptionIndex === index;

            let optionClasses = "w-full text-left px-3 py-2.5 text-sm border transition-colors ";

            if (!isAnswered) {
              optionClasses +=
                "border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer";
            } else if (option.correctness === "correct") {
              optionClasses +=
                "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400";
            } else if (option.correctness === "partial") {
              optionClasses +=
                "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
            } else if (isSelected) {
              // Only show red for the selected incorrect option
              optionClasses += "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400";
            } else {
              optionClasses += "border-border/50 text-muted-foreground opacity-60";
            }

            return (
              <button
                key={index}
                className={optionClasses}
                onClick={() => !isAnswered && !disabled && onAnswer?.(question.id, index)}
                disabled={isAnswered || disabled}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs shrink-0 w-5">
                    {String.fromCharCode(65 + index)}.
                  </span>
                  <span className="flex-1">{option.text}</span>
                  {isAnswered && option.correctness === "correct" && (
                    <CheckCircle
                      size={18}
                      weight="fill"
                      className="shrink-0 text-green-600 dark:text-green-400"
                    />
                  )}
                  {isAnswered && option.correctness === "partial" && (
                    <WarningCircle
                      size={18}
                      weight="fill"
                      className="shrink-0 text-yellow-600 dark:text-yellow-400"
                    />
                  )}
                  {isAnswered && isSelected && option.correctness === "incorrect" && (
                    <XCircle
                      size={18}
                      weight="fill"
                      className="shrink-0 text-red-600 dark:text-red-400"
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-muted/50 border-t border-border text-xs text-muted-foreground">
        {isAnswered
          ? question.status === "correct"
            ? "Correct!"
            : question.status === "partial"
              ? "Partially correct"
              : "Incorrect"
          : "Select an answer"}
      </div>
    </div>
  );
}
