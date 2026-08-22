---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
---
# Road to subagent envelope adoption

> **Source:** agents/tmp.old/feedback-14.8.0 — a dropped inbox artifact
> proposing that the subagent return-envelope contract be delivered where
> workers can actually read it. Every claim below was re-verified against the
> tree on 2026-08-22, and the adoption figures were re-derived from the live
> ledger on the same day.

## Goal

One return-envelope shape is stated once, delivered on the path workers
actually take, and its adoption is a published number with a window and a
denominator. Today the same contract exists in three mutually inconsistent
states, and the one measurement of it reads zero. When this is finished a
reader can name which shape is canonical, which dispatcher delivers it, and
what fraction of stops conform — and can tell a rising rate from a flat one
without re-deriving it.

## Context

**The finding is a three-way divergence on one contract, not a missing
delivery.** All three legs were re-checked on 2026-08-22.

1. **Mandated, model-carried.**
   `src/agent-src/contexts/execution/subagent-spawn-contract.md:173` carries
   worker-prompt rule **(f) Return shape — text-only final message, disk copy
   written first**. It is a context document: the obligation binds whoever
   assembles a spawn prompt by hand, and nothing checks that it was written in.
2. **Implemented, and divergent.** `src/scripts/ai_team/team_dispatch.ts:280`
   DOES inject a JSON contract into an assembled prompt — a narrower one. The
   model-facing shape at `:297` offers three statuses
   (`DONE` | `DONE_WITH_CONCERNS` | `NEEDS_CONTEXT`) over
   `{status, summary, findings[{severity, evidence, suggested_fix, location}]}`.
   Two corrections to the source draft's framing, both re-verified:
   `BLOCKED` **is** in the TypeScript union (`:354`) but is deliberately
   orchestrator-side only — `_MODEL_STATUSES` at `:391` is the three-value set
   the parser accepts from a model. So the divergence is a real field-set
   divergence against
   `src/agent-src/contexts/execution/subagent-response-contract.md`
   (`summary` / `findings` / `risks` / `confidence` / `handoff`, per
   `src/scripts/_lib/subagent_response.ts:43-64`), not a missing status.
3. **Absent.** `src/scripts/dispatch_r2_reviewer.ts` — 1,292 lines, the
   in-tree reviewer dispatcher — has **0** hits for `envelope`,
   `DONE_WITH_CONCERNS`, `response.contract` or `response_contract`.

**Measured adoption, re-derived 2026-08-22 from
`agents/runtime/state/subagent-ledger/2026-08.jsonl` (7,300 rows).** The
ledger is gitignored and machine-local, so these numbers are one machine's and
they drift upward between reads — the handed figures were about 1,731 stops,
and the same query now reads 1,790. Over every row carrying a post-split
`envelope_parse` value (2026-08-13T21:19Z through 2026-08-22T08:13Z,
n = **1,790**): `ok` **0** · `fail` **27** · `no_envelope` **1,763** ·
`no_message` **0**. Restricted to the window strictly after the last `absent`
row — a single-writer window, 2026-08-21T01:23Z through 2026-08-22T08:13Z,
n = **1,769** — `ok` **0** · `fail` **6** · `no_envelope` **1,763**. Both
readings agree on the only figure that matters: **zero valid envelopes**.

**The 27 `fail` rows are foreign objects, not envelope attempts, and this is
derivable from the code rather than probed.** Every one carries
`envelope_error_count: 5` (the field is `envelope_error_count`, not
`error_count` — a correction to the handed finding). `validateResponse` in
`src/scripts/_lib/subagent_response.ts:74-84` performs exactly five top-level
required-field checks — `summary`, `handoff`, `confidence`, `findings`,
`risks` — so an error count of 5 means none of the five is present. A partial
envelope would score 1 through 4.

The classifier itself only OBSERVES: `EnvelopeParse` in
`src/scripts/hooks/subagent_ledger_hook.ts:201` is a four-value union and the
hook writes a verdict without gating anything. **The `fail` /
`foreign_object` split is owned by `road-to-subagent-lifecycle-integrity.md`
Phase 2** — it is not restated here; this roadmap consumes that split's output
and does not change the classifier's vocabulary.

**Two delivery paths are already ruled out, so Phase 1 has one candidate.**
`src/subagents/` holds exactly two files — `_prompt-defense.md` and
`production-validator.md` — and neither names the contract (0 hits for
`envelope` / `handoff` / `response.contract` across the directory).
`condense.ts:1953` treats `_`-prefixed files as partials, so the package
projects exactly **one** agent definition
(`.claude/agents/production-validator.md`). An "append the contract to every
projected agent definition" strategy therefore reaches one definition and
cannot reach a host built-in agent type at all. Separately,
`spawn-guard-shadow` is **already bound** on `pre_tool_use` with
`tools: [Agent, Task]` (`src/scripts/hook_manifest.yaml:863-868`, bound at
`:960` and `:1014`), shadow-only and `fail_closed: false` — so a hook-side
delivery is a delta on a shipped concern, not a new mechanism.

