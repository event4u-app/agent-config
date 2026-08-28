# Pre-registration — code-graph vs grep, in-repo corpus (2-arm, deterministic)

Registered 2026-08-28, **BEFORE the first run of this benchmark**. Fulfils
`road-to-code-graph-evidence-that-exists` step 0.2. The ordering is not a
courtesy: AC-2 of that roadmap requires the pre-registration commit to precede
the first result commit, checkable from `git log --follow` on the two paths
rather than asserted here.

## Why this document exists beside the 2026-07-28 one

The original pre-registration binds four question files by SHA-256 that live
outside the public tree, against three private third-party repository clones.
Re-run probe, 2026-08-28: all four pinned files absent, `find` over the whole
projects tree returns 0 for both `repo-?-questions.yaml` and `probes.yaml`, and
exactly one commit has ever touched the report file. That benchmark cannot run
here and its obligation is retired separately, on its own null path.

This is a **different, smaller benchmark against corpora this repository
actually contains**. It is registered under its own name and its own document
precisely so that nothing here can be mistaken for a re-run of that one.

## NOT COMPARABLE — stated before any number exists

```
NO DELTA MAY BE COMPUTED BETWEEN THIS RUN AND THE 2026-07-28 RUN.
DIFFERENT CORPUS. DIFFERENT QUESTION SET. DIFFERENT BUILD. DIFFERENT BARS.
A SUBTRACTION BETWEEN THE TWO IS A FABRICATED RESULT IN EITHER DIRECTION.
```

Three independent reasons, any one of which is sufficient:

1. **Corpus.** That run measured three private repositories — a Laravel
   monolith, a TypeScript/React frontend, and a mixed legacy repo. This run
   measures three TypeScript subtrees of this repository.
2. **Question set.** 18 questions there, 16 here, sharing no item.
3. **Build.** That run predates the 2026-08-22 extractor repair; this one is on
   `HEAD` and the runner asserts that mechanically (below).

## What is measured — and what is not

**Measured:** tool-level retrieval quality. For each pre-registered question,
each arm receives the SAME single probe token and returns a set of files; the
sets are scored against ground truth established by reading the source. Zero
model calls, zero spend, re-runnable by anyone with the repository.

**Not measured:** agent-in-the-loop answer quality. An agent can compose several
greps, read files, and reason; none of that is in scope. Declared here, before
any result exists. Also not measured: any language other than TypeScript, and
any cross-repository question.

## Corpus roots — inside this repository, no borrowed identity

| Root | Path | Scale |
|---|---|---|
| `code_graph` | `src/scripts/code_graph` | 11 TS files, ~2.5k lines |
| `shared` | `src/shared` | 13 TS files, ~1.8k lines |
| `ai_council` | `src/scripts/ai_council` | 53 TS files, ~24k lines |

Every question's ground-truth path resolves inside this repository. No external
clone, no consumer repository, no anonymized third-party identity. A test
asserts this over the corpus file rather than leaving it to review.

## Questions — bound by content hash

16 questions, in the corpus file
`internal/bench/code-graph/inrepo-corpus-2026-08-28.yaml`, which is **tracked**
(unlike the 2026-07-28 set, which could not be published) and bound here by
SHA-256. Any post-registration edit changes the hash and voids the run:

```
52d69c1bd994cb326926fd1d0a77e3b70b122daac5d1222ea5528e382bf20372  inrepo-corpus-2026-08-28.yaml
```

Category split, fixed before any result:

| Category | Count | Shape |
|---|---|---|
| `callers` | 3 | which files call/reach symbol X |
| `transitive-impact` | 3 | which files are affected if X changes (multi-hop) |
| `path-between` | 3 | is there a call path from A to B, and through what |
| `references` | 3 | where is X referenced / imported / declared |
| `negative-control` | 4 | grep is obviously sufficient; the graph should add nothing |

Graph-shaped = the first four categories (12 of 16). Negative controls are
**25 %** of the set, which is the floor step 1.2 requires, and they exist so a
per-class report cannot be read as a blanket win.

