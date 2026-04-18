---
type: "auto"
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
