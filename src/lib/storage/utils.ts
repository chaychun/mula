import * as fs from "fs/promises";
import * as path from "path";

// Lock queue implementation to prevent concurrent writes
// Uses a queue pattern to avoid race conditions between check and acquire
interface LockEntry {
  promise: Promise<void>;
  release: () => void;
  timeoutId: ReturnType<typeof setTimeout>;
}
const fileLockQueues = new Map<string, LockEntry>();

// Lock timeout - if a lock is held longer than this, it's automatically released
// to prevent deadlocks from unhandled exceptions
const LOCK_TIMEOUT_MS = 30000;

async function acquireLock(filePath: string): Promise<() => void> {
  // Get the current lock entry (or create a resolved one if none)
  const currentEntry = fileLockQueues.get(filePath);
  const currentLock = currentEntry?.promise ?? Promise.resolve();

  // Create a new lock that will be released when the caller is done
  let releaseLock: () => void;
  const newLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  // Track whether this lock has been released
  let released = false;

  // Set up automatic timeout release to prevent deadlocks
  const timeoutId = setTimeout(() => {
    if (!released) {
      console.warn(`[storage] Lock timeout for ${filePath}, auto-releasing to prevent deadlock`);
      doRelease();
    }
  }, LOCK_TIMEOUT_MS);

  const doRelease = () => {
    if (released) return; // Prevent double-release
    released = true;
    clearTimeout(timeoutId);
    // Clean up the queue if this is the last lock
    if (fileLockQueues.get(filePath)?.promise === newLock) {
      fileLockQueues.delete(filePath);
    }
    releaseLock!();
  };

  // Create the lock entry
  const newEntry: LockEntry = {
    promise: newLock,
    release: doRelease,
    timeoutId,
  };

  // Chain our lock after the current one - this is atomic since we set
  // the new lock before awaiting the old one
  fileLockQueues.set(filePath, newEntry);

  // Wait for the previous lock to be released
  await currentLock;

  return doRelease;
}

// Get the data path from environment or use default
export function getDataPath(): string {
  // In development, use .dev-data in the project root
  if (process.env.NODE_ENV === "development") {
    return path.join(process.cwd(), ".dev-data");
  }

  // In production, prefer DATA_PATH env var
  if (process.env.DATA_PATH) {
    return process.env.DATA_PATH;
  }

  // Fall back to home directory (HOME should always be set on Unix systems)
  const homeDir = process.env.HOME;
  if (!homeDir) {
    throw new Error("DATA_PATH environment variable is required when HOME is not set");
  }
  return path.join(homeDir, "coding-tutor-data");
}

// Ensure a directory exists
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

// Read JSON file with error handling
export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as T;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

// Atomic read-modify-write operation with file locking
export async function updateJsonFile<T>(
  filePath: string,
  updater: (current: T | null) => T | null
): Promise<T | null> {
  const release = await acquireLock(filePath);
  let tempPath: string | null = null;
  try {
    const current = await readJsonFile<T>(filePath);
    const updated = updater(current);
    if (updated !== null) {
      await ensureDir(path.dirname(filePath));
      tempPath = `${filePath}.tmp.${Date.now()}`;
      await fs.writeFile(tempPath, JSON.stringify(updated, null, 2), "utf-8");
      await fs.rename(tempPath, filePath);
      tempPath = null; // Successfully renamed, no cleanup needed
    }
    return updated;
  } finally {
    // Clean up orphaned temp file if rename failed
    if (tempPath) {
      await fs.unlink(tempPath).catch(() => {});
    }
    release();
  }
}

// Write JSON file with directory creation and atomic write
export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  const release = await acquireLock(filePath);
  let tempPath: string | null = null;
  try {
    await ensureDir(path.dirname(filePath));
    // Write to temp file first, then rename for atomic operation
    tempPath = `${filePath}.tmp.${Date.now()}`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf-8");
    await fs.rename(tempPath, filePath);
    tempPath = null; // Successfully renamed, no cleanup needed
  } finally {
    // Clean up orphaned temp file if rename failed
    if (tempPath) {
      await fs.unlink(tempPath).catch(() => {});
    }
    release();
  }
}

// List directories in a directory (filters out files like .DS_Store)
export async function listDirectories(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

// List files in a directory (filters out directories and hidden files)
export async function listFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
      .map((entry) => entry.name);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

// Generate a unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
