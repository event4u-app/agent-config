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

## The conversion contract — assert-first, measured not asserted

> **Council 2026-08-04 round 2** (anthropic/claude-sonnet-4-5 + openai/gpt-4o,
> 3 rounds, deep). Both members converged: **emit-only conversion is a
> manufactured green.** Adding one `scanned: <N>` line satisfies the ratchet's
> regex, but that line is only *enforced* for the 22 gates registered in
> `gate-coverage.yml` with a floor — and padding that manifest is a non-goal of
> this roadmap. An unregistered gate that prints `scanned: 0` on its way out of
> a deleted root has published its blindness to nobody.

The council proposed dropping the emit route outright (its option D), accepting
that the count jumps before it falls. Measured against the tree first, per the
package's own rule that a council's load-bearing premise is checked in-repo:

| Route | Gates | Consequence of dropping the bare-emit route |
|---|---:|---|
| asserts **and** emits | 8 | unaffected |
| asserts only | 12 | unaffected |
| emits only | 14 | **all 14 are registered enforced** with `min_scanned ≥ 1` |
| neither | 189 | the population this roadmap converts |

So the honest tightening is not "drop the emit route" — it is to say what the
emit route always meant:

```
HARDENED ⇔ ROUTES THROUGH _lib/scan_scope
        ∨ (EMITS `scanned:` ∧ REGISTERED ENFORCED IN gate-coverage.yml WITH A FLOOR)
```

This is **not** goalpost movement in either direction: it costs the 14 emit-only
gates nothing (every one is registered), and it matches this roadmap's own Goal
sentence, which already says *"asserts its scan scope through `_lib/scan_scope.ts`,
or carries a justified `allowEmpty`"* and never mentioned a bare emit. The
ratchet implementation was looser than the charter it enforces; closing that is
a drift repair. The one gate the tightening reclassifies is
`check_gate_coverage` itself — it emits and is not in its own manifest — so it
is converted in the same change and the baseline stays **189**, verified by
measurement rather than by argument.

Consequences for every conversion below:

1. **Assert-first.** Each converted gate calls `assertScanned` /
   `assertWatchlistResolves`. A `scanned:` line alone can no longer close a
   gate, so the cheap path out of this roadmap is closed by construction.
2. **`reportScanned` for gates that should also feed the coverage guard** —
   assert + publish in ONE call, so a published number is assert-backed by
   construction and cannot drift from the number that was validated.
3. **`allowEmpty` carries a machine-readable prefix** (`OPTIONAL_INPUT:` /
   `EMPTY_VALID:` / `WATCHLIST_DRIVEN:`) followed by the reason, so the
   deletion test below is applied from the comment alone — the council's answer
   to "how do you stop 116 boilerplate justifications".

## Phase 1 — the mechanically-safe conversions

Gates whose count is **published, not invented**: the value already exists in
the gate at the point of exit and already gates a red. Converting these adds no
semantic judgement, which is exactly why they are separable from Phase 2.

- [x] Enumerate the gates that already compute a corpus size at their exit path
      but neither assert nor publish it.
      *Verify:* the list is produced by a script, not by reading; each entry
      names the file:line where the count already exists.
      → `src/scripts/gate_scope_classify.ts` (AST, population imported from
      `check_gate_coverage.list_unhardened_gates()` so it cannot disagree with
      the ratchet); output `agents/evidence/reports/gate-scope-classification.md`.
      Split: **31** `count_at_exit` · **42** `count_in_helper` · **116**
      `no_corpus_count`. The classifier separates a **corpus** count from a
      **findings** count — its first draft nominated 146 gates by reading
      `errors.length` in `main()` as coverage, which is risk #1 of this register
      implemented by the tool meant to prevent it.
- [x] Convert them in batches, smallest-risk first, each batch its own commit.
      *Verify:* `check_gate_coverage` green after every batch; the ratchet count
      drops by exactly the batch size (a drop that does not match the batch is a
      miscount, not a bonus).
      → 5 + 28 + 2 converted across three commits; 193 → 163, every drop matching
      its batch. `count_at_exit` is now **empty**: every gate whose corpus count
      already existed at its exit path is asserted. The two extra are
      `skill_collision_clusters` and `skill_overlap`, which the widened
      population revealed reading a retired container — 0 of 288 skills.
