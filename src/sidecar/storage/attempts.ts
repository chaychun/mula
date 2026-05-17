import type { ExerciseAttempt } from "../../lib/types";
import { getDb } from "../database";
import { nowIso, parseJsonObject } from "./utils";

export interface AttemptRow {
  id: string;
  exercise_id: string;
  code: string;
  blank_values: string | null;
  status: string;
  feedback: string | null;
  submitted_at: string;
}

export function rowToAttempt(row: AttemptRow): ExerciseAttempt {
  const attempt: ExerciseAttempt = {
    id: row.id,
    code: row.code,
    submittedAt: row.submitted_at,
    status: row.status as ExerciseAttempt["status"],
  };
  if (row.feedback) attempt.feedback = row.feedback;
  const blanks = parseJsonObject<Record<string, string>>(row.blank_values);
  if (blanks) attempt.blankValues = blanks;
  return attempt;
}

export function listAttemptsForExercise(exerciseId: string): ExerciseAttempt[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM exercise_attempts WHERE exercise_id = ? ORDER BY submitted_at ASC")
    .all(exerciseId) as AttemptRow[];
  return rows.map(rowToAttempt);
}

export async function submitAttempt(
  _projectId: string,
  sessionId: string,
  exerciseId: string,
  attemptId: string,
  code: string,
  blankValues?: Record<string, string>
): Promise<ExerciseAttempt | null> {
  const db = getDb();
  const now = nowIso();

  const exercise = db
    .prepare("SELECT id FROM exercises WHERE id = ? AND session_id = ?")
    .get(exerciseId, sessionId) as { id: string } | undefined;
  if (!exercise) return null;

  const insert = db.transaction(() => {
    db.prepare(
      `INSERT INTO exercise_attempts (id, exercise_id, code, blank_values, status, submitted_at)
       VALUES (?, ?, ?, ?, 'pending_review', ?)`
    ).run(attemptId, exerciseId, code, blankValues ? JSON.stringify(blankValues) : null, now);

    db.prepare("UPDATE exercises SET status = 'pending_review', updated_at = ? WHERE id = ?").run(
      now,
      exerciseId
    );

    db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(now, sessionId);
  });
  insert();

  return {
    id: attemptId,
    code,
    blankValues,
    submittedAt: now,
    status: "pending_review",
  };
}

export function updateLatestAttemptStatus(exerciseId: string, status: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE exercise_attempts SET status = ?
     WHERE exercise_id = ? AND submitted_at = (
       SELECT MAX(submitted_at) FROM exercise_attempts WHERE exercise_id = ?
     )`
  ).run(status, exerciseId, exerciseId);
}
