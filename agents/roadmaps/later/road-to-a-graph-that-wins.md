---
complexity: structural
status: later
parent_roadmap: road-to-a-graph-that-is-shipped
execution:
  mode: phase-checkpoints
owner: maintainer
entry_condition:
  what: >
    `road-to-a-graph-that-is-shipped` is archived AND ADR-260 § 5's two benchmark
    subject repositories are named in this file's corpus header. Both are required:
    without the parent, every measurement here scores an engine no consumer holds;
    without the named subjects, the corpus cannot be registered before the engine
    sees the repos, which is AC-1.
  when: >
    After the parent's Phase 4 lands and the owner fills the two subject names.
    No earlier date is meaningful — the parent's own AC-6 is the gate.
  who: >
    The owner, for the two subject names (ADR-260 § 5 reserves that choice); the
    maintainer, for confirming the parent is archived.
review_by: 2026-12-07
capability_gap: none
estate_growth_exempt: "Parked, not active: it may not start before its parent ships, because every measurement in it would otherwise measure an engine no consumer holds. Charges +1 later_roadmaps against the origin/main floor of 82 measured at 0918def55. All five receivers named here were re-verified present at that pin: internal/bench/code-graph/, src/scripts/detect_silent_catch.ts, src/scripts/detect_verification_tampering.ts, agents/evidence/release-findings/, src/scripts/_lib/paired_verdict.ts."
---
# Road to a graph that wins

> **Source.** Owner analysis round `inbox-2026-09-u` (2026-09-07), consumed to
> `agents/tmp.old/inbox-2026-09-u/`. Authored in the repository from that analysis under
> ADR-260 § 4; re-verified at `0918def55`. No third-party repository is a source of this
> plan — the two benchmark **subjects** ADR-260 § 5 reserves are test subjects the owner
> names in the corpus header, and this file wakes on that edit.

> Woken by its parent. The parent makes the graph *exist*; this one makes it *the reason a
> reviewer ranks the system above the field*. Both halves are measurements the field does
> not publish: an oracle-truth benchmark on third-party repositories with both arms' traces
> tracked in-tree, and a counterfactual review in which the graph-fed reviewer finds
> oracle-confirmed misses the plain reviewer did not — scored without an LLM judge.

## Goal
Register before measuring; measure on repositories in the owner's stack that this
repository does not own; publish both directions; and make deterministic gates read the
graph so that a wrong edge is traceable to a wrong verdict and back.

## Why the current benchmark cannot produce this
The v2 corpus scores file-level truth on this repository against a two-probe
word-boundary grep that reaches 0.917 recall; the +10 pp bar is unwinnable by
construction and every class ties (`internal/bench/reports/code-graph-vs-grep-inrepo-v2-rerun-2026-09-04.md:74-83`).
The earlier third-party registration lost its inputs — four question files absent on
re-run (`internal/bench/code-graph/PREREGISTRATION-inrepo-2026-08-28.md:11-16`). Both
mistakes are corrected by shape, not by effort: symbol-level oracle truth, and everything
tracked.

## Phase 1 — Reach, scoped (each language with fixture + corpus class)
- [ ] 1.1 Wire from the shipped bundle: vue, python, go, java (php/ts/js are wired).
      Blade via a directive scanner (`@include/@extends/@component/@livewire`, `<x-…>`),
      `resolved_via: directive-scan`; a compiled grammar is optional and later.
- [ ] 1.2 Relations `route` (route table → handler) and `depends_on` (manifests); the
      Laravel overlay statically: routes → `Controller@method`, Blade → view nodes,
      Eloquent relation methods → model edges, migrations → table nodes.
      verify: fixture app; `path "GET /invoices" "Invoice"` resolves route → controller →
      model.

## Phase 2 — Registration, then measurement
- [ ] 2.1 Corpus v3 registered **before the engine sees the repos**: two public OSS repos
      per ADR-260 § 5 (fitness: ≥ 200 routes, Eloquent relations, migrations, PHPUnit/Pest
      tests, TS/Vue frontend, permissive licence, active in 2026), named in the corpus
      header with role "benchmark subject", SHA-pinned, cloned by the runner. Suites: A
      regression (v2 unchanged) · B precise semantics · C application (route-trace,
      model → table, tests-for) · D negative-control only (a `threats.csv` sink no accepted
      path reaches returns empty) · E change impact incl. class 7 `change-impact-xplane` ·
      F agentic (24 tasks: localise-and-fix from issue text; PR review for missed callers).
