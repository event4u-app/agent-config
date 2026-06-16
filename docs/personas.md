# Personas

Personas are **review lenses** the host agent adopts when running a
skill — not sub-agents, not execution modes. Each persona shapes
*what* the agent looks for in a diff, plan, or artifact; the host
identity, tools, and workflow stay the same.

This page catalogs the **24 active personas** shipped with
`event4u/agent-config` (6 core + 18 specialists), plus the 5
**advisor** personas in `personas/advisors/`. It also explains how
`personas:` (lens axis) interacts with `/mode` (role-mode axis).
Removed personas are deleted in-commit (no soak window) — see
[`persona-governance § Deprecation path`](../dist/agent-src/rules/persona-governance.md).

## Catalog — Core (always-loaded, 6)

| ID | Role | Wing | Owner | Lens summary |
|---|---|---|---|---|
| `developer` | Developer | — | package | Pragmatic implementer voice — what's the smallest correct change? |
| `senior-engineer` | Senior Engineer | — | package | Long-horizon impact — what does this look like in 6 months? |
| `stakeholder` | Stakeholder | — | package | Risk and politics — who owns the rollback if this fails? |
| `critical-challenger` | Critical Challenger | — | package | Devil's-advocate voice — what assumption is load-bearing here? |
| `ai-agent` | AI Agent | — | package | Tool-economy voice — token cost, prompt clarity, automation seam. |

Note: `product-owner` was reclassified to **specialist** at v2.0 — see below.

## Catalog — Specialists (opt-in, 20 active)

| ID | Role | Wing | Owner | Lens summary |
|---|---|---|---|---|
| `qa` | QA | — | package | Test coverage and regression gates. |
| `backend-architect` | Backend Architect | — | package | Service-layer boundaries, transaction scope, contract changes. |
| `eloquent-tamer` | Eloquent Tamer | — | package | N+1, query shape, ORM idioms that melt the database. |
| `security-engineer` | Security Engineer | — | package | OWASP-shaped failure modes, secret leakage, trust boundaries. |
| `frontend-engineer` | Frontend Engineer | — | package | Component lifecycle, reactive state, hydration boundaries. |
| `product-owner` | Product Owner | — | package | Outcomes named, AC unfalsifiable, scope on record. |
| `tech-writer` | Tech Writer | — | package | Release narratives, READMEs, AGENTS.md thin. |
| `revops-maintainer` | RevOps Maintainer | — | package | Contributor lifecycle, package adoption funnel, release readiness. |
| `discovery-lead` | Discovery Lead | — | package | Switch events, falsifiable hypotheses, theme ranking. |
| `hollywood-director` | Hollywood Director (`ai-video`) | — | package | Live-action lens, lighting, blocking, negative constraints. |
| `ai-video-technical-director` | AI Video Technical Director (`ai-video`) | — | package | Provider tuning — Veo / Kling / Sora / Higgsfield / OpenAI grammar. |
| `brand-strategist` | Brand Strategist (`design`) | — | package | Positioning, archetype, voice, messaging; challenges weak briefs. |
| `design-director` | Design Director (`design`) | — | package | Art-direction and brand-aligned visual judgment; composition, hierarchy, vector-vs-raster. |
| `cmo` | CMO | 3 | package | Positioning anchored, messaging stacked, launches sequenced. |
| `growth-pm` | Growth PM | 3 | package | Leaky-bucket vs growth-loop classified, activation correlated. |
| `customer-success-lead` | Customer Success Lead | 3 | package | TTFV falsifiable, churn cause split, expansion pulled, NRR. |
| `revops` | RevOps | 3 | package | Stage exit criteria, MEDDIC slots, forecast falsifiable. |
| `engineering-manager` | Engineering Manager | 4 | package | 1:1 cadence, hiring loop, throughput-vs-morale tradeoff. |
| `people-strategist` | People Strategist | 4 | package | Team shape, comp bands, ramp definitions, feedback craft. |
| `finance-partner` | Finance Partner | 4 | package | Unit economics, runway, scenarios, the next 18 months. |
| `strategist` | Strategist | 4 | package | Build-vs-buy, market entry, moat, vision, contracts, privacy. |

## Per-domain count (persona-governance cap: max 2 specialists per domain)

| Domain | Active specialists | Within cap |
|---|---|---|
| `ai-video` | `hollywood-director`, `ai-video-technical-director` | ✅ 2/2 |
| `design` | `brand-strategist`, `design-director` | ✅ 2/2 |
| GTM (Wing 3) | `cmo`, `growth-pm`, `customer-success-lead`, `revops` | ✅ (wing, not domain) |
| Ops / Money (Wing 4) | `engineering-manager`, `people-strategist`, `finance-partner`, `strategist` | ✅ (wing, not domain) |
| Backend | `backend-architect`, `eloquent-tamer` | ✅ 2/2 |

