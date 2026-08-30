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
| `src/scripts/cost/budget.mjs`, `src/scripts/cost/track.mjs` | ruvnet/ruflo — `plugins/ruflo-cost-tracker` | MIT | full notice below; transformation record in [`provenance/borrows.jsonl`](provenance/borrows.jsonl) and [`docs/THIRD-PARTY-NOTICES.md`](docs/THIRD-PARTY-NOTICES.md) |

#### MIT notice — ruvnet/ruflo

Reproduced in full rather than by reference, because MIT requires the copyright
notice AND the permission notice to travel with copies or substantial portions
of the Software. This file ships in the npm package (`package.json` → `files`),
which is what discharges the obligation for a consumer who receives
`src/scripts/cost/` from the registry — the source files themselves carry no
in-file source name, per
[`source-confidentiality`](src/rules/source-confidentiality.md), and MIT does not
require one.

```
Copyright (c) 2024-2026 ruvnet

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

### Comparators (benchmark baselines, no vendored material)

| Comparator | Pinned at | License | Where it is used |
|---|---|---|---|
| `Source A` — an external agent-instruction suite | `2ed6c52c` | MIT | benchmark comparator arm: [`agents/roadmaps/stubs/road-to-solution-minimalism-full-tier-run.md`](agents/roadmaps/stubs/road-to-solution-minimalism-full-tier-run.md) § The published comparator |

Nothing is vendored from it — no code, no oracle text, no prose. What is used is
its **published baseline numbers** as the external column of a two-arm report,
and four mechanism ideas folded (never copied) into
`road-to-trigger-delivered-rule-bodies`. It is credited under an anonymised label
because [`source-confidentiality`](src/rules/source-confidentiality.md) forbids
the tracked tree recording which third-party package seeded an idea; the real
identifier resolves from the encrypted token in that roadmap's § Provenance.

Per [ADR-061](docs/decisions/ADR-061-corpus-grounding-layer.md), vendored
material keeps its upstream notice inside the skill directory; this table is
the aggregate pointer, never a replacement for the per-skill notice.

### Runtime dependencies — code-graph engine (ADR-124)

**No longer shipped to consumers.** The native code-graph engine
(`src/scripts/code_graph/`, Class-A per
[ADR-124](docs/decisions/ADR-124-embedded-engine-doctrine.md)) once added two
exact-pinned *runtime* dependencies. The engine returned an honest null (recall
0.365 vs grep 0.797) and is permanently `enabled: false`, so the pair moved out
of `dependencies` rather than shipping to every consumer for a path none of them
can reach — ~51 MB unpacked, the largest single install item in the set.

They are now `devDependencies`: npm does not install those for consumers, so a
consumer install resolves neither, while the engine's own test suite still runs
in CI. The exact pins live there, which keeps the ABI lock machine-checked (the
dependency-floor gate scans only `dependencies` and no longer sees the pair):

| Dependency | Version | License | Role |
|---|---|---|---|
| `web-tree-sitter` | 0.24.7 (exact) | MIT | WASM tree-sitter runtime — parses PHP/TS/JS with no native toolchain |
| `tree-sitter-wasms` | 0.1.13 (exact) | Unlicense | prebuilt grammar `.wasm` (ABI 14; the pair is ABI-locked and must move together) |

Re-enabling as a consumer means installing them yourself:
`npm i web-tree-sitter@0.24.7 tree-sitter-wasms@0.1.13`.

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
