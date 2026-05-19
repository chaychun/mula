"use client";

import { useState, useCallback, useMemo } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import type { Project } from "@/lib/types";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { InlineEdit } from "@/components/ui";
import { cn } from "@/lib/utils";

interface ProjectChipsProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelect: (projectId: string | null) => void;
  onCreate: () => void;
  onRename?: (projectId: string, newName: string) => void;
  onDelete?: (project: Project) => void;
  counts: Record<string, number>;
}

const CHIP_BASE =
  "inline-flex items-center justify-center h-6 px-2 text-[10px] font-medium uppercase tracking-wide leading-none transition-colors whitespace-nowrap";

export default function ProjectChips({
  projects,
  activeProjectId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  counts,
}: ProjectChipsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const totalCount = useMemo(
    () => Object.values(counts).reduce((sum, n) => sum + n, 0),
    [counts],
  );

  const handleSave = useCallback(
    (newValue: string) => {
      if (editingId) onRename?.(editingId, newValue);
      setEditingId(null);
    },
    [editingId, onRename],
  );

  return (
    <div className="flex flex-wrap gap-1 px-2 py-2">
      <Chip
        active={activeProjectId === null}
        label="All"
        count={totalCount}
        onClick={() => onSelect(null)}
      />

      {projects.map((project) => {
        const isActive = activeProjectId === project.id;
        const isEditing = editingId === project.id;
        const count = counts[project.id] ?? 0;

        if (isEditing) {
          return (
            <div
              key={project.id}
              className={cn(CHIP_BASE, "bg-sidebar-accent/25 normal-case")}
            >
              <InlineEdit
                value={project.name}
                isEditing
                onSave={handleSave}
                onCancel={() => setEditingId(null)}
                className="text-[10px]"
              />
            </div>
          );
        }

        return (
          <ContextMenu key={project.id}>
            <ContextMenuTrigger
              render={
                <Chip
                  active={isActive}
                  label={project.name}
                  count={count}
                  onClick={() => onSelect(project.id)}
                />
              }
            />
            <ContextMenuContent>
              <ContextMenuItem onClick={() => setEditingId(project.id)}>
                Rename
              </ContextMenuItem>
              {onDelete && (
                <ContextMenuItem
                  variant="destructive"
                  onClick={() => onDelete(project)}
                >
                  Delete
                </ContextMenuItem>
              )}
            </ContextMenuContent>
          </ContextMenu>
        );
      })}

      <button
        type="button"
        onClick={onCreate}
        title="New project"
        aria-label="New project"
        className={cn(
          CHIP_BASE,
          "text-muted-foreground/60 hover:text-foreground hover:bg-sidebar-accent/15",
        )}
      >
        <PlusIcon size={11} weight="bold" />
      </button>
    </div>
  );
}

function Chip({
  active,
  label,
  count,
  onClick,
  className,
  ...rest
}: {
  active: boolean;
  label: string;
  count: number;
  onClick?: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      className={cn(
        CHIP_BASE,
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/15",
        className,
      )}
    >
      <span className="block truncate max-w-30">{label}</span>
      <span
        className={cn(
          "ml-1.5 tabular-nums normal-case",
          active ? "text-background/60" : "text-muted-foreground/50",
        )}
      >
        {count}
      </span>
    </button>
  );
}
