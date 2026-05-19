import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import AppSidebar from "@/components/Sidebar/AppSidebar";
import CreateProjectModal from "@/components/Sidebar/CreateProjectModal";
import AuthSettingsModal from "@/components/Auth/AuthSettingsModal";
import MessageInput from "@/components/Chat/MessageInput";
import ProjectSelector from "@/components/Chat/ProjectSelector";
import { SidebarInset } from "@/components/ui/sidebar";
import { useProjects } from "@/hooks/useProjects";
import { useSessions } from "@/hooks/useSessions";
import { useCredentialStatus } from "@/hooks/useCredentialStatus";
import { ShieldCheckIcon, WarningCircleIcon } from "@phosphor-icons/react";

const LAST_PROJECT_KEY = "mula.lastProjectId";

const SUGGESTIONS = [
  "Explain how async/await works in JavaScript",
  "Teach me Python list comprehensions",
  "Walk me through React hooks",
  "Quiz me on Big-O complexity",
];

export default function Home() {
  const navigate = useNavigate();
  const {
    projects,
    loading: projectsLoading,
    createProject,
    updateProject,
    deleteProject,
  } = useProjects();
  const {
    sessions,
    createSession,
    fetchSessions,
    errorByProject,
    updateSession,
    deleteSession,
    clearSessionsForProject,
  } = useSessions(null);
  const {
    status: credStatus,
    loading: credLoading,
    tauriAvailable,
  } = useCredentialStatus();
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [draft, setDraft] = useState("");
  const [testingMode, setTestingMode] = useState(false);
  const hasAutoOpenedAuth = useRef(false);
  const credConfigured = credStatus.active_kind !== null;

  // First-launch: auto-open auth modal once if no credentials. Never re-fires
  // after the user dismisses it.
  useEffect(() => {
    if (
      !credLoading &&
      tauriAvailable &&
      !credConfigured &&
      !hasAutoOpenedAuth.current
    ) {
      hasAutoOpenedAuth.current = true;
      setIsAuthOpen(true);
    }
  }, [credLoading, tauriAvailable, credConfigured]);

  // Eagerly fetch sessions for every project so sidebar counts populate.
  useEffect(() => {
    projects.forEach((p) => fetchSessions(p.id));
  }, [projects, fetchSessions]);

  const persistSelectedProject = useCallback((projectId: string | null) => {
    setSelectedProjectId(projectId);
    if (projectId) localStorage.setItem(LAST_PROJECT_KEY, projectId);
    else localStorage.removeItem(LAST_PROJECT_KEY);
  }, []);

  // Initialize selectedProjectId from localStorage or first project.
  useEffect(() => {
    if (selectedProjectId && projects.some((p) => p.id === selectedProjectId))
      return;
    const stored = localStorage.getItem(LAST_PROJECT_KEY);
    if (stored && projects.some((p) => p.id === stored)) {
      setSelectedProjectId(stored);
      return;
    }
    setSelectedProjectId(projects[0]?.id ?? null);
  }, [projects, selectedProjectId]);

  const handleSelectProject = useCallback(
    (projectId: string) => {
      persistSelectedProject(projectId);
      fetchSessions(projectId);
    },
    [fetchSessions, persistSelectedProject],
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
      persistSelectedProject(project.id);
    },
    [createProject, persistSelectedProject],
  );

  const handleNewSession = useCallback(() => {
    // Already on home composer; nothing to do.
  }, []);

  const handleSend = useCallback(
    async (message: string) => {
      if (!selectedProjectId) return;
      const session = await createSession(selectedProjectId);
      navigate(`/projects/${selectedProjectId}/sessions/${session.id}`, {
        state: { pendingMessage: message, testingMode },
      });
    },
    [selectedProjectId, createSession, navigate, testingMode],
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

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      await deleteProject(projectId);
      clearSessionsForProject(projectId);
      if (selectedProjectId === projectId) persistSelectedProject(null);
    },
    [
      deleteProject,
      clearSessionsForProject,
      selectedProjectId,
      persistSelectedProject,
    ],
  );

  const handleDeleteSession = useCallback(
    async (projectId: string, sessionId: string) => {
      await deleteSession(projectId, sessionId);
    },
    [deleteSession],
  );

  const noProjects = projects.length === 0 && !projectsLoading;
  const noCreds = !credConfigured && tauriAvailable;
  const typingDisabled = noCreds;
  const sendDisabled = noProjects || noCreds;
  const placeholder = useMemo(() => {
    if (noProjects) return "Pick or create a project to send";
    if (noCreds) return "Set up Anthropic credentials to start";
    return "What would you like to learn?";
  }, [noProjects, noCreds]);

  return (
    <>
      <AppSidebar
        projects={projects}
        sessions={sessions}
        sessionErrorByProject={errorByProject}
        currentProjectId={null}
        currentSessionId={null}
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

      <SidebarInset className="flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center w-full max-w-2xl px-6 gap-8">
            <div className="flex flex-col items-center gap-2 text-center">
              <h2 className="text-3xl font-bold tracking-tight">
                What would you like to learn?
              </h2>
              <p className="text-sm text-muted-foreground">
                Pick a topic or describe one. Your tutor will explain it, give
                you exercises, and review your code.
              </p>
            </div>

            <div className="w-full">
              <MessageInput
                onSend={handleSend}
                disabled={typingDisabled}
                submitDisabled={sendDisabled}
                placeholder={placeholder}
                value={draft}
                onValueChange={setDraft}
                testingMode={testingMode}
                onTestingModeChange={setTestingMode}
                leadingActions={
                  <ProjectSelector
                    projects={projects}
                    selectedProjectId={selectedProjectId}
                    onSelect={persistSelectedProject}
                    onCreateProject={() => setIsCreateProjectOpen(true)}
                    disabled={projectsLoading}
                  />
                }
              />
            </div>

            <div className="w-full flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setDraft(s)}
                  disabled={typingDisabled}
                  className="px-3 py-1.5 text-[12px] border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!credLoading && (
          <div className="flex justify-center pb-4">
            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                credConfigured
                  ? "text-muted-foreground hover:text-foreground"
                  : "text-destructive hover:opacity-80"
              }`}
            >
              {credConfigured ? (
                <>
                  <ShieldCheckIcon size={14} weight="duotone" />
                  Connected via{" "}
                  {credStatus.active_kind === "local_cli"
                    ? "local Claude Code"
                    : "Anthropic API key"}
                </>
              ) : (
                <>
                  <WarningCircleIcon size={14} weight="fill" />
                  No Anthropic credentials — click to sign in
                </>
              )}
            </button>
          </div>
        )}
      </SidebarInset>

      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        onCreate={(name) => {
          handleCreateProject(name);
          setIsCreateProjectOpen(false);
        }}
      />

      <AuthSettingsModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
    </>
  );
}
