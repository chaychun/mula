"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import AppSidebar from "@/components/Sidebar/AppSidebar";
import { SidebarInset } from "@/components/ui/sidebar";
import { useProjects } from "@/hooks/useProjects";
import { useSessions } from "@/hooks/useSessions";
import { Button } from "@/components/ui/button";

export default function Home() {
  const router = useRouter();
  const { projects, loading: projectsLoading, createProject, updateProject } = useProjects();
  const { sessions, createSession, fetchSessions, updateSession } = useSessions(null);

  const handleSelectProject = useCallback(
    (projectId: string) => {
      fetchSessions(projectId);
    },
    [fetchSessions]
  );

  const handleSelectSession = useCallback(
    (projectId: string, sessionId: string) => {
      router.push(`/projects/${projectId}/sessions/${sessionId}`);
    },
    [router]
  );

  const handleCreateProject = useCallback(
    async (name: string) => {
      const project = await createProject(name);
      const session = await createSession(project.id);
      router.push(`/projects/${project.id}/sessions/${session.id}`);
    },
    [createProject, createSession, router]
  );

  const handleCreateSession = useCallback(
    async (projectId: string) => {
      const session = await createSession(projectId);
      router.push(`/projects/${projectId}/sessions/${session.id}`);
    },
    [createSession, router]
  );

  const handleRenameProject = useCallback(
    async (projectId: string, newName: string) => {
      await updateProject(projectId, { name: newName });
    },
    [updateProject]
  );

  const handleRenameSession = useCallback(
    async (projectId: string, sessionId: string, newTitle: string) => {
      await updateSession(projectId, sessionId, { title: newTitle });
    },
    [updateSession]
  );

  return (
    <>
      {/* Sidebar */}
      <AppSidebar
        projects={projects}
        sessions={sessions}
        currentProjectId={null}
        currentSessionId={null}
        loading={projectsLoading}
        onSelectProject={handleSelectProject}
        onSelectSession={handleSelectSession}
        onCreateProject={handleCreateProject}
        onCreateSession={handleCreateSession}
        onRenameProject={handleRenameProject}
        onRenameSession={handleRenameSession}
      />

      {/* Welcome Screen */}
      <SidebarInset className="flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Welcome to Coding Tutor</h2>
          <p className="text-muted-foreground mb-6">
            Create a project or select an existing one to start learning.
          </p>
          <Button size="lg" onClick={() => handleCreateProject("My First Project")}>
            Create Your First Project
          </Button>
        </div>
      </SidebarInset>
    </>
  );
}
