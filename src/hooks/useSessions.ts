"use client";

import { useState, useCallback } from "react";
import type { Session } from "@/lib/types";
import { sidecarFetch } from "@/lib/sidecar";

export function useSessions(_projectId: string | null) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorByProject, setErrorByProject] = useState<Record<string, string>>({});

  // Fetch sessions for a project (merges with existing sessions from other projects).
  // Failures are tracked per-project in `errorByProject`; the page-level `error`
  // is reserved for single-session fetch failures.
  const fetchSessions = useCallback(async (pid: string) => {
    try {
      setLoading(true);
      const response = await sidecarFetch(`/api/projects/${pid}/sessions`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: Session[] = await response.json();
      // Merge: keep sessions from other projects, replace sessions for this project
      setSessions((prev) => {
        const otherProjectSessions = prev.filter((s) => s.projectId !== pid);
        return [...otherProjectSessions, ...data];
      });
      setErrorByProject((prev) => {
        if (!prev[pid]) return prev;
        const next = { ...prev };
        delete next[pid];
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setErrorByProject((prev) => ({ ...prev, [pid]: message }));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch a specific session
  const fetchSession = useCallback(async (pid: string, sessionId: string) => {
    try {
      setLoading(true);
      const response = await sidecarFetch(`/api/projects/${pid}/sessions/${sessionId}`);
      if (!response.ok) throw new Error("Failed to fetch session");
      const data = await response.json();
      setCurrentSession(data);
      setError(null);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new session
  const createSession = useCallback(async (pid: string, title?: string) => {
    try {
      const response = await sidecarFetch(`/api/projects/${pid}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error("Failed to create session");
      const newSession = await response.json();
      return newSession;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    }
  }, []);

  // Update a session
  const updateSession = useCallback(
    async (pid: string, sessionId: string, updates: Partial<Session>) => {
      try {
        const response = await sidecarFetch(`/api/projects/${pid}/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!response.ok) throw new Error("Failed to update session");
        const updatedSession = await response.json();
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? updatedSession : s)));
        if (currentSession?.id === sessionId) {
          setCurrentSession(updatedSession);
        }
        return updatedSession;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        throw err;
      }
    },
    [currentSession?.id]
  );

  // Delete a session
  const deleteSession = useCallback(
    async (pid: string, sessionId: string) => {
      try {
        const response = await sidecarFetch(`/api/projects/${pid}/sessions/${sessionId}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to delete session");
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (currentSession?.id === sessionId) {
          setCurrentSession(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        throw err;
      }
    },
    [currentSession?.id]
  );

  // Update session title in local state only (used after async title generation)
  const updateSessionTitleLocal = useCallback(
    (sessionId: string, title: string) => {
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title } : s)));
      if (currentSession?.id === sessionId) {
        setCurrentSession((prev) => (prev ? { ...prev, title } : null));
      }
    },
    [currentSession?.id]
  );

  // Select a session
  const selectSession = useCallback(
    async (pid: string, sessionId: string) => {
      return fetchSession(pid, sessionId);
    },
    [fetchSession]
  );

  // Clear current session
  const clearSession = useCallback(() => {
    setCurrentSession(null);
  }, []);

  // Drop all sessions belonging to a project (e.g. after the project is deleted).
  const clearSessionsForProject = useCallback(
    (pid: string) => {
      setSessions((prev) => prev.filter((s) => s.projectId !== pid));
      setErrorByProject((prev) => {
        if (!prev[pid]) return prev;
        const next = { ...prev };
        delete next[pid];
        return next;
      });
      if (currentSession?.projectId === pid) {
        setCurrentSession(null);
      }
    },
    [currentSession?.projectId]
  );

  return {
    sessions,
    currentSession,
    loading,
    error,
    errorByProject,
    fetchSessions,
    fetchSession,
    createSession,
    updateSession,
    deleteSession,
    updateSessionTitleLocal,
    selectSession,
    clearSession,
    clearSessionsForProject,
  };
}
