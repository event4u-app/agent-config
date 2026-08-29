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
