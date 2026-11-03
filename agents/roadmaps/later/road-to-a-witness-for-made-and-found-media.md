---
complexity: structural
status: later
tree_pin: 62e7d03a43
review_by: 2026-12-15
estate_growth_exempt: "+1 later_roadmaps from /analyze:inbox round inbox-2026-11-p: the non-executable residue of topic t1; no active roadmap is added by this file."
estate_offset_exempt: "Owner search at 62e7d03a43: grep -rlF -e media-witness -e image:verify -e operator-pick -e expect.json over agents/roadmaps/*.md, later and stubs found no owner of post-render media verification; nothing absorbs this."
entry_condition:
  what: "road-to-a-verdict-that-shows-its-frame archived, plus owner answers on gate defaults (E3) and the engine repo (E4)"
  when: "next inbox or planning round after both answers"
  who: owner
---
# Road to a witness for made and found media

> **Source:** `agents/tmp.old/inbox-2026-11-p/` (topic t1, supplied plan v2
> Phases 5–11 with the v1 items v2 dropped restored).
> **Arrivals:** 1 — `inbox-2026-11-p` (2026-11-03).

## Goal

The same check layer serves media the suite made and media it was handed: an
expectations file from blueprint, character lock and canon; a `media-witness`
skill with closed questions (present / missing-while-visible / not observable);
a deterministic aggregate; generation gates A–D that annotate and never re-render
automatically. Owner demand (2026-11-03): "möglichst viel erkennen, auch ohne das
extra Tool" — the native path is the acceptance floor.

## Phase 1 — Expectations and the witness catalog

- [ ] **1.1 `src/scripts/media_expect.ts`** → `expect.json`; an unmapped camera
      move is never guessed. verify: `tests/scripts/media_expect.test.ts`.
- [ ] **1.2 `src/skills/media-witness/`** with question catalog, still-defect
      checklist and report template; triggers include a "is this a deepfake?"
      detection row (restored from v1) and the routing-collision measurement
      against `media-governance-routing` (owner E2 only if it collides).
- [ ] **1.3 `media_witness_aggregate.ts`** + answer schema; a missing finding
      needs ≥ 3 frames; a constant readout counts only with a contradicting
      measurement; restored thresholds for the found-media claim (recall ≥ 0.8,
      0 findings on near-miss clips); no report uses "fake" as a verdict and none
      states anything about the person shown.

## Phase 2 — Made media

- [ ] **2.1 `image:verify` without a mandatory canon**, `--expect`, unmasked-region
      diff for edits.
- [ ] **2.2 `uiRenderAssetCompare.ts --inventory`** (palette quantise +
      connected components) — element inventory for image → SVG.
- [ ] **2.3 Gates A–D** in the video commands and `operator-pick.sh` annotation;
      a dry-run run reports "no pixels judged", never a scorecard.
- [ ] **2.4 Series matrix** element × image plus colour stats; the character
      lock reference anchors the series.

## Phase 3 — Found media and the engine

- [ ] **3.1 `analyze:post --authenticity`** plus stills and image pairs.
- [ ] **3.2 Engine bridge** behind one pinned contract name (pick one of the
      three names the sources use; reconcile `measured|read` vs
      `native|read|engine`): binary on PATH with a version floor,
      `scan --json --no-network`, `--print-schema` equal to a vendored sha-pinned
      schema, exit 0/2/3, `reader_tasks`.

## Decisions

| # | Decision | Route | Outcome |
|---|---|---|---|
| E3 | Default gate set A/B/C/D | owner | open |
| E4 | Separate engine repo, name, licence, model licences | owner | open |
| E5 | Cloud opt-in for frames | owner | open (default stays local-only) |
| E6 | Post-render consistency check vs the 2026-10 stub decisions D10/D11 | council | open — different mechanism (closed-question reader), record before building |
| K | New `/media:*` command family, council on contradictions, 3-pass repair loop, blocking operator-pick | agent | declined |
