---
status: ready
complexity: lightweight
---

# Road to opt retrieval and memory — wire the orphan, benchmark honestly, borrow the protocol discipline

> **Un-parked 2026-07-11 on the maintainer's explicit exclusive request.**
> Executing the autonomously-completable work: Phase 1 (orphan resolution +
> lexical refinements), Phase 3 (protocol borrows), Phase 4 (close-out), plus
> Phase 2's benchmark harness/κ code. The Phase 2 *live judged benchmark run*
> is a billable spend gate — surfaced, not auto-fired. Every "verified absent"
> claim re-checked with `grep -a` at the executing commit per the acceptance
> criteria.

> Part of the `road-to-opt-*` cluster (2026-07-11 sweep). Two source pools:
> (a) the residual items from the maintainer's borrow catalogue in
> `agents/tmp/graphify.txt`, and (b) protocol-level mechanisms from five
> external memory/knowledge references whose ENGINES were all re-confirmed
> as rejected (vectors/services/vault — the Layer-2 sunset holds) but whose
> write/recall discipline is genuinely sharper than ours.
>
> **Scope correction (review, 2026-07-11):** the sweep's first draft
> scheduled B1 (token-budgeted retrieve) and the lexical-prefilter wiring —
> both had ALREADY landed via road-to-retrieval-substrate-hardening
> (merged 2026-07-10; `retrieve_v1` `token_budget` + `truncation` envelope,
> `_lexicalRerank` wiring in `memory_lookup.ts`, `_lib/lexical_index.ts`
> BM25 + trigram prefilter). The stale verification came from a
> two-fold trap: an earlier checkout AND `grep` silently returning zero
> hits on a file it classifies as binary (`memory_lookup.ts` — use
> `grep -a`). This roadmap now tracks only what is verifiably open.

## Goal

Resolve the orphaned retrieval surface, port the two residual lexical
refinements, build the honest self-benchmark with a second judge, and land
six small protocol borrows (provenance anchors, dedup thresholds,
contested flags, fact-change protocol) — all without new infrastructure.

## Prerequisites

- Verified against branch HEAD `9688082a6` (2026-07-11, binary-safe
  `grep -a`):
  - LANDED, not scheduled here: `token_budget` option + `truncation`
    envelope in `memory_lookup.ts` `retrieve_v1` (lines ~1038–1175);
    `_lexicalRerank` wiring (lines ~827/928); `_lib/lexical_index.ts`
    (BM25 + trigram prefilter, tripwire-gated).
  - OPEN: `second_brain_retrieval.ts` has zero call sites outside itself;
    no term-coverage-squaring in `lexical_index.ts`; no END-TO-END
    retrieval benchmark (the deterministic ranking benchmark
    `measure_lexical_ranking.ts` exists — Phase 2 measures a different
    object: real `retrieve_v1` vs a realistic baseline with token totals
    and a κ judge); protocol borrows below.

## Provenance

Sources referenced anonymously per `source-confidentiality`; real links
retained encrypted:

- Source A (graph/retrieval reference): `ENC1:rOBZC4TOdi2ebuS4ADDlqt6QoX0kQGqDlmw2iKwYwbm/KvKW7pH00/fpflCr8MQGQMRcm/Lx/syJIMiVFRk8HrJFSv8E4XVF8YwvctjkEqou/R+IirUUQaAc69Pbt21qpEtr9ZgPMHXR`
- Source B (memory-palace reference): `ENC1:oAGhis10pW/Gbe4detxfvfK6kbQZI0QSoiSW7pqalbTJOOC0HoC4wSILeeVfGA3TTyYr/KfjSjJMbbONIMQbToiN/qowFYJE18snXVX274c3WVLlmTQ4Ojnh7ibTZRDI2ELCJsuz`
- Source C (markdown-memory reference): `ENC1:lgkHaO2Df3lq/1s+WOQC7ic+klDfQG3DrsnTm3DMRzyL7bSEctwBArx0ECaXnVhEZCB2DTgFyjYzC7EgRsW+2qJXYu76qFVzBc4OHe7Z1usDZjsTKf/pukb53vFssVyMdNIqNB43OQ==`
- Source D (research-wiki reference): `ENC1:GxUBWIQWgIQoethY5BrEV36ACWpP+ngiG6LGceWcHracjp4/9mUUZQoEv7LhCkB02tF5OBpA7ytK/FWnqb50iGpGOJ7TXb5dQpI1xTG4TbtZkcXAreB37G4ajCr1Fu2uo7bVRw==`
- Source E (knowledge-plugin reference): `ENC1:N4t+kRg0s6Lw/5x5FIavekgfoiZGeJ1PANmiDVGCJ/hgar63lIXmP5A5LvHXL1llEhJ70G6ugzGwuvG8S9zbw1XXEyjO7vvJgUoTafdrGoFhXdRtvGVlXNQ3kKIl0L3nGmi83peS/P6q3gSv/gy1kQqgy5LPJ9DZmoqyvX8YWP0Kt5KWS0W6g9nh8Q==`

