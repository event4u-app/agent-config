---
complexity: lightweight
review_by: 2026-11-30
---

# Stub: road to a routing-signal verdict that reproduces in CI

> **Stub — not active work.** Found 2026-08-31 (drain run 11) on PR #1780, which
> is the first branch in some time to touch `src/` and therefore the first to
> trigger the full Node suite. The failure is **pre-existing and CI-only**. It is
> recorded rather than fixed because the one edit that would turn it green —
> changing the published number — would close a measurement by redefinition, on
> a figure that does not reproduce on this machine at all.

## The failure

`tests/scripts/routing_signal_measurement.test.ts:178`, in
`describe('5.1 — the published verdict reproduces from the tree')`:

```
AssertionError: expected { partition: 'train', …(5) } to deeply equal { … }
  Object {
    "cases": 775,
-   "catalogue_size": 300,      <- Expected: fresh recompute, in CI
+   "catalogue_size": 299,      <- Received: the published artefact
    "holdout_sealed": true,
    "legacy_shaped_corpora": [ "brand-asset-generation", "estimate-ticket" ],
    "partition": "train",
    "train_corpora": 82,
  }
```

Every other field reproduces. The assertion is
`expect(published['corpus']).toEqual(fresh['corpus'])`, so vitest's *Expected*
side is the **fresh** recompute and *Received* is the **published** file:
`agents/evidence/analysis/routing-body-signal-verdict.json` records
`catalogue_size: 299`, and **CI's recompute over its own checkout produced 300**.

## What was established

**The tree holds 299 skills, on both branches, by three independent counts:**

| Count | Value |
|---|---|
| `git ls-files 'src/skills/*/SKILL.md'` on the branch | 299 |
| the same on a clean detached worktree at `origin/main` | 299 |
| `git ls-tree -r origin/main -- src/skills` filtered to `/SKILL.md` | 299 |
| `ls src/skills/*/SKILL.md` on disk | 299 |
| `check_estate_count` | `skill_count 299 (floor 299, +0)` |

`loadCatalogue` (`src/scripts/_lib/routing_corpus.ts:203`) counts directories
under `skillsDir(repoRoot)` = `src/skills` (`:86-88`) that carry a `SKILL.md`.
So 299 is what the committed tree yields, and 300 is one more than exists.

**It does not reproduce locally, in any configuration tried:**

- the file in isolation on the PR branch — **17/17 passed**;
- the file in isolation on a clean `origin/main` worktree — **17/17 passed**;
- the **full local suite** on the PR branch — **20,247 passed, 1 failed**, and
  the one failure is `check_rule_projection_integrity`, a separate and
  independently-known local-config artefact whose own source comment explains it
  (`agents/.agent-tools.yml` selecting a partial tool set, which the test's
  `skipIf` only catches when the plan is *empty*).

**This branch cannot be the cause.** PR #1780 adds two `src/scripts/*.ts` files,
two `internal/bench/` documents, one roadmap edit and two stubs. It adds **no
skill**, and `origin/main` did not move between the rebase and the run
(`a8cdaa8fe` both times).

**Why it surfaced now rather than earlier.** PRs #1778 and #1779 each ran **7**
path-filtered checks and never ran the Node suite at all; #1780 ran 35. So this
test's last CI execution predates both, and the drift has been latent.

## The hypothesis, named as a hypothesis

**A sibling test in the same shard writes a 300th `src/skills/<name>/SKILL.md`
into the real repository root, and the 5.1 test recomputes over the polluted
tree.** It fits the shape: the fresh count exceeds the tracked count by exactly
one, the test passes in isolation, and it passes in a local full run where the
shard boundaries and file ordering differ from CI's `shard 2/4`.

**Not confirmed, and the obvious candidates were checked and cleared.** Every
test found writing a `SKILL.md` writes it under a temp root
(`tests/scripts/check_no_new_legacy_path.test.ts:171`,
`tests/scripts/symlink_confinement_walkers.test.ts:72,100,110`), and every test
that joins `REPO_ROOT` with `src/skills`
(`evals_schema`, `lint_eval_freshness`, `lint_token_budget_discipline`,
`scoped_dangle_window_guard`) reads rather than writes. So the writer, if it
exists, is not among them.

## What closes this

1. Reproduce it — run `tests/scripts/routing_signal_measurement.test.ts` inside
   the same shard partition CI uses (`--shard 2/4` on the same file ordering),
   or add a guard that fails the moment `src/skills` gains an entry the index
   does not track.
2. Identify whether the 300th entry is test pollution or a genuine
   environment-dependence in `loadCatalogue`.
3. Only then decide the number. If the tree really holds 299, the published
   artefact is already correct and the defect is entirely in whatever produced
   300.

## What must NOT happen

**Do not edit `catalogue_size` in
`agents/evidence/analysis/routing-body-signal-verdict.json` to 300 to turn CI
green.** The published figure matches every count that can be taken of the
committed tree. Re-keying a published measurement to match an unreproducible
recompute is closing a gate by redefinition, and it would also destroy the one
signal that says something in CI is counting a skill that is not there.
