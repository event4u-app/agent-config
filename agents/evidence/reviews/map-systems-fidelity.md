<!-- evidence-type: analysis -->
# Fidelity matrix — Systeme against the 2026-10-bf handover

> **Handover.** `p08/Systems.dc.html` ("Systeme (echte Daten)"), its template, inline styles and logic class — drawn from this repository's own `systems.json` @ `2efd5be1`, the commit `agents/map/code/map.json` was built at, so counts compare one to one.
> **Build.** `src/scripts/code_graph/map_viewer/area_systems.{js,css}`, the payload extras of `systemsExtras` in `map_area_payloads.ts`, the shared Verlauf in `areas_common.js`; roadmap `road-to-map-views-from-the-handover` Phase 3.
> **Evidence taken.** `tests/scripts/code_graph/map_fidelity_probe.ts systems` and `systemsPaths` (Chromium, no network, German locale): every lens of the handover and of the build, clicked in both, at 1440, 375 and 320 px in both themes; the brief's §9.1 package questions answered by clicking on this repository's map. Behaviour rows name `tests/scripts/code_graph_map_systems_page.test.ts` (systems fixture plus a fixtures workspace) and `code_graph_map_area_payloads.test.ts`.

## Landmarks

Visible landmarks below the header per lens, 1440 px, dark.

| Component (lens) | Handover | Build | Status |
|---|---|---|---|
| strip + filters (Übersicht) | div[tablist] "Ansicht"; aside "Filter"; div[radiogroup] "Status"; div[radiogroup] "Scope"; div[radiogroup] "Herkunft"; div[radiogroup] "Lock"; div[radiogroup] "Tiefe (1 = direkt)"; div[radiogroup] "Benötigt von … Paketen"; button[switch] ""; button[switch] ""; button[switch] ""; main ""; nav "Verlauf"; button[switch] ""; aside "Detail" | = handover | = |
| list (Pakete) | div[tablist] "Ansicht"; aside "Filter"; div[radiogroup] "Status"; div[radiogroup] "Scope"; div[radiogroup] "Herkunft"; div[radiogroup] "Lock"; div[radiogroup] "Tiefe (1 = direkt)"; div[radiogroup] "Benötigt von … Paketen"; button[switch] ""; button[switch] ""; button[switch] ""; main ""; nav "Verlauf"; button[switch] ""; div[radiogroup] "Sortieren"; button[switch] ""; aside "Detail" | = handover | = |
| dependencies (Abhängigkeiten) | div[tablist] "Ansicht"; aside "Filter"; div[radiogroup] "Status"; div[radiogroup] "Scope"; div[radiogroup] "Herkunft"; div[radiogroup] "Lock"; div[radiogroup] "Tiefe (1 = direkt)"; div[radiogroup] "Benötigt von … Paketen"; button[switch] ""; button[switch] ""; button[switch] ""; main ""; nav "Verlauf"; button[switch] ""; aside "Detail" | = handover | = |
| runtimes | div[tablist] "Ansicht"; aside "Filter"; div[radiogroup] "Status"; div[radiogroup] "Scope"; div[radiogroup] "Herkunft"; div[radiogroup] "Lock"; div[radiogroup] "Tiefe (1 = direkt)"; div[radiogroup] "Benötigt von … Paketen"; button[switch] ""; button[switch] ""; button[switch] ""; main ""; nav "Verlauf"; button[switch] ""; aside "Detail" | = handover | = |
| findings (Befunde) | div[tablist] "Ansicht"; aside "Filter"; div[radiogroup] "Status"; div[radiogroup] "Scope"; div[radiogroup] "Herkunft"; div[radiogroup] "Lock"; div[radiogroup] "Tiefe (1 = direkt)"; div[radiogroup] "Benötigt von … Paketen"; button[switch] ""; button[switch] ""; button[switch] ""; main ""; nav "Verlauf"; button[switch] ""; aside "Detail" | = handover | = |
| branches | div[tablist] "Ansicht"; aside "Filter"; div[radiogroup] "Status"; div[radiogroup] "Scope"; div[radiogroup] "Herkunft"; div[radiogroup] "Lock"; div[radiogroup] "Tiefe (1 = direkt)"; div[radiogroup] "Benötigt von … Paketen"; button[switch] ""; button[switch] ""; button[switch] ""; main ""; nav "Verlauf"; button[switch] ""; div[radiogroup] "Map-Art"; aside "Detail" | = handover | = |

