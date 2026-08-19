# Completion review — the two Iron-Law-3 holdouts

**Skipped:** no code surface for this completion — roadmap glyph resolutions, one migrated follow-up carrier, two archival moves and their regenerated dashboard and archive index; the validator reports 0 code path(s) of 10 changed file(s), scope 66b7bc07dc629f21345cd499840f22919d40a73b2901531e1e9c5ed9e560891e, declared 2026-08-19

## What this change is, and why R2 has nothing to bind to

Every changed file is a roadmap, a generated roadmap projection, or an evidence
record. The decision content — which of two deferred items is future work and
which is a specification defect — was **already adjudicated by an AI council**
(anthropic + openai, 2 of 2 present, one round, 2026-08-19), and the decisive
premise of the winning argument was verified against the tree before adoption
rather than taken on the seat's word: `[x]` on the top-band criterion would have
asserted "no `.md` names a vendor model", and 160 `.md` files do.

An R2 reviewer over this diff would be reading two glyph flips, a migration note,
a new park note and two renames. That is the shape § 2.4 names.

## What a reviewer WOULD have caught, recorded here rather than hidden

The first archival commit (`e74b99d66`) archived both roadmaps with their `[~]`
glyphs still in place, under a message claiming the glyphs were corrected. The
edits existed in the working tree and not in the index: they were made on the
ACTIVE path, `archive_completed_roadmaps` then ran `git mv`, which stages the
rename against HEAD's content — so git recorded a 100 % similarity rename, which
is the tell that the edit is not in the commit.

`affc36c4a` is that correction, shipped as its own commit rather than an amend.
It is named here because a skip declaration must not read as "nothing was worth
reviewing": something was, it was caught, and the catch is in the history.

Neither `roadmap:progress` nor the roadmap lints would have found it —
the former reads the working tree, and the archived tree is outside the
latter's corpus. The sequence edit → `git mv` → selective `git add` has no gate
on it, and that is stated as an open gap rather than papered over.
