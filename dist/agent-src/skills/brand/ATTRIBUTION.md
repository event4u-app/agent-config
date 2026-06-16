# Attribution — brand corpus + grounding engine

This skill is a second instance of the ADR-061 corpus-grounding layer.

## Grounding engine

The retrieval/decision engine is the shared
[`corpus-grounding`](../corpus-grounding/SKILL.md) skill — it is **not** forked
or vendored here. Its provenance and license obligations are recorded once in
[`design-intelligence/ATTRIBUTION.md`](../design-intelligence/ATTRIBUTION.md)
(MIT engine port). This skill ships only a manifest + CSVs that plug into it.

## Corpus (`data/*.csv`)

The brand corpus is **original-authored** from public, non-proprietary brand
frameworks and conventions:

- the 12 brand archetypes (Jung; Mark & Pearson, *The Hero and the Outlaw*) —
  a public framework, not a vendored dataset;
- conventional colour-psychology-by-industry associations;
- well-known messaging frameworks (positioning statement, value-proposition
  canvas, message house, golden circle, StoryBrand, jobs-to-be-done, etc.) —
  named methods in the public domain, described in our own words;
- voice/tone, naming-pattern, logo-style, and archetype→typography rows
  authored for this package.

No third-party CSV or skill content was copied into these files, so no
third-party license obligation attaches to the corpus. The framework *names*
above are referenced as public concepts, not as a source we adapted file
content from.

## Provenance discipline

The manifest carries `owner: package-maintainer`, `refresh_cadence: quarterly`,
and `upstream: null` (no upstream repo — original-authored). Refresh re-reviews
the archetype↔type rows whenever the font-pairings Reference
(`font-pairings-reference.csv`) refreshes, and revisits colour/cultural caveats
on the quarterly cadence.
