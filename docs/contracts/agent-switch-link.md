---
stability: beta
keep-beta-until: 2027-01-31
---

# agent-switch link

> **Status:** Active · describes **link contract `1`** as served by
> agent-switch 2.13.0 and later, and the rules agent-config (AC) follows when
> it consumes it. The serving side lives in `event4u-app/agent-switch`
> (`src/link/mcp.ts`, `src/link/requests.ts`, `src/link/limits.ts`,
> `src/commands/link.ts`). The AC side: `src/scripts/_lib/agent_switch_link.ts`
> (discovery), `src/scripts/_lib/agent_switch_client.ts` (MCP client and CLI
> fallback), `src/scripts/_lib/agent_switch_limits.ts` (the limits read) and
> `src/scripts/_lib/mcp_bridge.ts` (`.mcp.json` entry), pinned by
> `tests/scripts/agent_switch_link.test.ts`,
> `tests/scripts/agent_switch_client.test.ts`,
> `tests/scripts/agent_switch_limits.test.ts` and
> `tests/scripts/agent_switch_link_install.test.ts`. No AC feature calls a link
> tool yet; the readers that use them come next.

## Purpose

When a session nears its plan limit, the user is asked whether to move the
work to another account. The question is open in both tools at once, the
first answer counts in both, and agent-switch carries out an approved move.
AC also reads every account's limits to place council and judge-bracket
seats. This contract fixes the shapes both sides rely on, so neither has to
read the other's source.

**Division of labour.** agent-switch holds accounts, limits, requests and the
move. AC reads limits, raises a request, records the user's answer and relays
outcomes. AC never moves a session, never picks a target on its own, and
never depends on agent-switch: every path below has an absence rule.

## Discovery — `agent-switch link status --json`

```json
{"enabled": true, "version": "2.13.0", "contract": 1,
 "mcp": {"command": "agent-switch", "args": ["mcp", "serve"]}}
```

| Field | Meaning |
|---|---|
| `enabled` | The user's "Let agent-config connect" setting (default on). Only agent-switch switches it: `agent-switch link on\|off`. |
| `version` | agent-switch's version. Informational; AC gates on `contract`, never on `version`. |
| `contract` | This contract's version. Bumped only on a breaking change to a tool or JSON shape. |
| `mcp` | The stdio server to register. AC writes exactly this command and these args. |

