---
complexity: structural
status: ready
parent_roadmap: road-to-a-graph-that-is-shipped
execution:
  mode: phase-checkpoints
owner: maintainer
entry_condition:
  what: >
    `road-to-a-graph-that-is-shipped` is archived AND ADR-260 § 5's two benchmark
    subject repositories are named in this file's `## Corpus header` section — the
    two rows of its table, created empty 2026-10-06 by blocker `b4` of
    `road-to-leading-every-row` because the heading this condition named did not
    exist until then. Both are required:
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
estate_growth_exempt: "THIS CHANGE (2026-10-26) moves this roadmap from later/ to active: active_roadmaps +1, later_roadmaps -1. Its entry_condition holds in the tree — the parent road-to-a-graph-that-is-shipped is archived and the owner named both benchmark subjects in the corpus header on 2026-10-23 — and the AI council decided the wake 2/2 on 2026-10-26 (agents/evidence/council/open-questions-inbox-aw-20261026.md). Active count becomes 5, the WIP cap of the owner directive of 2026-10-24."
---
# Road to a graph that wins

> **Source.** Owner analysis round `inbox-2026-09-u` (2026-09-07), consumed to
> `agents/tmp.old/inbox-2026-09-u/`. Authored in the repository from that analysis under
> ADR-260 § 4; re-verified at `0918def55`. No third-party repository is a source of this
> plan — the two benchmark **subjects** ADR-260 § 5 reserves are test subjects the owner
> names in the corpus header, and this file wakes on that edit.

> **Arrivals:** 4 — latest `inbox-2026-10-aw` (2026-10-25): two 18.0.0 reviews read the entry condition as met (parent archived, both benchmark repositories named) and ask for the wake; no detector evaluates `entry_condition`, so it stays parked until someone triages it. Before that: `inbox-2026-10-aj` (2026-10-25): 17.2.0 reviews note both benchmark repositories are now named and the native graph gained SCIP, Laravel overlay and `agents/map/`; they ask for the wake decision, pinned SHAs, and bars that include the new layers and the map (orientation bench 2026-10-23 read TIE). The count before it read: 2 — latest `inbox-2026-10-m` (2026-10-12): 16.4.0 release reviews read the named benchmark repositories and ask that the benchmark finally run; no new fact. The count before it read: 1 — latest `inbox-2026-10-j` (2026-10-11), asking for step 1.2's
> `route` relation so account-flow entry points (login, reset, OAuth callback)
> can be classified and graph-backed missing-control checks become decidable;
> earlier: none.

> Woken by its parent. The parent makes the graph *exist*; this one makes it *the reason a
> reviewer ranks the system above the field*. Both halves are measurements the field does
> not publish: an oracle-truth benchmark on third-party repositories with both arms' traces
> tracked in-tree, and a counterfactual review in which the graph-fed reviewer finds
> oracle-confirmed misses the plain reviewer did not — scored without an LLM judge.

## Corpus header

The destination ADR-260 § 5 names. It carried no section until 2026-10-06, so
the `entry_condition` above and Phase 2.1 both pointed at a heading that did not
exist; whoever answered the question would have had to author the section as well
as fill it. The section is created empty, by `road-to-leading-every-row` blocker
`b4`, as routing repair. **Nothing here proposes a repository.**

ADR-260 § 5: *"Two public open-source repositories in the owner's stack, meeting
the fitness list in that roadmap, are named in its corpus header with the role
**benchmark subject** … (The owner fills the two names in the corpus header; the
roadmap wakes on that edit.)"* The fitness list it refers to is Phase 2.1 below;
it is not restated here, so there is one copy of it and it cannot drift.

| Role | Repository | SHA pin | Filled |
|---|---|---|---|
| benchmark subject 1 | `event4u-app/unopim` — fork of `unopim/unopim` (public, MIT) | pinned at registration (2.1) | 2026-10-23, owner |
| benchmark subject 2 | `event4u-app/larasend` — fork of `savvyagents/larasend` (public, MIT) | pinned at registration (2.1) | 2026-10-23, owner |

