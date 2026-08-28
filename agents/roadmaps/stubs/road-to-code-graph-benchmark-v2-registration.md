---
complexity: bounded
review_by: 2026-11-28
---

# Stub: road to a v2 registration of the in-repo code-graph benchmark

> **Stub — not active work.** Created 2026-08-28 by
> `road-to-code-graph-evidence-that-exists`, whose v1 run is complete and
> published. This carries the **v2 registration**, which AI council 2026-08-28
> was explicit must be a **new confirmatory experiment, never a repaired
> continuation of v1**.

## Why a v2 is needed — three defects, all found before or during v1's publication

None of these is a reason to withhold v1. All three are reasons v1 must not be
read as a clean five-class benchmark, which is why its own report withholds an
overall engine verdict.

**1. `path-between` measured nothing (material).** Its three probes are
two-token strings — `"cmdBuild -> getParser"`. The registered runner gives both
arms a single probe token: the grep arm builds `-P '\b<probe>\b'` and the graph
arm matches node symbols containing the probe, and neither can match a token
containing ` -> `. All three rows are `0/0` for **both** arms. It does not favour
either arm; the class simply produced no information, and v1 reports it as
`VOID — INSTRUMENT FAILURE` beside the registered arithmetic rather than in place
of it.

**Found by the corpus's own author**, in a review pass after the corpus had
already been committed, pinned and run. They restored the file to its registered
bytes rather than editing a registered-and-run corpus — which is the correct call
and is why v1's record is intact.

**2. `ac-references-01` carries a mislabelled property.** The probe `_total_usd`
was intended as a grep-over-answer case via a `max_total_usd` substring
collision. Under word-boundary matching there is no collision: grep returns
exactly the two truth files. The registered scores are unaffected (1/1 vs 1/1) —
only the corpus's claim about *why* the question is interesting is wrong.
`evaluateQuorum` holds that property genuinely (grep returns 4 files, of which
`events_log.ts:287` and `config.ts:519` are comment-only).

**3. `sh-references-01` carries a false note.** It asserts a line-level substring
over-answer on `SettingsClass`; word-boundary matching does not match
`SettingsClassRow` and friends, so the claim is untrue as written. Scores again
unaffected.

## What v2 must change — the council's design guidance, recorded

AI council 2026-08-28 (anthropic + openai, 1 round, $0.00), on the negative
controls. The seats **split**, and the split resolves by naming the claim rather
than by picking a letter:

- If the claim were *"graph retrieval replaces grep for repository
  investigation"*, literal-string controls are valid and their failure matters.
- If the claim is *"graph retrieval improves structural code questions"* — which
  is the only claim v1 makes — those controls sit outside the construct.

Either way the v1 floor stays reported as FAILED, because it was registered and
cannot be discarded after the fact. What v2 must do is **separate two things the
v1 registration conflated**:

1. **In-domain negative controls** — symbol-shaped probes whose correct answer is
   empty. These test false positives and precision, and a symbol index can
   legitimately be held to them.
2. **Capability-boundary tests** — literals, filenames, config keys, comment
   fragments. Reported **separately**, as a statement about when grep remains
   necessary, never folded into a recall floor the engine cannot clear by
   construction.

> Do not make an unsupported symbol index clear a literal-search recall floor.
> If the product claims general repository search, test a composed
> graph-plus-text system instead.

And on the run itself: **re-run the entire benchmark under v2**, not merely the
repaired class. A registration is a coherent protocol or it is not one.

## Seed content on promotion

- `internal/bench/code-graph/inrepo-corpus-v2-SEED-NOT-REGISTERED.yaml` — the
  corpus author's corrected file, carrying a mechanical rule for the
  `path-between` probe (the single START symbol) and the two note corrections.
  **It is a seed, not a registration.** It is deliberately named so it cannot be
  mistaken for one, and nothing reads it today.
- A v2 pre-registration document, sibling to
  `PREREGISTRATION-inrepo-2026-08-28.md`, never an edit of it.
- A v2 runner change so the `path-between` class uses the engine's own
  `path <a> <b>` verb, with a fair two-probe equivalent for the grep arm.

## Promotion gate

There is no external dependency here — everything needed is in this repository,
which is what distinguishes this stub from
`road-to-code-graph-benchmark-rerun.md`, whose inputs are irrecoverable. This one
is parked on **demand**, not on availability: v1 already answers the question the
parent roadmap asked (the engine's number now describes the engine that ships),
and a v2 buys precision on a result that pointed one way in every valid class.

Promote when a decision actually turns on the per-class detail — most likely a
reopen of ADR-246, which would need the `path-between` class to have measured
something.

## Trigger carried from the cancelled step 3.2

`road-to-code-graph-evidence-that-exists` step 3.2 was **cancelled by
measurement** on 2026-08-28: it was conditional on the graph winning a class,
and the v1 run found none. AI council the same day (2/2) added the condition
under which that work becomes live again, recorded here so the cancellation is
not permanent by accident:

> If a v2 registration produces a **winning class**, that creates a NEW
> consumer-integration step — structural candidate selection, provenance
> ("which source answered"), stale/absent fallback, and fixtures — rather than
> reviving the cancelled one.

Both seats were explicit that the fallback half must **not** be built ahead of
that trigger: step 3.3 already enforces stale/absent degradation at the CLI
boundary, and no route reaches the composition-before-creation consumer through
the graph, so building its escape hatch first is machinery for a path nothing
takes.
