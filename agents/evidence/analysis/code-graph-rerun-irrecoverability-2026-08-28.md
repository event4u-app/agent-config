<!-- evidence-type: analysis -->

# Irrecoverability determination — the 2026-07-28 code-graph benchmark re-run

**Date:** 2026-08-28.
**Determined for:** `agents/roadmaps/stubs/road-to-code-graph-benchmark-rerun.md`,
which carries the transferred obligation to re-run the original code-graph vs
grep benchmark against its three registered corpora.
**Authority:** AI council 2026-08-28 (anthropic + openai, 1 round, $0.00, both
seats subscription-authed), acting on the owner's standing delegation for this
run. Recorded under `road-to-code-graph-evidence-that-exists` step 4.1.

## Why this file exists, and why probe readings alone were not enough

The stub's own null path closes it on "a **maintainer determination that the
inputs are irrecoverable**". The council split on whether the probe evidence
below is sufficient by itself:

- One seat: **yes**. The stub's own wording names "access lapsed" as sufficient,
  and private third-party repositories that "cannot be published, vendored, or
  synthesized" are structurally inaccessible — the barrier is a permission and
  ownership fact, not a temporary absence.
- The other seat: **not from the probes alone**. The probes establish that the
  inputs are absent and have stayed absent. They do not establish that access
  cannot be restored by the owners. Irrecoverability is "a governance judgment
  about future access, not a filesystem fact a probe can prove", and the stub
  assigns that conclusion to a maintainer.

That split is resolved by **making the assertion** rather than by inferring it.
The readings are recorded first, and the determination is stated after them, in
the terms the second seat asked for — on top of the evidence, not in place of it.

## Probe readings — 2026-08-28, every reading, before the determination

The stub specifies four `[ -f ]`-plus-hash readings and one corpus reading.

| # | Reading | Result |
|---|---|---|
| 1 | `agents/tmp/bench-local/repo-a-questions.yaml` | **ABSENT** |
| 2 | `agents/tmp/bench-local/repo-b-questions.yaml` | **ABSENT** |
| 3 | `agents/tmp/bench-local/repo-c-questions.yaml` | **ABSENT** |
| 4 | `agents/tmp/bench-local/probes.yaml` | **ABSENT** |
| 5 | Clones of the three registered corpora | **none reachable** |

Widened, so "absent here" is not confused with "absent in this worktree":

- `find /Users/mathiasberg/projects -maxdepth 6 -name 'repo-?-questions.yaml'`
  → **0 results**.
- `find /Users/mathiasberg/projects -maxdepth 6 -name 'probes.yaml'`
  → **0 results**.

No hash could be computed for any of the four, because none exists to hash. This
is the absent-input control, not a mismatch: a mismatch would void a run, an
absence prevents one from starting.

Two further readings, for the same reason the stub recorded them — so a later
reader can tell real movement from noise:

- `internal/bench/code-graph/run_bench.ts` — **present**. The harness is not the
  missing piece; only its inputs are.
- `git log --oneline -- internal/bench/reports/code-graph-vs-grep.md` →
  **exactly 1 commit**. No second run has ever been recorded.

**Identical to the control recorded 2026-08-26**, two days earlier. Nothing
moved.

## The determination

> The project has **no present or reasonably obtainable authorized access** to
> the four SHA-256-pinned question files or to the three registered corpus
> clones, and **will not pursue reacquisition**. The three corpora are private
> third-party repositories carrying proprietary code that cannot be published,
> vendored, or synthesized; the obstacle is a permission and ownership fact
> rather than a lost file, and no automation inside this repository can change
> it. The original comparable re-run is therefore **irrecoverable for project
> purposes**.

## What this determination does — and, precisely, what it does not

**It does:** close the transferred obligation, as **retired unmet**. That is the
stub's own documented null direction, and the stub states such a determination
"either retires the re-run obligation outright, or approves a separately named,
explicitly non-comparable benchmark under its own claim id".

**The second branch is unavailable**, so the disjunction collapses to the first.
A separate council decision the same day established that the in-repo benchmark
gets **no claims entry**: the `kind` enum is `{quant, qual, comparative}` and
none of the three makes two recall figures incomparable by construction. Both
seats confirmed the collapse is acceptable and that "retire outright" remains
valid on its own.

**It does NOT:**

- claim the transferred criterion was met. It was not, and no re-run was
  performed.
- draw any authority from the in-repo benchmark published on the same day. That
  benchmark carries **zero closure credit**. Two prior councils ruled a
  non-comparable benchmark "neither replaces this obligation nor closes this
  stub"; the council today agreed that retiring on that basis would launder a
  substitution into a completion however honest the wording — one seat put it as
  "honest wording does not cure the invalid causal basis for closure".
- revive if the inputs later appear. If they do, that is a new decision on new
  facts, not an automatic reopening of this one.

## Revisit-if

The owners of the three corpora grant this project authorized access, **and**
the four pinned files are reproduced with matching SHA-256. Both, not either:
pinned questions with no corpus have nothing to query, and a corpus with
unpinned questions is a different benchmark wearing this one's name.
