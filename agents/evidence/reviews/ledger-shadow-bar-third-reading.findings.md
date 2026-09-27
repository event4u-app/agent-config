# Completion review — the 2026-09-27 shadow-bar reading

**Skipped:** no code surface for this completion — the diff is one roadmap file recording a re-measurement of a pre-registered shadow window, with no script, hook, config, test or frontmatter field touched, and the gate itself measures zero code paths of one changed file, scope 65017fbb62aae816f278d826e84f6a8708854bbf14fb4c687f3b402bca712263, declared 2026-09-27

## Why a skip rather than a review

The change records a reading and closes nothing. `road-to-a-ledger-that-closes-the-loop`
keeps both of its open items — step 6.1 and AC-6 — open, because the bar they are
gated on (`docs/CLAIMS.md`, `obligation-settle-shadow-bar`) does not hold. No
checkbox moved, and the roadmap's own pre-registration forbids moving one on the
calendar measure alone.

What replaces a code review here is the verification that produced the numbers,
all of it re-runnable:

- **The qualification window was checked for a reset, not assumed intact.** Claim
  clause (2) resets qualification on any change to `touchedPaths`, `computeVerdict`,
  `REFUSABLE_CLASSES`, the dispatch gate or the injector's delivered-row write.
  `git log --since=2026-09-19 --until=2026-09-28` over
  `src/scripts/hooks/obligation_settle_hook.ts`,
  `src/scripts/_lib/obligation_frequency.ts` and
  `src/scripts/hooks/rule_inject_hook.ts` returns empty, so the window keeps
  qualifying.
- **All three measures were read from the ledger, not inferred.** Four session
  files under `agents/runtime/state/obligations/` carry 80 cumulative `delivered`
  rows dated 2026-09-18 through 2026-09-27, and every one of them carries
  `"shadow": []`. Shadow rows are 0 of the >= 100 floor.
- **The `delivered` / `shadow` distinction was preserved.** The bar counts `shadow`.
  The 2026-09-19 entry warned that a later run seeing a non-empty directory and
  concluding the window is filling has read the wrong array; this reading states the
  arrays separately for that reason.
- **The rate was recomputed rather than carried forward.** 4 sessions in 14.3 days
  from window-open is ~0.28/day against the previous ~0.35/day, which moves the
  session-floor estimate from ~144 to ~179 days. The figure moved in the
  unfavourable direction and is recorded that way, including in risk row 7.
- `task preflight` is green, including `lint_regression` (no regressions) and the
  kernel-rule bundle check (no kernel rule touched).

## Scope this does NOT cover

This is a reading, not an arming decision. Nothing here licenses flipping 6.1 or
AC-6, and nothing here reads compliance, exposure or receipt off a `delivered`
row — that inference is refused by the roadmap's non-goal and by claim clause (6).

## Standing caveat

A skip declaration is a statement about the diff's surface, not a claim that the
prose is correct. Every figure above names the file or command that decides it, so
a later reader can refute a row without trusting this artefact.
