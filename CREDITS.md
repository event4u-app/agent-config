# Credits

Attribution for derived work and external contributions. Two kinds of entries
live here: **license-required attribution** for vendored/derived material
(Apache-2.0 / MIT obligations) and **community credit** for external
contributors whose skills, rules or commands were merged.

## License-required attribution (vendored / derived material)

| Artefact | Upstream | License | Detail |
|---|---|---|---|
| `design-intelligence` (corpus + grounding engine) | Next Level Builder — `ui-ux-pro-max-skill` | MIT | [`src/skills/design-intelligence/ATTRIBUTION.md`](src/skills/design-intelligence/ATTRIBUTION.md) |
| `design-intelligence` (`ui-styling`-derived assets) | "claudekit" | Apache-2.0 | [`LICENSE.apache-2.0.txt`](src/skills/design-intelligence/LICENSE.apache-2.0.txt) + modified-file markers per §4b |
| `corpus-grounding`, `design-tokens`, `react-shadcn-ui`, `tailwind-engineer` (derived slices) | see per-skill notices | MIT / Apache-2.0 | ADR-061 — the per-skill attribution notice is authoritative |

Per [ADR-061](docs/decisions/ADR-061-corpus-grounding-layer.md), vendored
material keeps its upstream notice inside the skill directory; this table is
the aggregate pointer, never a replacement for the per-skill notice.

### Runtime dependencies — code-graph engine (ADR-124)

The native code-graph engine (`src/scripts/code_graph/`, Class-A per
[ADR-124](docs/decisions/ADR-124-embedded-engine-doctrine.md)) adds two
exact-pinned runtime dependencies. They are ordinary npm dependencies (each
ships its own license in `node_modules`); listed here for the honest
dependency record the ADR-124 § 1 per-dependency justification requires:

| Dependency | Version | License | Role |
|---|---|---|---|
| `web-tree-sitter` | 0.24.7 (exact) | MIT | WASM tree-sitter runtime — parses PHP/TS/JS with no native toolchain |
| `tree-sitter-wasms` | 0.1.13 (exact) | Unlicense | prebuilt grammar `.wasm` (ABI 14; the pair is ABI-locked by the smoke test) |

## Community contributions

External contributions merged into the catalog are credited here and carry
`provenance: community` in their frontmatter — the public catalog
([`docs/catalog.md`](docs/catalog.md)) renders that as `community` in the
`source` column.

| Artefact | Contributor | Merged in |
|---|---|---|
| _none yet — yours could be the first_ | | |

If your work appears in this package unattributed, please open an issue —
attribution gaps are treated as bugs.
