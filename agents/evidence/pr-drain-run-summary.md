<!-- evidence-type: analysis -->

# PR drain run — 2026-08-29

One row per PR. The run's mandate named a six-PR queue and a first merge of
`#1499`; **the recomputed queue held one open PR**, and every PR the mandate
named was already merged before the run started. That correction is the first
row-level fact below, not a footnote, because acting on the stated queue would
have meant re-processing merged work.

## Step 0 — the authorisation premise, verified read-only

`dist/hooks/dispatch.js:26307` reads `LEDGER_MAX_AGE_MS = 6 * 60 * 60 * 1e3`.
The 6h TTL is in the effective bundle. A `30 * 60 * 1e3` literal does occur in
the file at `:32468`, and it is **not** the ledger constant — it is an entry in
a duration-label table (`{ label: "30m", ms: … }`). Verified by locating both by
line rather than by presence of the pattern, because the pattern alone would
have produced a false STOP. Nothing was modified; the check was read-only.

## Rows

| # | Queue pos | Sync conflicts → resolution class | CI iters | Disposition |
|---|---|---|---|---|
| 1493 | pre-run | — | — | merged `9b7934e6c` (before this run) |
| 1488 | pre-run | — | — | merged `46837f58b` (before this run) |
| 1480 | pre-run | — | — | merged `b593d8c00` (before this run) |
| 1489 | pre-run | — | — | merged `d0fad2ccd` (before this run) |
| 1482 | pre-run | — | — | merged `52cfb4bb8` (before this run) |
| 1499 | pre-run | — | — | merged `dd6a14406` (before this run) — the mandate's "merge this first" target was already merged |
| 1701 | pre-run | — | — | merged `43a819363` **without its final commit** — see § Dropped edits |
| 1707 | 1 (only open PR) | none — `git merge origin/main` applied clean, no conflicted paths | 1 | **merged `e9f4b318b`** (squash) |
| 1712 | not in queue (merged during the run) | — | — | merged `7a2a6f883` by another session; **left `main` red** — see § A red nobody's CI could see |
| 1713 | follow-up, authored this run | none on sync | 0 | **merged `b9019f1ad`** (squash) |

## `#1707` — what the one CI iteration fixed

Three checks were red on arrival. Only one was a defect in the PR.

**Root cause, single:** the PR grew `src/rules/source-confidentiality.md` by
**+770 delivered tokens**. That rule is re-written into the preamble on *every*
subagent spawn, and `main` sits roughly 2 tokens under the 138,212 grace
ceiling, so the addition had no room. Measured total went to 138,948. This
reddened `Node Tests` shard 3/4 on both runners (the budget gate's own test
asserts the CI step exits 0) and `Standing payload delta`.

**Fixed at the source, not at the threshold.** The gate offers two remedies and
the second — raising `baseline_tokens` — is the config-weakening move this
repository refuses and the run mandate forbids. So:

1. Three sections the PR added to the rule are reference material rather than
   obligations the agent carries into every spawn — the claim/residual honesty
   clause, the two-class license split by path, and the gate's shape checks and
   tiering. They moved **verbatim** into a new guideline,
   `docs/guidelines/agent-infra/source-confidentiality-mechanics.md`, and the
   rule kept one pointer bullet. That left `+55`, still over.
2. The rule's own pre-existing *"Why this rule is not path-scoped"* rationale —
   630 tokens of council record, rejected alternatives and a token
   measurement, paid on every spawn — moved to the same guideline behind a
   four-line factual stub that keeps the decision itself.

**Result: `+770 → −350` delivered tokens; measured total 138,948 → 137,828
against the 138,212 ceiling.** No Iron Law heading, fenced block or negation
clause moved; `check_condensation` passes byte-for-byte. Guideline count
116 → 117, with `README.md`, `docs/architecture.md`, `agents/index.md` and
`docs/catalog.md` regenerated rather than hand-edited.

