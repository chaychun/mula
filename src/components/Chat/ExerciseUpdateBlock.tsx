"use client";

import { CheckCircleIcon, ArrowCounterClockwiseIcon, XCircleIcon, LightbulbIcon } from "@phosphor-icons/react";
import { InlineMarkdown } from "@/components/ui/markdown";

interface ExerciseUpdateBlockProps {
  status: string;
  hint?: string;
  exerciseTitle?: string;
}

const statusConfig: Record<string, { icon: typeof CheckCircleIcon; label: string; color: string }> = {
  passed: {
    icon: CheckCircleIcon,
    label: "Passed",
    color: "text-green-600 dark:text-green-400",
  },
  passed_with_feedback: {
    icon: CheckCircleIcon,
    label: "Passed with feedback",
    color: "text-green-600 dark:text-green-400",
  },
  needs_retry: {
    icon: ArrowCounterClockwiseIcon,
    label: "Try again",
    color: "text-yellow-600 dark:text-yellow-400",
  },
  failed: {
    icon: XCircleIcon,
    label: "Failed",
    color: "text-red-600 dark:text-red-400",
  },
  skipped: {
    icon: XCircleIcon,
    label: "Skipped",
    color: "text-muted-foreground",
  },
};

export default function ExerciseUpdateBlock({
  status,
  hint,
  exerciseTitle,
}: ExerciseUpdateBlockProps) {
  const config = statusConfig[status];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className="my-4 ring-1 ring-border overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Status */}
      <div className="px-4 py-3 flex items-center gap-3">
        <Icon size={20} weight="fill" className={`shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{config.label}</p>
          {exerciseTitle && (
            <p className="text-xs text-muted-foreground truncate">
              <InlineMarkdown>{exerciseTitle}</InlineMarkdown>
            </p>
          )}
        </div>
      </div>

      {/* Hint */}
      {hint && (
        <div className="px-4 py-2.5 bg-muted/50 border-t border-border flex items-start gap-2.5">
          <LightbulbIcon size={16} weight="fill" className="shrink-0 text-yellow-500 mt-0.5" />
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
      )}
    </div>
  );
}
