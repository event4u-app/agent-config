<!-- evidence-type: analysis -->
# Fidelity matrix — map shell (header, nav, panes) against the 2026-10-bf handover

> **Handover.** `p12/Overview.dc.html` header and nav (identical on the other eleven
> pages), the breakpoint block of every `<helmet><style>`, and the flyout logic of
> `p08/Systems.dc.html` / `p11/Main.dc.html`.
> **Build.** `map.ts` `renderPage` (header markup), `map_viewer/shell.{js,css}`,
> `areas_common.js` (nav routes, Verlauf, provenance, aside names), `viewer.css`
> (breakpoints, flyouts). Roadmap `road-to-map-views-from-the-handover` Phase 1.
> **Evidence taken.** `tests/scripts/code_graph/map_fidelity_probe.ts shell`
> (Chromium, no network, German locale): this repository's `agents/map/code/map.json`
> re-rendered with the current viewer at `#/overview`, against the handover page, at
> 1440, 375 and 320 px in both colour schemes. Behaviour rows name the browser specs
> that run them.

## Landmarks

Landmarks and widget roles inside `<header>`, visible ones only, identical at every width and in both themes.

| Width · theme | Handover | Build | Status |
|---|---|---|---|
| 1440 · 375 · 320, dark and light | `header ""`, `nav "Ebenen"`; no tab, radio, checkbox or switch | `header ""`, `nav "Ebenen"`; no tab, radio, checkbox or switch | = |
| nav entries, 1440 | Übersicht · Code · Data · Systeme · Interfaces · Runtime · Delivery · Bugs · Wissen · Impact · Agent | the same eleven, same order | = |
| no-data titles | Data, Bugs, Impact: "noch keine Daten in der echten Map" / "Bug-Daten sind lokal – nie in der committeten Map" | Data, Bugs, Impact, **Wissen** with the same two texts | Δ data: Wissen has no knowledge-source payload yet (Phase 6), the handover drew it from Markdown counts |
| header height (px) 1440 / 375 / 320 | 109 / 273 / 305 | 109 / 271 / 271 | = at 1440 and 375; at 320 the handover's search row wraps once more (its `min-width: 180px` search beside three chips), the build's chips fit |
| ☰ area menu | none | none (`#areamenu` removed, Decision D6) | = |

## Computed styles (dark)

`getComputedStyle` at 1440 px, dark.

