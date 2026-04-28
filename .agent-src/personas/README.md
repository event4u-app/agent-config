# Personas

> Reusable **review lenses** as a first-class primitive. A persona
> declares a *voice*: focus, mindset, unique questions, output
> expectations. Skills cite personas in a `personas:` frontmatter key.
> Users invoke them via `--personas=<id>`.

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

Frontmatter (all keys required unless noted):

| Key | Type | Notes |
|---|---|---|
| `id` | string | lowercase-hyphenated, must match filename stem |
| `role` | string | human-readable role name |
| `description` | string | one sentence, ≤ 160 chars |
| `tier` | `core` \| `specialist` | Core = always-loaded cast; Specialist = opt-in |
| `mode` | string (optional) | advisory link to a role-contract workflow mode |
| `version` | string | semantic version; bump on breaking changes |
| `source` | string | `package` for personas shipped here |

Required sections (checked by the linter):

1. **Focus** — one paragraph, the lens.
2. **Mindset** — bullets, default assumptions and skepticism.
3. **Unique Questions** — ≥ 3 questions no other persona asks.
4. **Output Expectations** — how findings are phrased.
5. **Anti-Patterns** — what this persona must refuse to do.

Size budget: **Core ≤ 120 lines, Specialist ≤ 80 lines**.

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

More specialists may land in v1.1+ — each must pass the
Unique-Questions heuristic before being drafted.

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
- See [`../templates/persona.md`](../templates/persona.md) for the
  exact template.

## Related

- [`../guidelines/agent-infra/role-contracts.md`](../guidelines/agent-infra/role-contracts.md) — workflow modes personas compose with
- [`../rules/artifact-drafting-protocol.md`](../rules/artifact-drafting-protocol.md) — mandatory per new persona
