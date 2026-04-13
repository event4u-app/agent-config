---
type: "auto"
description: "Running CLI commands that produce verbose output — git, tests, linters, docker, build tools"
---

# Development Efficiency

For communication/response style → `token-efficiency` rule.

## Codebase Navigation

### Use what you have

- Edited file → `str-replace-editor` showed result. Skip re-reading.
- Ran command → have output. Skip re-running.
- File in recent context → skip reloading.
- Found symbol → use it. Skip re-searching.

### Search before reading

- Search first — `codebase-retrieval`, `search_query_regex`, `grep`
- `view_range` or `search_query_regex` over full files
- Small files (< 50 lines) — OK to read fully

### `.augmentignore`

- `vendor/`, `node_modules/`, locks excluded from `codebase-retrieval`
- Need vendor details → `view` specific file (bypasses ignore)

### Minimize tool calls

- Parallel reads — batch, not sequential
- `search_query_regex` over full file reads
- `view_range` for known lines
- One `codebase-retrieval` call with all symbols

## Pattern: Redirect, Summarize, Target

Commands producing >30 lines:

### Step 1: Redirect
```bash
docker compose exec -T <service> <command> 2>&1 > /tmp/<tool>-output.txt
echo "EXIT=$?"
```

### Step 2: Summary only
```bash
tail -5 /tmp/<tool>-output.txt
```

### Step 3: Targeted details
```bash
grep "ERROR\|error\|✏️" /tmp/<tool>-output.txt | head -20
grep "app/Services/MyService.php" /tmp/<tool>-output.txt
```

**NEVER:** `cat` full output, read passing command output, read unactionable diffs.

## General Rules

1. **Exit code first** — if 0, skip reading
2. **Summary line** — last few lines suffice
3. **Targeted grep** — specific file/error type
4. **Read once, act, move on** — don't re-read
5. **Iterative fixing** — fix one, re-run, check exit code

## CLI Over MCP

CLI > MCP (significantly fewer tokens):
- Git, files, APIs, database → CLI
- Exception: MCPs with unique capabilities (Sentry, Playwright, Jira)

## Exceptions

- Small output (< 30 lines) → read directly
- Debugging → more context OK
- User asks for full output → show it
