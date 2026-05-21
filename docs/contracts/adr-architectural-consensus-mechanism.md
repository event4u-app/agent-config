---
stability: beta
keep-beta-until: 2026-08-12
---

# ADR — Architectural Consensus Mechanism (bus-factor / multi-author readiness)

> **Status:** Decided · 2026-05-14
> **Context:** v2 council finding C1 (file [01-bus-factor-and-consensus.md](../../agents/runtime/council/sessions/2026-05-14-v2-analysis/feedback/01-bus-factor-and-consensus.md)) flagged that a single-author skill suite cannot detect ontology drift (two skills with overlapping triggers, drift between description and body, generic best-practice patterns repeated across clusters). The package needs a **mechanical consensus signal** that does not depend on the original author's judgment. <!-- council-ref-allowed: ADR decision trace -->
> **Roadmap:** Closes Phase 5.2 of the v2 feedback follow-up roadmap
> (see `agents/roadmaps/`).

## Decision

A **two-tier consensus mechanism**, layered by cost:

1. **Tier A — Automated ontology lint (every PR).** `scripts/skill_collision_clusters.py` produces `agents/runtime/reports/skill-collision-clusters.json`. New skills that fall into an existing collision cluster (description-vector similarity ≥ threshold or trigger-keyword overlap ≥ threshold) **break the build** unless paired with one of:
   - A routing rule (tier-2a path-prefix or tier-3 keyword) that declares ownership, OR
   - An ADR under `docs/contracts/adr-*.md` that names the trade-off.
2. **Tier B — ADR on first collision (per cluster, not per skill).** When Tier A flags a new collision and the author chooses to keep both skills, they write a one-page ADR naming what each skill owns and where the boundary lives. The ADR is **per cluster**, not per skill — adding a fourth `php-*` skill to an established `php-*` cluster does not require a new ADR; only the cluster's first ADR matters.

Tier C (external review per N skills) is **rejected** as standing process; it is reserved for major-version boundaries (v3, v4) where the host wants a one-shot external sanity pass.

## Why this was a real question

The three options from feedback file 01 were:

| Option | Cost | Detection power | Failure mode |
|---|---|---|---|
| (a) ADR per cluster | medium author cost, near-zero CI cost | high once written, zero before | author forgets to write the ADR; drift accumulates silently |
| (b) Automated ontology lint | low marginal cost per PR, one-time build cost | catches collisions at PR time; no semantic depth | flags noise (similar descriptions that own different surfaces); needs threshold tuning |
| (c) External review per N skills | high USD + calendar cost | high but lagged | gate fires too late; expensive |

Picking only (a) means the gate fires after the drift has already shipped (review of a written ADR ≠ detection of a missing ADR). Picking only (b) means the lint surfaces a number but the human still has to decide what to do with it. Picking only (c) means the gate fires once per quarter at best and costs real money.

The two-tier choice is the convener-skeptic synthesis: **(b) is the always-on gate, (a) is the high-signal moment (b) creates.** (c) stays reserved for the moments where neither (b) nor (a) can answer — and those moments are rare enough not to warrant standing process.

## Consequences

- **Author cost (steady-state):** zero. The lint runs in CI; the author only writes an ADR when they introduce a new cluster head.
- **Author cost (when collisions land):** one ADR per cluster, ~150-300 lines.
- **CI cost:** O(skills²) similarity scan; current 210 skills → ~22k pairs scanned at ms-each. Acceptable for `ci-fast`.
- **Reviewer cost:** the cluster ADR is the single review surface — reviewers don't have to re-derive the cluster boundary on every PR touching the cluster.
- **What this does not catch:** drift between a skill's description and its body. That is a different problem, addressed by `audit-descriptions` / `lint-skills` (already in CI).
- **What this does not replace:** the `skill-quality` Iron-Law rule (every skill must be executable, validated, self-contained) and `description-assist` (push-toward-trigger phrasing). Those remain author-time obligations.

## Rejected alternatives

- **(c) alone — external review per N skills.** Too expensive as standing process; gate fires too late to prevent drift.
- **Tier A as warn-only forever.** Defeats the purpose — drift accumulates if there is no fail-the-build state.
- **Persona-prompted self-review** (host runs sibling models). Rejected by `ai-council` skill (council convergence, 2026-05-06): same model, same blind spots, more cost.

## Acceptance test

- [x] `scripts/skill_collision_clusters.py` exists and emits `agents/runtime/reports/skill-collision-clusters.json`
- [x] `scripts/score_skill_selection.py` exists and emits `agents/runtime/reports/skill-selection-accuracy.json`
- [x] Phase 3 routing rules (`laravel-routing`, `symfony-routing`, `copilot-routing`, `devcontainer-routing`) demonstrate the tier-B response to a flagged cluster
- [ ] Lint promoted to `fail-the-build` once thresholds are confirmed stable across one full release cycle (currently `warn-only`)

The final acceptance gate (lint going from warn-only to fail-the-build) is deferred to the next release window so the threshold has time to settle without breaking PRs on borderline noise. Tracked as a follow-up in the next step-N roadmap.

## Related

- Origin: [`agents/runtime/council/sessions/2026-05-14-v2-analysis/feedback/01-bus-factor-and-consensus.md`](../../agents/runtime/council/sessions/2026-05-14-v2-analysis/feedback/01-bus-factor-and-consensus.md) <!-- council-ref-allowed: ADR decision trace -->
- Mechanical scripts: [`scripts/skill_collision_clusters.py`](../../scripts/skill_collision_clusters.py), [`scripts/score_skill_selection.py`](../../scripts/score_skill_selection.py)
- Sibling decision: [`docs/contracts/rule-router.md`](rule-router.md) — the routing layer the ADR feeds
- Sibling decision: [`docs/contracts/multi-tool-projection-fidelity.md`](multi-tool-projection-fidelity.md) — Phase 4 of the same roadmap
- Standing skill: [`.augment/skills/ai-council/SKILL.md`](../../.augment/skills/ai-council/SKILL.md) — the explicit-opt-in path for the rare moments tier C is invoked
