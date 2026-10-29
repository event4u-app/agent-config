<!-- evidence-type: analysis -->
# Fidelity matrix — Bugs & Fixes against the 2026-10-bf handover

> **Handover.** `p02/Bugs.dc.html` ("Bugs & Fixes · lokal"): its real state (a committed map) and its demo state (a local map with a Sentry fixture).
> **Build.** `src/scripts/code_graph/map_viewer/area_bugs.{js,css}`, roadmap `road-to-map-views-from-the-handover` Phase 7.
> **Evidence taken.** `tests/scripts/code_graph/map_fidelity_probe.ts bugs` (Chromium, no network, German locale): **committed** = this repository's `agents/map/code/map.json` re-rendered with the current viewer, against the handover's real state; **local** = the same map rendered with a bug-lane payload in the shape of sibling Stage H, against the handover's demo state; 1440, 375 and 320 px in both themes. Behaviour rows name `tests/scripts/code_graph_map_bugs_page.test.ts`.

## Landmarks

Visible landmarks and widget roles below the header, 1440 px, dark.

| State | Handover | Build | Status |
|---|---|---|---|
| committed · groups | `div[tablist] "Ansicht"`; `main ""` | the same; no aside | = |
| committed · roles | `tab:Bugs & Fixes · keine Daten*` | the same | = |
| committed · footer | Echte Daten · agents/map @ 2efd5be1 · keine Bug-Lane | Echte Daten · agents/map @ 2efd5be1 · keine Bug-Lane | = |
| local · groups | tablist; `aside "Filter"`; `main ""`; `nav "Verlauf"`; `aside "Bug"` | the same five | = |
| local · roles | Übersicht · Bugs · 9 · Behoben · 4 · Regressionspfade · Zeitleiste; Status, Quelle (with "kein Adapter"), Umgebung, Area, Ursache, Symbolisierung checkboxes | the same tabs and groups; counts and values from the probe's two-bug lane (Bugs · 2 · Behoben · 1), Bugsnag disabled with "kein Adapter" | = structure, Δ data (fixture against fixture) |

## Computed styles (dark)

`getComputedStyle` at 1440 px, dark, committed state.

| Element | Property | Handover (computed) | Build (computed) | Status |
|---|---|---|---|---|
| selected tab | `height` | `34px` | `34px` | = |
| selected tab | `padding` | `0px 14px` | `0px 14px` | = |
| selected tab | `border-radius` | `7px` | `7px` | = |
| selected tab | `font-size` | `13px` | `13px` | = |
| selected tab | `font-weight` | `600` | `600` | = |
| selected tab | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| selected tab | `background-color` | `rgba(255, 140, 42, 0.16)` | `rgba(255, 140, 42, 0.16)` | = |
| selected tab | `box-shadow` | `rgba(255, 140, 42, 0.55) 0px 0px 0px 1px inset` | `rgba(255, 140, 42, 0.55) 0px 0px 0px 1px inset` | = |
| selected tab | `border` | `0px none` | `0px none` | = |
| selected tab | `white-space` | `normal` | `normal` | = |
| selected tab | `gap` | `normal` | `normal` | = |
| reason card | `height` | `167.156px` | `223.344px` | Δ 18 px taller drawn box: the build's command chips sit on their own wrapped row (`.sy-chips`); padding, radius, border and colours are equal |
| reason card | `padding` | `18px` | `18px` | = |
| reason card | `border-radius` | `12px` | `12px` | = |
| reason card | `font-size` | `14px` | `14px` | = |
| reason card | `font-weight` | `400` | `400` | = |
| reason card | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| reason card | `background-color` | `rgb(13, 19, 29)` | `rgb(13, 19, 29)` | = |
| reason card | `box-shadow` | `none` | `none` | = |
| reason card | `border` | `1px dashed rgb(42, 52, 69)` | `1px dashed rgb(42, 52, 69)` | = |
| reason card | `white-space` | `normal` | `normal` | = |
| reason card | `gap` | `10px` | `10px` | = |
| first why-empty tile | `height` | `55.7812px` | `81.7812px` | = drawn box: content-box + 2×12px padding + 2×1px border |
| first why-empty tile | `padding` | `12px` | `12px` | = |
| first why-empty tile | `border-radius` | `10px` | `10px` | = |
| first why-empty tile | `font-size` | `14px` | `14px` | = |
| first why-empty tile | `font-weight` | `400` | `400` | = |
| first why-empty tile | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| first why-empty tile | `background-color` | `rgba(255, 140, 42, 0.16)` | `rgba(255, 140, 42, 0.16)` | = |
| first why-empty tile | `box-shadow` | `none` | `none` | = |
| first why-empty tile | `border` | `1px solid rgba(255, 140, 42, 0.55)` | `1px solid rgba(255, 140, 42, 0.55)` | = |
| first why-empty tile | `white-space` | `normal` | `normal` | = |
| first why-empty tile | `gap` | `4px` | `4px` | = |

