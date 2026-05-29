---
adr: 031
status: accepted
date: 2026-05-29
decision: validation-severity-tiers-and-projection-roundtrip
supersedes: —
superseded_by: —
phase: continue-positioning-analysis
type: structural
review_date: 2026-06-12
---

# ADR-031 — Adopt severity-tiered frontmatter validation + projection roundtrip test (from continuedev/continue analysis)

## Status

**Accepted** · 2026-05-29. Both changes are additive and verified
empirically in the same session (validator exit 0 on 455 artefacts with
0 fatal / 0 warnings; 9 roundtrip tests green), so the decision lands
**without** soak. Review date 2026-06-12.

## Context

A competitive-positioning pass against `continuedev/continue` (evidence:
[`agents/evidence/analysis/continue-positioning-2026-05-29.md`](../../agents/evidence/analysis/continue-positioning-2026-05-29.md))
established that Continue is a **projection target**, not a competitor — its
`.continue/rules/*.md` rules system consumes the artifact type this package
produces. Our multi-tool projection + condensation model is the strategic
moat and out-scopes Continue's single-target config.

Two patterns from Continue's config layer were worth adopting independent of
whether Continue is ever used here:

1. **Severity-tiered validation** — Continue's `core/config/validation.ts`
   splits fatal errors (halt load) from non-fatal warnings (logged, load
   continues). Our `scripts/validate_frontmatter.py` was binary: any
   `SchemaError` failed CI.
2. **Roundtrip validation** — Continue round-trips markdown → frontmatter →
   object → markdown in `packages/config-yaml/src/markdown/*.test.ts`. Our
   projection emitters (`scripts/condense.py`) had no test asserting that a
   source rule's load-bearing frontmatter survives the emit cycle.

Baseline at decision time: 0 artefacts currently violate `minLength` /
`maxLength`, so reclassifying length checks loosens nothing today.

## Decision

1. **Severity tiers in `scripts/validate_frontmatter.py`** — `SchemaError`
   gains a `severity` field (`"error"` default). Structural keywords
   (`required`, `type`, `enum`, `pattern`, `additionalProperties`,
   `minItems`, `minimum`) stay **fatal** (exit 1). Length keywords
   (`minLength`, `maxLength`) become **advisory warnings** (printed with
   `⚠️`, exit 0). `_main` partitions and reports both; only fatals fail CI.
2. **Projection roundtrip test** — `tests/test_projection_roundtrip.py`
   asserts `condense._emit_cursor_mdc` and `_emit_windsurf_rule` preserve
   `description` (newline-flattened) and the `alwaysApply` / `trigger`
   derivation across emit → re-parse.

Deferred (not adopted now):

- **`.continue/` projection target** — gated on real Continue usage in our
  projects. Until then it would be an unowned target = maintenance ballast.
- **`uses/with/override` MCP composition** — watch, revisit if our
  `scripts/mcp_render.py` needs composable blocks.

## Consequences

- Frontmatter quality nudges (length) no longer block CI; structural
  correctness still does. A future over-long `description` surfaces as a
  warning, not a red build — intentional, per Continue's fatal-vs-quality
  split.
- `SchemaError`'s new `severity` field is library-visible (`__all__`);
  positional `(path, rule, message)` construction stays backward-compatible
  via the default.
- The roundtrip test fails loudly if a projection emitter drifts, instead of
  shipping a malformed `.cursor/rules/*.mdc` or `.windsurf/rules/*.md`.
- Reversal cost ~0: both changes are local and removable.

## Alternatives

- **Additive-only (no reclassification)** — add the severity capability but
  keep every check fatal. Rejected: leaves the feature a no-op with no
  warning source.
- **Reclassify more checks** (e.g. `pattern`, `additionalProperties` →
  warning) — rejected: those are structural correctness, loosening them
  would let malformed frontmatter through.
- **Skip the ADR, just code it** — rejected: changing a CI gate's strictness
  is a deliberate decision that needs a written record.

## References

- [`agents/evidence/analysis/continue-positioning-2026-05-29.md`](../../agents/evidence/analysis/continue-positioning-2026-05-29.md)
  — the positioning verdict table and adoption queue this ADR acts on.
- `scripts/validate_frontmatter.py` — severity-tier implementation.
- `tests/test_projection_roundtrip.py` — roundtrip implementation.
- Upstream patterns: `continuedev/continue` `core/config/validation.ts`,
  `packages/config-yaml/src/markdown/*.test.ts`.