### Per component — what the page shows, design against this repository's map (dark, 1440)

| Component | Handover | Build | Status |
|---|---|---|---|
| strip | six tabs Übersicht · Pakete · Abhängigkeiten · Runtimes · Befunde · 16 · Branches; reader line "systems lane · lockfiles, manifests, version files, images, CI" + `complete` | same six tabs, same count (16), same reader line and chip | = |
| filters · counts | "1.204 von 1.310 Paketen + 106 in Fixtures"; npm 1.297 · Composer 13 | "1.210 von 1.310 Paketen + 100 in Fixtures"; npm 1.297 · Composer 13 | Δ data: the handover split package ids per workspace (sibling E.4); the map still merges them, so six packages land in a different workspace. Totals, per-manager and per-status counts are the payload's |
| filters · groups | search, Paketmanager rows with `.pm` badge and lockfile caption, "Kein Lockfile oder Manifest gefunden" chips, Workspace checkboxes (fixtures off), Status radiogroup (7), Scope / Herkunft / Lock / Tiefe / Benötigt von radiogroups, "Nur zeigen" switches, "Filter zurücksetzen" | the same groups in the same order; the "no lockfile" chips come from the payload's `ecosystems` probe (step 3.2) — this repository's committed map predates it, so they appear once the map is redrawn | = structure; Δ data until redraw |
| Übersicht | 7 KPI tiles 1.204 · 51 · 5 · 0 · 14 · 154 · 2 Runtimes · node, php; PM cards; Workspaces × Paketmanager; Frameworks · 5; Befunde nach Art | 7 tiles 1.210 · 51 · 5 · 0 · 14 · 154 · 2 Runtimes · node, php; the same cards and grids | = except the E.4 workspace split above |
| list | sort radiogroup Befund zuerst · benötigt · Nutzung · Tiefe · Name; switch "Nach Name gruppieren"; 9-column grid; "Weitere 60 zeigen"; first rows vitest 2.1.9 · @playwright/test · typescript · argparse … | the same controls and grid; the same first rows in the same order | = |
| dependencies | head, verdict, 7 KPIs, Nachbarschaft, "Warum installiert? · N Wege", Benötigt von / selbst, Nutzung im Code with Nach Code-Area and Meistgenutzt, "Was die Map hier nicht weiß" | the same blocks in the same order for the selected package; one path per package (the payload carries the shortest only), Nach Ordner instead of Nach Code-Area, Meistgenutzt over all uses once the map is redrawn | Δ data: every chain is sibling E.5, Code-Area per use needs the area map in the payload — see Not implemented |
| runtimes | node 69 Zeugen with disagreement SY-4, values grouped by kind; php 3 Zeugen konsistent; the source note | node 69 · php 3 with the same values, counts and order | = |
| findings | intro, fixtures note "50 von 66 … Gezeigt: 16", groups SY-1 … SY-5 with "Kandidat · advice" / "medium · advice", the largest non-candidate group open | the same note and counts, the same groups and severities; the largest non-SY-1 group opens | = |
| branches | Map-Art radiogroup Committete Map / Lokal mit --branches · Vorschau; committed card with commit 2efd5be1 and the two capability tiles | the same radiogroup (Lokal disabled in a committed map) and the same card | = committed; the local preview is not built (Not implemented) |
| detail | pm badge, name 17 px brandText, tags, kv rows, "Abhängigkeiten & Nutzung öffnen →", finding cards with "Vorschlag, nie angewendet", Auf Branches chips, Zeuge with `index only` | the same rows and controls; Auf Branches says it needs a local map with --branches | = ; Δ data for Auf Branches |

## Computed styles (dark)

`getComputedStyle` at 1440 px, dark, this repository's map against the handover in the same lens.

