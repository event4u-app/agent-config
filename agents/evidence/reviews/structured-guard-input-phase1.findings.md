# Completion review — structured-guard-input Phase 1 and Phase 4

**Skipped:** no code surface for this completion — the diff is two contract sections, one evidence write-up, one roadmap and its regenerated dashboard; the gate itself measures zero code paths of five changed files, scope 7dd3d224a9e9e2a7ac5fd9476125c2a10c00e2fe190ed390a0f7d98e0ef5273a, declared 2026-08-12

## Why a skip rather than a review

Nothing executable changed. No script, no hook, no schema, no test, no config.
The work was **measurement plus recording**: three pre-registered falsifiers
answered with existing instruments, and one contract section stating what text a
guard receives. `check_completion_review` classifies the diff as zero code paths
of four changed files, which is the condition this declaration covers.

## What replaces a code review here

The deliverable is a set of numbers that will be acted on, so what needs checking
is whether each number is real and whether it says what it is claimed to say.

- **No classifier was re-implemented.** F1 was measured with
  `conformance_scan --why evidence-steering`, which imports `isEvaluationPrompt`,
  `isSelfScoped` and `preloadedVerdict` from the guard itself. A second copy
  would let the measurement and the gate disagree silently, which is the drift
  this repo's own principle forbids — so the probe that was *not* written is part
  of the result.
- **The 128-session corpus is enumerated, not summarised.** Five stores with
  per-store counts, including two carrying no project-scope install as a control
  group; both control stores are clean, which is the reading that would have
  been lost by reporting a single pooled rate.
- **The 6 hits are classified individually, and the classification is the
  finding.** Reporting "6 second-self-review dispatches" as the answer would have
  inverted it. Each round was separated by a dispatched fix worker, so every pass
  judged a different artefact — iteration, not verdict shopping — and one of the
  six is an implementation prompt caught by the evaluation pattern.
- **The retrospective corpus is defended, not glossed.** The downgrade landed the
  same day, so no session postdates it. The argument that this is still the right
  population — the downgrade changed severity, not classification, and the
  predicates deciding membership are untouched — is stated in the write-up where
  a reader can reject it.
- **F3 is reported at both boundaries rather than at the convenient one.** Read
  strictly as a conjunction the falsifier fires on 57 sites / 54 % and not on
  50 / 48 %. Both readings are given, with the note that the external half is
  exceeded either way. Rounding this to "the falsifier fires" would have been an
  overclaim in the direction of the conclusion.
- **F2 is the finding that argues against the conclusion, and it is not buried.**
  It is the one measurement pointing at *more* severity, and it is stated first
  in its own section rather than folded into a table.
- **Phase 4's verify condition was NOT met, and that is recorded as the result.**
  It asked for a worked example from a real envelope; no captured envelope exists
  in the tree, so the answer is "by construction, and here is the rig that would
  settle it" rather than a fabricated example.
- **A probe was designed and deliberately not run**, with the reason recorded:
  assembling a blocked token at runtime would have settled the shell half in one
  read-only command, and doing so is a guard bypass in form regardless of payload.

## Re-bind 2026-08-12 — Phase 2 re-cut to option C

Re-bound in place rather than renamed (§ 2.7): the reviewed content was
**extended**, not withdrawn. The added surface is still docs-only — a second
contract section, the Phase 2/3 re-cut, and the measurement behind it.

What needs checking in the added half, since it argues for building something:

- **The falsified premise was falsified against the tree, not from memory.** The
  contract said no in-repo check can read the prompt; `git ls-files` returns 19
  tracked `prompt.md` files and the dispatcher line that writes them is cited.
- **The two broken hash bindings were diagnosed, not reported as a count.** CRLF,
  LF and trailing-newline variants were each re-hashed and none reproduces the
  declared value, so "line endings" is ruled out rather than assumed; the commit
  that touched each file was read. One cause is named and its fix dated; the
  other is stated as **unexplained**, which is the honest answer and the one that
  justifies the control.
- **The already-shipped fix was found before proposing to rebuild it.**
  `_FROZEN_RECORD_PREFIXES` already excludes `agents/evidence/`, landed
  2026-08-11 — so the obvious repair for the first break was not re-proposed.
- **The detection ceiling is measured, not estimated.** The predicate was run
  against the four steering clauses case zero records verbatim: one matches,
  three do not, and the three are named.
- **The smaller solution replaced the first one considered.** A `prompt:`
  manifest field was the suggested minimal change; the slug convention already
  determines the path, so the field would have migrated 30 committed manifests
  for nothing. The scan proves the convention works by having used it.

## What is deliberately NOT claimed

The Phase 2 and Phase 3 disposition is recorded as an **open decision with four
options**, not as a verdict. The AI council was convened on it and returned
INCONCLUSIVE (`cli_quota_exhausted`, both members, 0/2 present). No solo verdict
is presented in its place, and the failed attempt is recorded rather than
omitted — a failed council attempt still spends quota, and hiding it would make
the next run look cheaper than it is.

Gates green on this branch: `task preflight` (full run, including
`lint_regression`, `check_condensation`, `check_safety_floor_untouched`,
`skill_linter --changed`), and the pre-push static pass, which reported no
changed TypeScript because there is none.

## Standing caveat

A skip declaration is a statement about the diff's surface, not a claim that the
conclusions are right. The strongest objection to this change is that F1's zero
is measured over a corpus in which the *opportunity* for verdict shopping may
simply be rare — 128 sessions with one review-heavy arc between them is thin
evidence about a behaviour that only arises when an agent is reviewing its own
work. The counter is that this is precisely why the disposition is left open
rather than resolved, and why F2 (no second control) is recorded as standing
against the advisory severity even though F1 does not.
