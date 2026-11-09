<!-- evidence-type: analysis -->

# The `InstructionsLoaded` observer records load reasons — 2026-11-09

Evidence for `road-to-mixed-trigger-activation-cost` step 3.3, whose verify
line is "the observer records a load event with its reason on this tree".

## The binding

- `hooks/hooks.json` binds `InstructionsLoaded` (line 103) and dispatches it as
  `instructions_loaded`.
- `src/scripts/hook_manifest.yaml` maps the native event to that name (line 1975).

The step was parked on 2026-08-17 because the event was absent from the host's
native event list (`hook_manifest.yaml` § native_event_aliases, then nine
events). That condition no longer holds.

## The records

`~/.event4u/agent-config/runtime/arrivals/` on the maintainer's machine, read
2026-11-09: 50 session files, 5,407 `InstructionsLoaded` records between
2026-11-05T21:29Z and 2026-11-09T01:53Z, from hosts `claude-code_2-1-310_harness`
and `claude-code_2-1-316_harness`. Every record carries the loaded file and the
host's load reason:

| Reason | Records |
|---|---|
| `compact` | 4,440 |
| `session_start` | 878 |
| `include` | 87 |
| `path_glob_match` | 2 |

One record, verbatim:

```
{"v":2,"ts":"2026-11-08T09:59:43.356Z","agent":"claude-code_2-1-316_harness","launch":"cli","session":"40700364-44ba-49bc-ba11-52cf6194a599","name":"InstructionsLoaded","reason":"session_start","file":"downstream-changes.md","rules":true,"user":true}
```

## What this does and does not settle

It settles the instrument: which rules actually loaded, per session and with
the host's reason, is now observable rather than simulated from the emitter.
It does not run the behavioural bench of steps 3.1 and 3.2, which stay blocked
on `b-behavioural-bench-spend`; when that bench runs, this observer is how its
two arms are instrumented. The store is one machine's runtime directory, so the
counts describe the maintainer's sessions, not consumer installs.
