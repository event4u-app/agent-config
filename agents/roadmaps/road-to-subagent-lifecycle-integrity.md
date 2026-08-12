---
complexity: structural
---

# Road to subagent lifecycle integrity — turn three production symptoms into deterministic guards

> **The ask (2026-08-12):** a production operator reports three recurring
> failures: (1) inconsistent frontend changes, (2) endless subagent runs,
> (3) subagents that finish and "signal" but whose result never reaches the
> orchestrator. This roadmap starts from confirmed repo defects at pinned
> commit `ed76d224` (v10.1.0, 2026-08-12) and draws external sources in
> per defect (ADR-211 C/D inverted harvest form). Symptoms (2) and (3) share
> one structural root — **no subagent lifecycle event is registered anywhere
> in the tree** — and symptom (1) is already owned by
> [`road-to-frontend-skill-application`](road-to-frontend-skill-application.md);
> this roadmap adds only two evidence-backed amendments there.

> **Provenance discipline.** Every repo claim below was verified against the
> live tree at `ed76d224c9e868206bfe1b11479c3d39b01c22b2` with file:line refs,
> and **re-verified at adoption against tip `1432c7a45`** — V7 flipped to
> `already-fixed`, V1b's count was wrong, V6's anchor moved; every other claim
> held. The verdict table lives in
> [`road-to-august-program`](road-to-august-program.md) § Verification at adoption.
> External claims carry their source. Anything marked *(proposal)* is this
> roadmap's own suggestion, never a foundation to cross-cite.

## Context / What is verified

**V1 — The host exposes subagent lifecycle events; the tree registers none.**
The dispatcher's event vocabulary is eight events with no `subagent_start` /
`subagent_stop` (`docs/contracts/hook-architecture-v1.md:26`), and
`hooks/hooks.json` binds seven native events, none of them SubagentStart/Stop
(re-counted at adoption — the draft said six; seven is also the count at the
pin, so the number was wrong, the substance is not; also recorded in
`agents/settings/contexts/elder-ponytail-harvest-cut.md:78-88`). The host-side
half was settled by spike S0.2: Claude Code 2.1.220's binary carries both
events, `SubagentStart` with an `additionalContext` injection payload
(`agents/evidence/investigations/solution-minimalism-phase0-spikes.md:104-131`).
The official hooks reference (fetched 2026-08-12) adds three facts the spike
did not need: `SubagentStop` is **blockable** (exit 2 "prevents the subagent
from stopping"), it receives **`last_assistant_message`** (recommended over
reading the lagging transcript), and both subagent events support **matchers on
agent type**.

**V2 — Envelope validation exists and is unwired; the reopen clause is
deadlocked.** `validateResponse` (`src/scripts/_lib/subagent_response.ts:74`)
has zero runtime consumers — grep at the pinned commit finds only tests and
sibling `_lib` files. Wiring it, and adding a `SubagentStop` concern, were both
cancelled 2026-08-07 by a pre-registered stopping rule, "re-openable the moment
a baseline arm exists (road-to-subagent-value-realization-followup Phase 1
Step 2)"
(`agents/roadmaps/archive/road-to-orchestrator-first-execution.md:435-448`).
That Step 2 is now **PREMISE-STALE**: always-on orchestration deleted the two
settings arms the step names, while the ≥20-dispatch half of the trigger is
"separately met at 99"
(`agents/roadmaps/road-to-subagent-value-realization-followup.md:46-56`,
note dated 2026-08-10). The reopen condition names an experiment the tree can
no longer express, so the cancellation can never lift by its own letter — while
production now supplies exactly the "used in anger" evidence the stopping rule
was waiting for.

**V3 — The worker stop-loss is prompt-carried only.** `MAX_TOKENS_PER_WORKER`
(`src/scripts/_lib/worker_budget.ts:27-31`) rides as a field in the spawn
envelope (`src/scripts/_lib/subagent_spawn.ts:46-49,107-122`); no hook or
runtime path counts a worker's actual consumption. Both capsule-emission
triggers are explicitly shadow-only: "NOTHING ACTS ON THESE"
(`src/scripts/_lib/capsule_trigger.ts:20-22`). The header's own live evidence:
four lookup-class workers burned 280–327k tokens each against a ~15k-class
budget (`worker_budget.ts:6-9`), ~1.21M tokens total
(`archive/road-to-orchestrator-first-execution.md:117-119`). This is the
measured shape of symptom (2).

