// Sidecar connection state — populated on app startup via Tauri invoke()
let sidecarPort: number | null = null;
let authToken: string | null = null;

/**
 * Probe ports starting from `start` to find a running sidecar.
 * Returns the first port that responds to /health, or null.
 */
async function findSidecarPort(start: number, maxAttempts = 10): Promise<number | null> {
  for (let port = start; port < start + maxAttempts; port++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(500),
      });
      if (res.ok) return port;
    } catch {
      // Port not responding, try next
    }
  }
  return null;
}

/**
 * Initialize sidecar connection info.
 * In Tauri mode, uses invoke() to get port + auth token from Rust.
 * In browser dev mode, probes for a running sidecar starting at port 3001.
 */
export async function initSidecar(): Promise<void> {
  // In development (Vite dev server without Tauri), discover the sidecar
  if (!window.__TAURI_INTERNALS__) {
    const port = await findSidecarPort(3001);
    sidecarPort = port ?? 3001; // Fall back to 3001 if nothing found yet
    authToken = "";
    return;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  const info = await invoke<{ port: number; auth_token: string }>("get_sidecar_info");
  sidecarPort = info.port;
  authToken = info.auth_token;
}

/**
 * Get the base URL for sidecar API requests.
 */
export function getSidecarBaseUrl(): string {
  if (sidecarPort === null) {
    throw new Error("Sidecar not initialized. Call initSidecar() first.");
  }
  return `http://127.0.0.1:${sidecarPort}`;
}

/**
 * Fetch wrapper that injects sidecar port and auth token.
 * Drop-in replacement for window.fetch with relative URLs.
 */
export async function sidecarFetch(path: string, init?: RequestInit): Promise<Response> {
  const baseUrl = getSidecarBaseUrl();
  const url = `${baseUrl}${path}`;

  const headers = new Headers(init?.headers);
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  return fetch(url, {
    ...init,
    headers,
  });
}
