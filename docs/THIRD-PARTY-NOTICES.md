# Third-Party Notices

> **Generated** by `lint_provenance.ts --regenerate-notices` — do NOT
> hand-edit. Source of truth: `provenance/borrows.jsonl`. Drift-checked in
> CI (`task lint-provenance`); run
> `./scripts-run src/scripts/lint_provenance --regenerate-notices` after
> any ledger change.

## https://github.com/nextlevelbuilder/ui-ux-pro-max-skill

- **License:** MIT
- **Source SHA:** 97eb2a20
- **Borrowed:** 2026-08-13
- **Files:** `src/skills/corpus-grounding/scripts/decision_engine.ts`, `src/skills/corpus-grounding/scripts/ground.ts`
- **Transformation:** Adopted the three design dials as a tier TABLE and re-derived the plumbing against this engine's own shape. Upstream threads variance/motion/density through a generate() and a set of render functions that do not exist here; this tree has ground(), so the dials enter as an optional fourth parameter and leave as an additive output block that is omitted entirely when no dial is passed, keeping the no-flag result byte-identical. Variance PREPENDS to the rule's existing corpus-grounded priority keywords rather than replacing the priority list, so a caller preference cannot silently override grounded evidence. Motion resolves through this repo's search_domain against a 'gsap' manifest domain added in the same change, and an empty tier or a manifest without that domain emits an evidence_gap instead of a silent empty block. Range clamping moved out of the resolver's caller into the resolver, and the CLI rejects a non-numeric dial rather than reading it as unset.
- **Cleared by:** human