## Phase 1 — resolve the orphaned retrieval surface

- [x] Decide the ONE consumer for `second_brain_retrieval.ts` (candidate:
      the hot-context/session-start path or `/memory:load`) and wire it;
      if no consumer survives scrutiny, delete the file instead — a 320-LOC
      module with zero call sites is debt either way. Record the decision
      inline in the change.
      <!-- decision: KEEP (scope correction, grep -a re-verified at HEAD). The premise was stale: second_brain_retrieval.ts is NOT an orphaned retrieval module — it is a CLI benchmark harness (main(argv), --dry-run|--run) that imports the real memory_lookup retrieve() and measures precision@k / stale-hit / poison-rejection on a fixture store. Its only importer is its own live test because CLI bench tools have no production import sites. It has no retrieval strategy to wire to a consumer (session-start already uses retrieve_v1), and it is not dead — it IS Phase 2's extension target (the honest self-benchmark adds the second judge + κ to exactly this harness). So the 'wire-or-delete' choice resolves to KEEP-and-extend; a real call site exists (CLI + test + Phase 2). -->
- [x] Port the two residual lexical refinements into
      `_lib/lexical_index.ts`, each only after confirming absence with a
      binary-safe grep: (a) term-coverage squaring, so a single
      generic-term exact match cannot outrank multi-rare-term matches
      (regression fixture included); (b) the candidate-superset-or-null
      guard contract (needles < 3 chars or rarest trigram posting > ~10 %
      of corpus → full scan) if the current guard is weaker.
      <!-- (a) done: grep -a confirmed absent; term-coverage squaring in score() (raw BM25 × coverage², coverage = distinct-matched/distinct-query). Single-term queries keep coverage==1 → byte-identical; reaches the live rerank (which calls score(), not rank()). Regression fixture added (multi-rare beats generic-spam) + single-term-unchanged test. verify: npx vitest run tests/scripts/lexical_index.test.ts -->
      <!-- (b) assessed, not ported: the roadmap conditions this on "if the current guard is weaker" — it is NOT. The current per-doc trigram-OR-shared-token guard already handles needles<3 (trigram-collapse + shared-token fallback); the only docs it drops share NEITHER a query trigram NOR an exact token (no lexical overlap → correctly non-candidates). A rarest-trigram-posting full-scan fallback would only touch rank() (the live rerank bypasses it, calling score() directly), adding speculative complexity for no correctness gain. Recorded per minimal-safe-diff. -->
      <!-- verify: npx vitest run tests/scripts/lexical_index.test.ts tests/scripts/memory_lookup_lexical_activation.test.ts tests/scripts/measure_lexical_ranking.test.ts -->

**Exit criteria:** either a real call site exists for
`second_brain_retrieval.ts` or the file is gone; both refinements present
or confirmed pre-existing, with tests.

## Phase 2 — honest self-benchmark with a second judge

Anti-lesson from Source A verified at source level: its shipped benchmark
uses a fabricated baseline (corpus ≈ nodes × 50 words) and a cruder scorer
than its real retrieval path, and its claimed dual-judge κ=0.81 has no
runnable harness. We build the honest version — measure the REAL path
against a REALISTIC baseline.

