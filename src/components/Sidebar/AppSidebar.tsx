"use client";

import { useState, useEffect, useMemo } from "react";
import { Gear, MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import type { Project, Session } from "@/lib/types";
import { Sidebar, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import AuthSettingsModal from "@/components/Auth/AuthSettingsModal";
import { useCredentialStatus } from "@/hooks/useCredentialStatus";
import { useIsTauri } from "@/hooks/use-tauri";
import { cn } from "@/lib/utils";
import CreateProjectModal from "./CreateProjectModal";
import PickProjectModal from "./PickProjectModal";
import ProjectChips from "./ProjectChips";
import SessionList from "./SessionList";

interface AppSidebarProps {
  projects: Project[];
  sessions: Session[];
  sessionErrorByProject?: Record<string, string>;
  currentProjectId: string | null;
  currentSessionId: string | null;
  loading?: boolean;
  onSelectProject: (projectId: string) => void;
  onSelectSession: (projectId: string, sessionId: string) => void;
  onCreateProject: (name: string) => void;
  onCreateSession: (projectId: string) => void;
  onRenameProject?: (projectId: string, newName: string) => void;
  onRenameSession?: (projectId: string, sessionId: string, newTitle: string) => void;
  onDeleteProject?: (projectId: string) => Promise<void> | void;
  onDeleteSession?: (projectId: string, sessionId: string) => Promise<void> | void;
}

export default function AppSidebar({
  projects,
  sessions,
  sessionErrorByProject,
  currentProjectId,
  currentSessionId,
  onSelectProject,
  onSelectSession,
  onCreateProject,
  onCreateSession,
  onRenameProject,
  onRenameSession,
  onDeleteProject,
  onDeleteSession,
}: AppSidebarProps) {
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isPickProjectOpen, setIsPickProjectOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(currentProjectId);
  const [searchQuery, setSearchQuery] = useState("");
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const { status: credStatus } = useCredentialStatus();
  const credConfigured = credStatus.active_kind !== null;
  const isTauri = useIsTauri();

  useEffect(() => {
    if (currentProjectId && activeProjectId && currentProjectId !== activeProjectId) {
      setActiveProjectId(currentProjectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId]);

  // If the active project filter points at a deleted/missing project, fall
  // back to "All" so the session list stays usable.
  useEffect(() => {
    if (activeProjectId && !projects.some((p) => p.id === activeProjectId)) {
      setActiveProjectId(null);
    }
  }, [projects, activeProjectId]);

  const sessionCountByProject = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of sessions) counts[s.projectId] = (counts[s.projectId] ?? 0) + 1;
    return counts;
  }, [sessions]);

  const handleSelectChip = (projectId: string | null) => {
    setActiveProjectId(projectId);
    if (projectId) onSelectProject(projectId);
  };

  const handleCreateProject = (name: string) => {
    onCreateProject(name);
    setIsCreateProjectOpen(false);
  };

  const handleNewSession = () => {
    if (activeProjectId) {
      onCreateSession(activeProjectId);
      return;
    }
    if (projects.length === 0) {
      setIsCreateProjectOpen(true);
      return;
    }
    if (projects.length === 1) {
      onCreateSession(projects[0].id);
      return;
    }
    setIsPickProjectOpen(true);
  };

  const topPad = isTauri ? "pt-10" : "pt-2";

  return (
    <Sidebar collapsible="none" className="h-svh">
      {isTauri && <div data-tauri-drag-region className="absolute inset-x-0 top-0 h-10 z-20" />}

      <SidebarContent className={cn("relative", topPad)}>
        <div className="flex items-center gap-1.5 px-2">
          <div className="relative flex-1 h-7">
            <MagnifyingGlass
              size={13}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sessions"
              className="w-full h-7 pl-7 pr-7 text-[12px] bg-transparent border border-sidebar-border focus:outline-none focus:border-foreground/40 placeholder:text-muted-foreground/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 size-4 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X size={11} weight="bold" />
              </button>
            )}
          </div>
        </div>

        <ProjectChips
          projects={projects}
          activeProjectId={activeProjectId}
          counts={sessionCountByProject}
          onSelect={handleSelectChip}
          onCreate={() => setIsCreateProjectOpen(true)}
          onRename={onRenameProject}
          onDelete={onDeleteProject ? setProjectToDelete : undefined}
        />

        <SessionList
          projects={projects}
          sessions={sessions}
          sessionErrorByProject={sessionErrorByProject}
          activeProjectId={activeProjectId}
          currentSessionId={currentSessionId}
          searchQuery={searchQuery}
          onSelectSession={onSelectSession}
          onRenameSession={onRenameSession}
          onDeleteSession={onDeleteSession ? setSessionToDelete : undefined}
        />
      </SidebarContent>

      <SidebarFooter className="gap-0 p-0">
        <div className="flex items-center gap-1 px-2 py-1.5">
          <button
            type="button"
            onClick={handleNewSession}
            className="flex-1 flex items-center gap-2 h-8 px-2 text-[12px] font-medium text-left transition-colors hover:bg-sidebar-accent/15 text-foreground"
          >
            <Plus size={13} weight="bold" />
            <span>New session</span>
          </button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsAuthOpen(true)}
            title={credConfigured ? "Settings" : "Set up Anthropic authentication"}
            className="relative shrink-0"
          >
            <Gear size={16} weight={credConfigured ? "regular" : "fill"} />
            <span className="sr-only">Settings</span>
            {!credConfigured && <span className="absolute top-1 right-1 size-1.5 bg-destructive" />}
          </Button>
          <ThemeToggle />
        </div>
      </SidebarFooter>

      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        onCreate={handleCreateProject}
      />

      <PickProjectModal
        isOpen={isPickProjectOpen}
        projects={projects}
        onClose={() => setIsPickProjectOpen(false)}
        onPick={(projectId) => onCreateSession(projectId)}
      />

      <AuthSettingsModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      <ConfirmDialog
        isOpen={projectToDelete !== null}
        title={`Delete "${projectToDelete?.name ?? ""}"?`}
        description={
          <>
            This permanently deletes the project and all{" "}
            <strong>{projectToDelete ? (sessionCountByProject[projectToDelete.id] ?? 0) : 0}</strong>{" "}
            session(s) inside it, including messages and exercises. This cannot be undone.
          </>
        }
        confirmLabel="Delete project"
        onConfirm={async () => {
          if (projectToDelete && onDeleteProject) {
            await onDeleteProject(projectToDelete.id);
          }
        }}
        onClose={() => setProjectToDelete(null)}
      />

      <ConfirmDialog
        isOpen={sessionToDelete !== null}
        title={`Delete "${sessionToDelete?.title || "Untitled session"}"?`}
        description="This permanently deletes the session, its messages, and exercises. This cannot be undone."
        confirmLabel="Delete session"
        onConfirm={async () => {
          if (sessionToDelete && onDeleteSession) {
            await onDeleteSession(sessionToDelete.projectId, sessionToDelete.id);
          }
        }}
        onClose={() => setSessionToDelete(null)}
      />
    </Sidebar>
  );
}
