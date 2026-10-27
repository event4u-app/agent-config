<!-- evidence-type: analysis -->
# Fidelity matrix — Übersicht against the 2026-10-bf handover

> **Handover.** `p12/Overview.dc.html` (title „Übersicht · Map-Home & Vertrauen“), its
> markup, inline styles and logic class (cards `A[]`, `hp`, `states`, `notes`, `filters`).
> **Build.** `src/scripts/code_graph/map_viewer/area_overview.js` and the `ov-*` /
> `o*` rules of `shell.css`, roadmap `road-to-map-views-from-the-handover` Phase 2.
> **Evidence taken.** `tests/scripts/code_graph/map_fidelity_probe.ts overview`
> (Chromium, no network, German locale): this repository's `agents/map/code/map.json`
> re-rendered with the current viewer at `#/overview` — the very data the handover's
> "Echte Map" was drawn from (`2efd5be1`) — against the handover page at 1440, 375 and
> 320 px in both themes. Behaviour rows name the browser specs in
> `tests/scripts/code_graph_map_overview_page.test.ts`.

## Landmarks

Visible landmarks and widget roles inside the page's `<main>`, identical in both themes and at all three widths.

| Element | Handover | Build | Status |
|---|---|---|---|
| main | `main ""` | `main ""` (`#av-main`) | = |
| filter | `div[radiogroup] "Filter"` with `radio:Alle Ebenen*`, `radio:Mit Daten`, `radio:Geplant · leer` | the same group, same three radios, same checked one | = (was a `tablist` with "Geplant") |
| banner | chip · bold sentence · soft line with the command · two dashed chips | same order; chip `fresh` (data, see below), "2.027 Zeugen · 0 erneut gelesen" counted from the payloads | = text, Δ data |
| card grid | 4 columns of 339px at 1440 | 4 columns of 339px | = |
| lower row | Health · Zustände · Hinweise | Health · Zustände · Hinweise; no Gate G0, check protocol or tours (Decision D2) | = |

### The eleven cards × field (dark, 1440; 99 fields, 95 equal)

