---
name: agents:audit
tier: 2
cluster: agents
sub: audit
description: Audit agent infrastructure — token overhead, rule triggers, AGENTS.md health, Capability-over-Structure adherence, stale references. Read-only, suggest-only, never auto-apply.
skills: [copilot-agents-optimization, agents-audit, agent-docs-writing, agents-md-thin-root, quality-tools]
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "audit agent infrastructure, check rule triggers, verify AGENTS.md health, agent-layer health-check"
  trigger_context: "maintainer working on .augment/ files, AGENTS.md, or planning a refactor"
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# /agents audit

Read-only health check of the **agent layer** — `AGENTS.md` (and tool stubs),
rules, skills, and pointer/anchor integrity. Measures token overhead, surfaces
duplicate triggers, verifies the Thin-Root contract, and flags stale references.
**Suggest only — never auto-apply.** Fixes happen via `/agents optimize` (file
refactor) or rule-/skill-level commands.

**Source of truth:** `.agent-src.uncondensed/` — never read or edit
`.agent-src/` or `.augment/` directly.

## Steps

### 1. Measure baseline

Count lines affecting token consumption:

```bash
# Always-loaded (per chat)
for f in .agent-src.uncondensed/rules/*.md; do
  type=$(head -5 "$f" | grep 'type:' | sed 's/.*"\(.*\)"/\1/')
  [ "$type" = "auto" ] && continue
  lines=$(wc -l < "$f"); echo "always | $lines | $(basename "$f")"
done | sort -t'|' -k2 -rn
agents=$(wc -l < AGENTS.md); echo "always | $agents | AGENTS.md"

# Auto-loaded rules
for f in .agent-src.uncondensed/rules/*.md; do
  type=$(head -5 "$f" | grep 'type:' | sed 's/.*"\(.*\)"/\1/')
  [ "$type" != "auto" ] && continue
  lines=$(wc -l < "$f"); echo "auto | $lines | $(basename "$f")"
done | sort -t'|' -k2 -rn

# Skills (top 20 by size)
for f in .agent-src.uncondensed/skills/*/SKILL.md; do
  name=$(echo "$f" | sed 's|.agent-src.uncondensed/skills/||;s|/SKILL.md||')
  lines=$(wc -l < "$f"); echo "$lines | $name"
done | sort -rn | head -20
```

Report totals (always + auto + skills + AGENTS.md).

### 2. Check rules

- **Frontmatter**: every rule has `type: "always"` or `type: "auto"` with `description`.
- **Duplicate triggers**: same `description` → both rules load simultaneously (waste).
- **Redundancy**: a rule's content duplicated in AGENTS.md or a skill.
- **Merge candidates**: rules under 15 lines that belong inside a sibling rule.

```bash
for f in .agent-src.uncondensed/rules/*.md; do
  desc=$(head -5 "$f" | grep 'description:' | sed 's/.*"\(.*\)"/\1/')
  [ -n "$desc" ] && echo "$desc | $(basename "$f")"
done | sort | awk -F' \\| ' '{descs[$1]=descs[$1] " " $2} END {for (d in descs) {n=split(descs[d], a, " "); if (n>1) print "⚠️  " d " →" descs[d]}}'
```

### 3. Check `always` → `auto` candidates

Apply `rule-type-governance`:

1. Applies to EVERY conversation? → keep `always`.
2. Triggered by a specific topic? → candidate for `auto`.
3. Core behavior constraint (`scope-control`, `verify-before-complete`, `token-efficiency`, `commit-policy`, `non-destructive-by-default`)? → **NEVER change to auto**.

Surface candidates with explicit justification. Never auto-apply.

### 4. Check AGENTS.md — Thin-Root + Capability-over-Structure

Run the linter and inspect output:

```bash
python3 scripts/lint_agents_md.py
wc -c AGENTS.md
```

Then audit against the **Capability-over-Structure heuristic** (canonical:
[`agents-md-anatomy § Iron Law`](../../contexts/contracts/agents-md-anatomy.md#iron-law--capability-over-structure)):

- Every section answers a *what-the-agent-does* question, not *what-files-exist*.
- Path bullets without why-clauses ≥ 60 chars → flag for rewrite as capability bullets.
- Pointer ratio ≥ 0.40; emergency-triage block present and matches the canonical variant.

Failures route to `/agents optimize` — this command does **not** edit.

### 5. Check docs sync + stale references

```bash
python3 scripts/check_references.py
```

Confirm counts/lists in `.augment/contexts/augment-infrastructure.md` and
`docs/architecture.md` match the actual `.agent-src.uncondensed/` tree.

### 6. Run skill linter

```bash
python3 scripts/skill_linter.py --all --pairs --duplicates 2>&1 | grep "Summary:"
```

Report FAIL/WARN counts. Don't fix here — delegate to `skill-reviewer` or
`/optimize skills`.

### 7. Present findings

Single table, no auto-edits:

| # | Category | Finding | Impact | Suggested fix |
|---|---|---|---|---|
| 1 | Rule | `{name}` duplicate trigger | Both load simultaneously | Tighten `description` |
| 2 | Rule | `{name}` is `always` but topic-specific | ~{n} lines saved/chat | Switch to `auto` (with safety gate) |
| 3 | AGENTS.md | Path enumeration without why-clauses | Capability-over-Structure violation | Run `/agents optimize` |
| ... | | | | |

Then ask:

```
> 1. Walk through suggestions one at a time
> 2. Apply only high-impact changes (saves > 50 lines or fixes a FAIL)
> 3. Report only — no edits
```

## What this command does NOT do

- **No edits** — read-only audit. Fixes route to `/agents optimize`,
  `skill-reviewer`, or `/optimize skills`.
- **No edits to `.agent-src/` or `.augment/`** — those regenerate from
  `.agent-src.uncondensed/`. Edit the source.
- **No `agents/` folder ops** — scaffolding, folder-audit, folder-cleanup
  live in `/optimize agents-dir`.
- **No commits, no push, no PR** — finishing the audit is a user decision
  per [`commit-policy`](../../rules/commit-policy.md).

## See also

- [`agents-md-thin-root`](../../skills/agents-md-thin-root/SKILL.md) — caps, pointer-ratio, anatomy.
- [`agents-md-anatomy`](../../contexts/contracts/agents-md-anatomy.md) — Iron Law, Capability-over-Structure heuristic.
- [`rule-type-governance`](../../rules/rule-type-governance.md) — `always` vs `auto` decision rules.
- [`/agents optimize`](optimize.md) — apply Thin-Root contract fixes.
- [`/optimize agents-dir`](../optimize/agents-dir.md) — `agents/` folder operations (Phase 3).
