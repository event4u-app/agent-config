# Attribution — the ported grounding engine

This file exists because of where the code ships, not because the obligation
is new. `src/skills/design-intelligence/ATTRIBUTION.md` already covered both
the vendored corpus **and** the ported engine. The corpus travels with the
`frontend-design` pack; the engine sources below travel with **this** skill, in
`engineering-base`. An install that takes `engineering-base` without
`frontend-design` therefore carried MIT-derived code and no notice, which is
the one thing the MIT obligation forbids. The notice is reproduced here so it
travels with the files it covers.

## Covered files

- `scripts/bm25_search.ts`
- `scripts/decision_engine.ts`
- `scripts/ground.ts`
- `scripts/schema_validator.ts`

Ported from `nextlevelbuilder/ui-ux-pro-max-skill` @
`b7e3af80f6e331f6fb456667b82b12cade7c9d35` (Python sources `core.py`,
`search.py`, `design_system.py`), de-duplicated and with slide-only paths
stripped.

## MIT

Copyright (c) 2024 **Next Level Builder**.

The Python engine sources (`core.py`, `search.py`, `design_system.py`) this
skill's scripts are ported from are MIT-licensed. Obligation: **retain this
notice**.

## Not covered here

The tabular design-knowledge corpus (`ui-reasoning`, `products`, `colors`,
`styles`, `typography`, `charts`, `landing`, `icons`, `ux-guidelines`,
`react-performance`, `app-interface`, `motion`, `stacks/*`), the Apache-2.0
`ui-styling`-derived material, and the running modifications log stay in
`design-intelligence/ATTRIBUTION.md` — they ship with that pack, and this file
does not duplicate them.
