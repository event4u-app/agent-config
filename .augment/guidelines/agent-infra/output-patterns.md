# Output Patterns

Reference patterns for token-efficient command execution and output handling.
Referenced by the `token-efficiency` rule.

## Pattern: Redirect, Summarize, Target

Every command that MAY produce more than ~30 lines of output:

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
# Read specific error lines
grep "ERROR\|error\|✏️" /tmp/<tool>-output.txt | head -20

# Read a specific file's errors
grep "app/Services/MyService.php" /tmp/<tool>-output.txt
```

**NEVER** do:

- `cat /tmp/<tool>-output.txt` (loads everything)
- Read the full output of a passing command (waste)
- Read diffs you don't plan to act on

---

## Targeted Operations

Minimize scope. Never fetch more than you need.

### Queries and lookups

- **Single item over list**: query directly, don't fetch list to find one entry.
- **Filtered queries**: always filter when listing unavoidable. `--filter=ClassName` not `--all`.
- **Specific fields**: request only needed fields.
- **JSON + jq**: use JSON output + `jq` to extract exactly what you need.

### Testing

- **During work**: ONLY the specific test affected (`--filter=ClassName`).
- **Broader scope**: only if change could affect other tests.
- **Full suite**: only at the very end.
- **Decision tree**:
  1. Changed one method → run that method's test
  2. Changed a class → run that class's test file
  3. Changed a shared service → run tests for all consumers
  4. Changed config/infrastructure → full suite

### API calls

- Targeted endpoints over list endpoints
- Small page sizes, stop after finding what you need
- Don't re-fetch what you just received

---

## Tool-First, Script-Last

**Prefer skills with CLI tools over custom scripts.**

### Hierarchy

1. **Existing skill** — use directly
2. **Skill + CLI tool** (jq, grep, awk, sed) — compose
3. **Python/Bash script** — only when no skill/tool combination exists

### Scripts allowed only when

- No skill covers the workflow
- No CLI tool achieves the goal
- Operation needs programmatic logic
- Script is reusable

### Scripts NOT allowed when

- Skill exists for this workflow
- `jq` can extract what you need
- `grep` + `head` can filter output

### Learning trigger

When you write a script because no skill exists → capture learning → propose skill.

---

## General Rules

For tool-specific commands → see the `quality-tools` skill.

1. **ECS and Rector are trusted tools** — run with `--fix`, don't read diffs. Trust the config.
   Verification: PHPStan + tests afterwards.

2. **Both ECS and Rector always run with `--fix`** — dry-run diffs waste tokens.

3. **Exit code first**: Check `$?` before reading ANY output. If 0, you're done.

4. **Summary line**: Most tools print a summary as the last few lines. That's all you need.

5. **Targeted grep**: `grep` for the specific file or error type. Never read full output "just in case".

6. **Don't re-read**: Once read and acted on, don't re-load into context.

7. **Iterative fixing**: Fix one error, re-run, check exit code. Output becomes stale after each fix.
