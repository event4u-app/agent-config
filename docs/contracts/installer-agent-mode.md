---
stability: beta
keep-beta-until: 2026-08-19
---

# Installer agent-mode protocol — JSON-over-stdio contract

> Companion to [ADR-016](../decisions/ADR-016-installer-architecture.md)
> § 4 and § 6. The ADR is the decision; this file is the worked-example
> reference that agents (Claude, Cursor, GPT, …) and the installer
> CLI share at runtime.

## Source of truth

The agent-mode state machine lives in
[`packages/core/installer/src/agent-mode/machine.ts`](../../packages/core/installer/src/agent-mode/machine.ts).
Envelope construction and `--answer` parsing live in
[`protocol.ts`](../../packages/core/installer/src/agent-mode/protocol.ts).
Both are unit-tested under
[`packages/core/installer/tests/agent-mode-*.test.ts`](../../packages/core/installer/tests/).

## Design constraints

- **Stateless across invocations** — the installer keeps no
  server-side session. Every turn carries the full conversation as
  repeated `--answer key=value` flags. An agent may re-issue from
  scratch at any time.
- **Strict question-id sequencing** — answers must arrive in the
  order the installer asks them (`q1.workspaces`, then `q2.packs`,
  then optional `q3.confirm`). Out-of-order or unknown ids return
  an `error` envelope, exit code 2.
- **Single-line JSON per turn** — stdout emits exactly one
  newline-terminated JSON object per invocation; stderr is reserved
  for diagnostics and is not part of the contract.
- **`protocol_version: 1`** — every envelope carries it; agents
  refusing the version negotiate by aborting.

## Envelope shapes

### `question`

The installer is waiting for the next answer.

```json
{
  "status": "question",
  "protocol_version": 1,
  "id": "q1.workspaces",
  "prompt": "Which workspaces does this project need? (multi, comma-separated)",
  "choices": [
    { "value": "engineering", "label": "Engineering" },
    { "value": "product", "label": "Product" }
  ],
  "multi": true,
  "next_call": "init --agent --answer q1.workspaces=<value>"
}
```

- `id` — the canonical question identifier; the agent echoes it as
  `--answer <id>=<value>`.
- `multi: true` — comma-separated values allowed; `multi: false` —
  exactly one value.
- `next_call` — the literal command the agent should issue next,
  with `<value>` (and prior answers) substituted in.

### `done`

Terminal success; no further calls needed.

```json
{
  "status": "done",
  "protocol_version": 1,
  "summary": { "files_written": 83, "lockfile_sha256": "c45b3035…" }
}
```

### `error`

Terminal failure; exit code 2.

```json
{
  "status": "error",
  "protocol_version": 1,
  "reason": "out_of_order",
  "expected_question_id": "q1.workspaces",
  "received": "q2.packs"
}
```

Defined `reason` values: `answer_malformed`, `out_of_order`,
`unknown_workspace`, `unknown_pack`, `aborted_by_agent`.

## Turn-by-turn worked example

```bash
# Turn 1 — discover workspaces
$ installer init --agent
{"status":"question","id":"q1.workspaces", … "next_call":"… --answer q1.workspaces=<value>"}

# Turn 2 — answer workspaces, discover packs
$ installer init --agent --answer q1.workspaces=engineering
{"status":"question","id":"q2.packs", … "next_call":"… --answer q1.workspaces=engineering --answer q2.packs=<value>"}

# Turn 3 — answer packs, install completes
$ installer init --agent --answer q1.workspaces=engineering --answer q2.packs=engineering-base
{"status":"done","summary":{"files_written":83,"lockfile_sha256":"c45b3035…"}}
```

When the pack selection pulls in extras via `requires_hint`, the
installer inserts a `q3.confirm` turn before completing:

```bash
$ installer init --agent --answer q1.workspaces=engineering --answer q2.packs=symfony
{"status":"question","id":"q3.confirm", "prompt":"Auto-added packs: php. Continue?", "choices":[{"value":"yes","label":"yes"},{"value":"no","label":"no"}], "multi":false, … }
```

`q3.confirm=no` returns `reason: "aborted_by_agent"`.

## Flags relevant to agent mode

- `--manifest <path>` — override the manifest location (defaults to
  walking up for `dist/discovery/discovery-manifest.json`).
- `--project-root <path>` — destination project root.
- `--dry-run` — resolve and emit the `done` envelope without
  touching disk; used by agents that want a plan preview.

## Failure modes guarded against

- **Agent loops** — `protocol_version` mismatch on any side aborts
  immediately; no implicit version negotiation.
- **State drift between turns** — the installer never reads
  workdir state to recover answers; every fact must be carried in
  `--answer` flags.
- **Silent partial install** — on any error after `q2.packs`,
  exit code 2 with no disk writes (atomic via `StagingSession`).
