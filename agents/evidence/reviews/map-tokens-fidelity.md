<!-- evidence-type: analysis -->
# Fidelity matrix — map tokens against the 2026-10-bf handover

> **Handover.** The twelve pages of inbox round 2026-10-bf (`p01` … `p12`, each a
> `*.dc.html` with a `<helmet><style>` block); the token superset is the Systems
> page's `.ac-dark` / `.ac-light`, plus the five Code-only tokens of `Main.dc.html`.
> **Build.** `src/scripts/code_graph/map_viewer/viewer.css` (tokens, aliases,
> scrollbar block) and `area_ops.css` (hub grid), roadmap
> `road-to-map-views-from-the-handover` Phase 0.
> **Evidence taken.** `tests/scripts/code_graph/map_fidelity_probe.ts tokens`
> (Chromium, no network, `MAP_HANDOVER_DIR` pointing at the local handover): this
> repository's `agents/map/code/map.json` re-rendered with the current viewer, the
> demo hub, and the handover pages, each in both colour schemes. The comparison
> against the handover table is `tests/scripts/code_graph_map_tokens.test.ts`, which
> reads the Built column below and turns red when one token is mutated.

## Landmarks

| Chapter | Claim | Evidence | Status |
|---|---|---|---|
| Tokens | the token layer owns no landmark of its own | kind 4: not applicable — landmarks are measured per page from the shell matrix on | not applicable |

## Computed styles (dark)

`getComputedStyle(document.documentElement)` on this repository's map re-rendered with the current viewer, `#/overview`, Chromium, colour scheme dark; handover column measured the same way at `.ac-dark` on `p08/Systems.dc.html` (`p11/Main.dc.html` for the five Code-only tokens).

| Token | Handover (helmet) | Built (computed) | Handover (computed) | Status |
|---|---|---|---|---|
| `--bg` | `#070b12` | `#070b12` | `#070b12` | = |
| `--panel` | `#0d131d` | `#0d131d` | `#0d131d` | = |
| `--rail` | `#0a1018` | `#0a1018` | `#0a1018` | = |
| `--raise` | `#131c2a` | `#131c2a` | `#131c2a` | = |
| `--line` | `#1c2738` | `#1c2738` | `#1c2738` | = |
| `--line2` | `#2a3445` | `#2a3445` | `#2a3445` | = |
| `--text` | `#e8eef7` | `#e8eef7` | `#e8eef7` | = |
| `--muted` | `#93a1b5` | `#93a1b5` | `#93a1b5` | = |
| `--soft` | `#c3cedd` | `#c3cedd` | `#c3cedd` | = |
| `--faint` | `#6f7d92` | `#6f7d92` | `#6f7d92` | = |
| `--brand` | `#ff8c2a` | `#ff8c2a` | `#ff8c2a` | = |
| `--brandText` | `#ff9d47` | `#ff9d47` | `#ff9d47` | = |
| `--brandTint` | `rgba(255,140,42,0.16)` | `rgba(255, 140, 42, 0.16)` | `rgba(255,140,42,0.16)` | = |
| `--brandLine` | `rgba(255,140,42,0.55)` | `rgba(255, 140, 42, 0.55)` | `rgba(255,140,42,0.55)` | = |
| `--cyan` | `#3ec5ff` | `#3ec5ff` | `#3ec5ff` | = |
| `--cyanText` | `#8adcff` | `#8adcff` | `#8adcff` | = |
| `--cyanTint` | `rgba(62,197,255,0.13)` | `rgba(62, 197, 255, 0.13)` | `rgba(62,197,255,0.13)` | = |
| `--green` | `#3ddc84` | `#3ddc84` | `#3ddc84` | = |
| `--greenText` | `#3ddc84` | `#3ddc84` | `#3ddc84` | = |
| `--greenTint` | `rgba(61,220,132,0.14)` | `rgba(61, 220, 132, 0.14)` | `rgba(61,220,132,0.14)` | = |
| `--amber` | `#ffc14d` | `#ffc14d` | `#ffc14d` | = |
| `--amberText` | `#ffc14d` | `#ffc14d` | `#ffc14d` | = |
| `--amberTint` | `rgba(255,193,77,0.14)` | `rgba(255, 193, 77, 0.14)` | `rgba(255,193,77,0.14)` | = |
| `--red` | `#ff5d6c` | `#ff5d6c` | `#ff5d6c` | = |
| `--redText` | `#ff8a95` | `#ff8a95` | `#ff8a95` | = |
| `--redTint` | `rgba(255,93,108,0.14)` | `rgba(255, 93, 108, 0.14)` | `rgba(255,93,108,0.14)` | = |
| `--violet` | `#c9a2ff` | `#c9a2ff` | `#c9a2ff` | = |
| `--violetText` | `#d9bdff` | `#d9bdff` | `#d9bdff` | = |
| `--violetTint` | `rgba(201,162,255,0.16)` | `rgba(201, 162, 255, 0.16)` | `rgba(201,162,255,0.16)` | = |
| `--doc` | `#6b7280` | `#6b7280` | `#6b7280` | = |
| `--onColor` | `#0d1522` | `#0d1522` | `#0d1522` | = |
| `--logoBg` | `#0b1220` | `#0b1220` | `#0b1220` | = |
| `--logoText` | `#f4f7fb` | `#f4f7fb` | `#f4f7fb` | = |
| `--grid` | `rgba(62,197,255,0.055)` | `rgba(62, 197, 255, 0.055)` | `rgba(62,197,255,0.055)` | = |
| `--sbThumb` | `color-mix(in srgb,#93a1b5 45%,transparent)` | `color-mix(in srgb, #93a1b5 45%, transparent)` | `color-mix(in srgb,#93a1b5 45%,transparent)` | = |
| `--sbThumbHover` | `#ff8c2a` | `#ff8c2a` | `#ff8c2a` | = |
| `--node` | `#2a3445` | `#2a3445` | `#2a3445` | = |
| `--nodeStroke` | `#3a4760` | `#3a4760` | `#3a4760` | = |
| `--edge` | `rgba(200,214,235,0.17)` | `rgba(200, 214, 235, 0.17)` | `rgba(200,214,235,0.17)` | = |
| `--d3` | `#a7c46b` | `#a7c46b` | `#a7c46b` | = |
| `--blastBg` | `#120d08` | `#120d08` | `#120d08` | = |
| `--glow` | `0.9` | `0.9` | `0.9` | = |
| alias `--alert` · `--alertText` · `--alertTint` | `var(--red)` · `var(--redText)` · `var(--redTint)` | #ff5d6c · #ff8a95 · rgba(255, 93, 108, 0.14) | (the handover has no `--alert*`) | alias |
| `--grid` at `.ops-graph` (hub) | Projects page `--grid` | rgba(201, 162, 255, 0.06) | `rgba(201,162,255,0.06)` (p07 helmet) | = |

