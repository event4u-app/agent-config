# Review Routing Awareness — mechanics

Memory-lookup snippet, "do NOT overreach" guardrails, and anti-pattern
catalog for the
[`review-routing-awareness`](../../../rules/review-routing-awareness.md)
rule. The four required-behavior steps and the "when this rule applies"
trigger live in the rule; this file is the lookup material for the
fallback path and the failure-mode list.

## Memory-lookup fallback

If neither `.github/ownership-map.yml` (or `agents/ownership-map.yml`)
nor `.github/historical-bug-patterns.yml` (or
`agents/historical-bug-patterns.yml`) exists, fall back to the
engineering-memory layer via
[`memory-access`](../../../../docs/guidelines/agent-infra/memory-access.md):

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
them. If both memory and project YAMLs are absent, skip the rule and
rely on [`reviewer-awareness`](../../../rules/reviewer-awareness.md)
defaults. **Do not invent owners or patterns** from context.

## Surface findings — worked examples

When producing a review plan, include:

- **Owner-mapped roles** — explicitly preferred over generic roles. If
  the ownership map says `app/Billing/**` is owned by `finance-engineering
  + security`, use those, not "backend + security".
- **Historical-pattern warnings** — list every matched pattern with a
  short label and the required control, e.g. _"Pattern: N+1 on tenant
  listings → add an eager-load regression test"_.
- **Confidence note** — if the ownership map is stale (last updated > 6
  months ago per the `updated` field), say so. Ownership maps rot.

## Do NOT overreach

- **Never rename paths** or add ownership entries as a side effect of a
  code change. Ownership map edits are a separate, explicit task.
- **Never mark a change safe** only because no pattern matched. Pattern
  absence means "no known hit", not "no risk".
- **Never copy historical-pattern names into the diff** as code comments
  or commit messages — they are routing metadata, not commentary.

## Anti-patterns — reject them

- Suggesting owners "because this looks like billing code" without
  consulting the ownership map when one exists.
- Inventing historical patterns from general knowledge — patterns must
  come from the project's own registry.
- Downgrading a matched high-severity pattern because "the author said
  it's fine" — the pattern was registered because it bit before.
- Treating an out-of-date map as absent. Flag staleness; do not silently
  skip.
