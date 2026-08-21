---
adr: 238
status: accepted
date: 2026-08-21
decision: security-content-routes-to-external-authority
supersedes: —
superseded_by: —
phase: —
type: structural
reopen_policy: directional
review_trigger: >-
  Reopen on any of three observations together, never on one alone, because the
  three are what the rejection rested on. First — a named maintainer accepts
  ownership of security-domain content with a stated review cadence, since
  "no owner exists" was the decisive ground and an owner removes it. Second —
  a fixture set shows the package's security skills missing a real defect that
  local content would have caught, since coverage was asserted and never
  measured. Third — the external authority this record routes to stops being
  maintained or stops being freely reachable, since routing to a dead authority
  is worse than the copy it replaced. A reopening that cannot show all three has
  not met the condition; a reopening that shows all three should proceed without
  re-deriving the eleven gaps, which are recorded in the roadmap named below.
---

# ADR-238 — Security-domain parameters are routed to the maintained authority, not carried

## Status

**Accepted** · 2026-08-21.

## Context

This package's consumer-facing security *content* is concentrated in four
skills — `security-audit`, `security`, `authz-review`, `secrets-management` —
plus `docs/guidelines/php/security.md`. A 2026-08-20 inbox proposal asked to
harvest roughly 2,200 lines of an external, permissively-licensed AI-agent
security ruleset into that corpus, on the strength of a corpus diff showing
eleven confirmed thin or absent topics.

The diff was re-run against the current tree, 204 commits after the proposal's
pin. Eight of its eleven verdicts survived, three did not: infrastructure-as-code
hardening is already carried by `skill:terraform`, dependency security by
`skill:supply-chain-intake`, and Kubernetes is outside the consumer profile
rather than a gap. The surviving eight are real. Cryptography is the largest:
a grep for `AES-GCM`, `argon2`, `TLS 1.2`, `ChaCha20`, `ML-KEM` and
`post-quantum` across every skill, rule and guideline returns exactly one
incidental table row. XXE returns nothing at all.

So the question was never whether gaps exist. It was whether *this* package is
the right place to close them.

## Decision

**This package does not carry security-domain parameters. It routes to the
maintained external authority and states, in the artefacts a consumer reads,
which topics it does not cover.**

Concretely, and as a bright line rather than a preference: no cryptographic
algorithm tier, key size, work factor, iteration count, cipher suite, TLS
version floor, or certificate-lifetime value is authored into this corpus.
Where a consumer needs one, the skill they are reading names the topic as
out of scope and points at the authority that maintains it.

What this package *does* carry, and keeps carrying, is the enforcement layer:
`rule:secret-vcs-guard` with its detector and CI net, `skill:authz-review`'s
per-entrypoint authorization chain, `skill:supply-chain-intake`'s pinning and
CVE discipline, and the audit checklists that name a vulnerability *class*
without restating its parameters. A class is stable; a parameter is not.

## Consequences

**Wanted.** Nothing in this corpus can go stale into a false-confidence
failure, which is the specific harm this record exists to avoid — an
authoritative-reading cipher recommendation that stopped being true is worse
than a stated absence, because the absence is visible and the staleness is
not. Maintenance cost for the eight gaps is zero rather than perpetual. The
estate, which sits well above its registered target under a one-in-one-out
constraint, does not grow. And the provenance question dissolves: nothing is
adapted, so the licence's attribution requirement never attaches and cannot
collide with this repository's source-confidentiality rule.

**Accepted cost.** A consumer working offline, or one whose agent does not
follow the pointer, gets less than a local answer would have given. This is
a real loss and it is the price of the decision, not an argument against it —
the alternative on offer was not "a maintained local answer" but "an
unmaintained one", because no owner was available to name.

**Unresolved.** Whether the routing pointer is actually reached is not
measured. The mitigation is placement — the boundary block sits beside the
checklist rows that already name the categories, not in a see-also list — but
placement is a design argument, not evidence. If a later measurement shows the
pointer is not reached, the fix is routing, not content.

## Alternatives considered

**Harvest the full ruleset into a reference file.** Rejected. Both council
members independently rejected the reference-file shape: one file covering six
topics is reachable only if something routes to it, and if routing works then
routing to the maintained authority works too — at zero maintenance. The
harvest also carried the parameters that rot.

**Harvest a minimal subset — XXE and password-API misuse only.** This was one
member's conditional position, and it is the strongest alternative. It was
gated on three conditions of that member's own naming: fixtures showing a real
detection gain, a named owner, and a resolved provenance classification. None
was available, and the member's stated kill criterion — *no maintainer accepts
ownership before merge* — therefore fired. The path is not closed; it is the
reopening condition in this record's frontmatter.

**Do nothing at all.** Rejected as dishonest. The gaps are real and now
measured; leaving the corpus silent about its own boundary means the next
proposal re-derives the same eleven greps, which is what happened this time.

## References

- `agents/roadmaps/road-to-consumer-security-guidance.md` — the verified diff,
  the council record, and the execution of this decision.
- `rule:source-confidentiality` — why the evaluated source is not named here.
- `rule:code-provenance` — why a rejected finding produces no ledger row.
- [ADR-061](ADR-061-corpus-grounding-layer.md) — the attribution mechanism this
  decision made unnecessary rather than used.
