---
complexity: lightweight
status: ready
parent_roadmap: road-to-gated-reach
---

# Roadmap: Reach — headless browser for JS-only platforms

> The heavyweight fallback. Parked because nothing shipped has needed it, and the
> one surface that looked like it would (Reddit ranking) turned out to be plain
> server-rendered HTML.

## Why this is parked, not open

Every channel that ships today is satisfied by one `curl` invocation plus a local
parser. Reddit's ranking and reply nesting — the case most likely to require a
real browser — is served as static HTML by `old.reddit`, so a headless engine
would have bought nothing. Adding one would mean a large binary dependency, a
resident-process shape the package's Class A boundary forbids, and a fingerprinting
arms race, for zero measured need.

## Resume trigger

A **measured** need on a fourth platform: a concrete target where the content is
provably absent from the served HTML (verified by fetching it and showing the
absence, not by assuming a SPA), and where no feed, oEmbed, or metadata endpoint
serves the same data.

## What it would have to solve

- The Class A boundary (ADR-124): no resident process, no state store. A headless
  browser is a process — this needs an explicit decision, not an implicit one.
- A pinned browser install, human-performed like every other backend.
- The trifecta again, in its worst shape: a full JS engine executing untrusted
  third-party code on the maintainer's machine.
- A `lifecycle: experimental` entry that cannot reach `stable` without a real run.

## See also

- `docs/decisions/ADR-124` — the embedded-engine doctrine this would have to clear.
- `internal/bench/gated-reach/README.md` — the measurement bar a new channel meets.
