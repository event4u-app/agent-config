# AI-ism severity tiers + self-validation thresholds

> On-demand reference for the [`humanizer`](../SKILL.md) skill
> (road-to-ecosystem-harvest-prose-authenticity, Source I — a prose
> anti-slop humanizer skill; provenance in the harvest index). Loaded only
> during an active humanize pass. Five **pattern groups** live in
> [`../data/patterns.md`](../data/patterns.md); this file adds the
> orthogonal **severity axis** (how reliable a tell each construction is)
> and the **self-validation thresholds** the deterministic self-check reads.
>
> Every threshold here is a **default, not a suite measurement** — a
> starting bound with its source, tunable per voice, never a validated
> claim about human prose.

## Why a severity axis (orthogonal to the group taxonomy)

`patterns.md` groups tells by *kind* (content / language / style /
communication / filler). This file grades them by *diagnostic weight* — how
much a single occurrence tells you. Rewrite discipline is the same
(rewrite, don't delete); the tier decides **how hard to look** and **whether
one hit is worth acting on**. Clusters still win: two Medium tells
co-occurring outweigh one isolated High.

## Tier High — almost always a tell (act on a single occurrence)

Single instance is strong evidence of machine authorship; these rarely
survive in genuine human prose.

- **Chat artifacts** in a deliverable — "I hope this helps", "Let me know
  if…", "Would you like me to…", "Here is an overview of…". (patterns.md 4.1)
- **Knowledge-cutoff disclaimers** — "As of my last update…", "While
  specific details are limited…". (4.2)
- **Sycophancy** — "Great question!", "You're absolutely right". (4.4)
- **Negative parallelism as a reflex** — "It's not just X — it's Y", "not
  merely a song, but a statement". (2.3)
- **Significance inflation** — "marks a pivotal moment", "leaves an
  indelible mark". (1.1)
- **Aphorism formulas** — "X is the currency of Y", "X is not a tool but a
  mirror". (3.9)
- **Spaced double hyphens** (` -- `) — always a machine artifact. (3.1)

## Tier Medium — a tell in combination (act when ≥2 co-occur)

Individually defensible; a cluster of two or more is a signature.

- **AI vocabulary** — delve, tapestry, showcase, testament, pivotal,
  vibrant, intricate, seamless, underscore, ever-evolving. One is noise;
  three in a paragraph is a confession. (2.1)
- **Rule-of-three padding** — forced triplets. (2.4)
- **Copula avoidance** — "serves as", "stands as", "represents a shift". (2.2)
- **Promotional register** — "nestled", "boasts", "rich cultural heritage". (1.4)
- **Superficial "-ing" analysis** — "…, highlighting the region's heritage". (1.3)
- **Weasel attributions** — "experts argue", "observers have cited". (1.5)
- **Staccato drama / manufactured punchlines** — runs of short fragments
  engineered for quotability. (3.8)
- **Em/en-dash density above the deliverable cap** (~2 per 500 words). (3.1)
- **Signposting** — "let's dive in", "here's what you need to know". (5.4)
- **Fake-candid openers** — "Honestly?", "Look,", "Here's the thing". (5.6)

## Tier Low — only when over-used (never act on isolated hits)

Common in ordinary human writing; a tell only at high density.

- **Filler phrases** — "in order to", "due to the fact that". (5.1)
- **Hedge stacks** — "could potentially possibly". (5.2)
- **Mechanical boldface / bold-header vertical lists** — a tell in chat/post
  prose; **house style in this repo's own docs** (see the scope note below). (3.2, 3.3)
- **Title Case Headings**, **curly quotes**, **generic upbeat endings**. (3.4, 3.6, 5.3)
- **Synonym cycling**, **false ranges**. (2.5, 2.6)

## Scope note — deliverables, not repo docs

This severity axis governs **deliverable prose** (posts, articles, ghostwriter
output, on-request README sections). It does **not** apply to this repo's own
`docs/**` reference prose: em dashes and bold inline headers are the suite's
**intentional house style** there (council 2026-07-11, recorded on
`detect_ai_tells.ts` and `road-to-humanized-writing`). A humanize pass never
runs over repo documentation — see SKILL.md § When NOT to use.

## Self-validation thresholds (U4 — deterministic self-check bounds)

Read after a rewrite; each bound is a **default, not a suite measurement**.
The deterministic subset is enforced by
[`detect_ai_tells.ts`](../../../scripts/detect_ai_tells.ts) when a runtime is
available; without one, the step-3 audit checks these by eye.

| Bound | Default | Source |
|---|---|---|
| Em/en-dash density | ≤ ~2 per 500 words | patterns.md 3.1 (CP1 parity with design-antipatterns) |
| Consecutive staccato fragments | ≤ 3 short declaratives in a row | patterns.md 3.8 |
| Uniform-shape bullets | merge a run of ≥ 4 identically-shaped `- **X:** …` bullets into prose or real sentences | patterns.md 3.3 |
| Hedge stack | ≤ 1 hedge per claim | patterns.md 5.2 |
| Stock-vocabulary density | ≤ 2 Tier-Medium AI-vocabulary words per 100 words | patterns.md 2.1 |

**Did the rewrite clear the flagged tells without introducing new ones?** A
re-run over already-clean prose is a no-op. If a bound is intentionally
exceeded by a voice fingerprint (a person who genuinely writes in dashes),
the fingerprint wins and the bound is suppressed for that pass.

## Factual-integrity guard (U4)

Where a rewrite touches factual content — a number, date, name, quantity, or
claim — emit a flag rather than silently altering it:

```
[VERIFY: <original span> → <rewritten span>]
```

A humanizing pass changes *how* something is said, never *what is true*. The
flag makes any factual delta reviewable; the author confirms or reverts. A
rewrite that would drop or alter a fact without a `[VERIFY:]` flag is a
defect, not a style improvement.
