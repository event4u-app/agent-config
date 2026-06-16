---
complexity: structural
status: ready
parent_roadmap: road-to-frontier-grade-reasoning
---

# Roadmap: RDP — eval execution, kernel promotion, polish (follow-up)

> **Active (2026-06-16).** Eval budget + maintainer time allocated — this
> roadmap is now executable. Spawned from the deferred (`[~]`) tail of
> `road-to-frontier-grade-reasoning` (now archived) when its authorable phases
> (0–6 + the Phase-8 scan) completed 2026-06-14. Items still require **billable
> host-model runs** (Phase 1), **kernel governance** (PR + ADR + ≥24h soak,
> Phase 2), and **human-reviewed edits** (Phase 3) — these are now authorized,
> not blocked. Design decisions L1–L17 live in the archived parent + the durable
> `frontier-reasoning-operating-profile` dossier + the `rdp-gate` context.

## Goal

Close the RDP loop: prove the layer on a falsifiable eval, settle the
orchestrator keep/revert + verifier-gate calibration on data, promote
`notes-first-reasoning` to kernel only if earned, and finish the
frontier-serving polish — without ever asserting a transfer claim the eval
hasn't backed.

## Phase 1 — Eval execution (billable: real host-model runs)

- [ ] Capture the **baseline** (current suite, no RDP) on ≥1 standard + ≥1
      strong-reasoning host; store numbers in `tests/reasoning-layer-eval/README.md`.
- [ ] Run the hybrid eval (L8): trigger fixtures (`skill_trigger_eval.py`) +
      hand-scored golden transcripts, treatment vs baseline, incl. token-overhead
      delta + calibration accuracy + decision-reuse + uncertainty→effort.
- [ ] Apply the L6 flip condition (keep/revert the orchestrator) + calibrate the
      L12 verifier structural gate by error-catch rate. Record the verdict + numbers.

## Phase 2 — Kernel promotion (governance: own PR + ADR + soak)

- [ ] Decide `notes-first-reasoning` kernel promotion (L7): promote to tier-1
      ONLY if the eval shows it load-bearing AND zero `reasoning_extraction`
      refusals — via its own PR + a new ADR (RDP architecture + kernel rationale)
      + ≥24h slow-rollout per `scope-control` kernel-rule-edits. Otherwise it
      stays tier-2 auto.

## Phase 3 — Frontier-serving polish (human-reviewed)

- [ ] Over-prescriptive enumerated step-list remediation across `src/skills/` +
      `src/rules/`: move the load-bearing prescription to constraint-light
      (the L1/L17 default). Reviewed, minimal-diff — no blind sweeps. (The
      reasoning-in-response scan already came back clean.)
      <!-- PARTIAL (2026-06-16): demonstration sample shipped — code-review (response-pattern + PR-comments recipes) + analysis-autonomous-mode (investigation loop) rewritten constraint-light, content-preserving. Full pass is STAGED + human-reviewed (see § Phase 3 execution notes): the highest-value targets are always-on KERNEL rules which need own-PR + ≥24h soak each (scope-control kernel-rule-edits) and cannot be bundled; the surface is ~50 files; on-demand skills are largely the "expand-on-request detail" the operating-profile keeps. -->
- [x] **HIGH (L15):** manual coverage read of "re-ground the final summary"
      (`language-and-tone` / `direct-answers`) + "report findings and stop"
      (`scope-control`); add ONLY verified gaps, constraint-light. (Do not
      conclude coverage from an empty grep.)
      <!-- READ DONE (2026-06-16, from rule text, not grep): "re-ground the final summary" is partially covered (notes-first-reasoning: response = conclusions + evidence only; direct-answers: brevity + skip post-hoc summary); the narrow refinement (summary SHAPE — outcome-first, readable by a reader who saw none of the working thread, no arrow-chain shorthand) is a real gap but homed in direct-answers/language-and-tone, both KERNEL → routed to the kernel-edit pass (own-PR + soak), not addable here. "Report findings and stop" is substantially covered by scope-control (modify only when explicitly requested) + fenced-step + ask-when-uncertain + improve-before-implement; any residual framing gap is scope-control-homed (KERNEL). Net: no non-kernel gap to add in this PR. -->
- [ ] Re-run the eval delta on the strong-reasoning band — confirm no
      standard-host regression after the polish.
      <!-- eval-dependent: blocked on Phase 1 (the eval) — see top-of-file. -->

## Phase 3 — execution notes (2026-06-16)

The Phase-3 polish is **inherently staged + human-reviewed**, not a single
autonomous sweep — three structural reasons surfaced during execution:

1. **The high-value targets are KERNEL rules.** Over-prescription hurts strong
   hosts most on *always-on* rules (they fire every turn). The clearest such
   offenders — `verify-before-complete` (`## The Gate`) and `language-and-tone`
   (`## Pre-send gate`) — are kernel members, so each edit needs its **own PR +
   ≥24h slow-rollout soak** (`scope-control` kernel-rule-edits) and an unchanged
   Iron-Law SHA. They cannot be bundled into a polish PR.
2. **The L15 coverage gaps are also kernel-homed.** Both verified refinements
   (above) live in `direct-answers` / `language-and-tone` / `scope-control` —
   all kernel. Same own-PR + soak constraint.
3. **Scale + skill nuance.** ~50 files carry ≥3-step enumerated procedures.
   On-demand skills are largely the "expand-on-request detail" the
   operating-profile deliberately keeps; the lift is in always-on rules.

Staged plan (each its own reviewed change; kernel ones soak-gated):

- **Batch K (kernel, soak-gated, own PR each):** `verify-before-complete` Gate,
  `language-and-tone` pre-send gate, plus the two L15 refinements in
  `direct-answers` / `scope-control`. Iron-Law fences preserved byte-for-byte.
- **Batch R (non-kernel auto rules, reviewed):** `artifact-drafting-protocol`
  Phase A, `no-roadmap-references` "what to do instead", `source-of-truth`
  checkpoints, `improve-before-implement` "what to check" — touch the procedure,
  never the Iron-Law fence.
- **Batch S (skills, low priority — on-demand detail):** `verify-completion-evidence`,
  `learning-to-rule-or-skill`, `systematic-debugging` Phase 4, `condense-memory`.
  Started here: `code-review`, `analysis-autonomous-mode`.

## Acceptance criteria

- Eval baseline + treatment captured; trigger precision ≥60%, rubric mean ≥70%,
  standard-host ≥+15%, strong-reasoning band no regression.
- Zero `reasoning_extraction` refusals attributable to suite instructions.
- Strong-host/trivial token overhead ≤~5% (cost gate holds, L10/L17).
- Orchestrator keep/revert recorded against the L6 flip condition with numbers.
- Kernel rule count grows by at most one (`notes-first-reasoning`, only if eval-justified, via ADR + soak).
