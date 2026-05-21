import { useState, useLayoutEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { SidebarInset } from "@/components/ui/sidebar";
import Chat from "@/components/Chat/Chat";
import { useLayoutContext } from "@/components/Layout";
import { useChat } from "@/hooks/useChat";
import { Button } from "@/components/ui";
import { retrySidecarConnection } from "@/lib/sidecar";

import type { Session } from "@/lib/types";

type SessionNavState = { pendingMessage?: string; testingMode?: boolean } | null;

function SessionTitleHeader({
  sessions,
  sessionId,
}: {
  sessions: Session[];
  sessionId: string;
}) {
  const title = sessions.find((s) => s.id === sessionId)?.title;
  if (!title) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex h-10 items-center justify-center px-4">
      <div className="max-w-[60%] truncate text-xs text-muted-foreground">
        {title}
      </div>
    </div>
  );
}

export default function SessionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId, sessionId } = useParams<{ projectId: string; sessionId: string }>();

  if (!projectId || !sessionId) {
    throw new Error("Missing projectId or sessionId in URL params");
  }

  const { sessions, sessionError, fetchSessions } = useLayoutContext();
  const [testingMode, setTestingMode] = useState(false);

  const {
    messages,
    isStreaming,
    sendMessage,
    activeExercise,
    exercises,
    submitExercise,
    skipExercise,
    retryExercise,
    conceptQuestions,
    answerConceptQuestion,
  } = useChat({
    projectId,
    sessionId,
    testingMode,
  });

  const tryRestartSidecar = useCallback(async () => {
    try {
      await retrySidecarConnection();
    } catch (err) {
      console.error("Sidecar restart failed:", err);
    }
  }, []);

  const handleRetrySession = useCallback(async () => {
    await tryRestartSidecar();
    fetchSessions(projectId);
  }, [projectId, fetchSessions, tryRestartSidecar]);

  const handleSendMessage = useCallback(
    (message: string) => {
      sendMessage(message, "message", undefined, undefined, testingMode);
    },
    [sendMessage, testingMode]
  );

  // Pending message from home composer — fire once. Ref guards StrictMode double-mount.
  const navState = location.state as SessionNavState;
  const pendingMessage = navState?.pendingMessage;
  const pendingTestingMode = navState?.testingMode;
  const pendingFiredRef = useRef(false);
  useLayoutEffect(() => {
    if (!pendingMessage || pendingFiredRef.current) return;
    pendingFiredRef.current = true;
    const mode = pendingTestingMode ?? testingMode;
    if (pendingTestingMode !== undefined) setTestingMode(pendingTestingMode);
    sendMessage(pendingMessage, "message", undefined, undefined, mode);
    navigate(location.pathname, { replace: true, state: null });
  }, [
    pendingMessage,
    pendingTestingMode,
    sendMessage,
    testingMode,
    navigate,
    location.pathname,
  ]);

  return (
    <SidebarInset className="flex flex-col overflow-hidden">
      {sessionError ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-destructive mb-4">Error: {sessionError}</p>
            <Button onClick={handleRetrySession}>Retry</Button>
          </div>
        </div>
      ) : (
        <>
          <SessionTitleHeader sessions={sessions} sessionId={sessionId} />
          <Chat
            messages={messages}
            exercises={exercises}
            conceptQuestions={conceptQuestions}
            isStreaming={isStreaming}
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
        </>
      )}
    </SidebarInset>
  );
}
