import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useNavigate, useOutletContext, useParams } from "react-router";
import AppSidebar from "@/components/Sidebar/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useProjects } from "@/hooks/useProjects";
import { useSessions } from "@/hooks/useSessions";
import type { Project, Session } from "@/lib/types";

const ACTIVE_PROJECT_KEY = "mula.activeProjectId";

export interface LayoutContext {
  projects: Project[];
  projectsLoading: boolean;
  createProject: (name: string, description?: string) => Promise<Project>;
  sessions: Session[];
  sessionError: string | null;
  sessionErrorByProject: Record<string, string>;
  fetchSessions: (projectId: string) => Promise<void>;
  createSession: (projectId: string, title?: string) => Promise<Session>;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  currentProjectId: string | null;
  currentSessionId: string | null;
  newSessionToken: number;
}

export function useLayoutContext() {
  return useOutletContext<LayoutContext>();
}

export default function Layout() {
  const navigate = useNavigate();
  const { projectId: urlProjectId, sessionId: urlSessionId } = useParams<{
    projectId?: string;
    sessionId?: string;
  }>();

  const {
    projects,
    loading: projectsLoading,
    createProject,
    updateProject,
    deleteProject,
  } = useProjects();

  const {
    sessions,
    error: sessionError,
    errorByProject: sessionErrorByProject,
    fetchSessions,
    createSession,
    updateSession,
    deleteSession,
    clearSessionsForProject,
  } = useSessions(null);

  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_PROJECT_KEY),
  );
  const [newSessionToken, setNewSessionToken] = useState(0);

  const setActiveProjectId = useCallback((id: string | null) => {
    setActiveProjectIdState(id);
    if (id) localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    else localStorage.removeItem(ACTIVE_PROJECT_KEY);
  }, []);

  // Eagerly fetch sessions for every project so sidebar counts populate.
  useEffect(() => {
    projects.forEach((p) => fetchSessions(p.id));
  }, [projects, fetchSessions]);

  // Sync chip with URL when navigating to a session in a new project.
  const lastUrlProjectId = useRef<string | null>(null);
  useEffect(() => {
    if (urlProjectId && urlProjectId !== lastUrlProjectId.current) {
      lastUrlProjectId.current = urlProjectId;
      setActiveProjectId(urlProjectId);
    } else if (!urlProjectId) {
      lastUrlProjectId.current = null;
    }
  }, [urlProjectId, setActiveProjectId]);

  // If active project disappears, pick the first available or null.
  useEffect(() => {
    if (!activeProjectId) return;
    if (!projects.some((p) => p.id === activeProjectId)) {
      setActiveProjectId(projects[0]?.id ?? null);
    }
  }, [projects, activeProjectId, setActiveProjectId]);

  // Initial pick if nothing stored.
  useEffect(() => {
    if (activeProjectId || projectsLoading || projects.length === 0) return;
    setActiveProjectId(projects[0].id);
  }, [projectsLoading, projects, activeProjectId, setActiveProjectId]);

  const handleSelectProject = useCallback(
    (projectId: string | null) => {
      setActiveProjectId(projectId);
      if (projectId) fetchSessions(projectId);
    },
    [setActiveProjectId, fetchSessions],
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
      setActiveProjectId(project.id);
    },
    [createProject, setActiveProjectId],
  );

  const handleNewSession = useCallback(() => {
    setNewSessionToken((t) => t + 1);
    navigate("/");
  }, [navigate]);

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

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      await deleteProject(projectId);
      clearSessionsForProject(projectId);
      if (urlProjectId === projectId) navigate("/", { replace: true });
      if (activeProjectId === projectId) setActiveProjectId(null);
    },
    [
      deleteProject,
      clearSessionsForProject,
      urlProjectId,
      navigate,
      activeProjectId,
      setActiveProjectId,
    ],
  );

  const handleDeleteSession = useCallback(
    async (projectId: string, sessionId: string) => {
      await deleteSession(projectId, sessionId);
      if (urlSessionId === sessionId) navigate("/", { replace: true });
    },
    [deleteSession, urlSessionId, navigate],
  );

  const ctx: LayoutContext = {
    projects,
    projectsLoading,
    createProject,
    sessions,
    sessionError,
    sessionErrorByProject,
    fetchSessions,
    createSession,
    activeProjectId,
    setActiveProjectId,
    currentProjectId: urlProjectId ?? null,
    currentSessionId: urlSessionId ?? null,
    newSessionToken,
  };

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar
        projects={projects}
        sessions={sessions}
        sessionErrorByProject={sessionErrorByProject}
        activeProjectId={activeProjectId}
        currentSessionId={urlSessionId ?? null}
        loading={projectsLoading}
        onSelectProject={handleSelectProject}
        onSelectSession={handleSelectSession}
        onCreateProject={handleCreateProject}
        onNewSession={handleNewSession}
        onRenameProject={handleRenameProject}
        onRenameSession={handleRenameSession}
        onDeleteProject={handleDeleteProject}
        onDeleteSession={handleDeleteSession}
      />
      <Outlet context={ctx} />
    </SidebarProvider>
  );
}
