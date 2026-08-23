---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
---
# Road to standing payload diet

> **Source:** `agents/tmp.old/40k` — an external token-economy analysis pass,
> re-verified against this tree on 2026-08-22. Every number below was re-measured
> here; where the source pass and the tree disagree, the tree wins and the
> divergence is recorded rather than quietly corrected.

## Goal

The standing per-session and per-spawn rule payload is back inside the two
ceilings that already gate it, and it got there by shortening rule **bodies** —
not by re-scoping triggers and not by de-duplicating layers, because both of
those levers are already spent. When this is finished, `check_preamble_payload_budget`
and `check_standing_rule_delivery` both read green on a maintainer machine, a
per-PR delta against the merge-base makes any future growth visible at review
time instead of at ratchet time, and the per-rule before/after is published
including the rules where the diet achieved nothing.

## Context

Two gates measure the same corpus from two angles, and both are red today.
Measured in this tree on 2026-08-22:

- `check_preamble_payload_budget` (`taskfiles/ci-fast.yml:796`, verified) reads
  **135,436 tok against a 107,646 ceiling** — project-scope rules 120,282 ·
  preloaded skills catalog 14,408 · CLAUDE.md hierarchy 746. Its baseline is
  102,520 (`src/config/preamble-payload-budget.json`), so the tree is +32,916
  over baseline. This bucket is paid on **every subagent spawn**, not once.
- `check_standing_rule_delivery` reads **120,857 tok against a 110,000 cap
  (109.9 %)** over **118 files — 103 global + 15 project**. Run inside a
  worktree it reports only the 103 global files (108,889 tok, 99.0 %) because
  `.claude/rules/` is gitignored and generated; the 118-file reading requires
  the main checkout. Both readings are machine-local by construction, which is
  why that gate is deliberately not wired into CI (its own module docstring
  states this).

**The critical framing, and the reason this roadmap exists at all:** the two
obvious explanations for the overrun are both already ruled out.

1. **Layer duplication is gone.** ADR-236 (`docs/decisions/ADR-236-one-artefact-one-layer.md`,
   accepted 2026-08-19, supersedes ADR-226) partitions the two rule layers
   instead of duplicating them. Measured here: `comm -12` over the two rule
   directories returns **0 shared basenames**. The installer refuses to create
   the doubled state at all — `_gate_rule_layer_overlap` in
   `src/scripts/install.ts` (verified at `install.ts:2216`, called at
   `install.ts:5021`). So the 120,857 is 118 *distinct* artefacts.
2. **Trigger re-scoping already shipped.** `src/scripts/condense.ts` emits
   `paths:` frontmatter from `derive_trigger_globs` (imported at
   `condense.ts:269`, called at `condense.ts:1304` and `:1324`, written at
   `condense.ts:1373`). The per-rule census is at
   `agents/evidence/analysis/rule-paths-coverage-census.md`. The repair pass
   landed **−3,929 exact-BPE tokens** by restoring `paths:` on two of nineteen
   rules (`agents/roadmaps/later/road-to-mixed-trigger-activation-cost.md:486`),
   and that roadmap is parked in `later/` on blocker `b-behavioural-bench-spend`
   for the remaining fifteen.

Both phases the source pass proposed for those two levers are therefore
**dropped from this roadmap**, deliberately, and the reason is written down so a
later reader does not re-propose them: one is shipped, the other is already
owned by a parked sibling with a named blocker.

What is left is **pure body length**, and it has exactly one untouched lever.
`norm` is absent from `src/scripts/schemas/rule.schema.json` and from every file
in `src/rules/` (0 hits, verified 2026-08-22). Nothing in this tree pins how much
of a rule file is normative obligation versus explanation, so nothing objects
when a rule grows by 200 lines of rationale.

### The source pass's attribution figure does not reproduce

The source draft attributed the overrun to a burst of authoring: *"+19,679 /
−300 lines in `src/rules` since 2026-08-15"*. Re-measured here on 2026-08-22
over the same window and the same path, across 37 commits:

    git log --since=2026-08-15 --numstat --pretty=format: -- src/rules/
    → added: 1036  deleted: 382

That is off by a factor of roughly nineteen on the added side and inverts the
deleted side. `src/rules/*.md` totals 9,717 lines today, so a +19,679 inflow in
one week is not merely wrong, it is arithmetically impossible against the
current tree. **Phase 0 therefore re-derives its own attribution and does not
consume the source figure at all.** The divergence is recorded here rather than
silently replaced because a roadmap that quietly fixes its own source cannot be
checked against it later.

