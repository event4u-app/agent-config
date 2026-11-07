<!-- evidence-type: analysis -->

# Reference duty — hot-path cost and state bounds

The two entry questions blocker `hook-binding-ratification` names for re-binding
`reread-guard` on Bash and claude `pre_compact`
(`road-to-a-reference-that-arrives-before-the-act` step 2.2).

## Cost per Edit/Write

In-process timing of `scanDuties` + `dutyStates` against the repository's real
`dist/router.json` and rule tree, 20 warm-up calls then 500 timed calls per path,
2026-11-07 on the maintainer's Mac:

| Path written | Duties found | p50 | p90 | p99.9 |
|---|---:|---:|---:|---:|
| `src/scripts/x.ts` (no trigger matches) | 0 | 0.450 ms | 0.646 ms | 1.055 ms |
| `dist/agent-src/rules/x.md` | 1 | 0.610 ms | 0.783 ms | 1.153 ms |
| `.claude/settings.json` | 1 | 0.406 ms | 0.569 ms | 1.209 ms |

Against the `any_hook_event.p95_ci` budget of 250 ms in `hook-latency-budget.json`,
this is under 0.5 % of it.

## Cost per Bash call

The concern reaches its ledger only for a plain `cat <absolute file>`. Every other
Bash command is one anchored regex (`wholeFileCatPath`) and an early return, before
any filesystem access.

## State bounds

- `duty`: at most one entry per `rule::reference` pair. The real bound is the router's
  path- and file-triggered references (two rules today, per step 2.4); a hard cap of
  `MAX_DUTY_KEYS = 256` stops a corrupt router from growing the file, and each dropped
  key increments `duty_overflow`. Entries hold integers, so they do not grow with use.
- `duty_errors`, `duty_overflow`: single integers.
- `reads`: one entry per distinct file read in full, unchanged from the guard's
  behaviour before this roadmap; cleared at `pre_compact` once bound.
