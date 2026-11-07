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

On `pre_tool_use` a Bash call returns at once: a `cat` is never credited there. On
claude `post_tool_use` every other Bash command is one anchored regex
(`wholeFileCatPath`) and an early return; a plain `cat <absolute file>` adds one
`stat`, one read of the file (at most 2 MB) and one ledger write, and is credited only
when the call was not interrupted, wrote nothing to stderr, exited 0 where the result
says, and returned bytes identical to the file now on disk.

The read goes through one non-blocking descriptor (a FIFO or device returns at once),
regular files only, at most 2 MB, refused if size or mtime moved during the read.
Timed in-process (200 runs after 20 warm-up), open + fstat + read + fstat + byte
compare:

| File | p50 | p95 |
|---|---:|---:|
| 10 KB | 0.02 ms | 0.06 ms |
| 1 MB | 0.15 ms | 0.28 ms |
| 2 MB (the cap) | 0.23 ms | 0.45 ms |

Hook bundle after this change: 1,584,309 / 1,585,000 B — 691 B of headroom left.

## State bounds

- `duty`: at most one entry per `rule::reference` pair. The real bound is the router's
  path- and file-triggered references (two rules today, per step 2.4); a hard cap of
  `MAX_DUTY_KEYS = 256` stops a corrupt router from growing the file, and each dropped
  key increments `duty_overflow`. Entries hold integers, so they do not grow with use.
- `duty_errors`, `duty_overflow`: single integers.
- `reads`: one entry per distinct file read in full, unchanged from the guard's
  behaviour before this roadmap; cleared at `pre_compact` once bound.
