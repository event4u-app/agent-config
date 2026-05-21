# Execution Classification Standard

Formal criteria for classifying skills into execution types.
This document is the single source of truth — all tagging decisions reference it.

## Execution types

### Manual

**Definition:** Knowledge, patterns, or conventions the agent applies through reasoning.
No deterministic input → output flow. No shell commands, no external API calls.

**Criteria — ALL must be true:**

- Provides guidance, not executable steps
- Output depends entirely on context and agent judgment
- No CLI commands or tool calls in the procedure
- No structured input/output contract

**Examples:** `laravel`, `php-coder`, `eloquent`, `security`, `database`, `fe-design`

**Handler:** `none`

---

### Assisted

**Definition:** Multi-step workflow requiring user confirmation at key decision points.
May read external state, propose actions, and execute after user approval.

**Criteria — ALL must be true:**

- Follows a defined workflow with numbered steps
- At least one step requires user confirmation or input
- May read external state (files, APIs, git)
- Write operations only after user approval

**Examples:** `create-pr`, `fix-pr-comments`, `jira-ticket`, `bug-fix`, `commit`

**Handler:** `internal` (agent-driven workflow) or `shell` (CLI with confirmation)

**⚠️ CLI-based ≠ automated.** Skills like `commit` create irreversible history and need user judgment.

---

### Automated

**Definition:** Self-running skill that produces predictable output without user intervention.

**Criteria — ALL 6 must be true:**

| # | Criterion | Question |
|---|---|---|
| 1 | **Deterministic** | Same input → predictable output? |
| 2 | **Reversible** | Can changes be undone (git reset, file restore)? |
| 3 | **Locally verifiable** | Can success/failure be checked immediately? |
| 4 | **Bounded scope** | Affects only specific files, never external systems? |
| 5 | **No destructive side effects** | No data loss, no external writes, no published artifacts? |
| 6 | **No content alignment** | No user judgment needed for output quality? |

**If ANY criterion fails → classify as `assisted`, not `automated`.**

**Examples:** `compress`, `quality-fix` (ECS/Rector only), `package-test`

**Handler:** `shell` (CLI commands) or `internal` (file transforms)

**Safety requirements for automated skills:**
- `safety_mode: strict` is mandatory
- `allowed_tools: []` (no external tool access)
- `timeout_seconds` must be set (default: 120)

---

## Explicit exclusion list (CLI but NOT automated)

These skills are CLI-based but fail one or more automated criteria:

| Skill | Why not automated |
|---|---|
| `commit` | Creates irreversible git history (fails #2, #5) |
| `create-pr` | External write to GitHub (fails #4, #5) |
| `fix-pr-comments` | External write to GitHub (fails #4, #5) |
| `fix-ci` | Depends on CI state, may push (fails #1, #5) |
| `quality-fix` (with PHPStan) | PHPStan requires judgment for fixes (fails #6) |

---

## Handler rules

| Handler | When to use | Allowed for |
|---|---|---|
| `none` | No execution capability | `manual` only |
| `shell` | Runs CLI commands | `assisted`, `automated` |
| `internal` | Agent-internal workflow | `assisted`, `automated` |

---

## allowed_tools rules

- Only declare tools the skill **actually calls** via tool adapters
- Valid values: `github`, `jira` (from tool registry)
- Empty `[]` for skills that don't use external tools
- Never declare tools "just in case"
- Automated skills MUST have `allowed_tools: []`

---

## Decision flowchart

```
Is this a knowledge/convention skill?
  YES → manual (handler: none)
  NO ↓

Does it run CLI commands or workflows?
  NO → manual
  YES ↓

Does it pass ALL 6 automated criteria?
  NO → assisted
  YES ↓

→ automated (safety_mode: strict, timeout required)
```

---

## Migration rules

- **Default to `manual` when uncertain** — upgrade later with evidence
- **Never tag `automated` without reviewing all 6 criteria**
- Skills without `execution:` block are implicitly `manual`
- Batch by type: tag all automated first (smallest set), then assisted
- Leave manual skills untagged unless they need explicit `handler: none` for documentation

## Versioning

- v1.0 — Initial standard (Phase 4)
- Changes to criteria require review and re-evaluation of affected skills
