# Claude Code Instructions for This Project

## Package Manager

This project uses **bun** as the package manager, not npm.

## Linting and Formatting

This project uses **oxlint** for linting and **oxfmt** for formatting.

### Available Commands

```bash
bun run lint         # Run oxlint to check for code issues
bun run format       # Format all code with oxfmt
bun run format:check # Check if code is formatted without modifying
bun run check        # Run format + lint (use this for full check)
```

### When to Run

**IMPORTANT**: After completing your work on a turn and before summarizing results to the user:

1. **Format the code**: Run `bun run format` to auto-format all files
2. **Check for lint errors**: Run `bun run lint` to catch any issues
3. **Fix any errors**: Address any linting errors before completing the turn

You can also run `bun run check` which does both formatting and linting in one command.

### Configuration Files

- `.oxlintrc.json` - Linting rules and settings
- `.oxfmtrc.json` - Formatting preferences (Prettier-compatible)

### Philosophy

- Oxlint is blazingly fast (written in Rust)
- Oxfmt is Prettier-compatible but faster
- These tools replace ESLint and Prettier with better performance
