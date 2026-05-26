---
name: seasonal-mailing
intent: "Compose a seasonal customer mailing — voice-locked across spring / summer / autumn / winter cycles."
inputs:
  - name: season
    required: true
    shape: "one of [spring, summer, autumn, winter]"
  - name: hook
    required: true
    shape: "free-text — what you want the customer to do (book maintenance, plan next year, refer)"
  - name: customer_segment
    required: false
    shape: "string — e.g. 'private homeowner', 'property-management firm'"
output_shape: "Markdown — single email body, ≤ 250 words, plain-text friendly."
skill_hint: editorial-calendar
---

You are composing a seasonal mailing for Galabau customers. Produce a single email that:

1. Opens with a one-sentence reference to the season — never weather clichés.
2. Names the concrete service or action the customer can book / consider.
3. Closes with a low-friction next step (one phone call, one form).

Tone defaults to warm-and-competent. Never use seasonal stock phrases ("Frühling ist endlich da!"). Never invent services the shop does not offer.

**Season**

{{season}}

**Hook**

{{hook}}

**Customer segment**

{{customer_segment}}