## Arms — uniform strategies, no per-question tuning

- **Arm A (grep):** `git grep -n` over the root's tracked files. Probe kind
  `symbol` → `-P '\b<probe>\b'`; kind `literal` → `-F`. Answer = files with ≥ 1
  hit. No graph access.
- **Arm B (code graph):** `code_graph/cli.ts build --root <root>` once per root
  (build time recorded separately, amortized), then per question `affected
  <probe>` and `query <probe>` at `--budget 500`. Answer = files appearing in a
  returned relation endpoint whose symbol segment matches the probe. No grep
  access.

Both arms are given the identical probe token. The arms are the same two
strategies the 2026-07-28 runner used; only the corpus and the bars differ.

## Metrics (per question, per arm)

- **Recall** — |answer ∩ truth| / |truth|
- **Precision** — |answer ∩ truth| / |answer|
- **Missed / wrong** — explicit file lists, in the committed report (these paths
  are in-repo, so unlike the 2026-07-28 run there is nothing to withhold)
- **Wall time** per question + arm; build time reported separately
- **Output bytes** per arm, as a context-cost proxy

## Pass bars — PER QUESTION CLASS, declared before the run

Resolved by AI council 2026-08-28 (anthropic + openai, 1 round, $0.00, 2/2
convergent): **per-question-class bars**, because the decision this evidence
feeds is a routing decision per class, and a single aggregate answers a question
nobody is asking. Both seats named the same cost — per-class bars give more
degrees of freedom for reading a favourable class as the headline — and the same
mitigation, which is that every class and its bar is fixed here, now, before any
number exists.

For each of the four graph-shaped classes independently:

> **The graph WINS that class** iff mean recall(B) − mean recall(A) ≥ **+10
> percentage points** on that class, AND mean precision(B) ≥ mean precision(A) −
> **5 pp** on that class.

Class verdicts are `WIN`, `NULL`, or `TIE` (delta strictly between −10 pp and
+10 pp with the precision floor held).

Two conditions apply across the whole set and are **not** per class:

- **Negative-control floor:** mean recall(B) ≥ 0.9 × mean recall(A) on the four
  controls. A graph that collapses where grep is the ideal tool fails this
  regardless of how any graph-shaped class scored.
- **Macro-average is reported, and is explicitly NOT a pass criterion.** It is
  printed so a reader can see the aggregate the old run would have reported; no
  verdict is derived from it.

**A class that fails is published identically to a class that passes.** An
honest null is the most likely outcome of this benchmark and is a complete
success of the roadmap that registered it.

## Build assertion — mechanical, not read by eye

The runner records the commit under measurement and **asserts that its committer
date is on or after 2026-08-22**, the date of the extractor repair. A run on an
older build exits non-zero rather than producing a report. This is AC-4, and it
is checked by the runner rather than stated in prose.

## Publication policy

- The report lands at `internal/bench/reports/code-graph-vs-grep-inrepo-2026-08-28.{md,json}`,
  **without touching** `code-graph-vs-grep.{md,json}` — the 2026-07-28 figures
  are not overwritten, edited, or re-scored.
- **No new `docs/CLAIMS.md` entry.** Resolved by AI council 2026-08-28: the
  `kind` enum is `{quant, qual, comparative}` and none of the three makes two
  recall figures incomparable by construction, so publishing this as a second
  claim would put two subtractable numbers on the published surface. The
  existing `claim:code-graph-retrieval-null` instead gains an explicit
  superseded-build note and a pointer to this report.
- The result is published **whichever way it lands**.

## What this run may and may not change

It may change **routing** — which question classes the code-intelligence skill
and the interop rule name as graph-first. It may **not** change permission: no
setting default moves, and no dependency moves between `devDependencies` and
`dependencies`. That question belongs to ADR-246, and reopening it is a separate
change under `decision-revisit-gate`, on evidence this run produces rather than
by this run.

## Runner

`internal/bench/code-graph/run_bench_inrepo.ts` — committed alongside this
document; verifies the corpus SHA-256 against the value above before running and
refuses on mismatch.