## Phase 0 — Reconcile the three deliveries into one shape

- [ ] **Step 0.1:** write the divergence down as a table, one row per field.
      Columns: field · spawn-contract (f) · `team_dispatch` model-facing JSON ·
      `subagent_response.ts` validator · `dispatch_r2_reviewer`. Land it in the
      response contract itself, not in this roadmap, so the next author reads
      it where the shape is defined. <!-- blocked-by: b-classifier-vs-contract -->
      verify: `grep -c team_dispatch` over
      `src/agent-src/contexts/execution/subagent-response-contract.md` returns
      1 or more, where the same grep against the `git show HEAD:` copy of that
      path returns 0.
- [ ] **Step 0.2:** name the canonical shape and state which direction the
      classifier moves. Either the validator conforms to a widened contract, or
      the contract narrows to what the validator already accepts. Both
      directions change what a shipped `envelope_parse` value MEANS for the
      1,790 rows already on disk, which is why this is a blocker and not a
      step. <!-- blocked-by: b-classifier-vs-contract -->
      verify: the blocker entry's `Status:` reads `resolved` and names one of
      its two options; `./scripts-run src/scripts/lint_roadmap_blockers`
      exits 0.
- [ ] **Step 0.3:** record the historical-reading caveat at the ledger's own
      reader. Pre-reconciliation rows were classified against the shape that
      existed when they were written; a reader of the 2026-08 window must not
      read them as conforming or non-conforming to the reconciled shape.
      verify: `grep -c reconcil src/scripts/hooks/subagent_ledger_hook.ts`
      returns 1 or more, where the same grep against the `git show HEAD:` copy
      of that path returns 0.

## Phase 1 — Deliver the pointer on the dominant path, and publish the rate

- [ ] **Step 1.1:** project the reconciled contract in POINTER form, at most
      240 chars, into the dominant dispatch path only. 240 is not arbitrary —
      it is `MAX_RESPONSE_LINE_CHARS` in
      `src/scripts/_lib/subagent_response.ts:35`, so the pointer is one
      line-shaped field by the contract's own measure. The dominant path is
      whichever of `team_dispatch` / `dispatch_r2_reviewer` step 0.1's table
      shows carries more stops; it does not fan out to both.
      verify: the emitted prompt constant's length, printed by a `node -e`
      one-liner over it, is at most 240; and the constant appears exactly once
      under `src/scripts/`.
- [ ] **Step 1.2:** publish `valid_envelope_rate` with its window and
      denominator. Three numbers, never one: the rate, the window bounds, and
      the stop count. A rate with no denominator is a claim, not a measurement.
      verify: the reporting script prints all three on one line, and the line
      names the ledger path it read.
- [ ] **Step 1.3:** register the target as greater than zero and rising,
      explicitly NOT 95 % on the first window. The pre-pointer rate is
      0/1,790. A first window that reaches any non-zero rate has demonstrated
      the pointer is readable at all; a first window held to 95 % would fail
      for reasons the measurement cannot separate from the pointer's own
      effect.
      verify: the registered target text for the Phase 1 arm contains no
      percentage figure — a `grep -c '%'` over that arm's registration lines
      returns 0.

## Phase 2 — A second window, to 95 % or to a named reason per failing class

- [ ] **Step 2.1:** collect a second window of at least 500 production-shaped
      stops and recompute the rate.
      <!-- blocked-by: b-production-window-reach -->
      verify: the published window's stop count is 500 or more and its start
      bound is later than Phase 1's end bound.
- [ ] **Step 2.2:** either the rate clears 95 %, or every failing class carries
      a named reason. A class with no reason is an open finding, not a
      tolerated residual. The four classes are the classifier's own union
      (`subagent_ledger_hook.ts:201`), so the enumeration is closed and cannot
      grow to absorb a surprise.
      verify: for each `envelope_parse` value present in the window with a
      non-zero count, the report carries a prose reason; the count of
      reason-less non-`ok` classes is 0.
- [ ] **Step 2.3:** run one deliberately-broken sensitivity arm and record that
      it went RED. Emit a prompt with the pointer removed and confirm the rate
      returns to 0 for that arm. A rate that never moved down has unknown
      sensitivity and cannot support the Phase 2 claim.
      verify: the sensitivity arm's recorded rate is 0 and its stop count is
      stated; the arm is named in the same report as the main window.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The reconciled shape is chosen to match whichever implementation was cheapest to leave alone | implementation | Step 0.2 picks the validator's field set because changing it is cheap, and the spawn contract's two clauses (text-only final message, disk copy first) quietly stop being part of the shape — the exact clauses measured to lose whole runs | The blocker's option set names both directions explicitly and requires the chosen one to state what it drops; step 0.1's per-field table makes a silent drop visible as an empty cell | Phase 0 |
