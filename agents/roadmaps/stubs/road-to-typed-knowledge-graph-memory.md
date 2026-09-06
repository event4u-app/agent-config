---
complexity: lightweight
review_by: 2026-09-25
---

# Stub: road to typed knowledge-graph memory

> **Stub — not active work.** Drained 2026-08-22 from
> `agents/tmp.old/graph-vs-prompt`, an external reference describing a
> four-prompt pipeline — extraction, resolution, summarization, querying —
> that builds a typed entity–relation graph and uses it as durable agent
> memory and as a grounding layer for eval loops. The reference's headline
> numbers were read via secondary coverage only and are treated as
> **unverified**; nothing here rests on them.
>
> **Class.** Capability-gated, like a drain-run transfer: the three shared
> promotion criteria in [`README.md`](README.md) govern the demand-gated
> org-mode stubs and **do not govern this stub**. It is governed by its own
> four gates below.

> **Arrivals:** shares the code-graph subject counted on
> `agents/roadmaps/stubs/road-to-code-graph-benchmark-rerun.md` — **72** consumed
> inbox rounds under `agents/tmp.old/` (measured 2026-09-06). Latest
> `inbox-2026-09-r`. A floor on the recurrence, not a count of asks for this
> stub. Written here so the next round meets a number.

## Why a stub and not a roadmap

No confirmed defect in this tree is fixed by it. Memory today has **no typed
entity–relation form at all** — a grep of `src/skills/memory-consolidation/`
and the memory scripts for entity / relation / graph / edge vocabulary returns
zero hits, and the shape is flat YAML: `src/scripts/check_memory.ts:60-68`
requires `id`, `status`, `confidence`, `source`, `owner`, `last_validated`,
`review_after_days` — no subject, no predicate, no object, no edge. Retrieval
is text-only: `src/scripts/memory_lookup.ts:530` documents a "Naive relevance
score: max over keys of (glob-match | substring)", `:532` records that this is
"the only scoring path", and `:547-557` concatenates the candidate fields into
one haystack string before matching. The optional persisted index beside it is
BM25/FTS5 — lexical, not semantic and not a graph.

So the gap is real and the absence of a failure attributable to it is equally
real. Adding a graph layer with no failing multi-hop or cross-document query in
evidence is an additive harvest, which is the move the inverted-harvest
discipline exists to block.

## The standing prior that raises gate 1's bar

This tree has already priced a graph-shaped retrieval layer, and the price was
negative. `agents/roadmaps/skipped/road-to-code-graph-orchestration.md:16-25`
records that its successor **was built, then measured at recall 0.365 vs
disciplined grep 0.797 (Δ −43.2 pp) and permanently defaulted off**, with the
null registered in `docs/CLAIMS.md` as `code-graph-retrieval-null`.

That is a different corpus — source code, not memory entries — so it does not
settle this question. It does mean gate 1 may not be satisfied by an
expectation that a graph retrieves better: this tree's one measurement of that
expectation refuted it by 43 points. Gate 1 asks for recorded failures, and
gate 2 asks for the counterfactual on paper, precisely because the intuition
here has already been wrong once at full build cost.

## Promotion gates (all four required)

1. **Defect signal.** At least three recorded retrieval failures where the
   answer required joining facts across documents that the lexical path could
   not surface together, each captured with the failing query and the documents
   that jointly held the answer — or one memory-consolidation duplicate-entity
   incident that string-level dedup demonstrably missed.
2. **Counterfactual check.** For each captured failure, show on paper — before
   any pipeline exists — that a typed-edge lookup would have answered it.
3. **Cost floor.** The extraction pass fits the existing lite-tier
   batch/caching discipline. No standing re-extraction daemon.
4. **Boundary.** Graph writes ride the existing memory-quarantine and
   auto-surface-never-auto-write floors unchanged, and per-edge provenance
   (source document plus extraction run) is mandatory from the first schema
   draft — an edge without provenance is inadmissible.

**Either direction closes this stub.** A measured null — the captured failures
exist and a typed-edge lookup would not have answered them, or the built
pipeline loses to the lexical path the way the code-graph engine did — closes
it as legitimately as shipping would. A stub whose only exit is "build it" is a
parking lot.

## Seed content on promotion

- **Schema:** one entity table and one typed-relation table **beside** the
  existing lexical index, never replacing it; querying stays retrieval-first
  with the graph as a join aid.
- **Prompts:** the four passes ship as skill-local prompt files under an
  existing memory skill (`memory-consolidation` or `condense-memory`, decided
  at promotion via the skill-family map), not as a new skill.
- **Eval:** the failures captured for gate 1 become the fixture set, and the
  pipeline answers them with cited edges before anything else ships.
- **Baseline to beat, stated up front:** the lexical path's recall on that same
  fixture set, measured on the promotion date. The code-graph null exists
  because its successor was compared against disciplined grep only after it was
  built.
