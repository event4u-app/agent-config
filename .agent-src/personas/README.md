# Personas

> Reusable **review lenses** as a first-class primitive. A persona
> declares a *voice*: focus, mindset, unique questions, output
> expectations. Skills cite personas in a `personas:` frontmatter key.
> Users invoke them via `--personas=<id>`.

> For end-user-of-the-software lenses (galabau field crew, truck
> driver, metalworking shop), see the parallel
> [`user-types/`](../user-types/README.md) axis — personas describe
> **how** we review (methodology), user-types describe **who** we
> simulate (end user). They compose orthogonally on the CLI:
> `--personas=qa --user-type=truck-driver`. No existing persona moves
> to `user-types/`.

## Why this directory exists

Before personas, every multi-lens skill (`adversarial-review`,
`judge-*`, `review-changes`, any future `refine-ticket`) reinvented
its own cast of reviewers. The taxonomies drifted, output became
untraceable, and new lenses were copy-pasted instead of reused.

Personas fix that: one definition, many skills.

## What a persona is — and is not

- **Is**: a small Markdown file declaring a voice. Passive reference
  content, loaded on demand by the skill that cites it.
- **Is not**: a skill. Personas never trigger by description. They
  do not appear in `<available_skills>`.
- **Is not**: a role-mode. Role-modes (see `role-contracts.md`) own
  the *workflow closing contract* axis. Personas own the *voice* axis.
  They coexist; a persona may declare an advisory `mode:` link.

## Schema

Locked in [`../../docs/contracts/persona-schema.md`](../../docs/contracts/persona-schema.md).
Two-tier hybrid (council iter-1 A-OQ1 verdict (c)):

- **Core** — 5 sections (Focus · Mindset · Unique Questions · Output
  Expectations · Anti-Patterns), ≤ 120 lines. Always-loaded cast.
- **Specialist** — 7 sections (Core-5 + Critical Rules + Workflows),
  ≤ 100 lines. Opt-in lens.

Frontmatter is uniform across tiers: `id · role · description · tier
· mode · version · source`. See the contract for full details and
the linter check list.

## The Core-6 (always-loaded cast, v1)

| ID | Tier | Focus |
|---|---|---|
| `developer` | core | implementation reality |
| `senior-engineer` | core | architecture impact, long-term risk |
| `product-owner` | core | outcome, testable AC, scope |
| `stakeholder` | core | business value, relevance |
| `critical-challenger` | core | fake clarity, hidden complexity |
| `ai-agent` | core | automation-readiness, safe execution |

## Specialists (opt-in)

| ID | Tier | Focus |
|---|---|---|
| `qa` | specialist | testability, failure scenarios |
| `hollywood-director` | specialist | live-action cinematic prompts — lens, lighting, blocking, negative constraints |
| `ai-video-technical-director` | specialist | provider tuning — Veo / Kling / OpenAI / Higgsfield / Sora grammar, token caps, audio flags |

More specialists may land in v1.1+ — each must pass the
Unique-Questions heuristic before being drafted. Removed personas
are deleted in-commit (no soak window) per
[`persona-governance § Deprecation path`](../rules/persona-governance.md).

## How skills use personas

Cite them in frontmatter:

```yaml
---
name: adversarial-review
personas: [critical-challenger]
---
```

Or accept a CLI-style override:

```
/refine-ticket --personas=po,senior-engineer
```

If `personas:` is omitted, the skill uses its documented default
cast (usually Core-6 for review skills, empty for others).

## Authoring rules

- Every persona is drafted via the `artifact-drafting-protocol` rule.
- Every persona must pass the Unique-Questions heuristic.
- Project-specific personas live in the consumer repo
  (`.agent-src/personas/` overrides), never in this package.
- **Core** template: [`../templates/persona.md`](../templates/persona.md) (5 sections, ≤ 120 lines).
- **Specialist** template: [`./_template-specialist/persona.md`](./_template-specialist/persona.md) (7 sections, ≤ 100 lines).

## Related

- [`../../docs/contracts/persona-schema.md`](../../docs/contracts/persona-schema.md) — locked schema (Core / Specialist)
- [`../../docs/guidelines/agent-infra/role-contracts.md`](../../docs/guidelines/agent-infra/role-contracts.md) — workflow modes personas compose with
- [`../rules/artifact-drafting-protocol.md`](../rules/artifact-drafting-protocol.md) — mandatory per new persona

## See also — sibling voice primitives

Personas are one of three voice primitives. Same shape (Markdown +
frontmatter), distinct purpose — **no folding, no shared schema**:

- [`../../docs/contracts/agent-user-schema.md`](../../docs/contracts/agent-user-schema.md) — `.agent-user.md`, the maintainer's own voice (`/post-as:me`, no disclosure footer).
- [`../../docs/contracts/ghostwriter-schema.md`](../../docs/contracts/ghostwriter-schema.md) — `agents/reference/ghostwriter/<slug>.md`, captured public-figure voice (`/ghostwriter:write` / `/post-as:ghostwriter`, mandatory disclosure footer).