- [-] Register each converted gate under its **CI-identical argv**, never a bare
      probe.
      *Verify:* the manifest `argv` matches the taskfile/workflow invocation
      character for character.
      → **Not applicable under the assert-first contract, and deliberately so.**
      Registration is how an *emitted* count becomes enforced; every conversion
      here asserts instead, and padding the manifest is a non-goal of this
      roadmap. The argv rule is not dropped — it still governs the 22 gates that
      ARE registered, and the `lint_handoffs` lesson that produced it (red under
      `task lint-handoffs`, green when probed bare, because the injected
      `--quiet` became its scan root) is carried into the conversion contract
      above.

> **The argv rule is not pedantry.** The parent PR found `lint_handoffs` red
> under `task lint-handoffs` and green when probed bare: it read `args[0]` as a
> path, so the injected `--quiet` became its scan root. A bare-probe registration
> would have certified the broken invocation as covered.

## Phase 2 — the gates whose unit must be decided

The remaining population, where "what is a unit?" has no mechanical answer. Per
the council these carry a **15–25 %** semantic-error rate if swept blind, so
they are per-gate work with a stated decision, not a sweep.

- [x] Classify each remaining gate: corpus gate (assert the count) · watch-list
      gate (`assertWatchlistResolves`) · legitimately-empty (`allowEmpty` with a
      reason).
      *Verify:* every gate lands in exactly one class with a one-line reason in
      the source, reviewable in the diff.
      → `gate_scope_classify` reports a `shape` per gate — `walks-a-tree` (72)
      · `reads-named-files` (64) · `reads-a-diff` (15) · `unclassified` (12) —
      and the shape picks the primitive. Precedence carries the claim: a gate
      that both diffs and walks is a diff gate, because the diff bounds its
      input. The per-gate reason is the comment at each call site.
- [x] Convert per class, in batches, each batch dropping the ratchet count.
      *Verify:* ratchet drop equals batch size; no batch raises it.
      → 193 → 163 → 115 → 61 → 4, across three waves of four parallel batches.
      Every drop matched its batch. **229 of 233 gates converted**; the
      remaining 4 are the blocker above, not unconverted work.

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

- [x] Every `allowEmpty` added by this roadmap passes the deletion test, stated
      in the reason itself.
      *Verify:* a reviewer can apply the test from the comment alone, without
      reading the gate.
      → 16 across 229 conversions (7 %). Each states its own deletion test in
      the reason. The two shapes that earned one: project-authored runtime
      corpora a consumer legitimately starts without (knowledge cards, memory
      intake, the TTL-managed scratch tree, the opt-in orchestration DSL), and
      git-range gates where an empty range is a real answer — those name why an
      *unreadable* range is the different case that exits above them. Where a
      gate looked like an `allowEmpty` candidate and a better unit removed the
      need, the better unit won: `lint_legal_pack` counts every SKILL.md rather
      than the opt-in pack's subset.

## Phase 3 — close the ratchet

- [ ] Count reaches 0.
      *Verify:* `check_gate_coverage` reports 0 unhardened; the baseline entry is
      DELETED, not zeroed-and-kept.
      → **4 of 233 remain, and they are the blocker above.** Deliberately open:
      each needs a port-or-retire call no conversion can substitute for.
- [x] The population regex that defines "a gate" is asserted in one place, not
      three.
      *Verify:* `check_gate_coverage`, `sweep_dead_scan_roots` and the registry
      test agree on the population; a test pins the agreement.
      → `_lib/gate_population.ts` owns the answer; all three read it. Done
      FIRST, not last (AI council 2026-08-04): reaching 0 on the narrow
      population would have forced deleting the ratchet entry — this roadmap's
      own closure criterion — at the moment 10 newly-visible gates still needed
      conversion, leaving that work unprotected. The widening also paid for
      itself immediately: the first sweep after it found `skill_collision_clusters`
      and `skill_overlap` reading the retired container, 0 of 288 skills.
      The pinning test asserts named real cases and that no consumer has grown a
      private regex back — comparing the three constants would pass while all
      three were wrong together.

## Non-goals

- **No new gate script, manifest, or CI job.** The parent banked a net-zero-new-
  layers criterion; this roadmap inherits it. Everything rides on
  `check_gate_coverage`, `gate-coverage.yml`, and the existing ratchet.
