# Findings: road-to-plan-governance-gates
<!-- completion-review: v1 | reviewed: 2026-08-04 | scope: e1e75d7f8dcb8c1df5325cfdbf10c530a54e6b73aa8db0f79e24c46fd339d3a8 | diff: 39f071fad58dc2c5cb9e6ec87e8e37b79085db2f | reviewer: r2-fresh-subagent-road-to-plan-governance-gates -->

<!-- context-manifest: v1
inputs:
  diff_sha: 39f071fad58dc2c5cb9e6ec87e8e37b79085db2f
  scope_hash: e1e75d7f8dcb8c1df5325cfdbf10c530a54e6b73aa8db0f79e24c46fd339d3a8
  roadmap: agents/roadmaps/archive/road-to-plan-governance-gates.md
  roadmap_hash: 7be2dc5ef4ca9bbda0e022e39a2a62c55c5fb9823dbcac734a0bbe2756cd7241
  ac_hash: 1c3cd7678aacae91ea045d13cde1f09e0bd97738d2f5a63857a2da04efc48dca
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-04T12:33:11Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/check_completion_review.ts:391 | `scanFences` pairs fence lines POSITIONALLY, so it detects parity but never mis-pairing. Two unpaired triple-backtick openers (two `~~~`-wrapped illustrations, each holding one unpaired inner opener — the exact shape `markdown-safe-codeblocks` produces, and the shape the round-7 fixture uses) pair with EACH OTHER: every line between them is added to `fenced` and silently skipped, `unterminatedAt` stays `null`, and no `malformed-row` fires. Verified by running `parseArtifact` on such an artefact: an `open` row placed between the two strays disappeared from `rows` while a later terminal row kept `rows.length > 0`, so the neither-table-nor-honest-null fallback stayed quiet too — the artefact PASSES with an unreviewed `open` finding. Same silent fail-open the round-7 change closed for ODD parity, one route further along; the contract's "and it swallows nothing" and the header comment's "never swallows the rest of the artefact" hold only for the odd case. Secondary: `unbalancedFenceAt` is a single number, so with three or more strays only the LAST opener is ever named. | fixed | 9937ad9b7 — a bare ``` never delimits a region (only a closed pair with an info string does); strayFenceLines names every stray. Verified on the reviewer's counterexample with the shipped parser: the vanished row parses (1/open), strays [8,12] reported |
| 2 | low | src/config/gate-coverage.yml:333 | The honesty note says a moved reviews root "exits before the inventory and reports `scanned: 0`". The code does the opposite ordering and says so itself (`check_completion_review.ts:1124` — "the artefact inventory needs no git, so it is resolved FIRST"): the inventory RUNS, yields zero artefacts and an unresolved root, `scanned: 0` is emitted from it, and only then does the dead-scope branch return. The substantive claim (the guard can read a 0) is correct; the mechanism as written contradicts the implementation it describes. | deferred | roadmap: agents/roadmaps/later/road-to-plan-gates-measurement.md — note-only claim wording in a gate-coverage honesty block; no behavioural effect, waits for the measurement pass that revisits that entry |
| 3 | low | src/config/gate-coverage.yml:325 | The note treats the dead-scope path as the ONLY route to `scanned: 0` ("that path is the dead-scope violation below"). There is a second: the `planning.completion_review: false` escape hatch prints `scanned: 0` and returns 0. On a repo with the hatch set, `min_scanned: 1` therefore trips on a legitimately configured skip — a coverage-guard red that signals no policy violation at all. Latent here (the hatch is unset), but the enumeration is incomplete and the floor is not as inert as the note states. | deferred | roadmap: agents/roadmaps/later/road-to-plan-gates-measurement.md — latent only while the escape hatch is unset; belongs with the floor/threshold work that re-derives min_scanned |
| 4 | low | src/scripts/dispatch_r2_reviewer.ts:380 | The newly added §2.2 fence rule states, as a general parsing rule, that lines inside a closed fence are illustrative content and are not parsed. `parseManifest` is fence-blind — it regexes the whole artefact text — so a manifest block quoted inside a closed fence still satisfies the §5 `missing-manifest` check, while the marker, honest-null, skip and table grammars are all fence-aware. Impact is bounded (a quoted manifest must carry the CURRENT `scope_hash` or `manifest-header-mismatch` fires), but contract text and code disagree on what a closed fence hides. | deferred | roadmap: agents/roadmaps/later/road-to-plan-gates-measurement.md — bounded by the scope_hash agreement check; fence-aware manifest parsing waits so the parser is touched once, together with finding 1 |
| 5 | low | src/scripts/check_completion_review.ts:234 | The rationale added for build/IaC files ("production behaviour lives here as much as in application code") does not reach the canonical CMake entry point: `cmake` is now a code extension and `makefile` a code basename, yet `CMakeLists.txt` still classifies as non-code — and because `txt` sits in `GENERATED_TAILS`, adding the stem to `CODE_BASENAMES` would not fix it either. Same class for `docker-compose.yml` and `.github/workflows/*.yml`: a build- or CI-only completion can still claim "no code surface" and take the §2.4 skip path, which is the hole the round-6 finding named. | deferred | roadmap: agents/roadmaps/later/road-to-plan-gates-measurement.md — §2.4 corpus widening is its own decision (yaml would reclassify nearly every diff); waits for the measured skip-path data |

## Binding-review disposition

Round 8, scope `e1e75d7f8dcb8c1df5325cfdbf10c530a54e6b73aa8db0f79e24c46fd339d3a8`.
Counts: 5 findings — 0 critical, 1 high, 0 medium, 4 low.

This is the binding review for that scope: it is the artefact the gate reads
(`<slug>.findings.md`), re-bound in place per § 2.5 / § 2.7 rather than renamed.

The loop is **not** cut here. Findings 2-5 are terminal (`deferred`, each with a
roadmap ref) and every other residual is a declared limitation — the
`enforced_by: none` blocks, the narrower R1 corpus table, the Stage-A advisory
window and the § 2.5 ancestry limit. Finding 1 is a **high** and stays `open` on
purpose: it is a reproducible silent fail-open of the same class the last three
rounds narrowed (an unreviewed `open` row passing), so it is routed to the
maintainer for a code fix plus a re-review rather than dispositioned by the
reviewer who found it. An eighth round with a high open is not a closure.

## Round-8 disposition

1 `fixed` (the fourth fail-open route), 4 `deferred` to
`agents/roadmaps/later/road-to-plan-gates-measurement.md`. 0 critical.

This round is the reason the loop was worth running past its first clean
verdict: round 7 reported 0 critical / 0 high, and round 8 then demonstrated —
by running the SHIPPED parser on a counterexample, not by argument — that the
round-7 fence fix closed only the odd-parity half. A blind reviewer with an
executable disproof beat two consecutive clean rounds.
