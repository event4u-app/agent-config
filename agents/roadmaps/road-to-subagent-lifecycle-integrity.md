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
> [`road-to-august-program`](archive/road-to-august-program.md) § Verification at adoption.
> External claims carry their source. Anything marked *(proposal)* is this
> roadmap's own suggestion, never a foundation to cross-cite.

## Outcome — drain run 2026-08-20

> **Archived does not mean achieved, and this roadmap is not archived.** Four
> steps remain open on purpose: each is a measurement window or an undecided
> design question, and a `[x]` on any of them would be evidence nobody observed.
> The operator's three symptoms are **instrumented, not fixed** — every guard
> this roadmap shipped is shadow or capture-only by design, so nothing here has
> yet refused a single spawn or recovered a single lost return.

Per phase, in the framework's four outcome states.

| Phase | State | What that means |
|---|---|---|
| 0 — spikes | **transferred** (partly) | Steps 1, 3 closed. Steps 2, 4: both assertion halves **answered** from shipped instruments (§ B2-B4); only the verbatim-payload halves moved to [`stubs/road-to-subagent-payload-capture.md`](stubs/road-to-subagent-payload-capture.md). |
| 1 — measure | **narrowed** | Steps 1-3 shipped. Step 4 publishes **three of four** baseline columns plus a fifth the step never named; the envelope-return column is now measurable *forward* because the four-way split landed, and has no reading yet. |
| 2 — return channel | **narrowed** | Step 1 (contract addendum) shipped earlier. Step 2's part (i) — the four-way verdict split — landed here, so its fallback condition is expressible for the first time; the concern itself stays gated on a post-split window. Step 3 waits on the concern. |
| 3 — containment | **satisfied**, and its falsifier now evaluated | All three steps shipped shadow-first. The Step 1 falsifier **does not fire**: 96 `would_deny` at the widest candidate over 325 dispatches (§ B6), so the guard is not removed. |
| 4 — role axis | **transferred** (Step 1) + **satisfied** (Steps 2, 3) | Step 3's invariant test landed, and found the neighbouring test had no sensitivity to the guard it was named after. Step 1 is gated on Phase 0 Step 4 and closes against the stub. The phase falsifier cannot run — recorded, not pending. |
| 5 — tier routing | **satisfied**, as a published null | Step 2's before/after pair is unbuildable by the named instrument (the ledger carries no tier) and cannot have moved (nothing reads the resolver's output). The falsifier's publish-and-stop branch is taken **on a derivation, never on a measured distribution** (§ B5). |
| 6 — frontend | **abandoned here** (superseded) | Unchanged: both steps file into `road-to-frontend-skill-application` via SFF. |
| 7 — `do_not_touch` guard | **narrowed** | Condition (a) is **met by measurement** — 6 of 13 envelopes carry the field — so the phase falsifier is **refuted** and the guard is not cancelled. (b)'s preferred cheap route turned out not to exist, and a fourth condition (d) surfaced. Two named design decisions now block it, not a missing producer. |

**What the drain run added that was not on the plan.** Three corrections to the
roadmap's own text, each recorded at its step: the `last_assistant_message` half
of Phase 0's falsifier note was wrong (the ledger *could* see it); Phase 7's
per-turn-cost citation was stale by six lines; and Phase 2 Step 2's join
availability is 8.0 %, not "not always available".

