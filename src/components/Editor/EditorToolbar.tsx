"use client";

import { Button } from "@/components/ui/button";

interface EditorToolbarProps {
  language: string;
  hasExercise: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  onHint: () => void;
}

export default function EditorToolbar({
  language,
  hasExercise,
  isSubmitting,
  onSubmit,
  onHint,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
      {/* Language Badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Language:</span>
        <span className="px-2 py-1 text-xs font-medium bg-muted">{language || "plaintext"}</span>
      </div>

      {/* Actions */}
      {hasExercise && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onHint} disabled={isSubmitting}>
            Hint
          </Button>
          <Button size="sm" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Evaluating..." : "Submit"}
          </Button>
        </div>
      )}
    </div>
  );
}
