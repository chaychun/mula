"use client";

import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

interface ExerciseHeaderProps {
  title: string;
  language: string;
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function ExerciseHeader({
  title,
  language,
  isCollapsed,
  onToggle,
}: ExerciseHeaderProps) {
  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-2 px-3 py-2 h-auto font-normal hover:bg-muted/50"
      onClick={onToggle}
    >
      {isCollapsed ? (
        <CaretRight className="size-4 shrink-0" />
      ) : (
        <CaretDown className="size-4 shrink-0" />
      )}
      <span className="font-semibold text-sm flex-1 text-left">{title}</span>
      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-sm">
        {language}
      </span>
    </Button>
  );
}
