import type {
  Session,
  Message,
  Exercise,
  ExerciseAttempt,
  ConceptQuestion,
  ContentBlock,
  ExerciseSubmission,
  ConceptQuestionAnswer,
} from "../../lib/types";
import { getDb } from "../database";
import { generateId } from "./utils";

// Helper: build a Session object from its DB rows
function assembleSession(
  row: SessionRow,
  messages: Message[],
  exercises: Record<string, Exercise>,
  conceptQuestions: Record<string, ConceptQuestion>
): Session {
  return {
    id: row.id,
    projectId: row.project_id,
    agentSessionId: row.agent_session_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    topics: JSON.parse(row.topics || "[]"),
    title: row.title,
    messages,
    exercises,
    activeExerciseId: row.active_exercise_id,
    conceptQuestions,
    status: row.status as "active" | "completed",
    wrapUpSummary: row.wrap_up_summary ?? undefined,
  };
}

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

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  content_blocks: string | null;
  exercise_submission: string | null;
  concept_question_answer: string | null;
  timestamp: string;
  sort_order: number;
}

interface ExerciseRow {
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

interface AttemptRow {
  id: string;
  exercise_id: string;
  code: string;
  blank_values: string | null;
  status: string;
  feedback: string | null;
  submitted_at: string;
}

interface ConceptQuestionRow {
  id: string;
  session_id: string;
  question: string;
  options: string;
  selected_option_index: number | null;
  status: string;
  created_at: string;
}

function rowToMessage(row: MessageRow): Message {
  const msg: Message = {
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content,
    timestamp: row.timestamp,
  };
  if (row.content_blocks) {
    msg.contentBlocks = JSON.parse(row.content_blocks) as ContentBlock[];
  }
  if (row.exercise_submission) {
    msg.exerciseSubmission = JSON.parse(row.exercise_submission) as ExerciseSubmission;
  }
  if (row.concept_question_answer) {
    msg.conceptQuestionAnswer = JSON.parse(row.concept_question_answer) as ConceptQuestionAnswer;
  }
  return msg;
}

function rowToExercise(row: ExerciseRow, attempts: ExerciseAttempt[]): Exercise {
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
    hints: JSON.parse(row.hints || "[]"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToAttempt(row: AttemptRow): ExerciseAttempt {
  const attempt: ExerciseAttempt = {
    id: row.id,
    code: row.code,
    submittedAt: row.submitted_at,
    status: row.status as ExerciseAttempt["status"],
  };
  if (row.feedback) attempt.feedback = row.feedback;
  if (row.blank_values) attempt.blankValues = JSON.parse(row.blank_values);
  return attempt;
}

function rowToConceptQuestion(row: ConceptQuestionRow): ConceptQuestion {
  return {
    id: row.id,
    question: row.question,
    options: JSON.parse(row.options),
    selectedOptionIndex: row.selected_option_index,
    status: row.status as ConceptQuestion["status"],
    createdAt: row.created_at,
  };
}

// Create a new session
export async function createSession(projectId: string, title?: string): Promise<Session> {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO sessions (id, project_id, title, status, topics, active_exercise_id, created_at, updated_at)
     VALUES (?, ?, ?, 'active', '[]', NULL, ?, ?)`
  ).run(id, projectId, title || "Untitled Session", now, now);

  return {
    id,
    projectId,
    createdAt: now,
    updatedAt: now,
    topics: [],
    title: title || "Untitled Session",
    messages: [],
    exercises: {},
    activeExerciseId: null,
    conceptQuestions: {},
    status: "active",
  };
}

// Get a session by ID (fully hydrated with messages, exercises, attempts, questions)
export async function getSession(projectId: string, sessionId: string): Promise<Session | null> {
  const db = getDb();

  const row = db
    .prepare("SELECT * FROM sessions WHERE id = ? AND project_id = ?")
    .get(sessionId, projectId) as SessionRow | undefined;
  if (!row) return null;

  // Load messages
  const messageRows = db
    .prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY sort_order ASC")
    .all(sessionId) as MessageRow[];
  const messages = messageRows.map(rowToMessage);

  // Load exercises with their attempts
  const exerciseRows = db
    .prepare("SELECT * FROM exercises WHERE session_id = ?")
    .all(sessionId) as ExerciseRow[];

  const exercises: Record<string, Exercise> = {};
  for (const exRow of exerciseRows) {
    const attemptRows = db
      .prepare("SELECT * FROM exercise_attempts WHERE exercise_id = ? ORDER BY submitted_at ASC")
      .all(exRow.id) as AttemptRow[];
    exercises[exRow.id] = rowToExercise(exRow, attemptRows.map(rowToAttempt));
  }

  // Load concept questions
  const questionRows = db
    .prepare("SELECT * FROM concept_questions WHERE session_id = ?")
    .all(sessionId) as ConceptQuestionRow[];

  const conceptQuestions: Record<string, ConceptQuestion> = {};
  for (const qRow of questionRows) {
    conceptQuestions[qRow.id] = rowToConceptQuestion(qRow);
  }

  return assembleSession(row, messages, exercises, conceptQuestions);
}

// Update a session
export async function updateSession(
  projectId: string,
  sessionId: string,
  updates: Partial<Omit<Session, "id" | "projectId" | "createdAt">>
): Promise<Session | null> {
  const db = getDb();
  const now = new Date().toISOString();

  // Build SET clause dynamically from provided updates
  const sets: string[] = ["updated_at = ?"];
  const values: unknown[] = [now];

  if (updates.title !== undefined) {
    sets.push("title = ?");
    values.push(updates.title);
  }
  if (updates.status !== undefined) {
    sets.push("status = ?");
    values.push(updates.status);
  }
  if (updates.topics !== undefined) {
    sets.push("topics = ?");
    values.push(JSON.stringify(updates.topics));
  }
  if (updates.activeExerciseId !== undefined) {
    sets.push("active_exercise_id = ?");
    values.push(updates.activeExerciseId);
  }
  if (updates.wrapUpSummary !== undefined) {
    sets.push("wrap_up_summary = ?");
    values.push(updates.wrapUpSummary);
  }
  if (updates.agentSessionId !== undefined) {
    sets.push("agent_session_id = ?");
    values.push(updates.agentSessionId);
  }

  values.push(sessionId, projectId);

  const result = db
    .prepare(`UPDATE sessions SET ${sets.join(", ")} WHERE id = ? AND project_id = ?`)
    .run(...values);

  if (result.changes === 0) return null;

  return getSession(projectId, sessionId);
}

// Add a message to a session
export async function addMessageToSession(
  projectId: string,
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<Message | null> {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();

  // Get the next sort order
  const maxRow = db
    .prepare("SELECT COALESCE(MAX(sort_order), -1) as max_order FROM messages WHERE session_id = ?")
    .get(sessionId) as { max_order: number };
  const sortOrder = maxRow.max_order + 1;

  db.prepare(
    `INSERT INTO messages (id, session_id, role, content, timestamp, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, sessionId, role, content, now, sortOrder);

  // Update session timestamp
  db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ? AND project_id = ?").run(
    now,
    sessionId,
    projectId
  );

  return { id, role, content, timestamp: now };
}

// Add an exercise to a session
export async function addExerciseToSession(
  _projectId: string,
  sessionId: string,
  exercise: Exercise
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

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

  // Insert any existing attempts
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
}

// Update an exercise in a session
export async function updateExerciseInSession(
  _projectId: string,
  sessionId: string,
  exerciseId: string,
  updates: Partial<Exercise>
): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();

  const sets: string[] = ["updated_at = ?"];
  const values: unknown[] = [now];

  if (updates.status !== undefined) {
    sets.push("status = ?");
    values.push(updates.status);
  }
  if (updates.hints !== undefined) {
    sets.push("hints = ?");
    values.push(JSON.stringify(updates.hints));
  }
  if (updates.title !== undefined) {
    sets.push("title = ?");
    values.push(updates.title);
  }
  if (updates.instructions !== undefined) {
    sets.push("instructions = ?");
    values.push(updates.instructions);
  }
  if (updates.starterCode !== undefined) {
    sets.push("starter_code = ?");
    values.push(updates.starterCode);
  }
  if (updates.expectedBehavior !== undefined) {
    sets.push("expected_behavior = ?");
    values.push(updates.expectedBehavior);
  }

  values.push(exerciseId, sessionId);

  const result = db
    .prepare(`UPDATE exercises SET ${sets.join(", ")} WHERE id = ? AND session_id = ?`)
    .run(...values);

  if (result.changes > 0) {
    db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(now, sessionId);
    return true;
  }
  return false;
}

// Set the active exercise ID
export async function setActiveExerciseId(
  projectId: string,
  sessionId: string,
  exerciseId: string | null
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    "UPDATE sessions SET active_exercise_id = ?, updated_at = ? WHERE id = ? AND project_id = ?"
  ).run(exerciseId, now, sessionId, projectId);
}

