# Findings: drain-recurrence-count
<!-- completion-review: v1 | reviewed: 2026-09-12 | scope: 4cb490526934be9168ff268e6c259e377fc469e3d6e9e8e65e26bfcf9cb33d50 | diff: 238e299b2022977fb43921ea1efe194fa334a082 | reviewer: r2-fresh-subagent-drain-recurrence-count | prompt_hash: 213c4a5625fbce414bb60e59f5e47e13b6fac98e54d5965e05666ddf62c2d791 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-recurrence-count"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-09-12 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 238e299b2022977fb43921ea1efe194fa334a082
  scope_hash: 4cb490526934be9168ff268e6c259e377fc469e3d6e9e8e65e26bfcf9cb33d50
  roadmap: agents/roadmaps/archive/road-to-a-recurrence-count-that-survives-the-round.md
  roadmap_hash: 8693d88893b04a96002c1c6772291d1925b7094dcb7627b71afd179148c683f4
  ac_hash: 34cc06f4420dcafeea50bf34c0587d2d6b098387733b409a4b1c1bb6d0deca14
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-09-12T04:35:16Z
-->

Round 2. Round 1 is archived at `drain-recurrence-count.round1-review.md`, every
row terminal, per contract §2.7. This artefact binds the content as it ships
after the fix commit `cccba14f2`; the rows below are new findings only. Round 1's
eight are not restated — five verified as holding, two deferrals and one
accepted risk re-checked, all reported under "Round 1 re-verified" below.

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/check_held_object_arrivals.ts:180 | An ABSENT citer root is reported as a failed measurement, and the fix's own test pins that as intended. `listMarkdown` returns `readable: false` for every `readdirSync` failure, and ENOENT is one — so a citer root that was never created is indistinguishable from one that moved or is permission-denied, and :238 exits 2 with `citer root(s) unreadable: … moved or inaccessible` on every path including advisory. `agents/roadmaps/later` is a citer root, and git cannot track an empty directory: "nothing is currently parked" is expressed on disk as an ABSENT `later/` in any clone that has no placeholder file. That is precisely the estate state the fix set out to protect — its own rationale at :43-46 names "`later/` is empty whenever nothing is parked" as legitimate — so the fix separated empty-from-unreadable and then folded absent back in with unreadable. Reproduced on a synthetic root with `stubs/road-to-held.md` populated and `later/` never created: `scan` returns `deadCiterRoots: ["agents/roadmaps/later"]` and `check` exits 2 in BOTH enforce and advisory mode, where the same estate with an empty-but-present `later/` exits 1 with the normal firing. The held guard does not mask it, because `stubs/` alone keeps `res.held` above zero. Reachable through the tool's own documented interface: `--root DIR` is in the usage line at :357, so a consumer estate or a subtree is a supported target, not a hypothetical one. The test at tests/scripts/held_object_arrivals.test.ts:384 produces its "unreadable" root with `rmSync(later, recursive)` — it DELETES the directory — so what the suite actually asserts as correct is the false positive; and `estate()` at :67 creates `later/` unconditionally, so the absent case cannot be expressed in the suite at all. | fixed | Fixed in `238e299b2`. Three states, not two: `listMarkdown` now reads ENOENT/ENOTDIR as `readable` (nothing there to read IS the answer, and git cannot track an empty directory) and only a present-but-unreadable root blocks. The test that pinned the false positive was rewritten to cover empty, absent and unreadable separately, and mutation-proven: restoring the over-corrected form turns it red. |
| 2 | low | src/scripts/report_held_object_arrivals.ts:351 | Two of the five fixes shipped with no test, in a commit whose message foregrounds proven sensitivity. Neutralised in turn and the suite stayed 29/29 green for both: restoring the original positional filter (`!a.startsWith('--') && !argv[i-1].startsWith('--')`) over the `VALUE_FLAGS` form at :351-354, and replacing the unreadable-tree guard condition at :404 with a constant `false`. Each mutant is the original defect rather than a paraphrase — the first re-breaks `-i <slug>` and `--list <slug>`, the second re-prints `0 distinct round(s) of 0 examined` for a tree that stats but cannot be listed — and neither turns anything red. Both fixes are behaviourally correct today (verified through the real entry point; see the re-verification section), so this is unknown sensitivity, not a broken fix: either can be reverted by a later edit with nothing going red. Distinct from round 1's deferred finding 6, which named the reporter's PRE-EXISTING defensive branches; these two branches were added by the fix round itself, and the commit message's "Sensitivity proven rather than assumed" is true of the citer-root fix only. | fixed | Fixed in `238e299b2`. Both untested fixes now have a test, and the finding's sharper half is accepted rather than argued: the round-1 commit message foregrounded proven sensitivity when one of its two new tests was a tautology — its exit 2 came from the pre-existing held guard, and its own comment conceded it. Replaced with the citer-only shape. All three fixes were mutation-proven this round, each neutralised in turn and seen red. |
| 3 | low | src/scripts/check_held_object_arrivals.ts:233 | The comment above the new guard states a rule the code does not implement — the same defect class as round 1's finding 8, reintroduced by the commit that closed it. Its first sentence reads "A citer root listing zero markdown files is a scan that could not read where the citations live", which is the stricter first attempt the commit message records as abandoned ("The first fix was too strict and a test caught it"). The shipped rule is `readable`, not the file count: a citer root that lists zero markdown files and IS readable produces an empty `deadCiterRoots` and passes, which the test at tests/scripts/held_object_arrivals.test.ts:379-381 asserts deliberately. A reader auditing why an empty `later/` does not fire would conclude from this comment that it does — the inversion round 1's finding 8 was filed for, one guard further down the same function. | fixed | Fixed in `238e299b2`. The guard's comment described the abandoned stricter rule. Named in the commit message as round 1 finding 8's defect class reintroduced by the commit that closed it, because that is the part worth remembering. |
| 4 | low | src/scripts/check_held_object_arrivals.ts:153 | The fence fix trades a loud latent false positive for a silent latent false negative, using the parity approach this repo has already recorded as unworkable. the toggle flips `inFence` on any line whose first non-space characters are a triple backtick or a triple tilde, so an UNCLOSED fence leaves `inFence` true to end of file, and every subsequent line is `continue`d — including a real `## Blockers` heading and the citations under it. Reproduced: a citer whose Phase 1 opens a fence that is never closed, followed by a genuine `## Blockers` section citing `stubs/road-to-held.md`, returns an empty set from `blockerCitations`, where the pre-fix scanner returned `road-to-held.md`. The result is the check reporting "all carrying an arrival line" over a citation it could not see — the silent-green shape of round 1's finding 1, with no guard behind it this time, since a swallowed file is indistinguishable from a file with no blockers. The same toggle also makes the tilde and backtick forms interchangeable, so an odd number of inner backtick markers inside a tilde-wrapped illustration inverts the state — the exact arrangement this repo's `markdown-safe-codeblocks` rule prescribes for nesting. Measured blast radius today is zero: 0 of 100 citer files under `agents/roadmaps` and `agents/roadmaps/later` end with fence state open, so no current firing or non-firing comes from this. Named because the sibling implementation in src/scripts/check_completion_review.ts:460-482 documents this identical hazard, states that "patching parity, then pairing, then the next arrangement is a losing game", and fixes the discriminator instead — requiring a LABELLED opener so that no arrangement of bare fences can swallow content. `blockerCitations` implements the approach that file rejects. | accepted-risk | Real, unfixed, and bounded by measurement rather than by argument: an unclosed fence swallows the rest of a citer file, a silent false negative. Blast radius measured at 0 of 100 live citer files. Not patched because the finding itself cites `check_completion_review.ts:460-482`, where this tree already recorded parity-patching a fence scanner as a losing game and fixed the discriminator instead. Trading a loud latent false positive for a silent latent one is a real cost and is recorded as accepted, not as closed. |

