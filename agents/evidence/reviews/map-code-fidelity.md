<!-- evidence-type: analysis -->
# Fidelity matrix — code page against the 2026-10-bf handover

> **Handover.** `p11/Main.dc.html`, its markup, inline styles and logic class, in its "Echte Map" state and after its own "Demo · Fixture" radio.
> **Build.** `src/scripts/code_graph/map_viewer/area_code.js + viewer.css`, roadmap `road-to-map-views-from-the-handover` Phase 4.
> **Evidence taken.** `tests/scripts/code_graph/map_fidelity_probe.ts pages` (Chromium, no network, German locale): **real** = this repository's `agents/map/code/map.json` re-rendered with the current viewer; **demo** = `buildDemoMap` (the `map --demo` fixture). Each against the handover in the matching data state, at 1440, 375 and 320 px in both themes. Landmarks exclude the header, which `map-shell-fidelity.md` covers.

## Landmarks

Visible landmarks and widget roles below the header, 1440 px, dark. `*` marks the selected or checked option; order is not compared (the build mounts the tablist after the asides in the DOM).

| Data | Kind | Handover | Build | Status |
|---|---|---|---|---|
| real | groups | aside "Repository"; div[radiogroup] "Färben nach"; main ""; div[tablist] "Ansicht"; div[radiogroup] "Darstellung"; footer ""; aside "Detail"; div[tablist] "Detail"; div[radiogroup] "Scope" | aside "Repository"; div[radiogroup] "Färben nach"; main ""; div[tablist] "Ansicht"; nav "Breadcrumb"; div[radiogroup] "Darstellung"; footer ""; aside "Detail"; div[tablist] "Detail" | Δ the build carries its `nav "Breadcrumb"` (the Code trail, kept) and draws the Scope radiogroup only once a file is marked — the handover preselects one |
| real | roles | radio:Blast*; radio:Area; radio:Test-Anteil; radio:Rolle; radio:Churn; radio:Zeilen; radio:Ordner; radio:Layer; radio:Komplexität; tab:Graph*; tab:Layers; tab:Matrix; tab:Knowledge; tab:Treemap; tab:Flow · n. A.; radio:2D*; radio:3D Orb; tab:Datei*; tab:Befunde · 103; tab:Area; radio:Code*; radio:+ Tests; radio:+ Doku | radio:Blast*; radio:Area; radio:Test-Anteil; radio:Rolle; radio:Churn; radio:Zeilen; radio:Ordner; radio:Layerkeine Daten; radio:Domänekeine Daten; radio:Komplexitätkeine Daten; tab:Graph*; tab:Layers; tab:Matrix; tab:Knowledge; tab:Treemap; tab:Flown. A.; radio:2D*; radio:3D Orb; tab:Datei*; tab:Befunde · 182; tab:Area | Δ data and Decision D3: Layer and Komplexität carry "keine Daten" (no layers.yaml, no complexity field), Domäne stays (D3, owner-pending); Befunde count and the Scope radios follow the map; the Flow tab draws `n. A.` as a no-data tag |
| real | provenance footer | (the handover draws none in this state) | (none: the Code page has its own footer) | = |
| demo | groups | aside "Repository"; div[radiogroup] "Färben nach"; main ""; div[tablist] "Ansicht"; div[radiogroup] "Darstellung"; footer ""; aside "Detail"; div[tablist] "Detail"; div[radiogroup] "Scope" | aside "Repository"; div[radiogroup] "Färben nach"; main ""; div[tablist] "Ansicht"; nav "Breadcrumb"; div[radiogroup] "Darstellung"; footer ""; aside "Detail"; div[tablist] "Detail" | Δ as on the real map: the breadcrumb nav, Scope only with a marked file |
| demo | roles | radio:Blast*; radio:Area; radio:Test-Anteil; radio:Rolle; radio:Churn; radio:Zeilen; radio:Ordner; radio:Layer; radio:Komplexität; tab:Graph*; tab:Layers; tab:Matrix; tab:Knowledge; tab:Treemap; tab:Flow · n. A.; radio:2D*; radio:3D Orb; tab:Datei*; tab:Befunde · 103; tab:Area; radio:Code*; radio:+ Tests; radio:+ Doku | radio:Blast*; radio:Area; radio:Test-Anteil; radio:Rolle; radio:Churn; radio:Zeilen; radio:Ordner; radio:Layerkeine Daten; radio:Domäne; radio:Komplexitätkeine Daten; tab:Graph*; tab:Layers; tab:Matrix; tab:Knowledge; tab:Treemap; tab:Flown. A.; radio:2D*; radio:3D Orb; tab:Datei*; tab:Befunde · 557; tab:Area | Δ as on the real map; the demo's Domäne option is live |
| demo | provenance footer | (the handover draws none in this state) | (none: the Code page has its own footer) | = |

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
| idle tab | `height` | `34px` | `34px` | = |
| idle tab | `padding` | `0px 14px` | `0px 14px` | = |
| idle tab | `border-radius` | `7px` | `7px` | = |
| idle tab | `font-size` | `13px` | `13px` | = |
| idle tab | `font-weight` | `500` | `500` | = |
| idle tab | `color` | `rgb(195, 206, 221)` | `rgb(195, 206, 221)` | = |
| idle tab | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| idle tab | `box-shadow` | `none` | `none` | = |
| idle tab | `border` | `0px none` | `0px none` | = |
| aside cap | `height` | `15.3906px` | `15.3906px` | = |
| aside cap | `padding` | `0px` | `0px` | = |
| aside cap | `border-radius` | `0px` | `0px` | = |
| aside cap | `font-size` | `11px` | `11px` | = |
| aside cap | `font-weight` | `400` | `400` | = |
| aside cap | `color` | `rgb(147, 161, 181)` | `rgb(147, 161, 181)` | = |
| aside cap | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| aside cap | `box-shadow` | `none` | `none` | = |
| aside cap | `border` | `0px none` | `0px none` | = |
| provenance | — | absent | absent | not measurable in this state: the element is drawn on one side only |
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
| idle tab | `height` | `34px` | `34px` | = |
| idle tab | `padding` | `0px 14px` | `0px 14px` | = |
| idle tab | `border-radius` | `7px` | `7px` | = |
| idle tab | `font-size` | `13px` | `13px` | = |
| idle tab | `font-weight` | `500` | `500` | = |
| idle tab | `color` | `rgb(51, 65, 85)` | `rgb(51, 65, 85)` | = |
| idle tab | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| idle tab | `box-shadow` | `none` | `none` | = |
| idle tab | `border` | `0px none` | `0px none` | = |
| aside cap | `height` | `15.3906px` | `15.3906px` | = |
| aside cap | `padding` | `0px` | `0px` | = |
| aside cap | `border-radius` | `0px` | `0px` | = |
| aside cap | `font-size` | `11px` | `11px` | = |
| aside cap | `font-weight` | `400` | `400` | = |
| aside cap | `color` | `rgb(83, 96, 116)` | `rgb(83, 96, 116)` | = |
| aside cap | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| aside cap | `box-shadow` | `none` | `none` | = |
| aside cap | `border` | `0px none` | `0px none` | = |
| provenance | — | absent | absent | not measurable in this state: the element is drawn on one side only |
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
| Darstellung | 2D / 3D is a radiogroup; a second click keeps 3D, 2D takes it back | kind 3: `code_graph_map_ported_pages.test.ts` › delivery agent code | ✓ |
| Flow | the tab carries "n. A." | kind 3: same spec; `code_graph_map_no_data.test.ts` › the Flow lens | ✓ |
| Scope | radiogroup Code / + Tests / + Doku | kind 3: `code_graph_map_port.test.ts` (unchanged, blast card) | ✓ |
| Colour by | the handover's nine options; Domäne kept (Decision D3) | kind 3: › delivery agent code asserts Domäne is present | ✓ |

## Not implemented

| Item | Reason |
|---|---|
| Colour-by without Domäne (D3) | the roadmap step keeps Domäne per D3 while the decision row's handover default drops it — the two disagree; kept, owner-pending |
| Preselected file with Scope radios on load | the build marks no file until the reader picks one |
| "Daten aus map.json @ 17a4f38a" header chip | a design artefact of an older map, not a control |
