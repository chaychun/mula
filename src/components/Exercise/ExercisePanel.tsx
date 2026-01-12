"use client";

import { useState, useEffect } from "react";
import type { Exercise } from "@/lib/types";
import ExerciseHeader from "./ExerciseHeader";
import ExerciseInstructions from "./ExerciseInstructions";
import ExerciseEditor from "./ExerciseEditor";
import ExerciseActions from "./ExerciseActions";

interface ExercisePanelProps {
  exercise: Exercise;
  onSubmit: (code: string) => void;
  onSkip: () => void;
  onReset: () => void;
  disabled?: boolean;
}

export default function ExercisePanel({
  exercise,
  onSubmit,
  onSkip,
  onReset,
  disabled = false,
}: ExercisePanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [code, setCode] = useState(() => {
    // Initialize from last attempt if exists, otherwise use starter code
    if (exercise.attempts.length > 0) {
      return exercise.attempts[exercise.attempts.length - 1].code;
    }
    return exercise.starterCode;
  });
  const [isPending, setIsPending] = useState(false);

  // Update code when exercise changes
  useEffect(() => {
    if (exercise.attempts.length > 0) {
      setCode(exercise.attempts[exercise.attempts.length - 1].code);
    } else {
      setCode(exercise.starterCode);
    }
  }, [exercise.id, exercise.attempts, exercise.starterCode]);

  const handleSubmit = () => {
    setIsPending(true);
    onSubmit(code);
    // Reset pending state after a delay (will be cleared when exercise becomes inactive)
    setTimeout(() => setIsPending(false), 1000);
  };

  const handleReset = () => {
    setCode(exercise.starterCode);
    onReset();
  };

  return (
    <div className="border border-border rounded-none bg-background overflow-hidden">
      <ExerciseHeader
        title={exercise.title}
        language={exercise.language}
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed(!isCollapsed)}
      />

      {!isCollapsed && (
        <div className="animate-in slide-in-from-top-2 duration-200">
          <ExerciseInstructions instructions={exercise.instructions} hints={exercise.hints} />
          <ExerciseEditor
            code={code}
            language={exercise.language}
            onChange={setCode}
            disabled={disabled}
          />
          <ExerciseActions
            onSubmit={handleSubmit}
            onSkip={onSkip}
            onReset={handleReset}
            disabled={disabled}
            isPending={isPending}
          />
        </div>
      )}
    </div>
  );
}
