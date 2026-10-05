# Completion review — draft-roadmap promotion and archival screen, 2026-10-05

**Skipped:** no code surface for this completion — two roadmap files, each gaining one dated disposition note recording a promotion and archival screen; the validator reports 0 code path(s) of 2 changed file(s), scope 05c3da6f3806d9d535df7ccc5093376ba8d0c8c024d30a38cd524f7ddf324864, declared 2026-10-05

## What this change is, and why R2 has nothing to bind to

Both changed files are roadmaps — `road-to-adversarial-verification-and-long-runs.md`
and `road-to-trigger-eval-freshness-has-no-writer.md`. No script, schema, config,
workflow or projection is touched, so `task sync` and `task generate-tools` have no
input here. An R2 reviewer over this diff would be reading two blockquotes of
measurement prose. That is the shape § 2.4 names.

Nothing moved. Neither file was promoted, neither was archived, and no checkbox,
blocker status or decision row changed. What the diff adds is the evidence a later
session would otherwise re-derive for a fourth time.

## What a reviewer WOULD have caught, recorded here rather than hidden

**1 — the brief's own premise about the promotion gate was wrong, in both
directions, and the correction is the finding.** The screen was commissioned on the
expectation that `lint_decision_classes` reds a roadmap carrying an `OPEN` owner
decision. Executed against a simulated `status: ready`, it does the opposite of that
on both files: it is **clean** on `road-to-trigger-eval-freshness-has-no-writer.md`,
whose `D3` row literally reads `**OPEN.**`, because `dischargeRanges()` treats
`## Decisions` and `## Blockers` as the discharge record rather than the defect; and
it **reds** on `road-to-adversarial-verification-and-long-runs.md`, which carries no
`## Decisions` section at all, on the phrase "the open question" inside narrative
prose at line 181. So the gate fired where no decision was open and stayed silent
where one was. Both readings were taken with a control — `checkFile('m.md',
'status: ready\n\nPick the codec: TBD\n')` returns 1 violation — so the clean result
is a measurement rather than a mis-wired probe.

**2 — the real promotion block is a different gate, and it was nearly missed.**
`check_estate_count` reds the promotion of either file: `active_roadmaps 11 → 13`,
`open_blockers 60 → 62` against the `origin/main` floor. `lint_plan_risk_register`
was checked in the same pass because promotion lifts a `draft-exempt` and could have
tripped it; it stays clean, which is reported because a null here is as load-bearing
as a red.

**3 — the archival trap was located rather than assumed.** "A completed `draft`
roadmap never archives" is a recorded trap in this tree; the gate that enforces it is
`collect()` in `update_roadmap_progress.ts`, skipping any `status` in
`UNSCHEDULED_VALUES`, and `archive_completed_roadmaps.ts` iterates exactly that. The
claim was proven in both directions rather than by reading the code: `collect()` over
the live roadmap root returns 11 roadmaps with both files ABSENT, and over a scratch
copy with the one line flipped returns them PRESENT. Without the second half, the
sweep's `ℹ️  No completed roadmaps to archive.` would have read as a verdict on these
files instead of silence about them.

**4 — step 4 of the brief had no committed half to do.** It asked for the archive
index (`INDEX.md`, `index.json`) to be regenerated in the same commit as any move.
Both are gitignored — `.gitignore:126-127`, confirmed with `git check-ignore -v` —
and the precedent archival `901e8bc4e` is a pure `git mv` of one file with zero
insertions. There is no index half to miss, and the instruction's "check which half is
missing" is answered by neither being committable.

**5 — one true statement in the diff's neighbourhood was left alone, and one false
one was corrected.** The trigger-eval roadmap's 2026-10-05 note quotes its `D3` row at
line 181; the row has since moved and the citation is now wrong as an offset while
true as a quotation, so the new note says to re-execute against the row text rather
than the number, and does not rewrite the dated quotation. Separately, the first draft
of that note asserted "now at line 278", which the note's own insertion immediately
falsified — caught before commit and replaced with the content anchor.

## What this change deliberately does NOT do

No file moved and no status flipped. The remaining distance on both roadmaps is
owner-reserved by three independent routes: an `OWNER-DECISION` record the archival
sweep emits for each, an open `Class: 3 — human-only` blocker in each, and — for
`road-to-trigger-eval-freshness-has-no-writer.md` — its own frontmatter reserving
promotion to a maintainer. No preference between the owner's options was written
anywhere, and no gate, baseline or ratchet was touched to make a verdict more
convenient.
