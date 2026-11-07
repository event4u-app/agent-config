<!-- evidence-type: analysis -->

# Main-session census on split hook buckets — 2026-11-07

Step 1.3 of `road-to-a-reference-that-arrives-before-the-act`. Re-run of the
main-session census after #2905 split hook output by attachment type.

**Command:** `./scripts-run src/scripts/preamble_byte_census --main-session --format json`
over one maintainer main session on Claude Code (2026-11-07, the session that ran
rounds `inbox-2026-11-z` and `inbox-2026-11-za`), 219 `Bash` tool calls in the
transcript.

| Event · hook | Attachment | Model-visible | Occurrences | Mean chars | Total chars |
|---|---|---|---:|---:|---:|
| UserPromptSubmit | hook_additional_context | yes | 8 | 555 | 4,437 |
| SessionStart:startup | hook_success | yes | 1 | 4,250 | 4,250 |
| PostToolUse:Bash | hook_additional_context | yes | 3 | 562 | 1,686 |
| PreToolUse:Bash | hook_additional_context | yes | 4 | 270 | 1,081 |
| PreToolUse:Edit | hook_additional_context | yes | 1 | 427 | 427 |

Session start: 400,245 chars (~100k tokens).

## Reading

- No `hook_success` stdout was recorded on any tool hook in this session, so the
  stdout/visible split removes nothing here: every tool-hook character the census
  saw reached the model.
- `PostToolUse:Bash` fired output on **3 of 219** `Bash` calls, mean 562 chars —
  about **8 chars per `Bash` call** on average. The earlier figure, ~1,050 chars on
  each of 20 calls (`docs/benchmark.md`, #2888), described a different session; it
  is not a per-call constant. The tool hooks here emit only on a matched condition
  (a PR created, a shell write, a freshness note), not on every call.
- One session, one machine. It refutes "every `Bash` call costs ~1,050 chars" as a
  general claim; it does not establish a typical rate. P1.4 of the source plan
  (cut per-call hook output) has no measured target on this evidence.
