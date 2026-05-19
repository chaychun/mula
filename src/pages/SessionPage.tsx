import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import AppSidebar from "@/components/Sidebar/AppSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import Chat from "@/components/Chat/Chat";
import { useProjects } from "@/hooks/useProjects";
import { useSessions } from "@/hooks/useSessions";
import { useChat } from "@/hooks/useChat";
import { Button } from "@/components/ui";
import { retrySidecarConnection } from "@/lib/sidecar";

export default function SessionPage() {
  const navigate = useNavigate();
  const { projectId, sessionId } = useParams<{ projectId: string; sessionId: string }>();

  if (!projectId || !sessionId) {
    throw new Error("Missing projectId or sessionId in URL params");
  }

  // Project and session state
  const { projects, createProject, updateProject, deleteProject } = useProjects();
  const [agentSessionId, setAgentSessionId] = useState<string | undefined>();
  const [testingMode, setTestingMode] = useState(false);

  const {
    sessions,
    currentSession,
    error: sessionError,
    errorByProject,
    fetchSessions,
    createSession,
    selectSession,
    updateSession,
    deleteSession,
    updateSessionTitleLocal,
  } = useSessions(projectId);

  // Chat hook with exercise state
  const {
    messages,
    isStreaming,
    streamingContent,
    streamingToolCalls,
    streamingContentBlocks,
    sendMessage,
    loadMessages,
    activeExercise,
    setActiveExercise,
    exercises,
    setExercises,
    submitExercise,
    skipExercise,
    retryExercise,
    conceptQuestions,
    setConceptQuestions,
    answerConceptQuestion,
    failedMessageIds,
  } = useChat({
    projectId,
    sessionId,
    agentSessionId,
    testingMode,
    onSessionId: setAgentSessionId,
    onTitleGenerated: (title) => {
      updateSessionTitleLocal(sessionId, title);
    },
  });

  // Fetch sessions for every project so sidebar counts are accurate up front
  useEffect(() => {
    projects.forEach((p) => fetchSessions(p.id));
  }, [projects, fetchSessions]);

  // Load session data when sessionId changes
  useEffect(() => {
    const loadSessionData = async () => {
      const session = await selectSession(projectId, sessionId);
      if (session) {
        loadMessages(session.messages);
        if (session.exercises) {
          setExercises(session.exercises);
        }
        if (session.conceptQuestions) {
          setConceptQuestions(session.conceptQuestions);
        }
        if (session.agentSessionId) {
          setAgentSessionId(session.agentSessionId);
        }
      }
    };
    loadSessionData();
  }, [
    projectId,
    sessionId,
    selectSession,
    loadMessages,
    setExercises,
    setConceptQuestions,
    setAgentSessionId,
  ]);

  // Restore active exercise when session loads
  useEffect(() => {
    if (currentSession?.activeExerciseId && currentSession.exercises) {
      const exercise = currentSession.exercises[currentSession.activeExerciseId];
      if (
        exercise &&
        (exercise.status === "active" ||
          exercise.status === "pending_review" ||
          exercise.status === "needs_retry")
      ) {
        setActiveExercise(exercise);
      }
    }
  }, [currentSession?.activeExerciseId, currentSession?.exercises, setActiveExercise]);

  // Navigation handlers
  const tryRestartSidecar = useCallback(async () => {
    try {
      await retrySidecarConnection();
    } catch (err) {
      console.error("Sidecar restart failed:", err);
    }
  }, []);

  const handleSelectProject = useCallback(
    async (newProjectId: string) => {
      // If this project's last fetch failed, attempt to restore the sidecar
      // before refetching — otherwise the click is a no-op when the backend
      // is dead.
      if (errorByProject[newProjectId]) {
        await tryRestartSidecar();
      }
      fetchSessions(newProjectId);
    },
    [errorByProject, fetchSessions, tryRestartSidecar]
  );

  const handleRetrySession = useCallback(async () => {
    await tryRestartSidecar();
    selectSession(projectId, sessionId);
  }, [projectId, sessionId, selectSession, tryRestartSidecar]);

  const handleSelectSession = useCallback(
    (newProjectId: string, newSessionId: string) => {
      navigate(`/projects/${newProjectId}/sessions/${newSessionId}`);
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
    async (targetProjectId: string) => {
      const session = await createSession(targetProjectId);
      navigate(`/projects/${targetProjectId}/sessions/${session.id}`);
    },
    [createSession, navigate]
  );

  const handleSendMessage = useCallback(
    (message: string) => {
      sendMessage(message, "message", undefined, undefined, testingMode);
    },
    [sendMessage, testingMode]
  );

  const handleRenameProject = useCallback(
    async (targetProjectId: string, newName: string) => {
      await updateProject(targetProjectId, { name: newName });
    },
    [updateProject]
  );

  const handleRenameSession = useCallback(
    async (targetProjectId: string, targetSessionId: string, newTitle: string) => {
      await updateSession(targetProjectId, targetSessionId, { title: newTitle });
    },
    [updateSession]
  );

  const handleDeleteProject = useCallback(
    async (targetProjectId: string) => {
      await deleteProject(targetProjectId);
      if (targetProjectId === projectId) {
        navigate("/", { replace: true });
      }
    },
    [deleteProject, navigate, projectId]
  );

  const handleDeleteSession = useCallback(
    async (targetProjectId: string, targetSessionId: string) => {
      await deleteSession(targetProjectId, targetSessionId);
      if (targetSessionId === sessionId) {
        navigate("/", { replace: true });
      }
    },
    [deleteSession, navigate, sessionId]
  );

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar
        projects={projects}
        sessions={sessions}
        sessionErrorByProject={errorByProject}
        currentProjectId={projectId}
        currentSessionId={sessionId}
        onSelectProject={handleSelectProject}
        onSelectSession={handleSelectSession}
        onCreateProject={handleCreateProject}
        onCreateSession={handleCreateSession}
        onRenameProject={handleRenameProject}
        onRenameSession={handleRenameSession}
        onDeleteProject={handleDeleteProject}
        onDeleteSession={handleDeleteSession}
      />
      <SidebarInset className="flex flex-col overflow-hidden">
        {sessionError ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-destructive mb-4">Error: {sessionError}</p>
              <Button onClick={handleRetrySession}>Retry</Button>
            </div>
          </div>
        ) : (
          <Chat
            messages={messages}
            exercises={exercises}
            conceptQuestions={conceptQuestions}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            streamingToolCalls={streamingToolCalls}
            streamingContentBlocks={streamingContentBlocks}
            failedMessageIds={failedMessageIds}
            onSendMessage={handleSendMessage}
            activeExercise={activeExercise}
            onExerciseSubmit={submitExercise}
            onExerciseSkip={skipExercise}
            onExerciseReset={() => {}}
            onExerciseRetry={retryExercise}
            onConceptAnswer={answerConceptQuestion}
            testingMode={testingMode}
            onTestingModeChange={setTestingMode}
          />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
