# Pre-registration — labelled rows for the graph-backed detectors (road-to-a-graph-that-wins AC-3), 2026-11-06

Committed before any label exists. Design reviewed by the AI council (2/2 seats, anthropic and
openai, design lens, 2026-11-06). Runner: `internal/bench/code-graph/detector_labels.ts`, pure
parts pinned by `tests/scripts/code_graph/detector_labels.test.ts`.

## What a label is — and is not

Each label checks, from a source **independent of the graph**, the predicate the graph-backed
detector decides. It is a **predicate-conformance** label: whether the graph's `fire` / `quiet`
matches that predicate. It is not a judgement that a finding is harmful; both seats rejected
"real" as the name for it, and a pass here licenses no suppression and no blocking.

## Rows

From the 400-unit trunk windows of `self` (TypeScript) and `unopim` (PHP) frozen for 5.6
(`risk_calibration.ts extract`, same units), every finding of the two plain detectors:

- **`test-file-deleted`** — every row. Read at the **parent** commit, where the test still
  exists: the graph-backed form (`deletedTestReading`) on a graph built there (lanes on), and the
  label from the oracle there. At the head the test is gone and the graph form cannot answer.
- **silent catch** — a seeded sample (seed 20261106) of **40** `unopim` rows and **20** `self`
  rows, read at the commit that adds the catch (`entryPathReading`, graph built there).

## Labels

- **`test-file-deleted`:** the subjects are the production (non-test, non-vendor) declarations
  the deleted test references per the oracle (SCIP for TypeScript; for PHP the class-likes the
  test names, confirmed by Psalm as referenced from the test). The label is **true** iff at least
  one subject has an oracle reference from a file other than the test and its own declaring
  file. A test the oracle cannot see referencing anything is **unknown**, never negative.
- **silent catch, PHP:** an independent agent session (`claude-sonnet-5-5`, tools Read/Grep/Glob
  only, in the checkout at that commit, no instruction files, never shown the graph's answer)
  is asked whether the catch's code is reachable from an HTTP route through the action the route
  names and method calls from there; `yes` / `no` / `unknown`, with its path. `unknown` is
  unlabelled. The prompt is in the runner (`ADJUDICATOR_PROMPT`). No depth bound is given to it,
  so a path the graph's depth-12 walk misses is not missed the same way.
- **silent catch, TypeScript:** this repository has no HTTP entry points, so its catches are
  **domain controls** — the graph's calls are reported, no label is assigned, and they never enter
  a verdict.

## Verdicts

Per detector and per subject, never pooled: `pairedAgainstPlain` (exact one-sided sign test over
discordant labelled rows, the repository's `paired_verdict`). Rows the graph did not answer and
unlabelled rows stay out. Each row records the accepted edges the graph-backed form used.

## Council revisions and the recorded split

Adopted from both seats: the predicate-conformance framing; per-subject verdicts; TS catches as
domain controls; `unknown` never folded into negative; the deleted test read at its parent;
callable / referencing evidence instead of mere presence; recorded edges per row. **Split:** on
whether an `underpowered` paired verdict discharges AC-3's "paired verdicts exist". openai: yes —
the criterion asks that verdicts exist, not that they are decisive. anthropic: an underpowered
result is rows without a verdict, and accepting it is a scope change. Resolved here by the
type the criterion names: `underpowered` is one of `paired_verdict`'s four outcomes, so a
computed `underpowered` verdict is a paired verdict; the report states the dissent beside it.

## Honest limits

- The PHP silent-catch label is a model's code reading, independent of the graph but not of
  model error; its `unknown` rate is reported.
- Psalm records no global-function call sites; a PHP test whose only subject is a function is
  unknown.
- Small n: 23 deletions in total; a decisive verdict is not expected for that detector.
