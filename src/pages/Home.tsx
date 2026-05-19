import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import AppSidebar from "@/components/Sidebar/AppSidebar";
import CreateProjectModal from "@/components/Sidebar/CreateProjectModal";
import AuthSettingsModal from "@/components/Auth/AuthSettingsModal";
import { SidebarInset } from "@/components/ui/sidebar";
import { useProjects } from "@/hooks/useProjects";
import { useSessions } from "@/hooks/useSessions";
import { useCredentialStatus } from "@/hooks/useCredentialStatus";
import { Button } from "@/components/ui/button";
import { GraduationCap, Plus, ShieldCheck, WarningCircle } from "@phosphor-icons/react";

export default function Home() {
  const navigate = useNavigate();
  const {
    projects,
    loading: projectsLoading,
    createProject,
    updateProject,
    deleteProject,
  } = useProjects();
  const { sessions, createSession, fetchSessions, updateSession, deleteSession } =
    useSessions(null);
  const { status: credStatus, loading: credLoading, tauriAvailable } = useCredentialStatus();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const hasAutoOpenedAuth = useRef(false);
  const credConfigured = credStatus.active_kind !== null;

  // First-launch: auto-open auth modal once if no credentials. Never re-fires
  // after the user dismisses it.
  useEffect(() => {
    if (!credLoading && tauriAvailable && !credConfigured && !hasAutoOpenedAuth.current) {
      hasAutoOpenedAuth.current = true;
      setIsAuthOpen(true);
    }
  }, [credLoading, tauriAvailable, credConfigured]);

  const handleSelectProject = useCallback(
    (projectId: string) => {
      fetchSessions(projectId);
    },
    [fetchSessions]
  );

  const handleSelectSession = useCallback(
    (projectId: string, sessionId: string) => {
      navigate(`/projects/${projectId}/sessions/${sessionId}`);
    },
    [navigate]
  );

  const handleCreateProject = useCallback(
    async (name: string) => {
      const project = await createProject(name);
      const session = await createSession(project.id);
      navigate(`/projects/${project.id}/sessions/${session.id}`);
    },
    [createProject, createSession, navigate]
  );

  const handleCreateSession = useCallback(
    async (projectId: string) => {
      const session = await createSession(projectId);
      navigate(`/projects/${projectId}/sessions/${session.id}`);
    },
    [createSession, navigate]
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

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      await deleteProject(projectId);
    },
    [deleteProject]
  );

  const handleDeleteSession = useCallback(
    async (projectId: string, sessionId: string) => {
      await deleteSession(projectId, sessionId);
    },
    [deleteSession]
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
        onDeleteProject={handleDeleteProject}
        onDeleteSession={handleDeleteSession}
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
            <Button
              size="lg"
              onClick={() => setIsModalOpen(true)}
              disabled={!credConfigured && tauriAvailable}
            >
              <Plus size={18} weight="bold" />
              Start a project
            </Button>
            <p className="text-xs text-muted-foreground">
              or use the sidebar to pick an existing one
            </p>
          </div>

          {!credLoading && (
            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              className={`flex items-center gap-2 border px-3 py-2 text-xs transition-colors ${
                credConfigured
                  ? "border-border text-muted-foreground hover:bg-muted/50"
                  : "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
              }`}
            >
              {credConfigured ? (
                <>
                  <ShieldCheck size={14} weight="duotone" />
                  Connected via{" "}
                  {credStatus.active_kind === "local_cli"
                    ? "local Claude Code"
                    : "Anthropic API key"}
                </>
              ) : (
                <>
                  <WarningCircle size={14} weight="fill" />
                  No Anthropic credentials — click to sign in
                </>
              )}
            </button>
          )}
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

      <AuthSettingsModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}
