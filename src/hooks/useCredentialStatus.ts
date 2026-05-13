import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { reinitSidecar, sidecarFetch } from "@/lib/sidecar";

export type CredentialKind = "local_cli" | "api_key";
export type StoredCredentialKind = "api_key";
export type CredentialSource = "stored" | "keychain";

export interface CredentialStatus {
  active_kind: CredentialKind | null;
  active_source: CredentialSource | null;
  has_api_key_stored: boolean;
  local_cli_installed: boolean;
  local_cli_authenticated: boolean;
}

interface CredentialContextValue {
  status: CredentialStatus;
  loading: boolean;
  tauriAvailable: boolean;
  refresh: () => Promise<void>;
  /** Stores, restarts the sidecar, then verifies. Throws if verification fails. */
  store: (kind: StoredCredentialKind, value: string) => Promise<void>;
  clear: (kind: StoredCredentialKind) => Promise<void>;
  /** Run a verification round-trip without changing creds. */
  verify: () => Promise<{ ok: boolean; error?: string }>;
}

const EMPTY: CredentialStatus = {
  active_kind: null,
  active_source: null,
  has_api_key_stored: false,
  local_cli_installed: false,
  local_cli_authenticated: false,
};

const CredentialContext = createContext<CredentialContextValue | null>(null);

async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!window.__TAURI_INTERNALS__) {
    throw new Error("Tauri not available");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export function CredentialProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CredentialStatus>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [tauriAvailable, setTauriAvailable] = useState(true);

  const refresh = useCallback(async () => {
    if (!window.__TAURI_INTERNALS__) {
      setTauriAvailable(false);
      setLoading(false);
      return;
    }
    try {
      const s = await invokeTauri<CredentialStatus>("get_credential_status");
      setStatus(s);
    } catch (e) {
      console.error("get_credential_status failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const verify = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await sidecarFetch("/api/verify-credential", { method: "POST" });
      if (!res.ok) return { ok: false, error: `Sidecar responded ${res.status}` };
      return (await res.json()) as { ok: boolean; error?: string };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }, []);

  const store = useCallback(
    async (kind: StoredCredentialKind, value: string) => {
      await invokeTauri<void>("store_credential", { kind, value });
      await invokeTauri<void>("restart_sidecar");
      await reinitSidecar();
      const result = await verify();
      await refresh();
      if (!result.ok) {
        throw new Error(result.error || "Credential verification failed");
      }
    },
    [refresh, verify]
  );

  const clear = useCallback(
    async (kind: StoredCredentialKind) => {
      await invokeTauri<void>("clear_credential", { kind });
      await invokeTauri<void>("restart_sidecar");
      await reinitSidecar();
      await refresh();
    },
    [refresh]
  );

  const value = useMemo(
    () => ({ status, loading, tauriAvailable, refresh, store, clear, verify }),
    [status, loading, tauriAvailable, refresh, store, clear, verify]
  );

  return createElement(CredentialContext.Provider, { value }, children);
}

export function useCredentialStatus(): CredentialContextValue {
  const ctx = useContext(CredentialContext);
  if (!ctx) {
    throw new Error("useCredentialStatus must be used inside CredentialProvider");
  }
  return ctx;
}