### Received by reference — the per-invocation skill diet (2026-08-23)

Routed here by
[`road-to-deterministic-time-in-gates.md`](road-to-deterministic-time-in-gates.md)
§ Routed elsewhere, which declined to open a phase for it. The ownership
boundary in one sentence: **this roadmap owns the standing-payload axis end to
end**, and a per-invocation diet phase elsewhere would fork one budget across
two plans — the routing roadmap's own scoping quotes § Context verbatim (the
preamble RED is rule-driven, 120,282 tok of 135,436 against a 107,646 ceiling,
while the skills catalog costs 14,408), so the axis was already named here.

Nothing in this roadmap changes as a result; the item is recorded so the pointer
resolves and the transfer is not a claim nobody received. Two figures came with
it, both `corrected-from-reproduction` against the source that raised them and
both re-measured in this tree on 2026-08-23:

- **14 of 292** skills carry a `references/` directory (the source said 14/290 —
  the count held, the denominator moved with the tree).
- SKILL.md line distribution — re-measured rather than carried over; see below.

**One of those two figures does not reproduce, and the correction ran the wrong
way.** Re-measured at `origin/main` on 2026-08-23 over the 294 `SKILL.md` files
`git ls-tree -r --name-only origin/main src/skills/` returns: **sum 53,432 · p50
166 · p90 275** (median by `statistics.median`, p90 by nearest-rank; both methods
tried agree). That matches the SOURCE's `p50 166 · p90 275` exactly and refutes
the routing roadmap's "corrected" `p50 165 · p90 271`. The sum matches neither —
52,599 (source), 52,798 (correction), 53,432 (measured) — and it cannot, because
none of the three states its denominator: the one-level glob
`src/skills/*/SKILL.md` sees 292 files while the recursive listing sees 294. A
distribution published without its corpus definition and its percentile method is
not reproducible in either direction, which is the finding worth keeping; the
`references/` count (14) reproduces exactly.

They are inputs to Phase 1's per-rule before/after, not new steps: the catalog
half of the preamble bucket is 14,408 tok of 135,436, so a `references/`
extraction sweep cannot close a rule-driven overrun and is not proposed as if it
could.

## Phase 0 — stop the drift before dieting

A ratchet that fails on growth tells you *after* the growth is committed. The
gate runs; nothing diffs it against the merge-base, so a PR that adds 4,000
tokens of rule prose passes review and is discovered at the next ratchet read.
Verified: no workflow under `.github/workflows/` computes a merge-base delta
(`grep -rln "merge-base\|merge_base" .github/workflows/` returns nothing);
PR-comment machinery exists in the tree, so the mechanism is not novel here.

- [ ] **0.1 Re-derive the inflow attribution from this tree, not from the source
      pass.** Produce a per-file and per-commit ranking of what actually grew
      `src/rules/` and the projected corpus since the last green ratchet read,
      and write it to `agents/evidence/analysis/`. Name the top contributors by
      file and token delta. If the answer is "no burst — the corpus was already
      over and the ratchet baseline is stale", say that; it is a legitimate
      finding and it changes what Phase 1 should target.
      verify: `git log --since=2026-08-15 --numstat --pretty=format: -- src/rules/ | awk 'NF==3 {a+=$1; d+=$2} END {print a, d}'` reproduces the numbers quoted in the written analysis, and the analysis file exists under `agents/evidence/analysis/`.
- [ ] **0.2 Record the source-pass divergence as a finding, not a correction.**
      The +19,679/−300 claim and the measured +1,036/−382 both go into the
      analysis file with the command that produced each. State which environment
      could have produced the source figure, or state that none could.
      verify: `grep -c "19,679\|1,036" agents/evidence/analysis/<the new file>` is non-zero and both figures appear.
