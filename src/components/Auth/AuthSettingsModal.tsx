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
import {
  Check,
  Key,
  ShieldCheck,
  Sparkle,
  Terminal,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import type { CredentialKind } from "@/hooks/useCredentialStatus";
import { useCredentialStatus } from "@/hooks/useCredentialStatus";
import { cn } from "@/lib/utils";

type Tab = "oauth" | "api_key";

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
  const [tab, setTab] = useState<Tab>("oauth");
  const [oauthValue, setOauthValue] = useState("");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [saving, setSaving] = useState<CredentialKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wasOpen = useRef(false);

  // Reset transient state only on the close → open transition, not on every
  // status refresh while the modal is open.
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setOauthValue("");
      setApiKeyValue("");
      setError(null);
      setTab(status.has_api_key_stored && !status.has_oauth_stored ? "api_key" : "oauth");
    }
    wasOpen.current = isOpen;
  }, [isOpen, status.has_api_key_stored, status.has_oauth_stored]);

  const activeLabel = useMemo(() => {
    if (!status.active_kind) return "Not configured";
    const kind = status.active_kind === "oauth" ? "Claude subscription" : "API key";
    const source = status.active_source === "stored" ? "stored in app" : "from .env";
    return `${kind} (${source})`;
  }, [status]);

  async function handleSave(kind: CredentialKind) {
    const value = kind === "oauth" ? oauthValue : apiKeyValue;
    const trimmed = value.trim();
    if (!trimmed) return;

    if (kind === "oauth" && !trimmed.startsWith("sk-ant-oat")) {
      setError(
        "OAuth token should start with `sk-ant-oat`. Generate one with `claude setup-token`."
      );
      return;
    }
    if (kind === "api_key" && !trimmed.startsWith("sk-ant-api")) {
      setError("API key should start with `sk-ant-api`. Create one in the Anthropic Console.");
      return;
    }

    setError(null);
    setSaving(kind);
    try {
      await store(kind, trimmed);
      if (kind === "oauth") setOauthValue("");
      else setApiKeyValue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  }

  async function handleClear(kind: CredentialKind) {
    setError(null);
    setSaving(kind);
    try {
      await clear(kind);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck size={20} weight="duotone" />
            Anthropic authentication
          </DialogTitle>
          <DialogDescription>
            Pick how the tutor talks to Claude. Subscription is the primary path.
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

        {/* Tabs */}
        <div className="flex border-b border-border" role="tablist">
          <TabButton
            active={tab === "oauth"}
            onClick={() => setTab("oauth")}
            icon={<Sparkle size={14} weight={tab === "oauth" ? "fill" : "regular"} />}
            label="Subscription"
            badge="Primary"
            indicator={status.has_oauth_stored || status.has_oauth_env}
          />
          <TabButton
            active={tab === "api_key"}
            onClick={() => setTab("api_key")}
            icon={<Key size={14} weight={tab === "api_key" ? "fill" : "regular"} />}
            label="API key"
            badge="Pay-per-use"
            indicator={status.has_api_key_stored || status.has_api_key_env}
          />
        </div>

        {/* Pane: OAuth */}
        {tab === "oauth" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Uses your Claude Pro, Max, Team, or Enterprise plan. Token is generated locally by the
              Claude Code CLI — Anthropic never sees the app.
            </p>
            <ol className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="text-muted-foreground tabular-nums">1.</span>
                <span>
                  Install Claude Code if you haven't:{" "}
                  <ExternalLink href="https://docs.claude.com/en/docs/claude-code/setup">
                    setup guide
                  </ExternalLink>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-muted-foreground tabular-nums">2.</span>
                <div className="flex-1 space-y-1">
                  <span>Run in a terminal:</span>
                  <code className="block bg-muted px-2 py-1.5 font-mono text-xs flex items-center gap-2">
                    <Terminal size={12} />
                    claude setup-token
                  </code>
                </div>
              </li>
              <li className="flex gap-2">
                <span className="text-muted-foreground tabular-nums">3.</span>
                <span>Sign in with your Claude account, copy the token, paste below.</span>
              </li>
            </ol>

            <div className="space-y-2 pt-1">
              <Label htmlFor="oauth-token">OAuth token</Label>
              <Input
                id="oauth-token"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-ant-oat01-…"
                value={oauthValue}
                onChange={(e) => setOauthValue(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Stored in the app data dir with restricted permissions. Never sent anywhere except
                Anthropic.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="text-xs text-muted-foreground">
                {status.has_oauth_stored && "Token currently stored."}
                {!status.has_oauth_stored && status.has_oauth_env && "Using token from .env."}
              </div>
              <div className="flex gap-2">
                {status.has_oauth_stored && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleClear("oauth")}
                    disabled={saving !== null}
                  >
                    <Trash size={14} />
                    Clear
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => handleSave("oauth")}
                  disabled={!oauthValue.trim() || saving !== null || !tauriAvailable}
                >
                  {saving === "oauth" ? "Saving…" : "Save token"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Pane: API key */}
        {tab === "api_key" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Direct API access. Billed per token to your Anthropic Console account. Good fallback
              if you don't have a Claude subscription.
            </p>
            <ol className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="text-muted-foreground tabular-nums">1.</span>
                <span>
                  Create a key in the{" "}
                  <ExternalLink href="https://console.anthropic.com/settings/keys">
                    Anthropic Console
                  </ExternalLink>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-muted-foreground tabular-nums">2.</span>
                <span>Copy and paste below.</span>
              </li>
            </ol>

            <div className="space-y-2 pt-1">
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

            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="text-xs text-muted-foreground">
                {status.has_api_key_stored && "Key currently stored."}
                {!status.has_api_key_stored && status.has_api_key_env && "Using key from .env."}
              </div>
              <div className="flex gap-2">
                {status.has_api_key_stored && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleClear("api_key")}
                    disabled={saving !== null}
                  >
                    <Trash size={14} />
                    Clear
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => handleSave("api_key")}
                  disabled={!apiKeyValue.trim() || saving !== null || !tauriAvailable}
                >
                  {saving === "api_key" ? "Saving…" : "Save key"}
                </Button>
              </div>
            </div>
          </div>
        )}

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

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge: string;
  indicator: boolean;
}

function TabButton({ active, onClick, icon, label, badge, indicator }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors -mb-px",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{badge}</span>
      {indicator && (
        <span className="ml-0.5 size-1.5 rounded-full bg-primary" aria-label="configured" />
      )}
    </button>
  );
}