**Owner choice, 2026-10-23 — replaces the 2026-10-06 rows.** The earlier rows named
`event4u-app/data-helpers` and `event4u-app/capisco`. Neither is a Laravel application,
so route-trace and model → table could not be measured on them, and `capisco` is
private. The owner replaced both with two public Laravel applications under MIT,
**forked into `event4u-app`** so a pinned SHA survives an upstream deletion, rename or
force-push. A fork is never edited; a newer upstream state enters only as a new,
registered pin.

Measured 2026-10-23 on shallow clones, excluding `vendor/` and `node_modules/`
(`Route::` calls; a resource route counts once although it expands to several):

| Subject | `Route::` calls | Migrations | Eloquent relations | Test files | Frontend |
|---|---|---|---|---|---|
| unopim | 483 | 157 | 98 | 805 | Vue inline in Blade (167 files), 24 modular packages |
| larasend | 93 | 31 | 64 | 45 | Vue SFC 169 · TS 37 |

The pair splits the job on purpose. `unopim` meets the fitness list in full and puts
routes outside `routes/`, in module packages, which the route overlay has to find.
`larasend` is little known (about 500 stars against 11k), which lowers the chance that
suite F measures recall of training data rather than localisation. **Owner deviation:**
`larasend` falls short of the ≥ 200 routes in the fitness list; suite C's route-trace
counts are reported per subject rather than pooled, so its smaller route table cannot
dilute `unopim`'s.

A benchmark subject is a **test subject**, not an idea source: ADR-260 § 5 states
that `source-confidentiality` governs harvest provenance and does not apply here,
because this subject's questions, truth and traces are tracked in-tree.

**This roadmap wakes when both rows are filled and its parent is archived** — the
two halves of `entry_condition`, neither sufficient alone.

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
- [x] 1.1 Wire from the shipped bundle: vue, python, go, java (php/ts/js are wired).
      **Delivered 2026-10-23 by `road-to-a-map-that-draws-itself` 6.1 (python, go, java vendored;
      vue through its script block) and 4.2 (Blade directive scan).**
      Blade via a directive scanner (`@include/@extends/@component/@livewire`, `<x-…>`),
      `resolved_via: directive-scan`; a compiled grammar is optional and later.
- [ ] 1.2 Relations `route` (route table → handler) and `depends_on` (manifests); the
      **Laravel half moved 2026-10-23 to `road-to-a-map-that-draws-itself` Phase 4;
      `depends_on` stays here.**
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

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The corpus is fitted to the engine after the fact | implementation | Questions or oracle truth written after the engine has seen the subject repositories would score what the engine already answers, and repeat the lost-inputs failure of the 2026-08-28 registration | Registration, with SHA pins and every input tracked, lands before any measurement (Phase 2; K2) | Phase 2 — Registration, then measurement |
| 2 | A tie is reported as a win | product | The in-repo v2 corpus tied on every class against a 0.917-recall grep; a weak bar would let graph-first wording ship on noise | The null path is stated now: fewer than 4 of 6 classes winning withholds the wording | Phase 2 — Registration, then measurement |
| 3 | Breadth outruns reach | implementation | A language or framework added without a fixture and a corpus class widens the claim without evidence | K5 forbids it; each Phase 1 language carries both | Phase 1 — Reach, scoped (each language with fixture + corpus class) |

## Acceptance Criteria
- [ ] AC-1 Corpus v3 and the F task suite are tracked in-tree with hashes before the engine sees the subject repos.
- [ ] AC-2 The report publishes every class in both directions with the calibration diagnostic.
- [ ] AC-3 Both detectors consume accepted edges and record them; paired verdicts exist.
- [ ] AC-4 A closed finding flips to `stale` in a fixture when its affected file changes.
- [ ] AC-5 The counterfactual review is published with deterministic miss scoring.
- [ ] AC-6 `code-graph prove` emits the bundle from `scorecard.yaml`.
