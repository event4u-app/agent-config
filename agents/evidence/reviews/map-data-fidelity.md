<!-- evidence-type: analysis -->
# Fidelity matrix — data page against the 2026-10-bf handover

> **Handover.** `p03/Database.dc.html`, its markup, inline styles and logic class, in its "Echte Map" state and after its own "Demo · Fixture" radio.
> **Build.** `src/scripts/code_graph/map_viewer/area_data.js`, roadmap `road-to-map-views-from-the-handover` Phase 4.
> **Evidence taken.** `tests/scripts/code_graph/map_fidelity_probe.ts pages` (Chromium, no network, German locale): **real** = this repository's `agents/map/code/map.json` re-rendered with the current viewer; **demo** = `buildDemoMap` (the `map --demo` fixture). Each against the handover in the matching data state, at 1440, 375 and 320 px in both themes. Landmarks exclude the header, which `map-shell-fidelity.md` covers.

## Landmarks

Visible landmarks and widget roles below the header, 1440 px, dark. `*` marks the selected or checked option; order is not compared (the build mounts the tablist after the asides in the DOM).

| Data | Kind | Handover | Build | Status |
|---|---|---|---|---|
| real | groups | div[tablist] "Ansicht"; main "" | main ""; div[tablist] "Ansicht" | = |
| real | roles | tab:ERD · noch keine Daten* | tab:ERD · noch keine Daten* | = |
| real | provenance footer | Echte Daten · data.json @ 2efd5be1 · Witnesses unconfirmed | Echte Daten · data.json @ 2efd5be1 | Δ hand-written: the handover appends "Witnesses unconfirmed" here although every one of the payload's 36 witnesses sits on a finding; the build appends it when the page's own items carry only unconfirmed witnesses |
| demo | groups | aside "Schema"; button[switch] ""; button[switch] ""; button[switch] ""; button[switch] ""; main ""; div[tablist] "Ansicht"; div[radiogroup] "Linien"; div[radiogroup] "Spalten"; div[radiogroup] "Layout"; div[radiogroup] "2D / 3D"; aside "Detail" | aside "Schema"; button[switch] ""; button[switch] ""; button[switch] ""; button[switch] ""; main ""; div[tablist] "Ansicht"; div[radiogroup] "Linien"; div[radiogroup] "Spalten"; div[radiogroup] "Layout"; div[radiogroup] "2D / 3D"; aside "Detail" | = |
| demo | roles | switch:C Code / ORM Eloquent-Models, Relationen vollständ*; switch:M Migration gewünschter Stand @ 17a4f38a vollständ*; switch:L Live-Schema Katalog staging · 24.10. staging*; switch:Q Query-Nutzung statische SQL-Stellen unbekannt; tab:ERD*; tab:Drift M ↔ L; tab:Migrationen; radio:Alle; radio:Fokus*; radio:Aus; radio:Alle*; radio:Schlüssel; radio:Raster*; radio:Nach Domäne; radio:2D*; radio:3D | switch:C Code / ORM 83 Model-Datei(en), 306 Relation(en) *; switch:M Migration gewünschter Stand · 111 Tabellen aus 1*; switch:L Ist-Schema gespeicherte Schema-Datei · Coupon.js*; switch:Q Query-Nutzung 4 Spalte(n) in Queries benannt tei; tab:ERD*; tab:Drift M ↔ L; tab:Migrationen; radio:Alle; radio:Fokus*; radio:Aus; radio:Alle; radio:Schlüssel*; radio:Raster*; radio:Nach Domäne; radio:2D*; radio:3D | Δ data: the same four source switches, three tabs and four radiogroups; texts and the Spalten default come from each fixture (the build's demo has >40 tables, so it opens on Schlüssel) |
| demo | provenance footer | (the handover draws none in this state) | Beispieldaten · Fixture · data.json @ 2dfc1e09 · Witnesses unconfirmed | Δ the handover's demo state draws no footer; the build names the fixture, its file and commit |

## Computed styles (dark)

`getComputedStyle` at 1440 px, dark, real map, first visible element per selector.

| Element | Property | Handover (computed) | Build (computed) | Status |
|---|---|---|---|---|
| tablist | `height` | `34px` | `44px` | = drawn box: the handover is `content-box`, the build `border-box`; content + padding + border are the same |
| tablist | `padding` | `4px` | `4px` | = |
| tablist | `border-radius` | `10px` | `10px` | = |
| tablist | `font-size` | `14px` | `14px` | = |
| tablist | `font-weight` | `400` | `400` | = |
| tablist | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| tablist | `background-color` | `rgb(13, 19, 29)` | `rgb(13, 19, 29)` | = |
| tablist | `box-shadow` | `none` | `none` | = |
| tablist | `border` | `1px solid rgb(28, 39, 56)` | `1px solid rgb(28, 39, 56)` | = |
| selected tab | `height` | `34px` | `34px` | = |
| selected tab | `padding` | `0px 14px` | `0px 14px` | = |
| selected tab | `border-radius` | `7px` | `7px` | = |
| selected tab | `font-size` | `13px` | `13px` | = |
| selected tab | `font-weight` | `600` | `600` | = |
| selected tab | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| selected tab | `background-color` | `rgba(255, 140, 42, 0.16)` | `rgba(255, 140, 42, 0.16)` | = |
| selected tab | `box-shadow` | `rgba(255, 140, 42, 0.55) 0px 0px 0px 1px inset` | `rgba(255, 140, 42, 0.55) 0px 0px 0px 1px inset` | = |
| selected tab | `border` | `0px none` | `0px none` | = |
| idle tab | — | absent | absent | not measurable in this state: the element is drawn on one side only |
| aside cap | — | absent | absent | not measurable in this state: the element is drawn on one side only |
| provenance | `height` | `15.3906px` | `15.3906px` | = |
| provenance | `padding` | `0px` | `0px` | = |
| provenance | `border-radius` | `0px` | `0px` | = |
| provenance | `font-size` | `11px` | `11px` | = |
| provenance | `font-weight` | `400` | `400` | = |
| provenance | `color` | `rgb(111, 125, 146)` | `rgb(111, 125, 146)` | = |
| provenance | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| provenance | `box-shadow` | `none` | `none` | = |
| provenance | `border` | `0px none` | `0px none` | = |
| checked radio | — | the handover's first checked radio is its Datenquelle toggle | the build has no such control | not comparable: Decision D1 (not built); the page's own radios are compared in Landmarks and by the behaviour specs |

## Computed styles (light)

`getComputedStyle` at 1440 px, light, real map, first visible element per selector.

| Element | Property | Handover (computed) | Build (computed) | Status |
|---|---|---|---|---|
| tablist | `height` | `34px` | `44px` | = drawn box: the handover is `content-box`, the build `border-box`; content + padding + border are the same |
| tablist | `padding` | `4px` | `4px` | = |
| tablist | `border-radius` | `10px` | `10px` | = |
| tablist | `font-size` | `14px` | `14px` | = |
| tablist | `font-weight` | `400` | `400` | = |
| tablist | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| tablist | `background-color` | `rgb(255, 255, 255)` | `rgb(255, 255, 255)` | = |
| tablist | `box-shadow` | `none` | `none` | = |
| tablist | `border` | `1px solid rgb(221, 227, 236)` | `1px solid rgb(221, 227, 236)` | = |
| selected tab | `height` | `34px` | `34px` | = |
| selected tab | `padding` | `0px 14px` | `0px 14px` | = |
| selected tab | `border-radius` | `7px` | `7px` | = |
| selected tab | `font-size` | `13px` | `13px` | = |
| selected tab | `font-weight` | `600` | `600` | = |
| selected tab | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| selected tab | `background-color` | `rgba(244, 122, 18, 0.12)` | `rgba(244, 122, 18, 0.12)` | = |
| selected tab | `box-shadow` | `rgba(244, 122, 18, 0.6) 0px 0px 0px 1px inset` | `rgba(244, 122, 18, 0.6) 0px 0px 0px 1px inset` | = |
| selected tab | `border` | `0px none` | `0px none` | = |
| idle tab | — | absent | absent | not measurable in this state: the element is drawn on one side only |
| aside cap | — | absent | absent | not measurable in this state: the element is drawn on one side only |
| provenance | `height` | `15.3906px` | `15.3906px` | = |
| provenance | `padding` | `0px` | `0px` | = |
| provenance | `border-radius` | `0px` | `0px` | = |
| provenance | `font-size` | `11px` | `11px` | = |
| provenance | `font-weight` | `400` | `400` | = |
| provenance | `color` | `rgb(133, 146, 165)` | `rgb(133, 146, 165)` | = |
| provenance | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| provenance | `box-shadow` | `none` | `none` | = |
| provenance | `border` | `0px none` | `0px none` | = |
| checked radio | — | the handover's first checked radio is its Datenquelle toggle | the build has no such control | not comparable: Decision D1 (not built); the page's own radios are compared in Landmarks and by the behaviour specs |

## Overflow 1440/375/320

`document.documentElement.scrollWidth − innerWidth` > 0, handover / build.

| Data | Theme | 1440 | 375 | 320 | Status |
|---|---|---|---|---|---|
| real | dark | none / none | none / none | none / none | = no document overflow |
| real | light | none / none | none / none | none / none | = no document overflow |
| demo | dark | none / none | none / none | none / none | = no document overflow |
| demo | light | none / none | none / none | none / none | = no document overflow |

## Behaviour

| Chapter | Claim | Evidence | Status |
|---|---|---|---|
| Empty lane | one tab "ERD · noch keine Daten", reader line, reason card with T1–T4, "Trotzdem gefunden" list, footer; no aside | kind 3: `code_graph_map_no_data.test.ts` › skeleton; sensitivity — without a reader at all the page is the no-data card (› skeleton sensitivity) | ✓ |
| 2D / 3D | a radiogroup with `aria-checked` | kind 3: `code_graph_map_demo_browser.test.ts` (2D checked), `code_graph_map_keylinks.test.ts` | ✓ |
| Spalten | radiogroup Alle / Schlüssel | kind 3: `code_graph_map_keylinks.test.ts` (`.db-seg[aria-label]` radios) | ✓ |
| Aside names | Schema / Detail | kind 3: `code_graph_map_shell_overflow.test.ts` › each aside is named | ✓ |

## Not implemented

| Item | Reason |
|---|---|
| Datenquelle radiogroup "Echte Map / Demo · Fixture" (D1) | a map file carries one dataset; the demo is its own build — owner-pending |
| "Laravel" in "alle aus Laravel-Test-Fixtures" | the build derives "Test-Fixtures" from the finding subjects; the framework is the handover author's reading |
| German reason text | the reason is the data lane's own English payload text |
