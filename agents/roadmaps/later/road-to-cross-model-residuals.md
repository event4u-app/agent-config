---
complexity: structural
status: later
parent_roadmap: road-to-operator-runtime-harvest
---

# Road to cross-model residuals — the human/external-triggered remainder

> **Parked (`later/`).** The core of `road-to-operator-runtime-harvest` (archived
> at `agents/roadmaps/archive/road-to-operator-runtime-harvest.md`) is complete:
> the cross-model keystone was built and run live, the format divergence fixed,
> the finding_floor mechanism shipped, and the canary wired. What remains are
> residuals that **cannot proceed autonomously** — each needs a human decision,
> an external trigger, or parallel-owned work. They are parked here, intact, so
> nothing is lost and the parent can archive cleanly.

## Resume when / Trigger

This roadmap as a whole resumes when **any** item's trigger below fires. There is
no single blocking condition — each item carries its own (per-item reopen gates).
Nothing here is on a clock; pick an item up when its trigger is real.

## Phase A — finding_floor calibration (needs humans)

- [ ] Build a **labeled gold set** — human-judged substantive findings on ≥10 sample tasks, with **≥0.7 inter-annotator agreement**. <!-- Trigger: a maintainer allocates ≥2 human annotators. Inherently human — a self-generated set is the teaching-to-the-test trap the parent's ethos forbids. -->
- [ ] Set the `finding_floor` **per-host-dynamic** from real per-host distributions. <!-- Trigger: the gold set exists AND a behavioral-execution harness (runs a skill's evals.json per host, counts output findings — distinct from the routing smoke) is built. -->

## Phase B — overlays (gated on a real behavior gap)

- [ ] Build per-host `model-overlays` only for a host that genuinely fails RDP. <!-- Trigger: a capability-controlled cross-model re-run (comparable tiers, not the weakest-tier smoke) exposes a real behavior gap on a specific host. Until then the honest-null stands; do not build speculatively. -->

## Phase C — size-budget undershoot (reopen on incident)

- [ ] Add an undershoot floor + audited override to the budget guard. <!-- Trigger: a real truncation incident. No incident has occurred; building now would be speculative governance against a non-problem, touching delicate CI-tuned scripts. -->
- [ ] Catalog-token target (sum of always-on descriptions ≤ threshold). <!-- ~already covered by the 49,512-char always-prompt cap in measure_augment_budget (descriptions are already counted). Reopen only on a distinct, evidenced need. -->

## Phase D — product surface

- [ ] QA real-browser skill (pure orchestration over the Playwright skills + an enforcement gate). <!-- Trigger: a user-initiated drafting session — a new skill needs the artifact-drafting-protocol (Understand→Research→Draft), not a mechanical autonomous build. -->
- [ ] Repositioning narrative ("cross-model governed agent infrastructure"). <!-- Owned by the parallel draft `road-to-positioning-and-enforcement.md`. Reopen here only if that draft is abandoned. Note: the wider run showed parity is not yet clean (tier-confounded ~15pp spread), so the narrative is not yet earned regardless. -->

## Provenance

Sibling of the archived parent (`archive/road-to-operator-runtime-harvest.md`),
which carries the Source-A provenance (`ENC1:` token in its § Provenance). These
residuals are this package's own follow-up work; no external source attribution
is needed here.
