---
complexity: structural
status: draft
parent_roadmap: road-to-frontier-grade-reasoning
---

# Roadmap: RDP — eval execution, kernel promotion, polish (follow-up)

> **Draft / blocked.** Spawned from the deferred (`[~]`) tail of
> `road-to-frontier-grade-reasoning` (now archived) when its authorable phases
> (0–6 + the Phase-8 scan) completed 2026-06-14. Every item here was blocked on
> something that cannot be done by cost-free autonomous authoring: **billable
> host-model runs**, **kernel governance** (PR + ADR + ≥24h soak), or
> **human-reviewed edits**. Flip `status: ready` when eval budget / maintainer
> time is allocated. Design decisions L1–L17 live in the archived parent + the
> durable `frontier-reasoning-operating-profile` dossier + the `rdp-gate` context.

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
- [ ] **HIGH (L15):** manual coverage read of "re-ground the final summary"
      (`language-and-tone` / `direct-answers`) + "report findings and stop"
      (`scope-control`); add ONLY verified gaps, constraint-light. (Do not
      conclude coverage from an empty grep.)
- [ ] Re-run the eval delta on the strong-reasoning band — confirm no
      standard-host regression after the polish.

## Acceptance criteria

- Eval baseline + treatment captured; trigger precision ≥60%, rubric mean ≥70%,
  standard-host ≥+15%, strong-reasoning band no regression.
- Zero `reasoning_extraction` refusals attributable to suite instructions.
- Strong-host/trivial token overhead ≤~5% (cost gate holds, L10/L17).
- Orchestrator keep/revert recorded against the L6 flip condition with numbers.
- Kernel rule count grows by at most one (`notes-first-reasoning`, only if eval-justified, via ADR + soak).
