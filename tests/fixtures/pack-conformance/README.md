# `pack-conformance` fixture

The corpus for `src/scripts/check_pack_conformance_fixture.ts` — a conformant
pack plus one seeded-violation twin per fixture-provable invariant.

## Layout-neutral by design

`conformant/` is the single source of truth and is stored in **no gate's**
expected layout, because the two tree-level gates disagree:

| Gate | expects |
|---|---|
| `lint_pack_boundaries` | `<root>/packs.yml`, `<root>/skills/`, `<root>/rules/` |
| `lint_rule_skill_pack_reach` | `<root>/src/config/discovery/packs.yml`, `<root>/src/rules/`, `<root>/src/skills/` |

The harness projects the canonical tree into each shape in a tmpdir. Storing it
pre-projected would mean two copies that drift.

## Twins are overlays, and they REPLACE

Each twin directory is copied over a fresh `conformant/`, file for file. A
same-named file is replaced, never merged — so every twin ships a full
`packs.yml` and a full copy of any artefact it changes. A merge would make a
twin's effect depend on merge semantics instead of on a file a reviewer reads.

**Each twin must red exactly one gate.** Two twins here drop the same
`fx-alpha → fx-beta` requires edge, and each then has to *un-seed* the other's
violation to stay isolated: `unreachable-route` removes the cross-pack link from
the skill, and `undeclared-cross-pack-link` points the rule inside its own pack.
Those removals are the isolation, not tidiness — the harness asserts the other
gates stay green and a sabotage probe confirmed it fires when they do not.

## Why only three twins

A twin is only meaningful for a gate a fixture can drive, and three of the six
cannot be pointed at one. `docs/contracts/pack-conformance.md` carries the
per-gate reason and whether the block is design-level or effort-level.

## This is not a pack

Nothing here is installable: it lives under `tests/`, carries no
`org-pack` provenance (ADR-233 D3), and is not in `src/packs/`, so it is invisible
to `generate_pack_manifests`, the pack-size budget, the census and the installer.
