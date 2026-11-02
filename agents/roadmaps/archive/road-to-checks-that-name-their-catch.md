---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-12-31
tree_pin: 9a6bf98a05
estate_growth_exempt: "Operator asked for this roadmap to be made active and processed in the same invocation (2026-11-02, /analyze:inbox … then /roadmap:process-full). Owner search over agents/roadmaps/{*,later,stubs} for the self-test harness, gate exit dialects, gate argv strictness, ui:render settle/console and golden intent came back empty, so the work has no neighbour to fold into."
estate_offset_exempt: "grep -rlE 'gate_self_test|exit dialect|gate_args|GATE_EXIT|fonts.ready|Golden-Intent' over agents/roadmaps/*.md agents/roadmaps/later agents/roadmaps/stubs (whole roadmap tree) — no roadmap owns any of these subjects; the hits are incidental mentions of --self-test in unrelated plans."
relates:
  - slug: archive/road-to-installed-links-of-every-kind
    relation: disjoint
    note: "Owned the report-only installed-link kind counts (F1 below). Not replanned here."
  - slug: later/road-to-a-step-that-costs-what-it-changes-carried
    relation: disjoint
    note: "Owns step-arrival disclosure for run procedures; the skill-side pilot the source proposed is declined here (K6)."
---

# Road to checks that name their catch

> **Source:** `agents/tmp.old/inbox-2026-11-h/` — a deep audit of this tree
> against one external skill-carrying package plus web reading, two agent
> drafts beside one owner transcript. Re-verified at `tree_pin` on 2026-11-02;
> claims the tree overtook since the drafts' pin are marked *overtaken*.

## Goal

A gate's self-test proves the gate **caught the thing it claims to catch** —
not that it exited non-zero for any reason. Every self-test **runs** in CI. A
gate refuses a flag it does not know instead of running green without it. The
page witness photographs a page **after it holds still** and hears the console.
A golden baseline changes only with a stated reason per scenario.

Owner constraint (transcript): *learn, use and adapt — without making the tree
slower or more complex.* Every step below therefore ships as a **shrink-only
ratchet** or an opt-in field, never as a big-bang migration, and adds no
always-on rule text.

## Context — re-verified at `tree_pin`

| # | Claim | Status | Evidence |
|---|---|---|---|
| A1 | Any non-zero exit counts as a reject catch | still-true | `src/scripts/_lib/gate_self_test.ts:111` |
| A2 | A killed child (status `null`) counts as exit 1 | still-true | `gate_self_test.ts:58` |
| A5 | `SelfTestCase` asserts no reason; ledger prints no `failed=` | still-true | `gate_self_test.ts:61-66`; `_lib/gate_ledger.ts:287` |
| B1 | Three self-tests red on a fresh clone | still-true (reproduced) | `check_review_schema`, `check_beta_review_markers`, `check_host_loadability` each `--self-test` → exit 1 in a fresh worktree |
| B2/B3 | Self-test existence is ratcheted, execution is not | still-true | `check_gate_coverage.ts` counts non-adopters only |
| C1 | Many gates exit 0 on an unknown flag | still-true *(re-measured in 0.3)* | sweep at `tree_pin` |
| C3 | `task memory:shadow-report` always exits 2 | still-true (reproduced) | `taskfiles/engine.yml:326-329` |
| D1 | `ui:render` screenshots at `load`, fonts read after the picture | still-true | `src/cli/commands/uiRender.ts:446-449`, `:462` |
| D2a | No dark capture | **overtaken** — a page declaring `prefers-color-scheme: dark` gets a `desktop-dark` pass | `uiRender.ts:556-559` |
| D2b | No console / `pageerror` capture | still-true | 0 hits in `uiRender.ts` |
| E1 | Golden capture rewrites its own baseline; intent is prose | still-true | `tests/golden/CAPTURING.md` |

## Phase 0 — Red today, green on a fresh clone

