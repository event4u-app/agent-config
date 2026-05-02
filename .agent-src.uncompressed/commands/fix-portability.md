---
name: fix-portability
description: Find and fix project-specific references in shared .augment/ package files
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "Package-internal — only the event4u/agent-config repo runs this."
---

<!-- F2-deprecation-banner -->
> **Deprecated — use `/fix portability`.** This standalone command
> is kept as a deprecation shim for one release cycle and routes to
> the same instructions below. New invocations should go through the
> `/fix` orchestrator (`commands/fix.md`).
<!-- /F2-deprecation-banner -->

# fix-portability

## Instructions

### 1. Run the portability checker

```bash
python3 scripts/check_portability.py --format json
```

### 2. Parse findings

If output is `[]` or "No portability violations found":

```
✅  No portability violations found. Package is project-agnostic.
```

Stop here.

### 3. Display findings

```
═══════════════════════════════════════════════
  📦 PORTABILITY VIOLATION REPORT
═══════════════════════════════════════════════

  Found: {count} violation(s)
```

Group by severity:

```
  🔴 ERRORS (must fix):
    {file}:{line} — pattern: `{pattern}` — match: `{matched_text}`

  🟡 WARNINGS (should fix):
    {file}:{line} — pattern: `{pattern}` — match: `{matched_text}`
```

### 4. Classify and fix

For each violation:

| Pattern Type | Fix Strategy |
|---|---|
| Project name (e.g., "MyApp", "acme-corp") | Replace with generic placeholder: `{project}`, `{app}` |
| Project-specific URL/domain | Replace with `https://example.com` or `{domain}` |
| Database name | Replace with `{database}` |
| Project-specific env var | Replace with generic `APP_*` equivalent |
| Project-specific path | Replace with relative or generic path |
| Docker container name | Replace with `{container}` |

Present a summary:

```
  Proposed fixes:
  1. {file}:{line} — `{old}` → `{new}`
  2. {file}:{line} — `{old}` → `{new}`

> 1. Apply all fixes
> 2. Apply interactively
> 3. Skip — report only
```

### 5. Apply fixes

Edit files in `.agent-src.uncompressed/`, then run `bash scripts/compress.sh --sync` to regenerate `.agent-src/` and `.augment/`.

After all fixes, re-run:

```bash
python3 scripts/check_portability.py
```

### 6. Mark hashes

For each modified file:

```bash
python3 scripts/compress.py --mark-done "{relative_path}"
```

## Rules

- **Always fix in `.agent-src.uncompressed/`** — never edit `.augment/` directly.
- **Copy to `.augment/`** after fixing.
- **Do NOT commit or push.**
- **`agents/` directory is allowed** to have project-specific references — skip it.
- **Do NOT fix references in code blocks** unless the code block is clearly a template.
- **Run the checker again after fixing** to verify 0 remaining issues.
