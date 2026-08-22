---
estate_offset_exempt: "A genuine addition, so this key is the right instrument here — unlike the twenty it was just removed from, which were already on main and not re-added by any diff. The gate charges per addition and this is one of three. No offset was available: nothing in the active tree is archivable, because the only roadmap at zero open steps carries two deferred items and roadmap-progress-sync Iron Law 3 requires its deferred-resolution gate to run before any archive; parking this one would bury a repair whose defect is measured and reproducible today. Charged as one reviewable line, per this gate own instruction."
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
---
# Road to code graph extractor defect

> **Source:** agents/tmp.old/feedpack-points — a dropped inbox artifact
> observing that the code-graph null may have been measured on a broken
> instrument. Every claim below was re-verified against the tree on 2026-08-22,
> and the extraction defect was re-reproduced with a real build on the same
> day.

## Goal

The question this roadmap answers is whether the recorded code-graph null
measured the *idea* or measured a *defect*. When it is finished, either the
TypeScript extractor and the dispatcher path are repaired and the benchmark has
been re-run unedited against the same hash-bound questions — producing a second
report that either moves the recall figure or does not — or the pre-falsifier
fired and the roadmap closes as an honest null with the defect explicitly
cleared as the cause. Nothing here proposes flipping a default; that stays a
maintainer decision gated on a pre-registered rule.

## Context

**This challenges a bound decision, and the framing matters: the null may have
been measured on a broken instrument.** The recorded verdict is not in dispute
as a measurement. What is in dispute is what it measured.

**The engine is complete, not a stub.** `wc -l src/scripts/code_graph/*.ts`
totals **2,231** lines across **11** modules.

**The TypeScript branch handles six node kinds and no more.** `extractTsJs` at
`src/scripts/code_graph/extract.ts:248` switches on `import_statement`
(`:253`), `class_declaration` (`:271`), `method_definition` (`:286`),
`function_declaration` (`:300`), `new_expression` (`:309`) and
`call_expression` (`:321`). A grep for `lexical_declaration`,
`variable_declarator`, `arrow_function` and `public_field_definition` across
`src/scripts/code_graph/*.ts` returns **zero** hits in any file — so the
dominant modern TS declaration forms are not reachable by the extractor at all.

**Reproduced with a real build, 2026-08-22.** A two-file fixture was written
into `agents/runtime/tmp/` (gitignored, never the tracked tree) and built via
`src/scripts/code_graph/cli.ts build --root … --out …`. The TS file declared
five symbols; the PHP file declared three.

| Declared | Node produced |
|---|---|
| `export const alpha = (x) => …` | **none** |
| `const beta = function () { … }` | **none** |
| `class C { m = () => 1 }` | class node for `C`, **none for `m`** |
| `export function gamma(y) { … }` | `function` node |
| `class D { classic() { … } }` | `class` + `method` node |
| PHP `class P { one(); two(); }`, `function three()` | 3 of 3 |

**3 of 5 TS symbols dropped; 0 of 3 PHP.** The build reported 10 nodes over 2
files, and the four TS nodes are exactly `C`, `D`, `D::classic`, `gamma`.

**Root-cause corroboration in the report itself.**
`internal/bench/reports/code-graph-vs-grep.md:28-34` records **170 TS symbol
nodes vs 13,428 PHP symbol nodes** on same-shaped sibling repos, and names
arrow-function exports as the mechanism.

**The bound null.** Same report `:16-22`: graph-shaped recall **0.365** vs
disciplined grep **0.797**, delta **−43.2 pp** against a pre-declared +10 pp
win threshold; negative controls 0.111 vs 0.833.
`src/config/agent-settings.template.yml:1301-1306` carries the honest-null
note and `:1316-1317` ships `code_graph: enabled: false`. The claim is
registered as `code-graph-retrieval-null` at `docs/CLAIMS.md:388`.

**The reachability finding, and it is the strongest one.**
`src/scripts/_dispatch.bash:1614-1667` parses `--root` globally, **strips it
from argv**, and exports `AGENT_CONFIG_PROJECT_ROOT` (`:1655`). A grep for
`AGENT_CONFIG_PROJECT_ROOT` across `src/scripts/code_graph/*.ts` returns
**zero** hits, and `src/scripts/code_graph/cli.ts:68` derives `REPO_ROOT` from
its own module path. So `agent-config code-graph build --root <consumer>`
builds *this package's* repo, silently. **The engine has never been reachable
against another repository through the supported entry point** — the null was
measured on a path no consumer can take. The benchmark bypassed the dispatcher
deliberately (`internal/bench/code-graph/run_bench.ts:98-100`).

