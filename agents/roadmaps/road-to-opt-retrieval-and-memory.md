---
complexity: lightweight
---

# Road to opt retrieval and memory — finish the substrate, then borrow the protocol discipline

> Part of the `road-to-opt-*` cluster (2026-07-11 sweep). Two source pools:
> (a) the residual items from the maintainer's borrow catalogue in
> `agents/tmp/graphify.txt` (B3/B4/B6/B8 already shipped; B1/B2/B7 open;
> the "Phase 0–1 implementation" mentioned in that chat log was applied to
> a clone and never landed here), and (b) protocol-level mechanisms from
> five external memory/knowledge references whose ENGINES were all
> re-confirmed as rejected (vectors/services/vault — the Layer-2 sunset
> holds) but whose write/recall discipline is genuinely sharper than ours.

## Goal

Close the retrieval-substrate residuals (token-budgeted retrieve, lexical
prefilter wiring, honest self-benchmark, and actually wiring the dormant
`second_brain_retrieval.ts`) and land six small protocol borrows
(provenance anchors, dedup thresholds, contested flags, fact-change
protocol) — all without new infrastructure.

## Prerequisites

- Verified 2026-07-11: `_lib/lexical_index.ts` (BM25 + trigram) shipped and
  dormant behind the `lint_knowledge_scale` tripwire; `discovery_graph.ts`
  already provides `affected`/`explain`; `second_brain_retrieval.ts`
  (~320 LOC) exists but has zero call sites outside itself;
  `memory_lookup.ts` has no token budget (grep: 0 hits).

## Provenance

Sources referenced anonymously per `source-confidentiality`; real links
retained encrypted:

- Source A (graph/retrieval reference): `ENC1:rOBZC4TOdi2ebuS4ADDlqt6QoX0kQGqDlmw2iKwYwbm/KvKW7pH00/fpflCr8MQGQMRcm/Lx/syJIMiVFRk8HrJFSv8E4XVF8YwvctjkEqou/R+IirUUQaAc69Pbt21qpEtr9ZgPMHXR`
- Source B (memory-palace reference): `ENC1:oAGhis10pW/Gbe4detxfvfK6kbQZI0QSoiSW7pqalbTJOOC0HoC4wSILeeVfGA3TTyYr/KfjSjJMbbONIMQbToiN/qowFYJE18snXVX274c3WVLlmTQ4Ojnh7ibTZRDI2ELCJsuz`
- Source C (markdown-memory reference): `ENC1:lgkHaO2Df3lq/1s+WOQC7ic+klDfQG3DrsnTm3DMRzyL7bSEctwBArx0ECaXnVhEZCB2DTgFyjYzC7EgRsW+2qJXYu76qFVzBc4OHe7Z1usDZjsTKf/pukb53vFssVyMdNIqNB43OQ==`
- Source D (research-wiki reference): `ENC1:GxUBWIQWgIQoethY5BrEV36ACWpP+ngiG6LGceWcHracjp4/9mUUZQoEv7LhCkB02tF5OBpA7ytK/FWnqb50iGpGOJ7TXb5dQpI1xTG4TbtZkcXAreB37G4ajCr1Fu2uo7bVRw==`
- Source E (knowledge-plugin reference): `ENC1:N4t+kRg0s6Lw/5x5FIavekgfoiZGeJ1PANmiDVGCJ/hgar63lIXmP5A5LvHXL1llEhJ70G6ugzGwuvG8S9zbw1XXEyjO7vvJgUoTafdrGoFhXdRtvGVlXNQ3kKIl0L3nGmi83peS/P6q3gSv/gy1kQqgy5LPJ9DZmoqyvX8YWP0Kt5KWS0W6g9nh8Q==`

## Phase 1 — B1: token-budgeted, compact retrieve in `memory_lookup.ts`

Mechanism verified at source level (Source A): `char_budget = tokens * 3`;
seed/top hits render first, remainder degree-/score-sorted; every field
passes the sanitize floor before concatenation; the cut snaps to the last
newline; the truncation notice is actionable (names how many entries were
cut and how to narrow), never a bare "truncated".

