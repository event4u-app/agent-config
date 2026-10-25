<!-- evidence-type: analysis -->
# Fidelity matrix — the map Workbench against the supplied design

> **Handover.** `agents/tmp.old/inbox-2026-10-ap/design/{dark,light}/Main.dc.html`
> (the two `Main` files are byte-identical; `Light.dc.html` only switches the theme).
> **Build.** `src/scripts/code_graph/map_viewer/viewer.{js,css}` and the frame in
> `renderHtml` (`src/scripts/code_graph/map.ts`), roadmap `road-to-a-map-that-answers`
> Phase 4. **Evidence taken.** The design's markup and logic read whole; the built page
> of this repository rendered with Playwright at 1440 × 1000 in both themes, every
> lens and every right-rail tab, and `code-graph map`'s render check at its three widths
> (`verified — desktop, mobile-375, mobile-320`, no page error, no request).

## Per zone

| Zone | Compared | Matches | Deviation and why |
|---|---|---|---|
| Tokens | every dark and light custom property | 1:1, names kept (`--brand`, `--blastBg`, `--d3` …) | `--alert`, `--orb-*` added for values the design wrote inline (`#ff5d6c`) or did not need |
| Fonts | Inter, IBM Plex Mono, Anton | named first in each stack | not fetched: the page's CSP is `default-src 'none'`, so each falls back to the system stack |
| Header | logo, name, pin chips, search with `/`, Export, theme, language | 1:1 | pin chip reads `pin.freshness`; a non-fresh state shows in brand colour instead of green |
| Left rail · Health | ring, caption, formula link, four parts with bars or dashed chips | 1:1 | the formula opens in place (the design anchors to a section that does not exist on the page) |
| Left rail · KPIs, roles, trust | four tiles, role bar, trust bar | 1:1 | "Rollen" folds every code role (code, entry, view, infra, isolated) into `code` |
| Left rail · Colour by | eight options, disabled with the design's hint | 1:1 | `Ordner` is live: the folder field exists, the design greyed it for hulls not drawn |
| Left rail · Explorer | tree with counts, scope chip | 1:1 | the scope dims files outside the folder rather than filtering them out |
| Centre · lens tabs and filters | six lenses, edge filters, full screen | 1:1 | `Treemap` is live because `loc` ships; `Flow` stays disabled with the design's hint |
| Centre · Graph | 2D top-15 areas, 3D orb of all, area view, blast colours, badges, ids, labels below | visual language 1:1 | drawn on canvas, not SVG: keeps the render check's label and orb probes; the orb keeps the existing equal-area projection rather than the design's Fibonacci sphere; area labels are the hub file, because AC has no working titles |
| Centre · Legend, hint bar, footer | legend follows colour-by, zoom readout, footer chips | 1:1 | — |
| Centre · Layers | bands depth 0–3 with code / test / doc dots | 1:1 | dots beyond 240 per band collapse into a count |
| Centre · Matrix | 15 × 15 area DSM, selection row and column, cell note | 1:1 | cycle blocks are a red frame on cells whose areas share a cycle from `violations[]`; a cell lists up to 20 file edges |
| Centre · Knowledge | seven columns, keys, three cards | 1:1 | Memory column stays the design's "Collector fehlt" — parked in `road-to-a-knowledge-atlas` |
| Centre · Treemap | not drawn in the design (disabled) | — | built from `loc` per folder, colour by the chosen option, folder colour under Blast |
| Right rail · tabs | Datei, Befunde · N, Area | 1:1 | — |
| Right rail · Datei | head chips, blast card with scope switch, depth lists, uses, symbols with calls, knowledge, ownership | 1:1 | added "Genutzt von", tests, request paths, externals the old viewer showed; lists cap at 8 (symbols 12); the uses list shows edge weight, since the model stores no relation per file pair |
| Right rail · Befunde | cycles, surprises, drift, layer breaches, hotspots, dead files | 1:1 | each card falls back to the design's dashed "needs …" form when its field is absent |
| Right rail · Area | id, tiles, mismatch sentence, most used | 1:1 | followed by the full area list, so every area stays reachable when 2D shows 15 |
| Scope switch numbers | Code / + Tests / + Doku | Code = the `blast` record | the other two scopes count the walk's membership (D3); the design shows invented numbers for all three |

## What was not built

The design's runtime (`support.js`, React) — the page stays one offline file (D8).
Every figure the design hard-coded (12.493 files, area working titles, the selected
file) is read from `map.json`; `tests/scripts/code_graph_map_answers.test.ts` fails
if one of those literals reaches the page.