Per-domain count is enforced by `scripts/lint_persona_governance.py` (wired into `task ci`).

## Advisors (`personas/advisors/`, 5)

Adversarial / second-opinion voices invoked by `ai-council` debates,
not cited by skills directly:

| ID | Lens |
|---|---|
| `contrarian` | Opposing the consensus position |
| `executor` | Shipping bias — what's the minimum to land it? |
| `expansionist` | Scope-widening — what else does this unlock? |
| `first-principles` | Refuses analogy — derive from physics of the problem |
| `outsider` | Naive reader — does this hold without prior context? |

## Tier rules

- **Core (≤ 6)** — always-loaded cast. 5 sections (Focus · Mindset · Unique Questions · Output Expectations · Anti-Patterns), ≤ 120 lines.
- **Specialist** — opt-in lenses. 7 sections (Core-5 + Critical Rules + Workflows). Line cap is wing-scoped: ≤ 100 (no wing / Wings 1–2), ≤ 140 (Wings 3–4) per [`persona-schema § 4`](contracts/persona-schema.md).

Schema contract: [`docs/contracts/persona-schema.md`](contracts/persona-schema.md). Governance rule: [`persona-governance`](../dist/agent-src/rules/persona-governance.md).

## When to invoke a persona

- **A skill cites it.** Skills declare `personas:` in frontmatter; the
  agent adopts the listed personas while running the skill. No user
  action needed. Example: `judge-security-auditor` cites
  `security-engineer` — invoking the skill applies the lens.
- **You want a second pass on existing work.** Pick the specialist
  whose checklist matches the diff: `eloquent-tamer` for ORM heavy
  changes, `frontend-engineer` for component changes,
  `backend-architect` for service-seam changes.
- **Adversarial review.** `critical-challenger` for the devil's-advocate
  voice; `security-engineer` for abuse-case framing.

Invocation example (when supported by the host tool):

```text
--personas=backend-architect,security-engineer
```

The host agent reads the persona's `Critical Rules` and `Workflows`
sections (specialist tier) or `Mindset` and `Unique Questions` (core
tier) and merges them into its review pass.

## `personas:` vs `/mode` — two different axes

| Axis | What it controls | Example |
|---|---|---|
| `/mode` (role-mode) | Which **contract** the agent operates under for a turn — what outputs are mandatory, what work is refused | `/mode reviewer` refuses to write production code |
| `personas:` (lens) | Which **review checklists** the agent overlays on a skill's procedure | `personas: [security-engineer]` adds OWASP-shaped checks to whatever skill is running |

The two compose. `/mode reviewer` + `personas: [security-engineer,
backend-architect]` = a review-only turn that applies both the
security-abuse-case lens and the service-seam lens on top of the
review contract.

Personas are **not** a replacement for `/mode`. A persona cannot
refuse work or change output contracts; that is `/mode`'s job.

## Skill citations

Specialist personas need at least one skill citation to earn their
slot. Current cite map:

| Persona | Cited by |
|---|---|
| `qa` | `judge-test-coverage` |
| `critical-challenger` | `adversarial-review`, `requesting-code-review`, `receiving-code-review` |
| `developer` · `senior-engineer` · `product-owner` · `ai-agent` | `refine-ticket`, `refine-prompt`, `estimate-ticket` |
| `backend-architect` | `authz-review`, `api-design`, `blast-radius-analyzer` |
| `eloquent-tamer` | `eloquent`, `database` |
| `security-engineer` | `judge-security-auditor`, `threat-modeling`, `authz-review` |
| `frontend-engineer` | `existing-ui-audit`, `fe-design` |
| `brand-strategist` | `brand`, `brand-strategy` |
| `design-director` | `brand-identity`, `logo-generation`, `brand-asset-generation` |

Add a citation by appending `personas: [<id>]` to the skill's
frontmatter — never overwrite an existing list, append.

## Override pattern

Consumers can override any package-shipped persona via the standard
override mechanism:

- **Frontmatter override** — change `tier`, `mode`, `description`
  while keeping the package body. Frontmatter wins.
- **Body override** — full replace. Drop a same-named file under
  `agents/personas/<id>.md`; the package version is shadowed.

See [`override-management`](../dist/agent-src/skills/override-management/SKILL.md)
for the mechanics.

## Anti-patterns

- **Personas as agents.** Personas are lenses, not sub-agents. They do
  not spawn processes or run tools independently.
- **Personas as modes.** They do not change the host's contract or
  refuse work. Use `/mode` for that.
- **Specialist sprawl.** Cap is "≤ 4 specialists per plate" by the
  council A-OQ2 verdict. New specialists need ≥ 1 skill citation
  before merging.
- **Core-tier mutation.** Core personas are versioned (`version` in
  frontmatter); breaking changes need a new ID, not an in-place
  rewrite.
