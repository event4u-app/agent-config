---
complexity: structural
status: ready
parent_roadmap: road-to-second-brain
---

# Road to second-brain delta proof — measure the memory substrate against a no-memory baseline, and scope it honestly against human-PKM

> The knowledge/second-brain substrate is built (Phases 1–6 of
> `road-to-second-brain.md`: typed knowledge dirs, INDEX generator, retrieval
> protocol, `hot_context_hook` working-memory continuity, `fold_intake`,
> contradiction-surfacing on promote). What is NOT yet established is the
> **delta**: does agent-facing memory beat a no-memory baseline on a
> reproducible task, and where exactly is it *not* the same product as a
> human PKM (Obsidian-class). This roadmap produces that measurement and the
> honest positioning that follows from it.

## Goal

Bind the second-brain substrate to a falsifiable claim: on a defined
multi-session task, the memory layer produces a measurable, placebo-controlled
lift in retrieval accuracy and/or cross-session continuity over an identical
agent with the substrate off — or it records an honest null and the substrate
ships labeled "continuity convenience, no measured task lift."

## Context (measured, do not relitigate)

- The substrate exists and is council-reviewed: template context calls it a
  "governed second-brain substrate"; the delta itself is tracked in
  `agents/settings/contexts/second-brain-delta-verdict.md` (council 2026-07-07),
  i.e. the delta is explicitly NOT yet claimed.
- Shape difference from human-PKM is architectural, not incidental:
  - Obsidian-class (e.g. the Karpathy LLM-Wiki pattern) is a **human** artifact —
    a Markdown graph browsed in an editor, whose value thesis is link-density,
    with hybrid retrieval (contextual-prefix + BM25 + rerank) serving a person.
  - The agent-config substrate is **agent-facing** — working-memory continuity
    across compaction (`hot_context_hook`) + promotable knowledge cards/pages
    with redaction, team-sharing gate, and contradiction surfacing. Its value
    thesis is "the agent recalls/repairs across sessions," not "a human browses
    a graph."
- Guards already exist to measure against: `check_knowledge_cards.ts`,
  `check_knowledge_pages.ts`, `lint_knowledge_scale.ts`,
  `consolidate_knowledge_events.ts`, `knowledge_global_promote.ts`.
- Falsifiability lock (house rule): no page/README may carry a "second brain"
  capability marker until a `backed` CLAIMS entry with a resolving evidence
  pointer exists (`docs/CLAIMS.md`, `docs/proof.md`).

## Prerequisites

- [x] Substrate Phases 1–6 landed (`road-to-second-brain.md`).
- [x] Delta framed as open (`second-brain-delta-verdict.md`).
- [x] A deterministic memory-task scorer (this roadmap, Phase 1).

## Phase 1 — Define the task + deterministic scorer (no LLM judge)

- [x] Author a **multi-session recall corpus** under
      `internal/bench/second-brain/corpus/`: N tasks where session *k+1* needs
      a fact/decision established in session *k* (e.g. "the API contract we
      chose", "the constraint we rejected and why"). Each task carries a
      deterministic answer key.
      <!-- done 2026-07-08: internal/bench/second-brain/corpus/corpus.yml — 9
      constructed session-k/k+1 tasks with deterministic must_contain/
      must_not_contain keys (synthetic, deterministic-by-construction; provenance
      header mirrors the memory-replay Option-A precedent). -->
- [x] Define the metric set, all deterministic: (a) retrieval accuracy — did
      the agent surface the correct prior fact; (b) contradiction-catch rate —
      seed a session-*k+1* prompt that contradicts session *k*; does
      contradiction-surfacing fire; (c) repair rate — after an injected wrong
      memory, does `fold_intake`/promote correct it.
      <!-- done 2026-07-08: all three metrics present (5 retrieval-accuracy,
      2 contradiction-catch, 2 repair); each is a deterministic key, never a
      model judgement. -->
- [x] Scorer emits pass/fail per task, no model-in-the-loop grading (mirror
      `bench_ab_scoring_v2.py` discipline).
      <!-- done 2026-07-08: src/scripts/second_brain_score.ts — pure substring
      must_contain/must_not_contain, NO LLM judge. --dry-run: 9 good→PASS,
      3 bad→FAIL (correct + discriminating); wired as check-second-brain-scorer.
      Satisfies Phase 1 Exit (dry run scores hand-written transcripts). -->

**Exit:** corpus + deterministic scorer exist; a dry run scores a hand-written
transcript correctly.
**Rollback:** none — new bench asset, opt-in.

## Phase 2 — Paired measurement: substrate on vs off vs placebo

- [ ] Three arms, paired: `memory-on` (full substrate), `memory-off` (substrate
      disabled, agent re-derives from scratch), `placebo` (equal-byte inert
      "notes" injected, no retrieval logic) — the placebo isolates *retrieval
      mechanism* from *mere extra context*, exactly as the discipline benchmark
      isolates content from length.
      <!-- OPEN — blocked on `measurement-spend`: the 3-arm paired run is
      spend-bearing. The scorer + corpus are ready to run it once authorized. -->
- [ ] Run on ≥1 host × ≥3 seeds; keep the host fixed (wrapper-delta, not
      model comparison). Record cost/run — a memory substrate that wins on
      accuracy but costs 5× context is a different claim than one that wins cheaply.
      <!-- OPEN — same `measurement-spend` block. -->
- [ ] Stats: sign/Wilcoxon on the paired per-task scores; report effect size +
      cost factor.
      <!-- OPEN — same `measurement-spend` block; stats run on the paired scores
      once the run lands. -->

**Exit:** pinned report with per-metric deltas + cost; PASS (substrate beats
BOTH off and placebo) / NULL recorded.
**Rollback:** none — measurement only.

## Phase 3 — Honest positioning vs human-PKM

- [x] Write `docs/second-brain-scope.md`: a claim→evidence table stating what
      the substrate IS (agent recall/continuity/contradiction-repair, measured)
      and explicitly what it is NOT (a human-browsable knowledge graph; no
      link-density thesis; not an Obsidian replacement). Category column
      describes human-PKM only by what is publicly observable — never a
      counter-claim to a named project (mirror `docs/proof.md` § 4 discipline).
      <!-- done 2026-07-08: docs/second-brain-scope.md — IS (continuity / cards /
      contradiction-surfacing, task-lift UNMEASURED — corrected from the item's
      "measured", which pre-supposed Phase 2) vs IS NOT (no editable vault, no
      link-density thesis, not an Obsidian replacement); category by public
      observation only. -->
- [x] Add the CLAIMS entry: PASS → `backed` "cross-session recall lift (metric,
      N, p, cost)"; NULL → an `unbacked`/honest-null ledger line + the substrate
      is documented as "continuity convenience, no measured task lift."
      <!-- done 2026-07-08 (pre-run form): CLAIMS `claim: second-brain-unproven`
      (backed — the lift is UNMEASURED + the rig exists; evidence
      docs/second-brain-scope.md). The PASS/NULL lift entry lands when the
      Phase-2 paired run is authorized. -->
