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
relates:
  - slug: road-to-edges-that-earn-their-target
    relation: disjoint
    note: "corrects name-resolution edges; this file measures them (2.6)"
  - slug: road-to-a-graph-that-feeds-the-gate
    relation: disjoint
    note: "hook delivery and the detector-F feeder; its own Phase 3 detectors stay here"
estate_growth_exempt: "THIS CHANGE (2026-10-26) moves this roadmap from later/ to active: active_roadmaps +1, later_roadmaps -1. Its entry_condition holds in the tree — the parent road-to-a-graph-that-is-shipped is archived and the owner named both benchmark subjects in the corpus header on 2026-10-23 — and the AI council decided the wake 2/2 on 2026-10-26 (agents/evidence/council/open-questions-inbox-aw-20261026.md). Active count becomes 5, the WIP cap of the owner directive of 2026-10-24."
estate_offset_exempt: "Woken from later/, not added: the AI council decided the wake 2/2 on 2026-10-26 (agents/evidence/council/open-questions-inbox-aw-20261026.md), and the owner chose to land it. No active roadmap is finished, so none can be archived to offset it; the count reaches the WIP cap of 5 and stops there. Leaving it parked was rejected because its entry_condition already holds in the tree and the request has arrived four times."
---
# Road to a graph that wins

> **Source.** Owner analysis round `inbox-2026-09-u` (2026-09-07), consumed to
> `agents/tmp.old/inbox-2026-09-u/`. Authored in the repository from that analysis under
> ADR-260 § 4; re-verified at `0918def55`. No third-party repository is a source of this
> plan — the two benchmark **subjects** ADR-260 § 5 reserves are test subjects the owner
> names in the corpus header, and this file wakes on that edit.

