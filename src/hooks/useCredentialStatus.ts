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

export type CredentialKind = "oauth" | "api_key";
export type CredentialSource = "stored" | "env";

export interface CredentialStatus {
  active_kind: CredentialKind | null;
  active_source: CredentialSource | null;
  has_oauth_stored: boolean;
  has_api_key_stored: boolean;
  has_oauth_env: boolean;
  has_api_key_env: boolean;
}

interface CredentialContextValue {
  status: CredentialStatus;
  loading: boolean;
  tauriAvailable: boolean;
  refresh: () => Promise<void>;
  store: (kind: CredentialKind, value: string) => Promise<void>;
  clear: (kind: CredentialKind) => Promise<void>;
}

const EMPTY: CredentialStatus = {
  active_kind: null,
  active_source: null,
  has_oauth_stored: false,
  has_api_key_stored: false,
  has_oauth_env: false,
  has_api_key_env: false,
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

  const store = useCallback(
    async (kind: CredentialKind, value: string) => {
      await invokeTauri<void>("store_credential", { kind, value });
      await invokeTauri<void>("restart_sidecar");
      await refresh();
    },
    [refresh]
  );

  const clear = useCallback(
    async (kind: CredentialKind) => {
      await invokeTauri<void>("clear_credential", { kind });
      await invokeTauri<void>("restart_sidecar");
      await refresh();
    },
    [refresh]
  );

  const value = useMemo(
    () => ({ status, loading, tauriAvailable, refresh, store, clear }),
    [status, loading, tauriAvailable, refresh, store, clear]
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
