---
adr: 090
status: accepted
date: 2026-06-13
decision: visibility-command-frontmatter-field
supersedes: —
superseded_by: —
phase: command-surface-refactor-residuals
type: structural
---

# ADR-090 — First-class `visibility:` command-frontmatter field

## Status

**Accepted** · 2026-06-13. Decided by AI council (anthropic/claude-sonnet-4-5
+ openai/gpt-4o, peer-review, deep) — converged on **Option A** with execution
refinements. Council necessity-gate: borderline (3 necessary / 3 unnecessary);
proceeded on the standing reviewer ask plus design-intent evidence already in
the codebase (the `visibilityLabel(tier)` helper and the
`# Proxy until the 'visibility:' field lands` comment).

## Context

A reviewer repeatedly asked for a real
`visibility: visible | advanced | internal` command-frontmatter field instead of
overloading the integer `tier:` (`0/1/2`) as the visibility proxy
(`docs/contracts/command-surface-tiers.md`). All 150 command sources under
`src/domains/<pack>/<verb>/command.md` carry `tier:`; no `visibility:` field
existed.

Design-intent evidence already in the tree:

- `src/cli/commands/commands.ts` has `visibilityLabel(tier) →
  {0:'visible',1:'advanced',2:'internal'}` and a `--visible` filter on
  `VISIBLE_TIERS={0,1}`. The consumer surface already speaks "visibility",
  derived from the integer.
- `src/scripts/audit_command_surface.py` carries a standing comment:
  `# Proxy until the 'visibility:' field lands (6.0.0-C Step 4b)`.

`tier:` was always a backend integer encoding; "visibility" is the correct
domain concept for a classification surface consumed by humans and LLM routers.
Keeping the integer as the contract source of truth is a reversed abstraction.

## Decision

**Option A — `visibility:` becomes the classifier source of truth; `tier:`
stays as a derived, back-compat alias.**

1. Add an optional `visibility:` enum (`visible | advanced | internal`) to the
   command frontmatter schema. Keep `tier:` (`0/1/2`) in the schema as a
   back-compat alias.
2. Backfill `visibility:` on all 150 command sources, derived from the current
   `tier:` mapping: `0 → visible`, `1 → advanced`, `2 → internal`. Scripted +
   auditable (one diff, reviewable).
3. Repoint every reader to **prefer `visibility:`, fall back to `tier:`**:
   `commands.ts` (ls/explain), `audit_command_surface.py` (per-pack
   visible-command budget), `build_discovery_manifest.py`.
4. The discovery manifest is a **published data contract**. To avoid a silent
   breaking change for external consumers that read the integer `tier` key, the
   manifest **dual-emits** both `tier` and `visibility` during the deprecation
   window.
5. Validation is **backfill-first, then enforce**: once every command carries
   `visibility:`, the existing tier lint (`lint_command_tiers.py`) is extended
   to require `visibility:` present + a valid enum + consistent with `tier:`
   when both are set. No new standalone script; the check rides the existing
   lint that already runs in CI.

### Rejected alternatives

- **Option B — hard rename `tier:` → `visibility:`, drop `tier:`.** Cleanest
  end-state but largest blast radius and a hard break of the published manifest
  contract with no migration window. Deferred; may follow once the deprecation
  window closes.
- **Option C — keep `tier:` authoritative, add `visibility:` only as a
  validate-when-present label (category-field precedent).** Lowest blast radius
  but fails the phase acceptance criterion ("`visibility:` … is the classifier's
  source of truth").

## Consequences

- Two fields encode the same concept during the deprecation window → drift risk,
  mitigated by the lint consistency check (when both present, they must agree)
  and the scripted single-source backfill.
- External manifest consumers keep working (dual-emit); migration to read
  `visibility` can proceed on their own schedule.
- A future ADR may drop `tier:` (Option B end-state) once readers and the
  manifest have fully migrated; `tier:` removal is out of scope here.

## References

- `agents/roadmaps/archive/road-to-command-surface-refactor-residuals.md` — Phase 1.
- `docs/contracts/command-surface-tiers.md` — tier contract this field supersedes
  as the human-facing source of truth.
- ADR-048 — the `category:` validate-when-present precedent weighed against here.
