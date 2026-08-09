---
complexity: structural
status: later
---

# Road to worker-generation recycling — a worker at its budget hands off instead of dying

> **Parked in `later/` (2026-08-09).** Phases 0-1 shipped (PR #1228); every open
> step is gated on something outside this roadmap: Phase 2 on the maintainer
> blockers `host-worker-respawn` (its open half IS step 2.1),
> `capsule-quality-near-budget` (3 real long-task cases) and
> `orchestrator-only-mode-decision`; Phase 3 on ≥ 20 real recycling lines.
> Building Phase 2 now would also confound Phase 1's shadow measurement by
> construction. **Resume when** the maintainer blockers are resolved and
> Phase 1's exit gate (≥ 30 shadow capsules from real dispatches) has data.

> Today a worker that reaches its tier budget is killed by stop-loss and its
> partial work returns as an envelope the orchestrator has to re-brief from.
> There is no handoff. This roadmap adds one: a structured `CHECKPOINT` capsule
> emitted below the budget line, and a bounded generation chain that continues
> the same task in fresh context. The claim under test is STABILITY at held
> quality — token delta is recorded beside it and is explicitly **not** the
> claim.

> Source (consumed inbox): `agents/tmp.old/agent-orchestration.txt` (2026-08-08).
> The source proposed a four-phase "orchestrator-only doctrine"; two of its four
> phases are struck here against the tree and one is routed to a maintainer
> decision — see the gap table and `blocker: orchestrator-only-mode-decision`.

## Goal

On subagent-capable hosts, a worker that reaches 80 % of its tier budget emits a
structured state capsule and is replaced by a successor generation that reaches
a usable state from the capsule alone, within a hard generation cap — measured,
with an honest-null exit.

## Prerequisites

- [x] Per-worker stop-loss with a structured partial-result envelope
      (`_lib/worker_budget.ts` — `MAX_TOKENS_PER_WORKER`, `budgetForTier`;
      contract in `contexts/execution/subagent-spawn-contract.md` § L0b).
- [x] Response contract with the four-status envelope
      (`contexts/execution/subagent-response-contract.md`).
- [x] Status wire format to extend
      (`src/skills/subagent-orchestration/schemas/subagent-status.json`).
- [ ] `blocker: host-worker-respawn` resolved (Phase 2 onward) — manifest field
      landed 2026-08-09 (`worker_respawn`, false everywhere until observed); the
      "recycling path reads it" half is Phase 2.1 and still open.

## Context (verified against the tree, do not relitigate)

- **The gap is real.** Grep over the archived orchestrator-first roadmap returns
  zero hits for capsule / recycling / generation, and no `CHECKPOINT` capsule
  exists for subagents anywhere in `src/` — the term appears only in roadmap,
  mission and video command surfaces, which are a different mechanism. Stop-loss
  is a kill, not a continuation.
- **The stop-loss numbers the source quoted are current**: `lite 15k`,
  `medium 60k`, `high 150k`, refined from `budget_hit` telemetry.
- **Workers already carry only the kernel floor.** `generate_subagent_floor.ts`
  derives a ~1,100-char span from `KERNEL_RULE_IDS` into every dispatch
  template, drift-gated. The source's "maybe subagents work without rules"
  premise is the shipped design, not a proposal — nothing in this roadmap
  re-opens it.
- **The mandatory-delegation question is closed for now, by a rule written
  before the numbers.** `orchestration-observed-dispatch-cost` resolved
  **honest-null 2026-08-07** (`docs/CLAIMS.md`): no dispatch family proved out,
  and its pre-registered criterion (4) cancelled Phases 3–4 of
  `road-to-orchestrator-first-execution` as `[-]`. Those cancelled phases ARE
  the source's Phase 0/1/2. This roadmap does not re-scope that claim after the
  numbers — it takes the one mechanism the null did not test.
- **Why recycling is separable.** The null bound *whether delegation should be
  mandatory*. Recycling improves what happens to a worker that was dispatched
  anyway, under any delegation posture — it is downstream of the dispatch
  decision, not a way to re-argue it.

## Gap table — what is kept, folded, and cut from the source

| Source item | Verdict | Why |
|---|---|---|
| Worker-generation recycling via `CHECKPOINT` | **KEEP** | No equivalent in the tree; independent of the cancelled mode |
| `assumptions[]` in the capsule (from the same inbox file's folklore amendment) | **KEEP → folded into Phase 0** | Directly targets capsule quality; one schema change, not two roadmaps |
| Kernel-floor-only workers as doctrine | **CUT** | Already the shipped design (`generate_subagent_floor.ts`) |
| `subagents.orchestrator_only: strict` + hard-block hook | **CUT → blocker** | The cancelled Phase 3; a maintainer decision, not a plannable item |
| Orchestrator-side non-kernel rule compliance at return | **CUT → blocker** | The cancelled Phase 4 of the same roadmap |
| "Token savings" as the claim | **CUT** | Standing evidence points the other way; stability is the claim |
| Sufficiency-triggered emission (saturation, not token count) | **FOLD → Phase 1 alternative arm** | Same trigger surface; measuring two triggers costs one instrument |

## Phase 0 — The capsule schema, before anything emits one

- [x] 0.1 Extend `subagent-status.json` with a `CHECKPOINT` variant:
      `done[]` (with refs), `remaining[]`, `decisions[]`, `open_risks[]`,
      `touched_files[]`, `generation`. Raw transcript is invalid by
      construction — the schema has no field that can hold one.
      <!-- verify: npx vitest run tests/scripts/_lib_subagent_capsule.test.ts -->
      <!-- note: the authored verify command used `--filter`, which vitest does
           not accept (CACError: Unknown option `--filter`); corrected to the
           file-path form, which is what actually runs. -->
- [x] 0.2 Add `assumptions[]` — `{statement, basis, epistemic_state}` — to the
      capsule and to the worker result envelope. Unstated assumptions are the
      first thing compression drops, which makes them the most likely mechanism
      behind a degraded capsule; the field gives the successor a target list
      instead of implicit premises.
- [x] 0.3 Pick the epistemic vocabulary ONCE and record where it lives. It must
      not fork from the evidence grades already used for docs.
      <!-- verified | assumed | gap — the Evidence-Report buckets from
           evidence-discipline.md, pinned in subagent_capsule.EPISTEMIC_STATES
           and cited from subagent-response-contract.md § Stated assumptions. -->
- [x] 0.4 Emission is schema-additive and off: nothing reads a capsule yet.

**Exit:** schema lands, validates, and rejects a transcript-shaped payload in a test.
**Rollback:** additive fields — deleting them restores today's envelope.

## Phase 1 — Emit in shadow, measure the trigger

- [x] 1.1 At 80 % of `budgetForTier`, the worker template instructs a capsule
      emission. The headroom is the point: a worker at 100 % cannot summarise
      itself.
      <!-- CAPSULE_WATERMARK_FRACTION + watermarkForTier in worker_budget.ts;
           derived (never independently set) into SpawnBrief.capsule_watermark
           and the cache-stable payload prefix; evaluateWorkerBudget reports the
           band as watermark_hit. Contract: subagent-spawn-contract.md. -->
- [x] 1.2 Shadow only — the capsule is logged, the worker still runs to
      stop-loss. No behaviour change, so the measurement is not confounded by
      the mechanism it is measuring.
      <!-- orchestration_record: capsule_emitted, capsule_entries,
           watermark_step, saturation_step, trigger_arm_earlier — counts and
           enums only, a capsule's content never reaches telemetry. -->
- [x] 1.3 Second trigger arm, same instrument: novelty-per-step saturation
      (term-frequency, no embeddings). Log the step at which each trigger WOULD
      have fired. The hypothesis is that a worker near budget should have
      stopped earlier, not summarised harder.
      <!-- verify: npx vitest run tests/scripts/_lib_capsule_trigger.test.ts -->
- [x] 1.4 Pre-register in `docs/CLAIMS.md` BEFORE any capsule is read: capsule
      quality is scored on a fixed rubric; the 80 %-trigger and the saturation
      trigger are compared on paired samples; a trigger that does not beat the
      other by a stated margin is not adopted, and both losing is a publishable
      result.
      <!-- claim: worker-capsule-trigger-arm — status unbacked, rubric + margin
           + sample floor fixed at registration; both arms losing pre-authorised
           as a publishable null. -->

**Execution note (2026-08-09).** The phase's *steps* are implemented and shadow
emission is wired; its **Exit** is a data gate (≥ 30 shadow capsules from real
dispatches) that only real usage produces. The claim was registered before the
first capsule was read, which is the part that had to happen first.

**Exit:** ≥ 30 shadow capsules logged with both trigger points recorded; claim registered before the first read.
**Rollback:** watermark off → workers run to stop-loss exactly as today.

## Phase 2 — The recycling loop

> **Open by the roadmap's own gates, not by choice (2026-08-09).** Two blockers
> name Phase 2 and both are maintainer-owned: `host-worker-respawn` (half done —
> the manifest field exists, the recycling path that reads it IS 2.1) and
> `capsule-quality-near-budget`, which needs 3 real long tasks and cannot be
> manufactured here. Building the loop now would also break 1.2 by construction:
> the whole point of shadow mode is that no behaviour change confounds the
> measurement, and a live recycling loop is the confound.

- [ ] 2.1 On `CHECKPOINT`, the orchestrator kills the worker and spawns
      generation N+1 with the ORIGINAL brief plus the capsule — never the
      transcript, never an orchestrator-written re-brief (a re-brief would make
      the capsule's quality unmeasurable, which is the whole question).
- [ ] 2.2 Hard cap `max_generations: 3`. The 4th is a dispatch-rung error and
      escalates per L0b; it does not recycle.
      <!-- verify: npx vitest run tests/scripts/ --filter=generation -->
- [ ] 2.3 Telemetry per generation on the existing `orchestration_record` line:
      generation index, tokens at checkpoint, capsule size, whether the
      successor reached first-pass success. Provenance-tagged per line.
- [ ] 2.4 Capsule persistence to the SQLite substrate is **out of scope here** —
      it is a memory-layer decision governed by its own records, not a
      side-effect of this mechanism.

**Exit:** one real multi-generation dispatch completes end-to-end with telemetry; the cap is enforced by test.
**Rollback:** recycling off → capsules stay shadow-only (Phase 1 state).

## Phase 3 — Evidence gate: confirm, scope, or record the null

> **Open on sample size (2026-08-09).** 3.1 asks for ≥ 20 real recycling lines,
> and there is no recycling yet — Phase 2 is gated. The instrument it will read
> is in place: `worker-capsule-trigger-arm` is registered with its rubric,
> margin, and pre-authorised null, and the telemetry fields
> (`capsule_emitted`, `capsule_entries`, `watermark_step`, `saturation_step`,
> `trigger_arm_earlier`) are live on the `orchestration_record` line.

- [ ] 3.1 Accumulate ≥ 20 real recycling lines. Only real use produces them —
      the same sample-size constraint every orchestration claim in this repo
      has hit.
- [ ] 3.2 Resolve the stability claim: does recycling reduce verify-fail plus
      escalation rate versus the same task run to stop-loss, at held quality?
      Token delta is reported as a pair with quality, never alone.
- [ ] 3.3 A null closes the mechanism as default-off and says so. Given the
      standing orchestration null, "this also did not prove out" is the
      expected-value outcome and must be cheap to record.

**Exit:** the claim resolves backed or null; the default is set from that, not from momentum.
**Rollback:** none — measurement and recording only.

## Blockers

### blocker: capsule-quality-near-budget

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 2
- **What to do:** on 3 real long tasks, check that an 80 %-budget worker emits a
  capsule a successor can work from with no re-briefing. If capsules degrade,
  move the watermark down (75 / 70 %) before concluding that recycling fails —
  a bad watermark and a bad mechanism look identical from one sample.
- **Resolved when:** 3/3 successors reach a usable state from the capsule alone.

### blocker: host-worker-respawn

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 2
- **What to do:** confirm the host capability manifest can express kill +
  fresh-spawn mid-task, and add the field if it cannot. Hosts without it degrade
  to stop-loss, loudly.
- **Resolved when:** the manifest field exists and the recycling path reads it.
- **Progress 2026-08-09 — half done, and only half.** It could not: the manifest
  had four booleans and none of them expressed respawn. `worker_respawn` now
  exists on `HostCapabilityManifest`, in the safe default, in the normalizer,
  and in the settings-override surface — **`false` on every host, including
  `claude`**, per the registry's own standing rule that a field goes `true` only
  when the capability is OBSERVED, never inferred from spawn and kill existing
  separately. A test pins that false. The second half ("the recycling path reads
  it") is Phase 2.1 and cannot land while `capsule-quality-near-budget` is open,
  so this blocker stays **open**.

### blocker: orchestrator-only-mode-decision

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — recorded so the decision is not lost
- **What to do:** decide whether a `strict` mode that hard-blocks implementation
  in the main session is re-opened. It was cancelled 2026-08-07 by a
  pre-registered stopping rule, on a claim about token/quality wins. The inbox
  source argues a DIFFERENT claim — stability — and explicitly accepts the
  overhead as a maintainer preference. A preference is legitimate; a re-scoped
  claim invented after the numbers is not. If it re-opens, it re-opens as a
  stated stance with its own pre-registration, in its own roadmap.
- **Resolved when:** the decision is recorded either way.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-08 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Recycling becomes the cancelled mode through the back door | product | The source's four phases were one design; taking phase 3 alone can drift back into mandatory delegation because the same vocabulary carries both | The cut is written into the gap table by name, the cancelled items sit in a blocker rather than a phase, and no step here changes a dispatch decision — only what happens after one | Blockers |
| 2 | The capsule degrades exactly where it is needed | implementation | A worker near budget is the worst-placed agent to write a good summary, so the mechanism's input quality is lowest at its only trigger point | `blocker: capsule-quality-near-budget` gates Phase 2 on 3 real cases, and Phase 1 measures a second trigger that fires earlier by construction | Blockers |
| 3 | Shadow mode is skipped because the mechanism looks obviously right | implementation | Recycling is intuitive, and intuitive mechanisms are the ones that ship unmeasured; this repo has a standing null on exactly this surface | Phase 1 changes no behaviour at all, so there is nothing to gain by skipping it, and 1.4 registers the claim before the first capsule is read | Phase 1 |
| 4 | The generation cap is treated as a tuning parameter | implementation | A cap that is raised when it fires is not a cap, and an unbounded chain converts one stuck worker into unbounded spend | 2.2 pins the cap in a test; raising it is a visible diff against a test, not a config nudge | Phase 2 |
| 5 | `assumptions[]` becomes a field nobody fills | product | Optional schema fields decay to empty, and an empty field looks like "no assumptions" rather than "not recorded" | The field is scored as part of the Phase 1 capsule rubric, so an empty one costs quality points instead of passing silently | Phase 0 |
| 6 | Sample size never arrives and the roadmap idles | product | Every orchestration claim in this repo has stalled on real-usage volume; this one inherits that constraint | Phases 0-1 deliver standalone value (a schema and a measurement) and do not depend on the gate; 3.3 pre-authorises the cheap null so idling is not the only exit | Phase 3 |

## Acceptance criteria

- [x] The capsule schema rejects a transcript-shaped payload — proven by a test, not by prose.
      <!-- tests/scripts/_lib_subagent_capsule.test.ts § transcript-exclusion by
           construction: multi-line payload, over-length single line, and
           accumulation past MAX_ENTRIES all rejected in every list field. -->
- [x] Phase 1 changes no worker behaviour, and its claim is registered before the first capsule is read.
      <!-- Emission is shadow-only (worker still runs to stop-loss); claim
           worker-capsule-trigger-arm registered unbacked with rubric + margin
           fixed, zero capsules scored at registration time. -->
- [ ] A successor generation is briefed from the original brief plus the capsule only; no orchestrator re-brief appears in the path.
- [ ] The generation cap is enforced by a test that fails when it is raised.
- [ ] Both trigger arms have a published outcome, including the case where neither wins.
- [x] Nothing in the diff enforces, prefers, or implies mandatory delegation; the cancelled mode is only ever named in a blocker.
      <!-- Verified against the diff: zero hits for orchestrator_only /
           mandatory / "must delegate". Every change is downstream of a dispatch
           decision that was already taken. -->
- [x] Every item taken from the source appears in the gap table with a verdict — no item is adopted without one.
