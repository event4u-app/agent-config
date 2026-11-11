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
> fallback), `src/scripts/_lib/agent_switch_limits.ts` (the limits read),
> `src/scripts/_lib/switch_relay.ts` (raise, relay, best-effort checkpoint,
> used by the `quota-notice` and `session-eol` hooks) and
> `src/scripts/_lib/mcp_bridge.ts` (`.mcp.json` entry), pinned by
> `tests/scripts/agent_switch_link.test.ts`,
> `tests/scripts/agent_switch_client.test.ts`,
> `tests/scripts/agent_switch_limits.test.ts`,
> `tests/scripts/agent_switch_ask.test.ts` and
> `tests/scripts/agent_switch_link_install.test.ts`. The limits read has no
> caller yet; the seat placement that uses it comes next.

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
  as one line of at most 160 characters.
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
raise on every `hot` notice without producing noise. `resetsAt` is rounded to
the nearest minute before it names a request, because the host reports one reset
with sub-second jitter; the stored `reason.resetsAt` stays as observed. A pace
request (`reason.kind: "pace"`) adds its kind, so it never shares an id with a
limit request on the same window.

`expiresAt` is the window's reset time when it is in the future, else five
hours after raising. An `open` request read after that point reads as
`expired`, written back so every reader agrees.

### First decision wins

A decision is applied only while the request is `open`. Every later decision —
from either tool — returns `applied: false` and the request with the decision
that already counts. AC reports that existing decision; it never retries to
overwrite it. This is what makes "answered in one tool" true in both.

## What AC does with a request

The `quota-notice` hook runs on every prompt and is synchronous, so it reaches
the link over the CLI verbs below, never the MCP client.

- **Raise.** When a plan window of the session's account is `hot` or
  `exhausted`, AC raises once per `(session, account, window, resets_at)`
  (`--session provider/name/<sessionId>`), and takes the reply only when its
  `session` is the one asked for. The
  account is the label the status-line tap wrote on this session's own quota
  snapshots; a session outside any profile raises nothing. A request is named
  in the user's notice (id, up to three candidates, "answer here or in
  agent-switch"), and the model is given the id, the same three candidates
  and the instruction to call `switch_decide` only after the user answered.
- **Decide.** Only the agent, on the user's answer, through the `agent-switch`
  MCP server the install registered. `lint_mcp_config_security` fails an
  `autoApprove` / `alwaysAllow` / `permissions.allow` entry naming
  `switch_decide`, `mcp__agent-switch__switch_decide`, `mcp__agent-switch__*`
  or the whole `mcp__agent-switch` server.
- **Relay.** While the raised request is not terminal, each prompt reads it
  (`switch show`). A decision made outside the session (`by` not `ac:`) is
  reported once; `done` and `failed` are reported once, `resume` and
  `detail` as one line of at most 160 characters; a move is reported only on
  `ok: true`, `done` with `ok: false` as a failure and `done` without an
  outcome as such. A reply whose `id` is not the one asked for, whose `state`
  is not one of this contract's, or whose `decision` is present but not an
  object with one of this contract's `kind` values, is not read. In the model
  context the relayed text is labelled as data from agent-switch, never an
  instruction to act on; a decision
  `target` that is not an account and a `reason.window` that is not a window
  name are dropped. A terminal request is then forgotten — except a `done`
  move whose checkpoint is still owed, which is kept, without being reported
  again, until the Stop path has left it.
- **Hand over.** At the end of each turn the `session-eol` Stop hook reads
  the request once it is `approved`, `executing` or `done` and leaves the run
  checkpoint (a session inside a claimed run only), once it was written;
  a write that did not happen is tried again on the next Stop. The checkpoint
  is best effort and never gates a move: AC cannot hold agent-switch back,
  and a move with `how: now` can finish before this Stop runs. A checkpoint
  left after a finished move is still written, because the run checkpoint is
  the newest state of the run that whichever session resumes it reads.
- **Back-off.** Three link calls in a row that do not answer — a timeout, a
  non-zero exit or output that does not parse, on the prompt or the Stop
  path — stop the link for this session until the next reset of its plan
  windows (five hours when none is known); the user is told once. A `switch`
  call that answers resets the count; a discovery that finds the link present
  does not, since it says nothing about whether `switch` answers. The count is kept under a
  lock; a hook that was already past the check when another tripped the rest
  still finishes its own one or two calls.
- **Opt-in and off switch.** The question is off unless
  `AGENT_CONFIG_SWITCH_QUESTION=1` is set: without it there is no raise, relay
  or checkpoint and the quota notice is the one without a request.
  `AGENT_CONFIG_NO_SWITCH_QUESTION=1` stops raise, relay and checkpoint,
  including for a request raised before it was set, and wins over the opt-in;
  the quota notice stays as it was. `AGENT_CONFIG_NO_QUOTA_NOTICE=1` stops both.
  The link's code is its own lazily loaded chunk (`switch_link.chunk.cjs`): a
  prompt without the opt-in never loads it, and the Stop path loads it only for
  a session with a record. A chunk that is missing or does not match its
  digest is not loaded, and the session behaves as without agent-switch. The
  chunk and its two callers each compile a call-surface version
  (`SWITCH_LINK_API` in `_lib/switch_record_path.ts`), and the chunk answers only a caller of the
  same version, so a chunk built against another call surface is not called
  even when its digest matches. That is API compatibility, not build identity,
  and loading the chunk to ask runs only its module body, which defines
  functions and does nothing else. A
  Stop that cannot load it writes nothing and leaves an owed checkpoint for the
  next Stop.
