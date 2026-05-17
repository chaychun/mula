import type { Project } from "../../lib/types";
import { getDb } from "../database";
import { generateId, nowIso } from "./utils";

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createProject(name: string, description?: string): Promise<Project> {
  const db = getDb();
  const id = generateId();
  const now = nowIso();

  db.prepare(
    "INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, name, description ?? null, now, now);

  return { id, name, description, createdAt: now, updatedAt: now };
}

export async function getProject(projectId: string): Promise<Project | null> {
  const db = getDb();
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as
    | ProjectRow
    | undefined;
  return row ? rowToProject(row) : null;
}

export async function updateProject(
  projectId: string,
  updates: Partial<Omit<Project, "id" | "createdAt">>
): Promise<Project | null> {
  const db = getDb();
  const existing = await getProject(projectId);
  if (!existing) return null;

  const now = nowIso();
  const newName = updates.name ?? existing.name;
  const newDescription =
    updates.description !== undefined ? updates.description : existing.description;

  db.prepare("UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?").run(
    newName,
    newDescription ?? null,
    now,
    projectId
  );

  return { ...existing, name: newName, description: newDescription, updatedAt: now };
}

export async function deleteProject(projectId: string): Promise<boolean> {
  const db = getDb();
  const result = db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
  return result.changes > 0;
}

export async function listProjects(): Promise<Project[]> {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all() as ProjectRow[];
  return rows.map(rowToProject);
}
