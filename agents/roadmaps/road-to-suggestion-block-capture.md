---
complexity: lightweight
status: ready
estate_offset_exempt: "Landed by the /analyze:inbox run of 2026-08-24. The one-in-one-out half fires on every added agents/roadmaps/road-to-*.md whatever its status, and this addition carries no roadmap of its own to retire: the run archived two roadmaps, but both were status: draft and therefore never counted, so neither is available as an offset. The addition is sanctioned on its own terms -- three parked roadmaps name this instrument's capture rate as their resume condition."
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Instrument roadmap: hook-carried capture for suggestion-block emission and user selection. Its published capture-rate figure is the citable telemetry reading that the resume conditions of later/road-to-composite-dispatch-topology and later/road-to-cost-parity-2-state-aware-dispatch already name, and the measurement prerequisite for later/road-to-elicitation-front-door. One addition unblocks three parked measurements; growth is claimed, not dodged via draft status (the hole road-to-draft-status-ratchet-boundary documents)."
---
# Road to suggestion block capture — a hook-carried instrument, not appetite

> **Source:** senior-review session 2026-08-23 against pinned commit
> `c7e82087e1402968b9ecf16d43cc3affd3968e47` (v14.10.0). The predecessor
> draft of an elicitation front door was rejected in that review because its
> verdict metrics had no capture instrument — the same defect that resolved
> the retrospective orchestration claim HONEST NULL at 0.27 % model-carried
> capture (`docs/CLAIMS.md:276` ff.). This roadmap builds the instrument
> first. The front door itself is parked in
> `later/road-to-elicitation-front-door.md` until this file's AC-4 is citable.

## Goal

A `user_prompt_submit` hook detects, from the existing deterministic render
signature, that the previous assistant turn emitted a numbered-options
suggestion block, classifies the current user turn (option number / as-is /
other), and appends a derived-counts JSONL line to the existing audit sink —
and a pre-registered capture-rate claim is resolved from a soak window with a
figure other roadmaps can cite. Zero standing-payload growth: the detector
keys on output the layer already produces.

## Context — what is verified in the tree

1. **The signature already exists.** `src/scripts/command_suggester/render.ts`
   emits a numbered-options block followed by "Exactly one
   `Recommendation: N — …` line" (`render.ts:10`), with the as-is option
   always last (`src/rules/command-suggestion-policy.md:31` ff.). Detection
   therefore needs no rule or contract text change — the corpus both
   standing-payload gates flag red (`road-to-standing-payload-diet.md:30-37`)
   is untouched.
2. **The hook slot is wired and linted.** `hooks/hooks.json` registers
   `UserPromptSubmit` through the central dispatcher; slot semantics are
   documented in `src/scripts/hook_manifest.yaml:339` ff. and gated by
   `lint_hook_manifest`. Latency budget: `any_hook_event p95_ci 250` ms
   (`src/config/hook-latency-budget.json`).
3. **The sink and the privacy pattern exist.**
   `agents/runtime/state/audit/*.jsonl` is the established telemetry sink,
   and `src/config/dispatch-economy-metrics.json:27` fixes the discipline:
   "a count derived from the result object, never its content."
4. **The model-carried alternative is measured and dead.** The
   `orchestration_record` model-carried step captured 1 of 369 dispatches
   (`docs/CLAIMS.md:276`). This roadmap exists because that number may not
   be repeated.
5. **Three parked consumers.**
   `later/road-to-composite-dispatch-topology.md:22-31` resumes only when
   "a post-hook telemetry capture rate has been recorded somewhere citable";
   `later/road-to-cost-parity-2-state-aware-dispatch.md` shares the queue
   conjuncts; `later/road-to-elicitation-front-door.md` (sibling of this
   change) names this file's AC-4 as its first resume conjunct.

## Prerequisites

- [ ] Hook dispatcher path resolves on a maintainer machine
      (`dist/hooks/dispatch.js` present after build).
      verify: the `UserPromptSubmit` entry in `hooks/hooks.json` executes
      without error on a no-op turn.