| Component | Property | Handover (computed) | Build (computed) | Status |
|---|---|---|---|---|
| strip · selected lens | `height` | `34px` | `34px` | = |
| strip · selected lens | `padding` | `0px 14px` | `0px 14px` | = |
| strip · selected lens | `border-radius` | `7px` | `7px` | = |
| strip · selected lens | `font-size` | `13px` | `13px` | = |
| strip · selected lens | `font-weight` | `600` | `600` | = |
| strip · selected lens | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| strip · selected lens | `background-color` | `rgba(255, 140, 42, 0.16)` | `rgba(255, 140, 42, 0.16)` | = |
| strip · selected lens | `box-shadow` | `rgba(255, 140, 42, 0.55) 0px 0px 0px 1px inset` | `rgba(255, 140, 42, 0.55) 0px 0px 0px 1px inset` | = |
| strip · selected lens | `border` | `0px none` | `0px none` | = |
| filters · package-manager row | `height` | `50.1875px` | `50.1875px` | = |
| filters · package-manager row | `padding` | `8px 10px` | `8px 10px` | = |
| filters · package-manager row | `border-radius` | `8px` | `8px` | = |
| filters · package-manager row | `font-size` | `13px` | `13px` | = |
| filters · package-manager row | `font-weight` | `400` | `400` | = |
| filters · package-manager row | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| filters · package-manager row | `background-color` | `rgba(255, 140, 42, 0.16)` | `rgba(255, 140, 42, 0.16)` | = |
| filters · package-manager row | `box-shadow` | `none` | `none` | = |
| filters · package-manager row | `border` | `1px solid rgba(255, 140, 42, 0.55)` | `1px solid rgba(255, 140, 42, 0.55)` | = |
| filters · checked status | `height` | `28.7969px` | `28.7969px` | = |
| filters · checked status | `padding` | `5px 8px` | `5px 8px` | = |
| filters · checked status | `border-radius` | `7px` | `7px` | = |
| filters · checked status | `font-size` | `14px` | `14px` | = |
| filters · checked status | `font-weight` | `400` | `400` | = |
| filters · checked status | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| filters · checked status | `background-color` | `rgba(255, 140, 42, 0.16)` | `rgba(255, 140, 42, 0.16)` | = |
| filters · checked status | `box-shadow` | `none` | `none` | = |
| filters · checked status | `border` | `1px solid rgba(255, 140, 42, 0.55)` | `1px solid rgba(255, 140, 42, 0.55)` | = |
| filters · checked segment | `height` | `28px` | `28px` | = |
| filters · checked segment | `padding` | `0px 6px` | `0px 6px` | = |
| filters · checked segment | `border-radius` | `7px` | `7px` | = |
| filters · checked segment | `font-size` | `12px` | `12px` | = |
| filters · checked segment | `font-weight` | `600` | `600` | = |
| filters · checked segment | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| filters · checked segment | `background-color` | `rgba(255, 140, 42, 0.16)` | `rgba(255, 140, 42, 0.16)` | = |
| filters · checked segment | `box-shadow` | `rgba(255, 140, 42, 0.55) 0px 0px 0px 1px inset` | `rgba(255, 140, 42, 0.55) 0px 0px 0px 1px inset` | = |
| filters · checked segment | `border` | `0px none` | `0px none` | = |
| filters · switch | `height` | `28px` | `28px` | = |
| filters · switch | `padding` | `0px 9px` | `0px 9px` | = |
| filters · switch | `border-radius` | `7px` | `7px` | = |
| filters · switch | `font-size` | `12px` | `12px` | = |
| filters · switch | `font-weight` | `400` | `400` | = |
| filters · switch | `color` | `rgb(195, 206, 221)` | `rgb(195, 206, 221)` | = |
| filters · switch | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| filters · switch | `box-shadow` | `none` | `none` | = |
| filters · switch | `border` | `1px solid rgb(28, 39, 56)` | `1px solid rgb(28, 39, 56)` | = |
| Übersicht · KPI tile | `height` | `98.1719px` | `86.9688px` | Δ layout: one grid row takes its tallest tile; the handover's label "Runtimes · node, php" wraps once more in its narrower column. Padding, radius, border and colours are equal |
| Übersicht · KPI tile | `padding` | `10px 12px` | `10px 12px` | = |
| Übersicht · KPI tile | `border-radius` | `10px` | `10px` | = |
| Übersicht · KPI tile | `font-size` | `14px` | `14px` | = |
| Übersicht · KPI tile | `font-weight` | `400` | `400` | = |
| Übersicht · KPI tile | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| Übersicht · KPI tile | `background-color` | `rgb(13, 19, 29)` | `rgb(13, 19, 29)` | = |
| Übersicht · KPI tile | `box-shadow` | `none` | `none` | = |
| Übersicht · KPI tile | `border` | `1px solid rgb(28, 39, 56)` | `1px solid rgb(28, 39, 56)` | = |
| list · package row | `height` | `58.1875px` | `60.1875px` | = drawn box (content-box vs border-box) |
| list · package row | `padding` | `1px 6px` | `1px 6px` | = |
| list · package row | `border-radius` | `0px` | `0px` | = |
| list · package row | `font-size` | `12px` | `12px` | = |
| list · package row | `font-weight` | `400` | `400` | = |
| list · package row | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| list · package row | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(255, 140, 42, 0.16)` | Δ state, not style: the build's first row is the selected package, the handover preselects fastify further down; the selected style is the handover's own (brandTint, inset 3px brand) |
| list · package row | `box-shadow` | `none` | `rgb(255, 140, 42) 3px 0px 0px 0px inset` | Δ state: the selected row, as above |
| list · package row | `border` | `` | `` | = |
| dependencies · neighbourhood centre | `height` | `26px` | `26px` | = |
| dependencies · neighbourhood centre | `padding` | `0px 8px` | `0px 8px` | = |
| dependencies · neighbourhood centre | `border-radius` | `7px` | `7px` | = |
| dependencies · neighbourhood centre | `font-size` | `11px` | `11px` | = |
| dependencies · neighbourhood centre | `font-weight` | `400` | `400` | = |
| dependencies · neighbourhood centre | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| dependencies · neighbourhood centre | `background-color` | `rgba(255, 140, 42, 0.16)` | `rgba(255, 140, 42, 0.16)` | = |
| dependencies · neighbourhood centre | `box-shadow` | `none` | `none` | = |
| dependencies · neighbourhood centre | `border` | `2px solid rgb(255, 140, 42)` | `2px solid rgb(255, 140, 42)` | = |
| runtimes · card | `height` | `277.125px` | `279.516px` | = drawn box (content-box vs border-box) |
| runtimes · card | `padding` | `0px` | `0px` | = |
| runtimes · card | `border-radius` | `12px` | `12px` | = |
| runtimes · card | `font-size` | `14px` | `14px` | = |
| runtimes · card | `font-weight` | `400` | `400` | = |
| runtimes · card | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| runtimes · card | `background-color` | `rgb(13, 19, 29)` | `rgb(13, 19, 29)` | = |
| runtimes · card | `box-shadow` | `none` | `none` | = |
| runtimes · card | `border` | `1px solid rgb(28, 39, 56)` | `1px solid rgb(28, 39, 56)` | = |
| crumbs · ← | `height` | `24px` | `24px` | = |
| crumbs · ← | `padding` | `1px 6px` | `1px 6px` | = |
| crumbs · ← | `border-radius` | `6px` | `6px` | = |
| crumbs · ← | `font-size` | `13px` | `13px` | = |
| crumbs · ← | `font-weight` | `400` | `400` | = |
| crumbs · ← | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| crumbs · ← | `background-color` | `rgba(255, 140, 42, 0.16)` | `rgba(255, 140, 42, 0.16)` | = |
| crumbs · ← | `box-shadow` | `none` | `none` | = |
| crumbs · ← | `border` | `1px solid rgba(255, 140, 42, 0.55)` | `1px solid rgba(255, 140, 42, 0.55)` | = |
| crumbs · current step | `height` | `24px` | `24px` | = |
| crumbs · current step | `padding` | `0px 4px` | `0px 4px` | = |
| crumbs · current step | `border-radius` | `0px` | `0px` | = |
| crumbs · current step | `font-size` | `12px` | `12px` | = |
| crumbs · current step | `font-weight` | `600` | `600` | = |
| crumbs · current step | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| crumbs · current step | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| crumbs · current step | `box-shadow` | `none` | `none` | = |
| crumbs · current step | `border` | `0px none` | `0px none` | = |
| sticky bar · count | `height` | `16.7969px` | `16.7969px` | = |
| sticky bar · count | `padding` | `0px` | `0px` | = |
| sticky bar · count | `border-radius` | `0px` | `0px` | = |
| sticky bar · count | `font-size` | `12px` | `12px` | = |
| sticky bar · count | `font-weight` | `600` | `600` | = |
| sticky bar · count | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| sticky bar · count | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| sticky bar · count | `box-shadow` | `none` | `none` | = |
| sticky bar · count | `border` | `0px none` | `0px none` | = |

## Computed styles (light)

`getComputedStyle` at 1440 px, light, this repository's map against the handover in the same lens.

| Component | Property | Handover (computed) | Build (computed) | Status |
|---|---|---|---|---|
| strip · selected lens | `height` | `34px` | `34px` | = |
| strip · selected lens | `padding` | `0px 14px` | `0px 14px` | = |
| strip · selected lens | `border-radius` | `7px` | `7px` | = |
| strip · selected lens | `font-size` | `13px` | `13px` | = |
| strip · selected lens | `font-weight` | `600` | `600` | = |
| strip · selected lens | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| strip · selected lens | `background-color` | `rgba(244, 122, 18, 0.12)` | `rgba(244, 122, 18, 0.12)` | = |
| strip · selected lens | `box-shadow` | `rgba(244, 122, 18, 0.6) 0px 0px 0px 1px inset` | `rgba(244, 122, 18, 0.6) 0px 0px 0px 1px inset` | = |
| strip · selected lens | `border` | `0px none` | `0px none` | = |
| filters · package-manager row | `height` | `50.1875px` | `50.1875px` | = |
| filters · package-manager row | `padding` | `8px 10px` | `8px 10px` | = |
| filters · package-manager row | `border-radius` | `8px` | `8px` | = |
| filters · package-manager row | `font-size` | `13px` | `13px` | = |
| filters · package-manager row | `font-weight` | `400` | `400` | = |
| filters · package-manager row | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| filters · package-manager row | `background-color` | `rgba(244, 122, 18, 0.12)` | `rgba(244, 122, 18, 0.12)` | = |
| filters · package-manager row | `box-shadow` | `none` | `none` | = |
| filters · package-manager row | `border` | `1px solid rgba(244, 122, 18, 0.6)` | `1px solid rgba(244, 122, 18, 0.6)` | = |
| filters · checked status | `height` | `28.7969px` | `28.7969px` | = |
| filters · checked status | `padding` | `5px 8px` | `5px 8px` | = |
| filters · checked status | `border-radius` | `7px` | `7px` | = |
| filters · checked status | `font-size` | `14px` | `14px` | = |
| filters · checked status | `font-weight` | `400` | `400` | = |
| filters · checked status | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| filters · checked status | `background-color` | `rgba(244, 122, 18, 0.12)` | `rgba(244, 122, 18, 0.12)` | = |
| filters · checked status | `box-shadow` | `none` | `none` | = |
| filters · checked status | `border` | `1px solid rgba(244, 122, 18, 0.6)` | `1px solid rgba(244, 122, 18, 0.6)` | = |
| filters · checked segment | `height` | `28px` | `28px` | = |
| filters · checked segment | `padding` | `0px 6px` | `0px 6px` | = |
| filters · checked segment | `border-radius` | `7px` | `7px` | = |
| filters · checked segment | `font-size` | `12px` | `12px` | = |
| filters · checked segment | `font-weight` | `600` | `600` | = |
| filters · checked segment | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| filters · checked segment | `background-color` | `rgba(244, 122, 18, 0.12)` | `rgba(244, 122, 18, 0.12)` | = |
| filters · checked segment | `box-shadow` | `rgba(244, 122, 18, 0.6) 0px 0px 0px 1px inset` | `rgba(244, 122, 18, 0.6) 0px 0px 0px 1px inset` | = |
| filters · checked segment | `border` | `0px none` | `0px none` | = |
| filters · switch | `height` | `28px` | `28px` | = |
| filters · switch | `padding` | `0px 9px` | `0px 9px` | = |
| filters · switch | `border-radius` | `7px` | `7px` | = |
| filters · switch | `font-size` | `12px` | `12px` | = |
| filters · switch | `font-weight` | `400` | `400` | = |
| filters · switch | `color` | `rgb(51, 65, 85)` | `rgb(51, 65, 85)` | = |
| filters · switch | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| filters · switch | `box-shadow` | `none` | `none` | = |
| filters · switch | `border` | `1px solid rgb(221, 227, 236)` | `1px solid rgb(221, 227, 236)` | = |
| Übersicht · KPI tile | `height` | `98.1719px` | `86.9688px` | Δ layout: one grid row takes its tallest tile; the handover's label "Runtimes · node, php" wraps once more in its narrower column. Padding, radius, border and colours are equal |
| Übersicht · KPI tile | `padding` | `10px 12px` | `10px 12px` | = |
| Übersicht · KPI tile | `border-radius` | `10px` | `10px` | = |
| Übersicht · KPI tile | `font-size` | `14px` | `14px` | = |
| Übersicht · KPI tile | `font-weight` | `400` | `400` | = |
| Übersicht · KPI tile | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| Übersicht · KPI tile | `background-color` | `rgb(255, 255, 255)` | `rgb(255, 255, 255)` | = |
| Übersicht · KPI tile | `box-shadow` | `none` | `none` | = |
| Übersicht · KPI tile | `border` | `1px solid rgb(221, 227, 236)` | `1px solid rgb(221, 227, 236)` | = |
| list · package row | `height` | `58.1875px` | `60.1875px` | = drawn box (content-box vs border-box) |
| list · package row | `padding` | `1px 6px` | `1px 6px` | = |
| list · package row | `border-radius` | `0px` | `0px` | = |
| list · package row | `font-size` | `12px` | `12px` | = |
| list · package row | `font-weight` | `400` | `400` | = |
| list · package row | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| list · package row | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(244, 122, 18, 0.12)` | Δ state, not style: the build's first row is the selected package, the handover preselects fastify further down; the selected style is the handover's own (brandTint, inset 3px brand) |
| list · package row | `box-shadow` | `none` | `rgb(244, 122, 18) 3px 0px 0px 0px inset` | Δ state: the selected row, as above |
| list · package row | `border` | `` | `` | = |
| dependencies · neighbourhood centre | `height` | `26px` | `26px` | = |
| dependencies · neighbourhood centre | `padding` | `0px 8px` | `0px 8px` | = |
| dependencies · neighbourhood centre | `border-radius` | `7px` | `7px` | = |
| dependencies · neighbourhood centre | `font-size` | `11px` | `11px` | = |
| dependencies · neighbourhood centre | `font-weight` | `400` | `400` | = |
| dependencies · neighbourhood centre | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| dependencies · neighbourhood centre | `background-color` | `rgba(244, 122, 18, 0.12)` | `rgba(244, 122, 18, 0.12)` | = |
| dependencies · neighbourhood centre | `box-shadow` | `none` | `none` | = |
| dependencies · neighbourhood centre | `border` | `2px solid rgb(244, 122, 18)` | `2px solid rgb(244, 122, 18)` | = |
| runtimes · card | `height` | `277.125px` | `279.516px` | = drawn box (content-box vs border-box) |
| runtimes · card | `padding` | `0px` | `0px` | = |
| runtimes · card | `border-radius` | `12px` | `12px` | = |
| runtimes · card | `font-size` | `14px` | `14px` | = |
| runtimes · card | `font-weight` | `400` | `400` | = |
| runtimes · card | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| runtimes · card | `background-color` | `rgb(255, 255, 255)` | `rgb(255, 255, 255)` | = |
| runtimes · card | `box-shadow` | `none` | `none` | = |
| runtimes · card | `border` | `1px solid rgb(221, 227, 236)` | `1px solid rgb(221, 227, 236)` | = |
| crumbs · ← | `height` | `24px` | `24px` | = |
| crumbs · ← | `padding` | `1px 6px` | `1px 6px` | = |
| crumbs · ← | `border-radius` | `6px` | `6px` | = |
| crumbs · ← | `font-size` | `13px` | `13px` | = |
| crumbs · ← | `font-weight` | `400` | `400` | = |
| crumbs · ← | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| crumbs · ← | `background-color` | `rgba(244, 122, 18, 0.12)` | `rgba(244, 122, 18, 0.12)` | = |
| crumbs · ← | `box-shadow` | `none` | `none` | = |
| crumbs · ← | `border` | `1px solid rgba(244, 122, 18, 0.6)` | `1px solid rgba(244, 122, 18, 0.6)` | = |
| crumbs · current step | `height` | `24px` | `24px` | = |
| crumbs · current step | `padding` | `0px 4px` | `0px 4px` | = |
| crumbs · current step | `border-radius` | `0px` | `0px` | = |
| crumbs · current step | `font-size` | `12px` | `12px` | = |
| crumbs · current step | `font-weight` | `600` | `600` | = |
| crumbs · current step | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| crumbs · current step | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| crumbs · current step | `box-shadow` | `none` | `none` | = |
| crumbs · current step | `border` | `0px none` | `0px none` | = |
| sticky bar · count | `height` | `16.7969px` | `16.7969px` | = |
| sticky bar · count | `padding` | `0px` | `0px` | = |
| sticky bar · count | `border-radius` | `0px` | `0px` | = |
| sticky bar · count | `font-size` | `12px` | `12px` | = |
| sticky bar · count | `font-weight` | `600` | `600` | = |
| sticky bar · count | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| sticky bar · count | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| sticky bar · count | `box-shadow` | `none` | `none` | = |
| sticky bar · count | `border` | `0px none` | `0px none` | = |


