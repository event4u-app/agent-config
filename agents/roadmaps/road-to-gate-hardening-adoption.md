---
complexity: structural
status: ready
parent_roadmap: road-to-gates-that-can-fail
---

# Road to gate-hardening adoption — take the unhardened-gate count to zero

> **Source:** the two acceptance criteria
> [`road-to-gates-that-can-fail`](archive/road-to-gates-that-can-fail.md) could
> not honestly close, re-chartered rather than dropped. That roadmap killed the
> **defect class** (14 dead scan roots repaired, prevention + canary + ratchet +
> census shipped). This one closes the **adoption gap** the class left behind.
> **Council:** AI council 2026-08-04 (anthropic/claude-sonnet-4-5 +
> openai/gpt-4o, 3 rounds, blind synthesis). Both members converged on scope
> decomposition — the parent's criteria measured *adoption reach of the fix*,
> not *presence of the defect*, and bundling a 223-gate autonomous sweep into
> the closure PR risked reproducing the exact manufactured green the parent
> exists to prevent (their estimate of the semantic-error rate for a mechanical
> sweep: **15–25 %**).

## Goal

Take `gate-hardening:unhardened-scan-scope` from **189** to **0**: every gate
script under `src/scripts/` either asserts its scan scope through
`_lib/scan_scope.ts`, or carries a justified `allowEmpty` reason that survives
audit. The threshold is 0 — it is not negotiable downward, and this roadmap
closes only when the ratchet entry can be deleted.

## The measurement (2026-08-04, reproducible, not an estimate)

```bash
./scripts-run src/scripts/check_gate_coverage   # prints the ratchet verdict
```

| Metric | Value | Source |
|---|---:|---|
| Gate scripts in population | 223 | `check_gate_coverage.count_gate_scripts()` |
| Route through `_lib/scan_scope` | 22 | `list_unhardened_gates()` complement |
| Emit a `scanned:` line + registered | 22 | `src/config/gate-coverage.yml` |
| **Unhardened (the number that must reach 0)** | **189** | `gate-hardening:unhardened-scan-scope` |

A gate counts as hardened when it routes through `_lib/scan_scope` **or**
publishes a `scanned:` line. Either makes a dead root visible; neither is
satisfiable by a gate that read nothing.

## Why the ratchet points at vulnerability, not coverage

The discriminator the council settled on, recorded because it is the thing that
keeps this roadmap honest:

```
A RATCHET IS LEGITIMATE WHEN IT MEASURES THE PROBLEM'S CURRENT SEVERITY
AND FAILS WHEN SEVERITY RISES.
IT IS THRESHOLD-LOWERING WHEN IT MEASURES THE SOLUTION'S CURRENT REACH.
```

A coverage ratchet ("hardened gates must increase") was **rejected**: converted
gates never un-convert, so it can only go one way and would grade the fix
instead of the defect. The count above is the inverse — it *rises* the moment a
new gate is written without a scope assertion, and 0 stays the target. The
56-day non-stagnation clause from the parent's disposition rule applies
unchanged: a number that never drops fails its gate rather than hardening into
configuration.

## Phase 1 — the mechanically-safe conversions

Gates whose count is **published, not invented**: the value already exists in
the gate at the point of exit and already gates a red. Converting these adds no
semantic judgement, which is exactly why they are separable from Phase 2.

- [ ] Enumerate the gates that already compute a corpus size at their exit path
      but neither assert nor publish it.
      *Verify:* the list is produced by a script, not by reading; each entry
      names the file:line where the count already exists.
- [ ] Convert them in batches, smallest-risk first, each batch its own commit.
      *Verify:* `check_gate_coverage` green after every batch; the ratchet count
      drops by exactly the batch size (a drop that does not match the batch is a
      miscount, not a bonus).
- [ ] Register each converted gate under its **CI-identical argv**, never a bare
      probe.
      *Verify:* the manifest `argv` matches the taskfile/workflow invocation
      character for character.

> **The argv rule is not pedantry.** The parent PR found `lint_handoffs` red
> under `task lint-handoffs` and green when probed bare: it read `args[0]` as a
> path, so the injected `--quiet` became its scan root. A bare-probe registration
> would have certified the broken invocation as covered.

## Phase 2 — the gates whose unit must be decided