**Residual, disclosed:** `lint commit subjects` stayed red — an intermediate
commit on the branch carries the blocklisted token `tmp` in its subject. It is
**advisory**, not one of the 16 checks that block this PR shape (only
`Sync + Generate Tools Consistency` blocks, and it passed). The only fix is
rewriting a pushed commit subject, which the run mandate forbids; squash-merge
removes it from `main`'s history, and the merged subject carries no blocklisted
token. Verified against the linter's own set: `leftover(s)`, `wip`, `temp`,
`tmp`, `fixup`.

**Also disclosed:** the branch carries no completion-review artefact for a diff
with 9 code paths. Advisory in preflight; not fixed here.

## Dropped edits

**`#1701` merged without its last commit.** That commit corrected four claims
that `main` had overtaken while the branch was open — ADR-249 superseded
ADR-124's Class-B row on 2026-08-27, `docs/contracts/resident-process-governance.md`
landed, and `road-to-runtime-governance-flip` archived. The push carrying it was
interrupted and never resent.

Disposition, per file:

- Three of the five roadmaps (`road-to-runtime-context-floors`,
  `road-to-delivered-cost-truth`, `road-to-code-graph-evidence-that-exists`)
  were executed and archived overnight by other sessions. Their stale framing
  is moot; **dropped deliberately**, not carried.
- `road-to-runtime-event-journal` was executed to 20/20 by `#1706`. Its Context
  section still reads against ADR-124, but the roadmap is complete and the
  contract that supersedes its framing now exists. **Dropped.**
- The P3 state-store collision that commit raised as a blocker — whether an
  append-only journal is a prohibited cross-session store — was resolved
  independently and **better** by `docs/contracts/runtime-persistence-tiers.md`
  on 2026-08-28, which splits T2 into worktree-local and repo-wide and states
  that P1 does not weaken P3. **Not re-raised**; re-opening it would be
  re-litigation.
- One file still mattered: the durable evidence record. Carried into `#1713`.

## Follow-up authored this run

`#1713` — `agents/evidence/analysis/runtime-execution-directive-2026-08-28.md`
cited ADR-124 § 5 as a live price for the first resident process. ADR-249
superseded that clause the same day the record was written, so a durable
artefact written to be cited has been citing a dead lock. Corrected with both
halves kept.

It carries one finding that is **not** fixed and belongs to the owner:
condition 4 of `resident-process-governance.md` — a P1 process may not execute
from a revision that still publishes a runtime-absence claim — **is unmet on
`main` today**. `README.md:30` publishes "no background daemon" and
`docs/CLAIMS.md` carries `claim: no-runtime-daemon`. The roadmap that owned
that public-surface rewrite archived without doing it, and no active roadmap
owns it. Changing a published commitment is owner-reserved, so it is recorded
rather than performed.

## A red nobody's CI could see

`main` went red on `check_no_external_sources:shape-block` between two green
PRs, and this is a merge-order class worth naming rather than just fixing.

`#1707` introduced the attribution-shape heuristic with a baseline of **275**.
`#1712` merged **after** it and added a roadmap whose header reads
`> **Source:** promoted 2026-08-29 out of the stubs/ directory …`. The detector
flags any `Source:` value that is not an `ENC1:` token, an opaque round
identifier or an `agents/tmp*` path, so the tree went to **276** — one over a
ratchet that only turns down. Neither PR's CI could observe it: `#1712` was
tested before the gate existed, and `#1707` was tested before that file existed.

Fixed at the cause. The header was **wrong**, not merely inconvenient: that
roadmap was promoted internally out of `stubs/` and has no external source to
declare. Relabelled `Provenance:` — one word, same sentence, same information.
Raising the baseline was available and is what the gate's own message calls a
defect; it was not taken.

Measured: 276 → 275, at baseline.

## Process note — one mistake made and repaired

