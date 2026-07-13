# Road to Batch B Stub Consistency

> Follow-up to the P4 Batch B migration PR (#930, merged 2026-07-13). An
> external review of the merged diff surfaced two confirmed defects and one
> disposition-only note. Preservation itself passed — every migrated passage
> was verified present in its guideline home — so this roadmap fixes only
> the stub-side consistency gaps, not the migration.

## Goal

The 7 Batch B stubs carry the same machine-readable routing declaration as
the 45 earlier P4 stubs, and every decision boundary a rule needs at fire
time is enumerable from the stub alone.

## Findings (verified 2026-07-13 against origin/main)

1. **Missing `routes_to:` frontmatter (defect).** All 7 Batch B stubs
   (`active-remediation`, `artifact-drafting-protocol`, `context-hygiene`,
   `design-fidelity`, `domain-adoption-policy`,
   `framework-neutrality-in-generic-skills`, `minimal-safe-diff`) declare
   their guideline home only in "Body migrated to" prose. 45 precedent
   rules declare it in `routes_to:`; `rule.schema.json` defines the key;
   `compile_router.ts` embeds it per router entry (these 7 currently ship
   empty `routes_to` in `dist/router.json`); `audit_auto_rules.ts` and
   `build_discovery_manifest.ts` consume it. `rule_backlinks.ts` masked the
   gap via its prose fallback.
2. **Opaque fire-time boundary in `active-remediation` (defect).** The stub
   says "five testable conditions" without enumerating them; the
   enumeration survives only in the `minimal-safe-diff` stub. When
   `active-remediation` fires alone (e.g. trigger "clean this up"), the
   agent lacks the fix-now / note+ask boundary.
3. **`context-hygiene` abort-block template behind the guideline hop
   (disposition, no change).** The abort *decision* (25-min STOP,
   non-bypassable) stays inline; only the message template migrated. This
   matches the Batch B criterion — decisions stay, payload templates
   migrate — and is categorically unlike the Batch C skip (verbatim legal /
   safety disclaimers, where the exact wording IS the control). An
   improvised state-dump is harmless; an improvised disclaimer is not.

## Phase 1 — routes_to frontmatter (Finding 1)

- [x] Add `routes_to:` to each of the 7 Batch B stubs in `src/rules/`,
      matching the migrated guideline home:
      `active-remediation` → `guideline:agent-infra/active-remediation-mechanics` ·
      `artifact-drafting-protocol` → `guideline:agent-infra/artifact-drafting-protocol-mechanics` ·
      `context-hygiene` → `guideline:agent-infra/context-hygiene-mechanics` ·
      `design-fidelity` → `guideline:design-fidelity-mechanics` ·
      `domain-adoption-policy` → `guideline:agent-infra/domain-adoption-gates` ·
      `framework-neutrality-in-generic-skills` → `guideline:agent-infra/framework-neutrality-patterns` ·
      `minimal-safe-diff` → `guideline:agent-infra/minimal-safe-diff-mechanics`

## Phase 2 — fire-time boundary (Finding 2)

- [x] `src/rules/active-remediation.md`: enumerate the five fix-now
      conditions inline in the ladder section (same one-line summary the
      `minimal-safe-diff` stub already carries: same path/module, ≤ ~10
      lines, no public-API change, no dependency bump/migration,
      verification in the same commit).
- [x] Record the Finding-3 disposition (no artifact change) in this
      roadmap — done by the Findings section above.

## Phase 3 — regenerate derived surfaces + verify

- [x] `task sync` — recondense changed rules, update condensation hashes.
- [x] `task compile-router` — `dist/router.json` picks up the new
      `routes_to` values on the 7 entries.
- [x] Regenerate `internal/reports/rule-backlinks.md` via
      `./scripts-run src/scripts/rule_backlinks`.
- [x] Verify (diff-scoped): `task sync-check-hashes` green,
      `task check-router` green, frontmatter validation green for the 7
      changed rules.

## Acceptance criteria

- All 7 Batch B stubs carry a `routes_to:` list resolving to an existing
  guideline file (rule-backlinks report: 0 orphans, 0 unknown-shape from
  these rules).
- `dist/router.json` entries for the 7 rules carry non-empty `routes_to`.
- `active-remediation` stub enumerates the five fix-now conditions at fire
  time without requiring the guideline hop or a sibling rule.
- No stub body weakened — Iron Law fences byte-identical to pre-change.
