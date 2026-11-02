---
model_tier: high
name: challenge-me-founder
pack: product-reasoning
visibility: internal
cluster: challenge-me
sub: founder
produces_roadmap: true
skills: [founder-idea-interview]
description: "Founder interview — from hobbies, ideas and everyday problems to a researched roadmap, then prototype, business plan and deck asked one at a time."
argument-hint: "[seed]"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - founder
  - product
packs:
  - product-reasoning
---

# /challenge-me founder

> Interview a founder from what they care about to a roadmap they can start on.
> Thin entry: the procedure lives in the
> [`founder-idea-interview`](../../skills/founder-idea-interview/SKILL.md) skill.

## Welcome

If invoked with no body, render once:

```
Tell me what you do for fun, an idea you keep coming back to, or a problem
that costs you time every week. I ask one question per turn, research the
market, competition and willingness to pay myself, and we end with a roadmap.
After that I ask — one at a time — whether you want a prototype, a business
plan, or a deck.
```

Skip the welcome when a seed follows the command.

## When NOT to use

| Phrasing | Route to |
|---|---|
| "challenge me on this plan" (a plan already exists) | `/challenge-me vision` |
| "close the open decisions in this roadmap" | `/challenge-me closure` |
| "write our internal vision" | `vision-articulation` skill |

## Steps

1. Load [`founder-idea-interview`](../../skills/founder-idea-interview/SKILL.md)
   and follow its `## Procedure` from §0 with the seed.
2. The in-interview triggers of [`/challenge-me vision`](vision.md) apply in
   the grilling stage (§3); `!pitch` there still continues to the roadmap,
   because this command always ends in one.
3. Hand back only after the roadmap exists, the closure pass ran, and the
   follow-up asks were offered — prototype, then business plan, then deck,
   one per turn.

## Closure — every roadmap this command produces

```
THIS COMMAND PRODUCES A ROADMAP, SO IT ENDS IN CLOSURE.
NEVER HAND BACK A PLAN CARRYING A DECISION PLANNING COULD HAVE CLOSED.
```

Declared by `produces_roadmap: true` in the frontmatter and enforced by
`lint_roadmap_producers`. Read `planning.closure_pass` (missing = `true`). When
active, run `/challenge-me closure` on the roadmap before the follow-up asks:

```bash
./scripts-run src/scripts/closure_scan <roadmap-path>
```

## Rules

- **One question per turn**, numbered options, one recommendation line — per
  [`ask-when-uncertain`](../../rules/ask-when-uncertain.md) and
  [`user-interaction`](../../rules/user-interaction.md).
- **Frame, never decide** — per
  [`strategy-safety-floor`](../../rules/strategy-safety-floor.md); business-plan
  figures per [`finance-safety-floor`](../../rules/finance-safety-floor.md).
- **No execution** — the roadmap is the artefact; building the prototype needs
  an explicit execution verb on a later turn.
- **Mirror the user's language**; trigger syntax stays literal.
