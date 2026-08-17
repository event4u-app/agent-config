# Findings: evidence-artifact-typing
<!-- completion-review: v1 | reviewed: 2026-08-17 | scope: beaed2083cfdb54a3af815d6b2eacee206d2994f83298e667df0f909c03c3fed | diff: 6004ff9e82cc17d3e748339a2a0ac457073f61e8 | reviewer: r2-fresh-subagent-evidence-artifact-typing | prompt_hash: c5fa3a61fb9539b5148a9fdbcdbdbd28ddde38f34c5fc840421458cda59398be -->
<!-- evidence-type: v1 | type: rebind-event | declared: 2026-08-17 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 6004ff9e82cc17d3e748339a2a0ac457073f61e8
  scope_hash: beaed2083cfdb54a3af815d6b2eacee206d2994f83298e667df0f909c03c3fed
  roadmap: agents/roadmaps/road-to-release-review-p0.md
  roadmap_hash: c937b1ef2884ddc72cf9ae3712ac9e89719cabf74c7ad3fc0d85b22cfc6b6482
  ac_hash: b66e28e3514bce21e33b699a6672658a9c3fa6ea38a0d569ad74e836c97798ea
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-17T05:57:54Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/lint_evidence_artifacts.ts:243 | `isEvidenceArtifact` governs every `.md` under `agents/evidence/`, so it also governs the review-input package `dispatch_r2_reviewer.ts` writes and commits beside the findings artefact — `prompt.md`, `roadmap.md`, `acceptance-criteria.md` (dispatcher:1072-1075, default `outDir` `agents/evidence/reviews` at :726). Nothing types or exempts those three, so the presence half emits `missing-marker` for each on every future R2 dispatch. They are untracked and not gitignored in this worktree right now, and `gatherChangedArtifacts` unions in `git ls-files --others --exclude-standard` (:271-284), so the pre-push entry added at taskfiles/ci-fast.yml:126 is already red on the branch that introduces it. | fixed | new gate blocks the workflow that produces its own input  21c9865c8 |
| 2 | high | src/scripts/dispatch_r2_reviewer.ts:694 | The skeleton is stamped `current-binding` while its table is still empty, and `checkAgreement` rejects exactly that shape (`lint_evidence_artifacts.ts:180`, "declared `current-binding` but carries no findings row") — the change's own test asserts it at tests/scripts/lint_evidence_artifacts.test.ts:127. So from creation until a reviewer fills the table the artefact violates §4, failing the pre-push run, CI `--all`, and the new corpus test at tests/.../lint_evidence_artifacts.test.ts:255. The contract mandates both halves of the contradiction: §4:120 says set `current-binding` at creation, §4:115 forbids it without at least one findings row. | fixed | contract self-contradiction, made executable  21c9865c8 |
| 3 | medium | docs/contracts/evidence-artifact-types.md:114 | `original-review` forbids only a `completion-review:` marker, and a `declared-skip` body legitimately carries none (`lint_evidence_artifacts.ts:213`; test at tests/.../lint_evidence_artifacts.test.ts:150). A skip artefact mistyped `original-review` therefore passes agreement silently — the skip-versus-somebody-looked-and-saw-nothing conflation §3 names as the most consequential ambiguity in the corpus. Adding a skip line and an honest-null line to the `original-review` forbidden column closes it. | fixed | hole in the agreement matrix  21c9865c8 |
| 4 | medium | src/scripts/lint_evidence_artifacts.ts:462 | Option values are unvalidated. `--since` with no value assigns `undefined`, which `since ?? null` at :265 turns back into the default base — silently scanning the default scope, the exact failure the unknown-argument branch at :470-475 and its test exist to prevent. `--repo` with no value makes `path.resolve` throw inside the outer try and returns 2, which every call site treats as warn-and-allow, so a mistyped invocation degrades the gate to advisory instead of exiting 1 as the header's exit-code note requires for policy problems. | fixed | :464, header "Exit codes (contract §6)"  21c9865c8 |
| 5 | medium | taskfiles/ci-fast.yml:969 | The exit-2 warn-and-allow shim is present in the workflow step (.github/workflows/consistency.yml:361-367) but absent from the `lint-evidence-artifacts` task cmd and from the raw preflight entry at :126 — unlike the sibling `check-completion-review`, which carries it in both places (:996-1000). An internal error therefore blocks `task ci` and `task preflight` while merely warning in GitHub CI, contradicting "a broken gate never blocks its own fix" stated three lines above the preflight entry. | fixed | local chain diverges from CI  21c9865c8 |
| 6 | low | docs/contracts/evidence-artifact-types.md:163 | §6 states the validator is "changed-files scoped" and presents `--all` only as a reporter of the untyped remainder, omitting that agreement is enforced globally and that `--all` is the CI-registered argv. A reader concludes a pre-existing typed artefact whose type disagrees with its body is unenforced; it is enforced. The preamble says a divergence between contract and validator is a validator bug, so the understatement is load-bearing. | fixed | §4 and src/config/gate-coverage.yml:504-518 say otherwise  21c9865c8 |
| 7 | low | src/scripts/lint_evidence_artifacts.ts:350 | A file whose only defect is a malformed or unknown-value marker increments `untyped`, so the `--all` remainder line at :551-556 reports it as an artefact that "carries no type marker (not required; see §6)" while it is simultaneously a violation. The published shrink metric conflates never-typed with typed-wrongly, which is the one thing the line exists to make observable. | fixed | metric mislabels its own violations  21c9865c8 |
| 8 | low | src/config/gate-coverage.yml:516 | The 300 floor is justified by "evidence artifacts are not deleted", which the same diff contradicts: the `evidence-compaction-approval` entry in agents/roadmaps-progress.md:150 offers option (b), which deletes the 11 re-derivable directories (1.12 MB) it classified. If that sanctioned option is taken the floor can trip on an approved compaction rather than on the moved root or drifted convention the note names. | fixed | stated assumption already contested in-tree  21c9865c8 |
| 9 | low | src/scripts/lint_evidence_artifacts.ts:303 | `walk` swallows every `readdirSync` error and returns, so an unreadable or transiently-missing subtree silently reduces `scanned` with no diagnostic. The only guard is the 300 floor, which tolerates a silent loss of roughly 28 artefacts before anything notices — a measurement that can degrade without saying so. | fixed | silent under-measurement  21c9865c8 |
| 10 | low | src/scripts/lint_evidence_artifacts.ts:96 | `rebind-event` has no writer. The dispatcher only ever stamps `current-binding`, the §2.7 in-place re-bind is a manual edit (dispatch_r2_reviewer.ts:386-392), and `REBIND_TRACE_RE` demands a literal "re-bound at" string nothing generates. One of the five types is therefore reachable only by hand, and §4's "A type change is legitimate in exactly three transitions, each of which re-dates `declared`" is enforced by nothing — while the roadmap step requires the type be set at write time. | fixed | five types declared, four producible  21c9865c8 |
| 11 | low | agents/roadmaps-progress.md:598 | The regenerated dashboard reports Phase 3 as "in progress, 8 open, 1 done, 11%" although no Phase 3 step is checked: the generator folds the five Acceptance-Criteria checkboxes into the last phase (4 real steps plus 5 AC is the 9 it counts), so flipping AC 2 credited Phase 3 with a done step. This contradicts the note added in the same diff at agents/roadmaps/road-to-release-review-p0.md:86, "Phase 1 and Phase 3 stay open". | accepted-risk | generator behaviour is pre-existing and out of this change; the contradiction is now named at agents/roadmaps/road-to-release-review-p0.md so a reader is not misled — 21c9865c8 |

