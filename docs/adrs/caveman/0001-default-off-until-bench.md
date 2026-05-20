# ADR 0001 — Caveman compression default stays OFF until `task bench`

> Area: `caveman` · Status: accepted · Date: 2026-05-16 · Type: retrospective
> Roadmap: `agents/roadmaps/step-11-ruflo-parity.md` Phase 4 Step 3
> Supersedes: —

## Context

Caveman-speak is a turn-time compression dialect that trades English
grammar for tokens. The dialect is documented in
[`caveman-speak`](../../../.agent-src.uncompressed/rules/caveman-speak.md);
the question this ADR records is **whether the dialect should default
ON for all consumers**.

The North-Star council ([`council-synthesis.md` § 7](../../../agents/audits/2026-05-14-north-star/council-synthesis.md))
landed split: two voices (token-efficiency, ops) argued default-ON
saves 40 %+ tokens on long sessions; two voices (UX, governance)
argued default-ON degrades novice readability and locks in a dialect
nobody has measured against the real benchmark corpus.

## Decision

**`caveman.speak_scope` defaults `off`**. Carve-outs (security ·
destructive · multi-step · code blocks · paths · numbered options ·
Iron-Law markers) stay in the rule body so the dialect is **defined**
even when **inactive**. The default flips only when `task bench`
produces measured win/loss numbers against the locked 25-prompt corpus.

Authoritative kill-criterion:
[`docs/contracts/compression-default-kill-criterion.md`](../../contracts/compression-default-kill-criterion.md)
§ Rule lines 8–11.

### Decision owner

`step-4-measurement-and-benchmark.md` closeout phase. Not this doc.
Not `step-99`. Not the North-Star council. The closeout reads
`docs/parity/bench.json` and applies exactly one of three branches
defined in the kill-criterion.

### Default-ON gates (all required)

1. ≥ 30 % token reduction averaged across the 25-prompt corpus.
2. ≤ 5 % regression on the readability score from the same run.
3. Reversibility check passes (caveman → English round-trip ≥ 95 %
   semantic preservation per the bench scorer).

Any gate fails → default stays OFF. Re-bench after the next dialect
edit.

## Considered alternatives

### Alt 1 — Default ON now (rejected)

Flip the default immediately; let consumers opt out.

**Why rejected:** no measured baseline exists. The two pro voices'
40 % claim is from informal turn-snippet comparisons, not the locked
corpus. Default-on without measurement is exactly the Ruflo-style
"trust me it's faster" pattern the audit calls out.

### Alt 2 — Default ON for cost-profile `lean`, OFF for `default` (rejected)

Couple the default to the cost profile.

**Why rejected:** cost profiles already carry profile-specific budget
ladders and smoke contracts. Adding a dialect coupling makes the
matrix `2 × N` instead of `1 × N`. The kill-criterion measurement is
the same regardless of profile — make the decision once.

### Alt 3 — Keep default OFF, measure first (accepted)

The chosen path. Dialect ships, stays dormant, gets benched, then
either ships default-on or gets deprecated. No middle state.

## Consequences

- **Positive:** new consumers get standard English by default; the
  novice-onboarding path is unaffected; the dialect is auditable and
  measurable before it becomes the default cost vector.
- **Negative:** the 40 %+ token savings are leave-on-table for any
  consumer who doesn't explicitly opt in. Mitigated by surfacing the
  flag in `/onboard` once `task bench` lands.
- **Reversal cost:** flip the default in
  [`.agent-settings.yml`](../../../.agent-settings.yml.example)
  template; existing user settings unaffected by template change.

## References

- [`docs/contracts/compression-default-kill-criterion.md`](../../contracts/compression-default-kill-criterion.md) — kill-criterion contract.
- [`.agent-src.uncompressed/rules/caveman-speak.md`](../../../.agent-src.uncompressed/rules/caveman-speak.md) — dialect definition.
- [`agents/roadmaps/step-4-measurement-and-benchmark.md`](../../../agents/roadmaps/step-4-measurement-and-benchmark.md) — bench owner.
- [`agents/audits/2026-05-14-north-star/council-synthesis.md`](../../../agents/audits/2026-05-14-north-star/council-synthesis.md) § 7 — council split.
- [`agents/roadmaps/step-11-ruflo-parity.md`](../../../agents/roadmaps/step-11-ruflo-parity.md) Phase 4 Step 3 — origin.