- [x] **0.1 Repair the three red self-tests (B1).** `check_review_schema`: the
      accept fixture declares what the current derivation requires.
      `check_beta_review_markers`: the lapsed case follows the 2026-09-11 owner
      decision (a lapse never reds CI). `check_host_loadability`: the accept
      case runs on a materialised fixture, never on the live tree.
      verify: the three `--self-test` runs exit 0 in a fresh worktree with no
      generated `.claude/` projection.
- [x] **0.2 Repoint or delete `task memory:shadow-report` (C3).**
      verify: the task exits 0, or it is gone and `grep -r shadow-report taskfiles` is empty.
- [x] **0.3 Commit the reading.** Per-case exit table (A3/A4) and the
      unknown-flag sweep (C1) land under `agents/evidence/analysis/` with the
      command that produced them.
      verify: re-running the recorded command reproduces the counts.

## Phase 1 — A reject names its catch

- [x] **1.1 The ledger prints `failed=`.** One field in the report line.
      verify: a ledger gate's report line carries `failed=N`; no exit code changes.
- [x] **1.2 A crash is never a catch.** `runGateCli` distinguishes a signal or
      timeout from an exit; such a case is a **harness error**, never `behaved`.
      `SelfTestCase.expect` gains `refuse` (cannot run: dead scope, bad argv).
      verify: a unit test with a child killed by signal reports a harness error, not ✅.
- [x] **1.3 Gates may declare their dialect.** Optional `exit: { finding, cannot_run }`
      on `runSelfTest`; when present, *reject* must equal `finding` and *refuse*
      must equal `cannot_run`. A shrink-only count of self-test gates without the
      declaration lands in the gate-coverage baselines. No gate's exit code moves (K1).
      verify: a unit test where a reject case exits with the declared `cannot_run` code fails.
- [x] **1.4 A reject case may say what it caught.** Optional `names: RegExp`
      matched against the gate's output.
      verify: a unit test whose `names` does not match the output fails the case.

## Phase 2 — Every self-test runs

- [x] **2.1 One runner runs every self-test.** `src/scripts/run_gate_self_tests.ts`
      discovers every `src/scripts/*.ts` that calls `runSelfTest` and runs its
      `--self-test` in parallel; no hand-maintained list, so a new self-test is
      covered on arrival. CI: the `consistency` job; locally `task gate-self-tests`.
      verify: `task gate-self-tests` → 114/114 passed (18 s, 17 jobs); the
      discovered count equals the files calling `runSelfTest`.
- [x] **2.2 Hermetic by construction (B5).** The 2.1 CI step runs every
      self-test in a fresh checkout with no generated projection, which is the
      hermetic proof AC-1 asks for. The planned lint over `runSelfTest` callers
      is not built (decision E9): the pattern scan found 14 call sites passing
      the repo root, and most are legitimate (repo root as cwd with an explicit
      fixture argument, diff-based gates whose input *is* the tree). The
      remaining live-tree accept cases are named in
      `agents/evidence/analysis/gate-self-test-reading-2026-11-02.md`.
      verify: the 2.1 step is green on the PR's fresh CI checkout.

## Phase 3 — A flag the gate does not know is refused

- [x] **3.1 One strict parser.** `_lib/gate_args.ts` on `node:util`
      `parseArgs({ strict: true })`; an unknown flag exits 2 and names the flag.
      verify: unit tests — unknown flag → exit 2 naming it; `--flag=value` and repeated flags handled.
- [x] **3.2 Unknown-flag ratchet.** `check_gate_contracts` probes every gate
      added or changed against `origin/main` with `--definitely-not-a-flag`;
      the 186 gates measured permissive are listed in
      `src/config/gate-argv-permissive.json`, a shrink-only baseline, so a new
      permissive gate cannot land. `--all` re-runs the full sweep. The same gate
      carries the 1.3 undeclared-dialect ratchet.
      verify: `check_gate_contracts --self-test` 5/5; the recorded sweep is in
      `agents/evidence/analysis/gate-self-test-reading-2026-11-02.md`.

## Phase 4 — The page witness waits and listens