| Element | Property | Handover (computed) | Build (computed) | Status |
|---|---|---|---|---|
| `nav a` (idle) | `height` | `34px` | `34px` | = |
| `nav a` (idle) | `padding` | `0px 14px` | `0px 14px` | = |
| `nav a` (idle) | `border-radius` | `7px` | `7px` | = |
| `nav a` (idle) | `font-size` | `13px` | `13px` | = |
| `nav a` (idle) | `font-weight` | `500` | `500` | = |
| `nav a` (idle) | `color` | `rgb(195, 206, 221)` | `rgb(195, 206, 221)` | = |
| `nav a` (idle) | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| `nav a` (idle) | `box-shadow` | `none` | `none` | = |
| `nav a` (idle) | `border` | `0px none` | `0px none` | = |
| `nav a` (idle) | `white-space` | `normal` | `normal` | = |
| `nav a` (idle) | `gap` | `normal` | `normal` | = |
| `[aria-current]` | `height` | `34px` | `34px` | = |
| `[aria-current]` | `padding` | `0px 14px` | `0px 14px` | = |
| `[aria-current]` | `border-radius` | `7px` | `7px` | = |
| `[aria-current]` | `font-size` | `13px` | `13px` | = |
| `[aria-current]` | `font-weight` | `600` | `600` | = |
| `[aria-current]` | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| `[aria-current]` | `background-color` | `rgba(255, 140, 42, 0.16)` | `rgba(255, 140, 42, 0.16)` | = |
| `[aria-current]` | `box-shadow` | `rgba(255, 140, 42, 0.55) 0px 0px 0px 1px inset` | `rgba(255, 140, 42, 0.55) 0px 0px 0px 1px inset` | = |
| `[aria-current]` | `border` | `0px none` | `0px none` | = |
| `[aria-current]` | `white-space` | `normal` | `normal` | = |
| `[aria-current]` | `gap` | `normal` | `normal` | = |
| `nav a` no data | `height` | `34px` | `34px` | = |
| `nav a` no data | `padding` | `0px 14px` | `0px 14px` | = |
| `nav a` no data | `border-radius` | `7px` | `7px` | = |
| `nav a` no data | `font-size` | `13px` | `13px` | = |
| `nav a` no data | `font-weight` | `500` | `500` | = |
| `nav a` no data | `color` | `rgb(111, 125, 146)` | `rgb(111, 125, 146)` | = |
| `nav a` no data | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| `nav a` no data | `box-shadow` | `none` | `none` | = |
| `nav a` no data | `border` | `0px none` | `0px none` | = |
| `nav a` no data | `white-space` | `normal` | `normal` | = |
| `nav a` no data | `gap` | `6px` | `6px` | = |
| commit chip | `height` | `16.7969px` | `26.7969px` | = drawn box: the build is `border-box`, the handover `content-box`; content + 2×4px padding (+ 2×1px border) gives the same outer box |
| commit chip | `padding` | `4px 8px` | `4px 8px` | = |
| commit chip | `border-radius` | `6px` | `6px` | = |
| commit chip | `font-size` | `12px` | `12px` | = |
| commit chip | `font-weight` | `400` | `400` | = |
| commit chip | `color` | `rgb(195, 206, 221)` | `rgb(195, 206, 221)` | = |
| commit chip | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| commit chip | `box-shadow` | `none` | `none` | = |
| commit chip | `border` | `1px solid rgb(28, 39, 56)` | `1px solid rgb(28, 39, 56)` | = |
| commit chip | `white-space` | `nowrap` | `nowrap` | = |
| commit chip | `gap` | `normal` | `normal` | = |
| freshness chip | `height` | `16.7969px` | `24.7969px` | = drawn box: the build is `border-box`, the handover `content-box`; content + 2×4px padding (+ 2×1px border) gives the same outer box |
| freshness chip | `padding` | `4px 8px` | `4px 8px` | = |
| freshness chip | `border-radius` | `6px` | `6px` | = |
| freshness chip | `font-size` | `12px` | `12px` | = |
| freshness chip | `font-weight` | `400` | `400` | = |
| freshness chip | `color` | `rgb(255, 193, 77)` | `rgb(61, 220, 132)` | Δ data, not design: the handover was drawn `behind:22`; this map is `fresh`, shown in the handover's own `fresh` colour (Zustände card); the amber `behind:n` chip is asserted in `code_graph_map_shell.test.ts` › header chips (D4) |
| freshness chip | `background-color` | `rgba(255, 193, 77, 0.14)` | `rgba(61, 220, 132, 0.14)` | Δ data, not design: the handover was drawn `behind:22`; this map is `fresh`, shown in the handover's own `fresh` colour (Zustände card); the amber `behind:n` chip is asserted in `code_graph_map_shell.test.ts` › header chips (D4) |
| freshness chip | `box-shadow` | `none` | `none` | = |
| freshness chip | `border` | `0px none` | `0px none` | = |
| freshness chip | `white-space` | `nowrap` | `nowrap` | = |
| freshness chip | `gap` | `6px` | `6px` | = |
| snapshot chip | `height` | `16.7969px` | `26.7969px` | = drawn box: the build is `border-box`, the handover `content-box`; content + 2×4px padding (+ 2×1px border) gives the same outer box |
| snapshot chip | `padding` | `4px 8px` | `4px 8px` | = |
| snapshot chip | `border-radius` | `6px` | `6px` | = |
| snapshot chip | `font-size` | `12px` | `12px` | = |
| snapshot chip | `font-weight` | `400` | `400` | = |
| snapshot chip | `color` | `rgb(147, 161, 181)` | `rgb(147, 161, 181)` | = |
| snapshot chip | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| snapshot chip | `box-shadow` | `none` | `none` | = |
| snapshot chip | `border` | `1px dashed rgb(42, 52, 69)` | `1px dashed rgb(42, 52, 69)` | = |
| snapshot chip | `white-space` | `nowrap` | `nowrap` | = |
| snapshot chip | `gap` | `normal` | `normal` | = |

## Computed styles (light)

`getComputedStyle` at 1440 px, light.