The remaining population, where "what is a unit?" has no mechanical answer. Per
the council these carry a **15–25 %** semantic-error rate if swept blind, so
they are per-gate work with a stated decision, not a sweep.

- [ ] Classify each remaining gate: corpus gate (assert the count) · watch-list
      gate (`assertWatchlistResolves`) · legitimately-empty (`allowEmpty` with a
      reason).
      *Verify:* every gate lands in exactly one class with a one-line reason in
      the source, reviewable in the diff.
- [ ] Convert per class, in batches, each batch dropping the ratchet count.
      *Verify:* ratchet drop equals batch size; no batch raises it.

### The `allowEmpty` trapdoor — the council's strongest objection, carried in

```
AN `allowEmpty` REASON IS AUDITABLE OR IT IS SUPPRESSION.
```

The objection, verbatim in effect: *an agent will mark gates `allowEmpty` with
boilerplate to avoid conversion work, and you end up with a hundred gates
claiming "success is zero matches" when they are validation gates that should
count units.* The operational test, applied per justification:

> **If this gate's scan root were deleted, would the `allowEmpty` reason still
> make sense?**
>
> - `check_no_todos` → yes: an empty tree genuinely has zero TODOs.
> - `check_frontmatter_valid` → no: no docs to validate is blindness, not
>   cleanliness. Reclassify.

A justification failing that test is not a hardened gate — it is an unhardened
one wearing a label, and it stays in the count.

- [ ] Every `allowEmpty` added by this roadmap passes the deletion test, stated
      in the reason itself.
      *Verify:* a reviewer can apply the test from the comment alone, without
      reading the gate.

## Phase 3 — close the ratchet

- [ ] Count reaches 0.
      *Verify:* `check_gate_coverage` reports 0 unhardened; the baseline entry is
      DELETED, not zeroed-and-kept.
- [ ] The population regex that defines "a gate" is asserted in one place, not
      three.
      *Verify:* `check_gate_coverage`, `sweep_dead_scan_roots` and the registry
      test agree on the population; a test pins the agreement.
      <!-- measured 2026-08-04: they disagree — 223 / 225 / 232 respectively,
      because each carries its own prefix regex. Harmless while the numbers are
      only reported, load-bearing the moment the ratchet reads one of them. -->

## Non-goals

- **No new gate script, manifest, or CI job.** The parent banked a net-zero-new-
  layers criterion; this roadmap inherits it. Everything rides on
  `check_gate_coverage`, `gate-coverage.yml`, and the existing ratchet.
- **No padding the coverage manifest.** A registered gate that does not really
  emit a real count is the false green the parent exists to kill.
- **No blanket sweep.** Explicitly rejected above, with the reason.

## Acceptance criteria

- [ ] `gate-hardening:unhardened-scan-scope` reaches 0 and the baseline entry is
      removed.
- [ ] No gate can exit 0 having scanned zero units without a visible, justified
      `allowEmpty` declaration — the parent's criterion, inherited verbatim.
- [ ] Every `allowEmpty` justification in the tree passes the deletion test.
- [ ] The three population definitions agree, pinned by a test.
- [ ] All quality gates pass — see `quality-tools`.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-04 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Manufactured green via invented counts | product | A converted gate publishes a number that does not match what it validated (council severity 3: count includes items the loop skipped). Mechanically undetectable; silently weakens the coverage floor AND the canary | Phase 1 restricted to counts that already exist at the exit path; Phase 2 requires a stated per-gate classification reviewable in the diff | Phase 1 — the mechanically-safe conversions |
| 2 | `allowEmpty` used as an escape hatch | product | Boilerplate justifications convert the ratchet into an allowlist, reproducing the ">20 entries means the linter is wrong" antipattern | The deletion test, applied per justification and stated in the reason itself | Phase 2 — the gates whose unit must be decided |
| 3 | Baseline stagnation | implementation | 189 never drops and the entry hardens from debt into configuration | The inherited 56-day non-stagnation clause fails the gate; the entry carries `landed` so it is checkable, not remembered | Why the ratchet points at vulnerability, not coverage |
| 4 | Population disagreement | implementation | Three regexes define "a gate" (223 / 225 / 232). The ratchet reads one; a gate outside it is invisible to the count while visible to the census | Phase 3 pins the agreement with a test before the count is trusted at 0 | Phase 3 — close the ratchet |
