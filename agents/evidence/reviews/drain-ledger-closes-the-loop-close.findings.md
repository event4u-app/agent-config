# Completion review — closing the ledger roadmap by carrying its one unreachable step

**Skipped:** no code surface for this completion — one roadmap read and annotated with a measured window reading, two of its items flipped to the carry glyph against a validated back-link, one archival move and two inbound-reference rewrites; the validator reports 0 code path(s) of 4 changed file(s), scope d4ff441d1b74a4c31df65f63651b4a3864eaee9967b98d2282fb0f2d8ba28e07, declared 2026-10-01

## What this change is, and why R2 has nothing to bind to

Every changed file is a roadmap. No script, hook, concern, schema, test or
config is touched, and in particular **no code able to refuse is added** — which
is the one property the pre-registered bar this roadmap carries depends on, so
it is stated rather than left to the file list.

The change is a disposition, not an implementation: the roadmap
`road-to-a-ledger-that-closes-the-loop` had 24 of 26 steps closed and all four
blockers resolved, with step 6.1 and AC-6 waiting on a pre-registered shadow
window that needs `>= 30 calendar days AND >= 50 affected sessions AND >= 100
shadow rows`. Measured 2026-10-01 from the `docs/CLAIMS.md` clause-(9) boundary
at `5c9415258`: calendar 1.15 of 30, sessions 3 of 50, shadow rows 0 of 100.
Neither measure is compressible by effort, and clause (2) forbids manufacturing
rows. The two items are therefore carried to `road-to-a-stop-that-holds`, which
already holds them verbatim as its 3.3 and 3.4 under a `parent_roadmap:`
back-link, and the file is archived.

## What a reviewer WOULD have checked, done here instead

The archive was taken by `src/agent-src/scripts/archive_completed_roadmaps`
rather than by hand, because that sweep is the thing that actually validates a
carry: it fails closed on a bare `[~]`, on a malformed annotation, on a
destination that does not exist, on one that is itself archived or skipped, on a
self-reference, on a destination being archived in the same sweep, and on a
missing `parent_roadmap:` back-link. It reported `Archived … (1 ref(s)
migrated)`, and `check_estate_count`, `build_archive_index` and
`task check-archive-index` are green behind it.

Two things were checked that no gate checks, and both are recorded rather than
assumed:

The **fourth boundary candidate**. The previous reading enumerated three commits
after the clause-(9) pin and concluded no claim edit was owed. A fourth exists —
`b8a7037e3`, which touches both `obligation_settle_hook.ts` and
`rule_inject_hook.ts` — and it was read rather than counted: its whole diff on
those two files swaps locally-declared `EXIT_ALLOW` / `EXIT_WARN` constants for
an import of the same values, 2 insertions and 5 deletions, with none of the five
exposure surfaces clause (2) enumerates moved. So clause (9) stands as filed and
`docs/CLAIMS.md` is deliberately unedited by this change.

The **mtime trap**, which is live in this reading. One ledger
(`8da0688f4a3782b1bfc3e75f3db3860b.json`) straddles the window boundary, so a
file-level count reads four in-window ledgers against three in-window sessions.
The figures above are counted by row `at`.

## The open gap, named rather than papered over

Nothing in the tree verifies that a carried item's copy at the destination is
*faithful* — the sweep's own docstring says so, and says why: no stable item
identity exists, so the back-link plus the slug mention is the strongest link it
can verify. The faithfulness of `road-to-a-stop-that-holds` 3.3 / 3.4 against
this file's 6.1 / AC-6 was read by hand for this change and holds, including the
arming mechanics the receiving file adds and this one never had. A later reader
checking it has to read it the same way.
