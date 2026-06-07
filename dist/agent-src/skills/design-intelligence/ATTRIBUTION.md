# Attribution — vendored design-knowledge corpus + grounding engine

This skill's `data/` corpus and the ported engine code derive from the
upstream repository below. Keep this file shipping with the skill; update the
`last-checked` date on every refresh.

## Upstream source

- Repository: `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill`
- Commit SHA: `b7e3af80f6e331f6fb456667b82b12cade7c9d35`
- Last checked: 2026-06-07
- Upstream version: `skill.json` v2.5.x (npm `uipro-cli`)

## Licenses

### MIT — corpus + core engine (root `LICENSE`)

Copyright (c) 2024 **Next Level Builder**. The tabular corpus
(`ui-reasoning`, `products`, `colors`, `styles`, `typography`, `charts`,
`landing`, `icons`, `ux-guidelines`, `react-performance`, `app-interface`,
`stacks/*`) and the Python engine sources (`core.py`, `search.py`,
`design_system.py`) are MIT-licensed. Obligation: **retain this notice**.

### Apache-2.0 — `ui-styling`-derived material ("claudekit")

The upstream `ui-styling` sub-skill ships a dedicated `LICENSE.txt`
(Apache License 2.0, vendored "claudekit"). The dedicated license file is
treated as authoritative over the sub-skill's MIT frontmatter claim.
Obligations for any asset derived from it (`shadcn_add.py`,
`tailwind_config_gen.py`, a11y reference material):

- retain the notice and attribute "claudekit";
- **mark modified files** (Apache-2.0 §4b) — every ported/edited file carries
  a header line `Modified from upstream (Apache-2.0, claudekit) — see ATTRIBUTION.md`;
- ship the Apache-2.0 license text alongside the derived assets
  (`LICENSE.apache-2.0.txt` in this directory when the first derived asset
  lands).

## Modifications (running log)

- 2026-06-07 — Engine ported into `src/skills/_lib/corpus-grounding/`
  (BM25 + decision-rule evaluator + schema validator), de-duplicated
  (`core.py` / `slide_search_core.py` were byte-identical), slide-only paths
  stripped, structured `filters` pre-filtering added, manifest-driven
  multi-domain support added. Corpus CSVs adopted unmodified except:
  `draft.csv` skipped (dead byte-identical backup), `google-fonts.csv`
  skipped (public-API-redundant — see ADR-061 §8), `design.csv` prose
  translated to English.

## Provenance discipline

Per ADR-061 §6, every adopted asset carries an inline upstream-source line
(repo + SHA + last-checked). Refresh cadence and the named maintenance owner
live in the corpus manifest headers.
