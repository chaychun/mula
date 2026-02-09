import type { Project } from "../../lib/types";
import { getDb } from "../database";
import { generateId } from "./utils";

export async function createProject(name: string, description?: string): Promise<Project> {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, name, description ?? null, now, now);

  return { id, name, description, createdAt: now, updatedAt: now };
}

export async function getProject(projectId: string): Promise<Project | null> {
  const db = getDb();
  const row = db
    .prepare("SELECT id, name, description, created_at, updated_at FROM projects WHERE id = ?")
    .get(projectId) as
    | {
        id: string;
        name: string;
        description: string | null;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateProject(
  projectId: string,
  updates: Partial<Omit<Project, "id" | "createdAt">>
): Promise<Project | null> {
  const db = getDb();
  const existing = await getProject(projectId);
  if (!existing) return null;

  const now = new Date().toISOString();
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
  const rows = db
    .prepare(
      "SELECT id, name, description, created_at, updated_at FROM projects ORDER BY updated_at DESC"
    )
    .all() as Array<{
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