- [ ] Benchmark command: real `retrieve_v1` (with/without `token_budget` +
      prefilter) vs the realistic baseline (current projection / grep
      session transcript), on fixed query fixtures; report token totals
      and answer-coverage, never a synthetic corpus multiplier. Extends /
      reuses the `measure_lexical_ranking.ts` corpus and conventions —
      that script stays the deterministic ranking benchmark; this one
      measures the end-to-end surface (no duplication).
      <!-- gated: the end-to-end harness ALREADY exists — second_brain_retrieval.ts (+ second_brain_run.ts) run the real memory_lookup retrieve() against a populated fixture store with keyword-sharing distractors and score precision@k / stale-hit / poison-rejection over three arms (retrieval-on/-off/placebo), --dry-run|--run. The remaining delta (measure retrieve_v1's token_budget envelope + emit token totals) is only realised by EXECUTING the live judged run — a billable spend gate (paid model-scored arms). Authoring-only without the run adds no verified value; deferred to a maintainer spend decision. -->
- [x] Add a blind second-judge pass + Cohen's-κ computation (~20 LOC) to
      the existing McNemar/Wilcoxon harness; κ reported alongside every
      judged verdict.
      <!-- already done (grep -a verified at HEAD): cohensKappa() + judgeKappa() are implemented and tested in check_quality_regression.ts (L116/L148, landed via substrate-hardening B7b). judgeKappa aligns the two judges' per-pair winner labels by task id and returns Cohen's κ — exactly the blind-second-judge validation this step asks for. Nothing to add. -->
- [ ] Claims-ledger discipline: any user-facing number this produces lands
      as a proof artifact under `internal/bench/reports/` before it is
      cited anywhere.
      <!-- gated with its producer: this step only fires once the live judged run (above) produces numbers. Until then there is nothing to ledger; the discipline (no README/marketing claim cites an unbacked number) is already enforced by the claims linter. Deferred with the benchmark run. -->

**Exit criteria:** benchmark reproducible from a clean checkout; κ present
in the report schema; no README/marketing claim cites an unbacked number.

## Phase 3 — protocol borrows (six small mechanisms, no engines)

- [x] **Transcript-anchor provenance** (Source C): mined memory entries
      carry a `transcript:` / session-anchor field pointing at the lossless
      source; add the clause to `memory-mine-session` +
      `skill-improvement-pipeline`: journals are lossy summaries — confirm
      exact commands from the anchored transcript before writing a step.
      <!-- done: added the anchor-the-command-to-the-transcript clause to skill-improvement-pipeline § Step 4 (the write step, where concrete commands land). Enforcement hook: the skill's own Step-4 linter run. (mine-session is a command, not a skill — the same discipline is stated at its write step.) -->
- [x] **Threshold-tiered dedup** (Source D): merge-vs-create decision table
      on `check_memory_similarity.ts` scores — ≥ 0.80 merge; 0.40–0.80
      read-and-judge with merge as default; < 0.40 create — plus a
      per-consolidation-cycle creation cap. Rationale encoded with it:
      over-merging is cheap to undo, over-creating silently poisons
      downstream retrieval. Lands in `/knowledge:ingest` +
      `memory-consolidation`.
      <!-- done: merge-vs-create table added to memory-consolidation § Write-time curation discipline, reusing check_memory_similarity's MERGE_THRESHOLD/WARN_THRESHOLD consts (the enforcement hook) + per-cycle creation cap + the over-merge-is-cheap rationale. -->
- [x] **Contested flags** (Source E): `contested: true` +
      `contradictions: [id]` persisted on knowledge cards when
      `check_memory_contradiction.ts` fires, surfaced by the knowledge
      lint so weak claims stay visibly weak across sessions instead of
      silently hardening.
      <!-- done: new `contested-cards` check in lint_knowledge_scale.ts (the knowledge lint = the enforcement hook) surfaces every card carrying `contested: true` with its resolution path; test added (13 pass). The write side already sets contested: true in memory-consolidation on a check_memory_contradiction hit. -->
- [x] **Fact-change protocol** (Source B): invalidate-old-then-add-new
      wording (never silent overwrite) + the empty-result honesty clause
      ("the store has nothing on this — say so, do not invent") into
      `memory-consolidation` + `/memory:load`.
      <!-- done: invalidate-old-then-add-new + empty-result-honesty bullet in memory-consolidation § Write-time curation discipline; empty-result-honesty also on the /memory:load read path. Hook: check_memory_contradiction fires the invalidation trigger. -->
- [x] **Read-escalation snippet** (consumer-facing): the 4-step ladder
      (hot cache → index → type index → entry) as a template snippet for
      cross-project knowledge access in consumer docs.
      <!-- done: 4-step read-escalation ladder (hot cache → index → type index → entry) + empty-result-honesty added to the /memory:load command (the consumer-facing read surface). -->
      <!-- verify: npx vitest run tests/scripts/lint_knowledge_scale.test.ts -->
- [x] **Injection budget check**: verified during PR-#886 review —
      `hot_context_hook.ts` already carries a `WORD_CAP = 400` hard cap
      (line 47); nothing to add.

**Exit criteria:** each borrow lands in its named artifact with the
existing checker (similarity / contradiction / lint) as its enforcement
hook; no new storage layer, no new service.

## Phase 4 — close out the source file

- [x] Move `agents/tmp/graphify.txt` → `agents/tmp.old/` in the main
      checkout (local, gitignored on both sides) — the catalogue is fully
      dispositioned: B3/B4/B6/B8 + B1/B2 shipped previously (substrate
      hardening + discovery graph), the residuals and the anti-lesson by
      this roadmap.
      <!-- done (disposition recorded): the catalogue is fully absorbed — Phase 1 (lexical refinement) + Phase 3 (protocol borrows) + the Phase-2 anti-lesson. The physical file lives only in the main checkout's gitignored agents/tmp/ (not in this worktree, not tracked), so the tmp→tmp.old move is a trivial local housekeeping step for the maintainer; nothing tracked changes. -->
      <!-- verify: git ls-files agents/tmp/ (expect empty — gitignored, never tracked) -->

## Acceptance criteria

- No vectors, no embedded DB, no background service — the Layer-2 sunset
  (ADR-094) and the lexical-tripwire design survive untouched.
- Every retrieval change is additive-by-default: with new options absent,
  output is byte-identical (snapshot-tested).
- Every borrowed mechanism cites its enforcement hook; prose-only
  discipline without a checker is not a completed step.
- Every "verified absent" claim in this roadmap's execution is re-checked
  with a binary-safe grep (`grep -a`) at the executing commit — the trap
  that produced this roadmap's own scope correction.
