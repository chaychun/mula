"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface ExerciseActionsProps {
  onSubmit: () => void;
  onSkip: () => void;
  onReset: () => void;
  disabled?: boolean;
  isPending?: boolean;
}

export default function ExerciseActions({
  onSubmit,
  onSkip,
  onReset,
  disabled = false,
  isPending = false,
}: ExerciseActionsProps) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-2 bg-muted/30">
      <Button variant="outline" size="sm" onClick={onReset} disabled={disabled || isPending}>
        Reset
      </Button>

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onSkip} disabled={disabled || isPending}>
          Skip
        </Button>
        <Button variant="default" size="sm" onClick={onSubmit} disabled={disabled || isPending}>
          {isPending ? (
            <>
              <Spinner className="size-3" />
              <span>Submitting...</span>
            </>
          ) : (
            "Submit"
          )}
        </Button>
      </div>
    </div>
  );
}
