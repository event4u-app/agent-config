---
model_tier: high
name: arena
argument-hint: "[task | --tier S1..S4 | --n N]"
pack: engineering-base
intent: "Let competing solutions to one task fight it out in a resumable bracket whose losses a paid jury can vote back in"
routes_to: [judge-bracket]
replaces: []
visibility: advanced
cluster: arena
skills: [subagent-orchestration]
description: Run an arena — competing solutions in script-scored matches, default 10 lines, an eliminated idea can come back at most twice
suggestion:
  eligible: false
  rationale: "Spend-bearing fan-out; explicit invocation only, or offered once after dissatisfaction."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /arena

Several lines solve the **same** task, meet in pairwise matches, and a lost match
can be appealed — an eliminated idea may come back at most twice. AC sizes the run
(default 10 lines, 100 only for owner-reserved or explicitly "extremely important"
questions); a script, not a judge's prose, computes every score.

`/arena` is the visible name of the bracket route of `do-competitively`. It runs
the **same engine and the same procedure** as `/judge bracket` — read and follow
[`/judge bracket`](judge/bracket.md) step by step; nothing here changes it. The
driver is `agent-config bracket <sub>`, which works in any project.

## Examples

```text
/arena "make the CSV import resumable after a crash"   # default S1: 10 lines, ≤ 55 calls
/arena --tier S2 "pick the caching strategy for the price API"   # 20 lines
/arena --n 4 "rewrite this regex without backtracking"   # small run, 4 lines
```

**Why it works:** (`outcome-not-steps`) every line solves the same task, so the matches compare
solutions rather than opinions — and a loss that looks wrong can be appealed
instead of silently ending a good idea. Each line is dealt a distinct approach
angle, so the field differs in method instead of collapsing into near-duplicates,
and the driver writes every attack, defence and judge brief, so no match is
judged on a question the orchestrator improvised.

## When to use which

| You want | Use |
|---|---|
| Several **solutions** to one task, compared, best one surviving | `/arena` |
| Independent judges voting on **decisions** or verifying **findings** | `/panel decide` / `/panel review` |
| A second opinion from **other model families** | `/council` |

## Seats

- Subscriptions first. A resolvable API key is not consent to spend: a metered
  seat joins only when no subscription seat for that family exists or the user
  configured it.
- With agent-switch linked, seats spread across the logged-in profiles; the
  bracket never picks an account itself.
- The appeal card is decided by paid seats only. In the default shadow mode a
  jury of ≥ 2 paid families votes on every appeal and its vote is **recorded,
  not used**; the single paid card seat still decides. The vote becomes binding
  only when the pre-registered claim `paid-appeal-jury` is backed.

## Rules

- Never call a same-model fan-out a council.
- Never let a free route carry a match verdict or play the card.
- Never apply the winner — report it.