| Card | Field | Handover | Build | Status |
|---|---|---|---|---|
| Code | state | aktiv | = handover | = |
| Code | what | 11.614 Dateien · 78.600 sichere Kanten · 19,1 % geraten | = handover | = |
| Code | indexed | 26.10. | = handover | = |
| Code | checked | nie (nur Index) | = handover | = |
| Code | coverage | 13 Sprachen · 20 Provider | = handover | = |
| Code | findings | 182 | = handover | = |
| Code | reader | Laravel verifiziert, 19 Provider teilweise · fresh: gilt für den ganzen Graphen | = handover | = |
| Code | warn | – | = handover | = |
| Code | branch | Dateien, Symbole | = handover | = |
| Datenbank | state | gelesen, leer | = handover | = |
| Datenbank | what | Tabellen, Spalten, FKs aus Code (C), Migration (M), Live (L), Query (Q) | = handover | = |
| Datenbank | indexed | – | = handover | = |
| Datenbank | checked | – | = handover | = |
| Datenbank | coverage | – | = handover | = |
| Datenbank | findings | – | = handover | = |
| Datenbank | reader | data lane lief und fand nichts: keine Migration, keine Schema-Datei, kein committeter Dump oder Snapshot | data lane lief und fand nichts: no migration, schema file, committed dump or snapshot was found | Δ data: the reason is the payload's own text, written in English by the data lane |
| Datenbank | warn | Manifest: „empty“, aber 36 Fakten und 18 Befunde (Laravel-Test-Fixtures). | Manifest: „empty“, aber 36 Fakten und 18 Befunde (Test-Fixtures). | Δ cause wording: "(Test-Fixtures)" is derived from every finding subject lying under `tests/fixtures/`; "Laravel" is the handover's hand-written reading |
| Datenbank | branch | Tabellen, Spalten | = handover | = |
| Systeme | state | aktiv | = handover | = |
| Systeme | what | Runtimes, Frameworks, Pakete – warum installiert, wo genutzt | = handover | = |
| Systeme | indexed | 26.10. | = handover | = |
| Systeme | checked | nie (nur Index) | = handover | = |
| Systeme | coverage | vollständig | = handover | = |
| Systeme | findings | 66 | = handover | = |
| Systeme | reader | systems lane · fresh: der Graph steht auf HEAD | = handover | = |
| Systeme | warn | – | = handover | = |
| Systeme | branch | direkte Pakete, Versionen | = handover | = |
| Integrations | state | aktiv | = handover | = |
| Integrations | what | REST, SOAP, GraphQL, Webhooks, Queues – Aufrufer, Verträge, DTOs | = handover | = |
| Integrations | indexed | 26.10. | = handover | = |
| Integrations | checked | nie (nur Index) | = handover | = |
| Integrations | coverage | vollständig | = handover | = |
| Integrations | findings | 6 | = handover | = |
| Integrations | reader | interfaces lane · fresh: der Graph steht auf HEAD | = handover | = |
| Integrations | warn | – | = handover | = |
| Integrations | branch | keine Branch-Fakten | = handover | = |
| Environment | state | aktiv | = handover | = |
| Environment | what | Docker, Compose, Ports, Netze – deklariert vs. beobachtet | = handover | = |
| Environment | indexed | 26.10. | = handover | = |
| Environment | checked | nie (nur Index) | = handover | = |
| Environment | coverage | vollständig | = handover | = |
| Environment | findings | 0 | = handover | = |
| Environment | reader | runtime lane · fresh: der Graph steht auf HEAD | = handover | = |
| Environment | warn | – | = handover | = |
| Environment | branch | keine Branch-Fakten | = handover | = |
| CI/CD | state | aktiv | = handover | = |
| CI/CD | what | Workflows, Jobs, needs, Bedingungen (wahr/falsch/unbekannt) | = handover | = |
| CI/CD | indexed | 26.10. | = handover | = |
| CI/CD | checked | nie (nur Index) | = handover | = |
| CI/CD | coverage | vollständig | = handover | = |
| CI/CD | findings | 0 | = handover | = |
| CI/CD | reader | delivery lane · fresh: der Graph steht auf HEAD | = handover | = |
| CI/CD | warn | – | = handover | = |
| CI/CD | branch | keine Branch-Fakten | = handover | = |
| Infrastruktur | state | gelesen, leer | = handover | = |
| Infrastruktur | what | Terraform/HCL, Plan, Ressourcen, review/stage/prod | = handover | = |
| Infrastruktur | indexed | – | = handover | = |
| Infrastruktur | checked | – | = handover | = |
| Infrastruktur | coverage | – | = handover | = |
| Infrastruktur | findings | – | = handover | = |
| Infrastruktur | reader | runtime lane lief und fand nichts | = handover | = |
| Infrastruktur | warn | – | = handover | = |
| Infrastruktur | branch | keine Branch-Fakten | = handover | = |
| Wissen · Memory | state | nur Markdown | = handover | = |
| Wissen · Memory | what | Doku, ADRs, Memory, Entscheidungen, Sessions, Arbeitsweise – wem gehört was | = handover | = |
| Wissen · Memory | indexed | 26.10. | = handover | = |
| Wissen · Memory | checked | – | = handover | = |
| Wissen · Memory | coverage | 6.083 Markdown · Memory, JSONL, Sessions nicht gelesen | = handover | = |
| Wissen · Memory | findings | 19 | – | not implemented: the 19 unresolved memory paths come from an audit, not from a payload field (Phase 6) |
| Wissen · Memory | reader | Doku-Knoten aus Markdown · Memory, Entscheidungs-Fakten und Sessions fehlen (H42) · 19 Memory-Pfade lösen nicht auf (Audit) | Doku-Knoten aus Markdown · Memory, Entscheidungs-Fakten und Sessions fehlen | not implemented: "(H42) · 19 Memory-Pfade lösen nicht auf (Audit)" has no payload field |
| Wissen · Memory | warn | – | = handover | = |
| Wissen · Memory | branch | keine Branch-Fakten | = handover | = |
| Impact | state | gelesen, leer | = handover | = |
| Impact | what | Änderungsvorschau über jede Ebene mit Nachweisbericht | = handover | = |
| Impact | indexed | – | = handover | = |
| Impact | checked | – | = handover | = |
| Impact | coverage | – | = handover | = |
| Impact | findings | – | = handover | = |
| Impact | reader | review-risk über den Arbeits-Diff lief und fand nichts: keine Änderung gegen HEAD | review-risk over the working diff lief und fand nichts: no change against HEAD | Δ data: reader name and reason are the payload's own English text |
| Impact | warn | – | = handover | = |
| Impact | branch | Arbeitsbaum gegen HEAD | = handover | = |
| Bugs & Fixes | state | nur lokal | = handover | = |
| Bugs & Fixes | what | Offene und behobene Bugs, Fix-Commits, Regressionspfade durch den Graphen | = handover | = |
| Bugs & Fixes | indexed | lokal, opt-in | = handover | = |
| Bugs & Fixes | checked | – | = handover | = |
| Bugs & Fixes | coverage | – | = handover | = |
| Bugs & Fixes | findings | – | = handover | = |
| Bugs & Fixes | reader | bugs lane (Stage H) geplant · Fehler-Events tragen Personendaten – darum nie in dieser Datei, nicht einmal Zählwerte | = handover | = |
| Bugs & Fixes | warn | – | = handover | = |
| Bugs & Fixes | branch | (hidden) | = handover | = |
| Projects | state | eigener Scope | = handover | = |
| Projects | what | Andere Projekte – nur im globalen Viewer, nie in dieser Datei | = handover | = |
| Projects | indexed | lokal, opt-in | = handover | = |
| Projects | checked | – | = handover | = |
| Projects | coverage | – | = handover | = |
| Projects | findings | – | = handover | = |
| Projects | reader | Hub auf diesem Rechner · nie im Git | = handover | = |
| Projects | warn | – | = handover | = |
| Projects | branch | (hidden) | = handover | = |