- **One record per session** under the user-global quota state holds the
  request id and what was told; it is the only state AC keeps about a request.
  It expires a day after the request's `expiresAt` and never later than seven
  days after it was raised. An expired record is no longer polled by the prompt and
  nothing is raised over it; the Stop path forgets it once nothing is owed — its
  checkpoint was written, or the request reached a state that owes none — and
  keeps it while a write fails, a lookup gets no answer or the link rests. A
  record left eight days is pruned, by the next raise anywhere or by its own
  session's next prompt. The prompt
  relay and the Stop path change it under a lock, each only its own flag on the
  record as it is then, so neither undoes the other's and a deleted record
  stays deleted. Each relayed line is claimed under that lock before it is
  shown, so two prompts running at once show it once in normal operation; a
  prompt that dies after its claim loses that line. A raise never replaces a record that is
  still there. The run checkpoint is built and written while the record lock is
  held, so Stops write in order and one that finds the obligation completed
  meanwhile does not write an older snapshot over it; a Stop that cannot take
  the lock writes nothing. The record is forgotten only after a write that
  reported success; a write that fails, throws or is cut short leaves the
  obligation for the next Stop. The lock is a set of tickets: each contender
  creates its own file `<record>.lock.<pid>.<time>.<random>`, then lists the
  tickets, removes every breakable one, and holds the lock only when no other
  ticket is left and it can also take `<record>.lock`; otherwise it removes its
  own and retries after a random pause. A ticket is only ever removed by its
  own unique name, so breaking an abandoned one cannot remove a successor's,
  and two contenders cannot both hold: each lists after creating, so the later
  lister sees the earlier ticket. A ticket is breakable when its process has
  ended, when it names no process and is older than two seconds, or when the
  process now under its pid has run for less time than the ticket exists, read
  from `ps -o etime=`, which means the pid was reused. A live holder's ticket
  is never broken, however slow or suspended the holder is, so it cannot lose
  its exclusion and publish an older snapshot after a successor's; a waiter
  gives up after about a quarter of a second and leaves the work to the next
  hook. Where `ps` cannot be read, as on Windows, a running process under the
  ticket's pid counts as its holder, so a crashed holder whose pid was reused
  keeps the lock until that process ends: the link then writes nothing for
  that record meanwhile. Two contenders that collide both back off, so under
  contention an update can be skipped; it never runs under two holders at once.
  `<record>.lock` is the path the version before tickets (20.2.0) used as its
  single lock file. This version holds it as a directory with one entry named
  by the holder's token. That version creates the file exclusively, which
  fails while the directory is there, and breaks a stale one with a plain
  removal, which fails on a directory, so a hook of that version still running
  across an install or a rollback can never take the lock from a holder of
  this one. Only the ticket holder takes, removes or reaps `<record>.lock`. It
  reaps one whose holder is gone by moving it aside and removing it only if it
  still names that holder; a file a hook of the older version took in between
  is linked back. What remains between versions is the older version's own
  check-then-remove: two hooks of 20.2.0 can still both hold, as they can with
  no hook of this version running, and only while they run (see Install and
  rollback). Process liveness is read in the caller's process-id namespace,
  so hooks of one state directory running in different namespaces (a
  container sharing the host's home) are not covered. The lock is advisory:
  it binds only the hooks that take it. The code holding it reads and writes
  files only: the record, the back-off count, and the checkpoint build and
  write; every agent-switch call runs outside it. An unwritable state
  directory keeps no back-off count, so the link does not rest there. Record
  and back-off files and tickets of ended holders no session has touched for
  eight days are removed when a request is raised; `<record>.lock` is left to
  the next ticket holder.

### Install and rollback

Only a hook process started from 20.2.0 can still use the single lock file.
Its two hooks of one session can both hold when one is slower than two
seconds, so around an install or a rollback the link can write an older
checkpoint over a newer one only while a hook of 20.2.0 runs.

- **Install over 20.2.0.** Nothing to drain: once the last hook started from
  20.2.0 has exited, no process uses the single lock file.
- **Rollback trigger.** Roll back when one of these is seen, and the
  maintainer who sees it acts on it: a resumed run whose checkpoint is older
  than one already written for it (its `written_at` goes back), or a record
  whose owed checkpoint stays unwritten across Stops while `<record>.lock` or
  a ticket names a process that is not a hook of this package. Either is
  read from the files under the quota state directory's `switch/`; there is
  no automatic detector.
- **Rollback to 20.2.0.** Install 20.2.0, wait until the hooks started from
  this version have exited (a Stop of either version finishes within its
  host's hook timeout), then remove every `*.lock` directory and every
  `*.lock.*` ticket under `switch/`. 20.2.0 cannot remove a directory at
  `<record>.lock`, so a holder of this version that crashed would otherwise
  keep that record locked for 20.2.0, which then writes nothing for it.

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
