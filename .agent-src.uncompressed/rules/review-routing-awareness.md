---
type: "auto"
description: "When routing reviewers or flagging risk hotspots — consult ownership-map and historical-bug-patterns before suggesting reviewers or claiming a change is safe"
source: package
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

If neither file exists, fall back to the engineering-memory layer via
[`memory-access`](../guidelines/agent-infra/memory-access.md):

```python
from scripts.memory_lookup import retrieve
extra = retrieve(
    types=["ownership", "historical-patterns"],
    keys=<changed file paths>,
    limit=5,
)
```

Curated memory (`agents/memory/ownership.yml`,
`agents/memory/historical-patterns.yml`) carries the same schema as the
project-local YAMLs and is merged into the routing output alongside
them. If both memory and project YAMLs are absent, skip this rule and
rely on [`reviewer-awareness`](reviewer-awareness.md) defaults. **Do
not invent owners or patterns** from context.

### 2. Match the diff

For every changed file, collect:

- **Matching ownership entries** — each yields a role, optional focus
  note, and optional risk hint.
- **Matching historical patterns** — each yields a named prior failure
  mode and the minimum control or test the project expects.

Matching uses glob patterns (see
[`review-routing-data-format`](../guidelines/review-routing-data-format.md)
for the schema).

### 3. Surface findings

When producing a review plan, include:

- **Owner-mapped roles** — explicitly preferred over generic roles. If
  the ownership map says `app/Billing/**` is owned by `finance-engineering
  + security`, use those, not "backend + security".
- **Historical-pattern warnings** — list every matched pattern with a
  short label and the required control, e.g. _"Pattern: N+1 on tenant
  listings → add an eager-load regression test"_.
- **Confidence note** — if the ownership map is stale (last updated > 6
  months ago per the `updated` field), say so. Ownership maps rot.

### 4. Do NOT overreach

- **Never rename paths** or add ownership entries as a side effect of a
  code change. Ownership map edits are a separate, explicit task.
- **Never mark a change safe** only because no pattern matched. Pattern
  absence means "no known hit", not "no risk".
- **Never copy historical-pattern names into the diff** as code comments
  or commit messages — they are routing metadata, not commentary.

## Interaction with other rules

- Feeds [`reviewer-awareness`](reviewer-awareness.md) — this rule
  **resolves** owners; reviewer-awareness **formats** them.
- Extends [`verify-before-complete`](verify-before-complete.md) — if a
  historical pattern demands a regression test, the verification gate
  requires that test before completion is claimed.
- Does not override [`minimal-safe-diff`](minimal-safe-diff.md) — a
  matched pattern is a reason to **add a test**, never a reason to
  expand scope into unrelated refactors.

## Anti-patterns — reject them

- Suggesting owners "because this looks like billing code" without
  consulting the ownership map when one exists.
- Inventing historical patterns from general knowledge — patterns must
  come from the project's own registry.
- Downgrading a matched high-severity pattern because "the author said
  it's fine" — the pattern was registered because it bit before.
- Treating an out-of-date map as absent. Flag staleness; do not silently
  skip.

## See also

- [`reviewer-awareness`](reviewer-awareness.md) — formatting reviewer
  suggestions.
- [`review-routing-data-format`](../guidelines/review-routing-data-format.md)
  — YAML schemas for ownership-map and historical-bug-patterns.
- [`review-routing`](../skills/review-routing/SKILL.md) — the skill
  that produces the merged routing report.
- [`judge-test-coverage`](../skills/judge-test-coverage/SKILL.md) —
  consumes the "required test" output from historical patterns.