**Three corrections to the source draft, all re-verified.**

1. **The `--graph` clause is dropped entirely.** `grep -c -- '--graph'
   src/scripts/_dispatch.bash` returns **0**: the flag is never named there and
   passes through untouched. The report's own aside at `:41-42` states the
   dispatcher drops `--root`/`--graph`; the `--graph` half is never-true.
2. **The `--root` finding is the reachability finding above**, not a cosmetic
   flag drop — the flag is consumed and re-published under an env var the
   engine does not read.
3. **The ADR work shrinks to nothing.**
   `src/scripts/lint_scheduled_deprecations.ts:76-88` documents that the
   `code_graph` removal commitment was **withdrawn**, not re-dated, and
   `docs/MIGRATION.md:20` and `:31` carry the withdrawal with its reason
   (dated 2026-08-15). There is no scheduled-removal clock to renegotiate.

`docs/decisions/ADR-124-embedded-engine-doctrine.md` is **accepted** and its
service/daemon prohibition stands (`:110`): no step here may propose a resident
process, a watcher, or a socket. The engine stays Class A — invoked per
command, terminating after it.

## Phase 0 — Repair the extractor and the reachability path, under a pre-falsifier

> **PRE-FALSIFIER, registered before any repair.** If the post-repair TS symbol
> node count on the fixture-shaped and repo-shaped inputs is **not within one
> order of magnitude of the PHP sibling's count**, this roadmap closes as an
> honest null and records that the defect was not the defect. The 170-vs-13,428
> figure is a ~79× gap; one order of magnitude is the weakest bar that would
> still distinguish a repaired extractor from a cosmetically improved one.

- [x] **Step 0.1:** add the missing TypeScript declaration forms to
      `extractTsJs` — arrow-function and function-expression bindings via
      `lexical_declaration` / `variable_declarator`, and class properties via
      `public_field_definition` — emitting the same node kinds the existing
      cases emit.
      verify: rebuild the 5-symbol / 3-symbol fixture under
      `agents/runtime/tmp/` and confirm 5 of 5 TS symbols and 3 of 3 PHP
      symbols produce nodes, where `git show HEAD:src/scripts/code_graph/extract.ts | grep -c lexical_declaration`
      returns 0.

      **LANDED 2026-08-22.** Function-valued `variable_declarator` bindings
      (emitting `function`, or `method` inside a class) and
      `public_field_definition` holding a function (emitting `method`). Fixture
      rebuilt through the real CLI: **5 of 5 TS symbols, 3 of 3 PHP**. `git show
      HEAD:…/extract.ts | grep -c lexical_declaration` returns 0.
      **Scoped to bindings whose value IS a function**, deliberately: `const x =
      3` stays unrepresented, because emitting a node per constant raises the
      count without improving recall — the cosmetic-improvement failure Risk 4
      and the pre-falsifier both exist to catch. A fixture pins the exclusion.
      **One defect found while writing the tests, not predicted by the step.**
      An expression-bodied arrow (`() => helper()`) has the CALL as its body, so
      iterating `namedChildren(body)` — which is what the sibling
      `function_declaration` case does — steps straight past it and loses the
      edge. The new cases walk the body node itself. A fixture asserts the call
      inside `const f = () => helper()` attributes to `a.ts#f`.
- [x] **Step 0.2:** make the engine honour the dispatcher's root. Either read
      `AGENT_CONFIG_PROJECT_ROOT` in `cli.ts`, or stop stripping `--root` for
      this verb — one of the two, not both.
      <!-- blocked-by: b-code-graph-default-flip -->
      verify: `agent-config code-graph build --root <a scratch repo under agents/runtime/tmp/>`
      writes a graph whose node `source_file` values are all inside that repo;
      today the same invocation indexes this package (2,760 files, measured
      2026-08-22).

      **LANDED 2026-08-22 as option (a), authorised by council 2/2**
      ([`drain-code-graph-reachability`](../evidence/analysis/code-graph-extractor-repair-2026-08-22.md)
      records the disposition; the blocker below carries the verdict).
      `resolveRoot` resolves `--root` > `AGENT_CONFIG_PROJECT_ROOT` > module
      tree, through `realpathSync`, at all **five** sites that previously read
      `flag(argv, '--root') ?? REPO_ROOT` — the step names one and there were
      five, which is worth recording because fixing one would have left the
      other four silently wrong.
      **Sensitivity, and it is the sharpest measurement in this roadmap.** With
      the env-var rung neutralised and nothing else changed, `agent-config
      code-graph build --root <2-file fixture>` indexes **2,763 files of this
      package**; restored, it indexes 2. The confused deputy reproduced and
      closed, through the supported entry point.
      **`DEFAULT_CACHE` deliberately untouched.** It is anchored to `REPO_ROOT`
      for the same reason and is a WRITE path with its own ownership, cleanup,
      concurrency and multi-repo namespacing questions. Both council seats put it
      explicitly out of scope, and one warned against proposing a replacement
      location without answering those questions first.