## Computed styles (dark)

`getComputedStyle` at 1440 px, dark, first visible element per selector.

| Element | Property | Handover (computed) | Build (computed) | Status |
|---|---|---|---|---|
| card (data) | `padding` | `16px` | `16px` | = |
| card (data) | `border-radius` | `12px` | `12px` | = |
| card (data) | `font-size` | `14px` | `14px` | = |
| card (data) | `font-weight` | `400` | `400` | = |
| card (data) | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| card (data) | `background-color` | `rgb(13, 19, 29)` | `rgb(13, 19, 29)` | = |
| card (data) | `box-shadow` | `none` | `none` | = |
| card (data) | `border` | `1px solid rgb(28, 39, 56)` | `1px solid rgb(28, 39, 56)` | = |
| card (data) | `border-top-style` | `solid` | `solid` | = |
| card (data) | `gap` | `10px` | `10px` | = |
| card (data) | `grid-template-columns` | `none` | `none` | = |
| card (data) | `min-height` | `auto` | `auto` | = |
| card (data) | `letter-spacing` | `normal` | `normal` | = |
| card (data) | `text-transform` | `none` | `none` | = |
| filter radio, checked | `padding` | `0px 14px` | `0px 14px` | = |
| filter radio, checked | `border-radius` | `7px` | `7px` | = |
| filter radio, checked | `font-size` | `13px` | `13px` | = |
| filter radio, checked | `font-weight` | `600` | `600` | = |
| filter radio, checked | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| filter radio, checked | `background-color` | `rgba(255, 140, 42, 0.16)` | `rgba(255, 140, 42, 0.16)` | = |
| filter radio, checked | `box-shadow` | `rgba(255, 140, 42, 0.55) 0px 0px 0px 1px inset` | `rgba(255, 140, 42, 0.55) 0px 0px 0px 1px inset` | = |
| filter radio, checked | `border` | `0px none` | `0px none` | = |
| filter radio, checked | `border-top-style` | `none` | `none` | = |
| filter radio, checked | `gap` | `normal` | `normal` | = |
| filter radio, checked | `grid-template-columns` | `none` | `none` | = |
| filter radio, checked | `min-height` | `auto` | `auto` | = |
| filter radio, checked | `letter-spacing` | `normal` | `normal` | = |
| filter radio, checked | `text-transform` | `none` | `none` | = |
| filter radio, idle | `padding` | `0px 14px` | `0px 14px` | = |
| filter radio, idle | `border-radius` | `7px` | `7px` | = |
| filter radio, idle | `font-size` | `13px` | `13px` | = |
| filter radio, idle | `font-weight` | `500` | `500` | = |
| filter radio, idle | `color` | `rgb(195, 206, 221)` | `rgb(195, 206, 221)` | = |
| filter radio, idle | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| filter radio, idle | `box-shadow` | `none` | `none` | = |
| filter radio, idle | `border` | `0px none` | `0px none` | = |
| filter radio, idle | `border-top-style` | `none` | `none` | = |
| filter radio, idle | `gap` | `normal` | `normal` | = |
| filter radio, idle | `grid-template-columns` | `none` | `none` | = |
| filter radio, idle | `min-height` | `auto` | `auto` | = |
| filter radio, idle | `letter-spacing` | `normal` | `normal` | = |
| filter radio, idle | `text-transform` | `none` | `none` | = |
| state banner | `padding` | `12px 14px` | `12px 14px` | = |
| state banner | `border-radius` | `12px` | `12px` | = |
| state banner | `font-size` | `13px` | `13px` | = |
| state banner | `font-weight` | `400` | `400` | = |
| state banner | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| state banner | `background-color` | `rgb(13, 19, 29)` | `rgb(13, 19, 29)` | = |
| state banner | `box-shadow` | `rgb(255, 193, 77) 4px 0px 0px 0px inset` | `rgb(61, 220, 132) 4px 0px 0px 0px inset` | Δ data: the handover was drawn `behind:22`, this map is `fresh`; the amber bar on a behind map is asserted in › banner |
| state banner | `border` | `1px solid rgb(28, 39, 56)` | `1px solid rgb(28, 39, 56)` | = |
| state banner | `border-top-style` | `solid` | `solid` | = |
| state banner | `gap` | `10px` | `10px` | = |
| state banner | `grid-template-columns` | `none` | `none` | = |
| state banner | `min-height` | `auto` | `auto` | = |
| state banner | `letter-spacing` | `normal` | `normal` | = |
| state banner | `text-transform` | `none` | `none` | = |
| warn box | `padding` | `6px 8px` | `6px 8px` | = |
| warn box | `border-radius` | `6px` | `6px` | = |
| warn box | `font-size` | `11px` | `11px` | = |
| warn box | `font-weight` | `400` | `400` | = |
| warn box | `color` | `rgb(255, 193, 77)` | `rgb(255, 193, 77)` | = |
| warn box | `background-color` | `rgba(255, 193, 77, 0.14)` | `rgba(255, 193, 77, 0.14)` | = |
| warn box | `box-shadow` | `none` | `none` | = |
| warn box | `border` | `0px none` | `0px none` | = |
| warn box | `border-top-style` | `none` | `none` | = |
| warn box | `gap` | `normal` | `normal` | = |
| warn box | `grid-template-columns` | `none` | `none` | = |
| warn box | `min-height` | `auto` | `auto` | = |
| warn box | `letter-spacing` | `normal` | `normal` | = |
| warn box | `text-transform` | `none` | `none` | = |
| card kv grid | `padding` | `0px` | `0px` | = |
| card kv grid | `border-radius` | `0px` | `0px` | = |
| card kv grid | `font-size` | `12px` | `12px` | = |
| card kv grid | `font-weight` | `400` | `400` | = |
| card kv grid | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| card kv grid | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| card kv grid | `box-shadow` | `none` | `none` | = |
| card kv grid | `border` | `0px none` | `0px none` | = |
| card kv grid | `border-top-style` | `none` | `none` | = |
| card kv grid | `gap` | `4px 10px` | `4px 10px` | = |
| card kv grid | `grid-template-columns` | `110px 185px` | `110px 185px` | = |
| card kv grid | `min-height` | `auto` | `auto` | = |
| card kv grid | `letter-spacing` | `normal` | `normal` | = |
| card kv grid | `text-transform` | `none` | `none` | = |
| coverage bar | `padding` | `0px` | `0px` | = |
| coverage bar | `border-radius` | `3px` | `3px` | = |
| coverage bar | `font-size` | `14px` | `14px` | = |
| coverage bar | `font-weight` | `400` | `400` | = |
| coverage bar | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| coverage bar | `background-color` | `rgb(28, 39, 56)` | `rgb(28, 39, 56)` | = |
| coverage bar | `box-shadow` | `none` | `none` | = |
| coverage bar | `border` | `0px none` | `0px none` | = |
| coverage bar | `border-top-style` | `none` | `none` | = |
| coverage bar | `gap` | `normal` | `normal` | = |
| coverage bar | `grid-template-columns` | `none` | `none` | = |
| coverage bar | `min-height` | `auto` | `auto` | = |
| coverage bar | `letter-spacing` | `normal` | `normal` | = |
| coverage bar | `text-transform` | `none` | `none` | = |
| legend row | `padding` | `10px 14px` | `10px 14px` | = |
| legend row | `border-radius` | `10px` | `10px` | = |
| legend row | `font-size` | `12px` | `12px` | = |
| legend row | `font-weight` | `400` | `400` | = |
| legend row | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| legend row | `background-color` | `rgb(13, 19, 29)` | `rgb(13, 19, 29)` | = |
| legend row | `box-shadow` | `none` | `none` | = |
| legend row | `border` | `1px solid rgb(28, 39, 56)` | `1px solid rgb(28, 39, 56)` | = |
| legend row | `border-top-style` | `solid` | `solid` | = |
| legend row | `gap` | `8px 14px` | `8px 14px` | = |
| legend row | `grid-template-columns` | `none` | `none` | = |
| legend row | `min-height` | `auto` | `auto` | = |
| legend row | `letter-spacing` | `normal` | `normal` | = |
| legend row | `text-transform` | `none` | `none` | = |
| lower card | `padding` | `16px` | `16px` | = |
| lower card | `border-radius` | `12px` | `12px` | = |
| lower card | `font-size` | `14px` | `14px` | = |
| lower card | `font-weight` | `400` | `400` | = |
| lower card | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| lower card | `background-color` | `rgb(13, 19, 29)` | `rgb(13, 19, 29)` | = |
| lower card | `box-shadow` | `none` | `none` | = |
| lower card | `border` | `1px solid rgb(28, 39, 56)` | `1px solid rgb(28, 39, 56)` | = |
| lower card | `border-top-style` | `solid` | `solid` | = |
| lower card | `gap` | `10px` | `10px` | = |
| lower card | `grid-template-columns` | `none` | `none` | = |
| lower card | `min-height` | `auto` | `auto` | = |
| lower card | `letter-spacing` | `normal` | `normal` | = |
| lower card | `text-transform` | `none` | `none` | = |
| h1 | `padding` | `0px` | `0px` | = |
| h1 | `border-radius` | `0px` | `0px` | = |
| h1 | `font-size` | `30px` | `30px` | = |
| h1 | `font-weight` | `400` | `400` | = |
| h1 | `color` | `rgb(232, 238, 247)` | `rgb(232, 238, 247)` | = |
| h1 | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| h1 | `box-shadow` | `none` | `none` | = |
| h1 | `border` | `0px none` | `0px none` | = |
| h1 | `border-top-style` | `none` | `none` | = |
| h1 | `gap` | `normal` | `normal` | = |
| h1 | `grid-template-columns` | `none` | `none` | = |
| h1 | `min-height` | `auto` | `auto` | = |
| h1 | `letter-spacing` | `0.3px` | `0.3px` | = |
| h1 | `text-transform` | `uppercase` | `uppercase` | = |
| provenance | `padding` | `0px` | `0px` | = |
| provenance | `border-radius` | `0px` | `0px` | = |
| provenance | `font-size` | `11px` | `11px` | = |
| provenance | `font-weight` | `400` | `400` | = |
| provenance | `color` | `rgb(111, 125, 146)` | `rgb(111, 125, 146)` | = |
| provenance | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| provenance | `box-shadow` | `none` | `none` | = |
| provenance | `border` | `0px none` | `0px none` | = |
| provenance | `border-top-style` | `none` | `none` | = |
| provenance | `gap` | `normal` | `normal` | = |
| provenance | `grid-template-columns` | `none` | `none` | = |
| provenance | `min-height` | `auto` | `auto` | = |
| provenance | `letter-spacing` | `normal` | `normal` | = |
| provenance | `text-transform` | `none` | `none` | = |

