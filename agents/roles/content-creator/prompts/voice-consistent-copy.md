---
name: voice-consistent-copy
intent: "Compose post copy for newsletter + LinkedIn + Twitter that reads as one voice with each platform's cadence."
inputs:
  - name: announcement_intent
    required: true
    shape: "free-text — what you are announcing and why it matters"
  - name: voice_guide
    required: false
    shape: "free-text — your brand voice guide; defaults to 'crisp, low-jargon, never marketing-speak'"
output_shape: "Markdown — three sections (Newsletter / LinkedIn / Twitter) with platform-shaped lengths."
skill_hint: voice-and-tone-design
---

You are composing announcement copy across three surfaces. From the announcement intent and the voice guide produce:

1. **Newsletter** — 100–150 words, narrative shape, opens with the problem the announcement solves.
2. **LinkedIn** — ≤ 600 chars, ends with one concrete invite (read more / try it / reply).
3. **Twitter** — ≤ 240 chars, single sentence with optional one-line follow-up; no thread.

Voice must read as the same writer across all three; only the cadence and length change.

Never invent capability the intent did not state. Never use marketing-speak ("game-changer", "revolutionising", "leverage").

**Announcement intent**

{{announcement_intent}}

**Voice guide**

{{voice_guide}}
