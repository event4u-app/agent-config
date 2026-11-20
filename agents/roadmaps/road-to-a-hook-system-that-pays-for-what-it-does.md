---
complexity: structural
status: ready
review_by: 2026-12-20
tree_pin: 2eef08c00b
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Owner instruction 2026-11-20 (agents/evidence/owner-directives/2026-11-20-hook-bundle-budget-and-hook-economy.md) asked for an active roadmap processed in the same run. Owner search: grep -rlF -e 'hook-bundle-budget' -e 'compile_cache' -e 'PostToolBatch' -e 'concern_timings' -e '_run_concern_inproc' over agents/roadmaps/*.md, later/ and stubs/ at 2eef08c00b found no owner of the budget or the per-event fixed costs: road-to-gates-that-check-what-they-claim cites the ceiling as an example (its step 2.4 is reconciled in 1.4 below), the others carry it only in receipt comments."
estate_growth_exempt: "+1 active_roadmaps (12 of 25), requested active by the owner in the invocation (`/analyze:inbox … Danach /roadmap:process-full`)."
relates:
  - slug: road-to-gates-that-check-what-they-claim
    relation: depends
    note: "Its step 2.4 names the hook-bundle ceiling as a shrink-only ceiling; 1.4 here removes that premise for the hook bundle and amends the step's text."
  - slug: later/road-to-a-hook-system-with-isolated-guards
    relation: extends
    note: "The structural half of the same owner ask: guard isolation, batch events, typed concern API. Needs an owner decision and a live host probe."
---
# Road to a hook system that pays for what it does

> **Source:** `agents/tmp.old/inbox-2026-11-hb/` — an owner transcript and four
> external proposals (two revisions each of a budget-only plan and a
> whole-hook-system plan), owner directive
> [`2026-11-20-hook-bundle-budget-and-hook-economy`](../evidence/owner-directives/2026-11-20-hook-bundle-budget-and-hook-economy.md).
> Claims verified at `2eef08c00b` on darwin (node 26.7, Apple silicon).

## Goal

A hook change pays for what it costs at runtime, and nothing else: the byte
ceiling stops blocking feature work, every event stops paying fixed costs that
buy nothing, and the check that replaces the ceiling sees what an event
actually loads.

## Context

- **What the budget is.** `src/config/hook-bundle-budget.json` (78 KB, 28
  `raise_log` entries since 2026-10-01) holds a byte ceiling for
  `dist/hooks/dispatch.js`, 18 chunk ceilings, chunk-group ceilings and a cap of
  one YAML package, checked by `check_hook_bundle_composition.ts`. The file is
  on the ratification gate's watched set
  (`check_kernel_edit_ratified.ts:327-329`), so every raise needs a council
  record.
- **Why it blocks.** At the pin the gate reads 1,595,089 B against a ceiling
  of 1,595,100: 11 B of headroom, so any in-bundle change reds it. Two steps of
  `road-to-a-map-that-knows-what-happened` (`:255`, `:307`) ship unwired for
  lack of 1 B of headroom. The gate's own header says it measures nothing about
  latency (`check_hook_bundle_composition.ts:47-49`).
- **What it misses (reproduced here).** `settings.ts:21` loads `yaml` through
  `createRequire(import.meta.url)` at module top level; esbuild does not bundle
  that call, so the one-YAML cap stays green while every `pre_tool_use` loads
  `node_modules/yaml` beside the inlined copy (load trace, 2026-11-20). The
  entry bundle is never compile-cached: `compile_cache.ts:5-8` covers modules
  loaded after the call only.
- **Measured, darwin, `pre_tool_use` on a `Read`, interleaved, n = 40, p50.**
  Today 125 ms; one YAML copy 108 ms; plus an entry compile cache 93 ms
  (−26 %). Control `node -e 0` about 40 ms on the same loaded machine. The
  linux readings in the source (136 → 74 ms with two more fixes) are not
  re-derived here and are not relied on.
- **Further fixed costs, verified in source, not yet measured here.** Each
  concern copies and hardens `process.env` and restores it
  (`dispatch_hook.ts:624-667`); each concern writes its own locked feedback file
  on every dispatch (`dispatch_hook.ts:802-830`).
- **Shape at the pin.** 75 concerns (9 blocking, 66 advisory, 3 `fail_closed`);
  on Claude 20 on `pre_tool_use`, 20 on `post_tool_use`, no `matcher`.
  `dispatch_hook.ts` is exactly 1,500 lines against its 1,500-line budget.

## Non-goals

- A resident dispatcher or `http` hooks (council decision in
  `hook-latency-budget.json`, ADR-040).
- Removing concerns or changing which are on by default.
- Guard isolation, batch-event binding, `matcher` lowering and a typed concern
  API: planned in `later/road-to-a-hook-system-with-isolated-guards`.
- Lowering any `fail_closed` guard or changing an exit-code contract.

## Phase 1 — The ceiling stops being a ratchet

- [x] **1.1 Package allowlist replaces the YAML cap.** The composition gate
      fails when an npm package contributes bytes to the bundle that is not on
      a committed allowlist; the closed `YAML_PACKAGES` list and
      `max_yaml_packages` go.
      verify: tests where an unlisted package fails, a listed one passes, and a second YAML package (`js-yaml`) fails as before.
      Done 2026-11-20: `allowed_packages: ["yaml"]`; `tests/scripts/hook_bundle_composition.test.ts` (21 green) and the gate's self-test (4/4).
- [x] **1.2 One wide backstop.** One absolute bundle ceiling at the post-fix
      reading plus 20 %, rounded; per-chunk and chunk-group ceilings,
      `shrink_only` and the `raise_log` obligation end. The log stays in git at
      the pin and is summarised in `agents/evidence/analysis/`.
      verify: gate self-test covers under, over and missing-budget; the budget file is under 3 KB; `hook_bundle_raise_log.test.ts` is retired with its subject.
      Done 2026-11-20: `max_bytes` 1,915,000 (1,595,089 + 20 %), file 2.2 KB, chunk sizes printed as "reported, not gated"; history in `agents/evidence/analysis/hook-bundle-budget-retired-2026-11-20.md`.
- [ ] **1.3 The budget file leaves the ratification watched set** (owner D2).
      `check_kernel_edit_ratified.ts` stops matching `hook-bundle-budget.json`;
      the change to the gate carries the ratification record the gate demands.
      verify: the gate's tests show a budget-file-only diff passes without a record, and a `dispatch_hook.ts` diff still needs one.
- [x] **1.4 Reconcile the shrink-only premise elsewhere.** Amend step 2.4 of
      `road-to-gates-that-check-what-they-claim` (the hook bundle is no longer a
      shrink-only ceiling) and the source comments that cite the ceiling as a
      reason (`rule_inject_hook.ts:1085`, `lazy_concern.ts:37`,
      `rule_injection.ts:126,281`, `vendor_defaults.ts:17`,
      `instructions_observer_hook.ts:52`).
      verify: `rg -F 'hook-bundle-budget'` over `src/` returns only the gate, the budget file's readers and comments that state the backstop.
      Done 2026-11-20: gates roadmap 2.4 scoped; three comments that described a live hard ceiling rewritten. `lazy_concern.ts:37` and `instructions_observer_hook.ts:52` stay — they record what was decided then, which is still true.

## Phase 2 — Fixed costs out of every event

- [x] **2.1 One YAML copy at runtime.** `settings.ts` (and the lazy reads in
      `agent_settings.ts`) use the bundled reader when bundled, keeping the
      template usable unbundled.
      verify: the load trace of `pre_tool_use`, `post_tool_use`, `user_prompt_submit` and `stop` shows no `node_modules/yaml`; settings tests pass.
      Done 2026-11-20: `settings.ts` imports `yaml` statically; a second path the source plans did not name — every chunk with `yaml` external `require`d it from `node_modules` on `post_tool_use`, `user_prompt_submit` and `stop` — now resolves to the bundle's copy through `hooks/bundled_yaml.ts` and the chunk banner. Trace on five events: zero `node_modules` loads. `agent_settings.ts`'s lazy requires are not reached on these events and stay. Also fixed a date-bound test (`templates_telemetry_remote`) red on main since 2026-11-16.
- [ ] **2.2 The entry bundle is compile-cached.** `dist/hooks/dispatch.js`
      becomes a stub that enables the cache fail-open and imports the bundle
      from a sibling file; host commands, digest, freshness and
      direct-invocation checks keep working.
      verify: a second dispatch shows a populated cache; digest, freshness and content gates and the install staging tests pass; five parallel cold dispatches succeed.
- [ ] **2.3 Environment hardened once per dispatch.** Harden at dispatch start,
      restore at dispatch end; a concern that mutates the environment does not
      leak it to the next concern.
      verify: a test where one concern sets a variable and the next does not see it; existing dispatcher tests pass.
- [ ] **2.4 One feedback write per dispatch.** The summary carries every entry;
      a per-concern file is written only for a non-allow outcome; its readers
      read the summary.
      verify: an all-allow `pre_tool_use` writes at most two dispatcher feedback files; `hooks:status` output is unchanged on a fixture session.
- [ ] **2.5 Re-measure.** Run the Phase 3.1 bench on darwin against the pin.
      verify: the table is recorded in `agents/evidence/analysis/` with commit, node and machine.

## Phase 3 — Checks that see what an event pays

- [ ] **3.1 The bench is a script.** Interleaved base-vs-head (or variant)
      dispatch timing per event with a `node -e 0` control, plus the load trace,
      as one command.
      verify: one command prints p50, p90 and min per variant and the non-builtin modules each event loads.
- [ ] **3.2 Runtime load-set check.** One fixture dispatch per hot event; the
      non-builtin modules loaded must be the bundle and the chunks that event
      declares.
      verify: reintroducing the `createRequire('yaml')` line turns it red; the tree after 2.1 is green.

## Risk Register

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The stub breaks installed hosts | implementation | 2.2 changes what `dispatch.js` is; a staged runtime, a digest check or a direct-invocation guard could refuse every tool call | Host commands are unchanged; digest, freshness, content and staging tests run before the step closes; fallback K2 below | Phase 2 — Fixed costs out of every event |
| 2 | Leaking environment between concerns | implementation | 2.3 could let one concern's environment change reach the next | The step's own test plants exactly that leak | Phase 2 — Fixed costs out of every event |
| 3 | Losing the dependency-pull signal | product | Dropping per-chunk ceilings could let a concern drag a large dependency in again | The package allowlist (1.1) and the load-set check (3.2) catch the dependency class deterministically; the backstop catches creep | Phase 1 — The ceiling stops being a ratchet |
| 4 | Weakening the ratification gate beyond the budget | product | 1.3 edits the gate itself | Only the one path leaves the watched set; a test pins that dispatcher and manifest diffs still need a record | Phase 1 — The ceiling stops being a ratchet |

## Kill criteria

- **K1** 2.2 cannot keep the digest, freshness and direct-invocation guarantees
  without weakening one: drop the stub and record the measured gain it would
  have bought; the compile-cache question moves to the `later/` roadmap.
- **K2** 2.3 finds a concern that relies on a per-concern environment reset:
  that concern keeps its own copy; the hoist stands for the rest.

## Acceptance Criteria

- [ ] AC-1: A +2 KB own-code change to a concern passes the composition gate
      without touching the budget file or a ratification record.
- [ ] AC-2: A second YAML package, or any unlisted npm package, in the bundle
      fails the gate; a module loaded at runtime from `node_modules` on a hot
      event fails the load-set check.
- [ ] AC-3: `pre_tool_use` on a `Read` is at least 20 % faster at p50 than the
      pin on the same machine, interleaved.
- [ ] AC-4: No `fail_closed` guard, exit-code contract or host command changes.
