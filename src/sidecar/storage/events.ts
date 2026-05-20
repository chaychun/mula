import { EventEmitter } from "node:events";

export interface SessionChangedEvent {
  projectId: string;
  sessionId: string;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

export function emitSessionChanged(projectId: string, sessionId: string): void {
  emitter.emit("session:changed", { projectId, sessionId } satisfies SessionChangedEvent);
}

export function onSessionChanged(
  handler: (event: SessionChangedEvent) => void
): () => void {
  emitter.on("session:changed", handler);
  return () => {
    emitter.off("session:changed", handler);
  };
}
