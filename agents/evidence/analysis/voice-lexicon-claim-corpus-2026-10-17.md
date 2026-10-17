<!-- evidence-type: analysis -->

# Claim phrases over the pre-registered negative corpus — first measurement

**Date:** 2026-10-17 · **Step:** brand-checkability roadmap 5.3 · **Result:** bar missed.

## What was pre-registered

Committed before this run, in its own commit (`chore(voice-lexicon): pre-register …`):

- the phrase registry `src/scripts/_lib/claim_phrases.ts` — English and German
  superlative, comparative, absolute, certification and guarantee phrases, never
  bare words;
- the corpus list `tests/fixtures/voice-lexicon/negative-corpus.txt` — every
  `docs/contracts/*.md` whose name does not match
  `brand|voice|ghostwriter|write-engine|marketing|messaging|claim|positioning|gtm`,
  183 files;
- the bar from decision E8: at most 0.1 hits per 10k words.

## Reading

`scanClaims(text, [], now)` over each listed file (exemptions applied: code,
blockquotes, URLs, quoted spans):

| Files | Words | Hits | Hits per 10k words | Bar |
|---|---|---|---|---|
| 183 | 283,204 | 8 | 0.28 | ≤ 0.10 |

| File:line | Phrase | Class |
|---|---|---|
| `docs/contracts/adr-product-ui-track.md:147` | Unmatched | superlative |
| `docs/contracts/adr-product-ui-track.md:149` | unmatched | superlative |
| `docs/contracts/conformance.md:37` | never fails | absolute |
| `docs/contracts/hook-architecture-v1.md:778` | beats every | comparative |
| `docs/contracts/ui-authority.md:45` | beats every | comparative |
| `docs/contracts/ui-stack-extension.md:148` | unmatched | superlative |
| `docs/contracts/ui-track-flow.md:221` | Unmatched | superlative |
| `docs/contracts/ui-track-flow.md:223` | unmatched | superlative |

Five of the eight are `unmatched` in its technical sense (an input no rule
matched); two are `beats every` in a precedence sense ("X beats every Y"); one
is `never fails` describing a check. None is a marketing claim.

## What this does and does not establish

- The registry as frozen is too noisy for this corpus: three phrases carry every
  hit, and all eight hits are false positives.
- E8 forbids tuning after the first run, so the registry was **not** edited and
  the bar test was **not** committed. Step 5.3 stays open.
- Re-opening needs a new pre-registration: a revised phrase list and a corpus the
  revision was not chosen against (this one is now seen). Dropping the three
  phrases would remove every hit here, which is exactly why doing so on this
  corpus would be tuning to the answer.
- The checker still reports claim phrases at `warning` (English) and `hint`
  (German); the measurement says those findings are advisory with a known
  false-positive class, which is what the roadmap's "flags, never blocks" already
  assumes.