- [x] **4.1 Settle before the picture (D1).** After `load`:
      `document.fonts.ready`, then a short stillness wait, capped. The manifest
      records `settled_ms` per capture, or `unsettled: true` with the cap hit.
      verify: unit test on the settle helper — a page still mutating at the cap reports `unsettled`.
- [x] **4.2 Record and picture share one state.** The painted-font evaluation
      runs on the settled page, and the screenshot is taken after it.
      verify: source order in `uiRender.ts` — settle → evaluate → screenshot; covered by the existing render tests.
- [x] **4.3 Hear the console (D2b).** `console` error/warning and `pageerror`
      per capture into the manifest, as rows with no blocking power.
      verify: a fixture calling `console.error` once yields exactly one row (browser test, skipped without Chromium).
- [x] **4.4 The review reads the fields.** `design-review` cites the manifest's
      console rows and settle state where it now asks for a look.
      verify: `task sync` clean; the skill diff touches only that paragraph.

## Phase 5 — A golden change says why

- [x] **5.1 Golden intent per scenario.** A check that, for a diff range,
      requires one `Golden-Intent: GT-<id> — <reason>` line (commit message or
      PR body) per changed scenario under `tests/golden/baseline/`.
      verify: the check's `--self-test` rejects a planted change without the line and accepts it with one.

## Decisions

| # | Question | Resolution | Rung |
|---|---|---|---|
| E1 | Own roadmap or fold? | Own, active — operator asked for it in the invocation | operator |
| E2 | Self-test scope in CI | All self-tests in the normal vitest run (2.1); scoping deferred until the run time is measured red | agent |
| E3 | Converge exit dialects later? | Not here; declaration first (1.3), convergence stays K1 | agent |
| E4 | Unknown flag → which code? | 2, the dominant usage code; a gate declaring another `cannot_run` maps through it | agent |
| E5 | Golden intent: trailer or PR body? | Either, read from the range | agent |
| E6 | Skill step-disclosure pilot | Declined here (K6) | agent |
| E7 | Installed-link counts blocking | Owned by the archived links roadmap's successor; not here | agent |
| E9 | Build the hermetic lint (2.2)? | No — a heuristic gate without a measured false-positive rate; 14 hits, most legitimate. Revisit-if: a self-test goes red on CI only because of live-tree state. | agent |
| E8 | "Rejected when" blocks for instruction-only rules | Parked to `later/` — several are kernel rules, which need their own PR and soak | agent |

## Kill register

| # | Not adopted | Why |
|---|---|---|
| K1 | One exit dialect for every gate | Breaks pinned CLI contracts; declaration (1.3) gives the harness the same power |
| K2 | Rewriting every permissive parser in one PR | A flip without inventory reds tasks (C3); the ratchet (3.2) migrates by attrition |
| K3 | Contact-sheet PNG | Per-capture PNGs exist; a montage judges nothing |
| K5 | External golden oracle | No independent source exists for this engine's transcripts |
| K6 | Skill side-file pilot / ≤120-line cap | A number without measurement; owner asked for no added complexity |
| K9 | Isometric figure pack, agent dashboard (second draft) | No demand beyond the draft; duplicates the existing SVG toolchain (`src/scripts/_lib/svg_*`) |

## Risk register

| Risk | Mitigation |
|---|---|
| 1.2 surfaces self-tests green by accident | Expected; repaired in the same change or recorded |
| 2.1 adds CI minutes | Measured in 0.3; a self-test that dominates is the finding |
| Settle wait slows `ui:render` | Capped; `settled_ms` makes the cost visible |

## Acceptance criteria

- AC-1 All `--self-test` runs exit 0 in a fresh worktree with no generated projection.
- AC-2 No self-test case is `behaved` on a signal or timeout.
- AC-3 Every self-test runs in the vitest suite.
- AC-4 The unknown-flag count and the undeclared-dialect count are shrink-only baselines.
- AC-5 `ui:render` manifests carry `settled_ms|unsettled` and console rows.
- AC-6 A golden baseline change without an intent line fails its check.
