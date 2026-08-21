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
  TWO INDEPENDENT triggers, either one sufficient — they reopen different
  questions and conjoining them would make the record unreachable rather than
  strict. Trigger A reopens WHETHER TO CARRY LOCAL CONTENT and needs both of
  its parts, because each answers one of the two grounds the rejection rested
  on: a named maintainer accepting ownership with a stated review cadence, AND
  a fixture set showing the package's security skills missing a real defect
  that local content would have caught. The fixture half is not satisfiable by
  assertion: the fixtures are authored against the CURRENT skills before any
  replacement content exists, the miss is observed rather than argued, and a
  fixture set written alongside the content it justifies does not count.
  Trigger B reopens WHETHER ROUTING STILL WORKS and stands alone: the external
  authority stops being maintained, or stops being freely reachable. A
  reopening under either trigger should proceed without re-deriving the eleven
  gaps, which are recorded in the roadmap named below.
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
match. XXE returns nothing at all.

That one match is `skill:ai-code-blindspots:55` — a checklist row reading
"password columns use bcrypt/argon2, never MD5/SHA". It is named here rather
than left as "incidental", because a boundary with an unexplained match is not
a boundary. It **stays**, and it does not violate the decision below: it names
algorithm *families* in a prohibition-plus-default, which is a stable
class-level statement, and it carries no parameter, key size, work factor,
cipher suite, or version floor — the enumerated set this record actually
bounds. An algorithm family whose deprecation is measured in decades is not
the thing that rots; a work factor revised every few years is.

So the question was never whether gaps exist. It was whether *this* package is
the right place to close them.

## Decision

**This package does not carry security-domain parameters. It routes to the
maintained external authority and states, in the artefacts a consumer reads,
which topics it does not cover.**

Concretely, and as a bright line rather than a preference: no cryptographic
algorithm tier, key size, work factor, iteration count, cipher suite, TLS
version floor, or certificate-lifetime value is authored into this corpus.

The boundary is stated in **two** artefacts, and the count is deliberate rather
than partial. `skill:security-audit` and `skill:security` are the two a
consumer reaches with "is this safe" and "how do I write this safely", so they
carry the notice. `skill:secrets-management` already does the same thing in its
own words at `:31` — "the decision is which cipher to use for at-rest
encryption — read the provider's KMS docs directly" — so a third notice would
be duplication, not coverage. `skill:authz-review` and
`docs/guidelines/php/security.md` are named in the Context above as part of the
security corpus, not as places this boundary applies: neither carries or
invites a cryptographic parameter.

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
ownership before merge* — therefore fired.

The path is not closed, and Trigger A in the frontmatter is what reopens it —
but the two lists are **not** the same list, and conflating them would be an
error. That member named three conditions *for adopting content in that
session*, provenance among them. Provenance is not a reopening condition here:
this record adapts nothing, so there is nothing to classify, and a future
proposal that adapts something acquires that obligation from
`rule:code-provenance` rather than from this ADR. Trigger A therefore carries
the two conditions that survive the decision — owner and observed miss.

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