## Computed styles (light)

`getComputedStyle` at 1440 px, light.

| Element | Property | Handover (computed) | Build (computed) | Status |
|---|---|---|---|---|
| card (data) | `padding` | `16px` | `16px` | = |
| card (data) | `border-radius` | `12px` | `12px` | = |
| card (data) | `font-size` | `14px` | `14px` | = |
| card (data) | `font-weight` | `400` | `400` | = |
| card (data) | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| card (data) | `background-color` | `rgb(255, 255, 255)` | `rgb(255, 255, 255)` | = |
| card (data) | `box-shadow` | `none` | `none` | = |
| card (data) | `border` | `1px solid rgb(221, 227, 236)` | `1px solid rgb(221, 227, 236)` | = |
| card (data) | `border-top-style` | `solid` | `solid` | = |
| card (data) | `gap` | `10px` | `10px` | = |
| card (data) | `grid-template-columns` | `none` | `none` | = |
| card (data) | `min-height` | `auto` | `auto` | = |
| card (data) | `letter-spacing` | `normal` | `normal` | = |
| card (data) | `text-transform` | `none` | `none` | = |
| filter radio, checked | `padding` | `0px 14px` | `0px 14px` | = |
| filter radio, checked | `border-radius` | `7px` | `7px` | = |
| filter radio, checked | `font-size` | `13px` | `13px` | = |
| filter radio, checked | `font-weight` | `600` | `600` | = |
| filter radio, checked | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| filter radio, checked | `background-color` | `rgba(244, 122, 18, 0.12)` | `rgba(244, 122, 18, 0.12)` | = |
| filter radio, checked | `box-shadow` | `rgba(244, 122, 18, 0.6) 0px 0px 0px 1px inset` | `rgba(244, 122, 18, 0.6) 0px 0px 0px 1px inset` | = |
| filter radio, checked | `border` | `0px none` | `0px none` | = |
| filter radio, checked | `border-top-style` | `none` | `none` | = |
| filter radio, checked | `gap` | `normal` | `normal` | = |
| filter radio, checked | `grid-template-columns` | `none` | `none` | = |
| filter radio, checked | `min-height` | `auto` | `auto` | = |
| filter radio, checked | `letter-spacing` | `normal` | `normal` | = |
| filter radio, checked | `text-transform` | `none` | `none` | = |
| filter radio, idle | `padding` | `0px 14px` | `0px 14px` | = |
| filter radio, idle | `border-radius` | `7px` | `7px` | = |
| filter radio, idle | `font-size` | `13px` | `13px` | = |
| filter radio, idle | `font-weight` | `500` | `500` | = |
| filter radio, idle | `color` | `rgb(51, 65, 85)` | `rgb(51, 65, 85)` | = |
| filter radio, idle | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| filter radio, idle | `box-shadow` | `none` | `none` | = |
| filter radio, idle | `border` | `0px none` | `0px none` | = |
| filter radio, idle | `border-top-style` | `none` | `none` | = |
| filter radio, idle | `gap` | `normal` | `normal` | = |
| filter radio, idle | `grid-template-columns` | `none` | `none` | = |
| filter radio, idle | `min-height` | `auto` | `auto` | = |
| filter radio, idle | `letter-spacing` | `normal` | `normal` | = |
| filter radio, idle | `text-transform` | `none` | `none` | = |
| state banner | `padding` | `12px 14px` | `12px 14px` | = |
| state banner | `border-radius` | `12px` | `12px` | = |
| state banner | `font-size` | `13px` | `13px` | = |
| state banner | `font-weight` | `400` | `400` | = |
| state banner | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| state banner | `background-color` | `rgb(255, 255, 255)` | `rgb(255, 255, 255)` | = |
| state banner | `box-shadow` | `rgb(245, 179, 36) 4px 0px 0px 0px inset` | `rgb(22, 163, 74) 4px 0px 0px 0px inset` | Δ data: `behind:22` against `fresh`, as in dark |
| state banner | `border` | `1px solid rgb(221, 227, 236)` | `1px solid rgb(221, 227, 236)` | = |
| state banner | `border-top-style` | `solid` | `solid` | = |
| state banner | `gap` | `10px` | `10px` | = |
| state banner | `grid-template-columns` | `none` | `none` | = |
| state banner | `min-height` | `auto` | `auto` | = |
| state banner | `letter-spacing` | `normal` | `normal` | = |
| state banner | `text-transform` | `none` | `none` | = |
| warn box | `padding` | `6px 8px` | `6px 8px` | = |
| warn box | `border-radius` | `6px` | `6px` | = |
| warn box | `font-size` | `11px` | `11px` | = |
| warn box | `font-weight` | `400` | `400` | = |
| warn box | `color` | `rgb(146, 88, 10)` | `rgb(146, 88, 10)` | = |
| warn box | `background-color` | `rgba(245, 179, 36, 0.16)` | `rgba(245, 179, 36, 0.16)` | = |
| warn box | `box-shadow` | `none` | `none` | = |
| warn box | `border` | `0px none` | `0px none` | = |
| warn box | `border-top-style` | `none` | `none` | = |
| warn box | `gap` | `normal` | `normal` | = |
| warn box | `grid-template-columns` | `none` | `none` | = |
| warn box | `min-height` | `auto` | `auto` | = |
| warn box | `letter-spacing` | `normal` | `normal` | = |
| warn box | `text-transform` | `none` | `none` | = |
| card kv grid | `padding` | `0px` | `0px` | = |
| card kv grid | `border-radius` | `0px` | `0px` | = |
| card kv grid | `font-size` | `12px` | `12px` | = |
| card kv grid | `font-weight` | `400` | `400` | = |
| card kv grid | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| card kv grid | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| card kv grid | `box-shadow` | `none` | `none` | = |
| card kv grid | `border` | `0px none` | `0px none` | = |
| card kv grid | `border-top-style` | `none` | `none` | = |
| card kv grid | `gap` | `4px 10px` | `4px 10px` | = |
| card kv grid | `grid-template-columns` | `110px 185px` | `110px 185px` | = |
| card kv grid | `min-height` | `auto` | `auto` | = |
| card kv grid | `letter-spacing` | `normal` | `normal` | = |
| card kv grid | `text-transform` | `none` | `none` | = |
| coverage bar | `padding` | `0px` | `0px` | = |
| coverage bar | `border-radius` | `3px` | `3px` | = |
| coverage bar | `font-size` | `14px` | `14px` | = |
| coverage bar | `font-weight` | `400` | `400` | = |
| coverage bar | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| coverage bar | `background-color` | `rgb(221, 227, 236)` | `rgb(221, 227, 236)` | = |
| coverage bar | `box-shadow` | `none` | `none` | = |
| coverage bar | `border` | `0px none` | `0px none` | = |
| coverage bar | `border-top-style` | `none` | `none` | = |
| coverage bar | `gap` | `normal` | `normal` | = |
| coverage bar | `grid-template-columns` | `none` | `none` | = |
| coverage bar | `min-height` | `auto` | `auto` | = |
| coverage bar | `letter-spacing` | `normal` | `normal` | = |
| coverage bar | `text-transform` | `none` | `none` | = |
| legend row | `padding` | `10px 14px` | `10px 14px` | = |
| legend row | `border-radius` | `10px` | `10px` | = |
| legend row | `font-size` | `12px` | `12px` | = |
| legend row | `font-weight` | `400` | `400` | = |
| legend row | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| legend row | `background-color` | `rgb(255, 255, 255)` | `rgb(255, 255, 255)` | = |
| legend row | `box-shadow` | `none` | `none` | = |
| legend row | `border` | `1px solid rgb(221, 227, 236)` | `1px solid rgb(221, 227, 236)` | = |
| legend row | `border-top-style` | `solid` | `solid` | = |
| legend row | `gap` | `8px 14px` | `8px 14px` | = |
| legend row | `grid-template-columns` | `none` | `none` | = |
| legend row | `min-height` | `auto` | `auto` | = |
| legend row | `letter-spacing` | `normal` | `normal` | = |
| legend row | `text-transform` | `none` | `none` | = |
| lower card | `padding` | `16px` | `16px` | = |
| lower card | `border-radius` | `12px` | `12px` | = |
| lower card | `font-size` | `14px` | `14px` | = |
| lower card | `font-weight` | `400` | `400` | = |
| lower card | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| lower card | `background-color` | `rgb(255, 255, 255)` | `rgb(255, 255, 255)` | = |
| lower card | `box-shadow` | `none` | `none` | = |
| lower card | `border` | `1px solid rgb(221, 227, 236)` | `1px solid rgb(221, 227, 236)` | = |
| lower card | `border-top-style` | `solid` | `solid` | = |
| lower card | `gap` | `10px` | `10px` | = |
| lower card | `grid-template-columns` | `none` | `none` | = |
| lower card | `min-height` | `auto` | `auto` | = |
| lower card | `letter-spacing` | `normal` | `normal` | = |
| lower card | `text-transform` | `none` | `none` | = |
| h1 | `padding` | `0px` | `0px` | = |
| h1 | `border-radius` | `0px` | `0px` | = |
| h1 | `font-size` | `30px` | `30px` | = |
| h1 | `font-weight` | `400` | `400` | = |
| h1 | `color` | `rgb(13, 21, 34)` | `rgb(13, 21, 34)` | = |
| h1 | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| h1 | `box-shadow` | `none` | `none` | = |
| h1 | `border` | `0px none` | `0px none` | = |
| h1 | `border-top-style` | `none` | `none` | = |
| h1 | `gap` | `normal` | `normal` | = |
| h1 | `grid-template-columns` | `none` | `none` | = |
| h1 | `min-height` | `auto` | `auto` | = |
| h1 | `letter-spacing` | `0.3px` | `0.3px` | = |
| h1 | `text-transform` | `uppercase` | `uppercase` | = |
| provenance | `padding` | `0px` | `0px` | = |
| provenance | `border-radius` | `0px` | `0px` | = |
| provenance | `font-size` | `11px` | `11px` | = |
| provenance | `font-weight` | `400` | `400` | = |
| provenance | `color` | `rgb(133, 146, 165)` | `rgb(133, 146, 165)` | = |
| provenance | `background-color` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | = |
| provenance | `box-shadow` | `none` | `none` | = |
| provenance | `border` | `0px none` | `0px none` | = |
| provenance | `border-top-style` | `none` | `none` | = |
| provenance | `gap` | `normal` | `normal` | = |
| provenance | `grid-template-columns` | `none` | `none` | = |
| provenance | `min-height` | `auto` | `auto` | = |
| provenance | `letter-spacing` | `normal` | `normal` | = |
| provenance | `text-transform` | `none` | `none` | = |

