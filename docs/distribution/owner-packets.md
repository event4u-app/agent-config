# Owner packets — listings only the owner can submit

> Field values for every Tier C target in
> [`registry-submissions.md`](registry-submissions.md) § Planned targets. A
> login, an identity check, or a humans-only rule makes the owner the only one
> who can submit these; the values are staged here so a submission is a paste,
> not a drafting exercise. Nothing here is a secret. After a submission, add a
> tracking row to the ledger (rule 2) — this file never records an outcome.
>
> Before pasting, re-read each target's own submission rules: a rule that
> changed since 2026-10-24 stops that submission.

## Shared values

| Field | Value |
|---|---|
| Name | `agent-config` |
| Repository | `https://github.com/event4u-app/agent-config` |
| Website | `https://event4u-app.github.io/agent-config` |
| npm package | `@event4u/agent-config` |
| Full install | `npx -y @event4u/agent-config init` |
| MCP server start | `npx -y @event4u/agent-config mcp-server` (read-only, stdio, no API key) |
| Contact | the `author.email` in `package.json` |
| License | MIT |
| Logo (square) | `assets/logo-400.png` (400×400) |
| Short description | Governed skills, rules and commands for AI coding agents, served by a read-only MCP server. |
| Data handling | Install telemetry is off by default and opt-in per install session; raw events are kept 14 days ([`telemetry-privacy.md`](telemetry-privacy.md)). The MCP server is read-only; its call log is opt-in and written to a local file under `agents/runtime/mcp-telemetry/`, never sent anywhere. |

## agentskill.sh

- Route: the site's "Analyze & Import" with the repository URL above.
- Optional: a push webhook to `https://agentskill.sh/api/webhooks/github`
  (content type `application/json`, push events only) — a repo-admin act;
  without it the site's daily sync applies.
- Expect: the install-pointer skill. The suite's other skills live under
  `src/skills/` and are not in a layout a skills crawler reads.

## awesome-claude-code

The list accepts recommendations from human submitters only, through its web
issue form.

- Resource name: `agent-config`
- Link: the repository URL above
- Category: the form's closest fit for a rule, skill and command suite;
  its category list was not read for this packet.
- Description: A governed library of skills, rules and commands for Claude Code
  and other coding agents, installed with one command; every rule is projected
  into each host's native format, and a read-only MCP server exposes the
  catalogue.

## Cursor Marketplace

Not ready: the marketplace takes a Cursor plugin manifest, and none exists yet.
The shape is settled — the same discovery plugin as `.github/plugin/plugin.json`
(read-only MCP server + install pointer, no hooks, version-pinned). Once that
manifest is in a release: submit the public repository link at
`cursor.com/marketplace/publish`; every update is reviewed again.

## GitHub MCP Registry

Only after the official MCP Registry lists the package (ledger row 4
`accepted`) and a search of `github.com/mcp` a week later does not find it:

- To: the partnerships address GitHub's MCP Registry announcement names
- Subject: Inclusion request — `io.github.event4u-app/agent-config`
- Body: The server is published in the official MCP Registry as
  `io.github.event4u-app/agent-config` (npm `@event4u/agent-config`, stdio,
  read-only). We would like it to appear in the GitHub MCP Registry.

## Claude community marketplace — gated

Not submittable while the Claude plugin is a bootstrap shim; see
[`registry-submissions.md`](registry-submissions.md) § Claude plugin
directories.