## Overflow 1440/375/320

`document.documentElement.scrollWidth − innerWidth` > 0 per lens, handover / build.

| Theme · width | Übersicht | Pakete | Abhängigkeiten | Runtimes | Befunde | Branches | Status |
|---|---|---|---|---|---|---|---|
| dark · 1440 | none / none | none / none | none / none | none / none | none / none | none / none | = build never scrolls sideways |
| dark · 375 | none / none | none / none | none / none | none / none | none / none | none / none | = build never scrolls sideways |
| dark · 320 | none / none | scrolls / none | none / none | none / none | none / none | none / none | = build never scrolls sideways |
| light · 1440 | none / none | none / none | none / none | none / none | none / none | none / none | = build never scrolls sideways |
| light · 375 | none / none | none / none | none / none | none / none | none / none | none / none | = build never scrolls sideways |
| light · 320 | none / none | scrolls / none | none / none | none / none | none / none | none / none | = build never scrolls sideways |

At 320 px the handover's own Pakete list scrolls sideways (its 5-button sort row does not wrap); the build wraps that row, the one deviation taken so the page fits.

## Behaviour

| Chapter | Claim | Evidence | Status |
|---|---|---|---|
| 3.1 byArea | per package, files per top-level folder and the top names over ALL uses, beyond the 20-file sample | kind 3: `code_graph_map_area_payloads.test.ts` › byArea (25 importers; sensitivity — with the cap applied the sum would be 20, not 25) | ✓ |
| 3.2 ecosystem probe | present-but-unread told from absent; installed folders not looked into | kind 3: › ecosystem probe (a `go.mod` under node_modules stays absent) | ✓ |
| 3.3 autoload flag | set from a read `composer.lock`, unset without one | kind 3: › autoload (both builds) | ✓ |
| 3.4 filters | six lenses, every Filter group, counts equal to the payload, fixtures off | kind 3: `code_graph_map_systems_page.test.ts` › filters; sensitivity — npm off removes exactly the shown npm packages | ✓ |
| 3.5 Übersicht | seven KPI tiles that apply a filter, PM cards, workspace grid, frameworks, findings by kind | kind 3: › overview (the "direkt deklariert" tile opens Pakete with Herkunft direkt and its count) | ✓ |
| 3.6 every row reachable | every payload row listed once fixtures are on, via paging; sort, group; columns 4–8 hidden at 700 | kind 3: › every row reachable | ✓ |
| 3.7 dependencies | verdict, chain hops, neighbourhood, required-by list, use per file and folder, the honest gaps; a hop jumps | kind 3: › dependencies | ✓ |
| 3.8 lenses and detail | runtimes per card with SY-4, findings grouped with the proposal, committed Branches card, Detail aside with finding card and witness | kind 3: › lenses and detail | ✓ |
| 3.9 crumbs | every filter, sort and pick a step; ← restores lens, sort, filter and selection exactly | kind 3: › crumbs; sensitivity — with `push` neutralised a filter change leaves no ← | ✓ |