## Round 1 re-verified

Each claim was checked against the code rather than taken on trust. All five
fixes HOLD; three of them raised the new findings above, none of which
invalidates the repair itself.

**Fix 1 — dead citer root — HOLDS.** `listMarkdown` at :100-119 returns
`{files, readable}`, `scan` at :178-181 collects unreadable citer roots, and
`check` at :238-244 exits 2 before the affirmative-green branch. Guard ordering
checked as asked: `res.held === 0` at :228 runs FIRST, which is correct rather
than a masking bug — a collapsed held corpus is the wider failure and its
message is the more specific one; the citer guard is reached in exactly the
asymmetric case round 1 described, where `stubs/` stays readable and a citer
root does not. Sensitivity proven by mutation: restoring the swallowed-error
form (`readable: true` in the catch) turns "separates an empty citer root from
an unreadable one" red and nothing else. The `allowEmpty` note at :222-227 now
reads "Both the held corpus and every citer root are asserted separately below",
which matches what the two guards actually assert — the round 1 complaint about
that note is answered. Finding 1 above is a false-positive mode this fix
introduced, not a failure of the repair.

**Fix 2 — positional parser — HOLDS.** `VALUE_FLAGS` is complete: `--pattern`,
`--tree` and `--root` are the only three value-taking flags in the file
(`arg('--pattern')`, `arg('--tree')`, and the `indexOf('--root')` read in
`main` at :447, which does not strip its value before `report` sees the argv).
`--ignore-case`/`-i`, `--list`, `--help`/`-h` take none. Both documented
spellings verified through the real entry point: `report_held_object_arrivals
-i road-to-worker-generation-recycling` resolves the object and prints the
pattern with the `/i` flag, and `--list road-to-worker-generation-recycling
--tree /tmp/absent-xyz` resolves the object instead of exiting 2 on the usage
line. The two regressions worth checking do not occur: a `--pattern` value that
itself begins with a dash was already excluded by the leading-dash test rather
than by the flag lookup, and the only behaviour the stricter `startsWith('-')`
newly rejects is a held-object ref beginning with a single dash, which no
member of the held corpus has and which the resolver could not address anyway.

