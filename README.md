# Mula - AI-powered coding tutor

Mula is designed to help you learn how to code. Our tutor agent can generate coding lessons with interactive, in-flow exercises to help you learn by doing without leaving the app. Every session is tailored to your progress and learning needs.

This is currently a personal-use app — clone and run it yourself. Not distributed as a binary.

## Prerequisites

- [Bun](https://bun.sh)
- Rust toolchain (for Tauri — see [Tauri prerequisites](https://tauri.app/start/prerequisites/))
- An Anthropic auth source (see below)

## Setup

```bash
gh repo clone chaychun/mula
cd mula
bun install
bun run tauri:build
```

The first launch pops the auth modal if no credential is found. Pick one of the two paths below.

## Authentication

Two credential sources, resolved in this order:

1. **Stored API key override** — paste an Anthropic Console API key into the in-app auth settings. Stored in the OS app data dir with `0600` permissions. Active until you clear it.
2. **Local Claude Code CLI** — if `claude` is installed and signed in, the app inherits its session via the system keychain (macOS) or `~/.claude/.credentials.json` (Linux/Windows). No paste required. This will pull from your subscription's programmatic usage pool. [Learn more](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan). 

Credentials are managed entirely from the in-app **Anthropic authentication** modal. There is no `.env` mechanism — keys never live in your shell environment or the repo.

### Using the local Claude Code CLI (default)

1. Install Claude Code: https://docs.claude.com/en/docs/claude-code/setup
2. Sign in: `claude login`
3. Launch the app — banner shows **Connected via local Claude Code**.

### Using an Anthropic API key

1. Create a key in the [Anthropic Console](https://console.anthropic.com/settings/keys).
2. Open the auth modal, paste the key (`sk-ant-api…`), click **Save & verify**.
3. Clear it any time to fall back to the CLI.
