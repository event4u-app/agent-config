# Findings: blocker-gate-scans-stubs
<!-- completion-review: v1 | reviewed: 2026-09-28 | scope: c067709b17cce17a772d98917eace1c95762d72fd8174d1b8a28729425b0bb32 | diff: b4f175167550e2944de4e91b3cc4001f880054cb | reviewer: independent-subagent-blocker-gate-scans-stubs -->

<!-- context-manifest: v1
inputs:
  diff_sha: 254bf5596f00438b1cdbd2aeca1f0c533f6ac458
  scope_hash: c067709b17cce17a772d98917eace1c95762d72fd8174d1b8a28729425b0bb32
  roadmap: agents/roadmaps/road-to-the-substrate-stub-meeting-its-open-gate.md
  roadmap_hash: 60113114a7ad92ecf16377cb2ba5ebdc40796b80bf72654a1f9fa9477bbcaffd
  ac_hash: cf760b64b0a1882fb3462246fdf4b3983efe49bcd5f3a0d8daddfe190cdac386
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-09-28T13:00:00Z
-->

<!--
Manifest honesty note, because two of its fields do not mean here what they
mean on a dispatcher-produced artifact.

`tools:` is the fixed literal the §5 parser requires. The reviewer actually had
more than those two: it executed gates and built sabotaged copies of the module
under review to measure test sensitivity. That is a SUPERSET, never a subset —
nothing in the declared pair was withheld — but the field cannot express it.

`roadmap_hash` and `ac_hash` are computed here over the roadmap as it stands at
the artifact commit, using `extractAcceptanceCriteria` from
`dispatch_r2_reviewer.ts` rather than a reimplementation. The reviewer was NOT
handed an extracted acceptance-criteria file; it was pointed at the roadmap and
asked to re-derive its measurements from the tree, which it did (see § What the
reviewer confirmed). So the hashes verify the artifact against the roadmap; they
do not attest that an AC extract was delivered as an input.
-->

## Independence

The reviewer is a separate agent that did not write the change. It was given the
whole branch delta against `origin/main` with an instruction not to narrow it,
and no statement about the expected outcome — the prompt asks for findings and
says nothing about how many there should be, in either direction. The prompt is
recorded verbatim below, because a recorded verdict whose prompt cannot be
inspected is not checkable evidence.

The reviewer read the delta at `254bf5596` (3 commits). Two further commits
landed in response to its findings, so the scope hash above is later than the
`diff_sha` it reviewed; the delta between them is the fixes listed under
Disposition and nothing else.

### The prompt, verbatim

> Review a code change in the repository at `<worktree>` (a git worktree; run
> all commands from there, do not cd elsewhere).
>
> Scope: the complete diff of the current branch against origin/main. Get it
> with: `git -C <worktree> diff origin/main...HEAD`. Review every changed file
> and every changed hunk. Do not narrow the scope.
>
> You did not write this change and you are not its author. Report what you find.
>
> Questions to answer:
> 1. Correctness. Does the code do what its own comments and commit messages say
>    it does? Name any place where behaviour and description diverge.
> 2. Blast radius. The change widens the file set that a linter
>    (`src/scripts/lint_roadmap_blockers.ts`) judges. Find every other module,
>    gate, test or ledger that consumes the changed exports or depends on that
>    file set, and say whether each is affected. Search the tree; do not rely on
>    the change's own claims about its blast radius.
> 3. Test quality. Do the new tests in
>    `tests/scripts/lint_roadmap_blockers.test.ts` actually discriminate — would
>    each one fail if the production change were reverted? Are any of them
>    tautological or passing for the wrong reason?
> 4. Claims. The roadmap file
>    `agents/roadmaps/road-to-the-substrate-stub-meeting-its-open-gate.md`
>    records measurements (file counts, violation counts, ratchet states).
>    Re-derive them yourself from the tree and report any that do not reproduce.
> 5. Anything else a reviewer of this repository would raise.
>
> Report findings as a list. For each: file:line, what is wrong, and how
> load-bearing it is. If a question has no findings, say so for that question.
> Do not fix anything.

