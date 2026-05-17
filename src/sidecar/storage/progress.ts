import type { Progress, ProgressUpdate, SessionNote, TopicSummary } from "../../lib/types";
import { getDb } from "../database";
import { generateId, nowIso, parseJsonArray } from "./utils";

interface ProgressRow {
  id: string;
  project_id: string;
  topic: string;
  overall_level: string;
  summary: string | null;
  mastered_concepts: string;
  needs_reinforcement: string;
  recent_sessions: string;
  last_updated: string;
}

function rowToProgress(row: ProgressRow): Progress {
  return {
    topic: row.topic,
    lastUpdated: row.last_updated,
    overallLevel: row.overall_level as Progress["overallLevel"],
    summary: row.summary || "",
    recentSessions: parseJsonArray<SessionNote>(row.recent_sessions),
    masteredConcepts: parseJsonArray<string>(row.mastered_concepts),
    needsReinforcement: parseJsonArray<string>(row.needs_reinforcement),
  };
}

function emptyProgress(topic: string): Progress {
  return {
    topic,
    lastUpdated: nowIso(),
    overallLevel: "beginner",
    summary: "",
    recentSessions: [],
    masteredConcepts: [],
    needsReinforcement: [],
  };
}

function buildSummary(progress: Progress): string {
  const parts: string[] = [];

  if (progress.masteredConcepts.length > 0) {
    const shown = progress.masteredConcepts.slice(0, 3).join(", ");
    const ellipsis = progress.masteredConcepts.length > 3 ? "..." : "";
    parts.push(`Mastered: ${shown}${ellipsis}`);
  }
  if (progress.needsReinforcement.length > 0) {
    parts.push(`Needs practice: ${progress.needsReinforcement.join(", ")}`);
  }
  if (progress.recentSessions.length > 0) {
    parts.push(`Last session: ${progress.recentSessions[0].performance}`);
  }

  return parts.join(". ") || "No progress recorded yet.";
}

function applyUpdates(progress: Progress, updates: ProgressUpdate): Progress {
  const next: Progress = { ...progress };

  if (updates.overallLevel) {
    next.overallLevel = updates.overallLevel;
  }

  if (updates.addToMastered?.length) {
    next.masteredConcepts = [...new Set([...next.masteredConcepts, ...updates.addToMastered])];
    next.needsReinforcement = next.needsReinforcement.filter(
      (c) => !updates.addToMastered!.includes(c)
    );
  }

  if (updates.addToReinforcement?.length) {
    next.needsReinforcement = [
      ...new Set([...next.needsReinforcement, ...updates.addToReinforcement]),
    ];
  }

  if (updates.removeFromReinforcement?.length) {
    next.needsReinforcement = next.needsReinforcement.filter(
      (c) => !updates.removeFromReinforcement!.includes(c)
    );
  }

  if (updates.sessionNote) {
    next.recentSessions = [
      {
        date: nowIso().split("T")[0],
        covered: updates.sessionNote.covered,
        performance: updates.sessionNote.performance,
        notes: updates.sessionNote.notes || null,
      },
      ...next.recentSessions,
    ].slice(0, 5);
  }

  next.summary = buildSummary(next);
  next.lastUpdated = nowIso();
  return next;
}

export async function getProgress(projectId: string, topic: string): Promise<Progress | null> {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM progress WHERE project_id = ? AND topic = ?")
    .get(projectId, topic) as ProgressRow | undefined;
  if (!row) return null;
  return rowToProgress(row);
}

export async function updateProgress(
  projectId: string,
  topic: string,
  updates: ProgressUpdate
): Promise<Progress> {
  const db = getDb();
  const current = (await getProgress(projectId, topic)) ?? emptyProgress(topic);
  const next = applyUpdates(current, updates);

  db.prepare(
    `INSERT INTO progress (id, project_id, topic, overall_level, summary, mastered_concepts, needs_reinforcement, recent_sessions, last_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, topic) DO UPDATE SET
       overall_level = excluded.overall_level,
       summary = excluded.summary,
       mastered_concepts = excluded.mastered_concepts,
       needs_reinforcement = excluded.needs_reinforcement,
       recent_sessions = excluded.recent_sessions,
       last_updated = excluded.last_updated`
  ).run(
    generateId(),
    projectId,
    topic,
    next.overallLevel,
    next.summary,
    JSON.stringify(next.masteredConcepts),
    JSON.stringify(next.needsReinforcement),
    JSON.stringify(next.recentSessions),
    next.lastUpdated
  );

  return next;
}

export async function listTopicsWithProgress(projectId: string): Promise<TopicSummary[]> {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT topic, overall_level, last_updated FROM progress WHERE project_id = ? ORDER BY last_updated DESC"
    )
    .all(projectId) as Array<{ topic: string; overall_level: string; last_updated: string }>;

  return rows.map((row) => ({
    topic: row.topic,
    level: row.overall_level as TopicSummary["level"],
    lastUpdated: row.last_updated,
  }));
}
