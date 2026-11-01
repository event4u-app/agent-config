---
title: "Security audit for your dependencies, your code and your AI agents"
description: /audit checks advisories for what your project uses, hunts security holes in your own code with a proof test per finding and lists what the AI agents and bots in your project can do.
---

Ask for the advisories that affect what your project uses:

```text
/audit deps
```

## What it does

`/audit` runs three audits:

- **`/audit deps`** — advisories, malware reports, end-of-support dates and announced security releases for your lockfiles, runtimes, container images and CI actions. It sorts findings by how urgently they need action, and `/audit deps fix <id>` carries one finding through to a verified change.
- **`/audit code`** — security holes in your own code. Each candidate is confirmed by a failing test that a second agent wrote, so a finding comes with its proof.
- **`/audit agents`** — what the AI agents, bots and MCP servers in your project can do, and which of their actions nobody declared.

Before you build something sensitive, `/threat-model` walks the abuse cases, trust boundaries and missing permission checks of a proposed change. And `/security-audit-config` checks your AI tool configuration itself — rules, MCP servers, hooks — for prompt-injection and supply-chain risk.

## When to use it

- Weekly, or when a dependency advisory makes the news: `/audit deps`.
- Before a launch or after a big change to login, payments or permissions: `/audit code`, preceded by `/threat-model`.
- When you add an agent, bot or MCP server to the project: `/audit agents`.

## Example

```text
/audit deps
/audit deps fix CVE-2026-12345
```

Every finding names the file and line it came from, so you can check it before anything changes.

## What it needs

- Any [supported AI coding tool](/agent-config/tools/overview/).
- For `/audit deps`, network access when it refreshes: the names and versions of your **public** packages go to the OSV advisory database, and runtime lifecycle data comes from endoflife.date. Private package names are never sent. Set `advisories.egress: none` to send nothing. [What leaves your machine](/agent-config/trust/network/).

## Limits

- A security audit by a model finds what a careful reviewer finds; it is not a penetration test.
- With `advisories.egress: none`, findings read "unknown", never "clear".
