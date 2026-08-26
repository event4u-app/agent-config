# PR-drain run summary — 2026-08-26

One row per pull request the run touched, in the order the queue produced them.
The queue was recomputed after every merge, which is why the ordering is not
monotonic in PR number: **four PRs (#1670–#1673) and three more (#1674–#1677)
were opened by other sessions while the drain was running**, so the queue grew
twice before it emptied.

Method per PR: `git fetch` → `gh pr checkout` → `git merge origin/main`
(never a rebase) → resolve → regenerate every generated artifact → push → wait
for CI in the **foreground** → merge. Waiting in the foreground is not a style
choice: a background wait produces a task notification, the notification counts
as a prompt, and the prompt rewrites the git-authorization ledger to
`authorized: []` mid-run.

## The run

| # | Queue pos | Sync conflicts + resolution class | CI iterations | Disposition |
|---|---|---|---|---|
| 1493 | pre-run | — | — | merged before this run |
| 1488 | pre-run | — | — | merged before this run |
| 1480 | pre-run | — | — | merged before this run |
| 1489 | pre-run | — | — | merged before this run |
| 1482 | pre-run | — | — | merged before this run |
| 1499 | pre-run | — | — | merged `dd6a144` before this run |
| 1668 | 1 | none — clean auto-merge, twice (`main` moved mid-flight) | 2 | **merged** `580cb11` |
| 1666 | — | — | — | **merged** `7a91be7` by a parallel session |
| 1667 | — | stacked on #1666's branch, not on `main` | — | **merged** `5dcb6c5` with its base |
| 1672 | 2 | none; branch held by another worktree, so synced **detached** and pushed to the ref | 1 | **merged** `0fcec0f` |
| 1670 | 3 | none — clean auto-merge | 1 | **merged** `d2a4fef` |
| 1674 | 4 | none — clean auto-merge | 1 | **merged** `2d7cca0` |
| 1671 | 5 | none — clean auto-merge | 1 | **merged** `e6fdfd4` |
| 1669 | — | synced clean, 0 conflicts | — | **merged** `1899f92` by a parallel session while awaiting authorization |
| 1673 | 6 | none | 3 | **merged** `387dd3e` |
| 1676 | 7 | none | 1 | **merged** `82e47ce` |
| 1661 | 8 | **83 conflicts** — 76 stubs, 4 code files, 1 metrics file, 1 add/add archive | 1 | **merged** `9e8344a` |
| 1677 | 9 | none — already current | 0 | **merged** `15447f4` |
| 1675 | 10 | 1 conflict (`docs/decisions/INDEX.md`, generated) | 5 | **twice-exhausted, diagnosis on the PR** |

**11 merged this run. One left open, deliberately.**

## Conflict resolution, by class

**Generated artifacts — regenerated, never hand-merged.** `docs/proof.md`,
`agents/roadmaps-progress.md`, `docs/decisions/INDEX.md`, `docs/catalog.md`,
`agents/index.md`, `agents/reports/skill-overlap.json`, the ADR evidence census
and the `.md` projections. Every merge was followed by a regeneration pass; in
all but three cases the regeneration produced an empty delta, which is the
evidence the merge was already correct.

**#1661's 83 conflicts, resolved by class rather than by file:**

- **67 stubs** — pure `review_by:` date collisions. `main`'s later date wins; a
  parked stub's next-read date is a maintained field, not a branch contribution.
- **9 stubs** — `review_by:` (main) plus `probe: none` (branch). **Union**: the
  branch's real contribution is the `probe` field, and the date is main's.
- **`road-to-owner-authority-decisions.md`** — both sides added "unresolved
  decisions 5–8". Not a union: the same four decisions, and **main's version is
  strictly richer** — it carries provenance corrections, per-decision
  owner-reserved reasoning, and it demonstrates the branch's own Decision 8
  premise to be stale (`0/2 slots used` against the branch's "third in a queue
  of two"). Main's side taken whole.
- **`_dispatch.bash` + `src/cli/registry.ts`** — the auto-merge **silently
  duplicated** `stubs:due`: once in the help text, once in the `case` block, once
  in the registry. `registry.ts` reported **no conflict at all**, and the
  duplicate only surfaced because the pinned counting method read 110 against a
  budget of 109. A clean auto-merge of a generated or list-shaped file is not
  evidence of a correct merge.
- **`evaluator-budgets.json`, `evaluator-measurements.json`, both
  `update_roadmap_progress.ts`** — main's side; its `109` already accounted for
  both verbs, the branch's `108` for only one.
- **add/add on the archived roadmap** — archived end-state wins; both sides
  carried the same 10 checked boxes, so no completion was lost.

## Root-cause fixes made to get CI green

None of these was a threshold move.

- **#1673** — regenerated a stale ADR evidence census (twice: the second run was
  caused by the first fix); added the missing `## Evidence` section to ADR-247;
  repaired a `lint_canonical_terms` regression that had entered on **`main`**
  via #1669 (two `behaviour` occurrences in
  `docs/contracts/installed-tools-lockfile.md`), isolated by running the linter
  on `e6fdfd49d` versus `1899f92b9`.
- **#1675** — see the PR comment; four gates repaired, three left.

## The one PR left open

**#1675 `drain/evidence-gated-change`** — twice-exhausted, full diagnosis posted
on the PR. CI went 10 → 7 failing checks, and the 7 are 3 causes across 6 test
shards. All three are the author's decision because each has only two exits, a
threshold move or a content deletion:

1. `check_preamble_payload_budget` is **347 tok** over a grace ceiling whose
   config states it *"may never move UP"*. The branch's remaining rule growth is
   exactly those 347 tok, after everything movable was already extracted to a
   guideline.
2. `lint_skill_descriptions.test.ts` pins `(0 clustered)`; the branch's TDD body
   additions genuinely cluster, and the branch **already records that as
   structural** with a 2/2 council disposition in the overlap allowlist.
3. `audit_skill_overlap.test.ts` pins an empty allowlist — the same decision as
   (2), seen from the other side.

(2) and (3) are one decision; (1) constrains how it can be answered, because the
sibling-routing clause that clears the linter costs payload there is none of.

## Dropped edits

One, named rather than buried: **#1661's shorter version of "unresolved
decisions 5–8"** in `road-to-owner-authority-decisions.md`. Dropped in favour of
main's longer version of the same four decisions, which supersedes it on
content — see the conflict-class section above.

## What the run cost that was not PR work

- **Two authorization stalls.** The ledger is rewritten by every prompt, and a
  short prompt with no git prose (`mach weiter`, `1`) resets it to
  `authorized: []`. The 6h TTL does not help: the failure is overwrite, not
  expiry. A re-authorization must itself contain the word.
- **One self-inflicted loss.** Checking out `origin/main` to take a comparison
  measurement **discarded a conflict merge in progress** — during a conflicted
  merge `HEAD` is still the pre-merge commit, so the SHA saved beforehand did not
  point at the merge. Redone from scratch; no work lost, because every fix was
  reproducible from a script. Measure on a second worktree, or from `git show`,
  never by moving the ref you are standing on.
- **One false green.** `ci_settle` reported `SETTLED GREEN` seconds after a push,
  reading the *previous* head's checks. Verified against `headRefOid` afterwards
  and found all 34 checks still queued. Every green in the table above was
  confirmed against the head SHA.
