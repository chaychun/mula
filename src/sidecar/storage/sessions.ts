import type { SQLQueryBindings } from "bun:sqlite";
import type { Session } from "../../lib/types";
import { getDb } from "../database";
import { generateId, nowIso, parseJsonArray } from "./utils";
import { listMessages, replaceMessages } from "./messages";
import { listExercises } from "./exercises";
import { listConceptQuestions } from "./conceptQuestions";
import { emitSessionChanged } from "./events";

interface SessionRow {
  id: string;
  project_id: string;
  agent_session_id: string | null;
  title: string;
  status: string;
  topics: string;
  active_exercise_id: string | null;
  wrap_up_summary: string | null;
  created_at: string;
  updated_at: string;
}

function rowToSession(
  row: SessionRow,
  messages: Session["messages"],
  exercises: Session["exercises"],
  conceptQuestions: Session["conceptQuestions"]
): Session {
  return {
    id: row.id,
    projectId: row.project_id,
    agentSessionId: row.agent_session_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    topics: parseJsonArray<string>(row.topics),
    title: row.title,
    messages,
    exercises,
    activeExerciseId: row.active_exercise_id,
    conceptQuestions,
    status: row.status as "active" | "completed",
    wrapUpSummary: row.wrap_up_summary ?? undefined,
  };
}

export async function createSession(projectId: string, title?: string): Promise<Session> {
  const db = getDb();
  const id = generateId();
  const now = nowIso();
  const sessionTitle = title || "Untitled Session";

  db.prepare(
    `INSERT INTO sessions (id, project_id, title, status, topics, active_exercise_id, created_at, updated_at)
     VALUES (?, ?, ?, 'active', '[]', NULL, ?, ?)`
  ).run(id, projectId, sessionTitle, now, now);

  return {
    id,
    projectId,
    createdAt: now,
    updatedAt: now,
    topics: [],
    title: sessionTitle,
    messages: [],
    exercises: {},
    activeExerciseId: null,
    conceptQuestions: {},
    status: "active",
  };
}

export async function getSession(projectId: string, sessionId: string): Promise<Session | null> {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM sessions WHERE id = ? AND project_id = ?")
    .get(sessionId, projectId) as SessionRow | undefined;
  if (!row) return null;

  return rowToSession(
    row,
    listMessages(sessionId),
    listExercises(sessionId),
    listConceptQuestions(sessionId)
  );
}

const SESSION_COLUMN_MAP: Record<string, { column: string; transform?: (v: unknown) => unknown }> =
  {
    title: { column: "title" },
    status: { column: "status" },
    activeExerciseId: { column: "active_exercise_id" },
    wrapUpSummary: { column: "wrap_up_summary" },
    agentSessionId: { column: "agent_session_id" },
    topics: { column: "topics", transform: (v) => JSON.stringify(v) },
  };

export async function updateSession(
  projectId: string,
  sessionId: string,
  updates: Partial<Omit<Session, "id" | "projectId" | "createdAt">>
): Promise<Session | null> {
  const db = getDb();
  const now = nowIso();

  const sets: string[] = ["updated_at = ?"];
  const values: SQLQueryBindings[] = [now];

  for (const [key, spec] of Object.entries(SESSION_COLUMN_MAP)) {
    const value = (updates as Record<string, unknown>)[key];
    if (value !== undefined) {
      sets.push(`${spec.column} = ?`);
      values.push((spec.transform ? spec.transform(value) : value) as SQLQueryBindings);
    }
  }

  values.push(sessionId, projectId);

  const result = db
    .prepare(`UPDATE sessions SET ${sets.join(", ")} WHERE id = ? AND project_id = ?`)
    .run(...values);

  if (result.changes === 0) return null;

  if (updates.messages !== undefined) {
    replaceMessages(sessionId, updates.messages);
  }

  emitSessionChanged(projectId, sessionId);
  return getSession(projectId, sessionId);
}

export async function wrapUpSession(
  projectId: string,
  sessionId: string,
  summary: string,
  topicsUpdated: string[]
): Promise<Session | null> {
  return updateSession(projectId, sessionId, {
    status: "completed",
    wrapUpSummary: summary,
    topics: topicsUpdated,
  });
}

export async function setAgentSessionId(
  projectId: string,
  sessionId: string,
  agentSessionId: string
): Promise<void> {
  await updateSession(projectId, sessionId, { agentSessionId });
}

export async function deleteSession(projectId: string, sessionId: string): Promise<boolean> {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM sessions WHERE id = ? AND project_id = ?")
    .run(sessionId, projectId);
  return result.changes > 0;
}

export async function listSessions(projectId: string): Promise<Session[]> {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM sessions WHERE project_id = ? ORDER BY updated_at DESC")
    .all(projectId) as SessionRow[];

  return rows.map((row) => rowToSession(row, [], {}, {}));
}
