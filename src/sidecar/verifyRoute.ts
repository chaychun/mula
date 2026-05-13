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

export async function handleVerify(_req: Request, res: Response): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  // No API key set → sidecar is using the local Claude Code CLI's own auth.
  // Trust that path (verifying it requires an actual subprocess call which we
  // skip to keep this endpoint cheap and side-effect-free).
  if (!apiKey) {
    res.json({ ok: true } satisfies VerifyResult);
    return;
  }

  const result = await verifyApiKey(apiKey);
  res.json(result);
}
