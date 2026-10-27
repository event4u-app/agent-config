---
complexity: structural
status: ready
tree_pin: 92397d6368
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-a-map-that-holds-on-the-real-repo
    relation: depends
    note: >
      Sibling from the same inbox round. Its data steps are entry dependencies
      here and are not repeated: A.2 (scope on every fact, the fixture toggle),
      Stage E (E.2 verdict states, E.4 per-workspace identity, E.5 all chains
      and dependent counts, E.6 functions per file). This file carries the VIEW
      half of its Stage G (G.1 table, G.2 Systems, G.3 branch context, G.5 small
      fixes) and the view halves of its AC-11, AC-12, AC-13 and AC-17; the
      handover in the Source line is the approved G.0 design.
  - slug: road-to-a-map-that-knows-what-happened
    relation: depends
    note: >
      Sibling from the same inbox round. Bug lane data (its Stage H) feeds
      Phase 7; knowledge sources and the user-scope learning data (its Stages I
      and K) feed Phases 5 and 6. Until those land, the pages render their
      empty state with the reason, never invented figures.
  - slug: archive/road-to-a-map-across-systems-branches-and-time
    relation: extends
    note: >
      Archived predecessor that shipped the current Systems, Branches and shell
      pages this file reworks to the new handover.
depends:
  - road-to-a-map-that-holds-on-the-real-repo
  - road-to-a-map-that-knows-what-happened
estate_offset_exempt: "Adds one active roadmap without an offset: the owner asked on 2026-10-27 to process inbox round 2026-10-bf, whose twelve design pages (two of them new routes) have no active owner -- no active roadmap covers the map views, the predecessor is archived, and folding the port into the sibling data roadmap would put view and generator work behind one phase gate. Archiving or parking another file to make room would drop live work the owner did not ask to drop."
estate_growth_exempt: "active_roadmaps rises by one for this file as part of the inbox-2026-10-bf round (two existing active plus this file and its two siblings, which reaches the WIP cap of 5 and does not exceed it). The growth is the owner's own request this turn to process the round; the counts are to be re-read from check_estate_count after commit, not trusted from this sentence."
---
# Road to map views from the handover

> **Source:** `agents/tmp.old/inbox-2026-10-bf/`

## Goal

Every page of the map viewer matches the twelve-page design handover of this
round 1:1 — tokens, shell, Übersicht, a rebuilt Systeme, the small deltas on the
other existing pages, the Projects "Ich · Lernen" lens, and the two new routes
Wissen and Bugs — and each page has a committed fidelity matrix that names, per
handover chapter, the evidence taken: landmark/aria diff design vs build,
`getComputedStyle` at named selectors in both themes, overflow probes at
1440/375/320, behaviour specs with a sensitivity probe, and explicit
not-implemented rows. Bug data never reaches the committed map.

## Context

The handover is the spec (design-fidelity, strict mode). The design analysis of
this round compared the new pages against the previous handover AND against the
rendered current viewer, not only screenshots; its per-page verdicts are:

| Page | Viewer file today | Verdict |
|---|---|---|
| Übersicht | `area_overview.js` | changed (behind banner, Health/States/Notes replace Gate G0, Check protocol, Tours) |
| Code | `area_code.js`, `viewer.js` | small delta |
| Data | `area_data.js` | small delta (empty state shape) |
| Systeme | `area_systems.js` | rebuild — new in all but name |
| Interfaces, Runtime, Delivery, Impact, Agent | `area_*.js` | small delta |
| Projects | `area_projects.js` | changed (+ "Ich · Lernen" lens) |
| Wissen | — | NEW route |
| Bugs & Fixes | — | NEW route, local only |

Existing proof mechanism: `src/skills/design-review/SKILL.md` § Fidelity proof;
the instance to copy is `agents/evidence/reviews/map-workbench-fidelity.md`.
Viewer sources live under `src/scripts/code_graph/map_viewer/`; payload builders
in `src/scripts/code_graph/map_area_payloads.ts`.

Entry dependencies (not duplicated here, see `relates:`): scope/fixture filter
(sibling A.2), Systems accuracy (sibling E.2, E.4, E.5, E.6), bug lane (Stage H),
knowledge and learning data (Stages I, K).

