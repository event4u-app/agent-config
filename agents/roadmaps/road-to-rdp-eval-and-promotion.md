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
      <!-- TRIGGER HALF DONE 2026-06-16 (live, claude-sonnet-4-5, ~$2.76).
      Re-framed: only 3/8 disciplines are trigger-measurable — prediction R1.0;
      complexity + decision R0.6 borderline (decision sharpening-assisted 0.4→0.6).
      orchestrator R0.2 (sharpening proven no-op → structural winner-take-one
      ceiling) + verify (completion gate, triggers.json retired) + grounding/
      intent/notes_first (rules) → quality layer. The "≥60% per discipline" gate
      applies only to the routable 3. Record:
      tests/reasoning-layer-eval/RESULTS-trigger-2026-06-16.md + TRIGGER-WIRING.md.
      Wiring fixes landed this branch: PYTHONPATH=src on test-triggers(-live) +
      setup_eval_venv.sh venv path (both src/-move breakage). GOLDEN-TRANSCRIPT
      (quality) half still open — see Phase-1 quality-layer plan below. -->
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
