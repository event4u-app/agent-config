---
name: review-routing
skills: [review-routing, reviewer-awareness, review-routing-awareness]
description: Compute reviewer roles and matched historical bug patterns for the current diff, using project-local ownership-map.yml and historical-bug-patterns.yml
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "who should review this, suggest reviewers for this PR"
  trigger_context: "PR open without assigned reviewers"
---

# review-routing

## Instructions

Produce a review-routing block for the current diff — owner-mapped
reviewer roles plus any matched historical bug patterns — so the author
knows *who* to request and *what* to test before opening a PR.

Dispatches to [`review-routing`](../skills/review-routing/SKILL.md) for
the core resolution logic. The rules
[`reviewer-awareness`](../rules/reviewer-awareness.md) and
[`review-routing-awareness`](../rules/review-routing-awareness.md) govern
the output format and data handling.

### 1. Gather the diff

- **Default** — use `git diff --name-only origin/main...HEAD` (or the
  configured trunk branch from `.agent-settings.yml`).
- **Explicit** — if the user provides a base and head ref, honour them.
- **Empty diff** — stop with _"no changes, routing skipped"_.

### 2. Dispatch to the skill

Invoke [`review-routing`](../skills/review-routing/SKILL.md) with the
changed-file list. The skill:

1. Loads `ownership-map.yml` and `historical-bug-patterns.yml` (both
   optional, package-agnostic paths).
2. Matches every file against ownership globs (first match wins).
3. Walks every pattern against the diff.
4. Computes overall severity (`high` wins).
5. Returns the structured block.

If neither data file exists, the skill returns the generic fallback
from [`reviewer-awareness`](../rules/reviewer-awareness.md). That is
valid output — do not invent owners.

### 3. Present the result

Paste the skill's structured block verbatim under a short header:

```
## Review Routing (from project data)
```

Append, if present:

- **Staleness warning** — ownership map > 6 months old.
- **Required tests** — extracted from matched historical patterns, as a
  follow-up checklist the author must honour before claiming completion
  ([`verify-before-complete`](../rules/verify-before-complete.md)).

### 4. Decide next step

After the block, ask:

```
> 1. Add this routing block to my PR description
> 2. Request these reviewers now (via gh / GitLab CLI)
> 3. Re-run after I update the ownership map
> 4. Stop here — routing block is the deliverable
```

- On **1**: hand off to
  [`create-pr-description`](../skills/create-pr:description-only/SKILL.md).
- On **2**: respect CODEOWNERS — request the *roles* resolved to people
  by the consumer's own mapping, never invent usernames.
- On **3**: the user wants to curate the map first. Stop.
- On **4**: save the block, stop.

## Use this command when

- About to open a PR and unsure who should review it.
- Preparing a PR description and want owner-mapped reviewers in it.
- Running a sanity check against historical patterns before claiming
  completion.
- CI needs the routing block for a sticky PR comment.

## Do NOT

- NEVER invent owners for paths not in the ownership map — use the
  generic fallback and say so.
- NEVER emit individual GitHub usernames in the routing block; the
  block contains **roles**, CODEOWNERS contains **people**.
- NEVER downgrade a historical-pattern match because "the author said
  it's fine" — pattern severity is set in the YAML, not negotiated per
  PR.
- NEVER modify `ownership-map.yml` or `historical-bug-patterns.yml` as
  a side effect of this command.
- NEVER run this command on a PR with zero changed files — it produces
  meaningless noise.

## See also

- [`review-routing`](../skills/review-routing/SKILL.md) — the resolver
- [`reviewer-awareness`](../rules/reviewer-awareness.md) — role vocabulary
- [`review-routing-awareness`](../rules/review-routing-awareness.md) —
  data-source rules
- [`review-routing-data-format`](../../docs/guidelines/agent-infra/review-routing-data-format.md)
  — YAML schemas
- [`create-pr-description`](../skills/create-pr:description-only/SKILL.md) —
  consumes the routing block
- [`verify-before-complete`](../rules/verify-before-complete.md) —
  consumes the `required_test` list