// Add a concept question to a session
export async function addConceptQuestionToSession(
  _projectId: string,
  sessionId: string,
  question: ConceptQuestion
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO concept_questions (id, session_id, question, options, selected_option_index, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    question.id,
    sessionId,
    question.question,
    JSON.stringify(question.options),
    question.selectedOptionIndex,
    question.status,
    question.createdAt
  );

  db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(now, sessionId);
}

// Answer a concept question
export async function answerConceptQuestion(
  _projectId: string,
  sessionId: string,
  questionId: string,
  selectedOptionIndex: number
): Promise<ConceptQuestion | null> {
  const db = getDb();
  const now = new Date().toISOString();

  const row = db
    .prepare("SELECT * FROM concept_questions WHERE id = ? AND session_id = ?")
    .get(questionId, sessionId) as ConceptQuestionRow | undefined;

  if (!row) return null;

  const options = JSON.parse(row.options);
  const correctness = options[selectedOptionIndex]?.correctness || "incorrect";

  db.prepare("UPDATE concept_questions SET selected_option_index = ?, status = ? WHERE id = ?").run(
    selectedOptionIndex,
    correctness,
    questionId
  );

  db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(now, sessionId);

  return {
    id: row.id,
    question: row.question,
    options,
    selectedOptionIndex,
    status: correctness,
    createdAt: row.created_at,
  };
}

