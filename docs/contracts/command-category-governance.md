# Command-category governance

> **Status (2026-06-09):** Phase-2b resolved as **Option 1 (light)** — an
> AI-council tie-break (claude-sonnet-4-5 + gpt-4o) chose light over a
> full/blocking lint, decisively: no consumer reads `category:` today, so
> populating all 54 + blocking CI is "supply without demand" (YAGNI), and a
> blocking gate on a 15%-ambiguous taxonomy enforces *presence, not correctness*
> — mis-calls made under CI pressure surface later as a re-categorization pass
> ("pays the cost twice"). What shipped, and the upgrade trigger, are below.

## Shipped (Option 1 — light)

- **`category:` defined** as an OPTIONAL enum in `command.schema.json`
  (`flow-entry | state-query | product-surface`), **validate-when-present** —
  a declared value must be a valid enum; absence is fine. (Note: the 150
  `src/domains/**/command.md` files are not yet full-schema-validated — a
  pre-existing gap, separate from this field; the enum bites wherever
  command-schema validation runs / when a consumer reads it.)
- **Creation-time checklist** in the [`command-writing`](../../src/skills/command-writing/SKILL.md)
  skill: categorize a NEW top-level command at authoring; fits-none → it's a
  skill; genuinely ambiguous → omit `category:` and note why (intentionally
  deferred, not forgotten). Sub-commands inherit the parent cluster's category.

## Deferred — until the upgrade trigger fires

**Full categorization of all 54 top-level commands + a blocking lint + the
demotion of fits-none commands** are deferred. **Upgrade trigger:** a **merged
consumer PR** — runnable code that *reads* `category:` (routing, analytics, a
catalog/discovery grouping, a "daily five" surface). A design doc is not the
trigger; running code that breaks on miscategorization is. When it lands,
population + enforcement land together in one focused PR, with the consumer's
requirements defining the ambiguous categories unambiguously.

## The schema (to introduce in Phase 2)

Every **visible** command (`suggestion.eligible: true`) declares one
`category:` in its frontmatter, per [`ADR-048`](../decisions/ADR-048-command-justification-rule.md):

```yaml
category: flow-entry | state-query | product-surface
```

- **flow-entry** — a daily starting point the user TYPES to begin work
  (`work`, `git-commit`, `review-changes`, `fix-ci`, …).
- **state-query** — a read-only check typed many times a day
  (`agent-status`, `project-health`, `profile-show`, …).
- **product-surface** — a feature the user starts deliberately
  (`council`, `challenge-me`, `research`, `roadmap`, `video-storyboard`).

A command that fits **none** is, per ADR-048, a **skill** — so the lint doubles
as a demotion signal. That demotion is a product-surface change and is exactly
why this belongs in Phase 2 (own → age → contract), not a Phase-0 guardrail.

## Inventory at hand-off (2026-06-09)

- **150** command files (`find src/domains -name command.md`).
- **125** are visible (`suggestion.eligible: true`) → the categorization set.
- **0** currently carry a `category:` field.

So Phase 2 must: (1) add the `category:` schema to the frontmatter contract +
validator; (2) categorize the 125 visible commands (a per-command judgment under
ADR-048, ideally after the Phase-2 ownership map assigns owners); (3) decide the
demotion path for any command that fits none; (4) ship the `category:` lint as a
blocking gate once the field is populated (start non-blocking/warn to avoid a
flag-day, then flip).

## Phase-0 closure

Phase 0 closes on **step 7a** (the dead-doc-path CI guardrail —
`check_references.py` extended to `docs/` + `src/`, with tests) **plus this
hand-off**. The two guardrails guard orthogonal properties (path integrity vs
command-surface justification), so shipping 7a without 7b creates no false
confidence about command categorization.

## See also

- [`ADR-048`](../decisions/ADR-048-command-justification-rule.md) — the three-category contract.
- [`command-clusters.md`](command-clusters.md) — the command-justification section ADR-048 locks.
- Positioning roadmap Phase 2 — where the `category:` lint now lands.