### The brief §9.1 package questions, answered by click path on this repository (package `argparse@2.0.1`)

| Question | Click path | What the page answers |
|---|---|---|
| Is it direct? | Pakete › search "argparse" › row › "Abhängigkeiten & Nutzung öffnen →" | Status: genutzt – mindestens ein Import im Code. Nicht direkt eingebunden. Es kommt über js-yaml@5.4.1 ins Projekt – und wird von 2 Paketen benötigt. |
| Why is it here (all chains)? | Abhängigkeiten › "Warum installiert?" | Weg 1 MANIFEST package.json → DIREKT DEKLARIERT js-yaml@5.4.1 → DIESES PAKET argparse@2.0.1 |
| Who requires it, how many? | Abhängigkeiten › "Benötigt von · N" | Benötigt von · 2 · 2 gefiltert requiredBy |
| What does it pull in? | Abhängigkeiten › "Benötigt selbst · N" and KPI "zieht insgesamt nach" | Benötigt selbst · 0 requires / nein direkt eingebunden / ×2 benötigt von (direkt) / 14 hängen insgesamt davon ab / 0 eigene Abhängigkeiten / 0 zieht insgesamt nach / 2 Dateien importieren es / 1 Versionen dieses Namens |
| Who in our code uses it, which names, in which files and areas? | Abhängigkeiten › "Nutzung im Code" › file rows, "Nach Ordner", "Meistgenutzt" | Nutzung im Code · 2 Dateien welche Funktionen und Typen in welcher Datei importiert werden / …/bench/type-reconstruction/grade.py:1 ganzes Modul / Seiteneffekt / …/bench/type-reconstruction/render_word.py:1 ganzes Modul / Seiteneffekt |
| What else uses it without importing? | Abhängigkeiten › "Nutzung ohne Import" / Detail › "ohne Import" | Version 2.0.1 installiert weil js-yaml@5.4.1 → argparse@2.0.1 genutzt von 2 Dateien (Import) ohne Import – benötigt von ×2 Pakete benötigt selbst 0 Pakete |
| Findings? | Detail › finding card | SY-2 · package used but not declared argparse is imported by production code, and only another package installs it fix (proposal, never applied): declare argparse in the manifest of the workspace that imports it Vorschlag, nie angewendet: declare argparse in the manifest of the workspace that imports it |
| Can it go? | Abhängigkeiten › "Was die Map hier nicht weiß" › "Kann es weg?" | Versions-Spec je Schritt der Kette: nicht in der Map gespeichert – code-graph why argparse zeigt sie je Hop. / code-graph why argparse / Aufrufe je Funktion: nicht indiziert – nur die importierten Namen je Datei. / Nutzungsanteil: Oberfläche unbekannt – code-graph usage argparse (braucht installierte Pakete). Nie ein geschätzter Prozentwert. / code-graph usage argparse / Kann es weg? code-graph remove-plan argparse – … |

