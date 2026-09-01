---
complexity: lightweight
status: stub
---

# Road to the promotion-bridge size split and the topology citation repairs

Three defects a neutral review found on 2026-09-01 that were **not** fixed in the
change that surfaced them, each for a stated reason. Full review, including the
prompt it was commissioned with, at
[`../../evidence/reviews/drain13-neutral-review.md`](../../evidence/reviews/drain13-neutral-review.md).

## 1. `road-to-harness-promotion-bridge.md` is over the structural line cap

`src/agent-src/templates/roadmaps.md:28` caps a declared `complexity: structural`
roadmap at **1000 lines** — *"if larger, split into multiple files"*. The file
crossed it during drain run 13 (927 → 1065) and is the only active roadmap over
the cap.

**Why nothing caught it:** `lint_roadmap_complexity.ts:50` carries only
`LIGHTWEIGHT_LINE_CAP = 600`. The structural cap is documented and ungated, so
the crossing was silent — which is the more interesting half of this item.

**Why it was not fixed in the same change.** Splitting is a restructuring of a
governance record whose Resume condition reserves weakening, cancelling,
retiring and completing its transferred steps to the owner, and whose two open
items are both owner-reserved. A split performed by the same run that wrote most
of the added lines is the shape `preservation-guard` exists to catch. It also
cannot be done well while `blocker: merge-authority` is open, because the natural
cut line is Phase 7, which is the part the blocker governs.

**What closes it:** either a split the owner accepts, or a gate for the
structural cap so the next crossing is not silent — and the gate is the cheaper
half, independent of the split.

## 2. The topology dossier's line citations were invalidated by its own PR

`agents/evidence/analysis/topology-followups-disposition-evidence-2026-09-01.md`
pins every citation to commit `468eeefc7` and says so. PR #1790 then executed the
corrections the dossier recommended, which added 30 lines to the receiver and
13-26 to each stub — so a reader in the working tree following e.g. "Receiver
`:144-145`" now lands on a checkbox rather than the sentence being quoted.

Disclosed in principle by the commit pin, undisclosed as a consequence. Fix by
adding a second column of current-tree line numbers, or by stating the offset
once at the head of the citation list.

## 3. Two bare `file:line` ranges name no file

- `stubs/road-to-council-topology-instrumentation.md:164-166` — the Group 3
  forbidden-claims section cites `1B.1` at `:865-883` and `1B.4` at `:978-984`
  with no file; the archived-parent path appears only in the Group 2 section
  sixty lines above.
- `stubs/road-to-provider-leakage-bench-execution.md:128-131` — the 3.4 range
  `:1270-1296` starts on a pre-existing 2026-08-30 note rather than on the
  `[~]` block it cites (which begins at `:1282`) and ends mid-sentence.

Both are in files already merged to `main` via #1790, so they need their own
change rather than an amendment.

## Not in scope

Anything about the `merge-authority` blocker, step 0.8, or AC-9. Those are
owner-reserved and are recorded in the roadmap itself.
