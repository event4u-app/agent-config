# Command-category governance — Phase-2 hand-off

> **Status:** hand-off stub. The `category:` lint (positioning roadmap "step 7b")
> was **re-cut from Phase 0 to Phase 2** per AI-council convergence
> (claude-sonnet-4-5 + gpt-4o, 2026-06-09): it is product/governance judgment,
> not a CI-plumbing guardrail, and it should follow the Phase-2 **ownership map**
> rather than bottleneck on one architect making 125 calls. This doc is the
> bridge so the decision is not relitigated.

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