## Dispositions — round 1, re-bound at `45a7dd73d`

**10 of 11 fixed, 1 accepted.** Both `high` findings were real and both were
self-blocking, which is the whole argument for having run the review: the gate
fired on the dispatcher's own review-input package, so every future R2 dispatch
would have tripped the check that shipped in the same change; and the skeleton
the dispatcher writes was illegal from its first byte, because the contract
mandates `current-binding` at creation while the agreement rule demanded a
findings row the skeleton does not have yet. Neither was reachable by reading
the diff — both needed the gate run against the tree it governs.

Finding 11 is `accepted-risk`, not fixed: the dashboard generator folds
`## Acceptance Criteria` checkboxes into the last phase, which is pre-existing
and deliberate behaviour (it folds `## Prerequisites` the same way). Changing it
is not this change's business, so the contradiction is named in the roadmap
instead — a reader who trusts the derived view is now told which number to
distrust and why.

**Re-bound twice, and the second time is why this section exists.** The artefact
was first bound at `e16b1d1fb`, committed with all 11 rows `open` before any fix
(§ 2.5). The fixes landed as `21c9865c8`; `origin/main` had then moved five
commits, so merging it in produced `36f84656e` and a new review scope. Re-binding
at the pre-merge scope would have shipped a verdict describing a diff the PR does
not contain.

