# Host traffic environment variables

> **Status:** reference · contract-shaped output of
> `road-to-host-traffic-knobs-that-ship`. This page **documents** and
> `agent-config doctor --json` **reports**. Neither writes a value into
> anybody's environment, and no default here is flipped by this package.

A developer on a metered, air-gapped or policy-restricted link needs to know
which host environment variables suppress non-essential network activity —
and, just as much, which ones do **not**, because a variable that looks like a
traffic switch and is not one produces a false sense of quiet.

These are **third-party** variables. Their meaning is set by the host vendor on
the vendor's own release schedule, and nothing in this package can observe that
meaning changing. Every row below therefore carries the host version it was
checked against and the date it was checked.

```
A ROW WITH NO `CHECKED AGAINST` DATE IS UNVERIFIED AND MUST BE TREATED AS
UNVERIFIED — NOT AS A FACT THAT SIMPLY LOST ITS DATE. RE-CHECK IT AGAINST YOUR
OWN HOST BEFORE ACTING ON IT.
```

## How these rows were established — the measurement unit

The rows are not quoted from a vendor document and not recalled from memory.
Each one was read out of the **shipped host binary at a pinned version**, by
locating the code that reads `process.env.<NAME>` and following the branch that
value controls. One row = one named variable whose effect was traced to at
least one named branch in that binary.

Reproduce it — the same three commands produce the same readings:

```bash
claude --version                                     # pins the version a row is about
strings -n 6 "$(npm root -g)/@anthropic-ai/claude-code/node_modules/@anthropic-ai/claude-code-darwin-arm64/claude" > /tmp/cc.strings
grep -oaE ".{200}CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC.{200}" /tmp/cc.strings
```

The binary name carries the platform triple, so a non-macOS or non-arm64
machine substitutes its own (`claude-code-linux-x64`, …). What the method
cannot do is establish that a branch is *reached* in your configuration — it
establishes what the variable is wired to, which is the claim each row makes
and the only one it makes.

## The rows

Checked against **Claude Code 2.1.284** on **2026-09-29** unless a row says
otherwise.

### `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`

| | |
|---|---|
| **Governs** | Set to any non-empty value, the host's traffic posture resolves to `essential-traffic`, and that one posture gates several separate behaviors: telemetry and analytics, crash/error reporting, the `/bug` and `/feedback` commands (which refuse with a message naming this variable), plugin-archive downloads, and `/design-sync` and Projects. **It also disables background auto-updates** — the host's update-disabled-reason resolver returns this variable as its third rung, after `DISABLE_UPDATES` and `DISABLE_AUTOUPDATER`. |
| **Does NOT govern** | Request *size*. It leaves `BASH_MAX_OUTPUT_LENGTH` and `MAX_MCP_OUTPUT_TOKENS` at their defaults, so the payload of a model request is unchanged. It does not block an explicitly invoked `claude update`; only the background update path is affected. It is not a proxy, offline or airplane mode — essential traffic, the model API calls themselves, still goes out. |
| **Checked against** | Claude Code 2.1.284 · 2026-09-29 |

### `DISABLE_AUTOUPDATER`

| | |
|---|---|
| **Governs** | Background auto-updates only. It is the second rung of the same update-disabled-reason resolver, ahead of the blanket variable above. A legacy `autoUpdates: false` preference in the host's own config is migrated into this variable inside the user's settings `env` block, so it can be set without anyone having exported it in a shell. |
| **Does NOT govern** | Anything else. It leaves telemetry, error reporting, `/bug`, `/feedback`, plugin downloads and every other non-essential call running — it is the narrow knob, not the blanket one. It does not block an explicitly invoked `claude update`. |
| **Checked against** | Claude Code 2.1.284 · 2026-09-29 |

### `BASH_MAX_OUTPUT_LENGTH`

| | |
|---|---|
| **Governs** | The character cap on Bash tool output the host places inline into a model request. Default `30000`. A non-numeric or non-positive value falls back to that default; a value above `150000` is capped to `150000`. A `bashOutputMaxChars` setting, where one is set, wins over this variable entirely. |
| **Does NOT govern** | Whether any network request happens. It bounds request **size**, never request **count** — lowering it does not reduce how many calls are made, and it suppresses no telemetry, no update check and no download. Treating it as a traffic switch is the specific mistake this row exists to prevent. |
| **Checked against** | Claude Code 2.1.284 · 2026-09-29 |

### `MAX_MCP_OUTPUT_TOKENS`

| | |
|---|---|
| **Governs** | The token cap on a single MCP tool result the host places into a model request. Default `25000`; a value of zero or less, or an unset variable, falls back to that default (or to a remote-config value where the host has one). |
| **Does NOT govern** | MCP server connections, MCP timeouts (`MCP_TIMEOUT`, `MCP_TOOL_TIMEOUT`, `MCP_CONNECT_TIMEOUT_MS`), or whether a tool runs at all. Same size-not-count caveat as the row above. |
| **Checked against** | Claude Code 2.1.284 · 2026-09-29 |

## A correction this page carries, stated rather than absorbed

The roadmap that commissioned this page was built on a supplied proposal whose
own later revision **retracted** the claim that the blanket
non-essential-traffic variable also disables the auto-updater, and asserted the
two were independent. Measured against Claude Code 2.1.284 on 2026-09-29, that
retraction is **wrong**: the blanket variable is the third rung of the
update-disabled resolver, so setting it *does* stop background auto-updates.

The rows above carry the measured mapping, not the retracted one. The
discrepancy is recorded here rather than silently resolved, because the
direction of the error is the dangerous one: a reader who believed the
retraction would set the blanket variable to quiet telemetry on a metered link
and would, without being told, also stop receiving background updates.

**What to do about it, whichever reading later turns out to hold on your host:**
set each behavior's own narrow variable explicitly rather than relying on one
variable's fan-out. If you want telemetry off and updates on, do not assume the
blanket variable leaves updates alone — check `agent-config doctor --json`
against your own host, and prefer `DISABLE_TELEMETRY` for the narrow effect.

## Reading the observed state

`agent-config doctor --json` emits a `traffic_environment` section carrying one
row per variable above: whether it is set, its value when it is, and — on a
host where the variable has no documented meaning — the literal state
`not applicable on this host`. A row is never omitted, because a short clean
section reads as a clean bill of health and would be exactly the wrong signal.

`doctor` reports; it does not write. Two consecutive runs leave the environment
and every settings file byte-identical.

## What this package deliberately does not do

It does not write any of these variables into a consumer environment. Doing so
would change behavior the consumer never asked to change and — under the
mapping measured above — could switch off their background security updates as
a side effect of a telemetry preference. Whether a settings profile may ever
write them is an owner decision, recorded as the open blocker
`traffic-profile-writes-consumer-environment` on the roadmap named at the top
of this page.

## See also

- [`enterprise-and-offline.md`](enterprise-and-offline.md) — installing where the public registry is unreachable.
- [`../contracts/harness-expectations.md`](../contracts/harness-expectations.md) — other host behaviors that look like bugs and are not.