**V4 — Nothing guards the spawn itself.** The `pre_tool_use` chain on the
claude platform is `block-no-verify, block-unauthorized-git,
evidence-independence, block-kernel-rule-writes, block-config-weakening,
rtk-wrap, design-slop, ui-route-nudge, code-graph-nudge, reread-guard`
(`src/scripts/hook_manifest.yaml`, platforms.claude.pre_tool_use) — no
depth cap, no concurrency cap, no open-dispatch ledger on `Agent`/`Task`.
The only concern bound to those tools is `orchestration-record`, which is
capture-only and "silent on every path" (`hook_manifest.yaml:396-408`).

**V5 — The refusal-capable stop gate has no view of pending async work.**
`turn-end-gate` is always armed on the `stop` slot and can refuse a turn-end
(`hook_manifest.yaml:445-460`; `src/scripts/hooks/turn_end_gate_hook.ts:810`
honours `stop_hook_active`). The subagent-orchestration skill dispatches
async by default ("keep working while they run",
`src/skills/subagent-orchestration/SKILL.md`, RDP section). Upstream issue
anthropics/claude-code#55754 documents the exact interaction loop: a Stop hook
grading a turn incomplete while an async background subagent is still pending
consumed a full session quota. No ledger in this tree lets the gate distinguish
"incomplete" from "awaiting a dispatched worker".

**V6 — The role-axis blocker is refuted by the host payload.** The manifest
pins the worker-role drop list on an env-var and records the blocker:
"in-process Agent-tool subagents inherit the host process env and cannot be
marked per-spawn" (`hook_manifest.yaml:547-550` at adoption; `:536-540` at the
pin — the comment moved, its wording did not). The official hooks reference
states that tool-event payloads **inside a subagent carry `agent_id` and
`agent_type`** precisely "to distinguish subagent hook calls from main-thread
calls". The env cannot mark a spawn; the payload already does. The blocker is
stale as written.

**V7 — Tier routing was measured caller-less; it has a caller now.**
`resolveSubagentRouting` was measured with "zero production callers; tier
selection was model-carried and it selected UP" — 27 of 39 metric-bearing
dispatches resolved to an Opus tier
(`archive/road-to-orchestrator-first-execution.md:305-310`). A worker on a
frontier tier with no enforced budget is the cost multiplier under symptom (2).
**Adoption correction (`already-fixed`):** the function now has its first
production caller — `src/scripts/hooks/delegation_nudge_hook.ts:342`, imported
at `:103` and wired at `hook_manifest.yaml:432-433`. So the *reachability* half
of this defect closed on its own between the pin and adoption; what remains
unmeasured is whether the wired caller actually changed the distribution. Phase
5 is re-scoped accordingly — the "delete it as dead code" branch is void.

**V8 — The return channel is fragile upstream, and the tree has no fallback.**
Upstream #58109 (open lineage from #20190, reproduced on v2.1.139): the Task
tool **drops the subagent's structured final report when its message sequence
ends with a `tool_use` block**, returning only the last pre-tool text — often
mid-investigation monologue. Whether it reproduces on the currently installed
host is unverified (Phase 0 spike). Separately, the official sub-agents doc
describes API-error partial returns, and a practitioner report (claudefa.st,
"subagent reported done") measured that a delivery duty stated in the **agent
definition** went 0/2 while the identical duty in the **dispatch prompt** went
1/1 — consistent with this tree's own worker-prompt contract placing duties in
the dispatch prompt (`src/agent-src/contexts/execution/subagent-spawn-contract.md`).
Nothing in the tree validates, retries, or falls back when the returned text is
not the envelope. This is symptom (3).

