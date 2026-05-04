---
type: "auto"
description: "When routing reviewers or flagging risk hotspots — consult ownership-map and historical-bug-patterns before suggesting reviewers or claiming a change is safe"
source: package
load_context:
  - .agent-src.uncompressed/contexts/communication/rules-auto/review-routing-awareness-mechanics.md
---

# Review Routing Awareness

Before suggesting reviewers or declaring a change safe, the agent consults
two project-local data sources — if they exist — to ground the routing in
the consumer's actual organizational memory:

1. **Ownership map** — which roles/teams own which paths, with per-path
   risk notes.
2. **Historical bug patterns** — recurring failure modes or technical debt
   the project has paid for before.

Both live in the consumer repository (never in package-shipped files) and
are optional. Absence is not an error — the agent falls back to
generic, role-based suggestions from [`reviewer-awareness`](reviewer-awareness.md).

## When this rule applies

- The agent is classifying PR risk, suggesting reviewers, writing a PR
  description, or producing a review plan.
- The agent is reviewing its own diff before asking for human review.
- The change modifies more than a trivial amount of code (≥ 1 file
  outside docs).

## Required behavior

### 1. Check for project data

Look, in order, for:

- `.github/ownership-map.yml` (or `agents/ownership-map.yml`)
- `.github/historical-bug-patterns.yml` (or
  `agents/historical-bug-patterns.yml`)

If neither file exists, fall back to the engineering-memory layer.
Memory-lookup snippet and merge semantics live in
[`contexts/communication/rules-auto/review-routing-awareness-mechanics.md`](../contexts/communication/rules-auto/review-routing-awareness-mechanics.md)
§ Memory-lookup fallback. If both memory and project YAMLs are absent,
skip this rule and rely on
[`reviewer-awareness`](reviewer-awareness.md) defaults. **Do not
invent owners or patterns** from context.

### 2. Match the diff

For every changed file, collect:

- **Matching ownership entries** — each yields a role, optional focus
  note, and optional risk hint.
- **Matching historical patterns** — each yields a named prior failure
  mode and the minimum control or test the project expects.

Matching uses glob patterns (see
[`review-routing-data-format`](../../docs/guidelines/agent-infra/review-routing-data-format.md)
for the schema).

### 3. Surface findings

When producing a review plan, include owner-mapped roles (preferred
over generic), historical-pattern warnings (with required control),
and a staleness note if the ownership map's `updated` field is older
than 6 months. Worked examples for each in
[`contexts/communication/rules-auto/review-routing-awareness-mechanics.md`](../contexts/communication/rules-auto/review-routing-awareness-mechanics.md)
§ Surface findings.

### 4. Do NOT overreach

The "do NOT overreach" guardrails (no path renames as side effects, no
"safe because no match", no pattern names in diffs/commits) live in
[`contexts/communication/rules-auto/review-routing-awareness-mechanics.md`](../contexts/communication/rules-auto/review-routing-awareness-mechanics.md)
§ Do NOT overreach.

## Interaction with other rules

- Feeds [`reviewer-awareness`](reviewer-awareness.md) — this rule
  **resolves** owners; reviewer-awareness **formats** them.
- Extends [`verify-before-complete`](verify-before-complete.md) — if a
  historical pattern demands a regression test, the verification gate
  requires that test before completion is claimed.
- Does not override [`minimal-safe-diff`](minimal-safe-diff.md) — a
  matched pattern is a reason to **add a test**, never a reason to
  expand scope into unrelated refactors.

## Anti-patterns

The four anti-pattern rejections (invented owners, invented patterns,
downgrading high-severity hits, treating stale maps as absent) live in
[`contexts/communication/rules-auto/review-routing-awareness-mechanics.md`](../contexts/communication/rules-auto/review-routing-awareness-mechanics.md)
§ Anti-patterns.

## See also

- [`reviewer-awareness`](reviewer-awareness.md) — formatting reviewer
  suggestions.
- [`review-routing-data-format`](../../docs/guidelines/agent-infra/review-routing-data-format.md)
  — YAML schemas for ownership-map and historical-bug-patterns.
- [`review-routing`](../skills/review-routing/SKILL.md) — the skill
  that produces the merged routing report.
- [`judge-test-coverage`](../skills/judge-test-coverage/SKILL.md) —
  consumes the "required test" output from historical patterns.
