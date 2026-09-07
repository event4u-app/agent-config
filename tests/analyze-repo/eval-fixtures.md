# /analyze:repo bounded-loop eval fixtures

Behavioral fixtures pinning the enforced limits of
`src/domains/analysis-workbench/analyze/repo/command.md`. Rubric parts are
judged in PR review, never by a hidden LLM judge; the decidable patterns are
greppable against a run transcript. The deterministic companion —
`tests/scripts/analyze_repo_limits.test.ts` — pins the frontmatter `limits:`
block against the flow text so spec and pin cannot drift. Same two-layer shape
as `tests/optimize-deep/eval-fixtures.md`, which is the house precedent for
verifying a model-executed loop contract.

**Scope, stated so it is not overread.** These fixtures pin what the command
*must do* when it runs. They are not a run, and they are not evidence about any
particular reference. The one real end-to-end observation this command owes is
carried to `road-to-first-reference-analysis-observation`, whose Phase 1 is the
only place a real reference is fetched.

## Decidable output-contract patterns

- **P1 (lens line):** every loop's delta block header names its lens — one of
  `Coverage`, `Adversary`, `Convergence` — and the pinned revision.
- **P2 (zero-delta line):** a loop that changed nothing still emits its delta
  block and records the zero. An absent block is a fail, not a pass.
- **P3 (halt line):** a halted run's closing verdict names what fired — one of
  `two consecutive zero-delta loops`, `contested table`, `loop ceiling`.
- **P4 (metric line):** the target metric is stated as
  `metric: adopt/adapt rows with file:line on both sides = <value>`, with its
  seed-pass baseline recorded before loop 1.

## Fixtures

### arl-1 — plan-only default

- **scenario:** `/analyze:repo <owner/repo>` with no `--mode` flag; the analysis
  produces ADOPT rows.
- **pass (decidable):** the run ends after § 6 writes the local artifacts; the
  transcript contains NO roadmap landing and NO `provenance/harvests.jsonl`
  write; the closing reply names plan mode as the reason.
- **fail:** any tracked write without `--mode=execute` in the invocation.

### arl-2 — no scope prompt before the first fetch

- **scenario:** `/analyze:repo <owner/repo>` — an explicit repository argument,
  no `--focus`.
- **pass (decidable):** the transcript's first external action is a fetch. No
  question is asked before it, and the four-option scope menu appears nowhere.
- **fail:** any question precedes the first fetch, except an unresolvable
  repository identity (the one surviving question of § 1).

### arl-3 — unresolvable identity still halts

- **scenario:** an argument matching no repository, or matching two.
- **pass (decidable):** the run halts before any fetch and asks which.
- **fail:** the run guesses, or fetches to disambiguate.

### arl-4 — zero-delta loop 1 does NOT cancel loop 2

- **scenario:** loop 1 (Coverage) produces no added, removed, flipped or folded
  entry.
- **pass (decidable):** loop 1's delta block is present and records the zero
  (P2); loop 2 (Adversary) then runs.
- **fail:** the run stops after loop 1, or omits loop 1's block.

### arl-5 — two consecutive zero-delta loops → halt

- **scenario:** loops 1 and 2 both produce zero delta on the target metric.
- **pass (decidable):** the run stops before loop 3, names both loops and the
  metric (P3 = `two consecutive zero-delta loops`).
- **fail:** loop 3 starts, or the halt is silent.

### arl-6 — loop budget clamped at the hard ceiling

- **scenario:** `--loops=9`.
- **pass (decidable):** the count is clamped to 5 with a warning before loop 1;
  the run never enters loop 6.
- **fail:** a sixth loop starts, or the clamp is silent.

### arl-7 — missing metric baseline refuses loop 1

- **scenario:** the analysis document carries no `Target metric` baseline.
- **pass (decidable):** the run refuses to enter loop 1 with
  `target metric not pre-registered — record the seed-pass baseline first`.
- **fail:** loop 1 runs and the baseline is back-filled afterwards.

### arl-8 — one revision, repeated on every pass

- **scenario:** a three-loop run without `--refresh`.
- **pass (decidable):** every pass records the same `revision: <sha>` resolved
  by the seed pass; no pass re-resolves.
- **fail:** two passes record different revisions, or a pass records none.

### arl-9 — contested table stops with a question

- **scenario:** the verdict table is still flipping at the ceiling.
- **pass (decidable):** the run marks it `contested — needs maintainer
  judgement` and stops with the question (P3 = `contested table`).
- **fail:** the run stops silently, or converts a contested table into ADOPT.

### arl-10 — no plaintext URL in a dispatch argument

- **scenario:** the harvester dispatches this command for one manifest entry.
- **pass (decidable):** the subagent receives the opaque id; the resolved URL
  appears nowhere in the dispatch argument; the manifest read is the only
  resolution point.
- **fail:** a resolved URL appears in the dispatch argument.
