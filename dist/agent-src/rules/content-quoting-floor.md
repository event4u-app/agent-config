---
type: "auto"
tier: "2a"
description: "Cap verbatim quoting from external sources — 15 words max per quote, one quote per source, never a complete short work, paraphrase by default"
triggers:
  - intent: "drafting content from a source"
  - intent: "summarizing an external document"
  - keyword: "quote"
  - keyword: "excerpt"
  - keyword: "verbatim"
workspaces:
  - agent-config-maintainer
  - construction
  - engineering
  - finance
  - founder
  - gtm
  - legal-review-prep
  - ops
  - product
  - small-business
packs:
  - meta
---

# Content Quoting Floor

## The Iron Law

```
NO VERBATIM QUOTE EXCEEDS 15 WORDS. ONE QUOTE PER SOURCE PER DELIVERABLE.
NEVER REPRODUCE A COMPLETE SHORT WORK — LYRICS, POEMS, SHORT ARTICLES —
REGARDLESS OF LENGTH. PARAPHRASE IS THE DEFAULT; A QUOTE IS THE EXCEPTION.
```

Ghostwriter, research, release-comms, and content-drafting surfaces can
currently emit unbounded verbatim excerpts from a fetched, uploaded, or
cited external source. This rule caps that: a quote proves a claim, it
does not substitute for engaging with the source.

## The floor

1. **≤ 15 words per verbatim quote.** Longer excerpts are paraphrased,
   with the source cited by name/link instead of copied.
2. **One quote per source per deliverable.** After the first quote from
   a given source, that source is closed for further verbatim excerpts
   in the same piece — paraphrase any additional material.
3. **Never a complete short work.** Song lyrics, poems, haiku, short
   quotes, or brief articles are never reproduced in full, even when
   the whole thing is under the 15-word limit — completeness is the
   violation, not just length.
4. **No displacive summarization.** A "summary" that walks through the
   source's structure section-by-section in the source's own order,
   preserving its organization and phrasing, functions as a substitute
   for reading the source — this is a violation even without literal
   quoting. Summaries restructure and compress; they do not mirror.
5. **Paraphrase by default.** Reach for a quote only when the exact
   wording itself is the point (a legal term, a precise technical
   claim, a direct attribution the user needs verbatim) — not as the
   default mode of engaging with source material.

## Carve-outs

- **User-owned or user-supplied text.** Content the user wrote, pasted,
  or explicitly authorized for verbatim use is not "an external
  source" under this rule — it's the user's own material.
- **License-permitted vendored content.** Code or text vendored under a
  license that requires or permits verbatim inclusion (Apache/MIT
  attribution blocks, etc.) — see [`source-confidentiality`](source-confidentiality.md)
  for the attribution rules that govern that carve-out.
- **Code snippets.** This rule governs prose quoting from written
  sources (articles, documents, transcripts) — it does not limit
  quoting source code, which has its own citation norms.

## Failure modes

- Pasting a multi-paragraph block from a fetched article "for context"
  instead of paraphrasing it.
- Quoting the same source three times across one deliverable because
  each quote "proves a different point" — one quote closes the source.
- Reproducing a full haiku or a four-line lyric snippet because it's
  "short enough" — completeness, not length, is what this rule bans.
- A "summary" that is actually the source's own outline with lighter
  wording — the displacive-summarization violation.

## See also

- [`domain-safety-disclaimer`](domain-safety-disclaimer.md) — the
  advisory-disclaimer floor this rule complements; overlap checked,
  no duplication (that rule governs disclaimers, not quote length).
- [`untrusted-input-defense`](untrusted-input-defense.md) — governs
  treating fetched content as data vs instructions; this rule governs
  how much of that data may be reproduced verbatim once it IS being
  used as source material.
- [`docs/contracts/write-engine.md`](../docs/contracts/write-engine.md) —
  ghostwriter's disclosure-footer contract; this rule's quote floor
  applies to any ghostwriter draft that cites an external source.
- [`source-confidentiality`](source-confidentiality.md) — the license-
  required-attribution carve-out for vendored code/text.