- [x] Gate any "second brain" wording in README/site behind the CLAIMS marker;
      `check-claims` fails the build if the marker outruns the evidence.
      <!-- done 2026-07-08: no "second brain" capability marker exists in live
      public prose (only archive/ADR mentions); check_claims already fails any
      markered claim without a backing, so a future "second brain" marker is
      gated by construction. Honest status published (proof § 2 + scope doc). -->

**Exit:** the scope doc + CLAIMS entry exist; no capability claim outruns its
evidence pointer.
**Rollback:** remove the marker; the substrate keeps working, just unclaimed.

## Phase 4 — Interop instead of competition (optional, gated on Phase 2 PASS)

- [ ] If (and only if) the substrate shows a real lift, add a one-way export:
      promoted knowledge cards → plain Obsidian-compatible Markdown +
      wikilinks, so the agent-facing memory can *feed* a human PKM rather than
      pretend to replace it. Positions agent-config as the writer, Obsidian as
      the reader — complementary, not competitive.
      <!-- OPEN — conditional on a Phase-2 PASS. Per the delta verdict, no
      exporter is built absent a measured lift; the honest default is not to
      build it. -->
- [ ] Witness test: an exported card round-trips into a vault folder and renders
      (headless Markdown lint), documented as a known-limit if link fidelity is
      partial.
      <!-- OPEN — conditional on the Phase-4 exporter above. -->

**Exit:** export path + witness test, OR a recorded decision not to build it.
**Rollback:** drop the exporter; core substrate unaffected.

## Acceptance criteria

- A deterministic multi-session memory corpus + scorer exist and are pinned.
- The substrate is measured against BOTH a no-memory baseline AND an equal-byte
  placebo; the result (PASS/NULL) is pinned in `docs/benchmark.md` + CLAIMS.
- No "second brain" capability claim appears in public prose without a resolving
  evidence pointer; the human-PKM boundary is stated, not blurred.
- If PASS: an honest interop story (export to Obsidian) exists or is explicitly
  declined; the package never claims to *replace* a human PKM.

> **Status (2026-07-08).** Criteria 1 and 3 are MET — the deterministic corpus +
> scorer exist and are pinned (`check-second-brain-scorer` dry-run), and no
> "second brain" capability claim appears in public prose (the human-PKM
> boundary is stated in `docs/second-brain-scope.md`; the honest-null CLAIMS
> entry + proof § 2 publish the unmeasured status). Criterion 2 (measured
> against baseline + placebo) remains OPEN — the 3-arm paired run is Phase 2,
> blocked on `measurement-spend`. Criterion 4 is conditional on a Phase-2 PASS.
> The measurement rig is complete; the delta lands when spend is authorized. The
> roadmap stays open on Phase 2, not archived.

## Blockers

### blocker: memory-corpus-authoring
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 1 — corpus + scorer
- **What to do:** author ≥8 multi-session recall tasks with deterministic answer
  keys; the hard part is designing session-*k*/*k+1* dependencies a headless
  harness can replay. Reuse the audit-log replay path from the orchestration
  corpus for session chaining.
- **Resolved when:** `internal/bench/second-brain/corpus/` holds a scorable
  corpus and the scorer passes a dry run.

### blocker: measurement-spend
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 2
- **What to do:** authorize the paired-run spend (3 arms × N tasks × ≥3 seeds).
- **Resolved when:** a pinned second-brain delta report exists under
  `internal/bench/reports/`.
