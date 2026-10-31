---
complexity: lightweight
status: ready
tree_pin: e076f566d4
execution:
  mode: phase-checkpoints
review_by: 2026-11-30
relates:
  - slug: later/road-to-cost-parity-2-state-aware-dispatch
    relation: feeds
    note: "Owns the split-verdict input and the claim-queue blocker. Receives the verdict-producer and ladder-replay arrival (4.1)."
  - slug: later/road-to-roadmaps-finished-before-new-ones-start-carried
    relation: extends
    note: "Owns the drain line. 2.1-2.3 fix its screen and lane re-dispatch; the per-lane checkpoint is handed to it as a step (4.2)."
  - slug: later/road-to-touched-files-that-pass-their-own-tools-carried
    relation: extends
    note: "Owns the touched-file runner. 3.3 makes detector C name the commands; the append-only readings journal is handed to it (4.2)."
---
# Road to a split the task earns

> **Source:** `agents/tmp.old/inbox-2026-10-cb/` (topics t1-t4: two short
> clips arguing "one agent with playbooks" vs. "one agent per role", an owner
> chat on an agent work line, an owner chat on what an outer harness is).
> **Arrivals:** 1 — `inbox-2026-10-cb` (2026-10-31).

## Goal

The package already has the "one agent, many playbooks" shape for its own
assets (3 subagent definitions, passive persona lenses, ~300 skills). What
the round found at `e076f566d4` is that the surrounding doctrine and sensors
say less than the code does: the dispatch table never forbids a forked
evaluator, the size-floor sentence claims more than the extractor enforces,
the drain line screens owner-held steps as runnable and ignores the emergency
halt, and two sensors tell the agent *that* it failed without telling it
*what to run*. This file closes those, and hands everything that needs a
window, a spend or an owner to the file that owns it.

**Constraint (owner, t3):** "ein gesunder und effektiver Mix" — completion,
not agent count, is the test. Nothing here adds an agent, a persona, a
router or a setting.

## Phase 1 — Dispatch doctrine says what the code does

- [x] **1.1 A judge is never a fork.** First row in the `dispatch_primitive`
      table of `auto-dispatch-classification.md`: a judge, review, validator
      or council slice is `subagent`, never `fork`, because a fork inherits
      the author's conversation. Mirror one sentence in
      `subagent-orchestration` (SKILL + prompts README), in
      `evaluator-independence` and in `/review:changes` § fresh reviewer.
      Second arrival of this subject (first: `inbox-2026-10-r`, where only
      the resume half landed).
      verify: `npx vitest run tests/scripts/judge_never_fork_doctrine.test.ts` -> 0
- [x] **1.2 The fork row is no longer "the only primitive".** The ambiguous
      row stops calling a named subagent the only primitive in use, matching
      the skill's fork guidance and the host row `fork_shares_cache`.
      verify: `grep -c "the only primitive this suite" src/agent-src/contexts/execution/auto-dispatch-classification.md` -> 0
- [x] **1.3 The size-floor sentence matches the extractor.** Any fired signal
      sets `size_estimate >= 2` against `SIZE_FLOOR = 1`, so "trivial
      one-line edits never delegate" holds only for prompts with no signal.
      Say so; behaviour unchanged (triggers move only by evidence). A
      characterization test pins the current verdict.
      verify: `npx vitest run tests/scripts/delegation_nudge_hook.test.ts -t trivial-signalled-prompt-still-dispatches` -> 0
- [x] **1.4 The orchestration bench arms say they do not contrast.** Both arm
      files set only keys the settings loader now ignores; a header comment
      says so and points at the stub that owns the re-cut. The arms are not
      re-cut here (the stub records halt-as-arm as rejected).
      verify: `grep -c "do not contrast" internal/bench/orchestration/agent-settings.baseline.yml internal/bench/orchestration/agent-settings.orchestrated.yml` -> 1 each

## Phase 2 — The drain line holds what is held

- [x] **2.1 Prose holds in note lines.** `PROSE_HOLD_RE` also reads
      `blocked by|on` and `owner-reserved`, and a negation guard keeps "no
      longer blocked" runnable.
      verify: `npx vitest run tests/scripts/roadmap_drain_queue.test.ts -t "holds written in prose"` -> 0
- [x] **2.2 The queue obeys the emergency halt.** With
      `emergency.orchestration_halt` set, `next` is null and the hold names
      the switch, checked before the caps.
      verify: `npx vitest run tests/scripts/roadmap_drain_queue.test.ts -t "emergency halt"` -> 0
