# Artifact Engagement Recording — mechanics

CLI invocation, privacy contract, failure-mode handling, and "what
this rule does NOT do" catalog for the
[`artifact-engagement-recording`](../../../rules/artifact-engagement-recording.md)
rule. The activation gate, cadence table, and consulted-vs-applied
definitions live in the rule; this file is the lookup material for
the actual `telemetry:record` call and the privacy floor.

## What to record — id-only, no payload

```bash
./agent-config telemetry:record \
  --task-id "$TASK_ID" \
  --boundary task \
  --consulted skills:php-coder \
  --consulted skills:eloquent \
  --consulted rules:scope-control \
  --applied skills:php-coder \
  --applied rules:scope-control
```

- `--task-id` — the ticket key (`PROJ-123`) for `/implement-ticket`, or a
  short opaque slug derived from the prompt for `/work`. **Never** a
  branch name, a file path, or a free-text title.
- `--boundary` — `task` or `phase-step`, matching the cadence in the rule.
- `--consulted <kind>:<id>` — repeat per artefact. `<kind>` is one of
  `skills`, `rules`, `commands`, `guidelines`, `personas`.
- `--applied <kind>:<id>` — repeat per artefact actually applied.
- Exit `0` always when disabled (silent). Exit `1` on schema validation
  failure (rule must NOT swallow this — surface to the user). Exit `2`
  on IO failure.

## Privacy contract — what NEVER goes into a record

The CLI rejects most violations on the input boundary, but the agent must
not even attempt these:

- ❌  File paths (`src/Foo.php`, `tests/...`) — id fields are
  artefact identifiers only.
- ❌  Source code, prompt text, ticket body, AC text.
- ❌  Branch names, commit shas, PR numbers, URLs.
- ❌  Secrets, env vars, credentials, customer data.
- ❌  Free-text strings longer than 200 chars (CLI enforces; agent must
  not generate).

When in doubt → **don't record**. A missing event is cheap; a leaked
prompt is not.

## Failure modes — DO NOT block the user's task

- Schema rejection (CLI exit `1`) → log the message internally, continue
  the user's task. Do **not** halt the dispatch loop.
- IO failure (CLI exit `2`) → same. The telemetry is **observation**, not
  a delivery requirement.
- Settings malformed → already handled by the CLI: it falls back to
  disabled and exits `0`. Agent treats it as "disabled this task".

The only error the agent surfaces is when the user explicitly asked for
recording (`telemetry:status` confirms enabled) but no event reached the
log — that is a real bug, not a swallowed error.

## What this rule does NOT do

- Run when `enabled: false` (cost floor is zero — see
  [`tests/telemetry/test_cost_floor.py`](../../../../tests/telemetry/test_cost_floor.py)).
- Track the agent's tool calls, file reads, or token spend — that is
  out of scope, see the roadmap's "out-of-scope" section.
- Decide retirement. Phase 4's aggregator + report renderer are the only
  consumers that may interpret the JSONL.
- Run on cloud surfaces (Claude.ai Web, Skills API). The
  `cloud_safe: noop` marker keeps it inert there.
