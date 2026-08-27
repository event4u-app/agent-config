---
complexity: structural
review_by: 2026-09-25
---

# Stub: road to the TDD phase guard and its evals

> **Stub — not active work.** A **drain-run transfer**, created 2026-08-26 when
> [`road-to-evidence-gated-change`](../archive/road-to-evidence-gated-change.md)
> was drained. Four items need a `pre_tool_use` concern, a settings read, a
> golden fixture and three evals — each buildable, and together a change with its
> own review surface rather than a tail on a nine-roadmap drain run. Framework of
> record:
> [`drain-blocker-dispositions-b.md`](../../evidence/council/drain-blocker-dispositions-b.md).
> Outcome state on the parent: **transferred**.
>
> **Transferred, not completed. No hook concern was registered and no eval was
> added.**
>
> **This is a capacity transfer, not a capability one** — and that is unusual
> here, so it is said plainly. Nothing blocks this work: no missing environment,
> no owner decision, no unmeasurable premise. What it needs is a change of its own
> size, with a reviewer looking at a new blocking-capable hook surface.

## The criteria, verbatim from the parent

> **4.2 Add a `tdd-phase-guard` concern, advisory and fail-open.**
> Register a `pre_tool_use` concern in `src/scripts/hook_manifest.yaml` with
> `fail_closed: false` whose rules are the existing Forbidden columns and
> nothing new: a production edit with no observed failing test for the current
> behaviour, a test edit during the implement phase, and a test deletion. Phase
> source is the handoff state the skill already resumes from
> (`src/skills/test-driven-development/SKILL.md:98-105`). No model call per edit.
> `verify:` `./scripts-run src/scripts/validate_hook_manifest`

> **4.3 Derive enforcement from the profile knob that exists.**
> Read the enforcement level from `discipline_profile`
> (`src/config/agent-settings.template.yml:134`) rather than adding a second
> profile axis, and keep the planning default independent of it: the discipline
> stays the default in every profile, only whether the guard warns or blocks
> varies. **A profile must never switch the discipline off silently.**
> `verify:` `grep -n "discipline_profile" src/scripts/hooks/tdd_phase_guard.ts`

> **5.4 Add the golden fixture that fails without the distinction.**
> A fixture where the newer implementation sits behind the older public surface,
> so an agent that treats the version number as the generation places new code in
> the wrong lane and the eval catches it.
> `verify:` `task test -- --filter=surface_generation`

> **6.2 Extend the TDD evals with the three failures this roadmap names.**
> `src/skills/test-driven-development/evals/evals.json` carries one scenario and
> no planning trigger. Add three: a planning request that must not emit an
> implement-then-test plan, a change whose helper already exists and must draw a
> reuse verdict, and a new class whose only possible first failure is a missing
> target, which the pre-Phase-2 contract rejects.
> `verify:` `task test -- --filter=tdd_evals`

## What already landed, so the promoter does not rebuild it

**The hardest prerequisite is done.** 4.2's central condition — *"a production
edit with no **observed failing test** for the current behaviour"* — needs a
durable record of that observation, and there was none. There is now:

- `src/scripts/_lib/test_red_state.ts` writes
  `agents/runtime/state/test-results.json` with the target, the observed failure
  **class**, and a run identifier.
- `latestValidRed(root, target)` is the exact query 4.2's first rule needs.
  **Matching is exact and deliberately not fuzzy** — a fuzzy match would clear a
  production edit on a red observed for a different behaviour, which is the
  failure the guard exists to catch.
- The **invalid** classes are the load-bearing half: `broken-fixture`,
  `test-syntax-error`, `missing-unrelated-dependency`, `runner-fault` are
  recorded and marked NOT a valid red, so the guard cannot be satisfied by a
  failure that was never about the behaviour under test.
- 22 tests, sensitivity proven: admitting `broken-fixture` to the valid set turns
  4 of them red.
- `src/config/assurance-capability-registry.json` → `test-red-evidence` moved
  from `projection: null` to naming that file, discharging its own `revisit_if`.

**ADR-248** landed too, which is what 5.4's fixture is a fixture *for*: it records
that a public surface version and an implementation generation are independent
axes, with the eight-rank canonicality evidence order and names-and-paths last.

## Probe — capacity, and it is honest about being that

- **Producer:** any maintainer or agent run with room for a change of this size
  and a reviewer for a new `pre_tool_use` surface.
- **Probe:** does `src/scripts/hooks/tdd_phase_guard.ts` exist and is
  `tdd-phase-guard` registered in `src/scripts/hook_manifest.yaml`?
- **Measured 2026-08-26 (transfer-date baseline):** neither exists. `grep -rn
  "tdd-phase-guard" src/` → 0. `agents/runtime/state/test-results.json` is
  written by nothing at runtime yet — the writer exists and no caller invokes it,
  which is the state 4.2 changes.

**There is no environment to wait for.** Saying otherwise would borrow the shape
of the other transfers in this run and misdescribe this one.

## The design constraints that must survive promotion

These are the parts most likely to be lost, and each was a decision rather than a
detail:

1. **`fail_closed: false`, advisory first.** A blocking guard on every production
   edit is a large behavioural change to land unmeasured. The parent's Phase 4
   heading is *"One runtime carrier, advisory first"*.
2. **No new policy.** The guard's rules are the **existing Forbidden columns** of
   the TDD skill's mode contract. A guard that invented a rule would be policy
   arriving through a hook, which is the inversion this suite refuses.
3. **No model call per edit.** Phase source is the handoff state the skill
   already resumes from. A guard that asked a model what phase it was in would
   cost a call per edit and be non-deterministic.
4. **One profile axis, and it never switches the discipline off.**
   `discipline_profile` decides whether the guard **warns or blocks** — never
   whether the discipline applies. A profile that silently disabled test-first
   would be the failure mode, not the feature.
5. **Exact target matching.** See above. This is the one that looks like a
   usability wart and is the correctness property.

## Closing in the other direction — the honest-null path

A measured finding that the guard **fires almost never, or fires mostly on
false positives**, closes this stub as a measured null. The instrument for that
is already in place: `test-results.json` plus the pre-registered
`claim:red-before-production-edit-rate` in `docs/CLAIMS.md`, whose own
falsification clause says a rate that does not rise is an honest null and closes
the claim rather than reopening the instruction wording.

**A null here would be a real result**, because the four Phase-1 instruction
corrections landed without it — so the question "does prose alone move the rate"
is answerable before any guard exists.

## Seed content on promotion

- Read `claim:red-before-production-edit-rate` first. It names the numerator, the
  denominator, and the fact that **no baseline exists** because the instrument
  was created by the parent change. The first reading is a level, not a delta.
- Wire a caller for `recordRed` before building the guard. The writer exists and
  nothing invokes it; a guard reading an always-empty file would deny everything
  or nothing depending on its default, and neither is informative.
- Keep 4.2 advisory for at least one release. The parent's Phase 4 title is the
  decision.
- 5.4's fixture belongs with the other golden fixtures, not in the TDD evals —
  it tests a **placement** verdict, not a phase.
- 6.2's third scenario is the sharp one: a new class whose **only possible first
  failure is a missing target**. It is the case the pre-Phase-2 assertion-only
  RED contract rejected, so it is also the regression test for the Phase-2 change.
