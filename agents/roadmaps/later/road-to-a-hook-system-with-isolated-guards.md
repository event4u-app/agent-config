---
complexity: structural
status: later
review_by: 2027-01-31
tree_pin: 2eef08c00b
entry_condition:
  what: "road-to-a-hook-system-that-pays-for-what-it-does is archived (its fixed-cost baseline exists), and the owner has answered E4 below"
  when: "after that roadmap closes"
  who: "owner (E4), then any maintainer session"
estate_offset_exempt: "Owner instruction 2026-11-20 asked for the whole hook system to be reworked (agents/evidence/owner-directives/2026-11-20-hook-bundle-budget-and-hook-economy.md, D3). Owner search: grep -rlF -e 'PostToolBatch' -e 'onFailure' -e 'HookContext' -e 'advisory registry' over agents/roadmaps/*.md, later/ and stubs/ at 2eef08c00b returned nothing; the parts closable in one run are the active road-to-a-hook-system-that-pays-for-what-it-does."
estate_growth_exempt: "+1 later_roadmaps: the owner asked for the whole hook system to be reworked (2026-11-20); this half needs an owner answer (E4) and a live host probe, so it is parked rather than dropped."
parent_roadmap: road-to-a-hook-system-that-pays-for-what-it-does
relates:
  - slug: road-to-a-hook-system-that-pays-for-what-it-does
    relation: depends
    note: "Its Phase 3 bench and load-set check are this roadmap's baseline and safety net."
---
# Road to a hook system with isolated guards

> **Source:** `agents/tmp.old/inbox-2026-11-hb/` — the structural half of the
> owner's ask to rework the whole hook system; owner directive
> [`2026-11-20-hook-bundle-budget-and-hook-economy`](../../evidence/owner-directives/2026-11-20-hook-bundle-budget-and-hook-economy.md).
> Parked because two of its phases need an owner answer (E4) and a live host
> observation, which one run cannot supply.

## Goal

A fault in advisory hook code cannot refuse a tool call, a tool call costs one
dispatch where the host allows it, and a new concern is written against a typed
contract instead of an emulated CLI.

## Context (verified at `2eef08c00b`)

- **Blast radius.** All concern modules load in one bundle. A top-level
  `throw` planted in the advisory `roadmap_progress_hook` module makes
  `pre_tool_use` exit 1 (reproduced 2026-11-20), and the generated host command
  turns any exit other than 0 or 2 into "tool call is refused". 66 of the 75
  concerns are advisory and declare `fail_closed: false`; the crash path ignores
  that declaration.
- **Two dispatches per tool call.** 20 concerns sit on `post_tool_use`, none
  blocking; no `matcher`, no `PostToolBatch`, no `onFailure` appears in the
  manifest, `host_lowering.yaml` or `host-capabilities.yml`.
- **Emulated CLI.** Each concern runs with swapped `argv`, a stdin shim and
  captured stdout (`dispatch_hook.ts:595-676`); the registry's header names that
  contract (`concern_registry.ts:17-24`).
- **Skill routing reads every skill.** `skill-route` globs and reads each
  `SKILL.md` on every prompt (`score_skill_relevance.ts`), unmeasured here.
- **Proxy checks.** The concern-count lint (`lint_hook_concern_budget.ts`,
  threshold 8, warn-only) is permanently exceeded (15 to 22 per Claude event);
  it is wired into settings templates and an estate budget, so retiring it is a
  consumer-facing change.

## Owner decisions

| ID | Question |
|---|---|
| E4 | Phase 1 changes what happens when advisory code is broken: tool calls proceed on the guards' verdict instead of being refused. The manifest already declares those concerns `fail_closed: false`. Is that the intended fail-closed scope? |

## Phase 0 — Carried from the parent

- [ ] **0.1 Compile-cache the bundle on the direct path.** Carried from
      `road-to-a-hook-system-that-pays-for-what-it-does` 2.2 (K1). The launcher
      path already caches; `node dist/hooks/dispatch.js` (the staged runtime's
      host command) does not. A stub entry or `NODE_COMPILE_CACHE` in the
      generated host commands, keeping the digest, runtime integrity,
      freshness, content, prepack and plumbing-write guarantees.
      verify: a second direct dispatch shows a populated cache; every one of those gates' tests passes unchanged in what it refuses.

## Phase 1 — Guards that advisory code cannot take down (needs E4)

- [ ] **1.1** Core and the nine blocking concerns load eagerly; the advisory
      registry loads afterwards inside a `try`, as its own build output; a
      failure there is logged and the guards' verdict stands.
      verify: the planted fault yields the guards' verdict and one logged issue on every bound event; a planted fault in a guard module still refuses.
- [ ] **1.2** On `pre_tool_use`, a guard deny returns without loading the
      advisory unit.
      verify: a denied call shows no advisory module in the load trace.
- [ ] **1.3** Lower `onFailure: "block"` on hosts at or above the documented
      version; keep the shell wrapper below it.
      verify: a live observation on a current host recorded as evidence; a lowering-table test for both version sides.

## Phase 2 — Fewer dispatches (needs a live host probe)

- [ ] **2.1** Probe `PostToolBatch` on a current host: parallel and single
      calls, subagents, failed tools, the `tool_response` shape per tool.
      verify: an evidence file with redacted payload shapes and the host version; no binding before it exists.
- [ ] **2.2** Classify the 20 post-tool concerns by the field each reads.
      verify: a table in the manifest's terms.
- [ ] **2.3** Move batch-only concerns to the batch event by group on hosts
      that have it; other hosts keep today's binding.
      verify: per group, a replayed session yields the same journal entries and injected context.
- [ ] **2.4** Derive a `matcher` union for what stays on `post_tool_use`;
      `pre_tool_use` gets one only if every concern on the slot is scoped, and
      fail-closed concerns never move behind `if`.
      verify: a replay count of dispatches before and after.

## Phase 3 — A typed concern contract

- [ ] **3.1** `HookContext` / `HookResult` for new concerns, no process-global
      mutation; existing concerns keep running through the current shim and
      migrate when touched.
      verify: two advisory concerns migrated with identical golden output; the shim's tests unchanged.
- [ ] **3.2** Generate the static registry, lazy registry and chunk definitions
      from the manifest, checked with `--check`.
      verify: a new advisory concern needs edits only to the manifest, its handler and its test.
- [ ] **3.3** Each concern declares tools and a cost class; a per-concern time
      report from the existing timing sink, observe-only for one release.
      verify: a test fixture with a planted 5 ms sleep in a light concern produces a flagged row, and the unmodified fixture produces none.
- [ ] **3.4** Retire the concern-count lint in favour of 3.3, including its
      settings key and estate-budget row.
      verify: no warn-only check on the hook system is red at the pin.
- [ ] **3.5** A skill index for `skill-route`, measured first.
      verify: the prompt event reads one index instead of every `SKILL.md`, with identical routing on the relevance fixtures.

## Risk Register

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Advisory faults silently ignored | product | 1.1 turns a refused call into a logged issue | Each swallowed failure is logged as a dispatch issue and surfaced by `hooks:doctor`; E4 is the owner's call | Phase 1 — Guards that advisory code cannot take down (needs E4) |
| 2 | Batch payload lacks a field | implementation | 2.3 could move a concern whose input the batch event drops | 2.1's probe and 2.2's field table come first; a group with a missing field stays | Phase 2 — Fewer dispatches (needs a live host probe) |
| 3 | Generator drift | implementation | 3.2 could produce registries that differ from the manifest | `--check` in CI and the existing registry parity test | Phase 3 — A typed concern contract |
