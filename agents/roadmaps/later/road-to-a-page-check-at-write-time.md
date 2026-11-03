---
complexity: lightweight
status: later
parent_roadmap: road-to-a-page-that-says-what-it-loads
tree_pin: af5ab4dc22
review_by: 2027-01-31
estate_growth_exempt: "+1 later_roadmaps: carried out of road-to-a-page-that-says-what-it-loads (step 4.2) in the same change, with its blocker, because the ratification council refused the hook-bundle budget raise the step needs (2026-11-02). Carry is the preserving disposition; nothing is dropped."
estate_offset_exempt: "Carried, not new work. Owner search at af5ab4dc22 (grep -rlF for design_pass_hook, web_launch_rows, writeTimeFindings over agents/roadmaps/*.md, later, stubs) found no roadmap owning a write-time web-launch carrier."
entry_condition:
  what: "step 2.1 (lazy-loaded data-src) is pulled"
  when: "when an active roadmap closes and this is pulled"
  who: owner
---
# Road to a page check at write time

> **Source:** `agents/tmp.old/inbox-2026-11-g/` (topic T1), carried from
> `road-to-a-page-that-says-what-it-loads` step 4.2.
> **Arrivals:** 1 — `inbox-2026-11-g` (2026-11-02).

## Goal

A page the agent just wrote that loads a third party on first paint, or whose
imprint cites a superseded statute, surfaces as an advisory finding in the same
turn. The function exists (`writeTimeFindings` in
`src/scripts/web_launch_third_party.ts`, tested by
`tests/scripts/web_launch_write_time.test.ts`); only the carrier is missing.

## Phase 1 — The carrier

- [x] **1.1 Wire `writeTimeFindings` into `design_pass_hook`'s post_tool_use pass** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/hook-bundle-budget.json -->
      for `.html`/`.css` writes, advisory P2, exit 0, with the rows in a
      conditional chunk so the dispatch bundle carries only the call site.
      Blocked by `hook-bundle-budget-for-web-launch`.
      verify: `npx vitest run tests/hooks/design_pass_web_launch.test.ts` -> 0
      with a planted page surfacing its line and a safe twin surfacing nothing,
      and `./scripts-run src/scripts/check_hook_bundle_composition` -> 0.
      Done on `feat/web-launch-write-time`; ratification record
      `agents/evidence/ratifications/web-launch-write-time-20261102.md`
      (round 14, split, owner decision recorded there).

## Phase 2 — Carried from ratification round 14

- [ ] **2.1 Decide whether a lazy-loaded `data-src` is a first-paint load.**
      Rows 2.1 read `src` only, on purpose: a click-to-load iframe carrying only
      `data-src` is not a load (`tests/scripts/web_launch_linear.test.ts`).
      Round 14's refusing seat raised that lazy-load libraries fetch `data-src`
      on viewport entry, without a click, so a page with no consent marker can
      load a provider unreported. Pre-existing on main; not introduced by 1.1.
      verify: a page with `<img data-src>` of a registered provider and a lazy
      loader, no gate marker, yields an undecided or a finding; the
      click-to-load twin with a gate marker does not.

## Blockers

### blocker: hook-bundle-budget-for-web-launch
- **Status:** resolved — 2026-11-03: the carrier fits the existing ceiling (1,577,188 / 1,578,600 B) and the chunk row carries a ratification record
- **Class:** 2 — a governed threshold: the dispatch-bundle ceiling in `src/config/hook-bundle-budget.json` is on the ratification watched set
- **Owner:** owner
- **Blocks:** step 1.1
- **Question:** may the dispatch bundle grow by about 1 KB for this carrier?
- **What happened:** the wiring was built and measured on branch `analysis/inbox-2026-11-g`: inlined, 30,568 bytes over the ceiling; moved into a `web_launch_rows.chunk.cjs` with a shared `loadChunkExport`, +961 bytes against origin/main. The ratification council (2026-11-02, prompt `agents/evidence/council/hook-bundle-budget-raise-ratification-20261102.question.md`) returned one `refused` seat (openai) and one seat with no final verdict; the refusal asked for the loader refactor, the chunk and the raise as three separate reviewed changes, with the full diff in view.
- **Measured after the refusal:** with a real (APFS-cloned) `node_modules` origin/main's bundle is 1,560,694 B against the 1,562,000 ceiling, so the +961-byte call site fits without a raise. The chunk still needs its own ceiling row in the same watched file, so a ratification record is needed either way — a smaller one.
- **What to do:** one of (1) land the `loadChunkExport` refactor alone, then the chunk plus raise as a second change with its full diff in the ratification prompt; (2) bind a lazy concern instead of a call site in `design_pass_hook`, and measure whether its manifest row fits the current headroom; (3) leave write-time reach to the `ai-code-blindspots` row and the checker.
- **Recommendation:** (1) — it is the shape the refusing seat named, and the measured delta is the call site, not the rows.
- **If you do nothing:** findings arrive only when `check_web_launch_readiness` runs, not at write time; the `ai-code-blindspots` row still reaches sessions that load the skill.
- **Resolved when:** a ratification record for the raise exists in `agents/evidence/ratifications/`, or the carrier fits the existing ceiling.

## Risk Register

| # | Risk | Mitigation |
|---|---|---|
| R1 | The function drifts from the checker rows it mirrors | It calls the same `classifyLoads` / `supersededStatute`; the test pins both. |

## Acceptance Criteria

- [x] A planted page surfaces at write time; a safe twin does not; the bundle gate is green.
