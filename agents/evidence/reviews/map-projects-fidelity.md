<!-- evidence-type: analysis -->
# Fidelity matrix — Projects hub against the 2026-10-bf handover

> **Handover.** `p07/Estate.dc.html` ("Projects · globaler Scope"), its markup, inline styles and logic class (`hubLenses`, `meKpis`, `meCands`, `meSig`). Its data is a fixture.
> **Build.** `src/scripts/code_graph/map_viewer/area_projects.js` (`hubLensBar`, `hubMe`) and `area_ops.css`; the `HubMe` payload contract in `estate_map.ts`; roadmap `road-to-map-views-from-the-handover` step 5.1.
> **Evidence taken.** `tests/scripts/code_graph/map_fidelity_probe.ts projects` (Chromium, no network, German locale): the demo hub (`buildDemoMap`, the `map --demo` fixture) against the handover, both lenses clicked in both, at 1440, 375 and 320 px in both themes. Behaviour rows name `tests/scripts/code_graph_map_projects_page.test.ts`.

## Landmarks

Visible landmarks and widget roles below the header, 1440 px, dark.

| Lens | Handover | Build | Status |
|---|---|---|---|
| Projekte · groups | `div[tablist] "Ansicht"`; `aside "Registry"`; `main ""`; `aside "Kante"` | the same four | = |
| Projekte · roles | `tab:Projekte*`; `tab:Ich · Lernen` | the same | = |
| Projekte · scope note | Projekte auf diesem Rechner | Projekte auf diesem Rechner | = |
| Ich · Lernen · groups | tablist; `aside "Registry"`; `main ""`; four KPI `switch` buttons; no Kante aside | tablist; `aside "Registry"`; `main ""`; no Kante aside | Δ data: the four KPI switches are the handover's sample signals; the build draws KPIs only from `me` (sibling Stage K), absent here, and shows the empty state with its reason |
| Ich · Lernen · scope note | Nutzer-Learnings · K.2–K.8 · Beispieldaten | Nutzer-Learnings · K.2–K.8 | = minus the sample marker: the build draws no sample data |

## Computed styles (dark)

`getComputedStyle` at 1440 px, dark, Projekte lens.

| Element | Property | Handover (computed) | Build (computed) | Status |
|---|---|---|---|---|
| selected lens (violet) | `height` | `34px` | `34px` | = |
| selected lens (violet) | `padding` | `0px 14px` | `0px 14px` | = |
| selected lens (violet) | `border-radius` | `7px` | `7px` | = |
| selected lens (violet) | `font-size` | `13px` | `13px` | = |
| selected lens (violet) | `font-weight` | `600` | `600` | = |
| selected lens (violet) | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| selected lens (violet) | `background-color` | `rgba(201, 162, 255, 0.16)` | `rgba(201, 162, 255, 0.16)` | = |
| selected lens (violet) | `box-shadow` | `rgb(201, 162, 255) 0px 0px 0px 1px inset` | `rgb(201, 162, 255) 0px 0px 0px 1px inset` | = |
| selected lens (violet) | `border` | `0px none` | `0px none` | = |
| selected lens (violet) | `white-space` | `normal` | `normal` | = |
| selected lens (violet) | `gap` | `normal` | `normal` | = |
| aside cap | `height` | `15.3906px` | `15.3906px` | = |
| aside cap | `padding` | `0px` | `0px` | = |
| aside cap | `border-radius` | `0px` | `0px` | = |
| aside cap | `font-size` | `11px` | `11px` | = |
| aside cap | `font-weight` | `400` | `400` | = |
| aside cap | `color` | `rgb(147, 161, 181)` | `rgb(147, 161, 181)` | = |
| aside cap | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| aside cap | `box-shadow` | `none` | `none` | = |
| aside cap | `border` | `0px none` | `0px none` | = |
| aside cap | `white-space` | `normal` | `normal` | = |
| aside cap | `gap` | `normal` | `normal` | = |
| scope note | `height` | `16.7969px` | `16.7969px` | = |
| scope note | `padding` | `0px` | `0px` | = |
| scope note | `border-radius` | `0px` | `0px` | = |
| scope note | `font-size` | `12px` | `12px` | = |
| scope note | `font-weight` | `400` | `400` | = |
| scope note | `color` | `rgb(147, 161, 181)` | `rgb(147, 161, 181)` | = |
| scope note | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| scope note | `box-shadow` | `none` | `none` | = |
| scope note | `border` | `0px none` | `0px none` | = |
| scope note | `white-space` | `normal` | `normal` | = |
| scope note | `gap` | `normal` | `normal` | = |

