<!-- evidence-type: analysis -->

# Which paths actually cost merge conflicts — measured, two windows

> Produced by `./scripts-run src/scripts/pr_conflict_census --limit 2000`, for
> `road-to-merge-surface-zero` § 0 and AC-4. Every figure below is one command
> away from re-derivation, which is the point: the roadmap's own § 0 had to be
> reconstructed by hand and its premise decayed before it could be acted on.

## The method, and why it counts conflicts rather than churn

`git show --name-only` on a **merge** commit prints the *combined* diff — only
paths differing from **both** parents. A conflict-free merge therefore prints
nothing; a merge that resolved conflicts prints exactly the resolved paths.

Validated in both directions before any number was taken:

- a merge with five known conflicts (this drain run's own
  `drain/road-to-skill-estate-drawdown` ← `origin/main`) printed those five paths;
- a clean PR merge printed nothing.

**Floor, not a total.** A conflict resolved by rebase leaves no merge commit, and
a squash-merge of a branch that itself merged `main` carries the resolution inside
a single-parent commit. Both are invisible here. Every number below understates.

## Window 1 — 60 days, 1,843 merges, 533 with a resolution

| resolutions | path | class |
|---:|---|---|
| **339** | `agents/roadmaps-progress.md` | generated |
| **105** | `src/config/estate-count-budget.json` | authored |
| 61 | `agents/roadmaps/stubs/README.md` | generated |
| 60 | `agents/roadmaps/archive/index.json` | generated |
| 59 | `agents/roadmaps/archive/INDEX.md` | generated |
| 50 | `internal/.condensation-hashes.json` | generated |
| 38 | `docs/CLAIMS.md` | authored |
| 29 | `src/config/gate-violation-baselines.json` | authored |
| 26 | `docs/proof.md` | generated |
| 24 | `taskfiles/ci-fast.yml` | authored |
| 20 | `README.md` | authored |
| 18 | `docs/architecture.md` | authored |
| 18 | `src/config/gate-coverage.yml` | authored |
| 15 | `agents/index.md` | generated |

**703 of 1,394 resolutions (50 %) are on generated paths** — output a PR carried
that it never needed to carry. That is `road-to-merge-surface-zero` Phase 1's
premise, quantified for the first time.

## Window 2 — the newest 3 days, and it tells a different story

| resolutions | path |
|---:|---|
| 12 | `docs/CLAIMS.md` |
| 9 | `src/config/estate-count-budget.json` |
| 8 | `docs/proof.md` |
| 8 | `src/domains/meta/pack.yaml` |
| 6 | `agents/index.md` |
| 6 | `docs/catalog.md` |
| 6 | `src/config/gate-coverage.yml` |

**The 60-day #1 is absent, and so are three of the next four.** Not because the
window is short — because they were fixed.

## The finding: two completed repairs are measurable, and they worked

**`agents/roadmaps-progress.md` — 339 resolutions over 60 days, ZERO in the last
three.** It is now untracked (`.gitignore:108`). The single largest merge surface
in the repository was removed by deleting it from the index, and the census shows
the before and the after.

**`src/config/estate-count-budget.json` — 105 over 60 days, and all 9 of the
recent ones fall on 2026-08-22**, the day ADR-243 removed its stored baseline.
None after. That file's own `_comment` claims it was "the most-conflicted
non-generated path in the repository"; this census confirms it (105, second
overall) and shows the removal ending it.

Both are recorded because a roadmap phase is easier to justify than to evaluate,
and these two are the tree's own evidence that the *mechanism* — repo-global state
carried in PR diffs — is the right target.

## What this corrects in the roadmap

**Phase 1.1's path list misses the top four.** It names
`agents/reports/originality.{json,md}`, `docs/proof.md`,
`internal/reports/exec-evidence-feasibility.json` and `src/domains/*/pack.yaml`.
Measured over 60 days: `proof.md` 26, `pack.yaml` 8+4, exec-evidence 3, and
**`agents/reports/originality.*` does not appear at all** — zero resolutions in
either window. Meanwhile `roadmaps-progress.md` (339), `stubs/README.md` (61),
`archive/index.json` (60), `archive/INDEX.md` (59) and
`.condensation-hashes.json` (50) are generated, conflict-heavy, and unnamed.

**Three authored hotspots are in no phase at all**: `gate-coverage.yml` (18),
`taskfiles/ci-fast.yml` (24) and `gate-violation-baselines.json` (29). This drain
run hit the first two on two branches in one day, and hit
`.secret-allow`'s line pin into `gate-coverage.yml` **five times** — a pin whose
drift is a direct consequence of an append-heavy manifest being a merge surface.

**`docs/CLAIMS.md` is the one hotspot that is getting WORSE**: 38 over 60 days but
12 in the last three, i.e. roughly a third of its two-month total in the newest
1.6 % of the window. Phase 2 targets exactly it, and it is the only top-ten
authored path with a rising trend rather than a completed repair.

## What is NOT claimed

- **No causal claim for the two repairs.** The dates line up and the mechanism is
  plausible, but this is observational: nothing was held constant, and merge
  volume itself varies day to day.
- **Nothing about the current PR set.** The roadmap's § Source measured 6 open PRs
  and later re-measured 0; the count is 3 as this ran. A live-state figure decays,
  and this census deliberately measures *history*, which does not.
- **The generated/authored split is a classifier, not a contract.** It lives in
  `isGenerated()` and its first version misclassified the top four, reporting
  10 % where the answer is 50 %. A test now pins both directions — the five paths
  it missed, and seven authored paths it must not claim.
