# Buried roadmap blockers — decisions the archive swallowed

Durable home for six maintainer/user decisions that were raised by a roadmap,
never answered, and then left the active tree when their roadmap archived on
step-count alone. The archival sweep gated only on `count_open == 0 &&
count_deferred == 0`, so a roadmap whose every box was `[x]` archived while a
`Status: open` blocker was still sitting in it. That is now a refusal condition
in `archive_completed_roadmaps.ts`, but the guard cannot reach backwards — these
six were already gone.

The cost is measured, not hypothetical. `b-highlights-mechanism` below asked
whether a surviving `_auto-derived, rewrite before merge:_` head should hard-block
a release. It archived unanswered in the 9.29 roadmap. Four releases later the
placeholder shipped into the released `## [9.36.0]` head (`CHANGELOG.md:347`,
PR #1297), which is exactly the failure the blocker existed to force a decision
about — and which four of five independent reviews of the 9.30→9.35 span
predicted in writing.

## The six

| Roadmap (archived) | Blocker | Owner | State as verified 2026-08-12 |
|---|---|---|---|
| `road-to-feedback-9-29.md` | `b-highlights-mechanism` | maintainer | **Superseded, not resolved** — the same question is live as `release-head-cadence-decision` on the active `road-to-inbox-harvest-2026-08-b-release-integrity.md` (blocking its step 1.4). Answer it there. |
| `road-to-feedback-9-29.md` | `b-launch` | user | Unverified. Posting the conformance-arc launch story is an irreversible external action; the stated utilization window has since passed. |
| `road-to-feedback-9-29.md` | `b-council-posture` | maintainer | Unverified — not re-derived this pass. |
| `road-to-feedback-9-29.md` | `b-runtime-consolidation` | maintainer | Unverified — plausibly overlaps `b-runtime-state-machine` in `road-to-feedback-9-35.md`, which asks whether consolidating existing runtime guards counts as new governance surface. |
| `road-to-feedback-8.11.md` | `council-baseline-spend-authorization` | (unstated) | Unverified — plausibly overlaps `b-benchmark-spend` in `road-to-feedback-9-35.md` (the frozen-corpus run is still unauthorized). |
| `road-to-feedback-8.11-2.md` | `branch-protection-apply` | user | **Likely resolved** — `gh api repos/…/rulesets` reports an active `main protection` ruleset. Recorded as likely rather than confirmed: the ruleset's existence was verified, its contents were not compared against what the blocker asked for. |

"Unverified" is the honest label for four of six. This file exists to make them
findable, not to close them — re-deriving four archived decisions was outside the
scope of the pass that found them, and claiming otherwise would be the same
overclaim the guard was built to prevent.

## What the guard does and does not catch

`archive_completed_roadmaps.ts` refuses to archive a complete roadmap when
`stats.open_blockers` is non-empty, and names the roadmap plus the blocker ids on
stderr. Two limits, both real:

- **Format-bound.** Detection needs the current shape — a `### blocker: <id>`
  heading with a `- **Status:** …` field. The two 8.11 entries above use an older
  single-line form (`- **blocker: id** — Status: open · Owner: user ·`) that the
  parser does not see at all, so the guard would not have held those two
  roadmaps. Migrating legacy blockers is not attempted here; the pattern is
  recorded so a future reader does not mistake guard silence for absence.
- **It refuses, it does not decide.** A roadmap carrying a long-lived decision
  now stays in the active tree until the decision is made. That is the intent,
  and it is also a growth pressure on the active set — if it starts holding
  roadmaps for months, the shape to revisit is surface-and-acknowledge rather
  than refuse.

## See also

- `src/agent-src/scripts/archive_completed_roadmaps.ts` — the guard.
- The `b-runtime-state-machine` and `b-benchmark-spend` blockers noted above are
  live in the active roadmap set; find them by blocker id in
  `agents/roadmaps-progress.md`, which is the stable index. Deliberately not
  linked by path: this file outlives any single roadmap, and a stable artefact
  citing a transient one is what `no-roadmap-references` forbids — the gate
  caught exactly that here.
- `roadmap-progress-sync` Iron Law 3 — the same discipline for `[~]` steps, which
  is the rule this guard extends from deferred steps to open decisions.
