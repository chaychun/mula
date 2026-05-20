import type { ConceptQuestion, ConceptQuestionOption } from "../../lib/types";
import { getDb } from "../database";
import { nowIso, parseJsonArray } from "./utils";
import { emitSessionChanged } from "./events";

export interface ConceptQuestionRow {
  id: string;
  session_id: string;
  question: string;
  options: string;
  selected_option_index: number | null;
  status: string;
  created_at: string;
}

export function rowToConceptQuestion(row: ConceptQuestionRow): ConceptQuestion {
  return {
    id: row.id,
    question: row.question,
    options: parseJsonArray<ConceptQuestionOption>(row.options),
    selectedOptionIndex: row.selected_option_index,
    status: row.status as ConceptQuestion["status"],
    createdAt: row.created_at,
  };
}

export function listConceptQuestions(sessionId: string): Record<string, ConceptQuestion> {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM concept_questions WHERE session_id = ?")
    .all(sessionId) as ConceptQuestionRow[];

  const result: Record<string, ConceptQuestion> = {};
  for (const row of rows) {
    result[row.id] = rowToConceptQuestion(row);
  }
  return result;
}

export async function addConceptQuestion(
  projectId: string,
  sessionId: string,
  question: ConceptQuestion
): Promise<void> {
  const db = getDb();
  const now = nowIso();

  const insert = db.transaction(() => {
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
  });
  insert();
  emitSessionChanged(projectId, sessionId);
}

export async function answerConceptQuestion(
  projectId: string,
  sessionId: string,
  questionId: string,
  selectedOptionIndex: number
): Promise<ConceptQuestion | null> {
  const db = getDb();
  const now = nowIso();

  const row = db
    .prepare("SELECT * FROM concept_questions WHERE id = ? AND session_id = ?")
    .get(questionId, sessionId) as ConceptQuestionRow | undefined;

  if (!row) return null;

  const options = parseJsonArray<ConceptQuestionOption>(row.options);
  const correctness = options[selectedOptionIndex]?.correctness ?? "incorrect";

  const update = db.transaction(() => {
    db.prepare(
      "UPDATE concept_questions SET selected_option_index = ?, status = ? WHERE id = ?"
    ).run(selectedOptionIndex, correctness, questionId);

    db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(now, sessionId);
  });
  update();
  emitSessionChanged(projectId, sessionId);

  return {
    id: row.id,
    question: row.question,
    options,
    selectedOptionIndex,
    status: correctness,
    createdAt: row.created_at,
  };
}
