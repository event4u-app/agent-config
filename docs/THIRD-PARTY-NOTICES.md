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
- **Transformation:** Adopted the three design dials as a tier TABLE and re-derived the plumbing against this engine's own shape. Upstream threads variance/motion/density through a generate() and a set of render functions that do not exist here; this tree has ground(), so the dials enter as an optional fourth parameter and leave as an additive output block that is omitted entirely when no dial is passed, keeping the no-flag result byte-identical. Variance biases SELECTION and never RETRIEVAL: the rule's own corpus-grounded keywords alone augment the query, so the rows that come back are unchanged by the dial, and a separate selection list carries the dial in front only for choosing among those rows — and when that choice differs from the one the rule's keywords would have made, the run reports the divergence in evidence_gap rather than leaving it invisible. Motion resolves through this repo's search_domain against a 'gsap' manifest domain added in the same change, filtering by Intensity Tier BEFORE ranking (retrieve-then-filter drops tier rows that lost the global cut) and taking its row count from the manifest rather than a literal; a missing domain or an empty tier emits an evidence_gap and no motion block at all. Range clamping moved out of the caller into the resolver, the CLI rejects a non-numeric dial rather than reading it as unset, and all three dials render in the text output and the persisted MASTER.md, not only under --json.
- **Cleared by:** human
