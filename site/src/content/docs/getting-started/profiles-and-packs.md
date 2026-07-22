---
title: Profiles & Packs
description: Pick your experience profile and opt into capability packs — the quick view; see Configuration for the full disambiguation.
---

## Pick your experience

The setup wizard's first question sets your **experience profile**
(`profile.id`) — an audience-shaped entry path that pre-selects a focused
command set, first skills, and personas:

| `profile.id` | Audience |
|---|---|
| `developer` (default) | IC engineer |
| `founder` | Solo / early-stage founder |
| `content_creator` | Writers, ghostwriters, marketers |
| `agency` | Multi-client delivery shop |
| `finance` | CFO / FP&A |
| `ops` | RevOps / support / SRE-adjacent |

Switch later with `agent-config use --profile=<id>`.

> **Three different things are called "profile".** The *experience profile*
> above is distinct from the *cost / discipline profile* (how much governance
> loads) and the ephemeral *session profile*. They are disambiguated in full on
> the [Configuration → Profiles](/agent-config/configuration/profiles/) page —
> read it before you tune anything, to avoid conflating them.

## Packs

A **pack** is an opt-in capability bundle (a frontmatter tag, not a directory) —
e.g. `engineering-base`, `git`, `php`, `laravel`, `finance-basic`,
`founder-strategy`. Install is **pack-scoped**: only your active packs are
written, not the whole library. Workspaces group related packs.

Packs and workspaces, the discovery frontmatter that drives them, and how they
scope the projected surface are covered in
[Configuration → Packs & Workspaces](/agent-config/configuration/packs/).
