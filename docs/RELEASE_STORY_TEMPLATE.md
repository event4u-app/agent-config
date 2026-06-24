# Release Story — `<version>`

A curated, human-readable "what changed and **why it matters**" — distinct from
the raw `CHANGELOG`. The changelog lists commits; the release story tells a
maintainer or consumer, in plain language, what they get and what to watch.

Copy this template per release; keep it short (a screen or less).

## Headline

One sentence: the single most important thing this release delivers.

## What changed (and why it matters)

- **<change>** — what it is · why a consumer cares · what they should do (if anything).
- **<change>** — …

## Safety / behaviour changes

Anything that changes agent behaviour, gates, or defaults — call it out explicitly
(new floors, new consent gates, renamed packs, changed risk postures). Consumers
read this section first.

## Upgrade notes

- Breaking? Migration steps. Non-breaking? Say so.
- New opt-in surfaces (packs, settings) — how to enable.

## Deferred / known limitations

What was intentionally left for a future release, and the pointer (roadmap /
ADR). Honesty here prevents "is this missing or coming?" questions.

---

> Fill every section. An empty section is a signal the release is not understood
> well enough to ship its story. (road-to-product-clarity Phase 4a.)
