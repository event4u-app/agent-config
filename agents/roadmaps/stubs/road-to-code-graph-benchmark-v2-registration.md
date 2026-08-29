---
complexity: bounded
review_by: 2026-11-28
---

# Stub: road to a v2 registration of the in-repo code-graph benchmark

> **DISCHARGED 2026-08-29 — v2 is registered, run and published.** Created
> 2026-08-28 by `road-to-code-graph-evidence-that-exists`. It carried the **v2
> registration**, which AI council 2026-08-28 was explicit must be a **new
> confirmatory experiment, never a repaired continuation of v1** — and that is
> what shipped. Kept as the record of the design guidance v2 implemented and of
> the seed-vs-stub contradiction that had to be resolved. See § PROMOTED and
> DISCHARGED. Nothing here is open work.

## Why a v2 is needed — three defects, all found before or during v1's publication

None of these is a reason to withhold v1. All three are reasons v1 must not be
read as a clean five-class benchmark, which is why its own report withholds an
overall engine verdict.

**1. `path-between` measured nothing (material) — and NOT symmetrically.
CORRECTED 2026-08-29.** Its three probes are two-token strings — `"cmdBuild ->
getParser"`. The registered runner gives both arms a single probe token: the grep
arm builds `-P '\b<probe>\b'` and the graph arm keeps only relations whose symbol
segment matches the probe, and neither can match a token containing ` -> `. All
three rows are `0/0` for both arms.

This paragraph used to end *"It does not favour either arm; the class simply
produced no information."* **That was false, and it is withdrawn.** Confirmed by
direct execution: `affected "cmdBuild -> getParser"` returns all four truth files,
and the runner's filter then discards every one of them. The grep arm genuinely
found nothing — there is no such text. The graph arm **answered and the scorer
threw the answer away.** The zero is shared; the cause is not, and reading a
shared zero as symmetric is the specific mistake this stub inherited from v1's
report. v1 still reports the class as `VOID` beside the registered arithmetic,
which stands; only its stated cause was wrong.

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

## Two further v1 defects, found 2026-08-29 — both in the scorer

**4. v1 never invoked the shipped `path` verb.** `cli.ts` dispatches
`path <a> <b>` and implements it; v1's graph arm ran `affected` and `query` only.

**5. `symbol:` pseudo-nodes were counted as files.** `p.split('#')[0]` on an
unresolved endpoint such as `symbol:DatabaseSync` returns the whole token, which
v1 added to a set the scorer treats as files — 152 such endpoints in the
`code_graph` root alone. `callers` was ruled `NULL` on the **precision floor
alone**, with recall tied at 1.000/1.000, so that verdict was harness-caused as
well. Under v2's fix graph precision on that class moves 0.258 → 0.667 and the
verdict becomes a TIE.

## PROMOTED and DISCHARGED — v2 was registered and run on 2026-08-29

Everything below was written while this was parked. It is kept because it is the
design guidance v2 implemented, and because the seed-vs-stub contradiction it
contains had to be resolved rather than inherited.

- **v2 registration:** `internal/bench/code-graph/PREREGISTRATION-inrepo-v2-2026-08-29.md`
- **v2 corpus:** `internal/bench/code-graph/inrepo-corpus-v2-2026-08-29.yaml` (19 questions)
- **v2 runner:** `internal/bench/code-graph/run_bench_inrepo_v2.ts`
- **v2 result:** `internal/bench/reports/code-graph-vs-grep-inrepo-v2-2026-08-29.md`

**The seed contradicted this stub, and the contradiction is resolved in favour of
this stub.** § Seed content on promotion below requires a runner change so
`path-between` uses `path <a> <b>`. The seed corpus it names mandates the
opposite — *"the probe is ALWAYS THE START SYMBOL"*, one token, which `path`
cannot consume. The single-token rule was a workaround for v1's runner, not a
property of the question; v2 ships a new runner, so v2's corpus carries two
structured fields (`probe` + `probe_to`) and the grep arm gets the union of two
searches. The seed's *truth sets* are kept unchanged, including its narrowing of
`ac-path-01` to the path itself.

**v2 result: zero classes win.** `callers` TIE, `path-between` TIE,
`transitive-impact` NULL, `references` NULL. On `path-between` the graph is
exact — recall 1.000, precision 1.000 — and still ties, because the repaired grep
arm reaches 0.917 and the delta is +8.3 pp against the +10 pp bar. The trigger
below therefore does **not** fire.

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

**Evaluated 2026-08-29: the trigger does NOT fire.** v2 produced no winning
class. `path-between` is the closest — the graph answers it exactly and is the
only class where it out-precises grep — and it is a TIE at +8.3 pp against the
registered +10 pp bar. A TIE is not a win, and the bar was v1's, fixed before
the run, precisely so this reading could not be negotiated afterwards.

Both seats were explicit that the fallback half must **not** be built ahead of
that trigger: step 3.3 already enforces stale/absent degradation at the CLI
boundary, and no route reaches the composition-before-creation consumer through
the graph, so building its escape hatch first is machinery for a path nothing
takes.
