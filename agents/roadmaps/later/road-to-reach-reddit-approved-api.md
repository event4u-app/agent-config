---
complexity: lightweight
status: ready
parent_roadmap: road-to-gated-reach
---

# Roadmap: Reach — Reddit approved Data API access (the durable path)

> The only Reddit path with no announced expiry. Parked on a maintainer decision,
> not on a technical blocker — and it has a timing property the others do not.

## Why this is parked, not open

Reddit closed **self-service** Data-API registration in November 2025
("Responsible Builder Policy"). New OAuth credentials are approval-only, with weeks
of latency and high rejection rates for individual developers. Credentials issued
before that change still work; this package has none.

## The timing property that makes this different

Every other parked item can be started **when** its trigger fires. This one
cannot: approval takes weeks, so if it is started only after `old.reddit` dies,
the capability is gone for the whole approval window. It is therefore either
**started opportunistically before it is needed, or not at all.**

Host recommendation on record: start it at any time, since its cost is *waiting*
rather than *risk* — unlike the session-cookie path, it adds no ban risk and no
credential-beside-untrusted-content surface.

## Resume trigger — any ONE

- The maintainer chooses this successor (option (iii) in the recorded successor
  decision).
- An application is submitted — at which point this file tracks the outcome
  rather than the decision.

## What it would have to solve

- OAuth client credentials as a declared `credential_path`, never inline.
- The trifecta constraint from the session-cookie sibling applies identically: an
  approved key is still a credential next to untrusted content.
- A registry entry whose `lifecycle` starts `experimental` and only reaches
  `stable` after a real run, per the shipped contract.

## See also

- `internal/bench/gated-reach/README.md` § Step 2 — the three-option successor decision.
- `docs/guides/gated-platform-reads.md` § What is closed — why the self-service path is gone.
