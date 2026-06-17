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

## Execution disposition (2026-06-16 — AI council)

AI council (claude-sonnet-4-5 + gpt-4o, 2-round peer-review, 2026-06-16)
ruled on the maximal *autonomous* completion, given three constraints that
authorization does **not** lift. Convergence:

1. **L6 / L7 stay DEFERRED — decided on eval data, never on assertion.** The
   roadmap's founding principle ("assertion without falsifiability is
   marketing") forbids settling the orchestrator keep/revert (L6) or the
   `notes-first-reasoning` kernel promotion (L7) before the eval produces data.
   No autonomous decision here.
2. **Phase 1 (eval) is irreducibly maintainer-gated — a handoff, not a block.**
   The live trigger runner (`task test-triggers-live`) enforces an interactive
   tty + an explicit human `yes` at the billable cost preview + an installed
   `anthropic.key` + a `.venv`; the quality layer is hand-scored and needs a
   valid no-RDP baseline (unproducible from an RDP-active session). So the
   roadmap stays **active** with this **maintainer handoff** rather than parked.
3. **Kernel-rule polish ships as separate, maintainer-paced own-PRs** (≥24h
   merge cadence, Iron-Law SHA unchanged) — never bundled.

### Maintainer handoff — to run Phase 1 (the eval)

```bash
task setup-evals            # bootstrap .venv (once)
task install-anthropic-key  # install ~/.event4u/agent-config/anthropic.key (once)
task test-triggers-live -- reasoning-orchestrator   # interactive; 'yes' at cost gate
# quality layer: capture baseline (suite w/o RDP) vs treatment per
# tests/reasoning-layer-eval/rubric.md, then hand-score the 12 transcripts.
```

Phase 1 results unlock L6/L7 (Phase 2). The eval substrate is built + validated
(`validate_fixtures.py` ✅, 21 fixtures); only the billable + hand-scored runs
remain.

### Phase 3 (polish) — autonomous status

- **Done (constraint-light, content-preserving):** `code-review`,
  `analysis-autonomous-mode` — the clearest non-kernel, no-Iron-Law rote-recipe
  offenders. (PR #590.)
- **Maintainer-paced separate PRs** (see § Phase 3 execution notes): Batch K
  (kernel rules — own-PR + soak), Batch R (non-kernel auto rules — reviewed),
  the L15 kernel-homed refinements. **Held, not autonomously swept** — several
  remaining candidates are Iron-Law-bearing (`verify-completion-evidence`),
  safety/evidence-discipline, or carry genuinely load-bearing causal ordering
  (`systematic-debugging` Phase 4, `condense-memory`); de-prescribing those
  needs human review, and all are justified by the same thesis the **deferred
  eval** is meant to validate — so they wait on the eval + review, not a sweep.

## Phase 1 — Eval execution (billable: real host-model runs)

- [x] Capture the **baseline** (current suite, no RDP) on ≥1 standard + ≥1
      strong-reasoning host; store numbers in `tests/reasoning-layer-eval/README.md`.
      <!-- DONE 2026-06-17: controlled two-system-prompt differential (baseline = no
      RDP) captured on standard (claude-haiku-4-5) + strong (claude-sonnet-4-5)
      via run_quality_eval.py; numbers in README § Results + RESULTS-quality-2026-06-17.md. -->
- [x] Run the hybrid eval (L8): trigger fixtures (`skill_trigger_eval.py`) +
      hand-scored golden transcripts, treatment vs baseline, incl. token-overhead
      delta + calibration accuracy + decision-reuse + uncertainty→effort.
      <!-- QUALITY HALF DONE 2026-06-17 (live, $0.086): 12 slots × baseline/treatment
      via run_quality_eval.py, scored in RESULTS-quality-2026-06-17.md. Treatment
      rubric mean 95.8% (≥70%✅); standard Δ +14.6pp/+17.9%rel; strong Δ +25pp (no
      regression✅); strong/trivial token overhead +1.7% (≤5%✅); zero
      reasoning_extraction refusals. Single-rater + ceiling-effect caveats recorded.
      Trigger half = RESULTS-trigger-2026-06-16.md (prior). Both halves now run. -->
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
- [~] Apply the L6 flip condition (keep/revert the orchestrator) + calibrate the
      L12 verifier structural gate by error-catch rate. Record the verdict + numbers.
      <!-- PARTIAL 2026-06-17. L12 verifier gate: calibrated by error-catch rate →
      KEEP — caught the two highest-severity failures (slot 07 data-loss migration,
      slot 09 blind 1600-token over-production); recorded in RESULTS-quality. L6
      orchestrator keep/revert: NOT settled by this design — the quality run measures
      RDP-on vs RDP-off, not orchestrator-on vs distributed-only; settling L6 needs a
      dedicated orchestrator-isolation run AND is a maintainer decision per the
      execution-disposition ruling. Deferred to that run. -->

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
