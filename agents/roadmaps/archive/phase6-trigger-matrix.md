---
title: "Phase 6.1 — chat-history-* trigger overlap matrix"
roadmap: agents/roadmaps/road-to-structural-optimization.md
phase: 6.1
stability: beta
locked_at: 2026-05-03
status: closed
verdict: stop_at_6_1
---

# Phase 6.1 — Trigger overlap matrix

**Verdict: < 30% on all 3 pairs → STOP at 6.1** (orthogonal — current
three-rule shape is already optimal). Per roadmap § 6.1 A4 fix this
is **success, not escalation**: the audit ran, the answer was "no
restructure needed", Phase 6 closes here.

## Method

Per roadmap § 6.1: pairwise Jaccard of trigger keyword sets across
the three `chat-history-*` rules. The trigger surface for an `auto`
rule is its frontmatter `description:` field — that string is what
the agent and the rule-loader actually pattern-match on, so the
description is the canonical source of truth for "what fires this
rule".

Tokenization: lowercase, alphanumerics with length ≥ 3, minus a
small stop-list of connectives (`the`, `and`, `for`, `with`, `via`,
…) and the always-shared file-name fragments
(`agent`, `chat`, `history`, `agentchathistory`) which carry no
trigger signal — every `chat-history-*` rule mentions them by
construction.

Reproducibility: `scripts/_one_off_phase6_trigger_jaccard.py`.
Logged at `/tmp/phase6_trigger_jaccard.log`.

## Trigger keyword sets (after tokenization + stop-list)

**`chat-history-cadence`** — 17 tokens

```
appending boundaries cadence check directly handling length never
ownership per_phase per_tool per_turn refusal reply trigger turn
writing
```

**`chat-history-ownership`** — 18 tokens

```
checkpoint classification detects engine first foreign hook manual
match missing numbered options ownership path prompt reference
returning turn
```

**`chat-history-visibility`** — 20 tokens

```
drift emitting handling heartbeat hybrid language marker memory
mode never nothing only paste prints slip stdout subprocess tone
type verbatim
```

## Pairwise Jaccard

| Pair | ∩ | ∪ | Jaccard | Threshold | Branch |
|---|---:|---:|---:|---|---|
| `cadence × ownership` | 2 (`ownership`, `turn`) | 33 | **0.061** | < 0.30 | orthogonal |
| `cadence × visibility` | 2 (`handling`, `never`) | 35 | **0.057** | < 0.30 | orthogonal |
| `ownership × visibility` | 0 (`∅`) | 38 | **0.000** | < 0.30 | orthogonal |

**3 of 3 pairs < 30%.** All three concerns are below the threshold
by a factor of 5×–∞×. The intersection words that do exist are
generic English verbs (`handling`, `never`) and one shared concept
(`turn`/`ownership`) that is exactly the cross-reference relationship
the three rules are *supposed* to share — not a sign of overlapping
trigger surface.

## What the (small) intersections mean

- `cadence × ownership`: `ownership` and `turn` both appear because
  cadence's gate-2 obligation explicitly **defers** to gate-1
  ownership refusal handling. That is a rule-to-rule reference, not
  a duplicated trigger surface. The two rules fire on different
  events (handshake vs. boundary append).
- `cadence × visibility`: `handling` and `never` are both English
  filler in the `description:` field. Zero conceptual overlap.
- `ownership × visibility`: zero shared tokens. Gate 1 (handshake)
  and gate 3 (heartbeat marker) fire on completely disjoint events.

## Decision

Path B from roadmap § 6.1 success criteria:

> **Path B — keep separate (6.1 < 30% branch):** 6.0 dependency
> scan + 6.1 overlap matrix + non-overlap evidence document
> committed. Phase 6 closed; no rule changes. The audit ran, the
> answer was "already optimal" — that is a valid Phase-6 success.

Phase 6.2, 6.3, and 6.4 are **skipped** (the < 30% branch makes them
non-applicable, not deferred). The `chat-history-*` rules ship
unchanged. The dependency scan from 6.0 still ships per Path B; the
non-overlap evidence ships in
[`phase6-non-overlap-evidence.md`](phase6-non-overlap-evidence.md).
