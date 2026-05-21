---
name: install-via-agent
tier: 2
skills: []
description: Drive `@event4u/agent-config` installer through its JSON agent-mode protocol — turn-by-turn workspace + pack selection without TTY.
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "install @event4u/agent-config in this project via agent mode, headless install, no TTY"
  trigger_context: "user wants to install or re-install @event4u/agent-config and the agent should drive the picker (not a human at a terminal)"
workspaces:
  - agent-config-maintainer
  - engineering
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: false
  removable: true
---

# /install-via-agent

Drive the `@event4u/agent-config` installer through its **agent-mode**
protocol — a JSON-over-stdio state machine that lets an LLM agent
pick workspaces + packs turn-by-turn without a TTY.

Contract: [`docs/contracts/installer-agent-mode.md`](../../docs/contracts/installer-agent-mode.md).
Architecture: [ADR-016](../../docs/decisions/ADR-016-installer-architecture.md) § 4, § 6.

## When to use

- Headless / CI install where no human is at a keyboard.
- Re-install with a different workspace + pack mix.
- Demonstrating the protocol for documentation or smoke tests.

For interactive install with a human, run `npx @event4u/agent-config init`
in a real terminal — the installer auto-detects the TTY and renders
the `@inquirer/prompts` picker.

## Steps

### 1. Locate the installer

```bash
which agent-config-installer            # global install
ls node_modules/.bin/agent-config-installer  # local install
# OR run from monorepo dev:
node packages/core/installer/dist/cli.js --version
```

### 2. Turn 1 — request the first question

```bash
agent-config-installer init --agent --dry-run
```

The CLI emits a single JSON line:

```json
{"status":"question","protocol_version":1,"id":"q1.workspaces", … "next_call":"init --agent --answer q1.workspaces=<value>"}
```

Parse `choices[]` and pick the workspaces the project needs (multi:
comma-separated values, e.g. `engineering,product`).

### 3. Turn 2 — answer workspaces, request pack list

Execute the `next_call` substituting `<value>`:

```bash
agent-config-installer init --agent --dry-run --answer q1.workspaces=engineering
```

Response:

```json
{"status":"question","id":"q2.packs", … "next_call":"… --answer q1.workspaces=engineering --answer q2.packs=<value>"}
```

Pick from `choices[]`. The list is already scoped to the workspaces
chosen in turn 1.

### 4. Turn 3 — answer packs, possibly confirm auto-added

```bash
agent-config-installer init --agent --dry-run --answer q1.workspaces=engineering --answer q2.packs=engineering-base,php
```

Two terminal cases:

- **`done`** — selection complete, no auto-added packs:

  ```json
  {"status":"done","summary":{"files_written":83,"lockfile_sha256":"…"}}
  ```

- **`question` (`q3.confirm`)** — `requires_hint` pulled extra packs
  in. Re-issue with `--answer q3.confirm=yes` to proceed, or
  `--answer q3.confirm=no` to abort with `aborted_by_agent`.

### 5. Drop `--dry-run` for the real install

Once the agent has confirmed the plan, repeat the final turn
without `--dry-run`. Files materialize atomically; the lockfile
lands at `agents/agent-config.lock.yml`. <!-- ref-ignore -->

## Failure modes

- **Exit 2 + `status:"error"`** — `answer_malformed`,
  `out_of_order`, `unknown_workspace`, `unknown_pack`, or
  `aborted_by_agent`. Read `reason` and `expected_question_id`,
  fix the next call, re-issue.
- **Manifest not found** — pass `--manifest <path>` pointing at
  `dist/discovery/discovery-manifest.json`.
- **`protocol_version` mismatch** — abort; do not attempt
  recovery. Upgrade the agent or pin an older installer.

## Rules

- **One JSON envelope per turn** — never batch.
- **Re-issue from scratch on doubt** — the installer is stateless;
  carrying all prior answers in `--answer` flags is the contract.
- **Do NOT commit `agent-config.lock.yml` blind** — review the
  lockfile diff before committing per `commit-policy`.
