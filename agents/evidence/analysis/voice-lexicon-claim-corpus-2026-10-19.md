<!-- evidence-type: analysis -->

# Claim phrases over the pre-registered negative corpus — second measurement

**Date:** 2026-10-19 · **Step:** brand-checkability roadmap 5.3 · **Result:** bar met.

## What was pre-registered

Committed in its own commit (`ce6201f45`, `chore(voice-lexicon): pre-register
claim registry v2 …`) before any file of the new corpus was scanned:

- **Registry v2** — `src/scripts/_lib/claim_phrases.ts` minus the four English
  single-word entries `unmatched`, `unrivaled`, `unrivalled`, `unhackable`. The
  reason is the roadmap's own NG-10 ("no single-word claim detection"), which v1
  contradicted; a `claim-shapes` case now pins it (seen red against v1). German
  compounds stay and stay at `hint`. The two-word phrases that produced v1 false
  positives (`beats every`, `never fails`) were **kept**: removing them would be
  tuning to the v1 answer.
- **Corpus v2** — `tests/fixtures/voice-lexicon/negative-corpus-v2.txt`: every
  `docs/guidelines/**/*.md` whose path does not match
  `brand|voice|ghostwriter|write-engine|marketing|messaging|claim|positioning|gtm|copy|content|design`,
  111 files. v1's corpus (`docs/contracts`) is excluded by construction.
- **Word count** — whitespace-separated tokens of the raw file (stated in the
  list header; the v1 note did not state its method).
- **Bar** — E8 unchanged: at most 0.1 hits per 10k words, no tuning after the run.

## Reading

`scanClaims(text, [], now)` over each listed file:

| Files | Words | Hits | Hits per 10k words | Bar |
|---|---|---|---|---|
| 111 | 97,835 | 0 | 0.000 | ≤ 0.10 |

## What this does and does not establish

- Registry v2 meets the bar on a corpus it was not revised against. The
  `negative-corpus` case asserts it and was seen red under a planted noisy
  phrase, so it is not vacuous.
- At 97,835 words the bar admits at most 0 hits (one hit would read 0.102), so
  this is a zero-false-positive reading, not a density estimate.
- **Not evidence:** registry v2 over the already-seen v1 corpus reads 3 hits in
  285,280 words (0.105 — `never fails` once, `beats every` twice). That corpus
  shaped the revision, so the figure is reported only so nobody re-derives it as
  a pass or a fail.
- It says nothing about recall on real marketing copy; the `claim-shapes` cases
  carry that, and findings stay advisory (`warning` English, `hint` German).
