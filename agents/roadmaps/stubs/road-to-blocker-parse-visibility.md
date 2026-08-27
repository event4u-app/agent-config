---
complexity: lightweight
review_by: 2026-12-27
---

# Stub: road to a blocker the parser can actually see

> **Stub — not active work.** Found 2026-08-27 while landing
> `road-to-undeclared-obligation-disposition`, when the dashboard reported that
> roadmap's blocker column as `0` and the roadmap plainly had a blocker. Two of
> the six instances were repaired in that change because they were its own; the
> rest and the gate defect behind them are recorded here rather than fixed
> drive-by.

## The defect

`update_roadmap_progress.ts:439` reads blocker headings with

```
BLOCKER_HEADING_RE = /^###[ \t]+blocker:[ \t]*(.+?)[ \t]*$/gim
```

The literal `blocker:` prefix is **required**. A section written as
`### <id>` under a correct `## Blockers` heading parses to nothing — the
roadmap reports zero blockers, and every consumer downstream of the parser
agrees with it.

## Three consequences, in rising order of cost

1. **The dashboard under-reports.** A roadmap with real, open, owner-assigned
   blockers shows `0` in the blockers column and no anchor section.
2. **`check_estate_count`'s `open_blockers` metric is an undercount**, and it is
   a **ratcheted** metric measured against an exact base-ref floor. The gate's
   own header notes that a quality anchor is phrased on it. A ratchet running on
   a number that silently omits an unknown share of the population is measuring
   something other than what it claims.
3. **`lint_roadmap_blockers` reports the affected file clean.** It validates the
   per-blocker contract for each blocker it parses; a file whose blockers all
   parse to nothing has zero to validate and passes vacuously. Verified
   2026-08-27: the linter printed `blocker-contract-clean` for
   `road-to-undeclared-obligation-disposition.md` while that roadmap's blocker
   was invisible. This is the "a gate that scans nothing exits green" shape this
   tree has recorded before, arriving through the blocker door.

## Measured instances at `612b817`

`grep -rn '^### ' agents/roadmaps/*.md | grep -v '### blocker:'` returns six
headings that sit under a `## Blockers` section without the prefix, across five
files:

| File | Heading | Disposition |
|---|---|---|
| `road-to-composition-before-creation.md` | `disposition-vocabulary-authority` | **repaired 2026-08-27** — own file, in the same change |
| `road-to-undeclared-obligation-disposition.md` | `is-a-declaration-worth-anything` | **repaired 2026-08-27** — own file, in the same change |
| `road-to-consolidation-lineage-integrity.md` | `lineage-check-enforcement-surface` | **not touched** — open PR #1682 completes and archives this file; editing it here would conflict with a run already under way |
| `road-to-governed-harness-evolution.md` | `merge-authority` | not touched — `status: draft`, and drafts are excluded from `collect()` so the metric is unaffected today; it becomes a live undercount the moment the file is promoted |
| `road-to-experience-loop-broadening.md` | `runtime-consumption-of-experience`, `experience-retention-policy` | same, two headings |

Other `### ` headings in the estate (`Council convergence`, phase sub-headings)
are outside a `## Blockers` section and are not instances.

## What would close this

- Repair the remaining four headings, each in a change that already touches its
  file — never as a sweep across roadmaps with open owner decisions.
- Make `lint_roadmap_blockers` refuse a vacuous pass: a file carrying a
  `## Blockers` section whose parsed blocker count is zero is a finding, not a
  clean bill. That is the half worth building, because it turns a silent class
  into a reported one and it is the only change here that prevents recurrence.
- Decide whether `open_blockers`' floor should be re-measured after the repairs.
  It will rise, and the rise is a correction rather than growth — which is a
  distinction the estate gate has no way to express today, so it needs a stated
  reason in whatever change lands it.

## What this stub deliberately does not do

Propose loosening the regex to accept a bare `### <id>`. Every `###` heading
inside `## Blockers` would then be a blocker, including prose sub-headings, and
the failure would invert from silent-undercount to silent-overcount. The prefix
is a reasonable contract; the defect is that nothing reports its violation.
