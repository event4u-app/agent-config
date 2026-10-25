---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-ap verified at e85417a02 that the map answers structure but no risk question: grep of src/scripts/code_graph/ for churn, complexity, health, hotspot, blame and shortlog returns 0 authorship or metric hits (only refresh-lock `owner`), and MapFile (src/scripts/code_graph/map_model.ts:46-66) carries no loc, lang, dead flag, blast or owners. Owner search: grep -rlF for map_model, map_viewer, agents/map, blast radius and churn over agents/roadmaps/*.md, later/ and stubs/ returned no roadmap whose goal is the map or its viewer; road-to-a-graph-that-wins (later/) owns the oracle benchmark, not the page. Four active roadmaps against a WIP cap of five, and the owner asked for this run to execute the result in the same invocation."
relates:
  - slug: road-to-a-knowledge-atlas
    relation: disjoint
    note: "Sibling from the same round, parked. Owns the memory collector, the knowledge views beyond one file, complexity per symbol, the Flow and Change lenses and the deep reference analyses. Nothing here builds them; the Knowledge lens here shows only what the artefact layer already holds and marks memory as missing."
  - slug: road-to-a-graph-that-wins
    relation: disjoint
    note: "Owns the oracle benchmark of the engine. This roadmap draws what the engine already extracts and adds no relation and no resolver."
---
# Road to a map that answers

> **Source:** `agents/tmp.old/inbox-2026-10-ap/` — one owner transcript (two
> user turns, 2026-10-25), two externally drafted analyses pinned at
> `main@f99abc22`, one supplied design export (`design/{dark,light}/Main.dc.html`,
> the two `Main` files are byte-identical; `Light.dc.html` only switches the
> theme) and five reference screenshots. Re-verified against `main@e85417a02`.
>
> **The owner's demand, turn 1:** the reference picture is far better in content
> than what AC draws; AC must prepare all the data so a design agent can rebuild
> the page. **Turn 2:** layers as a view, analyse the other tools in depth, and
> visualise memory and every other knowledge source too. The design round that
> followed the transcript already happened: the supplied export is that page,
> drawn against this repository's own numbers, and it labels on its face which
> fields AC does not yet deliver.

## Goal

`agents/map/map.json` carries every field the supplied Workbench design shows,
computed by AC and never by the viewer: per file `loc`, `lang`, `churn`,
`owners`, `lastChange`, `dead`, `layer` and a `blast` record; per symbol the
internal and external call counts; per repo `languages`, `violations`,
`hotspots`, `health` with its formula, `legend` and `pin`; and a per-file
knowledge list drawn from the artefact layer. `agents/map/index.html` is
rebuilt as that design — three panes, the lenses Graph (2D and 3D orb),
Layers, Matrix, Knowledge and Treemap — with every panel the design greys out
for missing data now filled, and the panels whose data this roadmap does not
deliver (Flow, memory) still greyed with the design's own wording. `MAP.md`
and `graph_map_status` give an agent the same numbers the page shows.

## What verification changed

The two drafted analyses were checked claim by claim against `e85417a02`:

- **still true** — no churn, complexity, health, hotspot or authorship in the
  code graph (0 hits); `MapFile` has no loc, lang, dead flag or blast
  (`map_model.ts:46-66`); `SCHEMA_VERSION = 6` (`types.ts:345`); the viewer is
  canvas plus an orb (`viewer.js:177-190`); `dead`, `untested`, `impact` exist
  as verbs (`verbs.ts:258, 422, 530`) and MCP carries nine `graph_*` tools
  (`graph_tools.ts:238-529`); `agents/map/` is gitignored here (`.gitignore:54`).
- **already there, not re-planned** — the artefact layer (`MapArtefacts`,
  `map_model.ts:171`) the Knowledge lens reads; trusted versus guessed edge
  counts (`analyses.trustedEdges`, `guessEdgeCount`); the generation hash
  (`map.ts:358`); cycles via Tarjan (`analyses.cycles`).
- **corrected** — the drafts ask for a per-file `affected[depth][]` list in
  `map.json`. At this repository's 12,493 files that list is quadratic in the
  worst case. The numbers (`direct`, `transitive`, `score`, `share`, `level`)
  are precomputed here; which files they are is the breadth-first walk of the
  edges `map.json` already ships, done in the viewer and bounded by the same
  depth. Decision D3.
- **corrected** — "hotspot = churn × complexity" needs complexity per symbol,
  a tree-sitter change across every grammar. Here a hotspot is churn × size
  (`loc`), stated as such in `health.formula`; the complexity variant is
  carried to the parked sibling. Decision D4.

## Completion review

An independent review of the delta (2026-10-25) found two defects that bent the
health grade, both fixed before the PR: entry files counted as dead, and a
package root inside a larger repository read every file's churn as zero. Also
fixed: an author name set to an e-mail address reads `(name withheld)`; a
shallow clone yields no history instead of a healthy one; knowledge kinds need
a doc role; duplicates are roadmap-named files only; the viewer reads the blast
depth and the git window from `map.json`; the bus-factor finding moved into the
model (`soleOwner`). The step texts above were corrected to match the code.

## Decisions

| # | Question | Decision | Why | Revisit-if |
|---|---|---|---|---|
| D1 | Health grade or only the parts? | Both; the grade is withheld while any part is missing, and `health.formula` is a string in `map.json` the tooltip prints | the design already shows "kein Grade, solange 2 von 4 Teilwerten fehlen"; a grade without a visible formula is the reference tool's weakness | a reader acts on the grade without opening the formula |
| D2 | Layer from a rule file or a provider heuristic? | `agents/map/layers.yaml` is the only authority; absent → no `layer` field and the colour option stays greyed | a guessed layer produces violations nobody declared | a consumer asks for a suggested default |
| D3 | Precompute the affected file list per file? | No — numbers precomputed, membership walked in the viewer over shipped edges, same depth and trust filter | keeps `map.json` linear in files; the walk is a projection of data already shipped, not a new truth | the walk and the precomputed `direct`/`transitive` ever disagree in the render check |
| D4 | Hotspot without complexity? | churn × loc, named in the formula | delivers the panel now without guessing; complexity is parked work | complexity per symbol ships |
| D5 | Git window and identity | 180 days; author **names** only, never e-mail; field absent without git | e-mail is identifying and the page needs no address | a consumer commits `agents/map/` and names alone are still too much |
| D6 | Co-change as a graph relation? | Not here — parked with the Change lens | adds a relation `impact` would then traverse; that is engine work | the Change lens is woken |
| D7 | New MCP tools or extend `graph_map_status`? | **Revised during 5.2:** extend `graph_map_status` with health and findings, and an optional `file` that adds that file's blast record and depth lists. First decided as two new tools | the revisit condition fired: `src/config/evaluator-budgets.json` holds the tools/list count at zero headroom by design and `mcp_schemas` is a ratcheted token surface; one optional property costs neither a tool nor a new description | an agent needs the health without reading the map's freshness fields |
| D8 | Port the design's code or re-derive? | Port its markup, tokens and logic into the existing vanilla viewer; drop only the design runtime (`support.js`, React) | design-fidelity: adopting a stack-compatible handover is the default; the page must stay one offline file | the port cannot keep one self-contained `index.html` |

## Phase 1 — Data the design marks missing

- [x] **1.1 Size and language per file.** `MapFile` gains `loc` (lines) and <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/map.ts -->
      `lang` (from the graph's extension map, `types.ts`); the model gains
      `languages: Array<[lang, files, loc]>`. Counted at map build from the
      file contents read again from the working tree; binary or unreadable →
      field absent.
      verify: `npx vitest run tests/scripts/code_graph_map_answers.test.ts` -> 0
- [x] **1.2 Git collector, once per map build.** The map writer (IO lives <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/map.ts -->
      there, beside `drift` and `prOverlap`) runs one `git log --since=180.days
      --name-only` pass and writes per file `churn` (commits in window),
      `owners` (top three `[name, share]`, names only — D5) and `lastChange`
      (ISO date). No git → all three absent, never zero.
      verify: `npx vitest run tests/scripts/code_graph_map_answers.test.ts` -> 0
- [x] **1.3 Dead flag.** A scope file is `dead` when the `dead` verb lists <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/map.ts -->
      every symbol it declares and no trusted or guessed edge enters it; entry
      files never count. Written as `MapFile.dead`, `analyses.deadFiles` and
      `analyses.deadBasis`, which names the exports gap the verb ran under.
      verify: `npx vitest run tests/scripts/code_graph_map_answers.test.ts` -> 0
- [x] **1.4 Call counts per symbol.** `MapSymbol` gains internal and external <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/map.ts -->
      call counts from accepted `calls`/`uses` edges (same file versus other
      file); guessed edges are not counted.
      verify: `npx vitest run tests/scripts/code_graph_map_answers.test.ts` -> 0
- [x] **1.5 Blast numbers per file.** `MapFile.blast = {direct, transitive, <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/map.ts -->
      score, share, level}` over trusted in-edges to depth 3, scope code files;
      `score = direct + 0.5 × transitive`, level by share (≥ 50 % critical,
      ≥ 25 % high, ≥ 10 % medium, else low). Membership is not stored (D3).
      verify: `npx vitest run tests/scripts/code_graph_map_answers.test.ts` -> 0

## Phase 2 — Findings and health

- [x] **2.1 Layers from a rule file.** Read `agents/map/layers.yaml` (glob → <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/map.ts -->
      layer, allowed directions); write `MapFile.layer` and a `layer` entry in
      `violations[]` per forbidden edge. Absent file → neither field (D2).
      verify: `npx vitest run tests/scripts/code_graph_map_answers.test.ts` -> 0
- [x] **2.2 Violations and hotspots.** `violations[]` carries cycles (from <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/map.ts -->
      `analyses.cycles`) and layer breaches, each with files and a severity;
      `hotspots[]` ranks code files by `churn × loc`, top 20, both factors in
      the row (D4). No churn → `hotspots` absent.
      verify: `npx vitest run tests/scripts/code_graph_map_answers.test.ts` -> 0
- [x] **2.3 Health with its formula.** `health = {grade?, score?, parts, <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/map.ts -->
      formula}` with parts dead share, cycles, guessed-edge share, hotspots;
      each part `{value, weight, points}` or absent; `grade` only when every
      part is present (D1).
      verify: `npx vitest run tests/scripts/code_graph_map_answers.test.ts` -> 0
- [x] **2.4 Legend and pin.** `legend` per colour-by and size option (key, <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/map.ts -->
      label, scale, unit) and `pin = {commit, date, freshness, generation}`
      plus `blastDepth` and `gitWindowDays`, so the header and every legend read from `map.json`.
      verify: `npx vitest run tests/scripts/code_graph_map_answers.test.ts` -> 0

## Phase 3 — Knowledge per file

- [x] **3.1 Knowledge list from the artefact layer.** Per file, the artefacts <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/map.ts -->
      with an edge to it, grouped as the design groups them — contract,
      roadmap (active, later, archived), evidence, draft (`agents/tmp`,
      `agents/tmp.old`) — with status read from the path and a duplicate mark
      when the same basename sits in a roadmap folder and in an inbox folder.
      Memory is a named absent group, never an empty one.
      verify: `npx vitest run tests/scripts/code_graph_map_answers.test.ts` -> 0
- [x] **3.2 Knowledge finding.** When drafts outnumber contracts for a file, <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/map.ts -->
      the knowledge list carries the design's finding row ("mehr Entwürfe als
      Verträge") with both counts.
      verify: `npx vitest run tests/scripts/code_graph_map_answers.test.ts` -> 0

## Phase 4 — The Workbench page

- [x] **4.1 Tokens and frame.** Port the design's dark and light token sets <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/map.ts -->
      and its header, three-pane frame and rail sections into
      `map_viewer/viewer.{js,css}` (D8). One self-contained offline
      `index.html`, no web fonts fetched at runtime (system fallback stack
      named in the CSS).
      verify: `npx vitest run tests/scripts/code_graph_map_answers.test.ts` -> 0
- [x] **4.2 Left rail.** Health ring and parts, KPI tiles, role bar, <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/map.ts -->
      confidence bar, colour-by group (Blast, Area, Test share, Role, Folder,
      Layer, Churn, Complexity — an option is disabled with the design's hint
      exactly when its field is absent) and the explorer with scope chip.
      verify: `npx vitest run tests/scripts/code_graph_map_answers.test.ts` -> 0
- [x] **4.3 Graph lens, 2D and orb.** The design's area overview and in-area <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/map.ts -->
      file view, blast colouring by depth, the 2D / 3D-orb switch, zoom and
      fit, legend as a DOM element that follows the colour-by choice.
      verify: `npx vitest run tests/scripts/code_graph_map_answers.test.ts` -> 0
- [x] **4.4 Layers, Matrix, Knowledge, Treemap lenses.** Depth rings from the <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/map.ts -->
      selection; the area DSM with the selection's row and column and cycle
      blocks from `violations[]`; the knowledge columns from 3.1; the treemap
      weighted by `loc`. Flow stays disabled with the design's hint.
      verify: `npx vitest run tests/scripts/code_graph_map_answers.test.ts` -> 0
- [x] **4.5 Right rail.** File head, blast panel (numbers, depth list, <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/map.ts -->
      formula line), connections with relation and trust, symbols with call
      counts, knowledge list, ownership and churn, findings (cycles,
      surprises, drift, layer breaches, hotspots, dead files).
      verify: `npx vitest run tests/scripts/code_graph_map_answers.test.ts` -> 0
- [x] **4.6 Render check and fidelity matrix.** `map_verify` passes at its <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/map.ts -->
      three widths in both themes; a committed fidelity matrix under
      `agents/evidence/reviews/` names, per design zone, what was compared and
      every deviation with its reason.
      verify: `test -f agents/evidence/reviews/map-workbench-fidelity.md` -> 0

## Phase 5 — The same numbers for an agent

- [x] **5.1 MAP.md health block.** `renderMapMd` writes the health parts with <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/map.ts -->
      the formula and the top five findings, inside the existing token budget.
      verify: `npx vitest run tests/scripts/code_graph_map_answers.test.ts` -> 0
- [x] **5.2 The same numbers over MCP.** `graph_map_status` returns the <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/code_graph/map.ts -->
      health and the top findings, and with `file` that file's blast record
      and the files it reaches by depth, from the same model (D7, revised);
      catalogue, inventory and the code-intelligence skill row follow.
      verify: `npx vitest run tests/scripts/mcp_graph_tools.test.ts` -> 0

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The page shows a number AC did not compute | product | a port of the design copies its demo constants (12,493 files, area names) into the viewer | every rendered figure is read from `map.json`; 4.6's matrix lists each zone's data source | Phase 4 — The Workbench page |
| 2 | `map.json` grows past what a browser opens | implementation | per-file records and per-symbol counts on a 12k-file repo | blast membership is walked, not stored (D3); measured on this repository: `map.json` 5.9 MB, `index.html` 6.0 MB for 10,971 files | Phase 1 — Data the design marks missing |
| 3 | Git names leak where they should not | product | owners land in a committed map in a consumer repo | names only, no e-mail (D5); absent without git | Phase 1 — Data the design marks missing |
| 4 | Health grade read as a verdict | product | a single letter replaces the parts | grade withheld while a part is missing, formula always printed (D1) | Phase 2 — Findings and health |

## Acceptance Criteria

- [x] AC-1 — A map built of this repository has no panel the design greys out
      for a field this roadmap names; the remaining greyed panels are exactly
      Flow, Complexity and Memory, each with the design's hint — and Layer while
      no `agents/map/layers.yaml` exists, which D2 makes the rule's authority.
      Corrected at closure: the first wording forgot D2. Checked 2026-10-25 by
      building this repository's map with and without a `layers.yaml`: with it,
      `legend` marks only `complexity` unavailable (12 breaches, 1,765 layered files).
- [x] AC-2 — Every figure on the page and in `MAP.md` traces to a `map.json`
      field computed in `src/scripts/code_graph/`; the viewer derives only the
      blast membership walk (D3) and sums of shipped per-file values (role and
      knowledge bars, treemap folder lines). Corrected at closure: the first
      wording omitted the sums; `tests/scripts/code_graph_map_answers.test.ts`
      fails if a figure the design hard-coded reaches the page.
- [x] AC-3 — `graph_map_status` returns the health and, for a file, the blast
      numbers the page shows for the same generation.
