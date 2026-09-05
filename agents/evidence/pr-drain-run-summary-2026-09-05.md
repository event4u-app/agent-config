<!-- evidence-type: analysis -->
# PR drain run — 2026-09-05

Nine pull requests were open when this run started. Eight were carried to a
merge by the run; one was merged by the maintainer while the run was in
progress. No PR was closed as superseded, none was blocked externally, and none
exhausted its fix budget.

## Two premise corrections, recorded because they changed the run

Predecessor: `agents/evidence/pr-drain-run-summary.md` records the 2026-08-29
run. It is left untouched — this run is a separate record, not a revision of
that one. Read together they show the widening being reverted: that record
verified `LEDGER_MAX_AGE_MS = 6 * 60 * 60 * 1e3` in the effective bundle on
2026-08-29, and this run measured 30 minutes in both the bundle and the source.

The run was commissioned with a brief that named `#1499` as the next merge and
six PRs as already merged. All six were merged on **2026-08-20/21**, fifteen
days before this run, and `#1499` has been merged since 2026-08-21. The brief
described a historical run, not the live queue; the queue that actually existed
was `#1841`–`#1856`.

The brief also asserted that `LEDGER_MAX_AGE_MS` had been raised to six hours
in source and rebuilt. It had not: `dist/hooks/dispatch.js` and
`src/scripts/hooks/block_unauthorized_git.ts` both read 30 minutes throughout.
The constant was not edited. `merge/command.md:313` records that this exact
widening was applied for a drain run on 2026-08-21 and reached the trunk, and
ADR-251 kept the 30-minute value deliberately on 2026-08-30.

The window was never the obstacle. ADR-252 provides standing merge grants,
which freeze PR *numbers* rather than a timestamp and are read outside the
freshness clock (`block_unauthorized_git.ts:738`). One maintainer prompt naming
the eight numbers authorized every merge below.

## Per-PR record

| # | Pos | Sync conflicts and resolution class | CI iterations | Disposition |
|---|---|---|---|---|
| 1854 | 1 | No content conflict. Remote head carried a commit the checkout lacked (a GitHub *Update branch* press); merged in, never forced over. | 1 | merged `1760014` |
| 1844 | 2 | Clean. Re-merged main a second time after `#1854` moved the base. | 1 | merged `cbd14ae` |
| 1849 | 3 | Clean. | 1 | merged `d8a0c06` |
| 1841 | 4 | Clean. | 1 | merged `2603a9f` |
| 1843 | 5 | Clean. | 1 | merged `1fa5780` |
| 1846 | 6 | Clean. | 1 | merged `dff51b1` |
| 1851 | 7 | `src/domains/meta/pack.yaml` — generated token passport. Regenerated, not hand-merged. | 1 | merged `cc5ac23` |
| 1848 | 8 | `agents/evidence/analysis/routing-body-signal-verdict.json` — generated record. Regenerated, not hand-merged. | 2 | merged `81f1088` |
| 1856 | — | Not handled by this run. | — | merged `ca109fa` by the maintainer at 05:31 |

## What was actually repaired

Every fix below was traced to the branch that carried it before being applied.
Where the question was decidable, it was decided by measurement rather than by
inspection: for `#1851` a worktree at `dff51b13f` ran the three failing
measurement tests **green**, which established that the corpus movement belonged
to the branch and not to an inherited red.

- **#1849** — `check_review_schema` refused `14.16.0.json` for an absent
  `review_independence`. The ledger was added by `c5073530e` on that branch and
  is absent from main. Values derived, not asserted: `self-review-gate.yml:60`
  passes only `ANTHROPIC_API_KEY`, so the review ran against a single Anthropic
  client, which forces `single-member` → `provisional` → `single-pass`.
- **#1841** — the scoped-dangle census read 25 against a pin of 24. The extra
  entry was a link the branch added to `feature-planning`, which is pruned under
  `projection.mode: scoped`. Repaired by naming the slug and its pack, the remedy
  the census states in its own `measured_branch`. The pin was not moved.
- **#1846** — `src/config/conformance-claim-baseline.json` existed and
  `SUPPRESSION_INVENTORY` did not declare it. Declared, with `newInThisChange`
  set so the flag closes itself one merge later.
- **#1851** — four bare `src/scripts/` paths in the shipped projection, plus
  three published records that stopped reproducing. Both measurement records were
  re-derived through their own `--write` path; the estate pin moved 11445 → 11444
  with the movement stated. Both verdicts are unchanged.
- **#1848** — `lint_canonical_terms` read 1012 against a baseline of 1007. All
  five new violations were in one file that carries zero on main. Fixed
  line-scoped; the count returned to 1007 and the baseline was not raised.

No test was deleted or skipped, no threshold was loosened, and no baseline was
raised to reach green. Two pinned numbers were re-derived — the estate token
pin and two measurement records — each with the reason recorded in its commit.

## Dropped edits

None. The one rewrite that changed authored prose is in `#1851`: four passages
in `code-intelligence/SKILL.md` named this repository's own source roots as bare
paths, which are dead once installed. They are named descriptively instead, so
the measurement they report survives in full. A first attempt used backticked
bare identifiers and tripped `lint_documented_commands`, which read them as
unresolvable command references; the backticks were removed rather than the
names.

## One PR deliberately left open

`#1858` — *feat(authz): remove the git-authorization gate — enforcement returns
to the model* — was opened by the maintainer at 08:31 while this run was in
progress. It is not in the grant that authorized this run, and it removes the
authorization gate that governed it, including `git_authorization_hook.ts` and
five test files. Left for an explicit, named decision.