- [x] **2.3 The `--all` route names its flip path and verifies a dead lane.**
      `process-full-all.md` names `roadmap:set-step --verify` as the
      orchestrator's flip path and runs `run:supervise --verify` before
      re-dispatching a dead lane.
      verify: `grep -c "roadmap:set-step\|run:supervise --verify" src/agent-src/contexts/execution/process-full-all.md` -> >= 2

## Phase 3 — Sensors say what to run

- [x] **3.1 The dispatcher header carries no stale count.** The "13 concerns
      … (6 pre + 7 post)" sentence (now 19/19, 13 untooled per slot) becomes
      count-free and points at the manifest.
      verify: `grep -c "6 pre + 7 post" src/scripts/hooks/dispatch_hook.ts` -> 0
- [x] **3.2 A ratchet finding can carry a fix.** `gate_baseline` accepts an
      optional `fix` and emits it ahead of the suppression text; default
      output stays byte-identical. The gate-authoring finding format names
      `fix:` before `suppress:` for new gates.
      verify: `npx vitest run tests/lib/gate_baseline.test.ts -t fix` -> 0
- [x] **3.3 Detector C names what to run.** A `verification` refusal appends
      up to three commands from `resolve_toolchain(root)`; silent when the
      project declares none.
      verify: `npx vitest run tests/scripts/turn_end_gate_hook.test.ts -t names-the-commands` -> 0

## Phase 4 — Hand-offs to the owners (arrivals, no re-planning)

- [x] **4.1 Arrival lines on the held objects.** Payload capture (2),
      team telemetry (2), token-economy dispatch follow-up (1), task
      completion observability (2, bench arms), cost-parity-2 (1, verdict
      producer + deterministic ladder replay instead of a 14-day window),
      benchmark-obsolescence lifecycle (rule provenance, 1).
      verify: `grep -l "inbox-2026-10-cb" agents/roadmaps/stubs/*.md agents/roadmaps/later/*.md | wc -l` -> >= 6
- [x] **4.2 Steps handed to two parked owners.** Per-lane checkpoint at end
      of life → the drain carrier; append-only touched-file readings and the
      stale template pointer (`:1520` → `:1268`) → the touched-files carrier.
      verify: `grep -c "inbox-2026-10-cb" agents/roadmaps/later/road-to-roadmaps-finished-before-new-ones-start-carried.md agents/roadmaps/later/road-to-touched-files-that-pass-their-own-tools-carried.md` -> >= 1 each

## Not planned here — owner, council, window or spend

| Item | Why not here | Holder |
|---|---|---|
| Record every split verdict; run the net-win claim live | journal-vs-audit store is a council call; live run is spend | cost-parity-2 / episode-finalizer-v2 6.1 |
| Cost line on rung 2 (revisit bytes D7) | council, and only after a verdict baseline (observer effect) | cost-parity-2 |
| Shadow-record what satisfied the review nudge | hook-bundle headroom; O3 decided after the window | `stubs/road-to-f4-full-stop-block` |
| `fresh` observed instead of declared | needs payload capture; reverses review-independence 2.1 | `stubs/road-to-subagent-payload-capture` |
| `max_parallel=3` vs "no hard limits" | owner | owner |
| Async Stop lane, host matchers, `tools:` on fail-closed guards | recorded council cancellation / rejection; security-sensitive | per-turn-hook-economy carry (archived), council |
| Model-tier guide weight | ADR-293 has no model axis; needs a refreshed bench (spend) | ADR-293 / installed-layer-thinned |
| Agent work line ("Manufaktur") — third arrival | the drain queue *is* the line; recording that answer durably is the owner's | owner |

## Kill register

- **K1** No downgrade of independent verification on "models check their own
  work". Judges, validators and `verify-before-complete` stay.
- **K2** No activation setting returns; triggers move per evidence-bearing PR.
- **K3** No brake: every change here is advice, a hold, or a message.
- **K4** No new agent, persona, router, registry or report verb.

## Acceptance criteria

- **AC-1** No doctrine surface lets a judge, reviewer or validator run as a fork.
- **AC-2** The drain queue never offers an owner-held or halted step as next.
- **AC-3** A turn-end verification refusal names at least one runnable command
  when the project declares one.
- **AC-4** Every deferred item sits on a named holder; none is dropped.
- **AC-5** No hook path blocks that did not block before.
