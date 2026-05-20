import type { SQLQueryBindings } from "bun:sqlite";
import type { Exercise, ExerciseAttempt } from "../../lib/types";
import { getDb } from "../database";
import { nowIso, parseJsonArray } from "./utils";
import { listAttemptsForExercise, rowToAttempt, type AttemptRow } from "./attempts";
import { emitSessionChanged } from "./events";

export interface ExerciseRow {
  id: string;
  session_id: string;
  type: string;
  title: string;
  language: string;
  instructions: string;
  starter_code: string;
  expected_behavior: string;
  status: string;
  hints: string;
  created_at: string;
  updated_at: string;
}

export function rowToExercise(row: ExerciseRow, attempts: ExerciseAttempt[]): Exercise {
  return {
    id: row.id,
    type: row.type as Exercise["type"],
    title: row.title,
    language: row.language,
    instructions: row.instructions,
    starterCode: row.starter_code,
    expectedBehavior: row.expected_behavior,
    status: row.status as Exercise["status"],
    attempts,
    hints: parseJsonArray<string>(row.hints),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listExercises(sessionId: string): Record<string, Exercise> {
  const db = getDb();
  const exerciseRows = db
    .prepare("SELECT * FROM exercises WHERE session_id = ?")
    .all(sessionId) as ExerciseRow[];

  const ids = exerciseRows.map((r) => r.id);
  if (ids.length === 0) return {};

  // Single query for all attempts
  const placeholders = ids.map(() => "?").join(",");
  const attemptRows = db
    .prepare(
      `SELECT * FROM exercise_attempts WHERE exercise_id IN (${placeholders}) ORDER BY submitted_at ASC`
    )
    .all(...ids) as AttemptRow[];

  const attemptsByExercise = new Map<string, ExerciseAttempt[]>();
  for (const row of attemptRows) {
    const list = attemptsByExercise.get(row.exercise_id) ?? [];
    list.push(rowToAttempt(row));
    attemptsByExercise.set(row.exercise_id, list);
  }

  const result: Record<string, Exercise> = {};
  for (const exRow of exerciseRows) {
    result[exRow.id] = rowToExercise(exRow, attemptsByExercise.get(exRow.id) ?? []);
  }
  return result;
}

export function getExercise(sessionId: string, exerciseId: string): Exercise | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM exercises WHERE id = ? AND session_id = ?")
    .get(exerciseId, sessionId) as ExerciseRow | undefined;
  if (!row) return null;
  return rowToExercise(row, listAttemptsForExercise(exerciseId));
}

export async function addExercise(
  projectId: string,
  sessionId: string,
  exercise: Exercise
): Promise<void> {
  const db = getDb();
  const now = nowIso();

  const insert = db.transaction(() => {
    db.prepare(
      `INSERT INTO exercises (id, session_id, type, title, language, instructions, starter_code, expected_behavior, status, hints, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      exercise.id,
      sessionId,
      exercise.type,
      exercise.title,
      exercise.language,
      exercise.instructions,
      exercise.starterCode,
      exercise.expectedBehavior,
      exercise.status,
      JSON.stringify(exercise.hints),
      exercise.createdAt,
      exercise.updatedAt
    );

    for (const attempt of exercise.attempts) {
      db.prepare(
        `INSERT INTO exercise_attempts (id, exercise_id, code, blank_values, status, feedback, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        attempt.id,
        exercise.id,
        attempt.code,
        attempt.blankValues ? JSON.stringify(attempt.blankValues) : null,
        attempt.status,
        attempt.feedback ?? null,
        attempt.submittedAt
      );
    }

    db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(now, sessionId);
  });
  insert();
  emitSessionChanged(projectId, sessionId);
}

const UPDATABLE_COLUMNS: Record<string, string> = {
  status: "status",
  title: "title",
  instructions: "instructions",
  starterCode: "starter_code",
  expectedBehavior: "expected_behavior",
};

export async function updateExercise(
  projectId: string,
  sessionId: string,
  exerciseId: string,
  updates: Partial<Exercise>
): Promise<boolean> {
  const db = getDb();
  const now = nowIso();

  const sets: string[] = ["updated_at = ?"];
  const values: SQLQueryBindings[] = [now];

  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS)) {
    const value = (updates as Record<string, unknown>)[key];
    if (value !== undefined) {
      sets.push(`${column} = ?`);
      values.push(value as SQLQueryBindings);
    }
  }

  if (updates.hints !== undefined) {
    sets.push("hints = ?");
    values.push(JSON.stringify(updates.hints));
  }

  values.push(exerciseId, sessionId);

  const result = db
    .prepare(`UPDATE exercises SET ${sets.join(", ")} WHERE id = ? AND session_id = ?`)
    .run(...values);

  if (result.changes > 0) {
    db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(now, sessionId);
    emitSessionChanged(projectId, sessionId);
    return true;
  }
  return false;
}

export async function setActiveExerciseId(
  projectId: string,
  sessionId: string,
  exerciseId: string | null
): Promise<void> {
  const db = getDb();
  const now = nowIso();
  db.prepare(
    "UPDATE sessions SET active_exercise_id = ?, updated_at = ? WHERE id = ? AND project_id = ?"
  ).run(exerciseId, now, sessionId, projectId);
  emitSessionChanged(projectId, sessionId);
}
