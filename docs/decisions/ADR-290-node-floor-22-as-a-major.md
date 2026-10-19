---
adr: 290
status: accepted
date: 2026-10-18
decision: node-floor-22-as-a-major
supersedes: —
superseded_by: —
phase: road-to-an-update-that-installs-itself-only-when-it-is-safe · blocker node-floor-raise
type: structural
reopen_policy: unclassified
protected_dimensions: none
provenance:
  kind: agentic
  agentic_mode: council
  decision_makers: [council]
  human_directed: true
evidence:
  strength: E1
  basis:
    - agents/evidence/council/node-floor-raise-20261018.md
    - agents/evidence/council/node-floor-raise-20261018.question.md
    - agents/evidence/council/owner-blocker-routing-20261016.md
    - agents/roadmaps/road-to-an-update-that-installs-itself-only-when-it-is-safe.md
    - SECURITY.md
    - package.json
review_trigger: >-
  Reopened if consumer-usage evidence shows a material share of active installs
  on Node 20 that the raise would strand with no upgrade path, or if the Node
  release schedule changes so that 22 leaves its support window before this
  raise ships.
---

# ADR-290 — The Node floor rises to 22, as a semver-major

## Status

Accepted 2026-10-18. Decided by the AI council (2/2, `anthropic` + `openai`,
both (a)), under the owner's delegation of 2026-10-18 ("versuche die offenen
entscheidungen im ai council zu lösen"). Resolves the blocker <!-- md-language-check: ignore -->
`node-floor-raise`.

## Context

`package.json` declares `"node": ">=20.11.0"`. Node 20 passed its upstream
support window on 2026-04-30, and `SECURITY.md:21-22` backports nothing, so a
Node-20 floor asserts support the package does not give. The workflows carry 41
Node-20 sites in 21 files (measured 2026-10-16). The unattended updater already
refuses an install whose runtime does not satisfy `engines`.

## Decision

1. Raise `engines.node` to `>=22` in a **semver-major**, cut as the first
   release classed `action`.
2. `engines.node` and every Node-20 CI site move **in the same change**.
3. Migration notes name the last Node-20-compatible version and state plainly
   that it receives no security, bug or compatibility backports; the change gets
   a `BREAKING_CHANGES.md` row and a `### Breaking` entry in that release.
4. Before release: the `engines` refusal path is verified on Node 20 and a
   successful install on Node 22.
5. Both seats prefer the raise to share its major with the planned settings-key
   removals of `road-to-a-setup-that-decides-itself` Phase 4, so consumers
   absorb one major transition. That coupling is a preference, not a condition:
   whether Phase 4 waits for this major is still open in that roadmap.

## Consequences

Step 4.5 of the updater roadmap is unblocked. Consumers on Node 20 must upgrade
Node before taking the major; the updater refuses rather than installing a
version that cannot start.

## Alternatives considered

- **(b)** raise with the next major cut for other reasons — leaves the
  compatibility signal in place for an unbounded time.
- **(c)** defer with a revisit date — the same, with a date.

## Evidence

The council record and prompt beside it; `openai`'s recorded caveat that no
consumer-usage evidence was supplied, which this record's review trigger
carries.

## References

- `SECURITY.md:21-22`, `BREAKING_CHANGES.md`, `CONTRIBUTING.md` § Versioning.
