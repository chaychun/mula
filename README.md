# Coding Tutor

AI-powered coding tutor desktop app. Built with Tauri + React + the Claude Agent SDK.

The tutor assesses your level, plans personalized lessons, and generates interactive exercises with an inline code editor. Exercises run, get reviewed by the agent, and adapt based on your attempts. Projects and sessions persist locally.

## Stack

- Tauri 2 (Rust shell + sidecar)
- React 19 + TypeScript + Vite
- Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
- shadcn UI + Tailwind CSS 4 + Phosphor Icons
- Monaco editor
- Bun (package manager)
- oxlint + oxfmt

## Prerequisites

- Bun
- Rust toolchain (for Tauri)
- One of the two authentication paths below

## Authentication

The app uses **two** auth paths, resolved in this order:

1. **Stored API key override** — paste an Anthropic Console API key into the in-app auth settings. Stored in the app data dir with `0600` permissions and used as the active credential until cleared.
2. **Local Claude Code CLI** — if `claude` is installed and signed in (`claude login`), the app inherits its session via the system keychain. No paste required.

There is no `.env` fallback. Credentials are managed entirely from the in-app **Anthropic authentication** modal (shield icon in the sidebar footer).

### Path A — Local Claude Code (default, recommended)

1. Install Claude Code: https://docs.claude.com/en/docs/claude-code/setup
2. Sign in: `claude login`
3. Launch the app — the banner shows **Connected via local Claude Code**.

### Path B — Anthropic API key override

1. Create a key in the [Anthropic Console](https://console.anthropic.com/settings/keys).
2. Launch the app, open the auth modal, paste the key (`sk-ant-api…`), click **Save & verify**.
3. The key is verified against `GET /v1/models` before it's saved. The sidecar restarts so the new credential takes effect without an app restart.
4. Clear it any time to fall back to Path A.

## Develop

```bash
bun install
bun run tauri dev    # desktop app (recommended)
```

Browser dev mode (`bun run dev`) runs the frontend without Tauri. Credential management is unavailable in that mode — use the desktop app.

## Lint / format

```bash
bun run check        # format + lint
bun run format       # auto-format
bun run lint         # lint only
```

## Build

```bash
bun run tauri build
```

## Architecture (short)

- **Tauri shell** (`src-tauri/src/lib.rs`) — owns credential storage, detects the `claude` CLI, spawns the Node sidecar with the resolved API key injected as `ANTHROPIC_API_KEY` (or empty, to defer to the CLI's own auth).
- **Sidecar** (`src/sidecar/`) — Express server running the Agent SDK, exposes chat + credential verification routes. Port and auth token rotate on every spawn.
- **Frontend** (`src/`) — React app talking to the sidecar over `localhost`. `CredentialProvider` is the single source of truth for auth state.
