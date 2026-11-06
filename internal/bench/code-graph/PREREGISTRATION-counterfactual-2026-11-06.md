# Pre-registration — counterfactual review (road-to-a-graph-that-wins 3.5), 2026-11-06

Committed before any PR set exists and before any reviewer call. The design was put to the
AI council (2/2 seats, anthropic and openai, design lens, 2026-11-06) and revised on its
convergent findings, listed under § Council revisions. Runner:
`internal/bench/code-graph/counterfactual_review.ts`; its pure parts are pinned by
`tests/scripts/code_graph/counterfactual_review.test.ts`.

## The claim this run can make, and the one it cannot

The roadmap asks whether a reviewer fed the graph's review checks and read list catches
callers a plain reviewer misses. Truth here is **oracle-confirmed references**, so a positive
result supports **assisted dependency retrieval**: the reviewer, given the graph's packet,
names more of the files that reference what the diff changed. It does **not** establish
better code review — a referencing file is a dependency, not a defect or a mandatory
co-review. Both seats called that line the hardest one; it is stated here so the result
cannot be read past it.

## Population

Caller-bearing PRs only, and stated as such: the result speaks about PRs whose changed
symbols are referenced from outside the diff, not about PRs in general.

| Subject | Source of PRs | Quota | Language scored |
|---|---|---|---|
| `self` (this repository) | merged PRs into `main` of `event4u-app/agent-config` | 15 | TypeScript under `src/scripts/` |
| `unopim` | merged upstream PRs of `unopim/unopim` whose merge commit is an ancestor of the v3 pin `56071226` | 8 | PHP |
| `larasend` | merged upstream PRs of `savvyagents/larasend` whose merge commit is an ancestor of the v3 pin `da5c06c7` | 7 | PHP |

If `larasend` yields fewer than 7 eligible PRs, the shortfall is taken from `unopim` by the
same rule; the report names the final split.

**Cutoff:** PRs merged before this document's commit. **Order:** newest merge first; a PR is
taken or skipped by the rule alone, and every skip is written with its reason to
`freeze-log-<subject>.jsonl`. **Eligibility**, all of:

1. the merge commit exists in the subject clone and is an ancestor of its pin;
2. at most **800** changed lines (`git diff --numstat` parent..merge, added + deleted);
3. the diff modifies, deletes or renames at least one existing non-test source file of the
   scored language (`isTestFile` decides "test");
4. at the parent commit, at least one declaration (function, method, class, interface,
   trait, enum, constant, type) contains a parent-side hunk;
5. at the parent commit, the oracle reports at least one reference to such a declaration
   from a file outside the diff.

A PR is a **PR** — its merge commit and that commit's first parent — never an arbitrary
commit. The frozen set is committed before the first reviewer call; no case is replaced
after that.

## Truth

At the parent commit: the **changed symbols** are, per parent-side hunk, the innermost
declaration containing it (a pure insertion counts at its anchor line). A changed symbol is
**signature-touched** when a hunk covers its first line, otherwise **body-only**.

**T(p)** = the files outside the diff holding an oracle reference to a changed symbol.
TypeScript: scip-typescript 0.6.1 in the pinned oracle image over `tsconfig.scripts.json`,
references mapped onto graph nodes by `scipEdges`. PHP: Psalm 7.0.3 in the same image,
declarations mapped by `phpSymbolMap`, references read by `psalmRound`; Psalm records no
location for a global-function call, so a changed global function contributes nothing (2.6).
Both run `--network none`. Test files count and are reported as a stratum.

**Dependencies at historical commits.** Each parent checkout receives the pin's
`node_modules` / `vendor` (APFS clone), not a per-commit install. Framework symbols can
therefore differ from what the commit locked; references between the subject's own files —
what T counts — do not depend on them. Stated, not corrected.

## Arms

Same model, same prompt, one fresh call per arm per run; the arms differ only in what
follows the pull request.

- **A** — title and unified diff.
- **B1** — A plus the Phase 5 check results and the 4.7 read list, as structured lines.
- **B2** — A plus the **same** payload rewritten as prose. Both renderings come from one
  frozen `payload.json` per case (`renderB1` / `renderB2`), and the test pins that every fact
  appears in both.
- **G** — no model: the read-list files outside the diff. It shows how much of B1 the packet
  alone carries; the read list is the intervention the roadmap names, so B1 keeps it, and G
  is what tells copying from contribution.

The graph for B1, B2 and G is built by this branch's engine at the **merge** commit, with
`review-risk --diff <parent>` — what a reviewer of that PR would hold. History at the merge
commit ends at the merge itself; the PR's own commits only touch files inside the diff, so
they cannot reveal an outside co-change partner.

