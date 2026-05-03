# CLI output handling — mechanics

Codebase navigation tips, the redirect-summarize-target fallback
pattern, the general rules around exit codes / summary lines, and the
CLI-over-MCP catalog for the
[`cli-output-handling`](../../../rules/cli-output-handling.md) rule.
The Iron Law, the detection rule (`rtk_installed`), the verbose-command
table, and the exceptions list live in the rule; this file is the
lookup material when the agent has to fall back from `rtk`.

## Codebase Navigation

### Use what you already have

- Edited a file → the edit tool already returned the result. Skip re-reading.
- Ran a command → you have the output. Skip re-running to "verify".
- File in context from recent messages → skip reloading.
- Found a symbol → use it. Skip searching again differently.

### Search before reading

- **Search first** — `codebase-retrieval`, `search_query_regex`, or `grep`.
- **Load only what you need** — use `view_range` or `search_query_regex`, not full files.
- **Small files** (< 50 lines) — OK to read fully.

### Ignored files (`.augmentignore`)

- `vendor/`, `node_modules/`, lock files, and generated files are excluded from `codebase-retrieval`.
- When you need to understand a vendor package (base class, interface, API), **read the specific file** with `view`. This bypasses the ignore.
- Load only the file you need — never browse entire vendor directories.

### Minimize tool calls

- **Parallel reads** — read multiple files in one batch, not sequentially.
- **`search_query_regex`** over full file reads.
- **`view_range`** when you know the exact lines.
- **One `codebase-retrieval` call** with all symbols — batch, not 5 separate calls.

## Fallback Pattern: Redirect, Summarize, Target

When `rtk` has no matching subcommand for the tool at hand, fall back to
this pattern. Every command that MAY produce more than ~30 lines of output:

### Step 1: Redirect to file
```bash
docker compose exec -T <service> <command> 2>&1 > /tmp/<tool>-output.txt
echo "EXIT=$?"
```

### Step 2: Read ONLY the summary
```bash
tail -5 /tmp/<tool>-output.txt
```

### Step 3: If errors exist, read ONLY what you need to fix
```bash
grep "ERROR\|error\|✏️" /tmp/<tool>-output.txt | head -20
grep "app/Services/MyService.php" /tmp/<tool>-output.txt
```

**NEVER** do:
- `cat /tmp/<tool>-output.txt` (loads everything)
- Read the full output of a passing command (waste)
- Read diffs you don't plan to act on

## General Rules

For tool-specific commands → see the `quality-tools` skill.

1. **Exit code first**: Check `$?` before reading ANY output. If 0, you're done — skip reading.
2. **Summary line**: Most tools print a summary as the last few lines. That's all you need.
3. **Targeted grep**: When you need details, `grep` for the specific file or error type.
4. **Read once, act, move on**: Once you've read output and acted on it, skip re-reading.
5. **Iterative fixing**: Fix one error at a time, re-run, check exit code.
   Output becomes stale after each fix — always re-run before reading again.

## CLI Over MCP

MCP servers are **significantly more token-expensive** than CLI equivalents.
When both options exist, prefer the CLI tool.

- **Git**: `git` CLI, not Git MCP
- **Files**: shell commands, not filesystem MCP
- **APIs**: `curl`/`httpie`, not HTTP MCP
- **Database**: `mysql`/`psql` CLI, not DB MCP

Exception: MCPs with **unique capabilities** (Sentry, Playwright, Jira).
