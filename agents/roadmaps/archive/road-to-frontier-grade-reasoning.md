---
complexity: structural
status: ready
---

# Roadmap: Reasoning Discipline Protocol — make every host model think like a pro

> **Complexity:** structural — one installable settings surface, one coordination
> skill (primary), one notes-first rule (kernel-candidate), one new planning
> skill, a **table-free** cost-gate, ~5 existing-artifact extensions, one sourced
> analysis dossier, and a hybrid eval substrate.
> **Review trail:** four council debates (two-member, 2 rounds each, peer-review,
> 2026-06-13/14) + an external two-model review (GPT + Claude). All design forks
> resolved (*Locked decisions* L1–L17). Umbrella name: **Reasoning Discipline
> Protocol (RDP)**.

## Goal

Raise the **reasoning floor of any host model** (Claude Sonnet/Opus, GPT-*,
Gemini, future models) to the *operating discipline* publicly observed in
Anthropic's Fable 5 / Mythos 5 — so the model-to-model gap in **process**
shrinks, even though model **capability** (weights/training) cannot be
transplanted.

Three hard truths:

1. **No prompt makes a weaker model *equal* Fable 5.** Capability lives in the
   weights (Nathan Lambert / Interconnects framing; Anthropic docs support only
   "needs less scaffolding"). This layer transplants the discipline, never the
   capability.
2. **Over-prescription is a real failure mode.** Anthropic's Fable-5 docs warn —
   verbatim — that too-prescriptive skills *degrade* strong models and that
   reasoning-in-response can trigger a `reasoning_extraction` refusal. The fix is
   a **cost-gated, constraint-light** layer, not more rules.
3. **Background (precise):** Anthropic suspended Fable 5 / Mythos 5 on
   **2026-06-12**; the US directive / Reuters report is **2026-06-13**. The model
   is inaccessible, so our own falsifiable eval is the only ground truth.

Deliverable: **invisible infrastructure with a discoverable, switchable face** —
woven into the existing stack, coordinated by one orchestrator, surfaced + toggled
via a `reasoning:` settings block, **table-free cost-gated** (task signal + user
toggle + light agent self-assessment), reasoning-in-notes (never in responses),
proven on a hybrid eval before any transfer claim.

> **Naming.** Neutral, no brand/capability claim. Umbrella **RDP**. Artifacts:
> `reasoning-orchestrator`, `notes-first-reasoning`, `complexity-first-planning`,
> `environment-grounding`. "Fable"/"Mythos" never appear in an artifact identifier.
> The host axis is **"reasoning strength: strong / standard" (agent self-assessed)**
> — distinct from ADR-035's `model_tier` (lite/medium/high = the skill's needed
> model, not the host's band). "tier-1/2/3/4" / "frontier tier" are **not used**.

## Phase 0 — Reality check (do NOT rebuild — already ~70% shipped)

- [x] Capability audit complete (2026-06-13) — Anthropic news + "Prompting Claude
      Fable 5" docs + Vellum (third-party) + CodeRabbit (third-party) +
      Lambert/Interconnects + two external model analyses (corroboration only).

| Fable-5 transferable behavior | Already shipped | Disposition |
|---|---|---|
| Audit progress against real tool results | `verify-before-complete` + `verify-completion-evidence` | keep; reference |
| Outcome-first, no overplanning, act-when-ready | `direct-answers`, `autonomous-execution` | keep; reference |
| Pause only when genuinely needed, N=3 loop budget | `no-cheap-questions`, `autonomous-execution` | keep; reference |
| No over-refactor / minimal diff (higher effort) | `minimal-safe-diff` | keep; reference |
| Analyze before coding | `think-before-action` | **extend** (env-grounding) |
| Right-problem / clarity check | `improve-before-implement`, `invite-challenge` | **extend** (intent; standard host) |
| Fresh-context verifier beats self-critique | `adversarial-review`, `judge-*` | **extend** (verifier on structural gate) |
| Persistent cross-run notes (Fable: 3× w/ file memory) | memory system, `memory-consolidation` | **extend** (notes-first) |
| Parallel async subagents | `subagent-orchestration` | **extend** (async-default) |
| (risk-first decomposition — OUR derivation, not Fable) | `feature-planning` | compose new `complexity-first-planning` |

## Locked decisions (council-converged across four debates + external review, 2026-06-13/14)

> Council: `claude-sonnet-4-5` + `gpt-4o`, four debates × 2 rounds, peer-review.
> External review: GPT + Claude (line-by-line citation audit). Do not relitigate.

