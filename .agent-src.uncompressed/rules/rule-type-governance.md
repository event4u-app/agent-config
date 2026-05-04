---
type: "auto"
tier: "2a"
description: "Creating or editing rules, or auditing rule types — decides when a rule should be always vs auto"
alwaysApply: false
source: package
---

# rule-type-governance

## `always` = loaded every conversation

Use ONLY when the rule applies to virtually every interaction:

- Universal agent behavior (language, tone, interaction style)
- Safety constraints (scope control, verification before completion)
- Token/efficiency constraints
- First-message checks that cannot wait for auto-trigger

## `auto` = loaded on demand by description match

Use for everything else:

- Language-specific rules (PHP, JS, SQL)
- Tool-specific rules (Docker, Git, quality tools)
- Workflow-specific rules (commands, skill creation, E2E testing)
- Domain-specific rules (translations, architecture)

## Decision test

> "Does this rule need to be active when the user asks a simple question, reviews a PR, or discusses architecture?"

- Yes → `always`
- No → `auto` with a clear trigger description

## Auto description quality

The `description` field IS the trigger. It must describe **when** the rule applies, not **what** it contains.

- ❌  `"PHP coding standards"` — too vague, won't match reliably
- ✅  `"Writing or reviewing PHP code — strict types, naming, Eloquent conventions"`

## Hard constraint

- Default to `auto`. Justify `always`.
- If >50% of conversations don't need a rule → it must be `auto`.
- `optimize-agents` command checks this and suggests changes.

## Hardening tier — required on new or edited rules

Every new rule, and every edited rule whose body changes the trigger
or the obligation, MUST classify itself against the hardening tiers
documented in [`rule-trigger-matrix.md`](../../agents/contexts/rule-trigger-matrix.md):

| Tier | Meaning |
|---|---|
| `1` | Mechanically enforceable — hook acts, rule body stays minimal. |
| `2a` | Marker nudge — hook injects signal, agent acts on it. |
| `2b` | Structured injection / tool-call gate — hook reads/writes state, may deny. |
| `3` | Soft, judgment-bound — no platform surface; self-check rule. |
| `safety-floor` | Iron-Law subset, never modified. |
| `mechanical-already` | Precedent — script enforces, rule body documents. |

Classification surface: the optional `tier:` frontmatter field
(declared in `scripts/schemas/rule.schema.json`). Recommended for new
rules; bulk-retrofit of existing rules is tracked separately.

Tier 3 dispositions are recorded centrally in
[`agents/contexts/tier-3-dispositions.md`](../../agents/contexts/tier-3-dispositions.md)
with a 6-month re-audit clock. New Tier 3 rules append to that list
on landing.

The `optimize-agents` command checks the tier alongside `type`/`source`
and suggests escalations when a rule's trigger matches a hardening
opportunity that has shipped since the rule was authored.
