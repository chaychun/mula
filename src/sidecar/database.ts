import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";

let db: Database.Database | null = null;

const CURRENT_SCHEMA_VERSION = 1;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_session_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  topics TEXT DEFAULT '[]',
  active_exercise_id TEXT,
  wrap_up_summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  content_blocks TEXT,
  exercise_submission TEXT,
  concept_question_answer TEXT,
  timestamp TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_session_sort ON messages(session_id, sort_order);

CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'write_code',
  title TEXT NOT NULL,
  language TEXT NOT NULL,
  instructions TEXT NOT NULL,
  starter_code TEXT NOT NULL,
  expected_behavior TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  hints TEXT DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exercises_session_id ON exercises(session_id);

CREATE TABLE IF NOT EXISTS exercise_attempts (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  blank_values TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review',
  feedback TEXT,
  submitted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_exercise_id ON exercise_attempts(exercise_id);

CREATE TABLE IF NOT EXISTS concept_questions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  selected_option_index INTEGER,
  status TEXT NOT NULL DEFAULT 'unanswered',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_concept_questions_session_id ON concept_questions(session_id);

CREATE TABLE IF NOT EXISTS progress (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  overall_level TEXT NOT NULL DEFAULT 'beginner',
  summary TEXT,
  mastered_concepts TEXT DEFAULT '[]',
  needs_reinforcement TEXT DEFAULT '[]',
  recent_sessions TEXT DEFAULT '[]',
  last_updated TEXT NOT NULL,
  UNIQUE(project_id, topic)
);
CREATE INDEX IF NOT EXISTS idx_progress_project_id ON progress(project_id);
`;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return db;
}

export function initDatabase(databasePath: string): Database.Database {
  // Ensure directory exists
  const dir = path.dirname(databasePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(databasePath);

  // Enable WAL mode for better concurrent read performance
  db.pragma("journal_mode = WAL");
  // Enable foreign keys
  db.pragma("foreign_keys = ON");

  // Run schema creation
  db.exec(SCHEMA_SQL);

  // Check and set schema version
  const versionRow = db.prepare("SELECT version FROM schema_version LIMIT 1").get() as
    | { version: number }
    | undefined;

  if (!versionRow) {
    db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(CURRENT_SCHEMA_VERSION);
  }

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
