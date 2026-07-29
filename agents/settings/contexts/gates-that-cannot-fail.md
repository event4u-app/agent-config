# Learning: gates that cannot fail (2026-07-29)

What the 9.9.0 release exposed, and what a follow-up audit found underneath it.
Recorded so the next reader does not re-derive it.

## The one-sentence root cause

```
THE PACKAGE VERIFIES THAT ITS GATES RUN. IT NEVER VERIFIED THAT THEY
LOOK AT ANYTHING. A GATE THAT SCANS ZERO FILES EXITS 0 AND PRINTS A
GREEN CHECKMARK — INDISTINGUISHABLE FROM A GATE THAT PASSED.
```

[`ADR-127`](../../docs/decisions/ADR-127-enforcement-claims-must-resolve.md)
already named this class one level up: *"every gate checked that a pointer
resolves, never that a claim is true."* This is the same defect applied to the
gates themselves — the gate resolves and runs; nobody asked what it read.

## Measured evidence (2026-07-29, reproducible)

Six gates run on the current tree, verbatim output, all `exit=0`:

| Gate | Its own success message |
|---|---|
| `check_iron_law_prominence` | `✅  Iron Law prominence clean (0 file(s) scanned).` |
| `lint_namespace` | `BASELINE: 0 issues · 0 name(s) checked` |
| `lint_load_context` | `✅  load_context schema clean (0 declarer(s))` — 24 real declarers exist |
| `check_augment_description_cap` | `✅  All 0 auto-rule descriptions ≤ 150 chars.` — 3 real `type: auto` rules exist |
| `lint_handoffs` | `✅  no violations under .agent-src.uncondensed/skills` — names the dead path in its success line |
| `check_condensation` | `✅  Condensation quality check passed.` |

**The count was already printed. Nothing ever asserted on it.**

### The worst one, proven behaviourally

`check_safety_floor_untouched.ts` compares `git diff --name-only` against
`.agent-src.uncondensed/rules/<name>` while the real rules live in `src/rules/`.
Probe: append a line to `src/rules/commit-policy.md`, confirm `git diff` lists
it, run the guard →

```
✅  Safety-floor untouched (4 rules guarded vs. HEAD).     exit 0
```

It claims a guarded count of 4 and guards 0. Worse, its test
(`tests/scripts/check_safety_floor_untouched.test.ts:25`) asserts
`RULES_DIR_REL === '.agent-src.uncondensed/rules'` — **the test pins the bug as
correct**, so fixing the gate requires changing a passing test first.

## Why every one of these had green tests

The dead gates are not untested. They are tested through an **injection seam
that production never uses**: tests `mkdtempSync` a fixture root and pass it as
an explicit override, so the algorithm is proven correct while the default
invocation — the one `scripts-run` and CI actually call — is never exercised.
`lint_command_verbs`' test goes further and writes its fixture *into the dead
directory itself*, reinforcing the blind spot.

```
A TEST THAT INJECTS A ROOT PROVES THE ALGORITHM.
ONLY A TEST THAT RUNS THE DEFAULT ENTRY POINT PROVES THE GATE.
```

## The trigger event

`ADR-051` (2026-06-05) moved the source container
`packages/core/.agent-src.uncondensed/` → `src/agent-src/`, and a later commit
deleted `packages/` entirely. Gates routed through the shared resolver
(`_lib/agent_src.ts::resolve_logical`) survived. Gates that hardcoded the
literal path did not — and failed **silently and greenly**, because every one
of them treats a missing directory as "nothing to check" rather than as an
error. The migration had no checklist that enumerated scan roots.

## Second class: gates that never run on a PR

Separate from dead scope: a gate wired only to `release/*`, `schedule`, or
`workflow_dispatch` is unexercised until the worst possible moment. The 9.9.0
release hit four such failures at once, three of them in a job (`evaluator
umbrella`) having its **first contact** with a release PR. Full release
post-mortem: [`release-gate-first-contact-learnings`](release-gate-first-contact-learnings.md).

## What the gates got RIGHT — do not weaken them

The one consumer-facing defect (an npm `files[]` narrowing that dropped
`docs/contracts/`, leaving two dead router pointers in every install) **never
shipped**, because a release-gated check caught it. The conclusion is to run
gates earlier and prove they can fail — never to relax them.

## Scope boundary against locked decisions

This is **not** the rejected enforcement-first architecture
(`enforcement-first-disposition`, locked 2026-07-26). That lock is about
replacing prose rules with compiled enforcement, and its revisit conditions
(hook budget + usage-distribution evidence) stand untouched. This is about
making the **deterministic gates that already exist** demonstrate that they
executed against real input. Different mechanism; the lock does not apply.

It is also a natural extension of the already-accepted canary principle
(biannual, sealed, never-ships) from the review protocol to the lint surface —
not a new governance layer.

## Diagnostic rules of thumb this run earned

1. **When a release gate goes red, diff the published artifact against a local
   pack before diffing code.** Packaging changes silently and is invisible in
   source diffs — `git diff <tag>..main` on the checker, runner, workflow and
   router index was empty every time; the variable was one line in `files[]`.
2. **Never trust a literal grep for "what does this print".** Run it and measure
   the stream. A grep found 3 stdout banners; measuring found 7 (4 came from a
   loop).
3. **A check that returns 0 findings against real data is a suspect, not a
   pass.** Ask what it scanned before believing it.