**This artefact is the first real producer of `rebind-event`.** Finding 10 states
that nothing in the tree writes that type — true when it was written, and this
re-bind is the hand edit § 4 describes rather than a writer, so the finding stands
as recorded. The type change and the re-dated `declared` follow the § 4 transition
`current-binding` → `rebind-event`.

One defect this fix pass introduced and closed in the same breath is recorded in
the `21c9865c8` commit message rather than as a twelfth row: excluding the
review-input package from the changed-files half left `--all` walking every `.md`,
so the two modes disagreed about what an artifact is. Backdating an observation
nobody made is the forgery this ordering exists to prevent.

**Third bind, at `45a7dd73d`.** The `21c9865c8` fix pass changed the dispatcher
skeleton's placeholder, which broke a test that pinned it verbatim; following
that downstream added a commit, which moved the scope again. Recorded rather than
smoothed over, because the sequence is the point: the artefact is excluded from
its own scope computation, so re-binding converges — but any OTHER commit after a
re-bind invalidates it, and that is why the re-bind is always the last edit.

**Fourth bind, same cause one layer out.** CI caught a broken cross-reference in
the roadmap note this branch added — a backticked gate name followed by the word
"rule" parses as a rule reference, and `check_references` runs only in CI, not in
`task preflight`. Fixing it added a commit and moved the scope again. Both re-binds
after the fix pass share one lesson: the re-bind is the last edit on a branch, and
every gate that runs *only* remotely can still force one more.

**Fifth bind, at `6004ff9e8`, and this one exposed a second layer.** `origin/main`
had moved 19 commits (release 13.0.0 plus a roadmap archival), so the PR went
CONFLICTING; merging brought two conflicts — the generated dashboard, resolved by
regenerating rather than by mixing hunks, and `gate-coverage.yml`, where both
sides had re-anchored the same two header figures. Neither number was guessed:
the population is computed by `count_gate_scripts` and the emitter count from the
manifest, so the resolution is 263 / 40 rather than either side's reading.

The re-bind itself is what carries the lesson. Updating the marker's `scope:` and
`diff:` is NOT a re-bind — the context manifest carries `roadmap_hash`
independently, the cross-reference fix had edited the roadmap, and the marker
looked correct while the manifest was stale. Only `check_r2_manifest` catches
that, and it runs in the consistency workflow, not in `task preflight`. So the
same gap that forced bind four forced bind five one layer down: a re-bind means
marker AND manifest, and the authoritative check for the second half is
remote-only. `dispatch_r2_reviewer --verify-current` re-derives it and names the
divergence, which is cheaper than deriving the hash by hand.