## Computed styles (light)

`getComputedStyle` at 1440 px, light, Projekte lens.

| Element | Property | Handover (computed) | Build (computed) | Status |
|---|---|---|---|---|
| selected lens (violet) | `height` | `34px` | `34px` | = |
| selected lens (violet) | `padding` | `0px 14px` | `0px 14px` | = |
| selected lens (violet) | `border-radius` | `7px` | `7px` | = |
| selected lens (violet) | `font-size` | `13px` | `13px` | = |
| selected lens (violet) | `font-weight` | `600` | `600` | = |
| selected lens (violet) | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| selected lens (violet) | `background-color` | `rgba(124, 58, 237, 0.1)` | `rgba(124, 58, 237, 0.1)` | = |
| selected lens (violet) | `box-shadow` | `rgb(139, 92, 246) 0px 0px 0px 1px inset` | `rgb(139, 92, 246) 0px 0px 0px 1px inset` | = |
| selected lens (violet) | `border` | `0px none` | `0px none` | = |
| selected lens (violet) | `white-space` | `normal` | `normal` | = |
| selected lens (violet) | `gap` | `normal` | `normal` | = |
| aside cap | `height` | `15.3906px` | `15.3906px` | = |
| aside cap | `padding` | `0px` | `0px` | = |
| aside cap | `border-radius` | `0px` | `0px` | = |
| aside cap | `font-size` | `11px` | `11px` | = |
| aside cap | `font-weight` | `400` | `400` | = |
| aside cap | `color` | `rgb(83, 96, 116)` | `rgb(83, 96, 116)` | = |
| aside cap | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| aside cap | `box-shadow` | `none` | `none` | = |
| aside cap | `border` | `0px none` | `0px none` | = |
| aside cap | `white-space` | `normal` | `normal` | = |
| aside cap | `gap` | `normal` | `normal` | = |
| scope note | `height` | `16.7969px` | `16.7969px` | = |
| scope note | `padding` | `0px` | `0px` | = |
| scope note | `border-radius` | `0px` | `0px` | = |
| scope note | `font-size` | `12px` | `12px` | = |
| scope note | `font-weight` | `400` | `400` | = |
| scope note | `color` | `rgb(83, 96, 116)` | `rgb(83, 96, 116)` | = |
| scope note | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| scope note | `box-shadow` | `none` | `none` | = |
| scope note | `border` | `0px none` | `0px none` | = |
| scope note | `white-space` | `normal` | `normal` | = |
| scope note | `gap` | `normal` | `normal` | = |

## Overflow 1440/375/320

`document.documentElement.scrollWidth − innerWidth` > 0, handover / build.

| Theme | Lens | 1440 | 375 | 320 | Status |
|---|---|---|---|---|---|
| dark | Projekte | none / none | none / none | none / none | = |
| dark | Ich · Lernen | none / none | none / none | none / none | = |
| light | Projekte | none / none | none / none | none / none | = |
| light | Ich · Lernen | none / none | none / none | none / none | = |

## Behaviour

| Chapter | Claim | Evidence | Status |
|---|---|---|---|
| Lenses | Projekte / Ich · Lernen, violet selection, scope note per lens | kind 3: `code_graph_map_projects_page.test.ts` › Projekte | ✓ |
| Asides | Registry with Budget, Kante, "← Projekt-Map" | kind 3: same spec | ✓ |
| Ich · Lernen empty | "Nur du siehst das." panel, empty card with the reason, no Kante aside | kind 3: › Ich · Lernen | ✓ |
| Ich · Lernen with data | KPIs, candidates and signals drawn from `me` only; sensitivity — the same page without `me` draws no KPI | kind 3: › Ich · Lernen (both payloads) | ✓ |

## Not implemented

| Item | Reason |
|---|---|
| Ich · Lernen KPIs as filter switches, "Übernehmen" / "Verwerfen" on candidates, "Wohin ein Signal geht" | need the user learning lane (sibling Stage K) and its accept command; the handover's figures are samples and are never drawn |
| Budget figure "781 MB von 2.048 MB · LRU-Verdrängung" | the hub keeps no size budget yet; the Registry aside says so with its no-data tag |
| A comparison against a real hub | the hub is per machine and not in the tree; the demo hub is the measured build |