## Computed styles (light)

`getComputedStyle(document.documentElement)` on this repository's map re-rendered with the current viewer, `#/overview`, Chromium, colour scheme light; handover column measured the same way at `.ac-light` on `p08/Systems.dc.html` (`p11/Main.dc.html` for the five Code-only tokens).

| Token | Handover (helmet) | Built (computed) | Handover (computed) | Status |
|---|---|---|---|---|
| `--bg` | `#f3f5f9` | `#f3f5f9` | `#f3f5f9` | = |
| `--panel` | `#ffffff` | `#ffffff` | `#ffffff` | = |
| `--rail` | `#fafbfd` | `#fafbfd` | `#fafbfd` | = |
| `--raise` | `#eef2f7` | `#eef2f7` | `#eef2f7` | = |
| `--line` | `#dde3ec` | `#dde3ec` | `#dde3ec` | = |
| `--line2` | `#c3ccd9` | `#c3ccd9` | `#c3ccd9` | = |
| `--text` | `#0d1522` | `#0d1522` | `#0d1522` | = |
| `--muted` | `#536074` | `#536074` | `#536074` | = |
| `--soft` | `#334155` | `#334155` | `#334155` | = |
| `--faint` | `#8592a5` | `#8592a5` | `#8592a5` | = |
| `--brand` | `#f47a12` | `#f47a12` | `#f47a12` | = |
| `--brandText` | `#b4530a` | `#b4530a` | `#b4530a` | = |
| `--brandTint` | `rgba(244,122,18,0.12)` | `rgba(244, 122, 18, 0.12)` | `rgba(244,122,18,0.12)` | = |
| `--brandLine` | `rgba(244,122,18,0.6)` | `rgba(244, 122, 18, 0.6)` | `rgba(244,122,18,0.6)` | = |
| `--cyan` | `#0ea5e9` | `#0ea5e9` | `#0ea5e9` | = |
| `--cyanText` | `#0369a1` | `#0369a1` | `#0369a1` | = |
| `--cyanTint` | `rgba(14,165,233,0.12)` | `rgba(14, 165, 233, 0.12)` | `rgba(14,165,233,0.12)` | = |
| `--green` | `#16a34a` | `#16a34a` | `#16a34a` | = |
| `--greenText` | `#15803d` | `#15803d` | `#15803d` | = |
| `--greenTint` | `rgba(22,163,74,0.12)` | `rgba(22, 163, 74, 0.12)` | `rgba(22,163,74,0.12)` | = |
| `--amber` | `#f5b324` | `#f5b324` | `#f5b324` | = |
| `--amberText` | `#92580a` | `#92580a` | `#92580a` | = |
| `--amberTint` | `rgba(245,179,36,0.16)` | `rgba(245, 179, 36, 0.16)` | `rgba(245,179,36,0.16)` | = |
| `--red` | `#e11d48` | `#e11d48` | `#e11d48` | = |
| `--redText` | `#be123c` | `#be123c` | `#be123c` | = |
| `--redTint` | `rgba(225,29,72,0.1)` | `rgba(225, 29, 72, 0.1)` | `rgba(225,29,72,0.1)` | = |
| `--violet` | `#8b5cf6` | `#8b5cf6` | `#8b5cf6` | = |
| `--violetText` | `#6d28d9` | `#6d28d9` | `#6d28d9` | = |
| `--violetTint` | `rgba(124,58,237,0.10)` | `rgba(124, 58, 237, 0.10)` | `rgba(124,58,237,0.10)` | = |
| `--doc` | `#9aa3b2` | `#9aa3b2` | `#9aa3b2` | = |
| `--onColor` | `#0d1522` | `#0d1522` | `#0d1522` | = |
| `--logoBg` | `#0d1522` | `#0d1522` | `#0d1522` | = |
| `--logoText` | `#ffffff` | `#ffffff` | `#ffffff` | = |
| `--grid` | `rgba(14,165,233,0.09)` | `rgba(14, 165, 233, 0.09)` | `rgba(14,165,233,0.09)` | = |
| `--sbThumb` | `color-mix(in srgb,#536074 45%,transparent)` | `color-mix(in srgb, #536074 45%, transparent)` | `color-mix(in srgb,#536074 45%,transparent)` | = |
| `--sbThumbHover` | `#f47a12` | `#f47a12` | `#f47a12` | = |
| `--node` | `#cdd5e1` | `#cdd5e1` | `#cdd5e1` | = |
| `--nodeStroke` | `#aab5c6` | `#aab5c6` | `#aab5c6` | = |
| `--edge` | `rgba(30,41,59,0.17)` | `rgba(30, 41, 59, 0.17)` | `rgba(30,41,59,0.17)` | = |
| `--d3` | `#86b25a` | `#86b25a` | `#86b25a` | = |
| `--blastBg` | `#fff8ef` | `#fff8ef` | `#fff8ef` | = |
| `--glow` | `0.35` | `0.35` | `0.35` | = |
| alias `--alert` · `--alertText` · `--alertTint` | `var(--red)` · `var(--redText)` · `var(--redTint)` | #e11d48 · #be123c · rgba(225, 29, 72, 0.1) | (the handover has no `--alert*`) | alias |
| `--grid` at `.ops-graph` (hub) | Projects page `--grid` | rgba(139, 92, 246, 0.08) | `rgba(139,92,246,0.08)` (p07 helmet) | = |

