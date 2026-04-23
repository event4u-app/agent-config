# Skill Description Audit — Baseline

> **Date:** 2026-04-21
> **Tool:** [`scripts/audit_skill_descriptions.py`](../../scripts/audit_skill_descriptions.py)
> **Source roadmap:** [`agents/roadmaps/archive/road-to-anthropic-alignment.md`](../roadmaps/archive/road-to-anthropic-alignment.md) Phase 2.2 (archived 2026-04-21)
> **Pattern source:** [`skills/skill-creator` in `anthropics/skills`](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)

## Snapshot

| Metric | Value |
|---|---|
| Skills audited | 100 |
| Clean (no flags) | 40 |
| Flagged | 60 |
| Dominant flag | `too-short` (length < 150 chars) — 60 occurrences |
| Other flags | `very-short` (<80 chars): 0 · `no-trigger-prefix`: 0 · `hedge:*`: 0 |

Zero descriptions miss an explicit trigger-verb prefix, and zero contain known
hedge phrases. This is good — the weakness is length/density, not shape.

## What "too-short" means here

The threshold `< 150 chars` is the one in the roadmap, taken directly from
anthropics/skills — long enough to list two concrete triggers plus context.
A skill flagged as `too-short` is not wrong; it is just **unambitious** and
likely to lose to a longer peer when Claude picks between overlapping skills.

A pushy 150-char description looks like this:

> `"Use when writing Playwright E2E tests — locators, assertions, Page Objects, fixtures, CI, and flaky test prevention — even if the user doesn't say Playwright."`

Same skill today:

> `"Use when writing Playwright E2E tests — browser automation, visual regression testing, Page Objects, fixtures, and reliable test patterns."` (138 chars)

The first names a second trigger class (*CI, flaky tests*) and adds the
"even if not explicitly asked" tail. The second is polite and gets undercut
when a user types *"my E2E keeps flaking on CI"*.

## Top 15 worst-scoring skills (re-write candidates)

Pulled from `python3 scripts/audit_skill_descriptions.py` on 2026-04-21.
Score = 20 per `too-short`, 10 per `very-short`, 30 per `no-trigger-prefix`,
10 per hedge.

| # | Skill | Len | Flags |
|---|---|---|---|
| 1 | `conventional-commits-writing` | 98 | too-short |
| 2 | `analysis-skill-router` | 110 | too-short |
| 3 | `git-workflow` | 113 | too-short |
| 4 | `api-design` | 124 | too-short |
| 5 | `github-ci` | 127 | too-short |
| 6 | `devcontainer` | 129 | too-short |
| 7 | `analysis-autonomous-mode` | 132 | too-short |
| 8 | `feature-planning` | 132 | too-short |
| 9 | `context-document` | 135 | too-short |
| 10 | `file-editor` | 135 | too-short |
| 11 | `aws-infrastructure` | 136 | too-short |
| 12 | `database` | 136 | too-short |
| 13 | `blade-ui` | 141 | too-short |
| 14 | `adversarial-review` | 144 | too-short |
| 15 | `api-testing` | 145 | too-short |

(Run `--full` for the complete 60-row list.)

## Rewrite strategy

Per the roadmap:

- **Do not rewrite all 60 at once.** Incremental, reviewable, reversible.
- **Rewrite the top 10–15 in small PRs (3–5 skills each).**
- **Re-run the audit after each batch.** The score and length shift are the
  signal that the rewrite actually helped.
- **Trigger-eval follow-up** (see [`archive/road-to-trigger-evals.md`](../roadmaps/archive/road-to-trigger-evals.md))
  will measure whether rewrites actually change Claude's routing behavior.

The 40 currently-clean skills stay clean by default — no churn.

## Reproducing this snapshot

```bash
# Table of the worst 15 (what you see above):
python3 scripts/audit_skill_descriptions.py

# All 60 flagged:
python3 scripts/audit_skill_descriptions.py --full

# Machine-readable:
python3 scripts/audit_skill_descriptions.py --json > /tmp/audit.json

# Audit a different tree (e.g. compressed):
python3 scripts/audit_skill_descriptions.py --root .agent-src/skills
```

## Progress log

Rewrites land incrementally on feature branches. Audit re-runs capture the
shift in the flagged count. History so far:

| Date | Branch | Batches | Skills rewritten | Flagged before → after |
|---|---|---|---|---|
| 2026-04-21 | `feat/pushy-descriptions` | 2a / 2b / 2c | 9 | 60 → 47 |
| 2026-04-21 | `feat/improve-agent-setup-8` | 3a–3e | 15 | 47 → 33 |

**Deliberately skipped (not candidates for the pushy pattern):**

- `performance-analysis`, `security-audit`, `adversarial-review`,
  `analysis-autonomous-mode`, `sequential-thinking`, `universal-project-analysis`
  — all use the intentional `"ONLY when user explicitly requests:"` prefix
  and are opt-in by design. A pushy rewrite would cause over-triggering on
  normal feature work.

## What's next

- Phase 2.3 of the roadmap: the `skill-writing` skill now carries a canonical
  before/after example based on one of the rewrites.
- Subsequent PRs: pick 3–5 rows from the remaining flagged list, rewrite their
  `SKILL.md` description, re-run the audit, verify the row drops off.
- Do **not** rewrite to exactly 150 chars to "pass" the flag — the goal is
  two concrete triggers plus the "even if not explicitly asked" tail, not
  a character count.
- Trigger-eval follow-up (see [`archive/road-to-trigger-evals.md`](../roadmaps/archive/road-to-trigger-evals.md))
  will measure whether these rewrites actually change Claude's routing
  behavior.

## Related

- Rule: [`rules/skill-quality.md`](../../.agent-src.uncompressed/rules/skill-quality.md)
  § *Description Triggering*.
- Parent analysis: [`compare-anthropics-skills.md`](compare-anthropics-skills.md).
- Follow-up roadmap: [`archive/road-to-trigger-evals.md`](../roadmaps/archive/road-to-trigger-evals.md).
