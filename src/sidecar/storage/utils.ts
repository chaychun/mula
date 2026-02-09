// Generate a unique ID (same format as the JSON storage version)
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
