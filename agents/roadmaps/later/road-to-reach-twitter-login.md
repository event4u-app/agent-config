---
complexity: lightweight
status: ready
parent_roadmap: road-to-gated-reach
---

# Roadmap: Reach — Twitter beyond a single tweet (timelines, search, threads)

> Single-tweet reads ship credential-free. Everything wider does not exist on any
> credential-free path, and the shipped skill says so instead of guessing.

## Why this is parked, not open

Measured 2026-07-25: the platform's own oEmbed endpoint returns one tweet — text,
author, date — and **nothing else**. No replies (structurally: one `<blockquote>`,
no thread field), no timeline, no search, no metrics. The other credential-free
path people reach for, `cdn.syndication.twimg.com/tweet-result`, answers 200 with
an **empty body** even for a known-public tweet: dead, not rate-limited.

There is no partial version of this to build. Wider access needs authentication.

## Resume trigger

A task that genuinely needs a timeline, a search, or a full reply thread — stated
concretely, not anticipated. Until then, the honest answer ("replies are not
available on this path") is the shipped behaviour and it is correct.

## What it would have to solve

- Auth against a platform that has repeatedly changed its access terms, with the
  same trifecta constraint as the Reddit credential paths.
- A cost decision: paid API tiers are the only sanctioned route, so this is a
  spend question before it is an engineering question.
- The narrowing already measured: for any **discussed** tweet, native search
  already recovers the content (2 of 6 obscure tweets, 5 of 6 canonical ones). A
  credentialed Twitter channel must beat *that* baseline, not zero.

## See also

- `internal/bench/gated-reach/results.md` § twitter-oembed — the measured narrowing.
- `src/skills/gated-reach/SKILL.md` § When to use — the declined intents.