AC treats the link as **present** only when the command exits 0 within its
timeout, the output parses, `enabled` is `true` and `contract` is `1`.
Anything else is absence (see [Absence rules](#absence-rules)).

## Transport — `agent-switch mcp serve`

- JSON-RPC 2.0 over stdio, one message per line; logs go to stderr only.
- Started by the host as a child of the agent process, as the same user: no
  port, nothing listening, no token.
- Protocol versions offered: `2025-06-18`, `2025-03-26`, `2024-11-05`. An
  unknown requested version is answered with the newest.
- `clientInfo.name` (matching `^[\w.-]{1,40}$`) becomes the `ac:<client>`
  suffix recorded on decisions.
- The setting is read on **every** request. Off: `tools/list` returns `[]`
  and `tools/call` returns `isError: true` with a text naming
  `agent-switch link on`.
- `tools/call` results carry the JSON as text **and** as `structuredContent`.
  An array result is wrapped as `structuredContent: {"items": [...]}`.
  A tool error is `isError: true` with the message as text, never a
  JSON-RPC error.

## Tools

| Tool | Arguments | Returns | Read-only |
|---|---|---|---|
| `link_status` | — | the discovery object above | yes |
| `limits_get` | `provider?`: `claude` \| `codex` \| `antigravity` | [Limits report](#limits-report) | yes |
| `session_whoami` | — | `{account, session, source}` | yes |
| `switch_list` | `all?`: boolean | `SwitchRequest[]` — states `open`, `approved`, `executing`; every state with `all: true` | yes |
| `switch_status` | `id` | one `SwitchRequest`; unknown id is a tool error | yes |
| `switch_request` | `session?`, `account?` | `{request, created}` | no (idempotent) |
| `switch_decide` | `id`, `decision`, `target?`, `how?` | `{request, applied}` | no (idempotent) |

### `session_whoami`

`account` is `provider/name`, `session` is `provider/account/sessionId`; both
may be `null`. `source` names where the answer came from (`hosted`,
`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `none`). A `null` account means agent-switch
does not know this session's account; AC then passes `account` explicitly or
raises nothing.

### `switch_request`

Opens the request for an account, or returns the one already open for the same
limit cycle (`created: false`). Omit both arguments to mean "this session".
It moves nothing. It is a **tool error** when no other account can take the
work (every candidate full, stale or disabled) — AC then shows today's
limit notice and raises nothing.

### `switch_decide`

Records **the user's** answer. AC calls it only after the user chose, and the
host must confirm the call: AC never puts it on an auto-allow list.

- `decision`: `approve` \| `decline` \| `snooze`.
- `approve` without `target` takes the first candidate; without `how` the
  candidate's first offered move. A `target` that is not a candidate, or a
  `how` the candidate does not offer, is a tool error.
- `how`: `after-turn` \| `now` \| `handoff`.
- The decision is recorded as `by: "ac:<client>"`.

## Limits report

```json
{"v": 1, "at": "<ISO-8601>", "accounts": [{
  "id": "claude/work", "provider": "claude", "name": "work",
  "disabled": false, "usable": true, "why": null,
  "stale": false, "observedAt": "<ISO-8601>", "thresholdPct": 90,
  "windows": [{"key": "five_hour", "fill": 42, "resetsAt": "<ISO-8601>", "resetPassed": false}]
}]}
```

- **Observations, never reservations.** A `usable` account can be full by the
  time AC acts on it.
- Cached data only; reading costs no request and no quota.
- `usable` means enabled, fresh, and under `thresholdPct` in every live window.
  `why` names the reason when it is not.
- `stale: true` keeps the last numbers and says so. **AC treats a stale
  account as unknown** — never as usable, never as full.
- `fill` is `0`–`100`, or `null` when unknown or when the window has reset
  since it was read (`resetPassed: true`).
- An account with no readout has `windows: []`, `observedAt: null`.
- `id` is the label AC's own quota ledger writes: the status-line tap tags
  each snapshot with the `provider/name` of the profile it runs under, and
  AC's plan-pressure verdict is computed per label, so the two readings of one
  account can be joined.

## Switch request

```json
{"v": 1, "id": "<16 hex>", "rev": 3,
 "session": "claude/work/<sessionId>", "account": "claude/work",
 "reason": {"window": "five_hour", "fill": 93, "resetsAt": "<ISO-8601>"},
 "raisedBy": "ac", "raisedAt": "<ISO-8601>", "expiresAt": "<ISO-8601>",
 "candidates": [{"target": "claude/home", "provider": "claude", "fill": 12,
                 "resetsAt": "<ISO-8601>", "how": ["after-turn", "handoff"]}],
 "state": "approved",
 "decision": {"kind": "approve", "target": "claude/home", "how": "after-turn",
              "by": "ac:claude-code", "at": "<ISO-8601>"}}
```

- `session` is `null` when the request is for "whatever runs on this account".
- `raisedBy`: `as-daemon` \| `as-gui` \| `as-cli` \| `ac`.
- `decision` and `outcome` are present only once set.
- `outcome`: `{at, ok, detail, newSession?, resume?}`. `resume` is the command
  that opens the moved work when it could not open by itself; AC relays it
  verbatim.
- `rev` increases on every write.

### States

| State | Reached by | Terminal |
|---|---|---|
| `open` | raised | no |
| `approved` | a user approval | no |
| `executing` | agent-switch claimed the approval | no |
| `done` | the move succeeded | yes |
| `failed` | the move failed | yes |
| `declined` | a user decline | yes |
| `snoozed` | a user snooze | yes |
| `expired` | still `open` at `expiresAt` | yes |

Only agent-switch moves a request to `executing`, `done` or `failed`. AC
writes only `open` (raise) and a decision.

### Identity and deduplication

`id` is derived from `(account, session, window, resetsAt)`. Raising twice in
one limit cycle returns the existing request instead of a second one, so AC may
raise on every `hot` notice without producing noise.

`expiresAt` is the window's reset time when it is in the future, else five
hours after raising. An `open` request read after that point reads as
`expired`, written back so every reader agrees.

### First decision wins

A decision is applied only while the request is `open`. Every later decision —
from either tool — returns `applied: false` and the request with the decision
that already counts. AC reports that existing decision; it never retries to
overwrite it. This is what makes "answered in one tool" true in both.

## CLI fallback

The same operations exist as CLI verbs, for a host without an MCP client. They
return the same JSON as the tools:

| Tool | CLI |
|---|---|
| `limits_get` | `agent-switch limits [provider] --json` |
| `switch_list` | `agent-switch switch list [--all] --json` |
| `switch_status` | `agent-switch switch show <id> --json` |
| `switch_request` | `agent-switch switch request (--account provider/name \| --session provider/account/id) --by ac --json` |
| `switch_decide` | `agent-switch switch decide <id> approve [--to provider/name] [--how …] --by ac --json` · `… decline\|snooze --by ac --json` |

A CLI failure exits non-zero with the message on stderr; AC treats it as
absence for that call.

## Absence rules

Every AC reader returns `null` instead of guessing, and `null` means today's
behavior — the limit notice without a request, seat placement without a
limits pre-check:

- `agent-switch` not on `PATH`, or the discovery call times out or exits
  non-zero.
- Discovery output that does not parse, `enabled: false`, or `contract ≠ 1`.
- An MCP call that fails, times out, or returns `isError: true`, after the CLI
  fallback also failed.
- A limits account that is `stale`, or a window whose `fill` is `null`.

### The `.mcp.json` entry

Install (with `claude-code` selected) runs discovery once and acts on its answer:

| Discovery | `.mcp.json` key `agent-switch` |
|---|---|
| present | written as `{command, args}` from `mcp`, recorded in `agents/installed-tools.lock` |
| `enabled: false`, or `contract ≠ 1` | removed, when it is exactly the entry the link describes; a hand-written server under the key stays |
| binary missing, timeout, non-zero exit, unparseable output | left as it is — no answer is not a reason to remove it; an existing entry stays recorded |

The difference is deliberate: `enabled: false` and an unknown contract are
answers from agent-switch, a missing binary is often a PATH that differs
between the installer's shell and the host's. A host that then fails to start
the server only loses the link, which every reader already treats as absent.

## What this contract does not allow

- AC moving a session, choosing a target the user did not choose, or
  switching automatically on a limit.
- AC calling `switch_decide` before the user answered, or auto-allowing it.
- AC treating `version` as a capability signal.
- Either side changing a shape under contract `1`. A breaking change is
  contract `2`; until AC supports `2` it treats a `contract: 2` link as
  absent.
