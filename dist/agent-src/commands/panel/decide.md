---
model_tier: high
name: panel-decide
pack: engineering-base
visibility: internal
cluster: panel
sub: decide
skills: [subagent-orchestration]
description: Put open decisions in front of independent judges with fixed lenses; one synthesis tallies the votes, keeps the dissent and adds no preference
argument-hint: "[points file | plan section] [--lenses practice,theory,system,skeptic]"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via /panel or its explicit name; spend-bearing fan-out."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /panel decide

## Instructions

### 1. Frame the points

Write each open point as `{ id, title, text, files }`: the question, the options
on the table (at least the current plan position and the challenger), and the
files a judge must read to decide it. Write the shared context once — product,
audience, constraints — in a paragraph every judge receives. Points that are pure
taste or business meaning stay in, but judges may flag them `owner_only`.

### 2. Pick the lenses

Default four, each a **role with a stake**, not an adjective:

| Lens | Judges as |
|---|---|
| practice | the person who has to run it day to day — what is usable, maintainable, affordable |
| theory | the domain expert — what is methodically correct, what distorts |
| system | the architect — data model, reproducibility, staging, testability, cost to support |
| skeptic | attacks every position, then still commits to the least bad one |

Replace a lens when the domain needs another one (security, framework, legacy
migration); keep four unless the user asks otherwise — four makes a 3-of-4
majority meaningful.

### 3. Dispatch points × lenses in parallel

One agent per (point, lens). Each gets the context, its lens, the one point, the
files (read-only), and returns **only** this structure:

```json
{
  "choice": "<one option id, or hybrid>",
  "hybrid_spec": "exact rule, stage and default if hybrid; else empty",
  "reason": "two or three sentences",
  "risk": "the main risk of this choice",
  "reversal_condition": "what observation would reverse it",
  "plan_gaps": ["concrete gaps in the plan text, with file and section"],
  "owner_only": false,
  "confidence": "high | medium | low"
}
```

The judge must read the cited sections before voting and decides **this point
only**. Report `K/N votes returned`; a missing vote is never invented.

### 4. Synthesis — one agent, counts and does not opine

Input: all votes plus the files. Per point:

- **tally** (e.g. `keep_plan 3, hybrid 1`);
- **verdict**: the option with ≥ 3 of 4 (or a strict majority for another lens
  count); hybrids that differ materially do not add up; otherwise `no_consensus`;
- **rule**: the exact text that would go into the plan, with stage and default;
- **dissent**: the minority position in one sentence;
- **plan_gaps**: merged and deduplicated, dropping any the files already close;
- **owner_only**: true when the judges say technical merit does not decide.

Then list **conflicts between points** (a choice in one that changes the meaning
of another). The synthesis adds no preference beyond the votes and the files.

### 5. Report

A table per point — verdict, tally, rule, dissent — then the conflicts, then the
`no_consensus` and `owner_only` points as **one** numbered-options question for
the user. Change no file before the user decides.