### The brief §6 asks, mapped to the steps that answer them (AC-13, view half)

| Owner ask (brief §6) | Step | Status |
|---|---|---|
| Better display than an unreadable 1,310-row table | 3.5 Übersicht, 3.6 shared table with sort, group and paging | ✓ view |
| Filter by package manager | 3.4 Paketmanager checkboxes with counts | ✓ |
| Drill-down "like the Data graph" | 3.7 Nachbarschaft diagram with clickable nodes and hops | ✓ view |
| Directly included vs transitive | 3.4 Herkunft radiogroup, 3.6 Tiefe column, 3.7 verdict | ✓ |
| Why installed (which package pulled it in) | 3.7 "Warum installiert?" — shortest path; every chain is sibling E.5 | ⚠ data |
| Which packages require it | 3.7 "Benötigt von · N" list + neighbourhood | ✓ |
| How often required | 3.6 "benötigt" column, 3.4 Benötigt-von filter, 3.7 KPIs direct and transitive | ✓ |
| Which functions are used in which files | 3.7 names per file; "Meistgenutzt" over all uses (3.1); call counts not indexed (sibling E.6) | ⚠ data |
| % of the package used, can we remove it, what must change | 3.7 "Was die Map hier nicht weiß": usage share and remove-plan by command | ✓ honest gap |
| Runtime / framework versions per project | 3.8 Runtimes cards, 3.5 Frameworks tiles | ✓ |
| Everything branch-dependent | 3.8 Branches lens (committed card; local table from `model.branches`) | ⚠ local chain card needs G.3 data |

## Not implemented

| Item | Reason |
|---|---|
| Every chain in "Warum installiert?" | the payload carries the shortest path only; all chains are sibling E.5 — the page names the gap and the `code-graph why` command |
| Per-workspace package identity | sibling E.4: ids are merged across workspaces, so a transitive package sits in the workspace of its shortest root (the six-package delta above) |
| Verdict states from the generator | sibling E.2; the page derives the six states from the payload fields as the handover's own `stOf` does |
| Call counts per function | sibling E.6: not indexed; named under "Was die Map hier nicht weiß" |
| "Nach Code-Area" by Code area | `byArea` counts per top-level folder (3.1); a Code-area key needs the area map joined into the payload — shown as "Nach Ordner", never relabelled |
| Local Branches preview (chain card, compare buttons, "Auf Branches" chips) | fixture-only in the handover; needs `.build/branch-chain.json` in a local map (sibling G.3); the committed state is built |
| Datenquelle radiogroup (D1) | owner-pending |
| Preselected `fastify@5.12.7` | the handover hand-picked it; the build selects the first package of the current sort |
