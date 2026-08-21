---
adr: 234
status: accepted
date: 2026-08-19
decision: curated-memory-verification-and-eviction
supersedes: —
superseded_by: —
phase: road-to-context-fidelity
type: structural
review_trigger: >-
  Reopen if a mechanical signal is ever measured ABOVE the store's staleness
  base rate, since the human-verdict requirement rests entirely on cf04's
  finding that none exists and would be unjustified the moment one does; if the
  per-store windows produce a re-verification load nobody sustains, since a
  deadline nobody meets is a uniform 365-day window wearing a smaller number;
  or if quarantine accumulates without anything ever returning from it, since
  that would mean the ladder is a deletion queue with an appeal nobody uses
---

# ADR-234 — Curated memory carries verification stamps and decays through a quarantine ladder

## Status

Accepted.

## Context

The curated engineering memory store is injected at session start and read as
fact. Nothing removed entries from it, and nothing could tell a true entry from
a false one.

Spike cf02 (2026-08-17) measured the gap. Against the tree, **21.5 % of the 107
entries were stale** — the tree contradicted them. The shipped instrument
reported **0.0 %**. Both numbers were correct about what they measured:

- Every entry carried the same `last_validated` (`2026-07-09`) and the same
  `review_after_days` (365), so the earliest date any entry could read stale was
  2027-07-09. The check passed because it could not fail.
- No entry carried a commit anchor, so a date could not be tied to a tree state.
  A verified entry and a re-stamped one were indistinguishable.
- Staleness was not uniform (45.8 % / 17.6 % / 13.6 % across the three stores)
  and arrived in **batches**: two upstream changes — ADR-201 removing markdown
  condensation, and the deletion of the `subagents.auto` setting — accounted for
  11 of 22 stale entries.

## Decision

Three things, and one deliberate absence.

**1. Entries carry a verification stamp that can be falsified.**
`verified_at_commit` records the tree revision an entry was *semantically
verified against* — explicitly not the commit that last edited the YAML.
`semantic_verdict` (`still-true` / `stale` / `unverifiable`) records the outcome
of that reading, and `semantic_verdict_at` records when. All three are optional
and additive; nothing rejects an entry that lacks them.

**2. `review_after_days` is per store, derived from cf02.** 30 days for
`historical-patterns`, 90 for `incident-learnings` and `product-rules` — the
measured decay ratio, rounded to operational units. The linear days-to-10 %
figures (9 / 22 / 29) are published alongside in the data-format guideline
rather than shipped as deadlines, because batch-driven decay makes a linear day
count the right shape for a ratio and the wrong shape for a deadline.

**3. A quarantine ladder, driven by human verdicts and age.**
`semantic_verdict: stale` demotes immediately regardless of age —
*contradiction outranks retention*. Age past two windows demotes an unread
entry. A further window in quarantine deletes it. Demotion is a **move between
tracked files** (`agents/memory-quarantine/<type>.yml`), never an in-place
status flip: the entry leaves the injected store but stays readable, so a
demotion is appealable and a re-verified entry returns.
`unverifiable` entries are surfaced on age but never quarantined on it — the
tree can never discharge the reason, so an age threshold would evict them on a
schedule for a cause that cannot be answered.

**The absence: no mechanical signal drives a demotion.** This was put to the AI
council on 2026-08-19 (anthropic + openai, two rounds, blind peer review,
unanimous), which chose a pointer-liveness sweep narrowed to triage and said
demotion must stay human-gated. The sweep was then built and measured against
cf02's ground truth, and **failed its own pre-registered falsifier**: precision
0.0 % against a 20.6 % base rate on dead citations, 15.4 % once anchor drift was
added — a lift of 0.00x and 0.75x respectively. Every configuration is worse
than picking an entry at random (`context-fidelity-cf04.md`).

The instrument survives, renamed to what the measurement left standing:
`report_memory_pointers` reports dead, moved and unparseable citations plus
anchor coverage. That is real documentation debt and a real prerequisite. It is
not evidence about truth, and nothing in the ladder reads it.

## Consequences

- The age axis can fire for the first time: `check_memory` reported 0 staleness
  findings before this change and 13 after, on an unchanged store.
- 22 entries carrying a recorded `stale` verdict left the curated store on the
  first ladder run — 107 curated entries became 85.
- Every consumer install inherits three optional keys and no obligation. An
  install that stamps nothing keeps exactly today's behaviour, with a per-store
  window instead of a uniform one.
- Re-verification is now a recurring cost that lands on a human. The 30-day
  window on `historical-patterns` is the sharpest edge of that and the first
  thing the review trigger asks about.

## Alternatives considered

- **Ship the ladder on cf02's hand reading with no instrument** (the blocker's
  do-nothing branch). Rejected by the council for reproducibility; and cf04 then
  showed the instrument does not supply the *ranking* half anyway. What it does
  supply — a reproducible anchor-coverage and citation-integrity reading — is
  why it still ships.
- **A full semantic sweep** (the council's Option 1). Rejected: entry bodies are
  free prose, so an automated truth verdict is not buildable, and an instrument
  claiming one would reproduce the 0.0 % artefact in a new form.
- **Age-only expiry with no verdict field.** Rejected: age is a proxy.
  Contradiction against the tree is the actual signal, and cf02's batch finding
  shows the two are not even correlated in time.
- **Deleting stale entries outright.** Rejected: it forecloses appeal and
  contradicts the store's own "history is the value of memory" anti-pattern.
  Quarantine keeps the entry inspectable and reversible.
- **Auto-demoting on the pointer report.** Rejected twice over — by the council
  in advance, and by cf04's measurement afterwards.

## References

- `agents/evidence/eval-findings/context-fidelity-cf02.md` — the staleness census
- `agents/evidence/eval-findings/context-fidelity-cf04.md` — the honest null on pointer liveness
- `docs/guidelines/agent-infra/engineering-memory-data-format.md` — the schema and the ladder
- `src/scripts/memory_eviction.ts`, `src/scripts/report_memory_pointers.ts`
- `agents/roadmaps/archive/road-to-context-fidelity.md` — Phase 2