## Phase 0 — Tokens

- [x] **0.1 Matrix shape gate.** Add `tests/scripts/code_graph_map_fidelity_matrices.test.ts`:
      for each page id in a fixed list (tokens, shell, overview, code, data,
      systems, interfaces, runtime, delivery, impact, agent, projects, knowledge,
      bugs) it requires `agents/evidence/reviews/map-{page}-fidelity.md` once that
      page's phase closes, with the sections Landmarks, Computed styles (dark),
      Computed styles (light), Overflow 1440/375/320, Behaviour, Not implemented,
      and fails on a matrix missing any of them.
      verify: `npx vitest run tests/scripts/code_graph_map_fidelity_matrices.test.ts` -> 0
- [x] **0.2 Port the token diff.** In `viewer.css`: `--red`, `--redText`,
      `--redTint` as the handover names (the `--alert*` names stay as aliases),
      dark `--redText` #ff8a95, `--violetTint` dark rgba(201,162,255,.16) and
      light rgba(124,58,237,.10), new `--logoBg`/`--logoText`, `--sbThumbHover`,
      the WebKit scrollbar block with its `@supports not` fallback; the hub
      grid reads `--grid`.
      verify: `npx vitest run tests/scripts/code_graph_map_tokens.test.ts` -> 0
- [x] **0.3 Token matrix.** A probe dumps `getComputedStyle(document.documentElement)`
      for every handover token in both themes into
      `agents/evidence/reviews/map-tokens-fidelity.md`; the test compares each
      value to the handover table and fails when one token is mutated
      (sensitivity probe).
      verify: `npx vitest run tests/scripts/code_graph_map_tokens.test.ts -t sensitivity --reporter=verbose` -> /✓.*sensitivity/

Exit: 0.1–0.3 green. Rollback: revert `viewer.css`; aliases keep every caller working.

## Phase 1 — Shell

- [x] **1.1 Nav order and two new routes.** Übersicht · Code · Data · Systeme ·
      Interfaces · Runtime · Delivery · Bugs · Wissen · Impact · Agent in
      `areas_common.js` and `shell.js`; no-data entries carry the handover's
      `title` text; Bugs is always no-data in a committed map.
      verify: `npx vitest run tests/scripts/code_graph_map_shell.test.ts -t "nav order" --reporter=verbose` -> /✓.*nav order/
- [x] **1.2 Header chips.** Commit chip "gebaut bei" + short sha + date, with the
      sha12 + generation title; freshness chip lowercase on amber tint; new
      dashed "Snapshot · ohne Branch-Stand" chip in a committed map; the search
      up button reads "← eine Ebene hoch". The freshness chip renders
      `pin.freshness` as built (Decision D4).
      verify: `npx vitest run tests/scripts/code_graph_map_shell.test.ts -t "header chips" --reporter=verbose` -> /✓.*header chips/
- [x] **1.3 History breadcrumbs.** One shared `nav aria-label="Verlauf"`
      component: a stack of up to 50 states {lens, sel, filters, limit}, trail
      buttons separated by `›`, a 24px `←` only when history exists; no back
      button and no crumb chips. Used by Systeme and Bugs.
      verify: `npx vitest run tests/scripts/code_graph_map_history_crumbs.test.ts` -> 0
- [x] **1.4 Provenance footer.** A shared footer line per page naming the
      source file and commit ("Echte Daten · systems.json @ 2efd5be1").
      verify: `npx vitest run tests/scripts/code_graph_map_shell.test.ts -t provenance --reporter=verbose` -> /✓.*provenance/
- [x] **1.5 Breakpoints, scroll strip, flyouts.** Breakpoints 700 and 1000 per
      the handover replace 720/400; at ≤700 the nav and every tablist are one
      horizontal scroll strip (the ☰ menu goes, Decision D6); asides become
      `position:absolute` flyouts with `±12px 0 40px` shadows and the handover's
      open buttons; aside labels are the page-specific names (Schema, Dienste,
      Operation, Ressource, Anfrage, Item, Nachweisbericht, Filter, Bug,
      Registry, Kante).
      verify: `npx vitest run tests/scripts/code_graph_map_shell_overflow.test.ts` -> 0
