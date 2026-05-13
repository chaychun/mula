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