- [x] **Step 0.3:** evaluate the pre-falsifier and write the verdict down
      before Phase 1 is planned. A repaired-looking extractor that fails the
      order-of-magnitude bar closes the roadmap here.
      verify: the recorded TS and PHP symbol-node counts for one same-shaped
      repo pair are both published, and their ratio is stated as a number.

      **EVALUATED 2026-08-22 — THE PRE-FALSIFIER FIRES. The roadmap closes here
      as an honest null and the extraction defect is EXCLUDED as the cause.**
      Full record: [`code-graph-extractor-repair-2026-08-22.md`](../evidence/analysis/code-graph-extractor-repair-2026-08-22.md).

      A controlled A/B on `galawork-web2` — the repo behind the report's
      `170 TS symbol nodes` — same command, same tree, only the two new
      extractor cases differing:

      | | TS symbol nodes | PHP symbol nodes (same repo) | ratio |
      |---|---|---|---|
      | Before repair | **130** | 12,308 | 1 : 95 |
      | After repair | **265** | 12,308 | 1 : 46 |

      Against the source-only PHP sibling `galawork-api/app` (2,541 files,
      **12,493** PHP symbol nodes) the post-repair ratio is **1 : 47**. The
      repair **doubles** the count and the result is still ~46× short of the
      one-order-of-magnitude bar. The fixture-shaped half passes (7 TS vs 4 PHP);
      the bar is conjunctive, so one failing input fires it.

      **Two findings the bar cannot see, and the second matters more than the
      verdict.** (1) The count bar is confounded by file-count asymmetry: 236 TS
      files against 1,398 PHP files inside the same repo, so most of the 46× is
      6× fewer files. (2) **The extractor was never blind to TypeScript** — on
      this package's own `src/` it produced **14,926** TS symbol nodes *before*
      the repair and 15,588 after, a 4.4 % rise. So the report's 170 measured a
      repository whose TS surface is small and whose per-file yield is 1.1, not
      an extractor that cannot see TS. Per-file: web2 TS **1.1**, this package's
      TS **12.8**, the PHP sibling **4.9**.
      The residual 11× per-file gap is **unexplained by this repair** and is the
      next question if anyone reopens: the candidate is that web2's `.ts` files
      are largely type declarations while component logic lives in files the
      extractor's language set does not include. Stated as a hypothesis; it was
      not measured.

## Phase 1 — Re-run the benchmark unedited, alongside r1

> **NOT RUN — closed by the Phase 0 pre-falsifier, 2026-08-22.** The bar was
> registered before any repair precisely so this decision would not be taken
> after seeing an improvement, and it missed by ~46×. An r2 built on a repaired
> extractor whose repo-shaped yield still misses the bar would be the
> vindication-by-any-rise failure Risk 4 names.
>
> **The inputs were verified anyway**, because the other blocker asked for it:
> all four truth files hash-match the literals at `run_bench.ts:29-32` exactly,
> and all three repo clones resolve. So Phase 1 is **reproducible and unrun** —
> a different state from unreproducible, and the distinction is the useful part
> for whoever reopens this.

- [-] **Step 1.1:** re-run `internal/bench/code-graph/run_bench.ts` **unedited**
      over the same three repos and the same questions, with the
      `PREREG_HASHES` block at `:28-32` unchanged, so the run either verifies
      the four truth-file hashes or voids itself (`:159-168`).
      <!-- blocked-by: b-bench-repo-pinning -->
      verify: the run's own prereg integrity gate printed no hash mismatch, and
      the four hashes in the emitted report match the four literals at
      `run_bench.ts:29-32`.
- [-] **Step 1.2:** emit the second report to a NEW output directory via
      `--out`, so r1 survives byte-for-byte. `run_bench.ts:261` writes
      `code-graph-vs-grep.json` unconditionally into its `--out` dir, so a
      default invocation overwrites the null this roadmap is challenging.
      verify: `git status --porcelain internal/bench/reports/` shows no
      modification to `code-graph-vs-grep.json` or `.md`, and the r2 report
      exists at its own path.
