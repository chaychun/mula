import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ShieldCheck, Sparkle, Trash, WarningCircle } from "@phosphor-icons/react";
import { useCredentialStatus } from "@/hooks/useCredentialStatus";

interface AuthSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline underline-offset-2 hover:no-underline"
    >
      {children}
    </a>
  );
}

export default function AuthSettingsModal({ isOpen, onClose }: AuthSettingsModalProps) {
  const { status, loading, tauriAvailable, store, clear } = useCredentialStatus();
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wasOpen = useRef(false);

  // Reset transient state only on the close → open transition.
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setApiKeyValue("");
      setError(null);
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  const activeLabel = useMemo(() => {
    if (!status.active_kind) return "Not configured";
    const kind = status.active_kind === "local_cli" ? "Local Claude Code" : "API key";
    const source =
      status.active_source === "stored"
        ? "stored in app"
        : status.active_source === "keychain"
          ? "via system keychain"
          : "from .env";
    return `${kind} (${source})`;
  }, [status]);

  const hasOverride = status.active_kind === "api_key";

  async function handleSave() {
    const trimmed = apiKeyValue.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("sk-ant-api")) {
      setError("API key should start with `sk-ant-api`. Create one in the Anthropic Console.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await store("api_key", trimmed);
      setApiKeyValue("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setError(null);
    setSaving(true);
    try {
      await clear("api_key");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck size={20} weight="duotone" />
            Anthropic authentication
          </DialogTitle>
          <DialogDescription>
            Uses your local Claude Code login by default. Paste an API key only if you want to
            override.
          </DialogDescription>
        </DialogHeader>

        {/* Status strip */}
        <div className="flex items-center justify-between border border-border bg-muted/40 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Currently active</span>
          <span className="flex items-center gap-1.5 font-medium">
            {status.active_kind ? (
              <Check size={14} weight="bold" className="text-primary" />
            ) : (
              <WarningCircle size={14} weight="fill" className="text-destructive" />
            )}
            {loading ? "Loading…" : activeLabel}
          </span>
        </div>

        {/* Local CLI detection card */}
        <div
          className={`flex items-start gap-3 border px-3 py-3 ${
            status.active_kind === "local_cli"
              ? "border-primary/40 bg-primary/5"
              : "border-border bg-muted/30"
          }`}
        >
          <Sparkle
            size={18}
            weight="fill"
            className={
              status.active_kind === "local_cli" ? "text-primary" : "text-muted-foreground"
            }
          />
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              Local Claude Code
              {status.local_cli_installed ? (
                status.local_cli_authenticated ? (
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-primary">
                    <Check size={10} weight="bold" /> Authenticated
                  </span>
                ) : (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Not signed in
                  </span>
                )
              ) : (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Not installed
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {status.active_kind === "local_cli"
                ? "Using your Claude Code login via the system keychain. Nothing to paste."
                : status.local_cli_authenticated
                  ? hasOverride
                    ? "Available as a fallback. Clear the API key override below to use it."
                    : "Detected but inactive."
                  : status.local_cli_installed
                    ? "Sign in once with `claude login`, then this becomes the default."
                    : "Install Claude Code first: "}
              {!status.local_cli_installed && (
                <ExternalLink href="https://docs.claude.com/en/docs/claude-code/setup">
                  setup guide
                </ExternalLink>
              )}
            </p>
          </div>
        </div>

        {/* API key override */}
        <div className="space-y-3 pt-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            API key override
          </div>
          <p className="text-sm text-muted-foreground">
            Direct API access, billed per token to your Anthropic Console account. Use only if you
            want a different account than your Claude Code login. Create a key in the{" "}
            <ExternalLink href="https://console.anthropic.com/settings/keys">
              Anthropic Console
            </ExternalLink>
            .
          </p>

          <div className="space-y-2">
            <Label htmlFor="api-key">API key</Label>
            <Input
              id="api-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-ant-api03-…"
              value={apiKeyValue}
              onChange={(e) => setApiKeyValue(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Stored in the app data dir with restricted permissions.
            </p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {status.has_api_key_stored && "Key currently stored."}
              {!status.has_api_key_stored && status.has_api_key_env && "Using key from .env."}
            </div>
            <div className="flex gap-2">
              {status.has_api_key_stored && (
                <Button variant="outline" size="sm" onClick={handleClear} disabled={saving}>
                  <Trash size={14} />
                  Clear
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!apiKeyValue.trim() || saving || !tauriAvailable}
              >
                {saving ? "Verifying…" : "Save & verify"}
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!tauriAvailable && (
          <div className="border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Running in browser dev mode — credentials must come from <code>.env</code>. Run the
            desktop app to manage them here.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
