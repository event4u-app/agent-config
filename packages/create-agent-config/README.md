# @event4u/create-agent-config

Thin npm wrapper that installs [`@event4u/agent-config`](https://www.npmjs.com/package/@event4u/agent-config) into the current directory in a single command — no `composer require`, no `git clone`.

## Quickstart

```bash
# Install everything (claude-code, cursor, windsurf, cline, gemini-cli, copilot, …)
npx @event4u/create-agent-config init --yes

# Pick specific tools
npx @event4u/create-agent-config init --tools=claude-code,cursor --yes

# Install from a specific git ref (useful for testing PRs)
npx @event4u/create-agent-config init --ref=main --yes
```

## What it does

1. Resolves the latest `@event4u/agent-config` tarball from the npm registry (or the GitHub codeload archive when `--ref` is set).
2. Extracts it to a temp directory under `os.tmpdir()`.
3. Runs `bash scripts/install --target <cwd> --tools=<picked> [--yes]`.
4. Cleans up the temp directory.

The package shape of `@event4u/agent-config` itself stays unchanged — this wrapper only exists so that users can run a single `npx` command from an empty directory.

## Options

| Flag | Description |
|---|---|
| `--tools <list>` | Comma-separated tool IDs (default: `all`). Forwarded to `scripts/install`. |
| `--yes`, `-y`    | Non-interactive mode. Skip prompts. |
| `--ref <git-ref>` | Install a specific git ref (branch, tag, sha) instead of the latest npm release. |
| `--target <dir>` | Target project directory (default: cwd). |
| `--dry-run`      | Print the command that would be run; do not execute. |
| `--help`, `-h`   | Show help. |

Valid `--tools` IDs: `claude-code`, `claude-desktop`, `cursor`, `windsurf`, `cline`, `gemini-cli`, `copilot`, `augment`, `aider`, `codex`, `all`.

## Subcommands

- `init` *(default)* — install into the current working directory.
- `global` — reserved for Phase 3 (global per-user install). Not yet shipped; prints a notice and exits non-zero.

## Requirements

- Node.js ≥ 18 (for `fetch`).
- `bash`, `tar`, `python3` (≥ 3.10) on the host — same as `scripts/install`.

## Why a separate package?

`@event4u/agent-config` is the project-local payload. Adding `npx`-style entry-point logic into it would force every Composer/npm consumer to ship the wrapper code. Splitting them keeps the payload package lean and gives `npx` users a single, discoverable name.

## License

MIT — see the [main repository LICENSE](https://github.com/event4u-app/agent-config/blob/main/LICENSE).