| Element | Property | Handover (computed) | Build (computed) | Status |
|---|---|---|---|---|
| `nav a` (idle) | `height` | `34px` | `34px` | = |
| `nav a` (idle) | `padding` | `0px 14px` | `0px 14px` | = |
| `nav a` (idle) | `border-radius` | `7px` | `7px` | = |
| `nav a` (idle) | `font-size` | `13px` | `13px` | = |
| `nav a` (idle) | `font-weight` | `500` | `500` | = |
| `nav a` (idle) | `color` | `rgb(51, 65, 85)` | `rgb(51, 65, 85)` | = |
| `nav a` (idle) | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| `nav a` (idle) | `box-shadow` | `none` | `none` | = |
| `nav a` (idle) | `border` | `0px none` | `0px none` | = |
| `nav a` (idle) | `white-space` | `normal` | `normal` | = |
| `nav a` (idle) | `gap` | `normal` | `normal` | = |
| `[aria-current]` | `height` | `34px` | `34px` | = |
| `[aria-current]` | `padding` | `0px 14px` | `0px 14px` | = |
| `[aria-current]` | `border-radius` | `7px` | `7px` | = |
| `[aria-current]` | `font-size` | `13px` | `13px` | = |
| `[aria-current]` | `font-weight` | `600` | `600` | = |
| `[aria-current]` | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| `[aria-current]` | `background-color` | `rgba(244, 122, 18, 0.12)` | `rgba(244, 122, 18, 0.12)` | = |
| `[aria-current]` | `box-shadow` | `rgba(244, 122, 18, 0.6) 0px 0px 0px 1px inset` | `rgba(244, 122, 18, 0.6) 0px 0px 0px 1px inset` | = |
| `[aria-current]` | `border` | `0px none` | `0px none` | = |
| `[aria-current]` | `white-space` | `normal` | `normal` | = |
| `[aria-current]` | `gap` | `normal` | `normal` | = |
| `nav a` no data | `height` | `34px` | `34px` | = |
| `nav a` no data | `padding` | `0px 14px` | `0px 14px` | = |
| `nav a` no data | `border-radius` | `7px` | `7px` | = |
| `nav a` no data | `font-size` | `13px` | `13px` | = |
| `nav a` no data | `font-weight` | `500` | `500` | = |
| `nav a` no data | `color` | `rgb(133, 146, 165)` | `rgb(133, 146, 165)` | = |
| `nav a` no data | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| `nav a` no data | `box-shadow` | `none` | `none` | = |
| `nav a` no data | `border` | `0px none` | `0px none` | = |
| `nav a` no data | `white-space` | `normal` | `normal` | = |
| `nav a` no data | `gap` | `6px` | `6px` | = |
| commit chip | `height` | `16.7969px` | `26.7969px` | = drawn box: the build is `border-box`, the handover `content-box`; content + 2×4px padding (+ 2×1px border) gives the same outer box |
| commit chip | `padding` | `4px 8px` | `4px 8px` | = |
| commit chip | `border-radius` | `6px` | `6px` | = |
| commit chip | `font-size` | `12px` | `12px` | = |
| commit chip | `font-weight` | `400` | `400` | = |
| commit chip | `color` | `rgb(51, 65, 85)` | `rgb(51, 65, 85)` | = |
| commit chip | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| commit chip | `box-shadow` | `none` | `none` | = |
| commit chip | `border` | `1px solid rgb(221, 227, 236)` | `1px solid rgb(221, 227, 236)` | = |
| commit chip | `white-space` | `nowrap` | `nowrap` | = |
| commit chip | `gap` | `normal` | `normal` | = |
| freshness chip | `height` | `16.7969px` | `24.7969px` | = drawn box: the build is `border-box`, the handover `content-box`; content + 2×4px padding (+ 2×1px border) gives the same outer box |
| freshness chip | `padding` | `4px 8px` | `4px 8px` | = |
| freshness chip | `border-radius` | `6px` | `6px` | = |
| freshness chip | `font-size` | `12px` | `12px` | = |
| freshness chip | `font-weight` | `400` | `400` | = |
| freshness chip | `color` | `rgb(146, 88, 10)` | `rgb(21, 128, 61)` | Δ data, not design: the handover was drawn `behind:22`; this map is `fresh`, shown in the handover's own `fresh` colour (Zustände card); the amber `behind:n` chip is asserted in `code_graph_map_shell.test.ts` › header chips (D4) |
| freshness chip | `background-color` | `rgba(245, 179, 36, 0.16)` | `rgba(22, 163, 74, 0.12)` | Δ data, not design: the handover was drawn `behind:22`; this map is `fresh`, shown in the handover's own `fresh` colour (Zustände card); the amber `behind:n` chip is asserted in `code_graph_map_shell.test.ts` › header chips (D4) |
| freshness chip | `box-shadow` | `none` | `none` | = |
| freshness chip | `border` | `0px none` | `0px none` | = |
| freshness chip | `white-space` | `nowrap` | `nowrap` | = |
| freshness chip | `gap` | `6px` | `6px` | = |
| snapshot chip | `height` | `16.7969px` | `26.7969px` | = drawn box: the build is `border-box`, the handover `content-box`; content + 2×4px padding (+ 2×1px border) gives the same outer box |
| snapshot chip | `padding` | `4px 8px` | `4px 8px` | = |
| snapshot chip | `border-radius` | `6px` | `6px` | = |
| snapshot chip | `font-size` | `12px` | `12px` | = |
| snapshot chip | `font-weight` | `400` | `400` | = |
| snapshot chip | `color` | `rgb(83, 96, 116)` | `rgb(83, 96, 116)` | = |
| snapshot chip | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| snapshot chip | `box-shadow` | `none` | `none` | = |
| snapshot chip | `border` | `1px dashed rgb(195, 204, 217)` | `1px dashed rgb(195, 204, 217)` | = |
| snapshot chip | `white-space` | `nowrap` | `nowrap` | = |
| snapshot chip | `gap` | `normal` | `normal` | = |

