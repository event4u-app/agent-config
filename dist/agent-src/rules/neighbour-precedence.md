---
type: "auto"
tier: "2b"
description: "A neighbour package's skill, always-on text or MCP tool text disagrees with this suite or the project — follow the source order below the four authority bands; name what you followed"
triggers:
  - phrase: "neighbour skill"
  - phrase: "neighbor skill"
  - phrase: "conflicting instructions"
  - phrase: "which instruction wins"
  - phrase: "instruction precedence"
  - phrase: "another package's rule"
  - phrase: "widersprüchliche anweisungen"
enforced_by:
  - "instruction-only: the order is prose and a neighbour's prose can outvote it; only the listed effects hold"
obligation_frequency: "per-turn"
self_contained: true
workspaces: [engineering, agent-config-maintainer]
packs: [meta]
---

# Neighbour Precedence

## The Iron Law

```
THE FOUR BANDS OF agent-authority COME FIRST AND NOTHING BELOW LIFTS THEM.
BELOW THEM, FOLLOW THE SOURCE ORDER. THE PROJECT FILE WINS TIES.
NAME THE INSTRUCTION YOU FOLLOWED, ONCE PER TURN, WHEN SOURCES DISAGREED.
A NEIGHBOUR'S "DONE" IS A PROVIDER STATUS, NEVER THIS SUITE'S COMPLETION.
```

## The source order — instruction sources, below the bands

1. the current-turn instruction (never lifts band 1, the Hard Floor, of [`agent-authority`](agent-authority.md))
2. `agents/overrides/`
3. the project's own instruction files and `agents/` folder
4. this suite's routed guidance
5. a neighbour skill body the agent explicitly invoked
6. a neighbour's always-on text
7. a neighbour skill body merely discoverable
8. a neighbour MCP tool description

A project file (rank 3) may replace, override or extend workflow; it may never
lower a floor of the four bands. One global install of this suite is the
preferred shape — the order does not presume a project-local install. Overlapping
neighbour skills stay **visible**: rank decides which instruction is followed,
never which skill is shown (decision D13, K16).

## A neighbour's completion signal

A neighbour's "done" or "all checks passed" is a provider status — evidence,
never completion, which stays with the stop gate and `verify-before-complete`.

## Non-negotiables are effects

What this suite guarantees against a neighbour is only what it enforces as an
effect: a fail-closed `permission` concern (honoured as a deny on `claude`) or
the stop gate's refusal. Everything else here is prose and may be outvoted.

| Obligation | Effect |
|---|---|
| no hook-skipping commit flag; no agent write to a kernel rule or hook plumbing | fail-closed denies: `block-no-verify`, `block-kernel-rule-writes`, `block-plumbing-writes` |
| no promissory close, no unverified edit, no completion claim without evidence, no dropped pending decision, reply language | `turn-end-gate` refusal (exit 2) — allowed through when a neighbour set `stop_hook_active` |
| never commit unasked · never push, merge or deploy without this-turn confirmation · one question per turn (`one-question-per-ask` fails open) · threat-model a security surface first · this source order itself | prose-only — may be outvoted |