> **Arrivals:** 6 — latest `inbox-2026-10-bf` (2026-10-27): a review-graph comparison round (S1, literature S3–S14) re-verified at `92397d636` finds the engine mature and the last metre missing — no review skill, no workflow and no merge or self-review gate reads the graph (the stop gate's shadow feeder is the one consumer), the stated/guess rule is applied by four verbs only, and a partial parse or a skipped lane reads as zero; landed as the rewrite of 3.1 (7 → 18 mechanisms, enforcement), amendments to 2.2, 2.4 and 3.5, and new Phases 4 and 5. Its hook-extension item folded into `road-to-a-graph-that-feeds-the-gate` 2.5 and its freshness items into `road-to-code-graph-refresh-during-a-session`. Before that: 5 — latest `inbox-2026-10-bb` (2026-10-26): a comparison round against an external code-graph tool asks for an opt-in oracle producer, per-mechanism edge precision/recall against it, and a same-roots parity run; landed as step 2.6, its correctness half went to `road-to-edges-that-earn-their-target`. Before that: 4 — latest `inbox-2026-10-aw` (2026-10-25): two 18.0.0 reviews read the entry condition as met (parent archived, both benchmark repositories named) and ask for the wake; no detector evaluates `entry_condition`, so it stays parked until someone triages it. Before that: `inbox-2026-10-aj` (2026-10-25): 17.2.0 reviews note both benchmark repositories are now named and the native graph gained SCIP, Laravel overlay and `agents/map/`; they ask for the wake decision, pinned SHAs, and bars that include the new layers and the map (orientation bench 2026-10-23 read TIE). The count before it read: 2 — latest `inbox-2026-10-m` (2026-10-12): 16.4.0 release reviews read the named benchmark repositories and ask that the benchmark finally run; no new fact. The count before it read: 1 — latest `inbox-2026-10-j` (2026-10-11), asking for step 1.2's
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
      Amended 2026-10-27 (round `inbox-2026-10-bf`): a second truth source beside the
      oracle — the files the real fix commit touched, for suite F and for 3.5. Truth is
      never derived from the graph under test (a recall of 1.0 against graph-derived
      truth is circular, which S1's own benchmark notes).
- [ ] 2.3 Arms: A–E = grep (two-probe) / native / foreign `graph.json` (reader in
      `internal/bench`, mapping relation and confidence names). F = floor / floor + native
      tools. No "fused" arm.
- [ ] 2.4 Bars fixed at registration: A–E +10 pp recall at ≤ 5 pp precision loss plus a
      calibration diagnostic (predicted class vs gold, overconfidence rate); F primary
      **solved per 100k tokens ≥ 1.25× floor**, solved per minute, escaped-regression rate.
      Gate for F: `dispatch-event-capture-reliability` ≥ 95 %.
      Amended 2026-10-27 (round `inbox-2026-10-bf`): token cost is measured against a
      grep-and-read agent, not against reading the whole corpus; the headline is
      sum over sum, never a mean of per-task ratios; reported per question class and
      per language, with at least one non-TypeScript language.
- [ ] 2.5 Run; publish both directions; no renegotiation. Record ADR-246/259's benchmark
      trigger as fired or not. Then, and only then, rewrite the skill description as a
      **class list** (which classes are graph-first, which stay grep-routine).
- [ ] 2.6 Edge precision and recall per `resolved_via`, against the 2.2 oracle, on
      `src/scripts/` and both subjects. The oracle index is produced by an indexer the
      maintainer installs (`scip-typescript` first; PHP per 2.2), never fetched at
      runtime (ADR-259); without one the runner exits naming it. A same-roots parity
      run against the external tool the `inbox-2026-10-bb` round compared runs on the
      maintainer's machine, recorded without the tool's name. Census baseline:
      `agents/evidence/analysis/code-graph-edge-census-2026-10-26.md`.

## Phase 3 — The gate feeder
- [x] 3.1 Enforce the edge acceptance policy in every consumer. Corrected 2026-10-27
      (round `inbox-2026-10-bf`): the policy this step asked to write already exists in
      one file and is compile-time complete — `STATED_WORDS` / `GUESS_WORDS` in
      `src/scripts/code_graph/types.ts`, checked by `TRUST_LISTS_COMPLETE`, read through
      `isStatedResolution`. The step listed 7 stated mechanisms; the tree has 18:
      `same-file, import-specifier, path-alias, psr4, route-table, directive-scan,
      schema-call, orm-relation, di-binding, lane-read, compiler-index, namespace-scope,
      test-import, literal-path, literal-dotted, fs-route, literal-url, class-hierarchy`;
      guesses are `name-lookup, dynamic, foreign`. What is open is enforcement:
      `query`, `explain`, `affected` and `path` (`query.ts`) carry no `resolved_via`
      filter, `review-risk` filters on `confidence === 'AMBIGUOUS'` (`review_risk.ts`),
      and the context pack (`verify/pack.ts`) filters nothing. All six read through
      `isStatedResolution`; guess edges appear only behind an explicit
      `--include-guesses`, marked per line. Fixture: one `name-lookup`, one `dynamic`
      and one `import-specifier` edge; without the flag all six return only the third.
      verify: `npx vitest run tests/scripts/code_graph.test.ts -t 'guess edges withheld by every consumer'` -> 0
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
      Amended 2026-10-27 (round `inbox-2026-10-bf`): two graph arms, not one. Arm A
      plain; arm B1 receives only the Phase 5 check results and the 4.7 read list; arm
      B2 receives the same graph content as context prose. S3 measured graph context
      pasted beside a diff degrading reviews across eight models, so the hypothesis is
      B1 > A ≥ B2; without B2 the run cannot tell whether the form or the graph acted.
      K3 holds for all three arms.
- [ ] 3.6 `code-graph prove` emits the bundle (corpus SHA, both reports, oracle version,
      `resolved_via` histogram, 3.5 record, staleness state) from
      `internal/bench/scorecard.yaml` (row → metric → artefact → bar → expiry).

## Phase 4 — Answers that say what they do not know
Added 2026-10-27 from round `inbox-2026-10-bf`. Order binds: honesty before cost
before consumption, because every Phase 5 consumer and every 3.5 arm reads these
answers. Each step is fixture-gated (K5).

- [x] 4.1 **A partial parse is visible.** `parseError` is set in `extract.ts` and read
      by nothing outside tests, so a file parsed with errors counts as fully known. It
      lands on the file node; `impact`, `review-risk` and `tests-for` list such files in
      `partial_files` beside `unresolved_files` / `not_indexed_files`, and their
      dependents are not reported complete.
      verify: `npx vitest run tests/scripts/code_graph.test.ts -t 'partial_files'` -> 0
      > note: the SQLite twin has no `partial` column yet, so on the indexed read path (graphs ≥ 50k edges) `impact` and `tests-for` cannot see the flag; the column costs ~85 bytes in the hook bundle, which has 1 byte of headroom (2026-10-27) — it needs a `raise_log` entry first.
- [x] 4.2 **A skipped lane reads `unknown`, never `0`.** The history lane skips a
      shallow clone with a reason (`lanes/history/history.ts`), but `lane_runner.ts`
      strips `skipped` from `lanes_run` and `LaneRunRecord` (`types.ts`) carries only
      `error?`, so the reason never reaches the graph and `review-risk` prints
      "missing partners 0". Order: (i) `LaneRunRecord` gains a persisted
      `skipped_reason`, accepted by `validate.ts`; (ii) `review-risk` renders a term
      whose lane was skipped as `unknown (shallow clone)` and leaves it out of the sum;
      (iii) the map's agent area (`map_area_payloads.ts` `completeness`,
      `map_viewer/area_agent.js` copy) shows the same state. Precondition of 5.5.
      verify: `npx vitest run tests/scripts/code_graph_review_risk.test.ts -t 'shallow clone renders unknown'` -> 0
- [x] 4.3 **One uncertainty sentence for empty answers.** Only when a result is empty,
      at most 140 characters, the reason taken in a fixed order: not indexed → partial
      parse → `edited` / `behind:N` → language gap (a data table per language and
      verb). Non-empty answers stay byte-identical; the vocabulary is the map
      freshness banner's, not a second one.
      verify: `npx vitest run tests/scripts/code_graph.test.ts -t 'uncertainty sentence only on empty'` -> 0
- [x] 4.4 **Hunk seeds in `impact`.** `impact --diff` seeds every symbol of a touched
      file (`seedsForFiles`, `verbs.ts`) while `review-risk` seeds by hunk overlap
      (`review_risk.ts`) — two answers to one question. `impact` takes the hunk
      overlap; file granularity remains only as a fallback when git yields no hunks,
      and is marked as such.
      verify: `npx vitest run tests/scripts/code_graph.test.ts -t 'impact seeds from hunks'` -> 0
- [x] 4.5 **Detail levels and caps.** `impact`, `tests-for`, `dead` and `review-risk`
      (CLI and MCP) gain `detail: minimal|standard` and hard caps; what is left out is
      counted (`omitted: {dependents: N, …}`), never silently cut. Reuse the query
      verbs' `budget` / `truncated` and the context pack's accounting — no third
      mechanism. Caps derive from per-line costs measured here, not from S1's figures.
      verify: `npx vitest run tests/scripts/code_graph.test.ts -t 'omitted counted not truncated'` -> 0
- [ ] 4.6 **The review path reads the index.** `review-risk` parses the whole JSON
      graph in the CLI (`cli.ts`), the MCP tool (`graph_tools.ts`) and the map's agent
      area (`map_area_payloads.ts`); it reads through `openGraphIndex` instead, and
      builds adjacency without an array spread per edge. Measure the 50k-edge
      threshold (`sqlite_store.ts`) once and replace it by the measured crossover or
      confirm it. Precondition: the SQLite twin writes on this repository's graph —
      `road-to-a-graph-that-feeds-the-gate` 3.4 recorded 223 duplicate node ids failing
      its primary key on 2026-10-07; `code_graph_unique_ids.test.ts` pins the
      collision shapes fixed since. Confirm on the real graph before scheduling.
      verify: `npx vitest run tests/scripts/code_graph_review_risk.test.ts -t 'reads through the index'` -> 0
      > note: precondition met 2026-10-27 — this repository's twin opens (261,913 edges, 0 duplicate node ids); adjacency no longer spreads per edge. Open: the index path needs kind- and relation-scoped reads in `sqlite_store.ts`, which is in the hook bundle at 1 byte of headroom, so it needs a `raise_log` entry first; the 50k crossover is unmeasured.
- [x] 4.7 **A region read list.** Extend the existing `recommended_reads` (`query.ts`)
      and the pack's `at=file:line` items with a region budget — changed regions
      risk-ordered round-robin, at most 40 % per file, definitions up to 40 lines
      whole, the rest counted as `{file, lines, reason}`. Line ranges only, no source
      text in graph output; no new field name.
      verify: `npx vitest run tests/scripts/code_graph.test.ts -t 'recommended_reads region budget'` -> 0

## Phase 5 — The review reaches the graph
Added 2026-10-27 from round `inbox-2026-10-bf`. The graph feeds deterministic checks
and a read list, never a context dump: S3 measured graph prose beside a diff making
reviews worse. Distinct from 3.2, which teaches two existing detectors to read edges.

- [x] 5.1 **Three deterministic checks.** (a) changed symbols without a test path,
      labelled `untested` / `reached-by-tested-caller` / `tested` — (a) reuses the
      `untested --diff` verdict `road-to-a-graph-that-feeds-the-gate` 3.2 already
      records in shadow; (b) co-change partners missing from the diff, `unknown`
      without full history (4.2); (c) a touched entry point or flow. Each check cites
      the edges it rests on with a `file:line` witness.
      verify: `npx vitest run tests/scripts/code_graph_review_risk.test.ts -t 'three checks cite witnesses'` -> 0
- [x] 5.2 **Review skills consume the checks and the read list.** `blast-radius-analyzer`
      step 2 tells the agent to grep; it runs `impact --diff` first when the graph is
      `fresh` or `edited`, and greps only for `unknown`, partial or unindexed files.
      The review command chain receives the checks as a structured list, not prose,
      and `code-intelligence` carries the form rule: the graph feeds checks and read
      lists, never prose.
      verify: `grep -c 'impact --diff' src/skills/blast-radius-analyzer/SKILL.md` -> /^[1-9]/
- [ ] 5.3 **The self-review gate reads the checks, advisory.** `self_review_gate.ts`
      receives the three checks as findings with a disposition, typed with the
      exhibits that landed on `review-findings.schema.json` in #2722; advisory until
      3.5 shows B1 > A.
      verify: `npx vitest run tests/scripts/self_review_graph_checks.test.ts` -> 0
- [ ] 5.4 **The regression selector gets a caller.** `selectRegressionsFromCode`
      (`_lib/regression_neighbourhood.ts`) is imported by its test only; the
      verify-repair loop uses it instead of the optional `affected --since`.
      verify: `git grep -l selectRegressionsFromCode -- src ':!src/scripts/_lib/regression_neighbourhood.ts'` -> 0
- [ ] 5.5 **PR comment, opt-in.** A workflow template for consumers: `fetch-depth: 0`
      required (otherwise history terms render `unknown`, per 4.2), a sticky comment
      with band, checks and `omitted` counters, gate off by default; "no analysis" is
      its own status and never reads as low risk. No new CLI verb (ADR-041):
      `review-risk --format markdown`. Depends on 4.2.
      verify: `npx vitest run tests/scripts/code_graph_review_risk.test.ts -t 'markdown no analysis is not low risk'` -> 0
- [ ] 5.6 **Calibrate the risk band.** The score is an unnormed sum of hand-set weights
      with no test-gap term (`review_risk.ts` `RISK_WEIGHTS`), and the map prints that
      it names no levels yet (`map_viewer/area_agent.js`). Until 3.5 runs: band only
      `low` / `medium` / `high` / `unknown` with reason lines, no decimal, no default
      gate. After it: test each term against forward-in-time split data (S6 method,
      effort-aware); a term that contributes nothing is removed.
      verify: `ls internal/bench/reports/review-risk-calibration-*.md` -> 0

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
| 4 | Honesty changes break the answers consumers already read | implementation | `partial_files`, `unknown` terms and caps change output the map, the stop-gate feeder and the MCP tools consume today | Non-empty answers stay byte-identical (4.3); omitted items are counted, never cut (4.5); the map copy changes in the same step (4.2) | Phase 4 — Answers that say what they do not know |
| 5 | The graph reaches the review as prose and makes it worse | product | A consumer pastes graph output into the review prompt, the form S3 measured as degrading | Checks and line-range read lists only (5.1, 5.2); prose exists only as arm B2 of 3.5; the self-review gate stays advisory until 3.5 shows B1 > A | Phase 5 — The review reaches the graph |

## Acceptance Criteria
- [ ] AC-1 Corpus v3 and the F task suite are tracked in-tree with hashes before the engine sees the subject repos.
- [ ] AC-2 The report publishes every class in both directions with the calibration diagnostic.
- [ ] AC-3 Both detectors consume accepted edges and record them; paired verdicts exist.
- [ ] AC-4 A closed finding flips to `stale` in a fixture when its affected file changes.
- [ ] AC-5 The counterfactual review is published with deterministic miss scoring.
- [ ] AC-6 `code-graph prove` emits the bundle from `scorecard.yaml`.
- [ ] AC-7 A partial parse, a shallow clone and a skipped lane appear as `unknown` in every review answer, never as `0`, and no capped answer drops an item uncounted.
- [ ] AC-8 `blast-radius-analyzer`, the review chain and the self-review gate consume the three checks as structured findings.
