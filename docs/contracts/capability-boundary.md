# Capability Boundary Matrix

The per-pack safety posture at a glance: is a pack on by default, does it need
consent, a council pass, a disclaimer, an eval — and how risky is it. The matrix
makes the invisible visible; the **enforcement** lives in the per-pack safety
floors + gates (this doc is the map, not the engine).

> Source of truth: `src/config/discovery/packs.yml` (`surface_tier`,
> `trust_level_default`, `domain`, and the legal-review-prep gate fields) + the
> domain safety-floor rules. Built in `road-to-capability-governance` Phase 1;
> `risk_class` becomes a real pack field in Phase 2.

## Policy by risk class

| `risk_class` | default install | consent | council / deep-research | disclaimer | eval expectation | surface_tier |
|---|---|---|---|---|---|---|
| **low** | per profile | no | no | no | optional | `core` |
| **medium** (advisory) | per profile | no | no | **yes** (domain safety floor) | recommended | `core` |
| **high** | **no** (opt-in) | **yes** | **yes** (fail-closed) | **yes** | **yes** | `lab` |

- **low** — engineering, product, meta, and tooling packs. Normal capability; no domain liability surface.
- **medium (advisory)** — packs that emit advisory-shaped output (finance, strategy). They carry a **domain safety floor** that mandates a not-X-advice disclaimer + structural elements (assumptions / counter-case / confidence). Not off-by-default, but never a final call.
- **high** — regulated-advice-adjacent. Off by default, consent-gated, council-gated (fail-closed), disclaimer-bound, eval-backed, lab-tier, and promotion-gated behind a professional review.

## Per-pack assignment (non-low)

| Pack | `risk_class` | Floor | Gates |
|---|---|---|---|
| `legal-review-prep` | **high** | `legal-safety-floor` | consent (`legal_review_prep.acknowledged`) · council (`require_council`, fail-closed) · hard individual-case STOP · attorney-review line + `Jurisdiction:` tag · attorney-framing-review promotion tripwire · `default_install: false` · `surface_tier: lab` |
| `finance-basic` | medium | `finance-safety-floor` | not-financial-advice disclaimer · assumptions + sensitivity + confidence + counter-case · no final invest/raise call |
| `finance-advanced` | medium | `finance-safety-floor` | as finance-basic (DCF / scenario depth) |
| `founder-strategy` | medium | `strategy-safety-floor` | not-a-strategic-decision footer · bet + counter-case + residual risk + decision owner |

Every other pack in `packs.yml` is **low** by default. A pack moves to medium the
moment it ships advisory-shaped output behind a domain safety floor, and to high
only through the high-risk checklist (consent + council + disclaimer + eval +
lab + promotion gate) — see `road-to-legal-review-prep` for the worked example.

## Capability lifecycle (a view, not a new axis)

Reviewers wanted one lifecycle vocabulary for promoting / retiring capabilities.
This is a **derived view** over the metadata that already exists
(`trust_level_default` + `surface_tier` + eval presence) — **not** a new field.
Nothing to set; it is read off what is already there.

| Lifecycle | Derived from | Promotion criterion (to reach it) |
|---|---|---|
| **experimental** | `surface_tier: lab` **or** `trust_level_default: experimental` | default for any new pack/skill |
| **validated** | `surface_tier: core` **and** has an `evals/` (or regression harness) | a real eval exists + the pack left lab |
| **recommended** | validated **and** in a default profile / ≥1 real consumer | adoption evidence, not just existence |
| **deprecated** | a `deprecated`/`superseded_by` marker in frontmatter | a successor named (per the persona/skill deprecation discipline) |

Read the lifecycle column off the matrix above: a `lab` + `experimental` pack
(e.g. `legal-review-prep`, `ai-video`) is **experimental**; a `core` pack with an
eval is **validated**; a `core` pack a profile ships is **recommended**.
Promotion stays a human/maintainer decision (criteria-documented, never
automated — see `road-to-capability-governance` Phase 6).

## See also

- [`legal-safety-floor`](../../src/rules/legal-safety-floor.md) — the high-risk exemplar.
- `finance-safety-floor` · `strategy-safety-floor` — the medium-risk advisory floors.
- [`domain-pack-architecture`](../guidelines/agent-infra/domain-pack-architecture.md) — the pack build sequence.
- `road-to-capability-governance` Phase 2 — `risk_class` as a validated pack field.