- [ ] **0.3 Emit a per-PR standing-payload delta against the merge-base.** A
      workflow step that measures the gated buckets at the merge-base and at
      HEAD and posts the signed delta as a sticky PR comment. It **reports**, it
      does not gate — the ratchet already gates, and a second blocking gate on
      the same number would double-fail every legitimate addition.
      verify: `grep -n "merge-base\|merge_base" .github/workflows/*.yml` returns the new step, and `git show HEAD:.github/workflows/ | true` — the pre-state is that no workflow matched that grep before this step (recorded in 0.1's analysis file).
- [ ] **0.4 Register the delta comment in the gate ledger under CI-identical
      argv.** A reporting step still has to be discoverable; an unregistered
      workflow step is invisible to `check_gate_coverage`.
      verify: `./scripts-run src/scripts/check_gate_coverage 2>&1 | tail -3` exits green with the new entry present.
- [ ] **0.5 Book the credit side, so the ledger is two-sided.** Steps 0.3 and
      0.4 measure only the debit — what a PR ADDS to the standing payload. A
      one-sided ledger can only ever report drift, so a change that *removes*
      standing payload scores zero and reads as neutral. Extend the same delta
      comment with a credit column, and take the first booking from a saving
      that is already measured and already shipped: the ADR-236 one-rule-one-layer
      partition. `src/scripts/check_rule_layer_partition.ts:15-21` publishes a
      per-host split measured 2026-08-22 in a freshly generated worktree with
      `partitionActive: true` — `.cursor/rules` 126 files / 26 package-only /
      100 global-only, `.windsurf/rules` 113 / 13 / 100, `.augment/rules`
      118 / 15 / 103, against `.claude/rules` 13 / 13 / 0 and `.clinerules`
      14 / 13 / 0. The withheld files are the credit; the two symlink trees at
      zero global-only are the control that says the number is a partition
      effect and not a counting artefact. Book it against the same buckets the
      debit uses, so a reader can see net movement rather than inflow alone.
      verify: `./scripts-run src/scripts/check_rule_layer_partition 2>&1 | tail -5` reproduces a per-host split, and the delta comment's rendered body contains a credit column whose first booking cites that gate by name.

## Phase 1 — the body diet: a `norm` pin plus its lint

The lever nothing has pulled. Today a rule file mixes three things at one
uniform cost: the obligation (an Iron Law and its clauses), the routing
(pointers to skills and guidelines), and the rationale (why the rule exists,
what it measured, what it declines to claim). All three are re-sent on every
session and every spawn. Only the first two have to be.

`norm:` names the normative fraction and pins it. The rationale does not
disappear — it moves to a guideline or a mechanics context that loads on demand,
which is the P4 migration pattern this tree already uses in roughly forty rules.

**This phase is bounded by `preservation-guard`**
(`src/rules/preservation-guard.md:30` — *"EVERY PASSAGE STAYS — PARAGRAPH FOR
PARAGRAPH, BULLET FOR BULLET, FENCE FOR FENCE"*). A diet that deletes a passage
is a rule violation, not an optimisation. Every token removed from a rule body
must land somewhere a reader can still reach it.

- [ ] **1.1 Define `norm` in the rule schema.** Add the key to
      `src/scripts/schemas/rule.schema.json` with an explicit semantic: the
      declared token ceiling for the rule's normative core, and the pointer to
      where the non-normative remainder lives. Optional at introduction — a
      required key would red every one of the existing rule files on the day it
      lands, which is the gate-that-teaches-you-to-ignore-it failure the
      preamble budget file already warns about in its own `_comment`.
      verify: `grep -n '"norm"' src/scripts/schemas/rule.schema.json` returns the new key; the pre-state is `git show HEAD:src/scripts/schemas/rule.schema.json | grep -c '"norm"'` = 0.
- [ ] **1.2 Lint the pin.** A gate that, for every rule declaring `norm`,
      measures the body with the exact tokenizer and fails when the measured
      normative section exceeds its declared pin. Rules without `norm` are
      skipped, reported as a count, and the count is the phase's own progress
      metric.
      verify: `./scripts-run src/scripts/<the new lint> 2>&1 | tail -3` exits 0 and names the skipped count.
- [ ] **1.3 Pilot on the ranked top of Phase 0's census.** Take the highest-token
      rules the census names and migrate their rationale out under the P4
      pattern, declaring `norm` on each. Do not batch the whole corpus — a
      pilot that misses its target is a cheap finding, a corpus-wide rewrite
      that misses is an unreviewable diff.
      verify: `./scripts-run src/scripts/check_standing_rule_delivery 2>&1 | tail -4` reports a lower total than the 120,857 recorded in Context, and `./scripts-run src/scripts/check_source_size_budget 2>&1 | tail -3` did not regress.
- [ ] **1.4 Prove the moved prose is still reachable.** Every passage relocated
      in 1.3 has an inbound pointer from the rule it left.
      verify: `./scripts-run src/scripts/check_references 2>&1 | tail -3` exits green and `./scripts-run src/scripts/check_condensation 2>&1 | tail -3` exits green.

## Phase 2 — publish the per-rule before/after, misses included

A diet with no published per-rule number is unfalsifiable. The failure mode this
phase exists to prevent is the one where a total drops, the roadmap closes, and
nobody can say which rules actually got shorter and which were merely counted.

- [ ] **2.1 Publish the per-rule before/after table.** One row per rule touched:
      measured tokens before, after, delta, and where the remainder went. Exact
      tokenizer, never the chars/4 proxy, and the method named in the table
      header — this tree already distinguishes the two and a table that hides
      which one it used is not evidence.
      verify: the table exists under `agents/evidence/analysis/`, and `./scripts-run src/scripts/check_standing_rule_delivery 2>&1 | grep -E "TOTAL|tokens_gpt"` shows the method line quoted in the table header.
- [ ] **2.2 Publish the misses in the same table.** Every rule that was targeted
      and did not shrink, with one sentence on why. A rule whose body is
      irreducibly normative is a legitimate row, and it is the row that tells the
      next reader where the lever stops working.
      verify: `grep -ci "no reduction\|irreducible\|miss" <the published table>` is non-zero, or the table states explicitly that zero targeted rules missed.
- [ ] **2.3 Reconcile against both gates and record the residual.** If either
      gate is still over its ceiling after the diet, the residual is written down
      with the mechanism that would close it — never re-baselined to make the
      read green.
      verify: `./scripts-run src/scripts/check_preamble_payload_budget 2>&1 | tail -5` and `./scripts-run src/scripts/check_standing_rule_delivery 2>&1 | tail -4`, both quoted in the reconciliation note; `git diff HEAD -- src/config/preamble-payload-budget.json` shows no change to `baseline_tokens`.

## Blockers

### blocker: b-behavioural-bench-spend
- **Status:** open
- **Owner:** maintainer
- **Class:** 2 — consent-once (name a budget, or defer to the budget ledger)
- **Blocks:** nothing in Phases 0, 1 or 2 directly. It is carried here because
  the parked sibling `agents/roadmaps/later/road-to-mixed-trigger-activation-cost.md`
  holds the remaining fifteen always-on rules behind it, and those fifteen are
  the largest single tranche this diet would otherwise contend for. Working both
  levers on the same fifteen files in parallel would make neither measurable.
- **What to do:** pick exactly one — (a) authorise the paired A/B run the parked
  sibling describes (it bills model tokens across 5–8 tasks in two arms) so the
  behavioural question is answered and the fifteen rules become available to
  either lever with evidence attached; or (b) declare the fifteen **out of scope
  for this roadmap** for its duration, so the diet targets only rules the sibling
  does not hold, and record that decision at this blocker. Note that the sibling
  already carries a maintainer recommendation to defer the spend to a budget
  ledger — option (b) is consistent with that and costs nothing today.
- **Recommendation:** **(b) — declare the fifteen out of scope here.** The diet
  has a ranked census of its own from Phase 0 and does not need those files to
  demonstrate the lever. Choosing (a) buys a behavioural answer this roadmap does
  not depend on, at the roadmap's most expensive price.
- **If you do nothing:** Phase 1.3's pilot has to pick its targets without knowing
  whether the fifteen are contended, and any overlap makes the published Phase 2
  numbers uninterpretable — two levers, one delta, no attribution.
- **Resolved when:** one of (a) or (b) is recorded at this blocker, and — for (b) —
  Phase 1.3's target list explicitly excludes the fifteen the sibling names.

### blocker: b-colleague-machine-readings
- **Status:** open
- **Owner:** maintainer
- **Class:** 2 — consent-once (another person's filesystem)
- **Blocks:** Phase 2 step 2.3's claim that the diet worked *in general* rather
  than on one machine. Steps 0.x, 1.x, 2.1 and 2.2 all proceed without it.
- **What to do:** pick exactly one — (a) obtain a `check_standing_rule_delivery`
  reading from at least one second machine, before and after the diet, and record
  both in the Phase 2 table; or (b) scope every Phase 2 claim explicitly to the
  measuring machine and say so in the table header, accepting that the global
  layer's 103 files are whatever that one developer happens to have projected.
- **Recommendation:** **(b) — scope the claim.** The gate's own module docstring
  already states both inputs are machine-local by construction, and asking another
  person to run a probe on their filesystem is a consent question this roadmap
  cannot answer for them. A scoped honest claim beats an unscoped one.
- **If you do nothing:** Phase 2 publishes a single-machine number phrased as a
  general one, which is the unscoped-verdict failure this tree has recorded before.
- **Resolved when:** either a second machine's before/after readings appear in the
  Phase 2 table, or the table header carries the explicit single-machine scope.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The diet deletes instead of relocating | implementation | `preservation-guard` requires every paragraph, bullet and fence to survive a transformation. A body diet is exactly the transform it governs, and the cheapest way to hit a token target is to drop the rationale outright | Phase 1.4 gates on `check_references` and `check_condensation`; the `norm` semantic in 1.1 requires a pointer to where the remainder went, so a pin without a destination is malformed | Phase 1 — the body diet: a `norm` pin plus its lint |
| 2 | Phase 0's re-derivation finds no burst at all | product | The source figure does not reproduce by a factor of nineteen. The real answer may be that the corpus was already over and the 102,520 baseline is simply stale, which would mean the diet has no recent inflow to reverse and must shrink long-standing prose instead | 0.1 explicitly accepts "no burst" as a finding and says it changes Phase 1's target selection; the pilot in 1.3 is driven by the census ranking, not by recency | Phase 0 — stop the drift before dieting |
| 3 | `norm` becomes a number nobody derives | implementation | A per-rule pin invented at authoring time is an invented threshold. If pins are guessed, the lint enforces guesses and the gate teaches authors to pick a comfortable number | 1.1 makes the key optional and 1.2 reports the un-pinned count; pins land only on rules the Phase 0 census actually measured, so every pin has a measurement behind it | Phase 1 — the body diet: a `norm` pin plus its lint |
| 4 | The delta comment becomes a second blocking gate | implementation | A per-PR number that fails a build duplicates the ratchet and double-fails every legitimate rule addition, which is how a reporting surface becomes noise people route around | 0.3 states report-only in the step itself; the ratchet stays the only failing gate on this number | Phase 0 — stop the drift before dieting |
| 5 | Two levers contend for the same fifteen rules | implementation | The parked sibling holds fifteen always-on rules behind `b-behavioural-bench-spend`. If the diet also targets them, the published before/after cannot attribute its delta to either lever | `b-behavioural-bench-spend` forces an explicit in-or-out decision before 1.3 picks targets | Phase 1 — the body diet: a `norm` pin plus its lint |
| 6 | Phase 2's number is single-machine and reads as general | product | Both gates are machine-local by construction; the global layer's file count is whatever one developer projected | `b-colleague-machine-readings` forces either a second reading or an explicit scope line in the table header | Phase 2 — publish the per-rule before/after, misses included |

## Acceptance Criteria

- [ ] AC-1 — `src/scripts/schemas/rule.schema.json` carries a `norm` key with a
      stated semantic, and at least one rule file declares it. Before this
      roadmap the key existed nowhere in the tree (0 hits, measured 2026-08-22).
- [ ] AC-2 — A lint measures every declared `norm` pin with the exact tokenizer
      and reports the un-pinned remainder as a count, so the un-pinned fraction
      is a published number rather than an unknown.
- [ ] AC-3 — A per-PR standing-payload delta against the merge-base is posted on
      pull requests and is registered in the gate ledger under CI-identical argv.
      It reports; it does not fail a build.
- [ ] AC-4 — A per-rule before/after table exists under
      `agents/evidence/analysis/`, names its tokenizer method in the header, and
      contains the rules where the diet achieved nothing alongside the rules
      where it worked.
- [ ] AC-5 — `check_standing_rule_delivery` reads a lower total than the 120,857
      recorded in Context, measured on the same machine both times, with the
      residual written down if it is still above the 110,000 cap.
- [ ] AC-6 — `baseline_tokens` in `src/config/preamble-payload-budget.json` is
      unchanged by this roadmap. Any remaining overrun is recorded as a residual
      with its closing mechanism named, never absorbed by moving the ratchet.
- [ ] AC-7 — The re-derived inflow attribution and the source-pass divergence are
      both written down with the commands that produced them, so the drift can be
      re-measured later against a stated method rather than a remembered one.