## Findings

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | `agents/roadmaps/road-to-the-substrate-stub-meeting-its-open-gate.md:316` | Flipping AC-4 to `[x]` takes the roadmap to 18/18, which makes `update_roadmap_progress --check --untracked-mode` exit 1 ("Completed roadmaps are still in `agents/roadmaps/`"). `archive_completed_roadmaps.ts:669` refuses to archive a roadmap with an open blocker; `unarchived_complete` (`update_roadmap_progress.ts:904`) filters on step counts with no blocker carve-out. One gate demands what the other forbids, and the only exits are resolving the blocker or reopening a closed step. | accepted-risk | Reproduced independently: `--check` exit **1**, `--dashboard-only` exit **0**. Not repaired: exempting a class from the estate check lowers a recorded floor → owner-reserved. `dashboard_mode.ts:160-172` excludes the estate half from required CI *by design*, on a recorded 2026-08-22 failure, so nothing is merge-blocked. Recorded as a parseable obligation on the blocker that closes it (`the-governance-conditions-are-a-supervision-read` → `Blocks:` and `If you do nothing:`), not as prose. |
| 2 | medium | `src/scripts/lint_roadmap_blockers.ts:44-59` | The SCOPE claim "every future stub blocker is held to the contract from its first line" overstates reach by a third: both scanners require the entry under a `## Blockers` heading, and 2 of the 6 stub blockers sit under `## State`. Stub headings are free-form, so this is the likely shape, not an edge case. | fixed | New REACH paragraph states the limit and routes it to `road-to-blocker-parse-visibility.md`. Verified independently: `road-to-kernel-clause-1-restore.md` and `road-to-preamble-transfer-debt-221.md` have no `## Blockers` section (`grep -c` → 0 each). (5857ef107) |
| 3 | medium | commit `a1e47cd28` message | "All four observed failing against the unwidened gate" is literally true but implies more than it measures: 2 of the 4 fail against `origin/main` only because `_globRoadmaps` took no root argument there, not because of the scope. | fixed | Re-measured with the parameter kept and `SCANNED_SUBDIRS` emptied: **3 of 5** scope tests fail on a true scope revert. The corrected figure is in the follow-up commit; the remaining two discriminate against a *further* widening and against losing `_globFlat`'s missing-directory guard, which is stated rather than claimed as scope sensitivity. (5857ef107) |
| 4 | medium | `src/agent-src/scripts/stubs_due.ts:179-204` | Two parsers now read `stubs/` with different reach and no shared grammar: `count_owner_decisions` matches `### blocker:` anywhere in the file, the gate only under `## Blockers`. Concrete divergence: `road-to-kernel-clause-1-restore.md:26` counts for the dashboard and is invisible to CI. | accepted-risk | Real and pre-existing — the looser parser predates this change, and unifying the grammar is the subject of the sibling defect stub. Recorded in the gate's REACH paragraph and in the stubs README caveat so neither count is read as the other. |
| 5 | medium | `agents/roadmaps/stubs/README.md:16-20` | The canonical "which gates apply to stubs" statement was not updated. A stub author gets no notice that a `### blocker:` is now CI-enforced at zero ratchet headroom — which is exactly risk 7's failure mode, and the test that pins the scope does nothing for that person. | fixed | README gained the gate note: the five hard fields, the zero-headroom decidability ratchet, and both caveats (`## Blockers`-only reach, `stubs:due` looser rule). This is the Doc-Impact surface the change owed. (c7d5debdc) |
| 6 | low | `src/scripts/lint_roadmap_blockers.ts:7` | The `code-comment-allow provenance-comment` marker suppresses nothing — the detector matches `agents/roadmaps/` and the line it sat on carries only `` `stubs/` ``. A gratuitous exemption in a gate's own header. | fixed | Verified by removing it: `lint_code_comments` stays green. Removed. (5857ef107) |
| 7 | low | `src/scripts/lint_roadmap_blockers.ts:26-30` | Rule 4's paragraph still argued from "no **active** roadmap carries a checkbox annotation" and named only `later/` and `archive/`. | fixed | Re-measured over `stubs/`: 7 files carry checkboxes, **0** carry a `blocked-by:` marker, so the rule stays latent there. Paragraph now names `skipped/` too and says `stubs/` is in scope. (5857ef107) |
| 8 | low | `src/scripts/lint_roadmap_blockers.ts:91,612` | `ROADMAP_GLOB` held `{,stubs/}` — a bash-only empty alternative in a display-only string; its one consumer printed "no active roadmaps" for a scope that is no longer active-only. | fixed | Two plain globs; message reads "nothing in scope". (5857ef107) |
| 9 | low | `src/scripts/check_release_holds.ts:48` | Comment described its folder set as "wider than `lint_roadmap_blockers`' active-only glob" — no longer true. | fixed | Corrected in the same change, per Doc-Impact. (c7d5debdc) |
| 10 | low | `tests/scripts/lint_roadmap_blockers.test.ts` (gap) | Nothing tested the consequence the header itself calls out: `_archiveOverlap`'s ACTIVE corpus now includes `stubs/`. Every existing overlap test passes both corpora explicitly, so the widened **default** was uncovered. | fixed | Test added driving `_globRoadmaps` into `_archiveOverlap`; observed failing with `SCANNED_SUBDIRS` emptied. (5857ef107) |
| 11 | low | roadmap measurement | "121 stubs" counts `stubs/README.md`, which is not a stub. | fixed | Corrected to "121 files (120 stubs plus the directory README)" in both the gate header and AC-4. The derived figures (6, 4, 0/0/0) are unaffected. (5857ef107) |
| 12 | low | `src/scripts/lint_roadmap_blockers.ts` | `_globRoadmaps` no longer returns a globally sorted list (per-directory sort, then stubs appended). Sorted today only because every active file starts `road-`. | accepted-risk | The removed docstring's "Sorted" claim went with it, so nothing is falsely documented. Ordering is cosmetic here — the gate's output order and `_openIdIndex`'s "input order" contract carry no assertion. Not worth a sort pass over 131 paths on the pre-push path. |
| 13 | low | `tests/scripts/lint_roadmap_blockers.test.ts` | Redundant `as string[]` casts — `_globRoadmaps` already returns `string[]`. | accepted-risk | Left in place: tests are outside `lint:ts`'s glob and the casts are inert. Removing them is churn on lines this change is otherwise done with. |

## What the reviewer confirmed rather than faulted

Every measurement in the roadmap reproduced independently — the 121/6/4 split,
`0` hard violations, `0` ratchet additions, `0` archive overlaps, `131 clean`,
`check_estate_count` `+0` on all six metrics, the `:decidability` ratchet having
literal zero headroom, and the five-field deletion probe at **5 of 5**. The
reviewer also re-ran fourteen gates green, and established one thing the change
did not claim: both unreachable stubs carry all five required fields plus both
decidability fields, so they would pass if the parse defect were fixed.

## Honest residual

Finding 1 is open by design and is the one thing a reader should carry away: the
roadmap does not archive, and the estate half of `task ci` is red on it until the
maintainer rules on `the-governance-conditions-are-a-supervision-read`. Required
CI is green. Findings 4 and 12 are accepted, not fixed, for the reasons given.
