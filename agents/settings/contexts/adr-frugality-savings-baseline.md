# ADR — Frugality Canon Savings Baseline

> **Status:** Decided · Phase 0 of `road-to-trim-frugality-canon` · 2026-05-08
> **Context:** [`road-to-trim-frugality-canon.md`](../roadmaps/road-to-trim-frugality-canon.md) ·
> [`frugality-charter.md`](../../.agent-src.uncondensed/contexts/contracts/frugality-charter.md)
> **Harness:** [`scripts/measure_frugality_savings.py`](../../scripts/measure_frugality_savings.py)
> **Local log:** `agents/.frugality-baseline.jsonl` (gitignored — running record)

## Decision

Lock the **canon-state baseline** captured by the harness on 2026-05-08
as the savings-floor reference for every Phase 1+ trim PR in
`road-to-trim-frugality-canon`. Subsequent runs of the harness diff
against these numbers; the per-phase decline conditions below fire
revert if a trim regresses below the floor.

## The locked baseline

### A — Kernel & tier footprint

| Bucket | Chars | % of 26 000 kernel budget |
|---|---:|---:|
| Kernel canon (3 rules) | **9 998** | **38.45 %** |
| Tier-1 canon (2 rules) | 5 617 | n/a — outside kernel |
| Tier-2 canon (1 rule) | 1 770 | n/a |
| `frugality-charter.md` (context) | 3 853 | n/a — Writer-flow only |

### B — Per-rule kernel concentration

| Rule | Tier | Chars | % of kernel |
|---|---|---:|---:|
| `direct-answers` | kernel | 3 264 | **12.55 %** ⚠️ above 12 % limit |
| `no-cheap-questions` | kernel | 3 479 | **13.38 %** ⚠️ above 12 % limit |
| `ask-when-uncertain` | kernel | 3 255 | **12.52 %** ⚠️ above 12 % limit |
| `user-interaction` | tier-1 | 2 487 | — |
| `telegraph-speak` | tier-1 | 3 130 | — |
| `token-efficiency` | tier-2 | 1 770 | — |

All three kernel rules sit **above the 12 % single-rule concentration
limit** stated in the kernel-budget governance. Phase 1+ trims are
therefore a budget hygiene fix, not just a polish pass.

### C — Cross-ref redundancy

`agent-src.uncondensed` "Interactions / See also / Related" tail
blocks across the six canon rules: **840 chars total**. Phase 1
target: ≥ 75 % removal (≥ 630 chars), with retained references
folded into `frugality-charter.md` index.

### D — Filler-prevalence (heuristic, signal-light)

Harness B-metric run against `agents/.agent-chat-history` (25 agent
turns): **0.000 hits/turn** across 11 filler patterns. **This is
below the detection threshold, not a true zero** — chat-history
texts are crash-recovery digests, not full transcripts. Treat as
"no observable regression marker" — it cannot prove savings, only
flag a clear regression after Phase 1+ runs against a future full-
transcript corpus.

## The savings floor (locked)

Phase totals from the roadmap, expressed as **minimum** acceptable
reclaim per PR. Numbers below trigger revert of that single PR;
numbers above pass and bank toward the canon goal.

| Phase | Scope | Floor (chars) | % of kernel |
|---|---|---:|---:|
| 1 — Low-Risk Trims | Severity table, cheap-Q catalog, vague triggers, all "Interactions" tails | **≥ 1 500** | **≥ 5.77 %** |
| 2 — Iron-Law Condensation | Restatement-line collapse | **≥ 320** | **≥ 1.23 %** |
| 3 — Tier-2 Tightening | `token-efficiency` anti-loop block | **≥ 400** (tier-2) | n/a |
| 4 — Charter Decoupling | Carve-out predicates relocation | **≥ 460** (context) | n/a |
| **Cumulative kernel** | Phases 1+2 | **≥ 1 820** | **≥ 7.0 %** |

Cumulative kernel goal is **65 %** of the roadmap's design-time
target (2 780 chars / 10.7 %). Anything below the cumulative floor
pauses Phase 3+ and triggers a fresh council round on whether the
canon can hit the design goal at all without quality regression.

## Decline conditions (revert triggers)

A merged trim PR is **reverted** when a re-run of the harness shows
any of:

1. Phase floor missed for that PR's scope (table above).
2. **Per-rule condensation ratio drops > 10 %** below baseline
   (metric C). Indicates a rule got *longer* on the uncondensed
   side, defeating the purpose.
3. **Filler prevalence rises above 0.05 hits/turn** when measured
   against any post-trim corpus ≥ 50 turns of full-transcript
   captures (i.e. once a real corpus exists; current 0.0 baseline
   stands in until then).
4. **Iron-Law literal count drops** for a kernel rule. Iron Laws
   are the bite of the canon; we trim around them, never through
   them. (Manual count, recorded in the PR body.)

## Why this is the right floor

- **Anchored in the harness, not vibes.** Numbers come from a
  deterministic script that anyone can re-run; no claim survives
  without a fresh harness run in the PR body.
- **Honest about what we can't measure.** The filler metric is
  signal-light because the corpus is digests. The ADR says so
  explicitly instead of pretending 0.0 is a clean baseline.
- **Concentration-limit fix is the floor of the floor.** All three
  kernel rules are above the 12 % single-rule limit. Even the
  minimum Phase 1 reclaim (1 500 chars) drags `no-cheap-questions`
  back under 12 % when distributed across the three kernel rules.
- **Council convergence preserved.** Phases 1–4 mirror the council
  consensus (low-risk trims, Iron-Law condensation, no rule mergers).
  No phase introduces new design moves the council didn't bless.

## Re-running the harness

```bash
python3 scripts/measure_frugality_savings.py
# appends one record to agents/.frugality-baseline.jsonl
# diff against this ADR's locked numbers per PR
```

## What this ADR does NOT lock

- **Whether a Phase 1+ trim is worth shipping at all.** Floors are
  *necessary*, not *sufficient*. A PR can hit the floor and still
  be reverted on quality grounds (Iron-Law count, council re-run,
  user veto).
- **The chat-history corpus shape.** A future "full-transcript
  capture" path is not yet specified. Until it exists, metric B
  remains signal-light and the floor leans on metrics A, C, D.
- **Tier-1 / tier-2 / charter goals beyond Phases 3 and 4.** No
  Phase 5 currently scoped; the cumulative floor stops at the
  kernel reclaim.