## Phase 1 — Payload probe and pre-registration, before any capture code

- [ ] **1.1 Probe: can the hook read the previous assistant turn?** On
      Claude Code, confirm from a live `user_prompt_submit` invocation which
      of the following the hook can reach: the event payload's own fields,
      or the transcript tail via a payload-carried path. Record the finding
      in `agents/evidence/analysis/suggestion-capture-probe.md` **either
      way** — a negative finding parks this roadmap to `later/` with the
      probe as the trigger, and is a publishable result, not a failure.
      Deliberately a phase step and not a `### blocker:` entry: the estate
      policy sanctions no new blockers without the claim path
      (`src/config/estate-count-budget.json` § growth_allowances).
      verify: the probe note exists and names the host version, the event
      fields observed, and the read path chosen or ruled out.
- [ ] **1.2 Register `claim:suggestion-capture-rate` in `docs/CLAIMS.md`,
      status `unbacked`, BEFORE the hook lands.** Threshold for the first
      soak window: **greater than zero and rising** — no percentage figure
      anywhere in the entry, mirroring the registered form of
      `claim:subagent-valid-envelope-rate`
      (`agents/roadmaps/archive/road-to-subagent-envelope-adoption.md:200`
      ff.), whose entry was written so `grep -c '%'` over it returns 0.
      Falsification: a window in which blocks are known to have been emitted
      (manual log kept by the maintainer during the window) but zero lines
      land DROPS the claim and parks the consumer roadmaps' resume
      conditions as unsatisfiable-by-this-instrument.
      verify: `grep -c '%'` over the claim entry returns 0; `check_claims`
      resolves its references.
- [ ] **1.3 Register the record schema as counts-only.**
      `src/config/suggestion-capture.json` (`schema_version`,
      `registered_at`, `owner`, `review_by` per the budget-ownership
      pattern of `hook-latency-budget.json`): fields are
      `ts, block_emitted, options_count, evidence_class,
      turn_classification` — classification enum
      `option_n | as_is | other | stale_block`. No prompt text, no option
      labels, no command names beyond the evidence class.
      verify: the config exists and
      `grep -ciE 'prompt|text|content' src/config/suggestion-capture.json`
      over field definitions returns 0.

**Exit:** probe answered, claim and schema merged, zero hook code written.
**Rollback:** delete two files; nothing consumes them yet.

## Phase 2 — The hook

- [ ] **2.1 Implement `suggestion_capture_hook` on `user_prompt_submit`.**
      Detection: previous assistant message matches the render signature
      (numbered options + exactly one `Recommendation:` line, per the
      GT-CS golden shapes in
      `tests/scripts/command_suggester_goldens.test.ts`). Classification of
      the current turn only when the signature is on the **immediately
      preceding** assistant message; an older block classifies as
      `stale_block`, never as a pick — this is the misclassification guard
      for a bare "1" answering something else.
      verify: unit tests cover all four enum outcomes plus the
      no-signature no-op path (no line written at all on ordinary turns).
- [ ] **2.2 Manifest entry and latency compliance.** Register the hook in
      `src/scripts/hook_manifest.yaml` for the `user_prompt_submit` slot.
      verify: `lint_hook_manifest` green; `bench_hook_latency` keeps
      `any_hook_event` within the registered 250 ms p95 CI budget — the
      budget file is NOT edited by this roadmap.
- [ ] **2.3 Sink wiring.** Append to `agents/runtime/state/audit/*.jsonl`
      alongside the orchestration lines; derived counts only, per 1.3.
      verify: one synthetic turn produces exactly one well-formed line;
      `jq` parses it; no field carries free text.

**Exit:** hook live on the maintainer workspace only.
**Rollback:** manifest entry removal; the sink keeps already-written lines.

## Phase 3 — Soak and verdict

- [ ] **3.1 Run the soak window** (length fixed in the 1.2 entry before the
      window starts) with a contemporaneous manual emission log kept by the
      maintainer, so "blocks emitted" has a reading independent of the
      instrument under test.
