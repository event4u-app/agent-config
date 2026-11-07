<!-- evidence-type: analysis -->

# Do hooks fire in a bench-shaped `--print` run? — 2026-11-07

Step 1.2 of `road-to-a-reference-that-arrives-before-the-act`. Two paid Haiku
trials, released by the owner on 2026-11-07, total cost **$0.0052**.

**Command (both arms):** `claude -p "Reply with the single word DONE." --output-format
stream-json --verbose --model haiku --max-budget-usd 0.05`, the second arm adding
`--setting-sources project,local` — the flag `setting_sources_for('without')` passes in
`internal/bench/core/bench_ab_task_runner.ts`. Claude Code from `/opt/homebrew/bin/claude`,
in an empty scratch directory, no tool call.

| Arm | Setting sources | `hook_response` events | `hookInstrument` | Cost |
|---|---|---|---|---:|
| package (user settings loaded) | default | SessionStart × 4 | `ok` | $0.0042 |
| without | `project,local` | none | `ok` | $0.0009 |

## Event shape (pinned)

`{"type":"system","subtype":"hook_started"|"hook_response","hook_id",…,"hook_name":"SessionStart:startup","hook_event":"SessionStart"}`;
the response adds `output`, `stdout`, `stderr`, `exit_code`, `outcome`.

## What this settles and what it does not

- Hooks fire in a `--print` run that loads user settings, and do not fire when the
  arm excludes them: the bench's `without` arm is hook-free by construction, the
  package arm is not.
- **Only `SessionStart` surfaced in the stream.** The run made no tool call, and
  `UserPromptSubmit` / `Stop` hooks — bound for this install — produced no stream
  event. Whether they fire unseen or do not fire under `-p` is not settled by the
  stream. The invariant therefore asks "any hook seen", never "every event seen".
- The runner now records `hook_events` and `hook_instrument` on every streamed run;
  a package-arm trial with no hook event is `no-hook-event`.
