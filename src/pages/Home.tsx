import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import CreateProjectModal from "@/components/Sidebar/CreateProjectModal";
import AuthSettingsModal from "@/components/Auth/AuthSettingsModal";
import MessageInput from "@/components/Chat/MessageInput";
import ProjectSelector from "@/components/Chat/ProjectSelector";
import { SidebarInset } from "@/components/ui/sidebar";
import { useLayoutContext } from "@/components/Layout";
import { useCredentialStatus } from "@/hooks/useCredentialStatus";
import { ShieldCheckIcon, WarningCircleIcon } from "@phosphor-icons/react";

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
    projectsLoading,
    createProject,
    createSession,
    activeProjectId,
    setActiveProjectId,
    newSessionToken,
  } = useLayoutContext();
  const {
    status: credStatus,
    loading: credLoading,
    tauriAvailable,
  } = useCredentialStatus();
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [testingMode, setTestingMode] = useState(false);
  const hasAutoOpenedAuth = useRef(false);
  const credConfigured = credStatus.active_kind !== null;

  // First-launch: auto-open auth modal once if no credentials.
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

  const handleCreateProject = useCallback(
    async (name: string) => {
      await createProject(name);
    },
    [createProject],
  );

  const handleSend = useCallback(
    async (message: string) => {
      if (!activeProjectId) return;
      const session = await createSession(activeProjectId);
      navigate(`/projects/${activeProjectId}/sessions/${session.id}`, {
        state: { pendingMessage: message, testingMode },
      });
    },
    [activeProjectId, createSession, navigate, testingMode],
  );

  const noProjects = projects.length === 0 && !projectsLoading;
  const noCreds = !credConfigured && tauriAvailable;
  const typingDisabled = noCreds;
  const sendDisabled = noProjects || noCreds || !activeProjectId;
  const placeholder = useMemo(() => {
    if (noProjects) return "Pick or create a project to send";
    if (noCreds) return "Set up Anthropic credentials to start";
    return "What would you like to learn?";
  }, [noProjects, noCreds]);

  return (
    <>
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
                focusSignal={newSessionToken}
                leadingActions={
                  <ProjectSelector
                    projects={projects}
                    selectedProjectId={activeProjectId}
                    onSelect={setActiveProjectId}
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
