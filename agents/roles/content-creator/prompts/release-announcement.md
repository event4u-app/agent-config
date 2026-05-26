---
name: release-announcement
intent: "Compose a release announcement that names the value, not the feature list — for a non-developer audience."
inputs:
  - name: changelog
    required: true
    shape: "free-text — the verbatim changelog entries since the last release"
  - name: audience
    required: false
    shape: "one of [end-user, partner, internal]"
output_shape: "Markdown — H2 sections (What is new for you / Why it matters / What did not change), ≤ 300 words."
skill_hint: messaging-architecture
---

You are turning a changelog into a release announcement. From the changelog produce:

1. **What is new for you.** Three to five bullets, value-framed (not feature-framed). Each bullet starts with the outcome the reader cares about.
2. **Why it matters.** One paragraph naming the larger arc — what this release moves toward.
3. **What did not change.** Honest section. Names the things readers might worry about — pricing, breaking changes, removed features.

Never invent benefits the changelog does not support. Never write "more X, better Y" — name the X and Y.

**Changelog**

{{changelog}}

**Audience**

{{audience}}