- **No padding the coverage manifest.** A registered gate that does not really
  emit a real count is the false green the parent exists to kill.
- **No blanket sweep.** Explicitly rejected above, with the reason.

## Acceptance criteria

- [ ] `gate-hardening:unhardened-scan-scope` reaches 0 and the baseline entry is
      removed. → 193 → **4**; the last four are the blocker above.
- [x] No gate can exit 0 having scanned zero units without a visible, justified
      `allowEmpty` declaration — the parent's criterion, inherited verbatim.
      → holds for 229 of 233; the 4 exceptions are named, counted, and blocked.
- [x] Every `allowEmpty` justification in the tree passes the deletion test.
- [x] The three population definitions agree, pinned by a test.
- [ ] All quality gates pass — see `quality-tools`.

## Blockers

### blocker: four-gates-port-or-retire

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 3 (`count reaches 0`) and thereby the deletion of the
  `gate-hardening:unhardened-scan-scope` ratchet entry — the roadmap's closure
  criterion.
- **What to do:** decide, per gate, between porting it to the surface that
  replaced its corpus, retiring it, or declaring it out of the gate population.
  None of the four is a conversion; each was attempted and reverted.
- **Resolved when:** all four are ported, retired, or excluded from the
  population, the count reaches 0, and the ratchet entry is deleted rather than
  zeroed-and-kept.

229 of 233 are converted. The remaining four are **decisions**, and each was
attempted and reverted rather than papered over:

| Gate | Why it cannot be converted | What it does today |
|---|---|---|
| `lint_skill_tools` | corpus is `skill_tools/*.py`; the py2ts migration left only `.ts`. Every check is Python-specific (argparse import, `__main__` guard, stdlib-only import scan, `snake_case.py` naming) | prints `✅ scripts/skill_tools/ — all tools clean.` over **0** tools |
| `lint_workspace_boundary` | corpus is `src/cli/python/workspace_*.py`; same migration, same emptiness. The ADR-095 boundary it guards is entirely unenforced | prints `⚠️ no files match …`, exits **0** |
| `check_bite_sized_granularity` | a pure library — no CLI, no `main`, no exit code, no root. `grep` finds **no production caller**, only its own test | nothing; it is called by nobody |
| `verify_before_complete_hook` | an observability hook, not a gate. Its contract pins "exit code is always 0 — never blocks", and its only inputs are its own stdin envelope and the state file it writes | entered the population only because the definition widened to the `verify_*` prefix |

**Why they are left unhardened and counted rather than waived.** An `allowEmpty`
on any of them fails the deletion test in the most literal way available: delete
`skill_tools/` and "no Python tools" still reads true — which is exactly the
blindness the test exists to catch. Asserting their real (empty) corpus would
red CI for a defect this roadmap is not chartered to fix. Inventing a unit for
the last two would mean asserting a loop index or a constant.

So the ratchet keeps four entries it cannot clear. That is the honest state, and
it is why this roadmap's "count reaches 0" criterion is **not** met by the PR
that does all 229 conversions. Faking it here would reproduce, at the finish
line, the manufactured green the parent roadmap exists to prevent.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-04 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Manufactured green via invented counts | product | A converted gate publishes a number that does not match what it validated (council severity 3: count includes items the loop skipped). Mechanically undetectable; silently weakens the coverage floor AND the canary | Phase 1 restricted to counts that already exist at the exit path; Phase 2 requires a stated per-gate classification reviewable in the diff | Phase 1 — the mechanically-safe conversions |
| 2 | `allowEmpty` used as an escape hatch | product | Boilerplate justifications convert the ratchet into an allowlist, reproducing the ">20 entries means the linter is wrong" antipattern | The deletion test, applied per justification and stated in the reason itself | Phase 2 — the gates whose unit must be decided |
| 3 | Baseline stagnation | implementation | 189 never drops and the entry hardens from debt into configuration | The inherited 56-day non-stagnation clause fails the gate; the entry carries `landed` so it is checkable, not remembered | Why the ratchet points at vulnerability, not coverage |
| 4 | Population disagreement | implementation | Three regexes define "a gate" (223 / 225 / 232). The ratchet reads one; a gate outside it is invisible to the count while visible to the census | Phase 3 pins the agreement with a test before the count is trusted at 0 | Phase 3 — close the ratchet |