**The four still-open items, and what each waits on.** Phase 1 Step 4 — one
column, one window. Phase 2 Step 2 — a pre-registered threshold off that window.
Phase 2 Step 3 — the concern Step 2 would ship. Phase 7 Step 1 — decisions (c)
and (d). None of the four waits on the transferred capture.

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
(`agents/roadmaps/archive/road-to-subagent-value-realization-followup.md:46-56`,
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
(`hook_manifest.yaml:445-460`; `src/scripts/hooks/turn_end_gate_hook.ts:841`
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

- [x] **Step 1:** Record the installed host version and re-extract the event
      enum (S0.2 method). Assert `SubagentStop` still present; record the
      version pin next to the finding.
      → Host **2.1.229** (the spike pinned 2.1.220, so this is a fresh
      extract, not a transfer). Exact-token counts: `SubagentStop` **24**,
      `SubagentStart` **12** — both present. Payload field names
      (`agent_id`, `agent_type`, `last_assistant_message`, …) are present in
      the string table, which is a **presence** check and not proof that a
      given event carries a given field — Steps 2 and 4 remain open and
      Phase 4 stays gated on Step 4.
      `agents/evidence/investigations/subagent-lifecycle-phase0-host-pin.md`.
- [-] **Step 2:** *(raw-capture half transferred to [`stubs/road-to-subagent-payload-capture.md`](stubs/road-to-subagent-payload-capture.md) — council disposition **B**, outcome state `transferred`; both assertions answered here)* Payload spike: capture the raw `SubagentStop` stdin JSON and
      assert `last_assistant_message` and `agent_type` arrive as documented on
      THIS host version.
      **Both assertions are now answered, and neither needed the capture.** The
      transferred residue is narrower than the step: the verbatim field list, and
      **which** of the two accepted key spellings the host sends.
      **Assertion 1 — `last_assistant_message` IS delivered.** The 17 `fail`
      records in the post-fix window are an existence proof rather than an
      inference: `classifyEnvelope` can only reach `fail` after a JSON object was
      decoded *out of the message*, which requires a non-blank message string.
      What the ledger cannot say is which key carried it — it reads
      `last_assistant_message` and `lastAssistantMessage` through one lookup — and
      that is exactly the half the stub holds
      (`subagent-lifecycle-drain-close.md` § B2).
      **Assertion 2 — `agent_type` is NOT delivered**, confirmed at 136× the
      original sample: 3,129 of 3,400 stops null (92.0 %), and the 271 that carry
      one are exactly the 271 with a correlated start (§ B3).
      **Where the line falls:** the assertions were answerable from a shipped
      instrument; the verbatim payload is not observable from inside a session at
      all. Only the second is in the stub.
      **The throwaway hook this step specified is unnecessary — the capture is
      already shipped.** `_maybe_capture_payload` (`dispatch_hook.ts:486`) writes
      the raw stdin payload to `$AGENT_HOOK_CAPTURE_DIR` and is called
      unconditionally at `:1082`, before concern resolution, so it captures every
      event on every platform; it is in the built bundle and was verified against
      the shipped dispatcher (F3 of
      `subagent-lifecycle-phase0-return-channel.md`). What remains is a
      host-environment act, not authoring — see `blocker: raw-capture-needs-host-env`.
      **Second assertion already answered, and it fails:** `agent_type` does NOT
      arrive on `SubagentStop` — 18 of 25 stop records read `agent_type: null`,
      and the 7 that carry one inherited it from their start record (F4). The
      first assertion stays open because the ledger cannot see it (F2).
- [x] **Step 3:** Reproduce-or-refute #58109 on the installed host: a subagent
      instructed to end on a `tool_use` block, then asked for a structured
      report. Record whether the parent receives the report.
      → **REPRODUCED** on 2.1.229, with a matched control dispatched in the same
      turn: control (ends on assistant text) returned the full report; treatment
      (ends on `echo done`) returned `(no output)` to the parent after 3 tool
      uses and 18,242 tokens. The work was paid for in full and discarded in
      full. `agents/evidence/investigations/subagent-lifecycle-phase0-return-channel.md`
      § F1. This is the measurement Phase 2 Step 1's never-end-on-a-tool-call
      clause was missing.
- [-] **Step 4:** *(raw-capture half transferred to [`stubs/road-to-subagent-payload-capture.md`](stubs/road-to-subagent-payload-capture.md) — council disposition **B**, outcome state `transferred`; the derivable half is recorded here)* Payload spike inside a subagent: confirm `agent_id` /
      `agent_type` are present on `PreToolUse`/`PostToolUse` stdin when the
      caller is a Task-spawned subagent (V6 refutation, verified locally).
      Same method correction as Step 2 — no scratch hook, one env var.
      **The derivable half, and it is negative space rather than an answer:** in
      632 observations no payload has ever supplied a parent — 307 of 307
      `subagent_start` records read `assumed-root` / `parent_ref: null`, and 325
      of 325 `spawn_guard_shadow` records read
      `depth_usable_for_derivation: false`. A grep of `src/` confirms nothing in
      the tree reads `agent_id` or `agent_type` off a tool event at all
      (`subagent-lifecycle-drain-close.md` § B4).
      **This is deliberately NOT read as an absence proof.** `spawn_guard_shadow`
      fires on the parent's `Agent`/`Task` call, before a child exists, so a
      subagent's own tool events are a population these 632 records do not
      sample. Zero positive observations plus no instrument able to produce one
      is the honest statement; Phase 4's falsifier cancels a phase on *absence*,
      and absence-of-evidence is not it.
      **Where the line falls:** everything observable from the existing
      instruments is above; the in-subagent payload itself is in the stub.

**Falsifier.** Step 2 or 4 shows the documented fields absent on the installed
host → Phases 2 and 4 are re-scoped to what the payload actually carries before
any code is written; the doc claim is recorded as version-gated.
**Partially FIRED 2026-08-13:** `agent_type` is absent on `SubagentStop` (F4),
so the doc claim is version-gated on that field already and Phase 2 Step 2's
per-agent logging is re-scoped accordingly. The `last_assistant_message` half is
untouched — it needs Step 2's raw capture, not the ledger.
**Corrected 2026-08-20 — that last sentence was wrong, and the ledger did see
it.** `last_assistant_message` is delivered, proved by 17 `fail` verdicts which
cannot be produced without a message string (§ B2). What the raw capture is
still needed for is one degree narrower: the exact key spelling and the full
field list. The falsifier's re-scoping obligation is therefore discharged for
Phase 2 (both fields now have observed answers) and remains open for Phase 4,
whose field is on a payload class no instrument in this tree samples.

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

- [x] **Step 1:** Vocabulary + native mapping + contract table row. Lint
      (`lint_hook_manifest`) updated in the same change.
      → `subagent_start` / `subagent_stop` added to both `EVENT_VOCABULARY`
      copies (`dispatch_hook.ts`, `lint_hook_manifest.ts`), to
      `host_semantics.CLAUDE_HOOK_EVENT_NAME`, to the `claude` + `cowork`
      alias tables and platform chains, and to the contract's Event row.
      **`hooks/hooks.json` was NOT hand-edited** — it is generated from the
      manifest by `build_claude_hook_matrix`, so `task sync` +
      `task generate-tools` regenerated it (`plugin_hooks` 7 → 9).
      Two downstream surfaces the step's text does not name and CI does:
      `concern_registry.ts` (parity test) and the manifest's bound-concern
      lint. *Verified:* `lint_hook_manifest` exit 0; `tests/hooks` +
      `tests/scripts/lint_hook_manifest.test.ts` 52 pass.
- [x] **Step 2:** `subagent-ledger` concern *(proposal)*: on `subagent_start`,
      append an open-dispatch record `{agent_id, agent_type, started_at}` to
      gitignored runtime state; on `subagent_stop`, close it with
      `{duration, envelope_parse: ok|fail|absent}` — envelope parse runs
      `validateResponse` against `last_assistant_message` in **observe mode**
      (no decision emitted, ever, in this phase).
      → `src/scripts/hooks/subagent_ledger_hook.ts`, bound on the two new
      events only. **One deliberate departure from the step's literal text:**
      the raw `agent_id` is never written. It is a host-supplied high-entropy
      token of exactly the class `orchestration_record_hook` refuses to record
      (`check_secret_leak` flags them as candidate credentials), so the ledger
      stores `ref` — a local SHA-256 prefix — which correlates start↔stop and
      child↔parent without persisting the host's token. `last_assistant_message`
      never reaches disk in any form; only the three-way verdict and an error
      **count**. A negative test plants both hostile values in the fields under
      test and greps every written byte.
- [x] **Step 3:** Depth/concurrency signals: an open record whose starting
      payload itself carries an `agent_id` is a nested spawn; record depth and
      the concurrent-open count per event.
      → Depth is derived from the open-record set, never asserted: a named
      parent gives `depth_basis: "observed"`, no parent field at all gives
      depth 1 with `"assumed-root"` — absence recorded as absence, since
      Phase 0 Steps 2/4 are what will replace the assumption with an observed
      payload shape. *Verified:* 16 tests in `tests/hooks/subagent_ledger.test.ts`.
- [x] **Step 4:** Publish the baseline after ≥20 real dispatches: envelope
      return rate, parse-failure rate, duration distribution, nested-spawn
      count. This number replaces the 0.27% model-carried capture as the
      instrument (`archive/road-to-orchestrator-first-execution.md:299-305`).
      **Two corrections before the number is published, both measured
      2026-08-13** (`subagent-lifecycle-phase0-return-channel.md`):
      (a) **the envelope-return column does not yet measure envelope return.**
      `classifyEnvelope` reports `absent` both for "nothing came back" and for
      "prose came back", and prose is what nearly every subagent returns — the
      window reads 25 of 25 `absent`, including the #58109 control arm that
      returned a complete report. A rate off this column would read 0 % and be
      measuring the answer format. The three-way split (`no_message` /
      `no_envelope` / `ok`) lands with Phase 2 Step 2, which needs the same
      distinction.
      (b) **the dispatch denominator is not per-session.** 7 starts against 25
      stops in one window, but three sessions share the ledger file and one stop
      record is a `general-purpose` agent this session never dispatched. The
      `OpenRecord` already carries `session_id` and the appended line does not —
      write it before computing any rate, or the baseline aggregates strangers.
      **(b) is FIXED as of 2026-08-14 — do not re-implement it.** Both dispatch
      lines now carry `session_id` (`subagent_ledger_hook.ts:593` and `:608`,
      with the file header stating it at `:76`), recording the *observed*
      session rather than back-filling from the start record. The line citation
      is deliberately given as a pair plus the header rather than as a single
      offset: this step's Phase-4 sibling has now had three successive line
      citations rot, and the durable anchor is the field name.
      **What (b) does NOT fix, and why this step is still open:** the window
      that accrued *before* the fix is still cross-session and stays
      undiscardable-by-filtering, so the ≥20-dispatch baseline starts counting
      from the fix commit forward, not from the existing 25 stop records.

      **NARROWED 2026-08-20 — three of the four columns are published; the
      fourth is named, not skipped.** Full numbers, commands and cutoff:
      [`subagent-lifecycle-drain-close.md`](../evidence/investigations/subagent-lifecycle-drain-close.md)
      § B1. Post-fix window 2026-08-14T23:04Z → 2026-08-20T15:28Z, 57 sessions,
      307 starts / 3,400 stops — the ≥20 bar cleared by an order of magnitude.
      - **parse-failure rate — 0.50 %** (17 of 3,400), every one carrying
        `envelope_error_count: 5`, which reads as one recurring answer shape
        rather than 17 independent malformations.
      - **duration distribution** over the 271 stops that carry one: p50 316 s,
        p90 809 s, max 2,665 s (44.4 min). Stated with its denominator — a
        duration needs a matched start and 3,129 stops have none, so this
        describes the correlated 8.0 %, never the population.
      - **nested-spawn count — 0 of 307.** Same observation as Phase 0 Step 4's
        derivable half.
      - **envelope return rate — NOT published, and (a) is why.** 3,383 of 3,400
        read the collapsed `absent`; a rate off that column measures the answer
        format, at n=3,400 exactly as it did at n=25. **The four-way split
        `(a)` asked for landed in this change** — `classifyEnvelope` now returns
        `no_message` / `no_envelope` / `fail` / `ok`
        (`subagent_ledger_hook.ts`, `EnvelopeParse`), with the retired value
        exported as `RETIRED_ENVELOPE_PARSE` and fenced by a test that no input
        can produce it. So the column is measurable **forward from this commit**;
        the historical 3,383 stay unresolvable by filtering, the same way the
        pre-`session_id` window does. *Verified:* 30 tests in
        `tests/hooks/subagent_ledger.test.ts`, and the split's own test was seen
        RED against a re-collapsed classifier before it was seen green.
      - **A fifth number the step never named, and it is the one that moved:**
        `stop_loss_arms_exceeded` fired on **138 of 3,400 stops (4.1 %)** — 119
        at 5 m, 17 at 5 m + 15 m, 2 at all three arms. Phase 3 Step 3's shadow
        is not guarding a hypothetical.

      **CLOSED 2026-08-22 — the fourth column now has a reading.** Full
      numbers, the window's anchor and the stated limits:
      [`subagent-envelope-return-baseline.md`](../evidence/investigations/subagent-envelope-return-baseline.md).
      Window 2026-08-21T01:23:41Z → 2026-08-22T03:01:39Z (~25.6 h), 10 sessions,
      **74 starts / 1,296 stops** — the ≥20 bar cleared on starts and exceeded by
      three orders of magnitude on stops.
      - **envelope return rate — 0.00 %.** Zero `ok` in 1,296.
      - parse-failure rate — **0.39 %** (5 of 1,296), every one carrying
        `envelope_error_count: 5`. The 2026-08-20 window read 0.50 % with all 17
        carrying the same 5, so two independent windows agree: one recurring
        answer shape, not independent malformations.
      - duration — p50 **655 s**, p90 **1,212 s**, max **2,179 s** (36.3 min),
        over the **64** stops (4.9 %) that carry one. Stated with its denominator;
        1,232 stops have no matched start.
      - nested-spawn count — **0** of 74 starts.

      **Why the 0 % is a measurement and not the artefact `(a)` feared.** The
      four-way split is what makes it readable: `no_message` is **0**, so
      something came back every single time; `no_envelope` is **1,291 (99.61 %)**,
      so what came back was prose; `ok` is **0**. The channel therefore works and
      is *universally unused* — the envelope contract honoured 0 of 1,296 times
      while the prose channel is honoured 1,296 of 1,296. That is the number
      replacing the 0.27 % model-carried capture, and it points the same way but
      harder.

      **One correction the run made on itself, recorded because it would have
      shipped a wrong denominator.** The first pass anchored the window on the
      earliest record carrying any post-split value and got 08-13 → 1,317 stops
      across 23 sessions. `fail` **predates the split** — it existed in the
      retired classifier — so those rows are old-classifier output and folding
      them in inflates both the denominator and the parse-failure count. The
      correct anchor is the first `no_envelope`, a value only the new classifier
      can emit.

      **A fifth number, reproduced rather than newly claimed:**
      `stop_loss_arms_exceeded` fired on **46 of 1,296 (3.55 %)**, against 4.1 %
      (138 of 3,400) on 2026-08-20. Phase 3 Step 3's shadow is guarding something
      real at a rate that has now held across two windows.

      **What this unblocks, and what it does not.** Phase 2 Step 2 was gated on
      "the Phase-1 baseline this step does not [provide]" — that gate is now
      lifted, and the three-way verdict split it needs already shipped with the
      2026-08-20 change. Step 2 remains open as a **build**, not as a
      measurement. Phase 4 Step 1's three conditions are untouched by this.

**Falsifier.** Envelope return rate ≥95% and no dispatch exceeds 2× its
tier budget-equivalent duration over the window → symptoms (2)/(3) are not
reproducible under measurement; Phases 2–3 are demoted to `later/` and the
null is published.

**Rollback.** Remove the two vocabulary entries and the concern; the audit
lines already written stay as data.

## Phase 2: Return-channel integrity — validate, fall back to disk, retry once

Gated on Phase 1 baseline showing parse-failure or absence at a rate worth a
mechanism (pre-register the threshold before reading the number).

- [x] **Step 1:** Worker-prompt contract addendum (dispatch-prompt-carried, per
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

      **Landed 2026-08-18.** Rule **(f)** in `subagent-spawn-contract.md`
      § Worker-prompt rules (both clauses plus the no-carve-out-for-verifiers
      paragraph, since the worker reads its duties from the dispatch prompt) and
      a new § *Durable copy — the envelope on disk before the message* in
      `subagent-response-contract.md`.

      **This step is NOT gated on the Phase-1 baseline, and the phase header's
      gate is about Step 2, not this one.** The header reads "gated on Phase 1
      baseline showing parse-failure or absence at a rate worth a mechanism" —
      a rate justifies a *mechanism*, and Step 1 ships no mechanism. Its premise
      is Phase 0 Step 3's controlled same-host reproduction (`(no output)` after
      3 tool uses and 18,242 tokens, matched control returning the full report),
      which the evidence file itself names as "the measurement Phase 2 Step 1's
      never-end-on-a-tool-call clause was missing". A baseline rate could not
      strengthen a clause whose failure is already observed at n=1 with a
      control — and per Phase 1 Step 4 (a) that column does not yet measure
      envelope return at all, so waiting for it would have gated a text change
      on a number known to be wrong.

      **Two things the step's text does not name, both decided here.**
      (i) The durable copy needs a **findable** path or it is nominal, so the
      filename `response-envelope.json` is fixed in the response contract —
      declared as a convention, with the fact that nothing writes, reads, or
      validates it stated in the same paragraph. (ii) Both contract sections
      carry an explicit honest-scope note: rule (f) is prompt-carried and
      therefore unenforced, and the `subagent_stop` concern that would read the
      disk copy is named as planned-and-not-shipped. Without that note the
      addendum reads as a recovery mechanism that runs, which is the
      buildable-on-paper failure Phase 0 exists to stop.
      <!-- verify: ./scripts-run src/scripts/check_references -->

      **Does not close Phase 2.** Steps 2 and 3 stay open and stay gated: the
      concern needs the three-way `no_message` / `no_envelope` / `ok` verdict
      split, and that split needs the Phase-1 baseline this step does not.
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
      **Re-scoped 2026-08-13 by Phase 0's falsifier, on two measured points**
      (`subagent-lifecycle-phase0-return-channel.md`):
      (i) **"on failure" is not expressible against today's verdict.**
      `classifyEnvelope` collapses "no message" and "prose, no JSON" into one
      `absent`, so a fallback keyed on it would fire on nearly every dispatch —
      25 of 25 in the measured window, the #58109 control arm included. Split
      the verdict three ways (`no_message` / `no_envelope` / `ok`) **in this
      step**, and key the disk fallback on `no_message` only; the split changes
      the ledger's recorded shape and the 16 assertions in
      `tests/hooks/subagent_ledger.test.ts`, so it belongs here rather than
      retrofitted into Phase 1.
      (ii) **there is no `agent_type` to log beside the valve.** `SubagentStop`
      carries `agent_id` but not `agent_type` (F4), so a per-`agent_id` valve can
      key correctly and cannot name what it blocked unless the start record is
      joined to it — which the 18-of-25 uncorrelated stops show is not always
      available. **At n=3,400 the join is available 8.0 % of the time** (271
      correlated of 3,400), so the valve should be designed to name nothing
      rather than to name it usually.

      **Part (i) LANDED 2026-08-20; the mechanism did not, and stays gated.**
      The verdict is now four-way — `no_message` / `no_envelope` / `fail` / `ok`
      — so the fallback condition this step keys on is expressible for the first
      time: **`no_message` only**, which is what the split exists to isolate.
      Landing the split ahead of the phase gate follows Step 1's own argument:
      the gate is on shipping a *mechanism*, and a verdict vocabulary is the
      instrument the gate reads. It also breaks a circularity the two steps had
      between them — Phase 1 Step 4's return-rate column needs the split, and
      this step needed Step 4's number.
      **What is still open here is the concern**, and it is still gated: the
      `subagent-return-gate` needs a pre-registered threshold read off a
      post-split window that does not exist yet. Note also that the disk
      fallback it would consult is declared-but-unwritten — nothing writes
      `response-envelope.json` (Phase 2 Step 1 (ii) says so in the contract
      itself), so on today's tree the `no_message` branch would find no file and
      fall through to the block path on its first firing.
- [ ] **Step 3:** Snapshot tests under `tests/hooks/` for all four paths
      (ok / disk-fallback / block-once / release), per the manifest's own
      concern checklist (`hook_manifest.yaml:10-14`).

**Falsifier.** Post-flip envelope return rate does not improve against the
Phase-1 baseline over an equal window → the mechanism is dead weight; revert
Step 2, keep Step 1's contract text only if its half of the metric moved.

**Rollback.** Concern unbinds from the manifest in one line; contract addendum
reverts by file.

## Phase 3: Runaway containment — spawn guard, ledger-aware stop gate, shadow stop-loss

> **Unblocked 2026-08-13 by writing the missing artefact, then built shadow-only.**
>
> The blocker was real: Step 1 deferred its warn→deny posture to "the concern
> activation policy (program X3)", and `grep -rl` returned four hits, all
> roadmap prose or a review input — three roadmaps citing a document none of
> them wrote.
>
> Put to the **AI council**, which converged on option (b) with one correction
> worth more than the option itself: *"Don't frame it as defer-or-shadow — it's
> shadow NOW to enable policy LATER. Shadow Step 1 IS the measurement
> instrument."* A guard cannot derive its threshold from telemetry that only a
> guard would produce, so the shadow is the thing that unblocks the policy, not
> the thing the policy unblocks.
>
> Two further council points were adopted: the flip trigger is **economic**
> (cost avoided > friction imposed), not count-based — "three incidents" is a
> number with no unit; and a blocking concern ships with a **reverse trigger**
> from day one, because a gate that never fires is unmeasured cost rather than
> proof of safety.
>
> Honest provenance: the pass was **1 of 2 members present**. The tool calls
> that `concluded` under its own 1-of-2 rule and simultaneously prints
> "DEGRADED — this is not convergence". It is a single independent opinion,
> named as such, not a quorum. Its response also cited a "Reviewer A" from an
> internal round and closed with a GitHub compare URL to a branch that does not
> exist; both were discarded as noise rather than treated as findings.
>
> The policy now exists: [`docs/contracts/concern-activation-policy.md`](../../docs/contracts/concern-activation-policy.md).

- [x] **Step 1:** `spawn-guard` PreToolUse concern on `Agent`/`Task`
      *(proposal)*: refuse a spawn when the ledger shows depth ≥ N or
      concurrent-open ≥ M (start values N=2, M=4 — pre-registered, refined
      from Phase-1 telemetry, never final). Ships **warn-first** (exit 2 with
      reason, no deny) for one measurement window, then flips to deny on
      evidence — **per the concern activation policy** (program X3), which this
      step cites instead of re-arguing the turn-end-gate soak history it is
      derived from (`hook_manifest.yaml:477-481` at adoption). Depth caps live
      orchestrator-side
      because children cannot be trusted to carry them (#68619).
      → Shipped as `spawn-guard-shadow` (`src/scripts/hooks/spawn_guard_shadow_hook.ts`),
      **shadow, not warn-first** — the one place this departs from the step's
      own text, and the policy written to unblock it is what rules the warn
      rung out: a verified-firing per-turn injection left its compliance rate
      unmoved (`session-canary`, 24 of 29) while both blocking carriers in
      conformance round 5 reached zero. A warn pays this concern's full
      per-call cost and buys nothing measurable.
      **N=2/M=4 ships as one candidate of three** (`n2m4`, `n3m6`, `n4m8`),
      evaluated simultaneously, because one candidate yields a verdict and a
      spread yields the curve the policy's 99th-percentile derivation needs.
      Depth pre-spawn is an upper bound (`deepest-open-record-plus-one`) and
      says so in the record — there is no `agent_id` yet to resolve a real
      parent from. *Verified:* 8 tests, the load-bearing one being that no
      input reaches a deny.
- [x] **Step 2:** `turn-end-gate` consults the ledger: an open dispatch is an
      explicit **allow** path for the completion-adjacent detectors, closing
      the #55754 loop shape. One test: pending-dispatch turn-end is never
      refused.
      → Layer 1b in `turn_end_gate_hook.ts`, an allow path that cannot become
      a deny path. An absent, empty or unreadable ledger yields zero open
      records and changes nothing, so the gate degrades to its prior behaviour
      rather than failing open. *Verified:* the required test plus its
      falsifier — the same promissory reply is refused again once the dispatch
      closes, so the allow path is not a kill switch. 83 tests pass.
- [x] **Step 3:** Wall-clock and tool-call-count stop-loss per open dispatch —
      **shadow first**: log the step at which each arm WOULD have fired,
      exactly the `capsule_trigger.ts` discipline ("NOTHING ACTS ON THESE"),
      because hooks cannot read token counts and a proxy must earn its
      trigger. Acting on the winning arm is a separate, evidence-gated change.
      → `stop_loss_arms_exceeded` on both the stop line (real duration) and the
      reap line (age). Recording it retrospectively needs no timer, and the
      reap is the only place a never-returning dispatch — the case the
      stop-loss actually targets — is observable at all.
      **The tool-call-count arm is NOT implemented, and not faked:** no payload
      this tree has observed carries a per-dispatch tool-call count, and
      inventing a proxy is what the cited `capsule_trigger.ts` discipline
      refuses. Wall-clock only, stated rather than implied.

**Falsifier (Step 1), restated for the shadow posture.** The original wording
named a "warn window", and there is no warn window — the step shipped shadow,
so a falsifier phrased against a window that does not exist could never fail.
Replacement, against what the shadow actually records: the **shadow** window
shows zero `would_deny` across ≥ 20 dispatches at the WIDEST candidate
(`n4m8`) → the concurrency cap is solving a problem this estate does not have;
record the null and remove the guard rather than tightening the candidate until
something fires.

Note which arm this falsifier is about. It is the concurrency arm, because
after R2 round 2 finding 3 that is the only arm producing a verdict at all.
The depth arm cannot be falsified here — it is not evaluated, and it becomes
falsifiable only once Phase 0 Step 4 settles whether `agent_id` reaches a
PreToolUse payload.

**EVALUATED 2026-08-20, and it does NOT fire** (`subagent-lifecycle-drain-close.md`
§ B6). Over 325 shadow records against a bar of 20, `would_deny` counts are
`n2m4` 210 · `n3m6` 151 · **`n4m8` 96**. Ninety-six at the widest candidate is
not zero, so the guard is not removed and the concurrency cap is describing a
condition this estate actually reaches — monotonically across the spread, which
is the curve the policy's derivation wanted. Two honest bounds: the shadow
concern writes **no `session_id`**, so unlike the Phase-1 columns this count
aggregates every session that touched the checkout; and
`depth_usable_for_derivation` is `false` on all 325, so the depth arm remains
unevaluated exactly as the paragraph above says. Whether to flip to deny is the
policy's economic question and is untouched by this — the falsifier only ever
asked whether the answer was a null.

**Rollback.** Each concern is one manifest line; ledger stays (it is Phase-1
infrastructure).

## Phase 4: Role axis binds on payload, not env

- [-] **Step 1:** *(blocked by the transfer, not moved into it — outcome state `transferred` via [`stubs/road-to-subagent-payload-capture.md`](stubs/road-to-subagent-payload-capture.md), council disposition **B**; the step's text stays here unchanged)* Extend `_lib/session_role.ts` resolution: payload `agent_id`
      present ⇒ role `worker`, without touching the env path (CLI spawn
      wrappers keep working). Gated on the Phase-0 Step-4 spike.
      **Why it closes as transferred rather than as open.** Its gate is Phase 0
      Step 4, whose raw-capture half is now in the stub, and the parent's own
      blocker was the only thing re-raising it — so leaving it `[ ]` would park
      it behind a resolved blocker with nothing pointing at the successor. The
      resolver is unchanged and env-only
      (`_lib/session_role.ts:28`, `:37-42`); the one production writer is the
      council CLI spawn (`ai_council/clients.ts:1386`). Nothing was implemented
      and nothing was decided against.
- [x] **Step 2:** Supersede the stale blocker comment
      (`hook_manifest.yaml:568-571` — the comment moved again when Phase 1
      Step 1 inserted the `subagent-ledger` concern above it; the draft's
      `:536-540` and the adoption note's `:547-550` are both stale)
      with the payload mechanism and the spike
      ref — corrected in place, the same way round 7 corrected the
      verify-before-complete path comment (`hook_manifest.yaml:63-66`).

      **Landed 2026-08-14.** Written at `hook_manifest.yaml:593-612`, appended
      after the blocker note now sitting at `:589-592`. **The cited `:568-571`
      was stale for the third time** — that range currently holds the
      `spawn-guard-shadow` warn-rung comment. Three successive line citations in
      this step have now rotted (`:536-540`, `:547-550`, `:568-571`); the
      finding is the pattern, not the third instance, and it is why the new
      comment is anchored to the concern id rather than to a line number.
      Comment-only, no behavioural key touched (`block-config-weakening` watches
      this file). Content is deliberately **branch-neutral**, because Phase 4's
      falsifier is still unresolved: it records that the env limitation stands,
      that `subagent_start`/`subagent_stop` are bound and carry payload
      `agent_id`, that the payload axis is unimplemented because the Phase-0
      Step-4 spike is blocked rather than because it was decided against, and
      that field presence is not assumed — the neighbouring `agent_type` probe
      already came back negative at 18 of 25 null.
      <!-- verify: ./scripts-run src/scripts/lint_hook_manifest -->
- [x] **Step 3:** Keep the invariant: `pre_tool_use` concerns are never
      droppable by role (the resolver already refuses this; add the payload
      path to the existing test).
      → Landed as `refuses a pre_tool_use drop regardless of which channel
      resolved the role` (`tests/scripts/hook_role_axis.test.ts`).
      **The existing test it sits beside had no sensitivity to the guard it is
      named after**, which is the finding: `pre_tool_use guards are undroppable
      on EVERY role and platform` walks the LIVE manifest, whose worker `drop`
      list names no `pre_tool_use`-bound concern — so deleting the
      `event === 'pre_tool_use'` clause from `_role_drop_set`
      (`dispatch_hook.ts:384`) would drop nothing on that slot and the test
      would still pass. The new fixture names a bound concern in the drop list
      and proves the list live on a droppable slot in the same test, so a pass
      cannot come from an inert fixture.
      **"The payload path" is pinned as provenance-independence, because there
      is no payload path to feed.** The refusal is an early return keyed on the
      SLOT and never reads the role, so an `agent_id`-derived `worker` is
      refused by the same line that refuses an env-derived one; the test asserts
      it for every role label including invented ones. Stated rather than
      implied: this pins the property Step 1 will need, not Step 1's input.
      **Sensitivity is DIFFERENTIAL, not mutation-proved.** The mutation that
      would prove it is the removal of a safety clause from the dispatcher, and
      the tool policy refused to stage that edit — correctly, since it is
      config-weakening in shape. What stands instead is one fixture, one role,
      two asserted outcomes separated only by the event argument: removing the
      clause makes the second assertion return the first's value. Recorded as
      the weaker guarantee it is.
      <!-- verify: npx vitest run tests/scripts/hook_role_axis.test.ts -->
**Falsifier.** Phase-0 Step 4 shows no `agent_id` on tool events for in-process
subagents on the installed host → the blocker stands as written; this phase is
cancelled and the comment gains the version-gated evidence instead.
**Cannot run, and that is now a recorded state rather than a pending one.**
Step 4's raw-capture half is transferred, so the observation this falsifier
consumes has a named producer and no date. The 632 negative-space observations
in § B4 are explicitly NOT it — they sample the parent's `Agent`/`Task` call,
never a subagent's own tool events. The phase is therefore neither cancelled nor
implemented: Step 2 landed, Step 3 landed, Step 1 is transferred.

**Rollback.** Resolver change is one function; revert restores env-only.

## Phase 5: Tier routing has a caller — measure whether it moved the distribution

Re-scoped at adoption (V7 `already-fixed`). The draft's Step 1 offered a
wire-it-or-delete-it fork; the fork is decided — `delegation_nudge_hook.ts:342`
wires it, so neither branch is work. What the draft's evidence never covered is
whether a *wired* caller changes the outcome, and that is the open question.

- [x] **Step 1:** Confirm the wired call site actually governs the dispatches the
      ledger counts — `delegation-nudge` runs on `user_prompt_submit` and is
      advisory (it injects a verdict line, it does not select the tier for the
      spawn). If the tier the spawn uses is still model-carried downstream of the
      nudge, the caller is reachable but **not** load-bearing, and that is the
      finding to publish, not a second wiring change.
      → **Reachable, not load-bearing** — the pre-registered outcome, traced
      end to end. `recommendSliceTier` calls the resolver at
      `delegation_nudge_hook.ts:342` (the same call site the paragraph above
      cites) with a hardcoded `task_tier: "lite"` / `session_tier: "high"`
      (no per-slice classification exists at prompt-submit time); the returned
      tier is interpolated into prose at `:382` and injected as
      `additionalContext`. Nothing reads it back. `resolveSubagentRouting` has
      exactly one production caller and its output terminates in a sentence.
      So the follow-up is **not** a second wiring change — it is Step 2, which
      needs the ≥20-dispatch window the Phase-1 ledger has only just begun to
      collect. Full trace: `agents/evidence/investigations/subagent-lifecycle-phase0-host-pin.md`
      § Phase 5 Step 1.
- [x] **Step 2:** Re-measure the tier distribution over the next ≥20 dispatches
      via the Phase-1 ledger; publish the before/after pair.
      → **Published as a null, and the null is a derivation rather than a
      measured distribution — stated plainly because the difference is the whole
      finding** (`subagent-lifecycle-drain-close.md` § B5). Two facts settle it
      and neither needs a window.
      **The named instrument does not carry the quantity.** `grep -in tier
      src/scripts/hooks/subagent_ledger_hook.ts` returns nothing across all 736
      lines; no record shape — start, stop, reap, unidentified, shadow — has a
      tier, a model name, or a routing field. The ledger cannot measure a tier
      distribution, before or after, so the before/after *pair* this step asks
      for is not a window away, it is unbuildable by the method named.
      **The wired caller cannot have moved one.** Step 1 traced it: the
      resolver's output is interpolated into prose at
      `delegation_nudge_hook.ts:382` and injected as `additionalContext`, and
      nothing reads it back. A value no consumer reads cannot change a
      distribution.
      So the falsifier's own branch is taken. **What a `[x]` here does and does
      not claim:** it claims the step's question is answered and published; it
      does **not** claim a distribution was observed. Making the measurement
      real would need a tier field on the ledger plus a consumer that reads the
      resolver — both new work, neither this step.

**Falsifier.** Distribution unchanged with the caller wired → tier drift is
not routing-caused; publish and stop here.
**Branch taken 2026-08-20** — on the derivation above. Phase 5 closes.

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

## Phase 7: The `do_not_touch` write-guard — relocated, and deliberately its own phase

> **Its own phase on purpose.** The first placement put this step inside Phase 4,
> whose falsifier cancels that phase outright when `agent_id` is absent from tool
> events — so a mechanical phase-level cancellation, or a reader applying the
> falsifier as written, would have swept away the very item the relocation
> existed to preserve. That is this file's own Risk 6 reproduced one level down,
> inside the mitigation, and a prose exemption is not a structure. The R2 review
> of the relocating change caught it; the fix is the anchor, not another sentence.

**Relocated intact from `road-to-inbox-harvest-2026-08-b-dispatch-safety` § 3.4**
(2026-08-19, blind 2/2 council). Full disposition incl. the rejected variants:
`agents/settings/contexts/do-not-touch-guard-disposition.md`. It is here rather
than in `road-to-per-turn-hook-economy` because the unblocker is lifecycle-owned
— the field contract and its producers — while hook cost is an acceptance
condition on shipping, not the thing that is missing.

- [ ] **Step 1:** `do_not_touch` write-guard — a `pre_tool_use` concern
      (advisory, `fail_closed: false`, modelled on `block-kernel-rule-writes`
      and `reread-guard`) that warns when a write targets a path the current
      recycle envelope listed under `do_not_touch`.
      **Blocked on three conditions**, the first two measurable rather than
      permanent and the third an open design question this step must answer
      rather than inherit:
      (a) at least one real envelope carries a non-empty, path-shaped
      `do_not_touch` — the shape is enforced as of the relocation, so the count
      is a fact about producers instead of an artefact of an unchecked field;
      (b) a per-turn cost decision, since the `pre_tool_use` chain already runs
      eleven concerns (`hook_manifest.yaml:889`; twelve on the two rows carrying
      `spawn-guard-shadow`) and this would be the twelfth — prefer reusing the
      envelope read the handoff consumer already performs over a fresh
      unconditional file read;
      (c) **the matching semantics, which nothing has decided yet.** `isPathRef`
      is a SHAPE predicate — it answers "is this one token", never "does this
      entry cover that write target". It admits a bare directory (`docs`), a
      trailing-slash relative ref (`../other-worktree/`), a glob (`src/**/*.ts`)
      and a `file:line` ref, and normalisation, directory-prefix matching and
      glob matching are specified nowhere. Reuse the predicate for what
      **validates**, and decide separately what **matches**; an entry that
      validates and then silently matches nothing is the same class of defect as
      the unchecked field this step's own source closed. Recorded because the R2
      review found the earlier wording ("match on `isPathRef`-shaped entries via
      the exported predicate") presented that decision as already settled.
      **Do not ship it on zero producers.** That is the
      build-the-mechanism-before-measuring-the-premise pattern this package has
      recorded three times, and it was the source step's own reason for staying
      open.

      **MEASURED 2026-08-20 — (a) is met, (b)'s preferred route does not exist,
      and a fourth condition surfaced** (`subagent-lifecycle-drain-close.md`
      § B7).
      **(a) MET.** Across the maintainer's checkout and its `.claude/worktrees/*`
      worktrees: **13 envelopes exist, 6 carry a non-empty `do_not_touch`, and 3
      of those are entirely path-shaped** (every entry passes `isPathRef`). Two
      of the three were written after the shape enforcement landed, so the count
      is a fact about producers rather than an artefact of an unchecked field.
      Caveat carried, not buried: the envelopes are gitignored runtime state, so
      this measurement is machine-local and not reproducible from a clean clone.
      **(c) has a concrete case now, not a hypothetical.** One real entry is
      `agents/roadmaps/later/` — a bare directory with a trailing slash. It
      validates, and under exact-string matching it matches nothing. The tree
      offers target extraction plus Bash-command coverage
      (`block_kernel_rule_writes.ts`, segment-based) and `workspace_root`-anchored
      absolute-to-relative reconciliation with a regex exemption list
      (`reread_guard_hook.ts:220-232`), and **nothing at all** for
      directory-prefix or glob matching. The decision is still open; it now has a
      worked example to be decided against.
      **(b) — the preferred mitigation is unavailable as written.** "Reuse the
      envelope read the handoff consumer already performs" cannot be done:
      `handoff-context` is bound on **`session_start` only**
      (`hook_manifest.yaml:892`, `:899`) and `consume_recycle_envelope` is
      consume-on-read, **moved not copied** — every non-`absent` outcome renames
      the envelope to `recycle-envelope.consumed.json`
      (`handoff_context_hook.ts:156-170`). By the time any `pre_tool_use` fires
      the file is gone, and the survivor is explicitly the *last* envelope kept
      for debugging, possibly an earlier session's.
      **(d) NEW, and a real blocker rather than a detail:** the list has to be
      published somewhere a per-tool-call reader can see it — session state
      written by the consumer, or a deliberate decision to read the consumed file
      and accept its provenance. Until that is decided, "reuse the existing read"
      names a read that has already destroyed its own source.
      **Chain-cost citation corrected.** The counts are right and the line
      reference is stale by six: augment binds **11** at `hook_manifest.yaml:895`,
      claude and cowork **12** at `:903` and `:957`. `:889` is the worker role's
      `drop:` list.
      **Still open, and now for a named reason.** (a) is discharged; (c) and (d)
      are undecided design questions this step owns. Shipping on an undecided
      matcher is the same defect class as the unchecked field its own source
      closed.
      <!-- verify: grep -rn 'do_not_touch' src/scripts/hooks/concern_registry.ts -->

**Falsifier.** Condition (a) is still unmet after a full measurement window in
which envelopes were written and none carried a `do_not_touch` entry → the field
is unused rather than unenforced, and the guard is cancelled with that count
published, rather than waiting indefinitely on a producer nobody wants.
**REFUTED 2026-08-20.** Envelopes were written and six of thirteen DO carry a
`do_not_touch` entry, three of them entirely path-shaped. The field is used, so
the guard is not cancelled — and the risk this falsifier existed to bound
(Risk 6, an indefinite deferral) is now bounded by (c) and (d) instead: two
named design decisions, not a wait on a producer.

**Rollback.** One manifest line and one concern file; the field contract and its
shape check stand on their own and are unaffected.

## Blockers

### blocker: raw-capture-needs-host-env

- **Status:** resolved
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phase 0 Steps 2 and 4 — and only their raw-payload half — plus
  Phase 4 Step 1, which is gated on Step 4. Step 3 is closed; **both** of Step
  2's assertions and Step 4's derivable half are answered without it (§ B2-B4).
- **What to do:** the capture facility is shipped and verified
  (`_maybe_capture_payload`, `dispatch_hook.ts:486`, called unconditionally at
  `:1082`); the variable just has to reach the process environment the host
  spawns hooks from, which a command issued inside a session cannot do.
  1. Add to `~/.claude/settings.json`:
     `"env": { "AGENT_HOOK_CAPTURE_DIR": "~/.agent-hook-capture" }`
  2. Start a **fresh** session — env and hooks are read at session start.
  3. Dispatch one subagent, then read
     `~/.agent-hook-capture/claude__SubagentStop__*.json` and the
     `claude__PreToolUse__*.json` files written from inside it.
  4. Remove the `env` entry afterwards — the capture writes every payload
     verbatim, which is a standing egress surface, not a setting to leave on.
- **Why an agent must not do it:** the file is the agent's own tool
  configuration, the change is user-global and reaches every other session live
  on this repository, and `security-sensitive-stop` § self-modification routes a
  self-config edit through the edit-permission gates rather than letting a
  session apply it to itself.
- **Recommendation:** run the four steps. The capture facility is shipped and
  verified, so this is a one-session errand, not a build — and step 4 bounds the
  only real cost, since the standing egress surface exists solely while the
  `env` entry is present. The alternative on the table is reading the field
  lists out of the hook source instead of a captured payload, which is
  precisely the build-against-documentation failure Phase 0 exists to stop.
- **If you do nothing:** Phases 2 and 4 keep resting on payload fields
  documented for a host version that is not the installed one — Risk 4 states
  that dependency, and Phase 4 is cancelled outright if `agent_id` turns out to
  be absent. So the cost of not deciding is not a delay; it is that the later
  phases stay buildable-on-paper against a shape nobody has seen, and the
  falsifier that would re-scope them cannot run.
- **Resolved when:** a raw `SubagentStop` payload and a raw in-subagent
  `PreToolUse` payload exist as captured files, and their field lists are
  recorded in
  `agents/evidence/investigations/subagent-lifecycle-phase0-return-channel.md`.
- **Resolution (2026-08-20) — transferred, and narrower than it was.**
  **`Status:` reads `resolved` deliberately, and the outcome state is
  `transferred`.** They are different fields: `lint_roadmap_blockers` recognises
  exactly one closed token (`/Status:[ \t]*resolved/`, `:193`) and treats every
  other word — `transferred` included — as still open, which also keeps the entry
  counted in `check_estate_count`'s `open_blockers`. Writing the outcome state
  into the status field would have left a blocker that reads closed to a human
  and open to every gate. The outcome state lives here, in the stub, and in the
  stubs README table, exactly as the two sibling drain-run transfers of
  2026-08-20 record theirs. Council
  disposition **B**, outcome state `transferred`, per
  [`drain-blocker-dispositions-a.md`](../evidence/council/drain-blocker-dispositions-a.md)
  § `raw-capture-needs-host-env`. The criterion above moves **verbatim** to
  [`stubs/road-to-subagent-payload-capture.md`](stubs/road-to-subagent-payload-capture.md),
  which carries the named producer (the host owner), four read-only probes with
  their baselines measured on the transfer date, and the seven containment
  requirements adopted from the dissenting seat — a dedicated empty
  owner-only-permission directory, one time-boxed session, field-NAME extraction
  then deletion, removal of the setting, verification that it is gone, **a
  fresh-session negative probe proving capture stopped**, and an abort on secrets
  or an unexpected content class. "Remove it afterwards" was the whole bound
  before and is not a kill switch: it survives neither an interruption nor a
  cleanup failure, and the capture is fail-silent by design.
- **What the transfer no longer blocks, because it was answered instead.** Both
  of Step 2's assertions (§ B2, § B3 of
  [`subagent-lifecycle-drain-close.md`](../evidence/investigations/subagent-lifecycle-drain-close.md))
  and Step 4's derivable negative space (§ B4). The residue is the verbatim field
  list, the key spelling `last_assistant_message` vs `lastAssistantMessage`, and
  the in-subagent tool-event payload — nothing else.
- **What it still blocks, named so nothing is buried:** Phase 4 Step 1, closed
  `[-]` against the stub rather than left open behind a resolved blocker. Phase
  4's falsifier consequently cannot run, which is now a recorded state rather
  than a pending one.
- **The "If you do nothing" cost above is unchanged and still accurate** — with
  one correction: Phase 2 no longer rests on undocumented fields, since both of
  its payload fields now have observed answers. Only Phase 4 does.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-19 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Reopening cancelled work on a clause that cannot lift | product | V2 argues the 2026-08-07 stopping rule's reopen condition is deadlocked and therefore reopens two cancelled items on production evidence instead. That reasoning is correct and is also exactly the shape a scope-creep argument takes — "the lock cannot fire, so I am free". If the deadlock reading is wrong, this roadmap re-proposes work a council already refused | The reopen is confined to the two items whose clause is provably dead (envelope wiring, SubagentStop concern) and explicitly does NOT revive the orchestrator-first content verdict, which is restated as a non-goal; the deadlock claim carries its own file:line evidence on both halves so a reviewer can refute it in one read | Phase 1 |
| 2 | A blockable stop hook turns a fragile return into a hung subagent | implementation | `SubagentStop` is blockable — exit 2 prevents the subagent from stopping. A return gate that blocks on a validation failure can therefore convert symptom (3) "finished but did not return" into something worse: a worker that cannot finish at all, and an upstream loop shape (#55754) that consumed a full session quota | Step 2 blocks at most once per `agent_id` behind a state-keyed valve, then releases; the disk fallback is tried before any block, so the block path is reached only when both channels failed; four snapshot tests pin ok / disk-fallback / block-once / release | Phase 2 Step 2 |
| 3 | Spawn caps picked from no data | implementation | N=2 depth and M=4 concurrency are stated as start values with no measurement behind them. Caps set too low refuse legitimate fan-out — this estate's own analysis runs routinely dispatch more than four readers at once — and a refusal is invisible to the user as anything but a broken turn | The guard ships warn-first for a full window and only flips to deny on evidence; the numbers are refined from Phase-1 telemetry before the flip; the falsifier records a null and leaves the guard warn-only if zero would-have-fired events occur over ≥20 dispatches | Phase 3 Step 1 |
| 4 | The Phase-0 spikes cannot run, and the plan proceeds anyway | implementation | Every mechanism in Phases 2 and 4 rests on payload fields (`last_assistant_message`, `agent_id`, `agent_type`) documented for a host version that is not the installed one, plus an upstream truncation bug whose current reproduction status is unknown. Building against documentation is the failure the source-discovery gate exists to stop | Phase 0 is scratch-project only and its falsifier re-scopes Phases 2 and 4 to what the payload actually carries before any code is written; Phase 4 is cancelled outright if `agent_id` is absent, with the stale blocker comment gaining version-gated evidence instead | Phase 0 |
| 5 | The ledger becomes unbounded runtime state | implementation | An open-dispatch record per spawn, appended for every session, is append-only state with no stated retention — the exact growth-budget failure the persistence discipline names for audit tables. A ledger that grows without a prune path is a new maintenance surface, not an instrument | The ledger lives in gitignored runtime state and is scoped to open dispatches, closed on `subagent_stop`; retention is declared in the same change that introduces it, and the rollback removes the concern while leaving already-written audit lines as data | Phase 1 Step 2 |
| 6 | The relocated `do_not_touch` guard becomes an indefinite deferral | product | A step carried in from another roadmap arrives with a blocker rather than with effort behind it, and the roadmap that owned it has archived — so nothing re-raises it. That is the failure mode the relocation was chosen to avoid, reproduced one file later, and the council that decided the relocation named it as the residual risk it could not close | Both conditions are now MEASURABLE rather than permanent: the producer count is a `grep` over envelopes whose shape is enforced, and the cost decision is a stated question rather than a standing objection. The condition that made the source step undischargeable — an unchecked field guaranteeing a zero count — is fixed in the same change as the relocation, so a re-read can produce a different answer than last time. It is anchored in its OWN phase with its own falsifier, after the R2 review found the first placement parked it under a falsifier that cancels its host phase — this risk reproduced inside its own mitigation | Phase 7 |

## Non-goals

- No orchestrator-first / mandatory-delegation revival — the 2026-08-07
  stopping rule's *content* verdict stands; this roadmap reopens only the two
  items whose reopen clause is deadlocked (V2), on new production evidence.
- No LLM-as-judge anywhere in the enforcement path (deterministic gates only).
- No token-exact budget enforcement claims — hooks cannot see token counts;
  Phase 3 Step 3 is honest about proxies and shadows them first.
- No duplication of `road-to-frontend-skill-application` — amendments only.
