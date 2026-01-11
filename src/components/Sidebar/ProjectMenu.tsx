"use client";

import { useState, useCallback } from "react";
import { Folder, FolderOpen, CaretRight, CaretDown, Circle, Plus } from "@phosphor-icons/react";
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import type { Project, Session } from "@/lib/types";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { InlineEdit } from "@/components/ui";
import { cn } from "@/lib/utils";

interface ProjectMenuProps {
  projects: Project[];
  sessions: Session[];
  currentProjectId: string | null;
  currentSessionId: string | null;
  onSelectProject: (projectId: string) => void;
  onSelectSession: (projectId: string, sessionId: string) => void;
  onCreateSession: (projectId: string) => void;
  onRenameProject?: (projectId: string, newName: string) => void;
  onRenameSession?: (projectId: string, sessionId: string, newTitle: string) => void;
}

interface EditingState {
  type: "project" | "session";
  id: string;
  projectId?: string;
}

export default function ProjectMenu({
  projects,
  sessions,
  currentProjectId,
  currentSessionId,
  onSelectProject,
  onSelectSession,
  onCreateSession,
  onRenameProject,
  onRenameSession,
}: ProjectMenuProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(currentProjectId ? [currentProjectId] : [])
  );
  const [editingItem, setEditingItem] = useState<EditingState | null>(null);

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
    onSelectProject(projectId);
  };

  const getProjectSessions = (projectId: string) => {
    return sessions.filter((s) => s.projectId === projectId);
  };

  const handleSaveRename = useCallback(
    (newValue: string) => {
      if (!editingItem) return;

      if (editingItem.type === "project") {
        onRenameProject?.(editingItem.id, newValue);
      } else if (editingItem.type === "session" && editingItem.projectId) {
        onRenameSession?.(editingItem.projectId, editingItem.id, newValue);
      }
      setEditingItem(null);
    },
    [editingItem, onRenameProject, onRenameSession]
  );

  const handleCancelRename = useCallback(() => {
    setEditingItem(null);
  }, []);

  const handleRenameProject = useCallback((projectId: string) => {
    setEditingItem({ type: "project", id: projectId });
  }, []);

  const handleRenameSession = useCallback((sessionId: string, projectId: string) => {
    setEditingItem({ type: "session", id: sessionId, projectId });
  }, []);

  return (
    <SidebarMenu>
      {projects.map((project) => {
        const isExpanded = expandedProjects.has(project.id);
        const projectSessions = getProjectSessions(project.id);
        const isEditingProject = editingItem?.type === "project" && editingItem.id === project.id;

        return (
          <CollapsiblePrimitive.Root
            key={project.id}
            open={isExpanded}
            onOpenChange={() => toggleProject(project.id)}
          >
            <SidebarMenuItem>
              {isEditingProject ? (
                <div className="flex items-center gap-2 h-8 px-2 w-full">
                  {isExpanded ? (
                    <CaretDown className="size-4 shrink-0" />
                  ) : (
                    <CaretRight className="size-4 shrink-0" />
                  )}
                  {isExpanded ? (
                    <FolderOpen className="size-4 shrink-0" />
                  ) : (
                    <Folder className="size-4 shrink-0" />
                  )}
                  <InlineEdit
                    value={project.name}
                    isEditing={isEditingProject}
                    onSave={handleSaveRename}
                    onCancel={handleCancelRename}
                    className="font-medium"
                  />
                </div>
              ) : (
                <ContextMenu>
                  <ContextMenuTrigger>
                    <CollapsiblePrimitive.Trigger render={<SidebarMenuButton />}>
                      {isExpanded ? (
                        <CaretDown className="size-4" />
                      ) : (
                        <CaretRight className="size-4" />
                      )}
                      {isExpanded ? (
                        <FolderOpen className="size-4" />
                      ) : (
                        <Folder className="size-4" />
                      )}
                      <span className="truncate flex-1">{project.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {projectSessions.length}
                      </span>
                    </CollapsiblePrimitive.Trigger>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => handleRenameProject(project.id)}>
                      Rename
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              )}

              <CollapsiblePrimitive.Panel>
                <SidebarMenuSub>
                  {projectSessions.length === 0 ? (
                    <div className="px-2 py-1 text-[10px] text-muted-foreground">
                      No sessions yet
                    </div>
                  ) : (
                    projectSessions.map((session) => {
                      const isSessionSelected = session.id === currentSessionId;
                      const isEditingSession =
                        editingItem?.type === "session" && editingItem.id === session.id;

                      return (
                        <SidebarMenuSubItem key={session.id}>
                          {isEditingSession ? (
                            <div className="flex items-center gap-2 h-7 px-2 w-full">
                              <Circle
                                className={cn(
                                  "size-2 shrink-0",
                                  session.status === "active"
                                    ? "text-primary"
                                    : "text-muted-foreground/30"
                                )}
                                weight="fill"
                              />
                              <InlineEdit
                                value={session.title}
                                isEditing={isEditingSession}
                                onSave={handleSaveRename}
                                onCancel={handleCancelRename}
                              />
                            </div>
                          ) : (
                            <ContextMenu>
                              <ContextMenuTrigger>
                                <SidebarMenuSubButton
                                  isActive={isSessionSelected}
                                  onClick={() => onSelectSession(project.id, session.id)}
                                  render={<button type="button" />}
                                >
                                  <Circle
                                    className={cn(
                                      "size-2",
                                      session.status === "active"
                                        ? "text-primary"
                                        : "text-muted-foreground/30"
                                    )}
                                    weight="fill"
                                  />
                                  <span className="truncate flex-1">{session.title}</span>
                                </SidebarMenuSubButton>
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                <ContextMenuItem
                                  onClick={() => handleRenameSession(session.id, project.id)}
                                >
                                  Rename
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          )}
                        </SidebarMenuSubItem>
                      );
                    })
                  )}

                  {/* New Session Button */}
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      onClick={() => onCreateSession(project.id)}
                      className="text-muted-foreground hover:text-foreground"
                      render={<button type="button" />}
                    >
                      <Plus className="size-3" />
                      <span>New Session</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsiblePrimitive.Panel>
            </SidebarMenuItem>
          </CollapsiblePrimitive.Root>
        );
      })}
    </SidebarMenu>
  );
}
