# Output Patterns

Reference patterns for token-efficient command execution and output handling.
Referenced by `token-efficiency` rule.

## Pattern: Redirect, Summarize, Target

Every command that MAY produce >30 lines:

### Step 1: Redirect

```bash
docker compose exec -T <service> <command> 2>&1 > /tmp/<tool>-output.txt
echo "EXIT=$?"
```

### Step 2: Summary only

```bash
tail -5 /tmp/<tool>-output.txt
```

### Step 3: Targeted details (if errors)

```bash
grep "ERROR\|error\|✏️" /tmp/<tool>-output.txt | head -20
grep "app/Services/MyService.php" /tmp/<tool>-output.txt
```

**NEVER:** `cat /tmp/<tool>-output.txt`, read full passing output, read diffs you won't act on.

---

## Targeted Operations

Minimize scope. Never fetch more than needed.

### Queries
- Single item over list: query directly
- Filtered queries: always filter when listing unavoidable
- Specific fields: request only needed fields
- JSON + jq: extract exactly what you need

### Testing
- During work: ONLY specific test affected (`--filter=ClassName`)
- Broader scope: only if change could affect other tests
- Full suite: only at very end
- Decision: method → method's test · class → class tests · shared service → consumers · config → full suite

### API calls
- Targeted endpoints over list endpoints
- Small page sizes, stop after finding what you need
- Don't re-fetch what you just received

---

## Tool-First, Script-Last

Prefer skills with CLI tools over custom scripts.

1. **Existing skill** — use directly
2. **Skill + CLI tool** (jq, grep, awk, sed) — compose
3. **Python/Bash script** — only when no skill/tool combination exists

Scripts allowed: no skill covers it, no CLI achieves it, needs programmatic logic, reusable.
Scripts NOT allowed: skill exists, `jq` can extract it, `grep` + `head` can filter it.

**Learning trigger:** script written because no skill exists → capture learning → propose skill.

---

## General Rules

For tool-specific commands → see `quality-workflow` rule.

1. **ECS + Rector are trusted** — run `--fix`, don't read diffs. Verify: PHPStan + tests.
2. **Always `--fix`** — dry-run diffs waste tokens.
3. **Exit code first**: `$?` = 0 → done, don't read output.
4. **Summary line**: last few lines = all you need.
5. **Targeted grep**: specific file or error type. Never full output "just in case".
6. **Don't re-read**: once acted on, don't re-load.
7. **Iterative fixing**: fix one error, re-run, check exit code. Output stales after each fix.
