---
adr: 107
status: accepted
date: 2026-06-24
decision: legal-domain-pack-adoption
supersedes: —
superseded_by: —
phase: road-to-legal-pack
type: prospective
---

# ADR-107 — Legal domain-pack adoption (EU/DE-scoped, procedure-only, evaluated honestly)

## Status

**Accepted** · 2026-06-24 · three AI-council rounds (anthropic/claude-sonnet-4-5 + openai/gpt-4o; the curl-timeout fix landed mid-series so rounds 2–3 ran two-voice). Implementing roadmap: `agents/roadmaps/road-to-legal-pack.md`.

## Context

`event4u/agent-config` had legal-adjacent anchors (`contracts-cognition`, `privacy-review`, `data-handling-judgment`, `data-flow-mapper`, `domain-safety-disclaimer` legal sector) but no legal **domain pack**. Opening one is a `domain-adoption-policy` decision (three gates: demand signal, named maintenance owner, CI-tooling). External legal-plugin references (a first-party suite + community packs) showed reusable patterns but enforce everything via prompt instructions only (empty hooks).

## Decision

Open a single, narrow `legal` pack — **not** a multi-plugin / multi-agent parity clone.

1. **Scope: EU/DE-only, hard refusal.** Every selectable jurisdiction is an implicit currency promise; for a single maintainer the smallest correct cut is EU/DE with "consult local counsel" for everything else. Encoded in the `legal-safety-floor` rule + the pack description; surfaced via a machine-checkable `Jurisdiction:` tag.
2. **Safety-floor first.** `rule:legal-safety-floor` + its deterministic linters land before any drafting skill (a drafting skill before its floor is the exact liability the floor prevents).
3. **Skills ship procedure + output template only — no default legal positions.** Positions live in a practice profile (`legal-practice-profile`).
4. **Deterministic hardening is the differentiator.** Disclaimer-presence, jurisdiction-tag, and freshness linters; privilege markers extend `domain-safety-pii` + `lethal-trifecta-guard` (no new hook unless the extension demonstrably fails).
5. **Eval = regression/consistency harness, not a correctness oracle.** Self-labeled fixtures narrowed to the maintainer's genuine-competence domain (EU DPA / GDPR Art. 28) with spot-validation; a multi-attorney gold set (inter-annotator ≥0.7) is a **demand+funding-gated** track, NOT parity-gated (legal matching is classification, not the finding-count distributions the cross-model-parity keystone calibrates). The eval achieves *measurement* objectivity (reliable regression detection), never *ground-truth* objectivity — correctness stays attorney review.
6. **No personas** — procedure-not-personality; role focus lives in skill tags + the practice profile.
7. **Conditional product-liability gate** — commercial (Pro-tier) ship requires licensed-attorney review of the pack itself.

## Rejections (recorded)

matter-workspace (too heavy), scheduled watchers, community-skill installer hub, US-state employment tests, full litigation depth, bar-prep, Swiss cantonal depth, non-EU/DE jurisdictions, the cross-model-parity dependency for the eval (a false blocker, corrected in the full critique round).

## Consequences

- The pack ships `trust_level_default: experimental` / `surface_tier: lab` — **gated** until the Gate-2 maintenance owner + external qualification check is confirmed (a human gate this ADR cannot self-satisfy).
- A reusable domain-pack sequence (Safety-Floor → Enforcement → Evals → Skills → Practice-Profile) is **documented retrospectively**, validated against a second domain before promotion to a rule (per `domain-pack-extraction-when-triggered`, N=2) — it does not drive legal's design.

## Alternatives considered

Jurisdiction-neutral-with-EU-default (rejected — maximizes the maintenance surface the binding constraint exists to cut); objective eval pack at N=1 (rejected — manufactures false objectivity without a funded attorney gold set); ≤2 legal personas (rejected — decoration with maintenance cost, no incremental safety).

## References

- [`agents/roadmaps/road-to-legal-pack.md`](../../agents/roadmaps/road-to-legal-pack.md)
- [ADR-013 — Discovery Frontmatter Contract](ADR-013-discovery-frontmatter-contract.md) (vocabulary amendment, same series)
- `rule:legal-safety-floor`, `rule:domain-adoption-policy`, `rule:domain-safety-disclaimer`