## Computed styles (light)

`getComputedStyle` at 1440 px, light, committed state.

| Element | Property | Handover (computed) | Build (computed) | Status |
|---|---|---|---|---|
| selected tab | `height` | `34px` | `34px` | = |
| selected tab | `padding` | `0px 14px` | `0px 14px` | = |
| selected tab | `border-radius` | `7px` | `7px` | = |
| selected tab | `font-size` | `13px` | `13px` | = |
| selected tab | `font-weight` | `600` | `600` | = |
| selected tab | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| selected tab | `background-color` | `rgba(244, 122, 18, 0.12)` | `rgba(244, 122, 18, 0.12)` | = |
| selected tab | `box-shadow` | `rgba(244, 122, 18, 0.6) 0px 0px 0px 1px inset` | `rgba(244, 122, 18, 0.6) 0px 0px 0px 1px inset` | = |
| selected tab | `border` | `0px none` | `0px none` | = |
| selected tab | `white-space` | `normal` | `normal` | = |
| selected tab | `gap` | `normal` | `normal` | = |
| reason card | `height` | `167.156px` | `223.344px` | Δ 18 px taller drawn box: the build's command chips sit on their own wrapped row (`.sy-chips`); padding, radius, border and colours are equal |
| reason card | `padding` | `18px` | `18px` | = |
| reason card | `border-radius` | `12px` | `12px` | = |
| reason card | `font-size` | `14px` | `14px` | = |
| reason card | `font-weight` | `400` | `400` | = |
| reason card | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| reason card | `background-color` | `rgb(255, 255, 255)` | `rgb(255, 255, 255)` | = |
| reason card | `box-shadow` | `none` | `none` | = |
| reason card | `border` | `1px dashed rgb(195, 204, 217)` | `1px dashed rgb(195, 204, 217)` | = |
| reason card | `white-space` | `normal` | `normal` | = |
| reason card | `gap` | `10px` | `10px` | = |
| first why-empty tile | `height` | `55.7812px` | `81.7812px` | = drawn box: content-box + 2×12px padding + 2×1px border |
| first why-empty tile | `padding` | `12px` | `12px` | = |
| first why-empty tile | `border-radius` | `10px` | `10px` | = |
| first why-empty tile | `font-size` | `14px` | `14px` | = |
| first why-empty tile | `font-weight` | `400` | `400` | = |
| first why-empty tile | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| first why-empty tile | `background-color` | `rgba(244, 122, 18, 0.12)` | `rgba(244, 122, 18, 0.12)` | = |
| first why-empty tile | `box-shadow` | `none` | `none` | = |
| first why-empty tile | `border` | `1px solid rgba(244, 122, 18, 0.6)` | `1px solid rgba(244, 122, 18, 0.6)` | = |
| first why-empty tile | `white-space` | `normal` | `normal` | = |
| first why-empty tile | `gap` | `4px` | `4px` | = |

## Overflow 1440/375/320

`document.documentElement.scrollWidth − innerWidth` > 0, handover / build — none in any of the 12 measured states (committed and local × dark and light × three widths).

| State | Theme | 1440 | 375 | 320 | Status |
|---|---|---|---|---|---|
| committed | dark | none / none | none / none | none / none | = |
| committed | light | none / none | none / none | none / none | = |
| local | dark | none / none | none / none | none / none | = |
| local | light | none / none | none / none | none / none | = |

## Behaviour

| Chapter | Claim | Evidence | Status |
|---|---|---|---|
| 7.1 local | five lenses with counts, the six filter groups with "kein Adapter", Verlauf crumbs with ←, the bug detail with fix commits, timeline, frames, hypotheses and the introducing-commit candidate | kind 3: `code_graph_map_bugs_page.test.ts` › local (a filter changes the count; ← restores it) | ✓ |
| 7.2 committed | only the "keine Daten" tab, the reason card, the why-empty tiles and the "nicht in committeter Map" chip; Bugs dim in the nav | kind 3: › committed | ✓ |
| AC-17 view half | a bug id, title and message planted in `.build/bugs/` (root and under `agents/map/.build/`) appear in no file under `agents/map/` outside `.build/`; sensitivity — the same scan finds the title once it is written outside `.build` | kind 3: › committed | ✓ |

## Not implemented

| Item | Reason |
|---|---|
| Reading `.build/bugs/` into a local map | the bug lane and `code-graph map --local` are sibling Stage H, not in the tree; the page draws `areas.bugs` in that shape once it is written. The AC-17 check therefore passes today because nothing reads the lane — it guards the day something does |
| Übersicht, Regressionspfade and Zeitleiste content beyond the bug rows ("Vom Verdacht zum Beweis", Route radiogroup, "Für den Agenten", "Daten & Schutz") | need the lane's regression paths and event series (Stage H); the lenses list the bugs that carry the fields |
| Datenquelle radiogroup (D1) | owner-pending |
