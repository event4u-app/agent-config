---
title: Agent Config for Claude Desktop
description: Claude Desktop does not read skills from disk — init builds one ZIP per skill and command, and you upload the ones you want under Settings, Customize, Skills.
---

Build the bundles, then upload the ones you want in Claude Desktop:

```bash
npx -y @event4u/agent-config init --yes --global --tools=claude-desktop
```

## What lands where

- `~/.event4u/agent-config/claude-desktop/bundles/` — one ZIP per skill and per command.
- `~/Library/Application Support/Claude/agent-config.md` — a note naming the bundles folder and repeating the upload steps.

Running it again rewrites only the bundles whose content changed.

## Upload

1. Open Claude Desktop → **Settings** → **Customize** → **Skills**.
2. Click **Upload** and pick ZIPs from `~/.event4u/agent-config/claude-desktop/bundles/`.
3. Switch each uploaded skill **On** — the switch, not the upload, is what Claude Desktop checks.
4. Quit Claude Desktop fully and reopen it. Type `/` in a new conversation to see the skills.

## Can it block?

No. Skills are instructions the model follows; Claude Desktop runs no hooks.

## Limits

- Only skills and commands travel in bundles; the always-on rules do not.
- There is no automatic update: after `agent-config upgrade`, upload the changed bundles again.
