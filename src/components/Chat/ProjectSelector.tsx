"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDownIcon, PlusIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types";

interface ProjectSelectorProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelect: (projectId: string) => void;
  onCreateProject: () => void;
  disabled?: boolean;
}

export default function ProjectSelector({
  projects,
  selectedProjectId,
  onSelect,
  onCreateProject,
  disabled,
}: ProjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const selected = projects.find((p) => p.id === selectedProjectId) ?? null;
  const label = selected?.name ?? (projects.length === 0 ? "No project" : "Select project");

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 h-7 px-2 text-[12px] border border-border bg-transparent transition-colors",
          "hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <span className="truncate max-w-45">{label}</span>
        <CaretDownIcon size={10} weight="bold" className="text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 z-30 min-w-50 border border-border bg-popover shadow-md">
          <div className="max-h-64 overflow-y-auto py-1">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelect(p.id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left px-2.5 py-1.5 text-[12px] transition-colors hover:bg-muted",
                  p.id === selectedProjectId && "bg-muted/60 font-medium"
                )}
              >
                <span className="truncate block">{p.name}</span>
              </button>
            ))}
            {projects.length > 0 && <div className="my-1 h-px bg-border" />}
            <button
              type="button"
              onClick={() => {
                onCreateProject();
                setOpen(false);
              }}
              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-foreground transition-colors hover:bg-muted"
            >
              <PlusIcon size={12} weight="bold" />
              New project
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