- **L1 — One constraint-light layer + a table-free gate (NOT per-tier content).**
  There are **no** heavy/light content variants and **no** `model_adaptations`
  blocks (two variants = a hidden model→band table, which ADR-035 forbids). One
  constraint-light version ships; a standard host **expands it on request** when
  the task demands more; a strong-reasoning host applies it lightly. Engagement is
  decided by the L17 table-free gate.
- **L2 — Reasoning-in-notes, never in-response.** Hypotheses/killed-beliefs/
  predictions/decisions live in a session-notes file + are judged by fresh-context
  verifier subagents; the response carries conclusions + evidence only. Avoids
  `reasoning_extraction`.
- **L3 — Extend before create.** Minimal new surface.
- **L4 — Eval mandatory before any transfer claim.** Falsifiable, explicit fails.
- **L5 — No standalone pack/flow; cohesion via settings block + catalog.** The
  repo's `profile` is a role/audience selector, so a role-profile is the wrong
  vehicle. Cohesion + the cost toggle are one mechanism: a `reasoning:` block in
  `.agent-settings.yml` + a catalog/doc entry + `skills_hint` references.
- **L6 — Orchestrator is the primary mechanism.** `reasoning-orchestrator`
  (tier-2 skill, behavioral glue like `subagent-orchestration`) enforces the chain
  ground → intent → notes → gather → audit → verify. Keys on **task properties**
  (orthogonal to host strength), so the L17 gate redesign leaves it unchanged.
  **Flip condition:** eval shows <10% gain over distributed-only OR >15%
  false-positive interventions → revert.
- **L7 — Notes-first ships tier-2 auto first.** Kernel promotion only on eval
  evidence (most-triggered + <8% false-positive over a soak), own PR + ADR + ≥24h.
- **L8 — Hybrid eval.** No app runtime → no full programmatic A/B. Substrate:
  (1) trigger-eval fixtures (≥60% precision/recall) + (2) 12 golden transcripts
  (4 per host-strength band) hand-scored on a 4-point rubric (≥70% mean). Either
  below threshold → architectural revision.
- **L9 — Per-gap dispositions.** environment-grounding → extend `think-before-action`;
  intent-inference → extend `improve-before-implement` (standard host only, L13);
  risk-first → new skill `complexity-first-planning` (L11).
- **L10 — Cost is a first-class constraint.** Two gates, default-on, both
  table-free (see L17 for the mechanism): (1) **auto benefit-gating** — trivial/
  short tasks OFF; a strong-reasoning host applies the discipline lightly; a
  standard host applies it fully. (2) **user toggle** — `reasoning:` block: global
  `enabled` + `auto_gate` + per-component switches (`orchestrator`, `notes_first`,
  `grounding`, `intent`, `complexity_first`, `verifier_default`,
  `prediction_tracking`, `decision_ledger`, `uncertainty_budget`) + hard `off`.
  Default `enabled: true` + auto-gate → strong-host/simple ~zero overhead;
  `enabled: false` fully silences.
- **L11 — `complexity-first-planning` is OUR derivation, not Fable-documented (F1).**
  Anthropic's "start at the top of your difficulty range" means task **selection**,
  not "solve the hardest sub-component first". Kept on independent risk-first merit,
  **labeled an RDP derivation, Fable citation removed**.
- **L12 — Verifier gets its OWN structural cost gate (F2).** A verifier subagent is
  a full extra inference pass. It fires only when the task shows **≥2 of**:
  branching/conditional logic · ≥3 explicit must/must-not constraints · stateful
  ops · irreversibility flag — **plus** a token floor (skip if est. <1k tokens).
  Marked a calibration hypothesis, tuned by the eval's error-catch rate.
- **L13 — `intent-inference`: infer the goal, give ONE recommendation; standard
  host only (F3).** Evidence corrected ([pf]'s "give the reason" is prompter-side
  + suppresses option-surveys). Drop "2–3 framings". A strong-reasoning host
  self-infers, so the scaffold stays light/off there; cross-ref `improve-before-implement`.
- **L14 — Effort split + A/B/C adoption + ledger boundary (F4).** (i) On a host
  with an effort knob (Fable), "adaptive effort" = set `effort: high` for a
  strong-reasoning host; the scaffold (effort/stop discipline) applies only to a
  **standard host without the knob**. (ii) Adopt three cost-gateable notes
  components: `prediction_tracking`, `uncertainty_budget`, `decision_ledger`.
  (iii) **Ledger ↔ ADR boundary:** in-session ledger = tactical decisions in task
  scope; escalate to `decision-record`/ADR when cross-task or architectural.
- **L15 — Two missed behaviors deferred to the Phase-8 audit (F5).** "Re-ground the
  final summary" + "report findings and stop" — coverage-check first
  (`language-and-tone`/`direct-answers`/`scope-control`), add only verified gaps;
  HIGH priority.
