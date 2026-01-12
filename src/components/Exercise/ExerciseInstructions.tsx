"use client";

interface ExerciseInstructionsProps {
  instructions: string;
  hints?: string[];
}

export default function ExerciseInstructions({ instructions, hints }: ExerciseInstructionsProps) {
  return (
    <div className="px-4 py-3 space-y-3 border-b border-border">
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <p className="text-sm text-foreground whitespace-pre-wrap">{instructions}</p>
      </div>

      {hints && hints.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Hints
          </h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {hints.map((hint, index) => (
              <li key={index} className="flex gap-2">
                <span className="text-muted-foreground/50">•</span>
                <span>{hint}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
