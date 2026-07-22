---
title: Profiles
description: Four distinct things are called a "profile" in agent-config — experience, cost, discipline, and session. This page disambiguates them.
---

**Four distinct concepts share the word "profile".** Conflating them is the most
common configuration mistake — always use the qualified name.

## 1. Experience profile (`profile.id`)

*Who* you are — an audience-shaped entry path set by the wizard's first
question. Pre-selects a focused command set, first skills, and personas.

| `profile.id` | Audience |
|---|---|
| `developer` (default) | IC engineer |
| `founder` | Solo / early-stage founder |
| `content_creator` | Writers, ghostwriters, marketers |
| `agency` | Multi-client delivery shop |
| `finance` | CFO / FP&A |
| `ops` | RevOps / support / SRE-adjacent |

Switch with `agent-config use --profile=<id>`. The seed set is fixed for v2.x;
a seventh requires an ADR.

## 2. Cost profile (install `--profile=`)

*How much* governance loads, chosen at install time — `minimal | balanced |
full`. Maps onto the legacy `rule_loading_tier` setting.

## 3. Discipline profile (`discipline_profile`)

The **successor** runtime knob (ADR-110), which wins over `rule_loading_tier`
when set:

| Value | Rule surface | Relative token footprint |
|---|---|---|
| `off` (legacy `minimal`) | Kernel only (9 Iron-Law rules) | ~1× |
| `essential` | Kernel + lift-carrying rules | ~3.3× |
| `full` | Kernel + tier-1 + tier-2 (everything) | ~11.7× (experimental) |
| `auto` | Resolved per session vs host capabilities | varies (default) |

> `balanced` was retired 2026-07-07 (measured null lift); existing settings map
> to `essential`. The safety floor ships in **every** value — only the extra
> coaching changes.

## 4. Session profile (`/profile activate`)

An **ephemeral** pack-surface view for the current session —
`/profile activate <name>` (e.g. `developer`, `finance`, `content`). Writes
`runtime.active_packs` to a gitignored local file; it biases recommendations and
never blocks execution. Unrelated to the install `--profile` flag.

## Quick disambiguation

| You want to… | Use |
|---|---|
| Change who the agent is tuned for | **experience profile** (`profile.id`) |
| Change how much governance loads | **discipline profile** (`discipline_profile`) |
| Temporarily narrow the pack surface | **session profile** (`/profile activate`) |