- [x] **1.6 Shell matrix.** `agents/evidence/reviews/map-shell-fidelity.md`:
      landmark/aria diff design vs build for header and nav at 1440/375/320 in
      both themes, computed styles at `nav a`, `[aria-current]`, each chip, and
      a 375 probe showing `scrollWidth > clientWidth` on the nav with no
      document overflow.
      verify: `npx vitest run tests/scripts/code_graph_map_fidelity_matrices.test.ts -t shell --reporter=verbose` -> /✓.*shell/

Exit: 1.1–1.6 green on the demo map and this repo's map. Rollback: revert
`shell.js`, `shell.css`, `areas_common.js`; routes fall back to the old list.

## Phase 2 — Übersicht

- [x] **2.1 Filter and behind banner.** The state filter becomes a radiogroup
      "Alle Ebenen / Mit Daten / Geplant · leer"; the banner shows the behind
      chip (Decision D4), "code-graph refresh", the snapshot chip and the
      witness count "N Zeugen · M erneut gelesen" from the model.
      verify: `npx vitest run tests/scripts/code_graph_map_overview_page.test.ts -t banner --reporter=verbose` -> /✓.*banner/
- [x] **2.2 Eleven cards.** Grid `auto-fill minmax(min(300px,100%),1fr)` with
      Code, Datenbank, Systeme, Integrations, Environment, CI/CD, Infrastruktur,
      Wissen · Memory, Impact, Bugs & Fixes, Projects; the amber warn box when
      the manifest says `empty` but carries facts or findings; the
      "Branch-Unterschiede" chip row; planned cards dashed.
      verify: `npx vitest run tests/scripts/code_graph_map_overview_page.test.ts -t cards --reporter=verbose` -> /✓.*cards/
