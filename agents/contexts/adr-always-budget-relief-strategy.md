# ADR — Always-Budget Relief Strategy (parked, reactivation-gated)

> **Status:** Decided · Parked-pending-trigger · 2026-05-08
> **Expiry:** 2026-11-08 (re-pick if reactivation fires before then)
> **Source:** road-to-always-budget-relief roadmap (transient — `agents/roadmaps/`)
> **Predecessor:** `adr-always-rule-context-split-not-viable.md` (closed Model (b) split)
> **Council:** Sonnet-4.5 + GPT-4o, 2026-05-08 (raw transcript: `agents/council-responses/always-budget-relief.json`) <!-- council-ref-allowed: ADR contract decision trace -->


## Decision

**Park execution. Lock primary + fallback strategy. Define reactivation triggers.**

The roadmap's authoring premise (47,448 / 49,000 chars, 96.8 % utilisation, 1,552 chars headroom) **dissolved between authoring and execution**. Current measurement (`scripts/check_always_budget.py`, 2026-05-08): **26,672 / 49,000 chars, 54.4 %, 22,328 chars headroom across 9 kernel rules** — the kernel-and-router refactor (`docs/decisions/ADR-rule-kernel-and-router.md`, locked 2026-05-06) reduced the always-set to 9 rules and absorbed the budget pressure structurally.

Acceptance criterion `≥ 2,000 chars net headroom` is **already exceeded by 11×**. Executing Phase 3 rule edits against a non-existent constraint would be unjustified churn against the kernel-membership contract. The strategy inventory and picked strategy are recorded for the next time the trigger fires.

## Reactivation triggers

Re-open this ADR if **any** holds:

| Trigger | Threshold | Source |
|---|---|---|
| Budget headroom shrinks | extended total > 39,200 chars (80 %) | `check_always_budget.py` warn band |
| Budget headroom critical | extended total > 44,100 chars (90 %) | `check_always_budget.py` fail band |
| New kernel candidate | a rule satisfies all 5 kernel-membership criteria | `docs/contracts/kernel-membership.md` § 1 |
| Per-rule cap pressure | any kernel rule > 5,500 chars (raw) | top-3 ≤ 24,500 ext implies single-rule pressure |

## Strategy inventory (preconditions surfaced)

Five non-mutually-exclusive levers. Council Round 2 surfaced that **preconditions must be validated before strategies are scored**, not deferred to Phase 3 — folded in below.

### S1 — Demote always → auto

- **Description:** Move a kernel rule to auto-tier with a precise `triggers:` description.
- **Precondition (gating):** Host-agent Auto-description honour-rate ≥ 95 % over a 50-interaction sample. **Unvalidated. Pilot required before S1 is scoreable.** Pilot design: instrument `router.json` lookups, count fire-events per rule, compare against a control rule that stays always-on.
- **Char delta estimate:** −1,000 to −3,000 (per demoted rule).
- **Risk:** Silent regression — an Auto rule that fails to fire is invisible until an Iron Law breach reaches the user.
- **Compression tier:** N/A (structural move).

### S2 — Merge two kernel rules

- **Description:** Combine two adjacent kernel rules whose Iron Laws compose without contradiction.
- **Precondition (gating):** **Trigger-condition orthogonality matrix**, not vocabulary overlap. Council Round 2: vocabulary similarity ≠ semantic composability. Pair scores merge-safe iff trigger sets are provably disjoint AND Iron Laws have non-conflicting fences.
- **Candidate pairs (vocabulary-flagged, orthogonality unverified):** `ask-when-uncertain` + `no-cheap-questions` (both ask-policy, likely overlapping triggers — hazard); `commit-policy` + `non-destructive-by-default` (commit-policy is an exception-list, NDBD is a hard floor — orthogonal, candidate).
- **Char delta estimate:** −500 to −1,500 (per merge, after de-duplication).
- **Risk:** Iron Law collision on overlapping trigger paths; reduced citability.
- **Compression tier:** N/A (consolidation).

### S3 — Hard-compress (three-tier model)

Council Round 2 forced tier discipline. "Lossless" must be defined per tier:

| Tier | Compress | Risk | Char delta |
|---|---|---|---|
| **Tier 1 (safe)** | redundant restatements, duplicate examples, prose → tables | none — losslessly recoverable | −300 to −800 / rule |
| **Tier 2 (risky)** | failure-mode catalogues → context link, examples → context link | rhetorical weight loss; rule still fires but cited less | −500 to −1,200 / rule |
| **Tier 3 (unsafe)** | Iron-Law motivational framing, fence repetitions | rule stops firing — DO NOT compress | 0 (forbidden) |

- **Precondition (gating):** Each candidate line classified into a tier before the char-delta is counted.
- **Char delta estimate:** −2,500 to −5,000 across the kernel (Tier-1 + Tier-2 only).
- **Risk:** Tier-2 compression silently weakens Iron Law adherence; needs golden-outcome regression check.

### S4 — Top-rule rewrite

- **Description:** The largest kernel rule is `language-and-tone` at 3,988 chars (raw). Rewrite from scratch under a 3,000-char target.
- **Precondition (gating):** Iron-Law-to-prose ratio measured. `language-and-tone` carries one Iron Law (mirror language) plus the pre-send gate, plus the labeled-anchor exception. Three load-bearing fences — rewrite candidate, but breakage-prone.
- **Char delta estimate:** −1,000 (3,988 → 3,000).
- **Risk:** High — kernel-membership criterion 3 (pre-send gate) is exactly what `language-and-tone` carries; rewrite must preserve the gate verbatim.

### S5 — Shared-context amortisation (N-rule sharing)

- **Description:** Phase 2A killed the *single*-rule split (citation tax > rule gain). N-rule sharing was not ruled out: ≥ 3 rules citing the same context block amortise the citation tax.
- **Precondition (gating):** **Break-even N calculation.** Citation format `[see: context-id]` ≈ 30 chars. A 500-char shared context breaks even at N = 2 inline equivalents. A 1,500-char context needs N = 3+. Per-context calculation, not a global N.
- **Existing ≥ 3-rule contexts:** `asking-and-brevity-examples` (cited by `ask-when-uncertain`, `no-cheap-questions`, `direct-answers` — 3 rules, candidate), `language-and-tone-examples` (cited by `language-and-tone` only — 1 rule, not yet eligible).
- **Char delta estimate:** −300 to −900 per shared context (only when N ≥ break-even).
- **Risk:** Low — the citation tax is paid regardless; the question is whether the inline content exceeds it.

## Picked strategy

**Primary: S3 (Hard-compress, Tier-1 + Tier-2 only).**
**Fallback: S5 (N-rule sharing on `asking-and-brevity-examples`).**

Rationale (5-axis scoring, 1 = best, 5 = worst):

| | char delta | breakage risk | effort | reversibility | downstream coupling | Σ |
|---|---|---|---|---|---|---|
| S1 Demote | 1 | 5 | 2 | 4 | 3 | 15 |
| S2 Merge | 3 | 4 | 3 | 5 | 4 | 19 |
| **S3 Hard-compress** | **1** | **3** | **2** | **2** | **2** | **10** |
| S4 Rewrite | 3 | 5 | 4 | 5 | 3 | 20 |
| **S5 N-rule sharing** | **3** | **2** | **2** | **2** | **2** | **11** |

S3 wins on char-delta-per-risk; S5 is the cheap-fallback if S3 hits a Tier-3 fence by accident. S1 and S4 carry the highest breakage risk; only consider after S3 + S5 are exhausted. S2 is gated on the trigger-orthogonality matrix — neither candidate pair has been formally checked.

## Out of execution scope

Phase 3 (rule edits), Phase 3.3 (baseline update), and the recovery-band retirement remain **deferred** until a reactivation trigger fires. Phase 4 (slow-rollout note + CI guard) is **independently valuable** and ships in this same roadmap pass — it codifies governance regardless of current budget.

## References

- Empirical predecessor: [`adr-always-rule-context-split-not-viable.md`](adr-always-rule-context-split-not-viable.md)
- Kernel contract: [`docs/contracts/kernel-membership.md`](../../docs/contracts/kernel-membership.md)
- Router: [`docs/contracts/rule-router.md`](../../docs/contracts/rule-router.md)
- Council raw: `agents/council-responses/always-budget-relief.json` <!-- council-ref-allowed: ADR contract decision trace -->
- Roadmap source (transient): see `agents/roadmaps/` — title `road-to-always-budget-relief`