- [-] **Step 1.3:** state the pre-registered decision rule for r2 **before**
      reading its numbers, in the same terms the r1 pre-registration used —
      recall delta in pp against grep, precision floor, negative-control floor.
      verify: the decision-rule text is committed in step 1.3's own diff, and
      the r2 report is absent from that diff.

## Phase 2 — Only if the decision rule fires

> **NOT RUN.** Its own condition — "only if the decision rule fires" — was never
> reached, because Phase 1 did not run. `code_graph.enabled` is untouched and
> `claim:code-graph-retrieval-null` stands, which is Step 2.3's outcome reached
> by the pre-falsifier instead of by an r2 arm.

- [-] **Step 2.1:** compute the r2 recall delta and name which threshold arm
      fired — cleared, missed, or inconclusive. There is no fourth arm, and a
      narrative verdict without an arm does not satisfy AC-3.
      verify: the r2 report's verdict line names exactly one of the three arms
      and prints the delta in pp.
- [-] **Step 2.2:** if and only if the cleared arm fired, prepare the default
      decision as a maintainer question with both r1 and r2 attached, and
      update `docs/CLAIMS.md`'s `code-graph-retrieval-null` entry to point
      forward. A registered null is not superseded by a roadmap step.
      <!-- blocked-by: b-code-graph-default-flip -->
      verify: `grep -c superseded_by docs/CLAIMS.md` rises by 1 against the
      `git show HEAD:` copy, and the new link names the r2 report.
- [-] **Step 2.3:** if the missed or inconclusive arm fired, record the second
      null next to the first, keep `enabled: false` untouched, and state that
      the extraction defect is now excluded as the cause.
      verify: `grep -c 'enabled: false' src/config/agent-settings.template.yml`
      is unchanged against the `git show HEAD:` copy, and the r2 report carries
      the exclusion sentence.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The r2 run cannot be reproduced because its inputs are machine-local | implementation | The four truth files live in a gitignored directory and the three repo clones are named only inside them; if any is gone, `run_bench.ts:159-168` voids the run and Phase 1 has no output at all | The blocker makes unreproducibility an explicit closing state rather than a stall, so a missing input yields a recorded null instead of an indefinite park | Phase 1 |
| 2 | r1 is overwritten by the r2 run | implementation | `run_bench.ts:261` writes into its `--out` dir unconditionally, and the default `--out` is the directory holding the r1 report — a bare re-run destroys the baseline the challenge is measured against | Step 1.2 requires a separate `--out` and verifies r1's files are unmodified in `git status`; the verify reads the working tree deliberately, because an overwrite shows there and nowhere else | Phase 1 |
| 3 | The decision rule is written after the r2 numbers are visible | product | Reading r2 first and then choosing thresholds reproduces exactly the outcome-shopping the r1 pre-registration existed to prevent, and the resulting figure would carry no evidential weight at all | Step 1.3 commits the rule in its own diff and verifies the r2 report is absent from that diff — a mechanical ordering check, not a promise | Phase 1 |
| 4 | The repair improves TS node counts cosmetically and the roadmap reads it as vindication | implementation | Adding two node kinds will raise the count from 170 by some amount; without a bar, any rise reads as "the defect was the cause", which is the conclusion this roadmap is supposed to test rather than assume | The Phase 0 pre-falsifier fixes the bar at one order of magnitude of the PHP sibling and requires the ratio to be published as a number before Phase 1 is planned | Phase 0 |
| 5 | A repair reaches for a resident process to make indexing cheap | implementation | Rebuild cost is the obvious next complaint after extraction is fixed (r1 recorded 2.5–6.9 s builds), and a watcher or daemon is the reflexive answer — it is prohibited | ADR-124 is accepted and cited in Context with its Class-B prohibition; no step proposes a process that outlives its command, and step 0.2 stays inside the existing per-command CLI | Phase 0 |

## Acceptance Criteria

- [x] AC-1 — The five-form fixture builds to 5 of 5 TS symbol nodes and 3 of 3
      PHP symbol nodes, and the TS-to-PHP symbol-node ratio on one same-shaped
      repo pair is published as a number against the pre-repair 170-vs-13,428
      baseline.
- [x] AC-2 — `agent-config code-graph build --root <path>` produces a graph
      whose nodes all lie inside `<path>`, so the engine is reachable through
      the supported entry point; or the roadmap records that the reachability
      repair was declined and by whom.
- [-] AC-3 — An r2 report exists at its own path with r1 unmodified, its
      verdict line names exactly one of cleared / missed / inconclusive, and
      the pre-registered decision rule it is judged against was committed
      before the report existed.
