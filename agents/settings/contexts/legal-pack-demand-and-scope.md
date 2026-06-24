# Legal pack — demand signal + scope decision (domain-adoption Gate 1 + Gate 3)

> Context note recording the `domain-adoption-policy` evidence so the case is not
> relitigated. Companion to ADR-107 and `agents/roadmaps/road-to-legal-pack.md`.

## Gate 1 — demand signal (met)

- **Named user direction with target.** A user-named request to bring legal
  capabilities into the suite, in an **EU/DE / GDPR** company context (the
  binding target use case).
- **Existing anchors** the pack builds on: `contracts-cognition`,
  `privacy-review`, `data-handling-judgment`, `data-flow-mapper`,
  `domain-safety-disclaimer` (legal sector).

## Gate 3 — CI-tooling decision (met: validated, not platform-bound)

Legal skills are **validated**, not platform-bound: `skill_linter` +
trigger-evals + the legal-pack linters (disclaimer-presence, jurisdiction-tag,
freshness) + the Phase-3 regression harness. No simulator / GPU / hardware
dependency. The eval is a regression/consistency harness (measurement
objectivity), not a correctness oracle — correctness stays licensed-attorney
review on material use.

## Gate 2 — maintenance owner (OPEN — blocks enabling the pack)

Still requires the user to confirm a single maintenance owner + a refresh
cadence (quarterly minimum) **and** an external/adversarial qualification check
of EU/DE legal-domain competence (not self-assessment). Until confirmed, the
pack ships `experimental` / `lab` tier and is not enabled by default.

## Scope (locked)

**EU/DE-only, hard refusal** for out-of-scope jurisdictions. Scope is a config
decision in the `legal-safety-floor` rule + the pack description, surfaced via a
machine-checkable `Jurisdiction:` tag. Expansion is a future owner decision,
gated on its own currency promise.
