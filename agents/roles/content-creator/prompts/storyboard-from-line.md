---
name: storyboard-from-line
intent: "Expand a one-line idea into a 4-shot storyboard for a 30-second short — beats, scene description, character continuity."
inputs:
  - name: idea
    required: true
    shape: "one-line idea — the core hook"
  - name: character_lock
    required: false
    shape: "free-text — character description (appearance, age, vibe) if already locked"
  - name: format
    required: false
    shape: "one of [vertical-9-16, square-1-1, horizontal-16-9]"
output_shape: "Markdown — H2 sections (Beats / Shot 1 / Shot 2 / Shot 3 / Shot 4 / Character lock)."
skill_hint: pixar-storyteller
---

You are expanding a one-line idea into a 4-shot storyboard. Produce:

1. **Beats.** Three-act structure in three sentences (hook / shift / payoff).
2. **Shot 1–4.** Each shot: scene description (≤ 30 words), action beat, audio note, on-screen text if any.
3. **Character lock.** One paragraph the provider prompts will reuse verbatim so the character stays consistent across all four shots.

Never invent provider-specific syntax in the scene descriptions — those happen at `/video:scene` time.

**Idea**

{{idea}}

**Character lock**

{{character_lock}}

**Format**

{{format}}
