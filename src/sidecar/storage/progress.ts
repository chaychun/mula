import type { Progress, ProgressUpdate, TopicSummary } from "../../lib/types";
import { getDb } from "../database";
import { generateId } from "./utils";

// Get progress for a topic
export async function getProgress(projectId: string, topic: string): Promise<Progress | null> {
  const db = getDb();

  const row = db
    .prepare("SELECT * FROM progress WHERE project_id = ? AND topic = ?")
    .get(projectId, topic) as ProgressRow | undefined;

  if (!row) return null;

  return rowToProgress(row);
}

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
    recentSessions: JSON.parse(row.recent_sessions || "[]"),
    masteredConcepts: JSON.parse(row.mastered_concepts || "[]"),
    needsReinforcement: JSON.parse(row.needs_reinforcement || "[]"),
  };
}

function generateProgressSummary(progress: Progress): string {
  const parts: string[] = [];

  if (progress.masteredConcepts.length > 0) {
    parts.push(
      `Mastered: ${progress.masteredConcepts.slice(0, 3).join(", ")}${progress.masteredConcepts.length > 3 ? "..." : ""}`
    );
  }

  if (progress.needsReinforcement.length > 0) {
    parts.push(`Needs practice: ${progress.needsReinforcement.join(", ")}`);
  }

  if (progress.recentSessions.length > 0) {
    const lastSession = progress.recentSessions[0];
    parts.push(`Last session: ${lastSession.performance}`);
  }

  return parts.join(". ") || "No progress recorded yet.";
}

// Update progress for a topic
export async function updateProgress(
  projectId: string,
  topic: string,
  updates: ProgressUpdate
): Promise<Progress> {
  const db = getDb();
  let progress = await getProgress(projectId, topic);

  if (!progress) {
    progress = {
      topic,
      lastUpdated: new Date().toISOString(),
      overallLevel: "beginner",
      summary: "",
      recentSessions: [],
      masteredConcepts: [],
      needsReinforcement: [],
    };
  }

  // Apply updates (same logic as JSON storage version)
  if (updates.overallLevel) {
    progress.overallLevel = updates.overallLevel;
  }

  if (updates.addToMastered && updates.addToMastered.length > 0) {
    progress.masteredConcepts = [
      ...new Set([...progress.masteredConcepts, ...updates.addToMastered]),
    ];
    progress.needsReinforcement = progress.needsReinforcement.filter(
      (c) => !updates.addToMastered!.includes(c)
    );
  }

  if (updates.addToReinforcement && updates.addToReinforcement.length > 0) {
    progress.needsReinforcement = [
      ...new Set([...progress.needsReinforcement, ...updates.addToReinforcement]),
    ];
  }

  if (updates.removeFromReinforcement && updates.removeFromReinforcement.length > 0) {
    progress.needsReinforcement = progress.needsReinforcement.filter(
      (c) => !updates.removeFromReinforcement!.includes(c)
    );
  }

  if (updates.sessionNote) {
    progress.recentSessions.unshift({
      date: new Date().toISOString().split("T")[0],
      covered: updates.sessionNote.covered,
      performance: updates.sessionNote.performance,
      notes: updates.sessionNote.notes || null,
    });

    if (progress.recentSessions.length > 5) {
      progress.recentSessions = progress.recentSessions.slice(0, 5);
    }
  }

  progress.summary = generateProgressSummary(progress);
  progress.lastUpdated = new Date().toISOString();

  // Upsert into database
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
    progress.overallLevel,
    progress.summary,
    JSON.stringify(progress.masteredConcepts),
    JSON.stringify(progress.needsReinforcement),
    JSON.stringify(progress.recentSessions),
    progress.lastUpdated
  );

  return progress;
}

// List all topics with progress for a project
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
