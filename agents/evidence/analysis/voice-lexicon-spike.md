<!-- evidence-type: analysis -->

# Voice negative lexicon — the parked Phase 0 spike, as written

**Date:** 2026-10-17 · **Step:** brand-checkability roadmap 5.0 · **Corpus pin:** `origin/main` at `835660b0d`
**Verdict:** schema field only — hits concentrate in two entries; the build gate (≥ 5 distinct entries) is not met.

## Pre-registration

The parked voice-negative-lexicon roadmap's Phase 0, unchanged:

- **Corpus:** the last 30 merged PR descriptions (title + body; PRs #2398-#2430)
  and the last 100 commit messages on `origin/main` — 130 items.
- **Seed lexicon:** `tests/fixtures/voice-lexicon/spike-seed-lexicon.json`, 21
  entries (7 hedges, 11 hype words, 3 decorative emoji), committed in its own
  commit before the scan.
- **Matching:** plain, case-insensitive, word-bounded literal match over the raw
  text; no exemptions, no NLP.
- **Gate:** ≥ 5 distinct entries firing across ≥ 10 items → build; hits
  concentrated in ≤ 2 entries → schema field only, validator YAGNI; ≈ 0 hits →
  honest null.

## Reading

| Measure | Value |
|---|---|
| Items scanned | 130 (30 PRs, 100 commits) |
| Items with a hit | 22 (6 PRs, 16 commits) |
| Distinct entries firing | 2 of 21 |
| Total hits | 42 |

| Entry | Class | Hits | Items |
|---|---|---|---|
| `actually` | hedge | 38 | 19 |
| `simply` | hedge | 4 | 4 |
| every other entry | — | 0 | 0 |

No hype word and no decorative emoji fired in any item.

## Verdict and what it decides

- The gate's middle branch fires: the hits clear the item floor (22 ≥ 10) but come
  from two entries, so a validator over this corpus would enforce two words. By
  the spike's own rule that is **schema field only**, not build.
- It decides only the user-schema half (roadmap step 5.5). 5.5 is written as
  "only if 5.0 says build", so it does not proceed on this reading; whether the
  middle branch still justifies the bare `style.avoid` field is left to whoever
  takes 5.5, and it is a consumer-visible schema change in any case.
- The brand and ghostwriter halves never depended on this spike: they stand on
  a declared check with no runner, and `check_voice_lexicon` now runs it.
- Not established: whether `actually` is a hedge here. The word count says it is
  frequent; it does not say it is filler — sampled hits read as "what it actually
  makes" or "the witness source actually emits", a factual contrast between a
  claim and a behaviour. That is the explainability limit the literal design
  accepts, recorded rather than tuned away.

## Reproduction

```bash
gh pr list --state merged --limit 30 --json number,title,body > prs.json
git log origin/main -100 --format='%H%x00%B%x1e' > commits.txt
# word-bounded, case-insensitive literal match of each seed entry over each item
```
