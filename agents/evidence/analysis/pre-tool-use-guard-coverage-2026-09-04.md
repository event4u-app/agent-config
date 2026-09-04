# `pre_tool_use` guard coverage — the roster

<!-- evidence-type: analysis -->

> Derived from `src/scripts/hook_manifest.yaml` on 2026-09-04
> (`road-to-defect-population-sweeps` 2.2) and held current by
> `tests/hooks/pre_tool_use_guard_coverage.test.ts`, which reds when a guard
> joins the manifest without a row here, or when a row's verdict drifts from
> what the test corpus actually imports.

## Why a roster and not a list of what is covered

The audit this replaces covered **one** guard and said nothing about the other
fourteen. In a list that names only what it covers, an uncovered guard and a
guard nobody thought about are the same absence. So every guard appears, and
the uncovered one appears **as uncovered** — the posture
`check_enforcement_coverage` takes for rules.

## What `covered` means here — and what it does not

`covered` = some file under `tests/` imports the concern's own **entry-point
module**. It is a *reachability* measure: it says a test drives this guard. It
says nothing about whether the test is good, whether it asserts both polarities,
or whether it would catch a regression. A guard can be `covered` here and badly
tested.

The measure is entry-point imports rather than "the guard's name appears
somewhere in `tests/`" because the looser form hides exactly the gap below.

## The roster — 15 guards, 14 covered, 1 uncovered

| guard | concern script | verdict | driving tests |
|---|---|---|---|
| `block-config-weakening` | `src/scripts/hooks/block_config_weakening.ts` | covered | 1 |
| `block-kernel-rule-writes` | `src/scripts/hooks/block_kernel_rule_writes.ts` | covered | 4 |
| `block-no-verify` | `src/scripts/hooks/block_no_verify.ts` | covered | 4 |
| `block-speaking-inbox-dir` | `src/scripts/hooks/block_speaking_inbox_dir.ts` | covered | 1 |
| `block-unauthorized-git` | `src/scripts/hooks/block_unauthorized_git.ts` | covered | 6 |
| `code-graph-nudge` | `src/scripts/hooks/code_graph_nudge_hook.ts` | covered | 1 |
| `design-slop` | `src/scripts/hooks/design_slop_hook.ts` | **UNCOVERED** | 0 — see below |
| `evidence-independence` | `src/scripts/hooks/evidence_independence.ts` | covered | 2 |
| `reread-guard` | `src/scripts/hooks/reread_guard_hook.ts` | covered | 1 |
| `rtk-wrap` | `src/scripts/hooks/rtk_wrap_hook.ts` | covered | 1 |
| `rule-inject` | `src/scripts/hooks/rule_inject_hook.ts` | covered | 2 |
| `ship-diff-volume` | `src/scripts/hooks/ship_diff_volume_hook.ts` | covered | 1 |
| `source-first-gate` | `src/scripts/hooks/source_first_gate_hook.ts` | covered | 1 |
| `spawn-guard-shadow` | `src/scripts/hooks/spawn_guard_shadow_hook.ts` | covered | 1 |
| `ui-route-nudge` | `src/scripts/hooks/ui_route_nudge_hook.ts` | covered | 4 |

## The one gap, stated rather than omitted

**`design-slop`.** Three tests exercise its detector library
(`src/scripts/lint_design_slop.ts`) — `design_slop_vs_provided.test.ts`,
`design_slop_cp6.test.ts`, `design_slop_fp_bench.test.ts` — and **none imports
`design_slop_hook.ts`**, the concern entry point the dispatcher actually runs.
So the slop *detection* is tested and the guard's *decision path* — envelope
parsing, the state write at `:119`, the exit code, the flags-never-blocks
contract that `concern_severity.test.ts` only asserts in prose — is not driven
by anything.

This is recorded, **not fixed here**. Closing it means writing a hook-level test
for a guard this roadmap does not otherwise touch, which is the scope creep
`minimal-safe-diff` forbids and the roadmap's own Risk Register 3 anticipates:
turning a frozen table into an enumerated one makes it look authoritative, and
the honest form of authority is naming what is missing.

## What this roster is not

It covers `pre_tool_use` only — the slot where a guard can refuse. The other
slots (`post_tool_use`, `user_prompt_submit`, `stop`, `session_start`) carry
concerns whose coverage is not measured here and must not be inferred from it.
