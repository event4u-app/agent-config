---
stability: beta
---

# Persona Schema — two-tier (Core / Specialist)

> **Status:** active · **Stability:** beta · **Owner:** road-to-better-skills-and-profiles Block A
> · **Linter:** `scripts/skill_linter.py § lint_persona`
> · **Source-of-truth dir:** `.agent-src.uncompressed/personas/`
> · **Council verdict:** iter-1 A-OQ1 (c) — hybrid

Locks the canonical persona shape: a uniform frontmatter across both
tiers, a 5-section spine for Core, and a 7-section spine for Specialist
(Core-5 + Critical Rules + Workflows). Existing Core personas are
**not migrated** — the schema accepts the v1 shape that already ships.

## § 1 — Frontmatter (uniform across tiers)

| Key | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | lowercase-hyphenated, must match filename stem |
| `role` | string | yes | human-readable role name |
| `description` | string | yes | one sentence, ≤ 160 chars |
| `tier` | enum | yes | `core` \| `specialist` |
| `mode` | string | optional | advisory link to a role-contract workflow mode |
| `version` | string | yes | semver; bump on breaking changes |
| `source` | enum | yes | `package` \| `project` |

`personas:` is the consumer-side citation key (used in skill
frontmatter); it is **not** part of a persona's own frontmatter.

## § 2 — Tier definitions

### `core` — always-loaded cast

The six lenses every multi-lens skill leans on by default:
`developer` · `senior-engineer` · `product-owner` · `stakeholder`
· `critical-challenger` · `ai-agent`. Stable v1 shape; council
verdict explicitly forbids migration to the 7-section spine — it
would dilute the always-loaded cost without adding signal.

### `specialist` — opt-in lens

Domain-narrow voices a skill cites only when its specific axis is in
play (e.g. `qa` for testability, `backend-architect` for system
boundaries). Specialists carry the 7-section spine because their
narrower scope justifies — and benefits from — explicit Critical
Rules and Workflows blocks (pattern adopted from
`alirezarezvani/claude-skills`).

## § 3 — Required sections per tier

### Core (5 sections, ≤ 120 lines)

1. **Focus** — one paragraph, the lens.
2. **Mindset** — bullets, default assumptions and skepticism.
3. **Unique Questions** — ≥ 3 questions no other persona asks verbatim.
4. **Output Expectations** — how findings are phrased.
5. **Anti-Patterns** — what this persona must refuse to do.

### Specialist (7 sections, ≤ 100 lines)

1. **Focus**
2. **Mindset**
3. **Unique Questions** — ≥ 3, same heuristic
4. **Output Expectations**
5. **Anti-Patterns**
6. **Critical Rules** — non-negotiable invariants this lens enforces
   (e.g. "every new branch needs a failing test before the fix").
   Bulleted, declarative, ≤ 8 items.
7. **Workflows** — concrete review / inspection steps the persona
   runs against the skill's input. Numbered, deterministic, ≤ 6 steps.

`Composes well with` is permitted as an additional section in either
tier (kept for v1 personas that ship it; not required, not budget-counted
beyond the global line cap).

## § 4 — Size budgets

| Tier | Section count | Line cap | Rationale |
|---|---|---|---|
| `core` | 5 | ≤ 120 | always-loaded, stay lean |
| `specialist` | 7 | ≤ 100 | opt-in, denser per section |

The line cap is enforced by `lint-skills` against the full file
including frontmatter and trailing blank line.

## § 5 — Schema enforcement

The linter (A2 work) enforces:

- frontmatter shape (table in § 1)
- tier enum
- required sections per tier (§ 3)
- size budget per tier (§ 4)
- ≥ 3 bullets in `Unique Questions`
- `id` matches filename stem
- description ≤ 160 chars

Specialist authors must use the template at
`.agent-src.uncompressed/personas/_template-specialist/persona.md`.
Core authors continue to use
`.agent-src.uncompressed/templates/persona.md` (unchanged).

## § 6 — Persona inventory (v1 snapshot)

| ID | Tier | Mode | Status |
|---|---|---|---|
| `developer` | core | developer | shipped |
| `senior-engineer` | core | reviewer | shipped |
| `product-owner` | core | product-owner | shipped |
| `stakeholder` | core | planner | shipped |
| `critical-challenger` | core | reviewer | shipped |
| `ai-agent` | core | developer | shipped |
| `qa` | specialist | tester | shipped (existing 6-section shape; A-track migration to 7-section spine planned alongside A3 batch) |

A3 adds four specialists drafted natively against the 7-section
spine: `backend-architect` · `eloquent-tamer` · `security-engineer`
· `frontend-engineer`.

## § 7 — Versioning

Section rename / add / remove → ADR + linter update + persona migrations
in the same PR. Tier rename or new tier is breaking and requires a
major version bump in the package release notes. Size-cap tightening
is breaking when it forces existing personas to lose content; size-cap
loosening is non-breaking.

## See also

- [`skill-domains`](skill-domains.md) — sister taxonomy for skills
- [`role-contracts`](../guidelines/agent-infra/role-contracts.md) — workflow-mode axis personas compose with
- `.agent-src.uncompressed/personas/README.md` — authoring entry point + Core-6 cast
- `.agent-src.uncompressed/personas/_template-specialist/persona.md` — specialist starter
- `.agent-src.uncompressed/templates/persona.md` — core starter (v1, unchanged)
- `road-to-better-skills-and-profiles.md` — Block A (schema lock + extension)
