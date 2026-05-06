# ADR-002 — Kernel-Bucket Cap Raise (25k → 26k) and Per-Rule Iron-Law Overrides

- **Status:** Accepted (2026-05-06)
- **Phase:** Road to Rule Kernel and Router · P2.2 (Heavy Compression)
- **Supersedes:** none — extends the Council R2 amendments locked in
  `docs/contracts/kernel-membership.md` § 5.1 (median r=0.712, per-rule cap 2.5k,
  kernel-bucket 25k).
- **Related:** ADR-001 (kernel-swap deferred); Council R2 cross-check session
  `agents/council-sessions/20260506T044941Z-phase1-cross-check-r2.json`. <!-- council-ref-allowed: ADR decision trace -->

## Context

P1.3 projected the post-compression kernel bucket at **23 071 chars** using
the median pilot ratio r=0.712 (3 pilots: agent-authority, direct-answers,
language-and-tone). Pilot rules were **short to medium** (1.0k–2.5k baseline).

P2.2 applied the same compression discipline to the remaining 6 kernel rules
(ask-when-uncertain, commit-policy, no-cheap-questions,
non-destructive-by-default, scope-control, plus the verify-before-complete
auto-tier rule kept by ADR-001). Iron-Law SHA preservation verified for
all 8 rules with Iron-Law fences (`scripts/iron_law_sha.py`).

**Empirical post-compression measurements (2026-05-06):**

| metric | projected | actual |
|---|---:|---:|
| kernel bucket sum | 23 071 | **25 590** |
| compression ratio r (kernel-wide) | 0.712 (median pilot) | **0.795** |
| rules > 2.5k cap | 2 (pilots) | 6 |
| rules > 4.0k ceiling | 0 | 0 |

The actual ratio (0.795) is worse than the pilot median (0.712) because
**longer rules compress less efficiently than short ones**: each Iron-Law
rule has a fixed payload of frontmatter, Iron-Law fence, exception
enumeration, see-also list — shrinkage is bounded by what cannot leave
the rule without breaking the rule's contract. The 5 longest source rules
(non-destructive-by-default, scope-control, no-cheap-questions,
ask-when-uncertain, language-and-tone) each kept multiple
non-externalisable structural elements (Iron-Law fence + trigger
enumeration + pre-send self-check + decline/fence semantics).

## Decision

1. **Raise KERNEL_HARD from 25 000 → 26 000 chars** in
   `scripts/measure_rule_budget.py`. KERNEL_TARGET stays at 20 000.
   This accommodates the empirical 25 590 with ~410 chars headroom for
   future minor edits (typo fixes, link updates, frontmatter tweaks)
   without re-tripping the gate.

2. **Add the following 6 kernel rules to `docs/contracts/iron-law-overrides.txt`**
   with this ADR as their justification. All sit between 2.5k and 4.0k
   (the override ceiling):

   | rule | chars | + over 2.5k | < 4.0k ceiling |
   |---|---:|---:|---|
   | `language-and-tone` | 3 602 | +1 102 | ✓ |
   | `scope-control` | 3 641 | +1 141 | ✓ |
   | `non-destructive-by-default` | 3 420 | +920 | ✓ |
   | `no-cheap-questions` | 3 238 | +738 | ✓ |
   | `ask-when-uncertain` | 3 130 | +630 | ✓ |
   | `direct-answers` | 2 841 | +341 | ✓ |

3. **Cap stays sticky.** Future kernel additions or rule-body growth must
   either (a) compress within the 26k bucket, (b) externalise to a
   `contexts/authority/*` companion, or (c) require a follow-up ADR.

## Rationale

Each over-cap rule defends a **distinct Iron Law fence** that loses meaning
if split. Externalising the enumeration to a context file would force the
agent to load the context every time the Iron Law applies (i.e. always),
defeating the kernel-vs-auto split that motivates the budget in the first
place.

- `non-destructive-by-default` and `scope-control` carry the **Hard Floor**
  trigger table (prod-trunk merge, deploy, push, prod data/infra, bulk
  deletion) and the per-row example column. Splitting the table breaks
  matching at decision time.
- `no-cheap-questions` carries the **8-class cheap-question catalog** plus
  a 6-step Pre-Send Self-Check that must be evaluated before every
  numbered-options block — this is the gate, not a footnote.
- `ask-when-uncertain` carries the **vague-request trigger list** (9 user
  phrasings the agent must recognise without scrolling to a context file).
- `language-and-tone` carries the **pre-send language gate** for every
  reply token (prose, headings, table cells, inter-tool commentary,
  Recommendation: vs Empfehlung: label) — splitting loses the exhaustive
  catalog the agent matches against.
- `direct-answers` carries **3 Iron Laws** (no flattery, no invented facts,
  brevity by default) plus the severity-tiered claim table — already the
  most condensed form of these obligations.

The `commit-policy` rule was trimmed below 2.5k (2 354 chars) by removing
a redundant cross-reference line, demonstrating that aggressive trimming
is possible where the rule does not carry an enumeration. The 6 overrides
are the rules where further compression would force semantic loss.

## Consequences

- **Pro:** Iron-Law fidelity preserved — every fence still byte-identical
  to baseline (verified by `iron_law_sha.py --all-kernel`).
- **Pro:** Empirical compression r=0.795 documented; future kernel work
  uses this as the realistic ratio (not 0.712, which was a pilot-skewed
  optimum).
- **Pro:** Override ceiling (4 000) untouched — no rule grows
  unboundedly; the 4k cap remains the next checkpoint.
- **Con:** 25 590 / 26 000 = 98.4 % bucket utilisation. Adding any
  10th kernel rule would require either compression of an existing rule
  or a further cap raise.
- **Con:** ratio 0.795 means future "always" promotions cost more than
  Phase 1 estimated. Phase 4 token-budget measurements should treat
  0.795 as the reference compression rate.

## Rollback

If Phase 4 token measurements show that the kernel adds > 10 % to the
agent's per-turn token cost (`docs/contracts/kernel-membership.md` § 6
abort criteria), revisit:

1. Demote `verify-before-complete` from kernel to auto (saves 2 344 chars,
   bucket → 23 246, falls back inside 25k).
2. Or split `scope-control` into git-ops and decline/fence halves —
   git-ops stays kernel, decline/fence becomes auto-tier.

Both moves are reversible; this ADR does not lock either out.
