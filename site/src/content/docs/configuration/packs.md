---
title: Skill sets for your role
description: Agent Config groups its skills into sets for a role or domain — Laravel, React, finance, marketing and more — so your AI tool gets the ones you use, not the whole catalog.
---

See which skill sets are active here, and which file switched them on:

```bash
npx -y @event4u/agent-config packs:active
```

## What a skill set is

Skills, rules and commands are grouped into sets — called **packs** in the settings — for a role or a domain: `engineering-base`, `git`, `laravel`, `react`, `frontend-design`, `product-basic`, `finance-basic`, `gtm-marketing`, `founder-strategy` and others. Your [role profile](/agent-config/getting-started/choose-a-profile/) picks a starting set.

List them all:

```bash
agent-config packs ls
```

## Why it matters

On tools without a way to hide skills, a new install ships a reduced, role-scoped skill set instead of the whole catalog; Claude Code and Codex get every skill and show them by visibility instead. <!-- claim:default-install-context-cost --> Fewer skills in front of the agent means less to read on every task.

## Add a set for one session

```text
/profile activate finance
```

This narrows what is suggested in the current session only. To change the sets you install with, rerun the setup wizard:

```bash
agent-config setup
```

## Next

- [The four profiles](/agent-config/configuration/profiles/)
- [The settings file](/agent-config/configuration/overview/)
