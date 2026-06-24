---
adr: 108
status: accepted
date: 2026-06-24
decision: open-source-forever-no-commercial-tier
supersedes: —
superseded_by: —
phase: road-to-legal-pack
type: standing
---

# ADR-108 — The suite is open-source forever; no commercial / Pro tier

## Status

**Accepted** · 2026-06-24 · maintainer decision. Standing commitment for the whole `event4u/agent-config` suite, surfaced while resolving the legal pack's conditional product-liability gate (ADR-107 § 0.6).

## Context

The legal pack (ADR-107) carried a *conditional* product-liability gate: "if shipped commercially (Pro tier), a licensed attorney must review the pack itself before ship." That conditional only matters if a commercial/Pro tier is on the table. The maintainer's standing position is that it is not — and should be made durable so the question is not relitigated and so no future change silently introduces provider liability.

## Decision

**The entire `event4u/agent-config` suite is and remains open-source. There is no commercial tier, no Pro tier, no paid distribution — now or in the future.**

Consequences for governance:

1. **The legal pack's conditional product-liability gate (ADR-107 § 0.6) never fires.** There is no provider selling the pack; the only liability surface is end-user reliance, which is addressed by the non-removable disclaimer and the per-output attorney-review line in `legal-safety-floor`.
2. **Liability disclaimer is permanent.** Every legal-pack output is a research-and-drafting aid, not legal advice, not a substitute for a licensed attorney, and not something anyone may rely on as definitive. This holds independent of distribution model.
3. **Reopening requires a superseding ADR.** Introducing any paid/commercial tier would be a new, explicit decision that supersedes this ADR — and would re-activate the ADR-107 § 0.6 attorney-review-of-the-pack gate before any paid distribution.

## Consequences

- `legal-safety-floor` § Distribution states the open-source-forever stance and that the conditional gate is closed by decision.
- ADR-107 § 0.6 is resolved as **N/A** (not applicable under this standing decision).

## Alternatives considered

- **Keep 0.6 purely conditional, no standing decision** (rejected — leaves the door open to silently introducing provider liability; the maintainer wanted it hardened for the future).
- **A CI lint enforcing "no commercial tier"** (rejected — over-engineering; an ADR + the floor statement are the right durable surface, and there is no machine signal of "commercial intent" to lint).

## References

- [ADR-107 — Legal domain-pack adoption](ADR-107-legal-domain-pack-adoption.md) (§ 0.6 conditional gate, now resolved N/A)
- `rule:legal-safety-floor` § Distribution + § What this pack is — and is not
- [`agents/roadmaps/road-to-legal-pack.md`](../../agents/roadmaps/road-to-legal-pack.md) § 0.6