**Reviewer.** `claude-sonnet-5-5` through `claude -p --tools "" --safe-mode --output-format
json`, from an empty temporary directory: no tools, no instruction files, no hooks, no
repository on disk. The prompt (`PROMPT_HEAD`) asks for the files outside the diff that
reference a symbol the diff changes, as `{"files": [...]}`; the PR text is fenced as data.
**3 runs** per arm per case. A reply without a parseable list is retried once; a second
failure records the run as invalid.

## Scoring (K3: set comparison, no LLM judge)

Per case and arm, the **majority set** is the files named in more than half of the valid
runs; paths are normalised and files inside the diff dropped. Recall is over T.

- **Bar (i)** — on at least **40 %** of cases (12 of 30), B1's set holds a file of T that A's
  set does not.
- **Bar (ii)** — summed over all cases, the files B1 names that are neither in T nor named by
  A number at most **one per ten cases** (3 of 30). Counted regardless of where the name came
  from.
- **Direction** — `paired_verdict` (exact one-sided sign test on per-case recall deltas,
  ties excluded) for B1 vs A; also reported, deciding nothing: A vs B2 and B1 vs B2. The mean
  delta is printed as triage only.

The Phase 5 checks leave **advisory** only if bar (i), bar (ii) and a `pass` for B1 vs A all
hold. Anything else keeps them advisory; that is a complete result.

**Strata, reported, deciding nothing:** signature-touched vs body-only cases; production vs
test files in T; arm G beside the model arms.

## Invalid run versus null

The run is **invalid** — not a null — if more than 3 frozen cases end without a packet or
with a model arm whose three runs are all invalid. A case is never replaced after the freeze.
A wide or tied result is **inconclusive**, also not a failure of the run.

## Council revisions (2026-11-06)

Adopted from the convergent findings of both seats: the retrieval-only claim; the explicit
caller-bearing population; real PR boundaries; the exact model id and run count fixed here;
the majority-set decision procedure; arm G; B2 rendered mechanically from the same payload
and compared with B1 directly; invalid-versus-null rules; repository text fenced as data;
strata for tests and signature changes. **Not adopted:** removing the read list from B1 (one
seat; the other and the roadmap text keep it as the intervention under test); a human audit
of the oracle (one seat; 2.6 measured the oracle's precision directly); a magnitude bar
replacing the roadmap's (one seat; `paired_verdict` decides direction by the repository's own
rule, and the magnitude is printed).

## Honest limits

- 30 cases and 3 runs: a large effect can show; a small one cannot.
- One model, one provider. A second reviewer model is a separate registration.
- Truth is reference-level only (see the first section).
- The own-repository PRs are recent and authored by agents working on this graph; the
  subject PRs are third-party.
- Psalm's blind spot for global functions removes those changes from the PHP truth.

## Hashes (SHA-256, `shasum -a 256`)

Any later change to these inputs voids the run unless an addendum below, committed before
the first reviewer call, names the change and its reason.

```
4a13e4bbeb391984af5338ca9e474f844a5ae2e4c93d10603ad4f23139118968  internal/bench/code-graph/counterfactual_review.ts
9cfb7248761ee30be1df17a0dd39fa3d8f58cc0a7ba9ff64d3e172abdccd7769  tests/scripts/code_graph/counterfactual_review.test.ts
2905d55617a1f5bdc28820b26f9e0883c700082ea0de103c759172f31b4ff7a4  internal/bench/code-graph/php_edge_oracle.ts
194f5b0cfd4655b286a274bb17b1bfe05e3fc70ddfb09b22283714e23d09be41  internal/bench/code-graph/oracle_truth.ts
125e0ca86154a029fd6d44afd121e34517568d4c81abfa06f14ba11a6404ca67  src/scripts/code_graph/scip_reader.ts
```

## Addenda

**A1 (2026-11-06, before any reviewer call): runner fixes found by the freeze.** Two
changes, no rule changed. (1) scip-typescript ran out of heap inside the oracle image on
every `self` parent (exit 133); it now runs with `NODE_OPTIONS=--max-old-space-size=8192`.
(2) A build or oracle failure was logged as a skip, which would have biased the set toward
PRs the tooling handles; it now stops the freeze, which resumes after the fix. The seven
`self` rows written as such failures were removed from the log and re-evaluated in order.
The `unopim` and `larasend` logs held none. New runner hash:
`1fc118b937bed9dae33cce2f8b7a19a67394ccb6afc59c28a0952d0f333a0ff8  internal/bench/code-graph/counterfactual_review.ts`.