**V9 — Frontend enforcement is default-OFF at every deterministic link.**
`design-slop` no-ops unless `hooks.design_slop.enabled: true`
(`src/scripts/hooks/design_slop_hook.ts:9-11`); `ui-route-nudge` likewise,
warn-only, ≤2 nudges/session (`src/scripts/hooks/ui_route_nudge_hook.ts:38-39,53`);
the two UI rules declare `enforced_by: none` (stated in the same header,
lines 4-6). The catalogue/ownership causes are already decomposed with open
phases in `road-to-frontend-skill-application.md:46-56` (verdict table) — this
roadmap does **not** duplicate that work.

## Symptom → defect map

| Reported symptom | Confirmed defect(s) | Phase |
|---|---|---|
| Endless subagent runs | V3 (prompt-only stop-loss), V4 (no spawn guard), V7 (tier-up, no caller), V5 (stop-gate × async loop shape) | 1, 3, 5 |
| Finished, signalled, not returned | V1+V2 (no SubagentStop, validator unwired, reopen deadlocked), V8 (fragile return channel, no fallback) | 0, 1, 2 |
| Inconsistent frontend changes | V9 (all deterministic links default-OFF) — owned elsewhere | 6 (amendments only) |

## External sources drawn in (per defect, not additively)

- Claude Code hooks reference, code.claude.com/docs/en/hooks.md (fetched
  2026-08-12): SubagentStop blockability, `last_assistant_message`,
  `agent_id`/`agent_type` payload fields, agent-type matchers, `PostToolBatch`.
- anthropics/claude-code#58109 (← #20190): final-block `tool_use` truncation → V8.
- anthropics/claude-code#20221: prompt-**type** SubagentStop hooks send feedback
  but do not prevent termination → Phase 2 uses command hooks only.
- anthropics/claude-code#55754: Stop-hook × async-subagent infinite loop;
  argues for ledger-aware stop gating and hard iteration caps → V5, Phase 3.
- anthropics/claude-code#68619 (+ operator gist): recursive spawn regressions,
  depth caps must live where one process sees the whole tree → Phase 3 design.
- claudefa.st "Subagent Not Returning Results": dispatch-prompt-carried duties
  outperform agent-definition-carried duties (0/2 vs 1/1, n small) → Phase 2.
- builder.io "How to Make AI Agents Follow Your Design System":
  changed-files-scoped strict lint config for agent turns; meta-lint banning
  suppression comments in changed files → Phase 6 amendments.

## Phase 0: Spikes — pin the host, reproduce the two upstream premises

- [ ] **Step 1:** Record the installed host version and re-extract the event
      enum (S0.2 method). Assert `SubagentStop` still present; record the
      version pin next to the finding.
- [ ] **Step 2:** Payload spike: one throwaway `SubagentStop` command hook in a
      scratch project; capture the raw stdin JSON. Assert `last_assistant_message`
      and `agent_type` arrive as documented on THIS host version.
- [ ] **Step 3:** Reproduce-or-refute #58109 on the installed host: a subagent
      instructed to end on a `tool_use` block, then asked for a structured
      report. Record whether the parent receives the report.
- [ ] **Step 4:** Payload spike inside a subagent: confirm `agent_id` /
      `agent_type` are present on `PreToolUse`/`PostToolUse` stdin when the
      caller is a Task-spawned subagent (V6 refutation, verified locally).

**Falsifier.** Step 2 or 4 shows the documented fields absent on the installed
host → Phases 2 and 4 are re-scoped to what the payload actually carries before
any code is written; the doc claim is recorded as version-gated.

**Rollback.** Spikes are scratch-project only; nothing lands in the tree except
the evidence file.

## Phase 1: Measure — lifecycle capture, no behaviour change

