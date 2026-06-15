---
adr: 097
status: accepted
date: 2026-06-15
decision: mission-recipe-privilege-boundary
supersedes: —
superseded_by: —
phase: road-to-mission-mode · Phase 0
type: security
---

# ADR-097 — Mission recipes vs user recipes — privilege boundary

## Status

**Accepted** · 2026-06-15. Lands Phase 0 of `road-to-mission-mode`.
Council-flagged risk: a user recipe smuggling a file-edit skill into a
trusted mission's gated sequence.

## Context

Mission-Mode introduces two artifact classes that compose AC skills:

1. **Mission recipes** — shipped in `src/missions/*`, version-controlled,
   reviewed, and released as part of the AC package.
2. **User / cookbook recipes** — authored by consumers in their own
   `agents/missions/` or via the cookbook pattern; not package-controlled.

Both can invoke `/work` directives and, in principle, reference AC skills
by name. Without a privilege boundary, a user recipe could inject an
arbitrary skill (e.g. a file-write or secrets skill) between the gated
steps of a trusted mission, bypassing the human-gate sequence the mission
was designed around. This is a privilege-escalation vector analogous to
a confused-deputy attack.

The `lethal-trifecta-guard` rule (private-data + untrusted-content +
external-comms) identifies this shape as the canonical high-risk agent
pattern. A user recipe that can call any skill is a potential trifecta
assembler.

## Decision

### Trusted missions (`src/missions/*`) — TRUSTED tier

- May invoke any AC skill directly by name in their phase sequence.
- May read `inputs`, `catalog`, and `verification` fields from their manifest.
- Shipped, reviewed, and signed off as part of AC's release process.
- The manifest schema (`src/scripts/schemas/mission.schema.json`) governs
  their structure; the linter enforces it.

### User / cookbook recipes — SANDBOXED tier

- **May** invoke trusted missions by name (e.g. `/mission:upgrade`).
- **May** invoke other user recipes.
- **May NOT** inject arbitrary AC skills between a trusted mission's steps.
- **May NOT** reference a skill unless that skill's frontmatter declares
  `user_invokable: true`.
- The `user_invokable` frontmatter key does not exist yet; it is reserved
  for the Phase 2 skill-annotation pass. Until Phase 2 ships, user recipes
  may invoke missions only — no direct skill invocation at all.

### Enforcement surface

| Layer | Mechanism |
|---|---|
| **Linter** | `scripts/lint_mission_recipes.py` (Phase 2) checks that recipe files under `agents/missions/` do not reference skills lacking `user_invokable: true` |
| **Schema** | `mission.schema.json` covers trusted missions; a separate `recipe.schema.json` (Phase 2) will cover user recipes |
| **Rule** | `lethal-trifecta-guard` remains the runtime defense; the privilege boundary is a pre-execution authoring gate |
| **Code review** | PRs adding `user_invokable: true` to any skill require the security-sensitive-stop review flow |

## Rationale

A user recipe that can call arbitrary skills can assemble the lethal
trifecta (read secrets → pass through untrusted web content → write to
filesystem) without the human-gate sequence a trusted mission provides.
Sandboxing user recipes to missions-only until `user_invokable` is
annotated keeps the threat surface minimal during Phase 0 and Phase 1,
when the execution model is still a validation PoC.

The `user_invokable` annotation approach (rather than a blanket allow/deny
at the recipe layer) lets the suite grow the safe surface incrementally as
each skill is audited — consistent with how `allowed_tools` works in skill
execution blocks.

## Consequences

### Accepted

- User recipes in Phase 0 and Phase 1 are limited to mission invocation
  only. This is intentional — Phase 1 is a PoC, not a product.
- Skill authors who want their skill callable from user recipes must
  explicitly opt in via `user_invokable: true` after security review.
- The linter gate ships in Phase 2, not Phase 0. Phase 0 is authoring-only;
  no executable recipes exist yet.

### Trade-offs

- More friction for power users who want to compose skills in recipes.
  Mitigation: the `user_invokable` path provides an explicit, auditable
  escape hatch rather than a blanket block.
- `user_invokable` key adds one more frontmatter field to the skill schema.
  Cost is low (one boolean); benefit is a machine-checkable privilege
  boundary.

## Alternatives considered

- **Allow user recipes to invoke any skill.** Rejected — directly creates
  the privilege-escalation vector this ADR is designed to prevent.
- **Block user recipes entirely.** Rejected — removes a legitimate power-user
  use case and makes the sandbox permanent rather than an interim gate.
- **Runtime enforcement only (lethal-trifecta-guard).** Rejected as
  insufficient — runtime detection is a safety net, not a substitute for
  authoring-time prevention, which is AC's stated differentiator.

## References

- `docs/contracts/no-runtime-boundary.md` — the boundary contract missions operate within
- `src/scripts/schemas/mission.schema.json` — trusted mission manifest schema
- `.agent-src.uncondensed/rules/lethal-trifecta-guard.md` — runtime defense layer
- `.agent-src.uncondensed/rules/security-sensitive-stop.md` — review gate for `user_invokable` additions
- `agents/roadmaps/archive/road-to-mission-mode.md` § Phase 0 — authoring context