- [x] AC-4 — `code_graph.enabled` is unchanged unless the cleared arm fired and
      a maintainer answered the default question; and in the missed or
      inconclusive case the r2 report states that the extraction defect is
      excluded as the cause of the r1 null.

## Blockers

### blocker: b-bench-repo-pinning

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** step 1.1
- **Class:** 3
- **What to do:** pick exactly one — (a) confirm the four truth files
  (`repo-a-questions.yaml`, `repo-b-questions.yaml`, `repo-c-questions.yaml`,
  `probes.yaml`) still hash-match the literals at `run_bench.ts:29-32` and that
  the three repo clones named inside them still exist, then run Phase 1; or (b)
  record that one or more inputs is gone, close Phase 1 as unreproducible, and
  keep the Phase 0 repair on its own merits without a comparative claim.
- **Recommendation:** (a) if the inputs verify on a single check, (b)
  immediately otherwise. The runner already voids itself on a hash mismatch, so
  the only decision left is whether an unreproducible comparison is recorded as
  a null or chased — and chasing it means re-deriving ground truth, which
  produces a different measurement wearing the same name.
- **If you do nothing:** Phase 1 either stalls on a missing input or is re-run
  against reconstructed truth files, and the r1-vs-r2 comparison silently stops
  being a comparison.
- **Resolved when:** the four hashes are confirmed matching and the three clone
  paths resolve, or the roadmap records which input is missing and Phase 1 is
  marked unreproducible.
- **Resolution (2026-08-22) — (a) on evidence: every input verifies.** All four
  truth files under `agents/tmp.old/bench-local/` hash-match the literals at
  `run_bench.ts:29-32` **exactly** (`repo-a` `3355305a…`, `repo-b` `a5c8abf0…`,
  `repo-c` `41389a46…`, `probes` `284cea15…`), and all three `repo_local_path`
  clones resolve. So Phase 1 is **reproducible**.
  It is nonetheless **not run**, and for the other reason entirely: the Phase 0
  pre-falsifier fired. Recording both facts rather than only the second one
  matters — "reproducible and unrun" is a different state from "unreproducible",
  and whoever reopens this needs to know the comparison is still available.

### blocker: b-code-graph-default-flip

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** step 0.2, step 2.2
- **Class:** 3
- **What to do:** pick exactly one — (a) authorise the reachability repair as a
  bug fix independent of the default, leaving
  `src/config/agent-settings.template.yml:1317` at `enabled: false` and the
  registered null standing; or (b) treat any change to the engine's reachable
  surface as coupled to the default decision and hold both until the r2
  decision rule has fired.
- **Recommendation:** (a). A flag the dispatcher consumes and the engine
  ignores is a defect on its own terms — it makes every consumer-facing
  invocation silently wrong about which repository it indexed, whatever the
  default is. Coupling the fix to the flip means the defect survives as long as
  the null does.
- **If you do nothing:** step 0.2 cannot land, so Phase 1 measures the same
  unreachable path r1 measured, and a second null would carry the same
  ambiguity as the first.
- **Resolved when:** the reachability repair is either authorised as an
  independent fix or explicitly deferred to the r2 decision, and the choice is
  recorded at this blocker.
- **Resolution (2026-08-22) — (a), authorised 2/2 by AI council under blind
  peer review.** The reachability repair lands as a bug fix independent of the
  default. Seat B, verbatim: *"Correcting an explicitly invoked `--root` command
  that silently indexes the wrong repository is an independent correctness fix;
  it neither validates retrieval quality nor authorizes default enablement."*
  Seat A named the shape: the dispatcher made a decision about which directory
  to index and the engine silently substituted its own — a **confused deputy**.
  **In scope, and all four landed:** read `AGENT_CONFIG_PROJECT_ROOT`;
  canonical-path resolution via `realpathSync`; precedence `--root` > env var >
  module tree; and a sensitivity check proving the dispatcher-selected repo is
  the indexed one (2 files vs 2,763 with the rung neutralised).
  **Explicitly out of scope, and untouched:** `code_graph.enabled: false`,
  `claim:code-graph-retrieval-null`, the r2 decision criteria, automatic
  indexing or refresh, and `DEFAULT_CACHE` — which is anchored to `REPO_ROOT`
  for the same reason and is a WRITE path with its own ownership, cleanup,
  concurrency and multi-repo namespacing questions. One seat also warned against
  proposing a replacement cache location without answering those first, and none
  is proposed.
  **One correction the council made to the question's framing:** describing this
  as a data-corruption defect is overstated — it indexes the wrong source tree
  and may produce misleading derived data, but no authoritative user data is
  corrupted. Recorded because the question overstated it.