- [ ] Add an optional `token_budget` to `memory_lookup.ts::retrieve_v1`
      (additive; absent = today's behavior byte-identical). Top hit always
      survives the budget.
- [ ] Reuse `_lib/retrieval_sanitize.ts` on every rendered field (the
      sanitize floor exists — this wires it into the budget path).
- [ ] Emit the actionable truncation trailer (count cut + narrowing hint).
- [ ] Unit tests: budget honored ±1 line, newline-snap, top-hit survival,
      zero-budget degenerate case, sanitize applied.

**Exit criteria:** `npx vitest run tests/scripts/memory_lookup*` green with
the new cases; default path byte-identical (snapshot test).

## Phase 2 — wire the dormant retrieval surface

- [ ] Decide the ONE consumer for `second_brain_retrieval.ts` (candidate:
      the hot-context/session-start path or `/memory:load`) and wire it;
      if no consumer survives scrutiny, delete the file instead — a 320-LOC
      module with zero call sites is debt either way. Record the decision
      inline in the change.
- [ ] Wire the lexical prefilter option: when the `lint_knowledge_scale`
      tripwire fires, `memory_lookup` consults `_lib/lexical_index.ts`
      (candidate-superset-or-null contract: needles < 3 chars or rarest
      trigram posting > 10% of corpus → full scan; never worse than brute
      force). Below the tripwire nothing changes.
- [ ] Port the term-coverage-squaring correction into the lexical scorer
      so a single generic-term exact match cannot outrank multi-rare-term
      matches (regression fixture included).

**Exit criteria:** either a real call site exists for
`second_brain_retrieval.ts` or the file is gone; prefilter covered by
tests on both sides of the tripwire.

## Phase 3 — B7: honest self-benchmark with a second judge

Anti-lesson from Source A verified at source level: its shipped benchmark
uses a fabricated baseline (corpus ≈ nodes × 50 words) and a cruder scorer
than its real retrieval path, and its claimed dual-judge κ=0.81 has no
runnable harness. We build the honest version — measure the REAL path
against a REALISTIC baseline.

- [ ] Benchmark command: real `retrieve_v1` (with/without budget +
      prefilter) vs the realistic baseline (current projection / grep
      session transcript), on fixed query fixtures; report token totals
      and answer-coverage, never a synthetic corpus multiplier.
- [ ] Add a blind second-judge pass + Cohen's-κ computation (~20 LOC) to
      the existing McNemar/Wilcoxon harness; κ reported alongside every
      judged verdict.
- [ ] Claims-ledger discipline: any user-facing number this produces lands
      as a proof artifact under `internal/bench/reports/` before it is
      cited anywhere.

**Exit criteria:** benchmark reproducible from a clean checkout; κ present
in the report schema; no README/marketing claim cites an unbacked number.

## Phase 4 — protocol borrows (six small mechanisms, no engines)

- [ ] **Transcript-anchor provenance** (Source C): mined memory entries
      carry a `transcript:` / session-anchor field pointing at the lossless
      source; add the clause to `memory-mine-session` +
      `skill-improvement-pipeline`: journals are lossy summaries — confirm
      exact commands from the anchored transcript before writing a step.
- [ ] **Threshold-tiered dedup** (Source D): merge-vs-create decision table
      on `check_memory_similarity.ts` scores — ≥ 0.80 merge; 0.40–0.80
      read-and-judge with merge as default; < 0.40 create — plus a
      per-consolidation-cycle creation cap. Rationale encoded with it:
      over-merging is cheap to undo, over-creating silently poisons
      downstream retrieval. Lands in `/knowledge:ingest` +
      `memory-consolidation`.
- [ ] **Contested flags** (Source E): `contested: true` +
      `contradictions: [id]` persisted on knowledge cards when
      `check_memory_contradiction.ts` fires, surfaced by the knowledge
      lint so weak claims stay visibly weak across sessions instead of
      silently hardening.
- [ ] **Fact-change protocol** (Source B): invalidate-old-then-add-new
      wording (never silent overwrite) + the empty-result honesty clause
      ("the store has nothing on this — say so, do not invent") into
      `memory-consolidation` + `/memory:load`.
- [ ] **Read-escalation snippet** (consumer-facing): the 4-step ladder
      (hot cache → index → type index → entry) as a template snippet for
      cross-project knowledge access in consumer docs.
- [ ] **Injection line-budget check**: verify `hot_context_hook.ts` caps
      injected memory content by lines/chars; if uncapped, add the cap
      (small, config-backed).

**Exit criteria:** each borrow lands in its named artifact with the
existing checker (similarity / contradiction / lint) as its enforcement
hook; no new storage layer, no new service.

## Phase 5 — close out the source file

- [ ] Move `agents/tmp/graphify.txt` → `agents/tmp.old/` in the main
      checkout (local, gitignored on both sides) — the catalogue is fully
      dispositioned: B3/B4/B6/B8 shipped previously, B1/B2/B7 + wiring by
      this roadmap, the anti-lesson recorded in Phase 3.

## Acceptance criteria

- No vectors, no embedded DB, no background service — the Layer-2 sunset
  (ADR-094) and the lexical-tripwire design survive untouched.
- Every retrieval change is additive-by-default: with new options absent,
  output is byte-identical (snapshot-tested).
- Every borrowed mechanism cites its enforcement hook; prose-only
  discipline without a checker is not a completed step.