Adds `subagent_start` / `subagent_stop` to the dispatcher vocabulary
(`hook_manifest.yaml` + `hooks/hooks.json` + the contract's event table) and
binds **capture-only** concerns. This is the consolidation shape the 2026-08-07
council already blessed ("a vocabulary entry plus a concern that appends to the
existing audit stream", `archive/road-to-orchestrator-first-execution.md:442-445`)
— what changed since the cancellation is that the reopen trigger's letter is
dead (V2) and production evidence exists.

- [ ] **Step 1:** Vocabulary + native mapping + contract table row. Lint
      (`lint_hook_manifest`) updated in the same change.
- [ ] **Step 2:** `subagent-ledger` concern *(proposal)*: on `subagent_start`,
      append an open-dispatch record `{agent_id, agent_type, started_at}` to
      gitignored runtime state; on `subagent_stop`, close it with
      `{duration, envelope_parse: ok|fail|absent}` — envelope parse runs
      `validateResponse` against `last_assistant_message` in **observe mode**
      (no decision emitted, ever, in this phase).
- [ ] **Step 3:** Depth/concurrency signals: an open record whose starting
      payload itself carries an `agent_id` is a nested spawn; record depth and
      the concurrent-open count per event.
- [ ] **Step 4:** Publish the baseline after ≥20 real dispatches: envelope
      return rate, parse-failure rate, duration distribution, nested-spawn
      count. This number replaces the 0.27% model-carried capture as the
      instrument (`archive/road-to-orchestrator-first-execution.md:299-305`).

**Falsifier.** Envelope return rate ≥95% and no dispatch exceeds 2× its
tier budget-equivalent duration over the window → symptoms (2)/(3) are not
reproducible under measurement; Phases 2–3 are demoted to `later/` and the
null is published.

**Rollback.** Remove the two vocabulary entries and the concern; the audit
lines already written stay as data.

## Phase 2: Return-channel integrity — validate, fall back to disk, retry once

Gated on Phase 1 baseline showing parse-failure or absence at a rate worth a
mechanism (pre-register the threshold before reading the number).

- [ ] **Step 1:** Worker-prompt contract addendum (dispatch-prompt-carried, per
      the claudefa.st 0/2-vs-1/1 finding and this tree's own contract
      placement): (a) the final message is a single **text-only** envelope —
      never end on a tool call (#58109 mitigation); (b) the same envelope is
      also written to the runtime artifact dir as a file before the final
      message. The disk copy is the durable channel; the message is the fast
      channel. Amends `subagent-spawn-contract.md` + `subagent-response-contract.md`.
      **The addendum explicitly covers the verifier dispatch shape** (program
      X1): the async design-verifier `road-to-source-first-frontend` leans on is
      itself a subagent on this return channel — a verifier that screenshots,
      grades and never delivers is both operator symptoms in one run.
- [ ] **Step 2:** `subagent-return-gate` concern on `subagent_stop` *(proposal)*,
      **command type only** (#20221 excludes prompt-type): parse
      `last_assistant_message` with `validateResponse`; on failure, look for
      the Step-1 disk envelope; if found, inject its path via
      `additionalContext` to the parent and allow. Only if BOTH channels fail:
      emit `decision: block` with the validator's errors as the reason —
      **at most once per `agent_id`** (state-keyed valve, then release), the
      same anti-loop shape as `MAX_NUDGES` (`ui_route_nudge_hook.ts:53`) and
      `DEGRADE_AFTER` (`design_slop_hook.ts:34`). Activation posture per the
      concern activation policy (program X3) — this step does not re-argue it.
- [ ] **Step 3:** Snapshot tests under `tests/hooks/` for all four paths
      (ok / disk-fallback / block-once / release), per the manifest's own
      concern checklist (`hook_manifest.yaml:10-14`).

**Falsifier.** Post-flip envelope return rate does not improve against the
Phase-1 baseline over an equal window → the mechanism is dead weight; revert
Step 2, keep Step 1's contract text only if its half of the metric moved.

**Rollback.** Concern unbinds from the manifest in one line; contract addendum
reverts by file.

## Phase 3: Runaway containment — spawn guard, ledger-aware stop gate, shadow stop-loss

- [ ] **Step 1:** `spawn-guard` PreToolUse concern on `Agent`/`Task`
      *(proposal)*: refuse a spawn when the ledger shows depth ≥ N or
      concurrent-open ≥ M (start values N=2, M=4 — pre-registered, refined
      from Phase-1 telemetry, never final). Ships **warn-first** (exit 2 with
      reason, no deny) for one measurement window, then flips to deny on
      evidence — **per the concern activation policy** (program X3), which this
      step cites instead of re-arguing the turn-end-gate soak history it is
      derived from (`hook_manifest.yaml:477-481` at adoption). Depth caps live
      orchestrator-side
      because children cannot be trusted to carry them (#68619).
- [ ] **Step 2:** `turn-end-gate` consults the ledger: an open dispatch is an
      explicit **allow** path for the completion-adjacent detectors, closing
      the #55754 loop shape. One test: pending-dispatch turn-end is never
      refused.
- [ ] **Step 3:** Wall-clock and tool-call-count stop-loss per open dispatch —
      **shadow first**: log the step at which each arm WOULD have fired,
      exactly the `capsule_trigger.ts` discipline ("NOTHING ACTS ON THESE"),
      because hooks cannot read token counts and a proxy must earn its
      trigger. Acting on the winning arm is a separate, evidence-gated change.

**Falsifier (Step 1).** The warn window shows zero would-have-fired events
across ≥20 dispatches → the caps are solving a problem this estate does not
have; record the null, leave the guard warn-only or remove it.

**Rollback.** Each concern is one manifest line; ledger stays (it is Phase-1
infrastructure).

## Phase 4: Role axis binds on payload, not env

- [ ] **Step 1:** Extend `_lib/session_role.ts` resolution: payload `agent_id`
      present ⇒ role `worker`, without touching the env path (CLI spawn
      wrappers keep working). Gated on the Phase-0 Step-4 spike.
- [ ] **Step 2:** Supersede the stale blocker comment
      (`hook_manifest.yaml:536-540`) with the payload mechanism and the spike
      ref — corrected in place, the same way round 7 corrected the
      verify-before-complete path comment (`hook_manifest.yaml:63-66`).
- [ ] **Step 3:** Keep the invariant: `pre_tool_use` concerns are never
      droppable by role (the resolver already refuses this; add the payload
      path to the existing test).

**Falsifier.** Phase-0 Step 4 shows no `agent_id` on tool events for in-process
subagents on the installed host → the blocker stands as written; this phase is
cancelled and the comment gains the version-gated evidence instead.

**Rollback.** Resolver change is one function; revert restores env-only.

## Phase 5: Tier routing has a caller — measure whether it moved the distribution

Re-scoped at adoption (V7 `already-fixed`). The draft's Step 1 offered a
wire-it-or-delete-it fork; the fork is decided — `delegation_nudge_hook.ts:342`
wires it, so neither branch is work. What the draft's evidence never covered is
whether a *wired* caller changes the outcome, and that is the open question.

- [ ] **Step 1:** Confirm the wired call site actually governs the dispatches the
      ledger counts — `delegation-nudge` runs on `user_prompt_submit` and is
      advisory (it injects a verdict line, it does not select the tier for the
      spawn). If the tier the spawn uses is still model-carried downstream of the
      nudge, the caller is reachable but **not** load-bearing, and that is the
      finding to publish, not a second wiring change.
- [ ] **Step 2:** Re-measure the tier distribution over the next ≥20 dispatches
      via the Phase-1 ledger; publish the before/after pair.

**Falsifier.** Distribution unchanged with the caller wired → tier drift is
not routing-caused; publish and stop here.

**Rollback.** Single call-site change.

## Phase 6: Frontend amendments — SUPERSEDED by road-to-source-first-frontend

**Superseded at adoption (program X7), marked not deleted — the trail stays.**
Both steps were written before `road-to-source-first-frontend` existed; that
roadmap now carries the frontend enforcement story with more evidence, and these
two steps file into `road-to-frontend-skill-application` exactly as written —
from SFF Phase 6, not from here. Nothing is lost; the destination is unchanged.

Symptom (1) is owned by `road-to-frontend-skill-application.md`, whose open steps
at adoption are Phase 2 `:80-82`, Phase 4 `:109`, Phase 5 `:123-124` — **Phase 3
is fully closed**, correcting the draft's "open Phases 2–5".

- [-] **Step 1:** *(superseded — SFF owns it; files into that roadmap's Phase 5)* A
      changed-files-scoped strict lint pass for agent turns — strict rules on
      the turn's touched UI files only, plus a meta-lint rejecting new
      suppression comments in changed files (builder.io AX pattern; composes
      with the existing `lint_design_slop` registry rather than a new linter).
- [-] **Step 2:** *(superseded — SFF owns it; same destination)* Evidence-gate
      flipping `design-slop` default-ON (warn-only, valve intact): pre-register the
      consultation-rate delta the flip must show against that roadmap's
      Phase-1 baseline; flip only on the number.

**Falsifier.** Owned by the destination roadmap's own falsifiers; these steps
inherit them.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-12 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Reopening cancelled work on a clause that cannot lift | product | V2 argues the 2026-08-07 stopping rule's reopen condition is deadlocked and therefore reopens two cancelled items on production evidence instead. That reasoning is correct and is also exactly the shape a scope-creep argument takes — "the lock cannot fire, so I am free". If the deadlock reading is wrong, this roadmap re-proposes work a council already refused | The reopen is confined to the two items whose clause is provably dead (envelope wiring, SubagentStop concern) and explicitly does NOT revive the orchestrator-first content verdict, which is restated as a non-goal; the deadlock claim carries its own file:line evidence on both halves so a reviewer can refute it in one read | Phase 1 |
| 2 | A blockable stop hook turns a fragile return into a hung subagent | implementation | `SubagentStop` is blockable — exit 2 prevents the subagent from stopping. A return gate that blocks on a validation failure can therefore convert symptom (3) "finished but did not return" into something worse: a worker that cannot finish at all, and an upstream loop shape (#55754) that consumed a full session quota | Step 2 blocks at most once per `agent_id` behind a state-keyed valve, then releases; the disk fallback is tried before any block, so the block path is reached only when both channels failed; four snapshot tests pin ok / disk-fallback / block-once / release | Phase 2 Step 2 |
| 3 | Spawn caps picked from no data | implementation | N=2 depth and M=4 concurrency are stated as start values with no measurement behind them. Caps set too low refuse legitimate fan-out — this estate's own analysis runs routinely dispatch more than four readers at once — and a refusal is invisible to the user as anything but a broken turn | The guard ships warn-first for a full window and only flips to deny on evidence; the numbers are refined from Phase-1 telemetry before the flip; the falsifier records a null and leaves the guard warn-only if zero would-have-fired events occur over ≥20 dispatches | Phase 3 Step 1 |
| 4 | The Phase-0 spikes cannot run, and the plan proceeds anyway | implementation | Every mechanism in Phases 2 and 4 rests on payload fields (`last_assistant_message`, `agent_id`, `agent_type`) documented for a host version that is not the installed one, plus an upstream truncation bug whose current reproduction status is unknown. Building against documentation is the failure the source-discovery gate exists to stop | Phase 0 is scratch-project only and its falsifier re-scopes Phases 2 and 4 to what the payload actually carries before any code is written; Phase 4 is cancelled outright if `agent_id` is absent, with the stale blocker comment gaining version-gated evidence instead | Phase 0 |
| 5 | The ledger becomes unbounded runtime state | implementation | An open-dispatch record per spawn, appended for every session, is append-only state with no stated retention — the exact growth-budget failure the persistence discipline names for audit tables. A ledger that grows without a prune path is a new maintenance surface, not an instrument | The ledger lives in gitignored runtime state and is scoped to open dispatches, closed on `subagent_stop`; retention is declared in the same change that introduces it, and the rollback removes the concern while leaving already-written audit lines as data | Phase 1 Step 2 |

## Non-goals

- No orchestrator-first / mandatory-delegation revival — the 2026-08-07
  stopping rule's *content* verdict stands; this roadmap reopens only the two
  items whose reopen clause is deadlocked (V2), on new production evidence.
- No LLM-as-judge anywhere in the enforcement path (deterministic gates only).
- No token-exact budget enforcement claims — hooks cannot see token counts;
  Phase 3 Step 3 is honest about proxies and shadows them first.
- No duplication of `road-to-frontend-skill-application` — amendments only.
