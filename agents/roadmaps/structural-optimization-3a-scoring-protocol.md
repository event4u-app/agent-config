---
stability: beta
status: draft
---

# Phase 3a Spike — Scoring Protocol

> **Owner phase:** `road-to-structural-optimization.md` § 0.5.
> **Companion:** [`persona-voice-rubric.md`](../../.agent-src.uncompressed/contexts/judges/persona-voice-rubric.md)
> — measurement instrument; this file is the **process** around it.
> **Spike report (future):** `agents/roadmaps/structural-optimization-3a-spike.md`
> (lands in 3a.0.2).

This document locks the procedure for scoring the 3a.0 validation
spike. Two artefacts together — this protocol plus the rubric — are
the 0.5 deliverable that unblocks 3a from the planning side. The
spike itself runs in 3a.0; that work is gated on 0.5.1–0.5.3 being
locked first (per the DAG in § 0 of the master roadmap).

## Why a separate scoring protocol

The 3a.0 spike measures whether the locked Option-A shape (separate
skill files + shared procedure context) preserves judge persona voice
under real diffs. Subjective scoring without a process collapses to
"the author thinks it's fine". The protocol forces three independent
reads, names the kill-criterion arithmetic, and binds a deadline so
the spike cannot drift open-ended.

## 3-scorer protocol (0.5.1)

| Role | Identity | Responsibility |
|---|---|---|
| **Author** | Engineer who built the slimmed Option-A shape on `judge-test-coverage` | Submits 3 baseline-vs-slim output pairs; fills rubric for self-score |
| **Reviewer 1** | Maintainer not on the spike branch | Independent rubric pass on the same 3 pairs |
| **Reviewer 2** | AI council representative (Anthropic OR OpenAI, not both) | Independent rubric pass; redacted neutral framing per `ai-council` skill |

Each scorer fills the rubric scoring template once per output pair (3
pairs × 3 scorers = 9 rubric matrices). Scores are computed without
seeing the other scorers' results — submitted independently before any
consolidation pass.

### Acceptance arithmetic

The 3a.0.1 voice gate binds **two** thresholds, both must hold:

1. **Aggregate mean across all 5 dimensions, all 3 scorers, all 3
   pairs ≥ 3.5/5** (0.5.1 average rule).
2. **Tone dimension mean ≥ 4.0/5** (3a.0.1 voice-preservation
   threshold).

Either threshold missed → escalate to council per 0.5.1 (council
either rework-once or invoke 3a.0.2 abort).

### Individual-scorer floor

If any single scorer's per-pair mean drops below **3.0/5**, the result
escalates to council regardless of aggregate. This blocks the case
where two enthusiastic scorers wash out one strong dissent.

### Tie-breaking

If aggregate hits exactly 3.5 or tone hits exactly 4.0, the result is
**accept**. The thresholds are inclusive, the escalation is for clear
failures only — over-eager escalation defeats the deadline mechanic.

## 5-day decision deadline (0.5.3)

The clock starts the moment the author submits the first output pair
to Reviewer 1. Calendar days, not working days, to keep the cap
predictable across timezones.

| Day | Activity |
|---|---|
| 0 | Author submits 3 output pairs + author's own rubric scores |
| 1–2 | Reviewer 1 + Reviewer 2 score independently (no cross-talk) |
| 3 | Aggregation: compute means; check both thresholds + individual floor |
| 4 | If escalation triggered, council pass + verdict |
| 5 | **Hard deadline.** No verdict by EoD day 5 → default verdict applies |

**Default verdict on deadline lapse:** Q1 = Option A (locked in master
roadmap). 3a.0.2 spike report lands with the partial scoring data and
a note that the deadline default fired. This avoids a stalled spike
holding the rest of Phase 3a hostage; the council still has a veto via
3a.3 dispatch parity later.

## Spike scope confirmation (0.5.4)

The spike runs the locked Option-A only. Option B (single-skill
`mode:`-dispatcher) is **not** prototyped — Q1 rejected it on
persona-isolation, mode-collision, and future-extensibility grounds.

What the spike still tests:

1. **Voice preservation under shared-context extraction** — the rubric
   above (5 dimensions, 3 scorers).
2. **Mode-collision via shared-context priming** — explicit
   security-only diff probe on the slimmed `judge-test-coverage`. If
   the output adopts `judge-security-auditor` framing, that is the
   3a.0.2 kill-criterion firing regardless of voice score.
3. **Latency budget** — slim + load_context vs. baseline single-file
   on three diff sizes (small / medium / large). Cap: ≤ +50ms median.

What the spike does **not** test:

- Option B shape (rejected by Q1; not in scope for empirical
  comparison).
- Verdict-parity across all four judges — that's 3a.3, after rollout.
- LOC savings at family scale — that's 3a.1's audit, gated on this
  spike passing.

## Inputs the spike author MUST collect before day 0

- Three real diffs from past PRs (not synthetic):
  - One small (≤ 50 LOC, single file)
  - One medium (~ 200 LOC, 3–5 files)
  - One large (~ 800 LOC, ≥ 8 files including tests)
- Baseline output from current `judge-test-coverage` for each diff
  (captured before any slim-shape edits).
- Slimmed-shape output from the Option-A prototype for each diff,
  using the same model (`subagents.judge_model`).
- Rubric matrix template ready to fill (copy from `persona-voice-rubric.md`
  § Scoring template).

## Outputs the spike produces

- `agents/roadmaps/structural-optimization-3a-spike.md` — the spike
  report, lands in 3a.0.2.
- 9 filled rubric matrices appended to the spike report (or linked).
- Latency measurements table.
- Mode-collision proxy verdict (boolean: detected / not-detected) plus
  the offending output excerpt if detected.
- Verdict line: **accept** (proceed to 3a.1), **rework-once**, or
  **abort** (file `contexts/judges/no-consolidate-rationale.md`,
  skip 3a.1+).

## References

- `road-to-structural-optimization.md` § 0.5, § 3a, § Definitions
  (Internal vs. External lock).
- [`persona-voice-rubric.md`](../../.agent-src.uncompressed/contexts/judges/persona-voice-rubric.md)
  — measurement instrument.
- [`docs/contracts/context-paths.md`](../../docs/contracts/context-paths.md)
  — `contexts/judges/` allow-list (rubric + future
  `no-consolidate-rationale.md` already named).
