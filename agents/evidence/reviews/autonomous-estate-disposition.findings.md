# Findings: autonomous-estate-disposition
<!-- completion-review: v1 | reviewed: 2026-08-19 | scope: 84b9f44f79e487ca6cbc1bbee3752b93672b671754601aefe7b02b806f53aec2 | diff: e822631c097b2aed4d9e80f5ef5c93d381703976 | reviewer: r2-fresh-subagent-autonomous-estate-disposition | prompt_hash: 26ec3f5556c8f623f7879ca59847ace182839328f928641baf2abc96c6eb17d8 -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-08-19 -->

<!-- context-manifest: v1
inputs:
  diff_sha: e822631c097b2aed4d9e80f5ef5c93d381703976
  scope_hash: 84b9f44f79e487ca6cbc1bbee3752b93672b671754601aefe7b02b806f53aec2
  roadmap: agents/roadmaps/later/road-to-surface-consolidation.md
  roadmap_hash: 910c33257055c138481b70841fc3e1479d50d48b136058edf6d28d063381e380
  ac_hash: 92bc7ed0761690c0a8e42cad7a4a0561dba938492856e1d5b93029f71e61ca70
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-19T22:01:17Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | agents/roadmaps/later/road-to-carrier-layer-convergence.md:47 | Relative links were not re-depthed when the two roadmaps moved one level down into `later/`. Four links now resolve one directory too high: `../evidence/analysis/...` (lines 47, 82) resolves to `agents/roadmaps/evidence/...` and `../../docs/decisions/ADR-228-...` (line 68) to `agents/docs/...`; same defect at `later/road-to-surface-consolidation.md:339` (`../../docs/decisions/ADR-216-...`). Verified: `agents/roadmaps/evidence` does not exist, while all four intended targets do exist at `agents/evidence/analysis/` and `docs/decisions/`. The link TEXT on lines 47 and 82 even spells the correct `agents/evidence/analysis/...` path the href no longer reaches. | fixed | 51ec40b88 |
| 2 | medium | src/agent-src/scripts/update_roadmap_progress.ts:838 | `resume_cell` extracts a single raw LINE, but roadmap prose is hard-wrapped, so most cells stop mid-clause. In the regenerated dashboard 39 of 52 rows end without a sentence terminator — e.g. `Parked 2026-08-19. Resume when the before/after delivered-token pair for`, `Resume when any roadmap carrying`, `Resume when EITHER: (a) the orchestration claim queue is free and the` — and one row (`road-to-cross-model-residuals.md`) quotes a bare section heading, `## Resume when / Trigger`, which states no condition at all. This is the same "table cells that were wrong rather than short" failure the function's own docstring says the two-tier design prevents; the second tier addressed only the loose-marker case, not the wrapping. Identical code in `dist/agent-src/scripts/update_roadmap_progress.ts:838`. | fixed | 51ec40b88 |
| 3 | medium | src/agent-src/scripts/update_roadmap_progress.ts:856 | Scope asymmetry between the two tiers: `RESUME_STATEMENT` is tested per line, `RESUME_LOOSE` (line 783, `/\btrigger\b/i`) against the WHOLE file. That pattern matches inside hyphenated words — the docstring's own `mixed-trigger-cleanup` example — and in ordinary roadmap prose, so `unlabelled: true` is asserted for any parked file containing the word "trigger" anywhere, whether or not a resume condition exists. Effect in the generated output: 9 rows read `condition present but unlabelled` and exactly 1 reads `no resume line recorded`, so the two states no longer distinguish "gate-passing marker present" from "nothing recorded" — the distinction this tier was added for. | fixed | 51ec40b88 |
| 4 | medium | src/agent-src/scripts/update_roadmap_progress.ts:843 | Only `**` and the pipe character are neutralized before the extracted line is emitted into a Markdown table cell; all other inline markup passes through verbatim. Already visible in the committed dashboard: the `road-to-council-api-quota-source-split.md` row emits a raw `<!-- ref-ignore -->` into a table cell. Since roadmap resume paragraphs in this tree routinely carry multi-line HTML comments, a matched line that opens `<!--` without closing it on the same line would comment out every following line of the generated dashboard — a silent whole-artefact failure with no test covering it. | fixed | 51ec40b88 |
| 5 | medium | agents/roadmaps-progress.md:5 | Parking removed three open, owner-gated blockers from the reader-facing dashboard: the header falls from `**51** open blockers, **23** need you` to `**48** open blockers, **21** need you`, and the deleted per-roadmap sections took `b-convergence-machine`, `benchmark-spend` and the counted `repo-admin-and-usage` entry with them (grep over the regenerated file returns 0, 0, and a single incidental prose mention at line 252). The new Parked table carries only `Roadmap` and `Resume when`, so no blocker information survives anywhere in the dashboard. `src/config/estate-count-budget.json`'s new history row states that an `open_blockers` metric spanning active AND `later/` is "the check that this is a park and not a burial, since ... parking cannot print a free tightening over a blocker nobody resolved" — the generated dashboard prints exactly that tightening for its own blocker counters. The two header counters also moved inconsistently with each other, -3 open against -2 need-you, for three removed owner-gated entries. | fixed | 51ec40b88 |
| 6 | low | src/agent-src/scripts/update_roadmap_progress.ts:852 | Truncation runs AFTER the pipe-escaping pass, so `line.slice(0, 197)` can cut between an inserted backslash and the pipe it escapes, emitting a dangling backslash immediately before the ellipsis. Truncation is live in the committed output (the `road-to-mcp-full-power.md` row ends `... left z...`), and no test exercises the over-200-character path or a cell containing a pipe. | fixed | 51ec40b88 |
| 7 | low | src/agent-src/scripts/update_roadmap_progress.ts:930 | `render`'s new third parameter (`roadmap_root`, nullable, default `null`) silently omits the entire Parked section (line 1067), and its justifying comment says a caller renders without a root because "the unit tests do". There is exactly one call site (line 1248) and it always passes the root, and no test in `tests/scripts/update_roadmap_progress.test.ts` calls `render` at all — every case goes through the CLI via `runTs`. The defaulted null is unused flexibility whose failure mode is a dashboard that loses a whole section without erroring. | fixed | 51ec40b88 |
| 8 | low | agents/roadmaps/later/road-to-run-continuation-observation.md:432 | The added note (lines 411-431) states that this roadmap is parked and that the active autonomous estate is "intentionally zero", while the immediately following untouched bullet — the trailing context line of the same hunk — still reads "this roadmap stays in the active estate at 3 of 4 items", in a file that now lives under `later/`. Two adjacent sentences contradict each other on the roadmap's own disposition. | fixed | 51ec40b88 |


