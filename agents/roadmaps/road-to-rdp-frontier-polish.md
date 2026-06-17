---
complexity: structural
status: ready
parent_roadmap: road-to-rdp-eval-and-promotion
---

# Roadmap: RDP frontier polish — orchestrator decision, kernel de-prescription, L7 (follow-up)

> **Spawned 2026-06-17** from the closed `road-to-rdp-eval-and-promotion` (now
> archived). That roadmap produced + analysed the eval **data**; this one carries
> the work the data **could not settle autonomously** — each item is either a
> maintainer keep/revert decision, a ≥24h-soak-gated kernel edit, or a
> human-reviewed (non-sweep) change. The council (claude-sonnet-4-5 + gpt-4o,
> 2026-06-17) explicitly routed these here rather than forcing them on thin /
> multivariate data. Evidence: `tests/reasoning-layer-eval/RESULTS-quality-2026-06-17.md`
> + `RESULTS-L6-2026-06-17.md`.

## Goal

Settle the orchestrator keep/revert on adequate data, run the maintainer-paced
kernel de-prescription (own-PR + soak each), and re-confirm no strong-host
regression after the polish — without ever asserting a transfer claim the eval
hasn't backed.

> **Maintainer-paced + soak-gated.** Every kernel-rule edit below needs its own
> PR + ≥24h slow-rollout per `scope-control` kernel-rule-edits; autonomy does not
> lift the soak. The orchestrator + L7 decisions are the maintainer's.

## Phase 1 — Orchestrator keep/revert (L6), on adequate data

- [ ] Re-run the L6 isolation eval at **larger N** (≥ 15 orchestrator-relevant
      slots, ideally a second rater), separating the two mechanisms the first run
      surfaced: **multi-stage tool coherence** (where it won, slot 06) vs
      **stateless single-turn reasoning** (where it over-produced, slot 07).
- [ ] Decide keep / revert / keep-scoped-to-multi-stage. If "keep-scoped", first
      specify HOW the scope is detected without a runtime gate (the open design
      debt the council flagged) — else it is not implementable.

## Phase 2 — notes-first kernel promotion (L7), if maintainer elects

- [ ] Only if the maintainer judges the (hardened, multi-rater) evidence
      load-bearing: promote `notes-first-reasoning` to tier-1 kernel via its own
      PR + a new ADR (RDP architecture + kernel rationale) + ≥24h soak. Default
      from the 2026-06-17 run is **stay tier-2 auto** (no promotion).

## Phase 3 — Frontier-serving de-prescription (human-reviewed, kernel = soak-gated)

- [ ] **Batch K (kernel, own-PR + ≥24h soak each):** `verify-before-complete`
      Gate, `language-and-tone` pre-send gate, + the two L15 refinements in
      `direct-answers` / `scope-control`. Iron-Law fences preserved byte-for-byte.
- [ ] **Batch R (non-kernel auto rules, reviewed — not a blind sweep):**
      `artifact-drafting-protocol` Phase A, `no-roadmap-references` "what to do
      instead", `source-of-truth` checkpoints, `improve-before-implement` "what to
      check" — touch the procedure, never the Iron-Law fence.
- [ ] **Batch S (skills, low priority — on-demand detail):**
      `verify-completion-evidence`, `learning-to-rule-or-skill`,
      `systematic-debugging` Phase 4, `condense-memory`.
- [ ] Re-run the quality-eval delta on the strong-reasoning band after the polish
      lands — confirm no standard-host regression (the eval-dependent check
      carried over from the parent's Phase-3).

## Acceptance criteria

- L6 settled on N ≥ 15 (+ a second rater where possible), with the keep/revert
  verdict + numbers recorded; any "keep-scoped" option carries an implementable
  detection spec.
- Kernel rule count grows by at most one (`notes-first-reasoning`, only if
  eval-justified, via ADR + soak).
- De-prescription edits are minimal-diff, reviewed, Iron-Law fences intact; no
  strong-host regression on the post-polish eval delta.
