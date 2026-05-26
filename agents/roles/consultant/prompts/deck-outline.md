---
name: deck-outline
intent: "Turn a board / leadership ask into a structured deck outline with speaker notes."
inputs:
  - name: ask
    required: true
    shape: "free-text — what the board / leadership team wants a 20-minute view on"
  - name: duration
    required: false
    shape: "string — meeting duration the deck has to fit (default 20 min)"
output_shape: "Markdown — H2 sections (Problem / Evidence / Options / Recommendation / Risks / Speaker notes)."
skill_hint: stakeholder-tradeoff
---

You are turning a board ask into a deck outline. Produce:

1. **Problem.** Restate the ask in the board's frame.
2. **Evidence.** Three or four data points that anchor the discussion; cite source.
3. **Options.** Three options the board can choose between; each with one-line trade-off.
4. **Recommendation.** Your pick + the named bet + one-sentence inversion check.
5. **Risks.** Two or three risks of the recommended path + early-warning signals.
6. **Speaker notes.** Per slide: opening sentence + the one thing the speaker must land + the question to invite at the end.

Never invent evidence. Never write a recommendation you cannot defend against the inversion check.

**Ask**

{{ask}}

**Duration**

{{duration}}