- [ ] **2.3 Lower row.** Health card (grade chip, A/B/C scale, four bars, the
      "Größter Hebel" sentence from the model's health parts), Zustände card
      (seven states), "Hinweise zu dieser Map" (notes 1–2 derived, 3–4 handover
      copy); Gate G0, Check protocol and Tours leave the page (Decision D2).
      verify: `npx vitest run tests/scripts/code_graph_map_overview_page.test.ts -t "lower row" --reporter=verbose` -> /✓.*lower row/
- [ ] **2.4 Overview matrix.** `agents/evidence/reviews/map-overview-fidelity.md`
      with the 11-card × field table, landmark diff, computed styles both
      themes, overflow at three widths, a sensitivity probe on the warn box.
      verify: `npx vitest run tests/scripts/code_graph_map_fidelity_matrices.test.ts -t overview --reporter=verbose` -> /✓.*overview/

Exit: 2.1–2.4 green. Rollback: revert `area_overview.js` and its CSS.

## Phase 3 — Systeme

Entry: sibling A.2, E.2, E.4, E.5, E.6 closed. Until then the page renders the
empty-with-reason form for each missing field, never a guessed value.

- [ ] **3.1 Uncapped usage per area.** The Systems payload emits, per package,
      `byArea` file counts and the top used names over ALL uses, beyond the
      20-file `USED_BY_CAP` sample (the sample stays for the file list).
      verify: `npx vitest run tests/scripts/code_graph_map_area_payloads.test.ts -t byArea --reporter=verbose` -> /✓.*byArea/
- [ ] **3.2 Ecosystem presence probe.** The generator records, per ecosystem it
      does not read (pnpm, Yarn, Bun, pip/Poetry, Cargo, Go, Maven/Gradle,
      Bundler, NuGet), whether a lockfile or manifest is present, so the page
      can say "nicht gelesen" vs "kein Lockfile gefunden" truthfully (Decision D5).
      verify: `npx vitest run tests/scripts/code_graph_map_area_payloads.test.ts -t "ecosystem probe" --reporter=verbose` -> /✓.*ecosystem probe/
- [ ] **3.3 Autoload-read flag.** The payload states whether the Composer
      autoload maps were read, so status "unk · Autoload" is derivable.
      verify: `npx vitest run tests/scripts/code_graph_map_area_payloads.test.ts -t autoload --reporter=verbose` -> /✓.*autoload/
- [ ] **3.4 Lens bar and Filter aside.** Six tabs (Übersicht · Pakete ·
      Abhängigkeiten · Runtimes · Befunde · N · Branches); the Filter aside with
      search, package-manager checkbox rows with `.pm` badge, count and lockfile
      caption, the unread-ecosystem chips, workspace checkboxes (fixtures off by
      default), status radiogroup with seven options, segmented radiogroups
      Scope / Herkunft (direkt, transitiv) / Lock / Tiefe / Benötigt von, the
      "Nur zeigen" switches, "Filter zurücksetzen". Every count equals the
      payload's.
      verify: `npx vitest run tests/scripts/code_graph_map_systems_page.test.ts -t filters --reporter=verbose` -> /✓.*filters/
- [ ] **3.5 Übersicht lens.** Seven KPI tiles that each apply a filter, PM cards
      with stacked dev/direct/locked bars, Workspaces × Paketmanager grid,
      Frameworks tiles, Befunde nach Art rows.
      verify: `npx vitest run tests/scripts/code_graph_map_systems_page.test.ts -t overview --reporter=verbose` -> /✓.*overview/
- [ ] **3.6 Pakete list on the shared table.** Sort radiogroup (Befund zuerst ·
      benötigt · Nutzung · Tiefe · Name), "Nach Name gruppieren" switch, the
      9-column grid, paging "Weitere 60 zeigen", columns 4–8 hidden ≤700px;
      built on one table component reused by Interfaces, Delivery and Befunde
      (sibling G.1); every payload row reachable by scroll and filter.
      verify: `npx vitest run tests/scripts/code_graph_map_systems_page.test.ts -t "every row reachable" --reporter=verbose` -> /✓.*every row reachable/
- [ ] **3.7 Abhängigkeiten lens.** Head, KPI row, Nachbarschaft SVG (left
      required-by, right requires, clickable), "Warum installiert? · N Wege" with
      every chain and clickable hops, Benötigt von · N / Benötigt selbst · N with
      direct and transitive counts, functions per file with call counts, "Nach
      Code-Area" chips, "Nutzung ohne Import", and the "Was die Map hier nicht
      weiß" block.
      verify: `npx vitest run tests/scripts/code_graph_map_systems_page.test.ts -t dependencies --reporter=verbose` -> /✓.*dependencies/
- [ ] **3.8 Runtimes, Befunde, Branches lenses and Detail aside.** Runtimes as
      one card per runtime grouped by source kind with disagreement; Befunde as
      collapsible groups by rule with "Vorschlag, nie angewendet"; Branches with
      the Map-Art radiogroup (committed: explanation and commands; local: chain
      card and 7-column table); Detail aside with kv rows, finding cards, "Auf
      Branches" chips and the "index only" witness chip.
      verify: `npx vitest run tests/scripts/code_graph_map_systems_page.test.ts -t "lenses and detail" --reporter=verbose` -> /✓.*lenses and detail/
- [ ] **3.9 Crumbs and back.** Every filter, sort and selection pushes a
      history state; `←` restores the previous one exactly; a sensitivity probe
      that skips the push turns the spec red.
      verify: `npx vitest run tests/scripts/code_graph_map_systems_page.test.ts -t crumbs --reporter=verbose` -> /✓.*crumbs/
- [ ] **3.10 Systems matrix and click paths.** `agents/evidence/reviews/map-systems-fidelity.md`
      per component (strip, filters, list, dependencies, runtimes, findings,
      branches, detail), plus the §9.1 questions of the brief answered by click
      path on this repository and the brief §6 ask-to-step mapping table
      (AC-13 view half).
      verify: `npx vitest run tests/scripts/code_graph_map_fidelity_matrices.test.ts -t systems --reporter=verbose` -> /✓.*systems/

Exit: 3.1–3.10 green on this repository's map and the demo map. Rollback:
revert `area_systems.js` and the new CSS; payload additions are additive.

## Phase 4 — Small deltas on the existing pages

- [ ] **4.1 Data, Impact empty state.** A real map with no data renders the
      page skeleton (single tab "ERD · noch keine Daten" / "Änderung · keine",
      legend, footer), not the `noDataCard`; 2D/3D and Spalten become
      radiogroups; aside labels Schema / Nachweisbericht.
      verify: `npx vitest run tests/scripts/code_graph_map_no_data.test.ts -t skeleton --reporter=verbose` -> /✓.*skeleton/
- [ ] **4.2 Interfaces, Runtime.** Interfaces opens on Operationen, caption
      "Dienste · n von m angezeigt"; Runtime opens on Topologie and draws the
      zone caps even when empty, with "Befunde außerhalb einer Ressource · N".
      verify: `npx vitest run tests/scripts/code_graph_map_ported_pages.test.ts -t "interfaces runtime" --reporter=verbose` -> /✓.*interfaces runtime/
- [ ] **4.3 Delivery, Agent, Code.** Delivery's third scenario is labelled from
      the repository's own trigger in `workflows[].events`; Agent verb list and
      aside labels Anfrage / Item; Code 2D/3D and Scope as radiogroups, the
      "Flow · n. A." label; Code keeps "Domäne" per Decision D3.
      verify: `npx vitest run tests/scripts/code_graph_map_ported_pages.test.ts -t "delivery agent code" --reporter=verbose` -> /✓.*delivery agent code/
- [ ] **4.4 Seven matrices.** One `map-{page}-fidelity.md` each for data,
      interfaces, runtime, delivery, impact, agent, code, covering real and demo
      map.
      verify: `npx vitest run tests/scripts/code_graph_map_fidelity_matrices.test.ts -t "small deltas" --reporter=verbose` -> /✓.*small deltas/

Exit: 4.1–4.4 green. Rollback: per-page revert; each page is independent.

## Phase 5 — Projects "Ich · Lernen"

- [ ] **5.1 Second lens.** `area_projects.js` gains the tablist Projekte /
      Ich · Lernen, the Registry aside with the BUDGET cap, the Kante aside and
      "← Projekt-Map"; Ich · Lernen renders empty with reason until sibling
      Stage K data exists, then its KPIs from that data.
      verify: `npx vitest run tests/scripts/code_graph_map_projects_page.test.ts` -> 0
- [ ] **5.2 Projects matrix.** `agents/evidence/reviews/map-projects-fidelity.md`.
      verify: `npx vitest run tests/scripts/code_graph_map_fidelity_matrices.test.ts -t projects --reporter=verbose` -> /✓.*projects/

Exit: 5.1–5.2 green. Rollback: revert `area_projects.js`.

## Phase 6 — Wissen

- [ ] **6.1 New route.** `area_knowledge.js` and CSS: lenses Quellen · Memory ·
      Entscheidungen · Sessions · Arbeitsweise; Filter aside with Besitzer and
      "Liest die Map?" groups; KPI buttons; store table with format caps;
      "Wem gehört was"; Detail aside. Each figure comes from the knowledge
      source index (sibling Stages I and K); a figure without a payload field
      is a not-implemented row, never a hard-coded audit number.
      verify: `npx vitest run tests/scripts/code_graph_map_knowledge_page.test.ts` -> 0
- [ ] **6.2 Wissen matrix.** `agents/evidence/reviews/map-knowledge-fidelity.md`,
      each real-count row tied to a payload field.
      verify: `npx vitest run tests/scripts/code_graph_map_fidelity_matrices.test.ts -t knowledge --reporter=verbose` -> /✓.*knowledge/

Exit: 6.1–6.2 green. Rollback: drop the route from 1.1's list.

## Phase 7 — Bugs (local only)

- [ ] **7.1 New route, local map.** `area_bugs.js` and CSS: lenses Übersicht ·
      Bugs · Behoben · Regressionspfade · Zeitleiste; Filter aside (Status,
      Quelle with "kein Adapter" for missing adapters, Umgebung, Area, Ursache,
      Symbolisierung); Verlauf crumbs; Bug detail with fix commits, timeline,
      frames, hypotheses, the introducing-commit candidate. Data from the local
      bug lane (sibling Stage H, `.build/bugs/`).
      verify: `npx vitest run tests/scripts/code_graph_map_bugs_page.test.ts -t local --reporter=verbose` -> /✓.*local/
- [ ] **7.2 Committed map stays empty.** The committed map renders only the
      "keine Daten" tab, the "warum leer" card and the local-data chip; a test
      plants a bug id, title and message in the local lane and asserts none of
      them appears in any file under `agents/map/` outside `.build/` (AC-17 view
      half).
      verify: `npx vitest run tests/scripts/code_graph_map_bugs_page.test.ts -t committed --reporter=verbose` -> /✓.*committed/
- [ ] **7.3 Bugs matrix.** `agents/evidence/reviews/map-bugs-fidelity.md` for
      both the committed and the local map.
      verify: `npx vitest run tests/scripts/code_graph_map_fidelity_matrices.test.ts -t bugs --reporter=verbose` -> /✓.*bugs/

Exit: 7.1–7.3 green. Rollback: drop the route; the committed map is unchanged.

## Decisions

Design deviations the analysis found. Strict mode: the default is the handover,
1:1; each row stays owner-pending until the owner answers.

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | product-owned | owner | proposed — build 1:1 per handover: the "Echte Map / Demo · Fixture" Datenquelle radiogroup on eight pages (owner-pending; a map file carries one dataset, so the toggle needs both payloads embedded) | handover Übersicht, Code, Data, Interfaces, Runtime, Delivery, Impact, Agent | the owner answers otherwise |
| D2 | product-owned | owner | proposed — build 1:1 per handover: Übersicht drops Gate G0, Check protocol and Tours (owner-pending) | `area_overview.js` lower row vs handover Übersicht | the owner answers otherwise |
| D3 | product-owned | owner | proposed — build 1:1 per handover: Code colour-by without "Domäne" (owner-pending; the option shipped with the domains work) | handover Code colour list | the owner answers otherwise |
| D4 | product-owned | owner | proposed — build 1:1 per handover: the behind:N chip; computable only when `index.html` is drawn locally on open, so a committed static file shows `pin.freshness` as built (owner-pending) | manifest `state: fresh` at build | the owner answers otherwise |
| D5 | product-owned | owner | proposed — build 1:1 per handover: "Kein Lockfile oder Manifest gefunden" for unread ecosystems, made true by the 3.2 probe; a present but unread lockfile reads "nicht gelesen" (owner-pending) | handover Systeme Filter aside | the owner answers otherwise |
| D6 | product-owned | owner | proposed — build 1:1 per handover: the ☰ area menu at 375 is replaced by the horizontal scroll strip (owner-pending) | `shell.css` `#areamenu` vs handover breakpoint block | the owner answers otherwise |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-27 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Fidelity claimed from screenshots | product | A page passes a visual glance while controls, roles or states differ from the handover | Every page phase closes only with its matrix, and 0.1 fails a matrix missing landmarks, computed styles, overflow, behaviour or not-implemented rows | Phase 0 — Tokens |
| 2 | Hard-coded design figures | product | The handover embeds real counts from one audit; copying them makes the page lie on the next build | Every figure binds to a payload field or becomes a not-implemented row; `code_graph_map_answers.test.ts` already forbids design literals | Phase 6 — Wissen |
| 3 | Bug data in the committed map | implementation | A local-only lane leaks ids or messages into `agents/map/` | 7.2 plants bug strings and greps the committed tree | Phase 7 — Bugs (local only) |
| 4 | Systems built before its data | implementation | The rebuild lands on a payload without workspace, chains or verdict states and fills the gaps by guessing | Phase 3 entry names sibling A.2 and E; missing fields render empty with reason | Phase 3 — Systeme |
| 5 | Shell change breaks every page | implementation | Breakpoints, flyouts and nav order touch all areas at once | 1.5 overflow test runs every route at three widths in both themes | Phase 1 — Shell |

## Acceptance Criteria

- [ ] AC-1 — All fourteen `map-{page}-fidelity.md` matrices exist and
      `code_graph_map_fidelity_matrices.test.ts` passes over them.
- [ ] AC-2 — Every route renders at 1440/375/320 in both themes with no
      document overflow, on this repository's map and the demo map.
- [ ] AC-3 — Systeme: every payload row is reachable; filter counts equal the
      payload's; a package detail answers why installed (all chains), direct vs
      transitive, required-by count, and functions per file.
- [ ] AC-4 — The committed map contains no branch name and no bug id, title or
      message.
- [ ] AC-5 — Every Decisions row either still reads the handover default or
      carries the owner's dated answer.