- [ ] **3.2 Resolve `claim:suggestion-capture-rate`** per 1.2 — greater
      than zero and rising, or DROP. Publish the figure in the claim entry
      in the citable form the parked consumers' resume conditions name.
      verify: the verdict PR flips the claim status and `check_claims`
      resolves the cited figures; the consumer roadmaps' resume text needs
      no edit to point at it.

**Exit:** a citable capture-rate reading exists — either direction.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-23 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Hook cannot see the previous assistant turn | implementation | Host payload may not expose the transcript tail; the whole design rests on it | Phase 1.1 probes before any code; negative finding parks the roadmap with the probe note as evidence | Phase 1 — Payload probe and pre-registration, before any capture code |
| 2 | Misclassification of bare numeric replies | implementation | A "1" answering an unrelated question logged as a pick corrupts every downstream metric | Signature-on-immediately-preceding-message precondition; `stale_block` enum; unit tests for all outcomes (2.1) | Phase 2 — The hook |
| 3 | Latency regression on a per-turn slot | implementation | `user_prompt_submit` fires every turn; a slow detector taxes every interaction | Registered 250 ms p95 budget enforced by the existing bench gate, budget file untouched (2.2) | Phase 2 — The hook |
| 4 | Content leakage into telemetry | product | Prompt text in an audit line is a privacy defect | Counts-only schema registered before code (1.3) with a grep-guard; sink review in 2.3 | Phase 1 — Payload probe and pre-registration, before any capture code |

## Acceptance Criteria

- [ ] AC-1 — The probe note, the claim entry, and the counts-only schema
      exist and predate the first hook commit in history.
- [ ] AC-2 — On the maintainer workspace, an emitted suggestion block
      followed by a pick, an as-is choice, an unrelated turn, and a stale
      reply each produce exactly the registered classification — unit- and
      one-live-turn-demonstrated, with no line written on ordinary turns.
- [ ] AC-3 — `lint_hook_manifest` and the hook-latency bench are green with
      the hook registered, with no edit to the latency budget file.
- [ ] AC-4 — `claim:suggestion-capture-rate` carries a resolved verdict
      with a citable figure, in the form the parked consumers' resume
      conditions name — or a recorded DROP that parks them honestly.

## Corrections applied at landing (2026-08-24)

Recorded rather than silently fixed, per this repository's convention.

| What | Was | Now | Why |
|---|---|---|---|
| Risk type, row 2 | `measurement` | `implementation` | `lint_plan_risk_register.ts:288-293` admits **only** `product` or `implementation`. A non-draft roadmap is not exempt, so the file could not have landed green at `status: ready` as written. |
| Risk type, row 4 | `legal` | `product` | Same gate, same reason. |
| Claim citation | `docs/CLAIMS.md:259` / `:269` | `docs/CLAIMS.md:276` | Line drift only. The figures (1 of 369 model-carried captures, 0.27 %) are real and verified at HEAD; only the anchor moved. |

**Verified unchanged at HEAD `0f7c26ee9`, not inherited:** all nine of this
roadmap's file:line citations re-resolve — `render.ts:8-12` (the numbered-options
plus single-`Recommendation:` signature), `command-suggestion-policy.md:31`
(as-is always present and last), the `UserPromptSubmit` registration,
`any_hook_event p95_ci 250`, `dispatch-economy-metrics.json:27` ("a count derived
from the result object, never its content"), the composite-dispatch resume
conjunct, and the "greater than zero and rising" claim model.

**One acceptance criterion is deliberately weaker than its phase.** Step 1.1
parks this entire roadmap if the probe finds a `user_prompt_submit` hook cannot
read the preceding assistant turn. That is unusual for `status: ready`, and it is
honest rather than accidental: the estate policy sanctions **no** new
`open_blockers` ("Nothing in the policy sanctions a new blocker"), so the
dependency is carried as a phase step instead of a blocker record. AC-1 names the
negative probe as a legitimate terminal state, not a failure.
