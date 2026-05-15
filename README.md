# Mula

AI-powered coding tutor desktop app. Built with Tauri + React + the Claude Agent SDK.

The tutor assesses your level, plans personalized lessons, and generates interactive exercises with an inline code editor. Exercises run, get reviewed by the agent, and adapt based on your attempts. Projects and sessions persist locally to the OS app data dir.

This is a personal-use app — clone and run it yourself. Not distributed as a binary.

## Stack

- Tauri 2 (Rust shell + Node sidecar)
- React 19 + TypeScript + Vite
- Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
- shadcn UI + Tailwind CSS 4 + Phosphor Icons
- Monaco editor
- Bun (package manager)
- oxlint + oxfmt

## Prerequisites

- [Bun](https://bun.sh)
- Rust toolchain (for Tauri — see [Tauri prerequisites](https://tauri.app/start/prerequisites/))
- An Anthropic auth source (see below)

## Setup

```bash
git clone <this repo>
cd mula
bun install
bun run tauri dev
```

The first launch pops the auth modal if no credential is found. Pick one of the two paths below.

## Authentication

Two credential sources, resolved in this order:

1. **Stored API key override** — paste an Anthropic Console API key into the in-app auth settings. Stored in the OS app data dir with `0600` permissions. Verified against `GET /v1/models` before saving. Active until you clear it.
2. **Local Claude Code CLI** — if `claude` is installed and signed in, the app inherits its session via the system keychain (macOS) or `~/.claude/.credentials.json` (Linux/Windows). No paste required.

Credentials are managed entirely from the in-app **Anthropic authentication** modal (shield icon in the sidebar footer). There is no `.env` mechanism — keys never live in your shell environment or the repo.

### Using the local Claude Code CLI (default)

1. Install Claude Code: https://docs.claude.com/en/docs/claude-code/setup
2. Sign in: `claude login`
3. Launch the app — banner shows **Connected via local Claude Code**.

### Using an Anthropic API key

1. Create a key in the [Anthropic Console](https://console.anthropic.com/settings/keys).
2. Open the auth modal, paste the key (`sk-ant-api…`), click **Save & verify**.
3. The sidecar restarts so the credential takes effect without an app restart.
4. Clear it any time to fall back to the CLI.

## Commands

```bash
bun run tauri dev    # desktop app, recommended
bun run dev          # frontend only in browser (no auth, no sidecar)
bun run tauri build  # production build

bun run check        # format + lint
bun run format       # auto-format
bun run lint         # lint only
```

## Architecture

- **Tauri shell** (`src-tauri/src/lib.rs`) — owns credential storage, detects the `claude` CLI, spawns the Node sidecar with the resolved API key injected as `ANTHROPIC_API_KEY` (empty string = defer to the CLI's own keychain auth). Port and auth token rotate on every spawn.
- **Sidecar** (`src/sidecar/`) — Express server running the Agent SDK. Exposes chat + credential verification routes. Only the Tauri frontend talks to it (auth token + localhost).
- **Frontend** (`src/`) — React app talking to the sidecar. `CredentialProvider` is the single source of truth for auth state.
- **Storage** — projects, sessions, exercises stored as files under the OS app data dir.
