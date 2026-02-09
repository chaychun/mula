import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import AppSidebar from "@/components/Sidebar/AppSidebar";
import CreateProjectModal from "@/components/Sidebar/CreateProjectModal";
import { SidebarInset } from "@/components/ui/sidebar";
import { useProjects } from "@/hooks/useProjects";
import { useSessions } from "@/hooks/useSessions";
import { Button } from "@/components/ui/button";
import { GraduationCap, Plus } from "@phosphor-icons/react";

export default function Home() {
  const navigate = useNavigate();
  const { projects, loading: projectsLoading, createProject, updateProject } = useProjects();
  const { sessions, createSession, fetchSessions, updateSession } = useSessions(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSelectProject = useCallback(
    (projectId: string) => {
      fetchSessions(projectId);
    },
    [fetchSessions],
  );

  const handleSelectSession = useCallback(
    (projectId: string, sessionId: string) => {
      navigate(`/projects/${projectId}/sessions/${sessionId}`);
    },
    [navigate],
  );

  const handleCreateProject = useCallback(
    async (name: string) => {
      const project = await createProject(name);
      const session = await createSession(project.id);
      navigate(`/projects/${project.id}/sessions/${session.id}`);
    },
    [createProject, createSession, navigate],
  );

  const handleCreateSession = useCallback(
    async (projectId: string) => {
      const session = await createSession(projectId);
      navigate(`/projects/${projectId}/sessions/${session.id}`);
    },
    [createSession, navigate],
  );

  const handleRenameProject = useCallback(
    async (projectId: string, newName: string) => {
      await updateProject(projectId, { name: newName });
    },
    [updateProject],
  );

  const handleRenameSession = useCallback(
    async (projectId: string, sessionId: string, newTitle: string) => {
      await updateSession(projectId, sessionId, { title: newTitle });
    },
    [updateSession],
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
        <div className="flex flex-col items-center text-center max-w-md gap-8">
          <div className="p-4 bg-primary/10 text-primary">
            <GraduationCap size={48} weight="duotone" />
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-bold tracking-tight">
              Learn to code, one concept at a time
            </h2>
            <p className="text-muted-foreground">
              Your AI tutor explains concepts, writes exercises, and reviews your code — at your
              pace.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <Button size="lg" onClick={() => setIsModalOpen(true)}>
              <Plus size={18} weight="bold" />
              Start a project
            </Button>
            <p className="text-xs text-muted-foreground">
              or use the sidebar to pick an existing one
            </p>
          </div>
        </div>
      </SidebarInset>

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={(name) => {
          handleCreateProject(name);
          setIsModalOpen(false);
        }}
      />
    </>
  );
}