| 2 | The pointer is delivered, the rate stays 0, and the number is read as "the pointer failed" | product | A flat rate has at least three causes — the pointer is unreadable, the dominant path was misidentified, or workers on that path never emit a final assistant message at all — and a single rate cannot separate them | Step 1.1 restricts delivery to ONE path so the attribution is unambiguous; step 2.3's broken arm establishes that the measurement can move at all | Phase 1 |
| 3 | The second window is assembled from drain runs and reads as production | implementation | Machine-local drain traffic is the only available source of stops, and its shape (one orchestrator, long-lived, few agent types) is not the shape produced elsewhere — a 95 % rate over drain stops would be published as if it generalised | The blocker names this as its own subject and requires the window's composition to be stated with the rate; a window whose agent-type distribution is unpublished does not satisfy AC-3 | Phase 2 |
| 4 | Adoption is declared on the pointer landing rather than on the rate | implementation | "The contract is now delivered" is checkable and true the moment step 1.1 merges, and it says nothing about whether any worker read it — this is the completion claim the acceptance criteria are written to refuse | Every AC below is phrased on a published number with a denominator; none is satisfied by a merged file | Phase 1 |

## Acceptance Criteria

- [ ] AC-1 — One canonical envelope shape is stated in one place, and the
      per-field table shows for each of the four surfaces whether it conforms,
      diverges, or is silent. A surface with an empty cell is a finding, not a
      pass.
- [ ] AC-2 — `valid_envelope_rate` is published with its window bounds and its
      stop count, and the pre-pointer baseline (0 of 1,790 over
      2026-08-13T21:19Z through 2026-08-22T08:13Z) is recorded alongside it so
      drift in either direction is readable.
- [ ] AC-3 — The second window's rate is either 95 % or higher, or every
      `envelope_parse` class with a non-zero count carries a named reason; and
      the window's stop count and agent-type composition are both published.
- [ ] AC-4 — A sensitivity arm with the pointer removed is recorded as having
      gone RED (rate 0, stop count stated). Absent that arm, the Phase 2 rate
      is reported as unverified rather than as a pass.

## Blockers

### blocker: b-classifier-vs-contract

- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 0.1, step 0.2
- **Class:** 3
- **What to do:** pick exactly one — (a) widen
  `src/scripts/_lib/subagent_response.ts` to the union of the three shapes, so
  `team_dispatch`'s `{severity, evidence, suggested_fix, location}` findings
  validate and the 1,790 already-classified rows keep their meaning; or (b)
  narrow the response contract to what the validator already accepts and change
  `team_dispatch`'s model-facing JSON at `:297` to match, accepting that its
  historical rows were classified against a shape that no longer exists.
- **Recommendation:** (b). The validator's five required fields are the shape
  the ledger has been measuring for the whole window, and `team_dispatch` is
  one call site with one prompt constant; widening the validator instead makes
  every future divergence legal by construction, which is how this contract
  came to have three states in the first place.
- **If you do nothing:** Phase 0 cannot start, and the ledger keeps writing a
  verdict whose meaning depends on which of three shapes the reader assumed —
  so the 0-of-1,790 figure cannot be cited as evidence about any one contract.
- **Resolved when:** the response contract names one canonical field set, the
  `team_dispatch` prompt constant and the validator agree with it, and the
  historical-reading caveat from step 0.3 is recorded at the classifier.

### blocker: b-production-window-reach

- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 2.1
- **Class:** 3
- **What to do:** pick exactly one — (a) accept drain-run stops as the Phase 2
  window and publish its agent-type composition alongside the rate, marking the
  result machine-local and not generalised; or (b) hold Phase 2 until at least
  500 stops arrive from a source other than this machine's drain runs, and
  record in the roadmap that Phase 2 is parked rather than failing.
- **Recommendation:** (a). The ledger at
  `agents/runtime/state/subagent-ledger/2026-08.jsonl` is gitignored and
  machine-local by design, so (b) has no arrival channel to wait for — parking
  on it is an indefinite deferral dressed as rigour. Publishing the composition
  makes the limit readable instead of hidden.
- **If you do nothing:** Phase 2 either never runs, or runs on drain stops and
  publishes a 95 % rate that reads as a general claim about traffic elsewhere.
- **Resolved when:** the Phase 2 window is either published with its
  composition and a machine-local caveat, or the roadmap records Phase 2 as
  parked with the arrival condition named.