## Overflow 1440/375/320

`document.documentElement.scrollWidth − innerWidth`, probe.

| Width | Handover dark / light | Build dark / light | Status |
|---|---|---|---|
| 1440 | 0 / 0 | 0 / 0 | = |
| 375 | 0 / 0 | 0 / 0 | = |
| 320 | 0 / 0 | 0 / 0 | = (the withheld-grade chip wraps: before that fix the sample map overflowed at 375 and 320, caught by `code_graph_map_shell.test.ts` › "no sideways scroll") |

## Behaviour

| Chapter | Claim | Evidence | Status |
|---|---|---|---|
| Filter | radiogroup; "Mit Daten" keeps only cards with data, "Geplant · leer" only the others | kind 3: › banner and › cards (both directions on one map) | ✓ |
| Banner | state as built, the sentence, the redraw command, snapshot chip, witnesses counted from the payloads | kind 3: › banner on a `behind:3` map; sensitivity — the same map drawn `fresh` says "steht auf HEAD", green bar, never "Commits weiter" | ✓ |
| Warn box | shown when a payload says `empty` but carries witnesses or findings, with both counts | kind 3: › cards; sensitivity — the sample payload without `empty` draws no `.owarn` | ✓ |
| Cards | eleven, handover order, solid with data, dashed otherwise, branch row hidden on planned cards | kind 3: › cards | ✓ |
| Health | grade chip from `model.health`, four bars at ≥15 green / ≥8 amber / red, the largest lever | kind 3: › lower row (figures recomputed from `#map-data`) | ✓ |
| States, notes | seven states; notes 1–2 derived (title, witnesses), 3–4 handover copy | kind 3: › lower row | ✓ |
| Design literals | no handover figure reaches the page | kind 3: `code_graph_map_answers.test.ts` (unchanged) | ✓ |

## Not implemented

| Item | Reason |
|---|---|
| Knowledge card: 19 findings and "(H42) · 19 Memory-Pfade lösen nicht auf (Audit)" | an audit figure with no payload field; arrives with the knowledge source index (Phase 6, sibling Stages I and K) |
| German reason texts on empty cards | the reason is the reader's payload text, written in English by the lane; translating data in the viewer would put words in the reader's mouth |
| "Laravel" in the warn box cause | the build derives "(Test-Fixtures)" from the finding subjects; the framework is the handover author's reading |
| Coverage bar share | the handover's shares (0.96, 1, 0.25) are hand-set; the build fills it from the payload: Code `1 − guessShare`, an area by completeness (complete 1 · partial 0.5 · unknown 0.25), Wissen by the share of code files with a knowledge link |
| Gate G0, check protocol, tours | left off the page per the handover (Decision D2, owner-pending) |