## Overflow 1440/375/320

| Width | Claim | Evidence | Status |
|---|---|---|---|
| 1440 · 375 · 320 | tokens change colour only, no box | kind 4: not applicable — overflow is probed per route in `map-shell-fidelity.md` | not applicable |

## Behaviour

| Chapter | Claim | Evidence | Status |
|---|---|---|---|
| Comparison | every token equals the handover in both themes | kind 3: `code_graph_map_tokens.test.ts` › "records every token as the browser computed it" reads the Built column above | ✓ |
| Sensitivity | a mutated token is caught | kind 3: same file › "sensitivity: one mutated token fails" — `--violetTint` 0.14 in the stylesheet and `--redText` #e0414f (the old dark value) in this matrix each turn the comparison red | ✓ |
| Scrollbar | WebKit thumb 10px, radius 6, 2px transparent border, hover `--sbThumbHover`; `@supports not` fallback thin | kind 2 on the stylesheet text (`code_graph_map_tokens.test.ts` › "the WebKit scrollbar block") — a pseudo-element's computed style is not readable through `getComputedStyle` | ✓ |

## Not implemented

| Item | Reason |
|---|---|
| `--orb-light`, `--orb-dark`, `--sand` | kept: the viewer's canvas orb and the Code page's sand band need them; the handover pages declare no replacement |
| Font files (Inter, IBM Plex Mono, Anton) | named first in each stack, never fetched — the page's CSP is `default-src 'none'` |
| `--logoBg` / `--logoText` on the logo | declared; the header keeps the traced AC mark, whose colours are its own gradients (the shell matrix records the logo) |
