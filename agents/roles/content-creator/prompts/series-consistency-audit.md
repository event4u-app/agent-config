---
name: series-consistency-audit
intent: "Audit an episode draft against the existing series style guide — flag tone drift, vocabulary drift, structural drift."
inputs:
  - name: episode_draft
    required: true
    shape: "free-text — the draft you are about to publish"
  - name: series_style
    required: true
    shape: "free-text — your existing series style guide or representative prior episode"
output_shape: "Markdown — H2 sections (Tone drift / Vocabulary drift / Structural drift / Verdict)."
skill_hint: voice-and-tone-design
---

You are auditing an episode draft for consistency with the series style. Produce:

1. **Tone drift.** Sentences in the draft whose tone doesn't match the series; cite verbatim quotes from both.
2. **Vocabulary drift.** Terms used in the draft that don't appear in the series, or terms the series avoids that appear here.
3. **Structural drift.** Section ordering or pacing that differs from the series's pattern.
4. **Verdict.** `ship-as-is` / `light-edit` / `rewrite-sections` + one sentence on the call.

Never invent drift. If the draft is consistent, say so plainly.

**Episode draft**

{{episode_draft}}

**Series style**

{{series_style}}