## What this round found that the change's own author did not

Eight findings on a change whose subject was honesty about a metric — and the
highest-value one is that the change published the exact dishonesty it was arguing
against.

**Finding 5 is the one to read.** The estate ratchet's `open_blockers` metric spans
active AND `later/` for a documented reason: so that parking a roadmap cannot print
a saving over a blocker nobody resolved. The commit message asserted that property
in the budget row. The generated dashboard, in the same commit, took its header from
51 open / 23 need-you to 48 / 21 — because that count is active-tree only. Both
statements were individually true and the artefact a human reads was misleading. A
guarantee enforced on one surface is not a guarantee.

**Finding 1 is a repeat of a recorded lesson.** Moving a file one directory deeper
re-depths its relative links, nothing does that automatically, and the author's own
notes carry that as a named trap. It was checked on the roadmap parked the previous
day and not on these two — so the miss was not ignorance of the rule but failure to
apply it twice.

**Findings 2, 3, 4 and 6 are all one shape:** a text-extraction routine shipped
against 52 real inputs after being reasoned about rather than measured over them.
39 of 52 cells stopped mid-clause, an HTML comment reached a live cell, the two
matching tiers ran at different scopes, and truncation could sever its own escape.
Every one of them is visible in the generated file the commit contained.

**Finding 7 is worth naming separately** because it is the same defect class as the
previous branch's high: a comment stating a false premise. "Nullable, because the
unit tests render without a root" — no test calls `render`. Making the parameter
required then surfaced two call sites the finding itself had missed, in
`mcp_server/tools.ts`, each of which would have silently dropped the new section
from an MCP-triggered regeneration. The reviewer's own scope claim was too narrow
and the compiler was the thing that knew.

Two of the five new tests were falsified against the pre-fix code. Finding 3's fix
is recorded as changing no output on the live tree, because it does not — stating
that is cheaper than letting a later reader assume a count moved.
