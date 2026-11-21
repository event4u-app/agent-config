<!-- evidence-type: analysis -->

# Owner directive — roadmaps for every measure of the 2026-11-21 session retro

| Field | Value |
|---|---|
| Ordered by | the repository owner, in chat |
| Date | 2026-11-21 |
| Scope | the 21 roadmaps listed below, added as active roadmaps above the WIP cap of 25 (`WIP_CAP` in `src/scripts/_lib/estate_wip.ts`) |
| Grants by itself | that these 21 additions may be exempted from one-in-one-out and the WIP cap; it lowers no test, CI gate or Hard-Floor obligation, and it decides none of the owner blockers the roadmaps carry |

Owner, verbatim, after the session retrospective of 2026-11-21 (about 380 Claude
Code sessions, 643 extracted incidents):

> erstelle Roadmaps für die P0-Maßnahmen und auch für die anderen (P1 - aber nichts per Hand peflegt, gerne per command, aber kein User geschriebener Context, etc.). Lass uns alle Learnings einplanen und abarbeiten <!-- md-language-check: ignore -->

Translated: "create roadmaps for the P0 measures and for the others too (P1 — but
nothing maintained by hand, by command is fine, but no user-written context,
etc.). Let us plan and work off all the learnings."

## What it authorises

1. **One roadmap per retro measure, all active.** The additions below are the
   owner's order, not an agent's proposal. Each may carry
   `estate_offset_exempt` and `estate_growth_exempt` reasons that cite this
   record, so `check_estate_count` honours them above the WIP cap:
   - `road-to-a-language-pin-from-owner-prose`
   - `road-to-a-learning-pipeline-that-yields-lessons`
   - `road-to-a-lite-profile-pilot`
   - `road-to-a-release-cut-without-a-review-gate`
   - `road-to-a-static-context-under-budget`
   - `road-to-a-worktree-that-boots-ready`
   - `road-to-an-episode-ledger-with-cost-per-control`
   - `road-to-ci-findings-in-one-run`
   - `road-to-defaults-on-after-pilot`
   - `road-to-done-claims-with-read-exit-codes`
   - `road-to-gates-that-do-not-trap-the-agent`
   - `road-to-honest-graph-freshness`
   - `road-to-mandates-scoped-to-the-goal`
   - `road-to-questions-that-reach-the-right-decider`
   - `road-to-repo-knowledge-generated-not-written`
   - `road-to-resume-after-limit-hits`
   - `road-to-review-loops-that-converge`
   - `road-to-settings-and-profiles-in-sync`
   - `road-to-shared-task-identity-across-sessions`
   - `road-to-stop-hooks-that-count-own-edits`
   - `road-to-ui-fixes-that-measure-first`
2. **The owner constraint binds every one of them.** No step may ask for
   hand-maintained or owner-written context. Knowledge is produced by a command,
   a hook or a generator.

## What it does not change

- The WIP cap stays 25 for every later addition. This record names these 21
  slugs and no others.
- Every owner blocker inside these roadmaps stays open until the owner answers
  it. This record answers none of them.
- Spend, Hard-Floor actions and kernel-rule edits keep their own gates.

## Undo

Park or archive any of the 21 roadmaps. The exemption then has nothing left to
cover, and the WIP cap applies again as written.