**Fix 3 — unreadable-but-stattable tree — HOLDS.** Verified through the real
entry point against a mode-0300 directory: the output is the
no-reading-was-taken block, the resolution line reads `(via --tree, but not
listable)` so the cause stays distinguishable from an absent tree, and no
count is printed. Exit 0, matching the absent-tree branch. The condition at
:404 is correctly narrow — a tree with some readable and some unreadable
members keeps `examined > 0` and still gets its count plus the `note:` line,
so the fix does not swallow partial readings.

**Fix 4 — fence-blind blocker scope — HOLDS for the case it names.** A fenced
`### blocker:` example yields zero citations and the real heading still opens
scope; mutating the toggle to a constant `false` turns "does not open blocker
scope from inside a code fence" red and nothing else. The specific sub-cases
asked about: indented fences are handled (`^\s*`), `~~~` is handled as a
marker, and a fence inside blocker scope does NOT close that scope — a fenced
`## ` heading is skipped, so scope stays open past it, where the pre-fix
scanner would have closed it. That widening is the same direction as the fix
and is the defensible reading (a fenced heading is illustration), so it is
reported here rather than filed. The unclosed-fence case is finding 4.

**Fix 5 — the citation-loop comment — HOLDS.** The comment at :182-190 now
describes what the code does: only `name === self` is excluded at :195, a held
object citing a DIFFERENT held object still counts, and the comment says so
explicitly together with the reason it matters (all four live firings have a
parked roadmap as the citer). No gap between the sentence and the branch.

**Deferrals 6 and 7 — both reasons still hold, re-checked not assumed.** The
test file contains zero occurrences of `oversized`, `symbolic` or `symlink`,
and every occurrence of `unreadable` refers to a tree or a citer root, never to
the `counted.unreadable` tally — so the oversize skip, both symlink guards and
the two tallies remain unexercised exactly as recorded. For 7, the new fence
test does introduce a `## Blockers` line, which is the one thing that could
have closed that deferral by accident; it does not, because the same fixture
also carries `### blocker: a`. Confirmed by mutation: replacing the `## blockers`
branch at :158 with a constant `false` leaves the suite at 29/29 green.

**Accepted risk 5 — the narrowing is the right one.** The "writes nothing" test
is still a source grep, which is what roadmap step 2.2 specifies, and the
archived roadmap's AC-3 now claims three of four properties are verified
through the real entry point rather than all four. The claim and the evidence
now agree, which was the finding's real content.

## What was reviewed, and how

The three code paths in the review scope, read in full at their post-fix state,
plus the fix commit's diff read against them. Verification runs taken during
this round: the suite at baseline (29 of 29), five mutation runs, the gate
self-test (5 of 5, two rejecting), the live check (4 of 9, unchanged from the
recorded rate), four CLI probes against synthetic and permission-denied trees,
a five-case synthetic-estate probe for the citer-root guard, a six-case probe
for the fence toggle, and a parity sweep over all 100 live citer files.

Every mutation was the original defect rather than a paraphrase where the
original was recoverable, and each was reverted immediately. The three source
files were verified byte-identical to their pre-review state afterwards by
sha256 and by `git status`, which reports no modification to any tracked file.

## Not adjudicated

Round 1 noted that the diff wires the check into no task, workflow or gate
ledger. That is unchanged by the fix commit and remains outside what the
acceptance criteria answer, so it is stated rather than filed a second time.
