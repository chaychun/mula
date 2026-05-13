import type { Request, Response } from "express";

interface VerifyResult {
  ok: boolean;
  error?: string;
}

async function parseApiError(res: globalThis.Response): Promise<string> {
  let detail = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    if (body?.error?.message) detail = body.error.message;
  } catch {
    // ignore parse failure, fall back to status code
  }
  return detail;
}

/**
 * Free, zero-inference check for an Anthropic API key: hit /v1/models.
 */
async function verifyApiKey(apiKey: string): Promise<VerifyResult> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: await parseApiError(res) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Verify an OAuth token by sending the minimum-cost message that Anthropic
 * will accept under the oauth-2025-04-20 beta: max_tokens=1, plus the required
 * "You are Claude Code" system prompt (Anthropic rejects OAuth requests
 * missing it). Bypasses the local `claude` CLI so keychain-stored CLI
 * credentials can't mask a bad token.
 */
async function verifyOAuthToken(token: string): Promise<VerifyResult> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "oauth-2025-04-20",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1,
        system: "You are Claude Code, Anthropic's official CLI for Claude.",
        messages: [{ role: "user", content: "." }],
      }),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: await parseApiError(res) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function handleVerify(_req: Request, res: Response): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim();

  // Match the precedence the Rust core uses when injecting creds: OAuth wins.
  let result: VerifyResult;
  if (oauthToken) {
    result = await verifyOAuthToken(oauthToken);
  } else if (apiKey) {
    result = await verifyApiKey(apiKey);
  } else {
    // No manual override — sidecar is using the local Claude Code CLI auth.
    // Nothing to verify against Anthropic directly without exercising the CLI.
    result = { ok: true };
  }
  res.json(result);
}
