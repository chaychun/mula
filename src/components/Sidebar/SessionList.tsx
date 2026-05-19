"use client";

import { useState, useCallback, useMemo } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import type { Project, Session } from "@/lib/types";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { InlineEdit } from "@/components/ui";
import { cn } from "@/lib/utils";

interface SessionListProps {
  projects: Project[];
  sessions: Session[];
  sessionErrorByProject?: Record<string, string>;
  activeProjectId: string | null;
  currentSessionId: string | null;
  searchQuery: string;
  onSelectSession: (projectId: string, sessionId: string) => void;
  onRenameSession?: (projectId: string, sessionId: string, newTitle: string) => void;
  onDeleteSession?: (session: Session) => void;
}

type BucketKey = "today" | "yesterday" | "thisWeek" | "thisMonth" | "earlier";

const BUCKET_LABELS: Record<BucketKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This week",
  thisMonth: "This month",
  earlier: "Earlier",
};

const BUCKET_ORDER: BucketKey[] = ["today", "yesterday", "thisWeek", "thisMonth", "earlier"];

function dateBucket(iso: string): BucketKey {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 6);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  if (d >= startOfToday) return "today";
  if (d >= startOfYesterday) return "yesterday";
  if (d >= startOfWeek) return "thisWeek";
  if (d >= startOfMonth) return "thisMonth";
  return "earlier";
}

export default function SessionList({
  projects,
  sessions,
  sessionErrorByProject,
  activeProjectId,
  currentSessionId,
  searchQuery,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
}: SessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const projectName = useCallback(
    (id: string) => projects.find((p) => p.id === id)?.name ?? "",
    [projects]
  );

  const grouped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = sessions
      .filter((s) => (activeProjectId ? s.projectId === activeProjectId : true))
      .filter((s) => (q ? s.title.toLowerCase().includes(q) : true))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

    const buckets: Record<BucketKey, Session[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      thisMonth: [],
      earlier: [],
    };
    for (const s of filtered) {
      buckets[dateBucket(s.updatedAt)].push(s);
    }
    return buckets;
  }, [sessions, activeProjectId, searchQuery]);

  const handleSave = useCallback(
    (newValue: string) => {
      if (!editingId) return;
      const session = sessions.find((s) => s.id === editingId);
      if (session) onRenameSession?.(session.projectId, editingId, newValue);
      setEditingId(null);
    },
    [editingId, sessions, onRenameSession]
  );

  const totalShown = BUCKET_ORDER.reduce((sum, k) => sum + grouped[k].length, 0);
  const errorEntries = Object.entries(sessionErrorByProject ?? {});

  if (totalShown === 0) {
    return (
      <div className="px-3 py-8">
        {searchQuery ? (
          <p className="text-xs text-muted-foreground">No sessions match "{searchQuery}".</p>
        ) : activeProjectId ? (
          <p className="text-xs text-muted-foreground">
            No sessions in {projectName(activeProjectId)} yet.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            No sessions yet. Create a project, then start your first session.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {errorEntries.length > 0 && (
        <div className="px-3 py-2 mb-1 border-y border-destructive/30 bg-destructive/5">
          {errorEntries.map(([pid, err]) => (
            <div
              key={pid}
              className="flex items-start gap-2 text-[11px] text-destructive leading-tight"
            >
              <WarningCircle size={12} weight="fill" className="mt-0.5 shrink-0" />
              <span className="truncate">
                Couldn't load {projectName(pid) || "project"} sessions ({err})
              </span>
            </div>
          ))}
        </div>
      )}

      {BUCKET_ORDER.map((bucket) => {
        const items = grouped[bucket];
        if (items.length === 0) return null;
        return (
          <div key={bucket} className="pb-2">
            <div className="px-3 pt-4 pb-1">
              <span className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground/60">
                {BUCKET_LABELS[bucket]}
              </span>
            </div>

            <ul>
              {items.map((session) => {
                const isSelected = session.id === currentSessionId;
                const isEditing = editingId === session.id;
                const exCount = Object.keys(session.exercises ?? {}).length;

                return (
                  <li key={session.id} className="relative">
                    {isSelected && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary"
                      />
                    )}
                    {isEditing ? (
                      <div className="px-3 py-1.5">
                        <InlineEdit
                          value={session.title}
                          isEditing
                          onSave={handleSave}
                          onCancel={() => setEditingId(null)}
                          className="text-[13px] font-medium"
                        />
                      </div>
                    ) : (
                      <ContextMenu>
                        <ContextMenuTrigger>
                          <button
                            type="button"
                            onClick={() => onSelectSession(session.projectId, session.id)}
                            className={cn(
                              "w-full text-left flex flex-col gap-0.5 px-3 py-1.5 transition-colors",
                              isSelected ? "bg-muted/60" : "hover:bg-muted/30"
                            )}
                          >
                            <span
                              className={cn(
                                "text-[13px] leading-tight truncate",
                                isSelected ? "font-semibold text-foreground" : "font-medium"
                              )}
                            >
                              {session.title || "Untitled session"}
                            </span>
                            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <span className="truncate">{projectName(session.projectId)}</span>
                              <span className="text-muted-foreground/40">·</span>
                              <span className="tabular-nums shrink-0">
                                {exCount} {exCount === 1 ? "exercise" : "exercises"}
                              </span>
                            </span>
                          </button>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem onClick={() => setEditingId(session.id)}>
                            Rename
                          </ContextMenuItem>
                          {onDeleteSession && (
                            <ContextMenuItem
                              variant="destructive"
                              onClick={() => onDeleteSession(session)}
                            >
                              Delete
                            </ContextMenuItem>
                          )}
                        </ContextMenuContent>
                      </ContextMenu>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
