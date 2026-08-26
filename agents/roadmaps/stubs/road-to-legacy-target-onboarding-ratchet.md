---
complexity: lightweight
review_by: 2027-02-18
---

# Road to legacy target onboarding via ratchets — stub

> **Source:** `agents/tmp.old/robert-c-martin/road-to-legacy-target-onboarding-ratchet.md` — landed by `/analyze:inbox` on 2026-08-22.
> Claims re-verified against `577bdbf88` (main after ADR-243); see the run
> summary for the verification and reproduction tables.

> **Class:** demand-gated successor of
> `road-to-target-project-assurance-readiness.md`. Verified against
> `e1fe45077cab`; proposals are marked.

## Defect this closes

A low-coverage target repo currently has no path. The parent's matrix will bind
most real repos at L0–L1 and stop there. The only ratchet-shaped policy in the
tree is PHPStan's baseline rule
(`quality-tools/references/php-tools.md:170-174`), and this package's own estate
ratchet (`src/scripts/check_estate_count.ts`, fails on growth, never on level)
is exactly the shape a legacy target needs — for violations instead of roadmaps.

> **Corrected from reproduction, 2026-08-22 (`/analyze:inbox`).** Two claims in
> the original wording did not survive contact with the tree:
>
> - The evidence grep is **diverged**. `characterization` and `golden master` do
>   return 0 hits in `src/`, but `quarantine` returns **17** files and `flaky`
>   **23** — in unrelated senses (untrusted-input quarantine, artefact
>   quarantine, flaky-gate notes), so the *conclusion* stands while the command
>   offered as its evidence does not. A reader re-running it would see hits and
>   distrust the whole stub. The narrower true statement: no test-quarantine or
>   characterization-test vocabulary exists in `src/`.
> - `src/config/estate-count-budget.json` no longer carries the ratchet number.
>   ADR-243 (merged 2026-08-22, PR #1549) moved the floor to a measurement taken
>   on the base ref's own tree; the file holds policy only. The *shape* the stub
>   points at — fails on growth, never on level — is unchanged and is now
>   `check_estate_count.ts`, which is what the citation above was corrected to.

## Proposed migration path

*Proposal.* Five steps, each moving one matrix dimension by one grade:

1. **Knockouts first.** Build reproducible, CI blocks on *something*,
   secret detection, lockfile — without these the agent may not work
   above R1 at all.
2. **Freeze baselines.** Lint/type/arch/SAST violations become allowlists;
   the gate fails on growth only (generalised `estate-count-budget`
   shape, one JSON per tool).
3. **Changed-surface only.** Characterization tests are written *before*
   the change, on the old code, for the functions the diff will touch;
   GREEN-before is recorded. They document what the code *does*, bugs
   included — the agent must not "fix" while characterising.
4. **Differential verification** of old vs new behaviour on recorded
   inputs where no spec exists; diff-scoped mutation on the new tests.
5. **Incremental strictness** per module, priority by a CRAP-style
   complexity × uncovered score on the diff — never repo-wide.

Flaky handling: a test that fails then passes on retry is quarantined
into a named list and excluded from RED/GREEN evidence until fixed; a
quarantine list above a pre-registered size binds the *test strength*
dimension at 1.

## Prerequisites for promotion

Parent Phase 1 merged; at least one real legacy target repo the
maintainer is willing to run this on; estate offset.

## Not in scope

Rewriting the target; any repo-wide coverage target as a number.