// Submit an exercise attempt
export async function submitExerciseAttempt(
  _projectId: string,
  sessionId: string,
  exerciseId: string,
  attemptId: string,
  code: string,
  blankValues?: Record<string, string>
): Promise<ExerciseAttempt | null> {
  const db = getDb();
  const now = new Date().toISOString();

  // Check exercise exists
  const exercise = db
    .prepare("SELECT id FROM exercises WHERE id = ? AND session_id = ?")
    .get(exerciseId, sessionId) as { id: string } | undefined;
  if (!exercise) return null;

  const attempt: ExerciseAttempt = {
    id: attemptId,
    code,
    blankValues,
    submittedAt: now,
    status: "pending_review",
  };

  // Insert attempt and update exercise status atomically
  const insertAndUpdate = db.transaction(() => {
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

  insertAndUpdate();
  return attempt;
}

// Set agent session ID
export async function setAgentSessionId(
  projectId: string,
  sessionId: string,
  agentSessionId: string
): Promise<void> {
  await updateSession(projectId, sessionId, { agentSessionId });
}

// Wrap up a session
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

// List all sessions for a project (without full message/exercise hydration for performance)
export async function listSessions(projectId: string): Promise<Session[]> {
  const db = getDb();

  const rows = db
    .prepare("SELECT * FROM sessions WHERE project_id = ? ORDER BY updated_at DESC")
    .all(projectId) as SessionRow[];

  return rows.map((row) => assembleSession(row, [], {}, {}));
}

// Get a single exercise by ID (for the update_exercise MCP tool)
export function getExercise(sessionId: string, exerciseId: string): Exercise | null {
  const db = getDb();

  const row = db
    .prepare("SELECT * FROM exercises WHERE id = ? AND session_id = ?")
    .get(exerciseId, sessionId) as ExerciseRow | undefined;
  if (!row) return null;

  const attemptRows = db
    .prepare("SELECT * FROM exercise_attempts WHERE exercise_id = ? ORDER BY submitted_at ASC")
    .all(exerciseId) as AttemptRow[];

  return rowToExercise(row, attemptRows.map(rowToAttempt));
}

// Update the latest attempt's status (for update_exercise MCP tool)
export function updateLatestAttemptStatus(exerciseId: string, status: string): void {
  const db = getDb();

  db.prepare(
    `UPDATE exercise_attempts SET status = ?
     WHERE exercise_id = ? AND submitted_at = (
       SELECT MAX(submitted_at) FROM exercise_attempts WHERE exercise_id = ?
     )`
  ).run(status, exerciseId, exerciseId);
}
