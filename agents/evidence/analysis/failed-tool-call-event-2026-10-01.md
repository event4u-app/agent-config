<!-- evidence-type: analysis -->

# Which native event a failed tool call fires on claude — an observed session

Produced by `agents/roadmaps/road-to-a-failed-command-the-recorder-sees.md` step 1.1.
The question it answers was filed with an undetermined cause at
`agents/evidence/analysis/verification-classifier-before-after-2026-09-30.md:73-85`:
24 run records on claude, none with a non-zero `exit_code`, and a failing
`npx tsc --noEmit <missing file>` (exit 2) absent from `verification_runs`
altogether. The cause is now observed rather than inferred.

## Probe

| Field | Value |
|---|---|
| Host | claude (Claude Code) |
| Host version | 2.1.286, from `claude --version` |
| Date | 2026-10-01 |
| Project | a scratch directory outside this repository, no repo rules and no agent-config hooks in scope |
| Hook binding | one `jq` one-liner on **both** `PostToolUse` and `PostToolUseFailure`, appending `{probe_event, envelope_keys, envelope}` to a JSONL |
| Invocation | `claude -p … --settings <probe config> --permission-mode bypassPermissions --allowedTools Bash --max-turns 4` |
| Sessions | three one-shot sessions, each with its own `session_id` |

The hooks were passed through `--settings` rather than a `.claude/settings.json`
in the scratch tree. That is a probe-mechanics detail with one consequence worth
stating: the binding is the host's own settings merge, the same path a consumer
install uses, so nothing about the result is specific to how the file was named.

## What was observed

| Session | Command | Exit | Event fired | Events fired for that call |
|---|---|---|---|---|
| A | `false` | 1 | `PostToolUseFailure` | 1 |
| B | `true` | 0 | `PostToolUse` | 1 |
| C | `npx tsc --noEmit /nonexistent-probe-file.ts` | 2 | `PostToolUseFailure` | 1 |

Session C is the exact command the 2026-09-30 reading could not account for.

**A failing Bash call fires `PostToolUseFailure`. A passing one fires
`PostToolUse`. Each call fires exactly one of the two** — across three sessions
the tally was two `PostToolUseFailure` and one `PostToolUse`, each attributable
by `session_id` to one call. No call produced both.

## The two envelopes

Keys, as the host sent them:

```
PostToolUseFailure  cwd duration_ms effort error hook_event_name is_interrupt
                    permission_mode prompt_id session_id tool_input tool_name
                    tool_use_id transcript_path

PostToolUse         cwd duration_ms effort hook_event_name permission_mode
                    prompt_id session_id tool_input tool_name tool_response
                    tool_use_id transcript_path
```

Session C's failure envelope, values that matter:

```json
{"hook_event_name":"PostToolUseFailure","tool_name":"Bash","is_interrupt":false,
 "tool_input":{"command":"npx tsc --noEmit /nonexistent-probe-file.ts"},
 "error":"Exit code 2\nerror TS6053: File '/nonexistent-probe-file.ts' not found.\n…",
 "duration_ms":1148}
```

Session B's success envelope, for contrast:

```json
{"hook_event_name":"PostToolUse","tool_name":"Bash",
 "tool_response":{"stdout":"","stderr":"","interrupted":false,
                  "isImage":false,"noOutputExpected":false}}
```

## The cause, in three facts

1. **`PostToolUseFailure` is bound to nothing.** It occurs zero times in
   `hooks/hooks.json`, `src/scripts/hook_manifest.yaml` and
   `src/scripts/hooks/host_lowering.yaml`; `hooks/hooks.json` binds the
   recorder's `post_tool_use` concern list to `PostToolUse` only. So on a failing
   command the recorder never runs at all. The failing `tsc` was **never
   recorded**, not recorded-then-evicted — which closes the alternative the
   2026-09-30 reading left open, and explains why `_cap_runs`' earliest-failing
   preservation did not save it: there was nothing to preserve.

2. **The failure envelope has no `tool_response`.** The exit status arrives in a
   top-level `error` string whose first line is `Exit code N`. The recorder's
   `_extract_exit_reading` scans `tool_response` / `toolResponse` / `result` /
   `output` and does not look at `error`; its `_ERROR_EXIT_PREFIX`
   (`/^Error:\s*Exit code\s*(\d+)/i`) additionally requires a literal `Error:`
   prefix this string does not carry. Routing the event to `post_tool_use` is
   therefore necessary and not sufficient — without a parser reading, the record
   would be written with `exit_code: null`, which is the instrument gap wearing
   the shape of a fix.

3. **The interrupt flag is spelled differently.** `is_interrupt` at the top
   level, against the `interrupted` the recorder reads inside `tool_response`.

Facts 2 and 3 are the condition `D2`'s `revisit-if` names — "the failure envelope
carries fields the recorder cannot read through the same parser". The answer it
points to is still the aliased slot: the fields are additive readings inside the
same `_extract_exit_reading`, not a second parser and not a second canonical
event.

## What this does not establish

Only claude, only version 2.1.286, only the `Bash` tool. Whether another host
splits success and failure across two events, and whether a non-`Bash` tool
failure carries the same `error` shape, were not probed and are not claimed. The
per-host instrument-gap reading this roadmap's Phase 3 produces is where that
absence is counted rather than assumed away.
