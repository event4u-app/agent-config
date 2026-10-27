<!-- evidence-type: analysis -->
# Fidelity matrix — impact page against the 2026-10-bf handover

> **Handover.** `p04/Impact.dc.html`, its markup, inline styles and logic class, in its "Echte Map" state and after its own "Demo · Fixture" radio.
> **Build.** `src/scripts/code_graph/map_viewer/area_impact.js + area_impact.css`, roadmap `road-to-map-views-from-the-handover` Phase 4.
> **Evidence taken.** `tests/scripts/code_graph/map_fidelity_probe.ts pages` (Chromium, no network, German locale): **real** = this repository's `agents/map/code/map.json` re-rendered with the current viewer; **demo** = `buildDemoMap` (the `map --demo` fixture). Each against the handover in the matching data state, at 1440, 375 and 320 px in both themes. Landmarks exclude the header, which `map-shell-fidelity.md` covers.

## Landmarks

Visible landmarks and widget roles below the header, 1440 px, dark. `*` marks the selected or checked option; order is not compared (the build mounts the tablist after the asides in the DOM).

| Data | Kind | Handover | Build | Status |
|---|---|---|---|---|
| real | groups | div[tablist] "Ansicht"; main "" | div[tablist] "Ansicht"; main "" | = |
| real | roles | tab:Änderung · keine* | tab:Änderung · keine* | = |
| real | provenance footer | Echte Daten · code/map.json → areas.impact @ 2efd5be1 · Witnesses unconfirmed | Echte Daten · code/map.json → areas.impact @ 2efd5be1 | Δ hand-written: the handover appends "Witnesses unconfirmed" to a payload with no witness at all; the build names only what it counts |
| demo | groups | main ""; aside "Nachweisbericht" | main ""; aside "Nachweisbericht" | = |
| demo | roles | (none) | (none) | = |
| demo | provenance footer | (the handover draws none in this state) | Beispieldaten · Fixture · code/map.json → areas.impact @ 2dfc1e09 · Witnesses unconfirmed | Δ the handover's demo state draws no footer; the build names the fixture, its file and commit |

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
| Empty lane | one tab "Änderung · keine", rev line, clean-tree sentence, how content appears, footer; no aside | kind 3: `code_graph_map_no_data.test.ts` › skeleton | ✓ |
| Aside name | Nachweisbericht | kind 3: `code_graph_map_shell_overflow.test.ts` › each aside is named | ✓ |
| Demo report | Änderung lens, Nachweisbericht aside | kind 3: `code_graph_map_ported_pages.test.ts` Impact suite (unchanged) | ✓ |

## Not implemented

| Item | Reason |
|---|---|
| Datenquelle radiogroup (D1) | owner-pending |
| "Witnesses unconfirmed" on a payload without witnesses | the build names only what it counted |