- [ ] 2.2 Truth from an oracle arm (tsserver references; Psalm `--find-references-to` or
      LSP references for PHP), symbol level, 20 % human-checked, hop strata 1/2/≥ 3. The
      oracle lives only under `internal/bench/` and is never an arm or a provider.
- [ ] 2.3 Arms: A–E = grep (two-probe) / native / foreign `graph.json` (reader in
      `internal/bench`, mapping relation and confidence names). F = floor / floor + native
      tools. No "fused" arm.
- [ ] 2.4 Bars fixed at registration: A–E +10 pp recall at ≤ 5 pp precision loss plus a
      calibration diagnostic (predicted class vs gold, overconfidence rate); F primary
      **solved per 100k tokens ≥ 1.25× floor**, solved per minute, escaped-regression rate.
      Gate for F: `dispatch-event-capture-reliability` ≥ 95 %.
- [ ] 2.5 Run; publish both directions; no renegotiation. Record ADR-246/259's benchmark
      trigger as fired or not. Then, and only then, rewrite the skill description as a
      **class list** (which classes are graph-first, which stay grep-routine).

## Phase 3 — The gate feeder
- [ ] 3.1 Edge acceptance policy, one file: `accept: same-file, import-specifier,
      path-alias, psr4, route-table, test-import, directive-scan · refuse: name-lookup,
      dynamic`.
- [ ] 3.2 Detectors read edges: `detect_verification_tampering` + "test deleted whose
      subject keeps ≥ 1 accepted caller"; `detect_silent_catch` + "catch on an accepted
      path from a route/entry point". Each records the edges used; `paired_verdict`
      against the plain detector.
- [ ] 3.3 Finding invalidation: release-finding closures gain `affected_files[]` + evidence
      checksum; a change touching them flips the closure to `stale` and re-requests
      disposition (file-level; symbol-level when the finding schema gains `symbols[]`).
- [ ] 3.4 Requirement coverage as a query: ADR `basis:` lines → code nodes; requirement
      rows naming a path/symbol → code/test nodes.
- [ ] 3.5 **Counterfactual review.** Frozen 30-PR set (15 own, 15 from the subject repos);
      arms plain vs graph-fed reviewer; a miss counts only if the oracle confirms the edge;
      `paired_verdict` decides direction. Bar: oracle-confirmed miss on ≥ 40 % of PRs,
      ≤ 1 false miss per 10 PRs.
- [ ] 3.6 `code-graph prove` emits the bundle (corpus SHA, both reports, oracle version,
      `resolved_via` histogram, 3.5 record, staleness state) from
      `internal/bench/scorecard.yaml` (row → metric → artefact → bar → expiry).

## Null path, stated now
If fewer than 4 of the 6 scored classes win, the graph-first wording stays withheld and
the skill says which classes did not win; Phase 3 still completes, because the gate
feeder is the use the field does not have regardless of the retrieval verdict.

## Kill register
K1 oracle never an arm or provider · K2 no hidden benchmark inputs · K3 no LLM judge in 3.5
· K4 no "fused" arm on retrieval suites · K5 no language without fixture + class · K6 no
obligation inference in any pack/selection verb · K7 no external flow-analyzer adapters (S9 class; ingested findings only) ·
K8 no Fact-IR rewrite before a second provider emits the same edge family.

## Acceptance Criteria
- [ ] AC-1 Corpus v3 and the F task suite are tracked in-tree with hashes before the engine sees the subject repos.
- [ ] AC-2 The report publishes every class in both directions with the calibration diagnostic.
- [ ] AC-3 Both detectors consume accepted edges and record them; paired verdicts exist.
- [ ] AC-4 A closed finding flips to `stale` in a fixture when its affected file changes.
- [ ] AC-5 The counterfactual review is published with deterministic miss scoring.
- [ ] AC-6 `code-graph prove` emits the bundle from `scorecard.yaml`.