While attributing that violation I ran `git stash` in a worktree whose tree was
already clean, so it created nothing; the `git stash pop` that followed then
unpacked **another session's preserved stash** (`concurrent-session
video-foundation + mcp-discovery work`) into the worktree and conflicted. No
data was lost: `pop` retains the entry on conflict, the working tree was
restored to `HEAD`, the two files the pop had added were removed only after
confirming both are still inside `stash@{0}`, and all five stash entries remain.
Recorded because the failure mode is silent — a stash probe on a clean tree
pops somebody else's work.

## Terminal PRs

None. The queue is at zero.

---

# PR drain run — 2026-08-30

Second run against this file, appended rather than rewritten. **The mandate's
queue was again stale, and in the same direction:** it named `#1499` as the
first merge and six PRs as already merged "this run". All six merged on
2026-08-20/21 — nine days before this run — and the recomputed live queue held
**one** open PR, `#1728`. Every number below is reproducible from the commands
beside it.

## Step 0 — the authorisation premise, verified read-only

`dist/hooks/dispatch.js` reads `LEDGER_MAX_AGE_MS = 6 * 60 * 60 * 1e3`. The 6h
TTL is in the effective bundle. One `30 * 60 * 1e3` literal remains at `:32477`
and is **not** the ledger constant — it is the `{ label: "30m" }` entry of
`WALL_CLOCK_ARMS_MS` at `:32474`. Located by line and by enclosing declaration
rather than by pattern presence, because the pattern alone produces a false
STOP. Nothing modified.

## Rows

| # | Queue pos | Sync conflicts → resolution class | CI iters | Disposition |
|---|---|---|---|---|
| 1493 | pre-run | — | — | merged `9b7934e6c` 2026-08-20 (nine days before this run) |
| 1488 | pre-run | — | — | merged `46837f58b` 2026-08-20 |
| 1480 | pre-run | — | — | merged `b593d8c00` 2026-08-20 |
| 1489 | pre-run | — | — | merged `d0fad2ccd` 2026-08-21 |
| 1482 | pre-run | — | — | merged `52cfb4bb8` 2026-08-21 |
| 1499 | pre-run | — | — | merged `dd6a14406` 2026-08-21 — the mandate's "merge this first" target, already merged |
| 1728 | 1 (only open PR) | **none** — `origin/drain/source-silence` already contained `origin/main` (`merge-base --is-ancestor` exits 0); the local worktree was merely behind its own remote and fast-forwarded | 2 | **merged `227b01697`** (squash) |
| this file | 2, authored this run | none | — | see the PR that carries it |

## `#1728` — a required-check red that belonged to `main`, not to the PR

`Sync + Generate Tools Consistency` — the **only** mechanically required check
in the `main` ruleset — was red. It was red on `main` too, at `97687edc3`
(run `33286217256`), for the identical reason, so the PR inherited it through
the merge rather than causing it.

**Cause.** Gate R1 (`lint_plan_risk_register`) reported `stale_review` on
`agents/roadmaps/road-to-supervised-telemetry-collector.md`: `reviewed:
2026-08-29` predated PR #1730, which closed steps 2.3, 2.4 and 3.1, flipped
AC-1 through AC-5 to met, and created the seven-row rollback trigger matrix.

**This is the sanctioned action, not a freeze violation.**
`docs/contracts/ci-green-floor.md` § Freeze rule names two exits from a
required-check red on `main`: revert, or "ship a fix-forward PR that turns the
required check green". `#1728` is the second, and the check is green on its
head.

**Fixed by re-reviewing, not by stamping a date.** Reading the seven existing
rows against the changed surface: risk 1 already demands a sensitivity reading
per flip, and the three newly-closed steps each record one. What no row named
was the state 3.1 created — the matrix has seven rows and two are enforced
(1 and 5), while the other five carry `OWED BY` against steps 5.1, 5.1, 3.2,
4.2 and 5.2. That is risk 1 one level up: not a check that ran and proved
nothing, but a control that is named and not yet wired. Added as its own row.

## The correction round — a neutral reviewer found five errors in the fix

A fresh reviewer with no session context was dispatched over the single commit
`3a39a5ef4`, with a prompt stating no expected outcome. It confirmed the gate
red was real and inherited and the risk non-duplicative — and found **five
checkable factual errors in the row's own prose**, none of them a judgement
call. All five were repaired in `7fd04fd1f`:

1. "steps in Phases 4 and 5" — false; the owed set includes 3.2, a Phase 3 step.
2. "closes when 5.2 lands" — misattributed four of five rows; they close at
   5.1, 3.2, 4.2 and 5.2. A single closure condition for a four-step set is
   unfalsifiable at the point it names.
3. "Phase 4 ships with five unwired triggers" — contradicts the file's own
   `mode: phase-checkpoints`, under which 3.2 precedes Phase 4 and the number
   is four. The alternative reading (3.2's verify cannot run before the
   collector exists) means Phase 3 is blocked on Phase 4; the row now carries
   both branches instead of absorbing the conflict silently.
4. "Surfaced by the 2026-08-30 re-review" — overclaimed. Step 3.1's own prose
   already states that five of seven are future work. The row now says it
   **promotes** that observation into the register.
5. Rank 8 asserted least-risky without argument and departed from the
   precedent set one commit earlier, where #1730 re-ranked the whole register
   to insert at 1. Placed at 5; old 5-7 renumbered to 6-8.

Two errors in the **first** commit message were not repairable without
rewriting a pushed branch, so `7fd04fd1f` corrects them in the record instead:
"added row 7 to the rollback trigger matrix" conflated two tables (97687edc3
created the whole matrix; it was the Risk Register that went 6→7), and "risks
1 and 4 cover the new step flips" is half unsupported, since risk 4 is about
mocked supervision in Phase 5 and names no mechanism covering Phase 2 store
tests.

**Recorded as the run's finding, not as housekeeping:** a re-review dispatched
to repair a gate produced prose less careful than its own self-description
claimed, and only an independently-prompted reader caught it. The gate went
green after the first commit; four of the five errors would have shipped.

## Residuals, disclosed

**`lint commit subjects` merged red.** An intermediate commit 22 back on the
branch carries the blocklisted token `tmp` in `fix(shape): a working-set tmp
directory is not a harvest round`. Three facts settle the disposition, and the
2026-08-29 run above reached the same one independently:

- It is **advisory**. The `main` ruleset requires exactly one check
  (`Sync + Generate Tools Consistency`), verified via
  `gh api repos/.../rulesets/17749383`; `branch-protection-policy.md` says the
  same in prose.
- The only root-cause fix is rewording a pushed commit, which the mandate
  forbids ("Never rebase pushed branches").
- Squash-merge makes it moot for the thing the gate protects:
  `release.ts:441` builds the CHANGELOG from `git log <tag>..HEAD --no-merges`
  on `main`, and the squashed subject is the PR title, which carries no
  blocklisted token.

**Completion-review scope drift, advisory, not repaired.** The branch's
`drain-source-silence.findings.md` binds scope
`bdf90bcf…`; the two commits above moved it to `9a1a5e64…`.
`check_completion_review --advisory` exits 0 and CI is unaffected. It was not
rebound: the branch's own post-review delta is two commits, one of which is a
prior rebind and the other the R1 repair — everything else in the scope
difference arrived from `main` and was reviewed there. Writing a rebind marker
whose scope hash covers a diff no fresh reader examined would manufacture the
evidence the marker exists to record, so the drift is reported instead.

**No terminal PRs, no superseded closes, no blocked-external, no dropped
edits.** The queue is at zero.

## Process note — one mistake made and verified harmless

After the merge, `git reset --hard origin/main` was run in a worktree still on
`drain/source-silence` (the `git checkout main` before it had failed — `main`
is checked out in the primary clone). It therefore moved the local drain branch
pointer rather than a detached HEAD. No work was lost and this was checked
rather than assumed: the worktree was clean, `7fd04fd1f` is still a reachable
commit object, its remote was deleted by the merge itself, and the corrected
risk row is present in `origin/main`'s copy of the roadmap. Recorded because
the intent was to move the worktree, and the command that ran rewrote a branch.