## Overflow 1440/375/320

`#areanav` scroll and client width, `document.documentElement.scrollWidth − innerWidth` (probe, both themes equal).

| Width | Handover nav sw / cw · overflow-x | Build nav sw / cw · overflow-x | Document overflow handover / build | Status |
|---|---|---|---|---|
| 1440 | 894 / 894 · visible | 908 / 908 · visible | 0 / 0 | = (the build's 14 px: the Wissen dot) |
| 375 | 894 / 333 · auto | 908 / 349 · auto | 0 / 0 | = scroll strip, `scrollWidth > clientWidth`, no page scroll |
| 320 | 894 / 278 · auto | 908 / 294 · auto | 0 / 0 | = |
| every route × 1440/375/320 × dark/light, sample and demo map | — | no document overflow | — | ✓ `code_graph_map_shell_overflow.test.ts` › "every route … has no document overflow" (4 cases) |

## Behaviour

| Chapter | Claim | Evidence | Status |
|---|---|---|---|
| Nav order | eleven routes, Bugs and Wissen before Impact, no-data `title`s, Bugs always dim in a map file | kind 3: `code_graph_map_shell.test.ts` › "nav order"; sensitivity — the old nine-route list fails `code_graph_map_areas.test.ts` › "the nav names the eleven areas" | ✓ |
| Header chips | "gebaut bei" + sha8 + date, title sha12 + generation16; lowercase state; amber with amber dot when not fresh; dashed snapshot chip when the map has no branches | kind 3: `code_graph_map_shell.test.ts` › "header chips" (fresh and `behind:3` maps, both languages) | ✓ |
| Search up | "← eine Ebene hoch", 22 px, 11 px text | kind 3: `code_graph_map_search_keys.test.ts` asserts the label inside a drilled search | ✓ |
| Verlauf | ≤50 states, last five steps with `›`, 24 px ← only with history, ← and a step restore exactly | kind 3: `code_graph_map_history_crumbs.test.ts`; sensitivity — with `push` neutralised ← never appears and nothing restores (same file) | ✓ |
| Provenance | "Echte Daten · <file> @ <sha8>" on every page, "· keine Bug-Lane" on Bugs, 11 px faint | kind 3: `code_graph_map_shell.test.ts` › "provenance" | ✓ |
| Scroll strip | ≤700 px: nav and every tablist `nowrap` + `overflow-x:auto`, the open area scrolled into view | kind 3: `code_graph_map_shell_overflow.test.ts` › "one scroll strip", "a tablist at 375 scrolls" | ✓ |
| Flyouts | unpinned asides absolute inside the body, 320 / 400 px, shadows `12px 0 40px` / `-12px 0 40px` rgba(0,0,0,.35), scrim rgba(4,8,14,.45) absolute; ≤1000 px an open aside joins the flow | kind 3: `code_graph_map_shell_overflow.test.ts` › "unpinned asides fly out …" (1100 and 900 px), `code_graph_map_rails.test.ts`, `code_graph_map_area_limit.test.ts` | ✓ |
| Aside names | Schema, Dienste, Operation, Ressource, Nachweisbericht, Anfrage, Item per page | kind 3: `code_graph_map_shell_overflow.test.ts` › "each aside is named" (Filter, Bug, Registry, Kante land with their pages, Phases 3, 5, 7) | ✓ |

## Not implemented

| Item | Reason |
|---|---|
| "Echte Map / Demo · Fixture" radiogroup (Decision D1) | a map file carries one dataset; the demo is its own build with the "Beispieldaten · Fixture" chip — owner-pending |
| live `behind:N` against HEAD (Decision D4) | not knowable inside a static committed file; the chip shows `pin.freshness` as built |
| scrim over an in-flow aside at ≤1000 px | the handover's absolute scrim would lie over the aside it opened; the build hides it there, the aside's × and Escape close it |
| flyout animation | the handover draws none; the shipped slide-in was dropped for 1:1 |
| pin button semantics | the handover's pin is a plain text toggle with a `title`; the build keeps `aria-pressed` on it and the handover's labels "Anheften" / "Lösen" |
