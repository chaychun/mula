import type {
  Message,
  ContentBlock,
  ExerciseSubmission,
  ConceptQuestionAnswer,
} from "../../lib/types";
import { getDb } from "../database";
import { parseJsonArray, parseJsonObject } from "./utils";

export interface MessageRow {
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

export function rowToMessage(row: MessageRow): Message {
  const msg: Message = {
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content,
    timestamp: row.timestamp,
  };
  const blocks = parseJsonArray<ContentBlock>(row.content_blocks);
  if (blocks.length > 0) msg.contentBlocks = blocks;

  const submission = parseJsonObject<ExerciseSubmission>(row.exercise_submission);
  if (submission) msg.exerciseSubmission = submission;

  const answer = parseJsonObject<ConceptQuestionAnswer>(row.concept_question_answer);
  if (answer) msg.conceptQuestionAnswer = answer;

  return msg;
}

export function listMessages(sessionId: string): Message[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY sort_order ASC")
    .all(sessionId) as MessageRow[];
  return rows.map(rowToMessage);
}

export function replaceMessages(sessionId: string, messages: Message[]): void {
  const db = getDb();
  const replace = db.transaction(() => {
    db.prepare("DELETE FROM messages WHERE session_id = ?").run(sessionId);
    const insert = db.prepare(
      `INSERT INTO messages
         (id, session_id, role, content, content_blocks, exercise_submission, concept_question_answer, timestamp, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      insert.run(
        m.id,
        sessionId,
        m.role,
        m.content,
        m.contentBlocks ? JSON.stringify(m.contentBlocks) : null,
        m.exerciseSubmission ? JSON.stringify(m.exerciseSubmission) : null,
        m.conceptQuestionAnswer ? JSON.stringify(m.conceptQuestionAnswer) : null,
        m.timestamp,
        i
      );
    }
  });
  replace();
}