- **L16 — Notes template grounded in the documented cross-run pattern (Claude #3).**
  In-task sections (`## In-Task Hypothesis Log`, `## Predictions`, `## Decisions`,
  `## Uncertainty`) are a clearly-marked local derivation, kept on the notes side
  of the `reasoning_extraction` line.
- **L17 — Table-free cost-gate (gate redesign, council 2026-06-14).** Reality:
  `model_tier` (ADR-035) = the SKILL's needed model band (lite/medium/high), NOT
  the host's band; ADR-035 **rejects a `frontier` tier AND any runtime model→band
  table**. So the gate uses **only table-free signals**: (1) user settings
  (`reasoning.enabled` + `auto_gate` + per-component), (2) **task signal**
  (complexity/ambiguity/triviality/long-horizon — knowable per turn), (3) **light
  agent self-assessment** of host reasoning strength (introspection, no maintained
  model list — same pattern as `provider-lifecycle-discipline` /
  `media-governance-routing`). No `model_adaptations`, no per-tier content, no
  router band-table. This **simplifies** the layer and is strictly more
  cost-safe + vendor-neutral.

## Phase 1 — Analysis dossier, naming, settings surface  ✅ complete

- [x] Author the sourced operating-profile dossier
      (`docs/guidelines/agent-infra/frontier-reasoning-operating-profile.md`) —
      every row labeled source + dignity; five rows corrected by the external
      citation audit; load-bearing claims verified in [pf].
- [x] Add the `reasoning:` block to the agent-settings template (global `enabled`
      + `auto_gate` + per-component toggles, default-on per L10) — schema-validated.
- [x] Lock the RDP naming + host-strength vocabulary; confirm no artifact
      identifier contains "Fable"/"Mythos".
- [x] Ref/schema check on the new doc + settings block — clean; external source
      URLs verified.

## Phase 2 — Hybrid eval substrate FIRST (falsifiability before features, L8)

- [x] `tests/reasoning-layer-eval/trigger-fixtures.json` (schema-compatible with
      per-skill `evals/triggers.json`; `host: strong|standard` label per L17;
      live scoring via `skill_trigger_eval.py`, cost-free shape + gating-invariant
      check via `validate_fixtures.py` ✅) — 21 fixtures across 8 disciplines.
- [x] `tests/reasoning-layer-eval/golden-transcripts/` (`_template.md`) +
      `rubric.md` — 12-slot plan (4 per host-strength band) + 4-point rubric.
- [x] `tests/reasoning-layer-eval/README.md` — methodology + metrics (token-overhead
      delta, calibration accuracy, decision-reuse, uncertainty→effort) + fail
      conditions (trigger <60%; rubric <70%; any `reasoning_extraction`;
      strong-host/trivial overhead >~5% → cost gate broken L10; orchestrator <10%
      gain or >15% false-positive → revert L6).
- [~] Capture the **baseline** (current suite, no RDP). <!-- deferred: billable — needs real host-model runs -->

## Phase 3 — Table-free cost-gate convention (L17 + L10) — simplified

> The per-tier content machinery (`model_adaptations`, router band-table,
> `_tier-adaptive-template`) is **dropped per L1/L17**. Phase 3 is now a small
> convention + doc task, not a router change.

- [x] Documented the gate convention in
      `src/agent-src/contexts/execution/rdp-gate.md` — every RDP artifact is
      written constraint-light and reads `reasoning:` settings + task-signal +
      host self-assessment; no `model_adaptations`, no `model_tier` reuse for
      gating. The doc also states RDP needs **no new frontmatter field**.
- [x] Specified the task-signal heuristic (trivial/short/fully-specified → off;
      complex/ambiguous/long-horizon → on) + the self-assessment touch
      (strong-reasoning host → light/suggestion; standard host → full) as the
      shared `rdp-gate.md` context the RDP artifacts cite. Kernel untouched
      (RDP artifacts are tier-2, no new always-on cost).
- [x] Confirmed no projection/condensation change is needed (table-free → no
      schema key, nothing new compiles into `dist/router.json`); `check_references.py`
      clean. <!-- carve-out: new-gate-verification --> <!-- carve-out: new-gate-verification -->

## Phase 4 — Notes-first reasoning (load-bearing, L2 + L7 + L14·ii + L16)

- [x] Notes template authored (canonical home = the rule, grounded in the
      cross-run pattern): `## In-Task Hypothesis Log`, `## Killed beliefs`,
      `## Predictions`, `## Decisions` (+ ADR escalation per L14·iii),
      `## Uncertainty`. Structure carries the enumeration; no "write N
      hypotheses" instruction. `memory-consolidation` extended with the in-task →
      cross-run **promotion path** (bridge section).
- [x] Authored `src/rules/notes-first-reasoning.md` (type:auto, tier-2, loads
      `rdp-gate`; not kernel yet per L7).
- [x] Frontmatter schema ✅ (335 artefacts, 0 failing) + `check_references.py` ✅. <!-- carve-out: new-gate-verification -->

## Phase 5 — Extend existing artifacts + one new skill (L3 + L9 + L11–L14)

All written constraint-light (L1); standard hosts expand on request.

- [x] `think-before-action` — **environment-grounding-before-action** (third-party
      [cr], confirmed): close constraints/tools/info-gaps before designing.
- [x] `improve-before-implement` — **intent-inference, standard host only (L13)**:
      state the inferred goal + ONE recommendation; no multi-framing survey.
- [x] **New skill** `src/skills/complexity-first-planning/SKILL.md` (+ evals) —
      risk-first decomposition; **labeled RDP derivation, not Fable-documented (L11)**.
- [x] `adversarial-review` — fresh-context verifier gated by the
      **structural-complexity rule (L12)**, not a blanket gate.
- [x] `subagent-orchestration` — parallel async dispatch as default.
- [x] `autonomous-execution` — adaptive effort/stop discipline **for a standard
      host without an effort knob (L14·i)**; couples to the N=3 budget;
      `uncertainty_budget` feeds the decision. *(Verified tier-1 auto, NOT kernel
      — alwaysApply:false; the earlier "kernel/slow-rollout" label was a
      mislabel, so this is a normal additive tier-1 edit.)*
- [x] Frontmatter schema ✅ (337 artefacts, 0 failing) + `check_references.py` ✅.

## Phase 6 — Reasoning orchestrator (primary mechanism, L6)

- [x] Authored `src/skills/reasoning-orchestrator/SKILL.md` (+ evals) —
      coordinates Phase-4/5 behaviors into ground → intent → notes → gather →
      audit → verify; keys on task properties; reads the L17 gate; composes
      existing skills (`requires_skills`); honors `flows/README` (no new flow);
      fail-safe degrades to the distributed extensions.
- [x] Frontmatter schema ✅ + `check_references.py` ✅. <!-- carve-out: new-gate-verification -->

## Phase 7 — Run the eval, validate the orchestrator, decide kernel promotion

- [~] Run the hybrid eval (L8): trigger fixtures + hand-scored transcripts,
      treatment vs the Phase-2 baseline, incl. cost-overhead + calibration metrics. <!-- deferred: billable — needs real host-model runs -->
- [~] Apply the L6 flip condition (keep/revert orchestrator) + the L12 verifier-gate
      calibration (tune the structural threshold by error-catch rate). <!-- deferred: depends on the eval run above -->
- [~] Decide `notes-first-reasoning` kernel promotion (L7) — own PR + ADR + ≥24h. <!-- deferred: kernel governance (PR + ADR + soak) + eval-gated -->

## Phase 8 — De-prescriptivize audit + missed behaviors

- [x] Scanned `src/skills/` + `src/rules/` for reasoning-in-response instructions
      (`reasoning_extraction` risk) → **corpus clean**: no remediation needed (only
      the one new RDP notes rule matched, via its own negation clause).
- [~] Over-prescriptive enumerated step-list remediation — deferred to a
      human-reviewed pass (judgment + minimal-safe-diff across core artifacts;
      blind sweeping edits are unsafe). <!-- deferred: needs reviewed edits to existing core artifacts -->
- [~] **HIGH (L15):** coverage-check "re-ground the final summary" + "report
      findings and stop" — grep inconclusive; deferred to a manual read pass (do
      not conclude coverage from an empty grep). <!-- deferred: manual coverage read -->
- [~] Re-run the eval delta on the strong-reasoning band — no standard-host regression. <!-- deferred: billable — model runs -->

## Acceptance criteria

- Hybrid eval exists, baseline captured; treatment fires correctly (trigger
  precision ≥60%) + rubric mean ≥70%, no strong-reasoning-band regression.
- Zero `reasoning_extraction` refusals attributable to suite instructions.
- Cost guardrail (L10/L17): strong-host/trivial overhead ≤~5% (auto-gated off);
  `reasoning.enabled: false` fully disables; per-component toggles work; verifier
  fires only on the L12 structural gate; **no maintained model→band table exists**.
- D1 (orchestrator keep/revert) recorded against the L6 flip condition.
- The `reasoning:` settings block + a catalog/doc entry make RDP discoverable +
  switchable as one unit.
- Every new/extended artifact passes `skill_linter.py` + `check_references.py`; no
  artifact identifier names a vendor model; the dossier's every transferable line
  is sourced with its dignity.
- Kernel rule count grows by at most one (`notes-first-reasoning`, only if eval-justified).
