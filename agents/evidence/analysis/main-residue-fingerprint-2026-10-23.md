<!-- evidence-type: analysis -->

# Fingerprint of the `main` residue

road-to-a-tick-the-shipped-path-earns 6.2, 2026-10-23. Each gate #2588 lists as red on clean
`origin/main` was run on a detached checkout of `origin/main@ad30b6dfec` (release 17.0.0 merged),
`node v26.7.0`, macOS, `node_modules` linked from the branch checkout. None of these gates runs in a
GitHub workflow: on that SHA every workflow is green except `Tests`, so this residue is local
`task ci` only and no CI result hides a new red under it.

| Gate (task) | SHA | Exit | Failure class |
|---|---|---|---|
| `check-trigger-evals` | ad30b6dfec | 1 | trigger-set regressions; 55 lines naming a stale or absent `last_eval` |
| `lint-eval-freshness` | ad30b6dfec | 1 | skills ship `evals/triggers.json` with no `upstream.last_eval` (api-design, database, threat-modeling, …) |
| `lint-rule-enforcement-declaration` | ad30b6dfec | 1 | `src/rules/brand-source-of-truth.md` declares a model-carried gap in frontmatter but never states it in its body |
| `check-gate-completeness` | ad30b6dfec | 1 | 243 un-adopted gates against a baseline of 214 |
| `lint-provenance-vocabulary` | ad30b6dfec | 1 | permanence language in `ADR-107` line 37 (owner-reserved purpose statements) |
| `check-rule-invariants` | ad30b6dfec | 1 | 2 missing kernel rule invariants |
| `audit-tokens-budget` | ad30b6dfec | 1 | initial-context budget: `skill_catalog.gpt` 12,835 > 12,500; `command_catalog.gpt` 6,706 > 5,800 |
| `lint-user-type-axis` | ad30b6dfec | 1 | orphan user type `legal` |
| `lint-projection-fidelity` | ad30b6dfec | 1 | on a fresh checkout every projected command reads `file not found`; environment-dependent, because the generated trees are absent until `task generate-tools` |
| `check-finding-dispositions` | ad30b6dfec | 1 | 17.0.0 shipped with no findings ledger at `agents/evidence/release-findings/17.0.0.json` — new since the 17.0.0 merge |

Separately, the `Tests` workflow on `ad30b6dfec` failed one case,
`tests/scripts/advisories.test.ts` › "#6 — an aging hour count is not a new notice" (run
`39866967283`); it is not part of this residue and did not fail on #2588's head.
