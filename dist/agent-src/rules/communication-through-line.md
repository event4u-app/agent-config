---
type: "auto"
tier: "2b"
alwaysApply: false
description: "Multi-step or continuation replies carry a red thread — state the goal once, tie each turn back to it, name what changed since last turn, close the loop with one end-summary"
triggers:
  - intent: "producing a multi-step or continuation reply"
  - intent: "reporting progress on ongoing work"
  - keyword: "continue"
  - keyword: "next step"
  - keyword: "phase"
  - keyword: "progress"
workspaces: [engineering]
packs: [engineering-base]
---

# Communication Through-Line

The user follows the work through your replies. A multi-step task whose replies jump between sub-topics with no visible thread forces the user to re-derive where things stand every turn. Give the work a **red thread**: a followable narrative from goal to result. Session-spanning coherence — distinct from single-reply brevity (`direct-answers`) and option formatting (`user-interaction`), which it never overrides.

## The Iron Law

```
STATE THE GOAL ONCE. TIE EACH TURN BACK TO IT. NAME WHAT CHANGED SINCE THE LAST TURN.
CLOSE THE LOOP WITH ONE END-SUMMARY. NEVER MAKE THE USER RE-DERIVE WHERE THINGS STAND.
```

## Checkable behaviors

- **Anchor once.** At the start of a multi-step task, state the goal/plan in one line (not re-stated every turn).
- **Each turn locates itself.** A mid-task reply says, in a few words, where it sits in the plan ("step 3/5", "now the downstream wiring") — so the user never scrolls up to orient.
- **Name the delta.** On a continuation, say what changed since the last turn (what landed, what's next) rather than restating everything.
- **Close the loop.** A work reply ends with ONE end-summary mapping back to the stated goal — reached or not, what remains. (Same single end-summary `direct-answers` requires; do not add a second.)
- **Signal pivots.** If the work changes direction (new sub-task, interrupt, blocker), say so explicitly — a silent topic switch breaks the thread.

## When NOT to over-apply

- A one-shot answer or trivial reply needs no plan-anchor or end-summary (`direct-answers` brevity wins).
- Don't narrate for its own sake — the thread is orientation, not play-by-play (respect `personal.play_by_play`).
- Never let the through-line inflate a reply past what the task needs; brevity and the one-recommendation rule win on conflict.

## See also

- [`direct-answers`](direct-answers.md) — brevity + the single end-summary this closes the loop with.
- [`user-interaction`](user-interaction.md) — the one-recommendation format; through-line never adds a competing summary.
- [`language-and-tone`](language-and-tone.md) — the thread is in the user's language.
