# Enforcement-first architecture — rejection record with revisit conditions

> Durable disposition record from the road-to-self-critical roadmap
> (AI council debate 2026-07-26, anthropic/claude-sonnet-4-5 +
> openai/gpt-4o, 2 rounds; maintainer-activated 2026-07-27). Roadmaps are
> named by slug only per `no-roadmap-references`. Future sessions: read
> this BEFORE re-proposing hooks-first / promotion-law / kernel-shrink
> architectures.

## What was proposed

An "enforcement-first" architecture umbrella (ladder L1–L5, a promotion
law that deletes prose once a rule gains a compiled check, a kernel target
of 9→≤4 rules / ≤2k chars, hooks-become-the-product re-platforming).

## Disposition: NOT adopted

- It **reverses the recorded compile-time-first positioning**
  (`docs/enforcement-by-host.md`): runtime hooks reach ~2 of 7 projection
  hosts; building the governance story on them makes it a two-tier
  product.
- Its "majority of the kernel is checkable" hypothesis is **contradicted
  by the kernel's own honest `enforced_by: none` entries** (e.g.
  `non-destructive-by-default` — no script can enforce "ask before you
  deploy"; per ADR-127 claiming adjacent hooks would inflate coverage).
- The promotion law would **delete prose from exactly the projections
  (static/weak hosts) where the measured discipline lift lives** — the
  honest form is "bind the check where the host supports it, keep the
  prose in static-host projections". Prose-deletion-on-promotion is
  REJECTED.
- The **kernel is EXEMPT** from any promotion/shrink law — the membership
  contract (`docs/contracts/kernel-membership.md`) stands; no
  pre-committed ≤4/≤2k target.
- Both extremes (all-in on hooks vs never-hooks) lack the decisive datum —
  **usage distribution by host capability** — which does not exist. Round
  2 of the council caught one member's own "88% weak-host usage" figure as
  unsupported; the absence of usage data disarms BOTH sides.

What survives: the ladder **vocabulary** (recorded as a glossary in
`docs/enforcement-by-host.md § Vocabulary`, with L4 just-in-time injection
flagged as the one genuinely new level), and trip counting on existing
gates (lands with the credible-install outside-in gate).

## Revisit conditions — BOTH must hold, in this order

Revisit the enforcement-first migration ONLY when both are true:

1. **Hook-latency budget met and holding** — the hook-latency work
   (road-to-credible-install Phase 1) has shipped, its p50/p95 budget is
   met, and it has stayed green across at least one release window.
2. **Real usage-distribution evidence by host capability exists** — and
   shows hook-capable hosts carry a substantial share of real usage with
   non-ceiling compliance (i.e. there is something for hooks to fix, on
   hosts that can run them).

Until then the recorded compile-time-first stance stands. A proposal that
cannot cite both conditions as met is re-litigating a lock
(`decision-revisit-gate` applies — surface the lock, don't silently
comply or silently re-argue).

## Related rejections from the same council (same evidence base)

- **A/B "compiled corpus vs prose" benchmark as drafted** — on strong
  hosts it re-measures a known ceiling-null (governance-enforcement
  projection honest-null, Δ=0.000); designed naively it re-runs the locked
  thin-projection shape (36.2% < 48% floor). Any future design must
  measure the weak-host reality it would actually change.
- **LLM-sampled prose-compliance audits** — new probabilistic machinery
  under the freeze; post-launch candidate, PII-exclusion audit required
  first.
