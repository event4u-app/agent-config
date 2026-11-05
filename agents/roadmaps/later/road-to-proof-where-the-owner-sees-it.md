---
complexity: structural
status: later
tree_pin: 630d97cb5b
execution:
  mode: phase-checkpoints
owner: maintainer
entry_condition:
  what: road-to-a-bench-that-can-tell is archived, so grader isolation, model prices, the power planner and the interpretation record exist; and an active roadmap closes, so this one fits under the WIP limit of five
  when: at the next active-roadmap closure after that
  who: agent, with the owner releasing each paid sweep
review_by: 2027-01-31
estate_offset_exempt: "New plan from one owner round (inbox-2026-11-x). Owner search: grep -rlF -e rules-kernel-dc -e art-svg -e 'terse prompt' -e 'drag-and-drop' -e Dockerfile.ac -e 'internal/bench/core' over agents/roadmaps/*.md, later/ and stubs/ returned no owner of the domain proof, the minimal-prompt baseline or the engine move. The pieces that do have owners are linked in relates and not copied."
estate_growth_exempt: "Parked carrier of the owner's 2026-11-05 demands (prove benefit where he sees it, compare against rivals on their own benchmarks, never remove on one bad bench, keep the bench inside AC unless an app is needed). Adds one later roadmap, no active one; every paid step waits on an owner release."
relates:
  - slug: road-to-a-bench-that-can-tell
    relation: depends
    note: "Its grader isolation, prices, power planner and interpretation record are inputs to every phase here."
  - slug: road-to-a-graph-that-wins
    relation: disjoint
    note: "Owns 'does the graph work' (owner turn 3). Not repeated here."
  - slug: road-to-a-memory-the-consumer-owns
    relation: disjoint
    note: "Owns memory recall. Step 3.4 adds only the task-outcome measurement."
  - slug: road-to-skill-uplift-measured-in-stages
    relation: disjoint
    note: "Owns the real skill A/B (the run_skill_evals _spawn_subagent stub). Phase 3 here only reads its result."
  - slug: road-to-a-security-chain-measured
    relation: disjoint
    note: "Owns the planted-findings security fixture; Phase 2 reuses it for the owner's web-security domain instead of writing a second one."
  - slug: road-to-assurance-benchmark
    relation: disjoint
    note: "Holds the neighbour pilot; Phase 5 extends its arm to rivals run on their own published benchmarks."
  - slug: road-to-benchmark-obsolescence-lifecycle
    relation: disjoint
    note: "Owns 'the model outgrew the rule'. Phase 4 here owns the evidence a removal needs; that file decides when one is due."
---
# Road to proof where the owner sees it

> **Source:** `agents/tmp.old/inbox-2026-11-x/` — owner transcript (seven turns),
> six plan revisions and the 2026-11-05 container result, re-verified at
> `main@630d97cb5b`. Sibling: `road-to-a-bench-that-can-tell` (the $0 foundation).

## Goal

Benefit is measured where the owner sees it. In daily work that is terse
prompts that still produce complete results, complex UI (drag & drop, responsive,
custom components), image → SVG, web security (login, passwords, XSS) and rules
that are followed — and he wants it **provable** (turn 2). This file measures exactly there, against the
cheapest equivalent (a short prompt) and against the packages AC is compared with,
and it lets the results change AC — including removing things — only through the
evidence the owner named in turn 7.

Constraints carried verbatim in intent:

- **A bad benchmark is a question, not a removal** (turn 7). Removal needs Phase 4.
- **No separate app unless needed** (turn 6). Everything here runs on the merged
  container runner inside this repo.
- **Measure new and reworked things for benefit and cost where possible** (turn 5),
  bounded by ADR-118: no unattended hill-climbing, no self-editing of defaults.

## Phase 1 — Tasks with room to show a lift

Evidence (read): `docs/benchmark.md:63-76` · `src/scripts/_lib/bench_ab_arms.ts:100-110`

The 2026-11-05 sweeps had control capability 87–100 % and discipline 0.83–0.94;
a ceiling that close caps any measurable lift at +0.06–0.17 before noise.

- [x] **1.1** Headroom screen: every candidate task is kept only below 0.80 joint <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=unrecognised path shape: internal/bench/corpora/ab-trackb-v2.yaml -->
  correct-and-disciplined on `vanilla`. Done at $0 from every existing paired
  report (all hosts pooled, 9–80 vanilla runs per task): 10 of 30 measured tasks
  have headroom — capH-debug-08, trapD-destruct-01, trapE-scope-laravel-01,
  trapE-scope-01, capH-debug-04, capH-debug-05, trapC-ambig-01, trapA-overeng-03,
  trapC-ambig-02, trapD-destruct-02. The four new tasks of 1.2 have no vanilla
  data yet; the 1.4 sweep screens them.
  verify: `./scripts-run src/scripts/check_bench_task_validity --gate` -> 0
- [x] **1.2** Add tasks of the classes the last result named: missed callers and <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: internal/bench/ab/fixtures-v2/hdrH-done-01/src/catalog/store.mjs -->
  tests after a signature change (`hdrH-callers-01`), unverified "done"
  (`hdrH-done-01`), a scope trap in a larger repo (`hdrE-scope-large-01`) and a
  long multi-step task (`hdrL-multistep-01`). Each ships a reference fix that
  passes and an untouched fixture that fails, with its verifier under
  `verifiers-v2/`. The scope task leaves room for one regression test, so a
  package that asks for a test is not penalised for writing it.
  verify: `./scripts-run src/scripts/check_bench_task_validity --gate` -> 0
- [x] **1.3** Keep `capH-debug-05` and `capH-debug-06` as standing regression tasks <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=unrecognised path shape: internal/bench/corpora/ab-trackb-v2.yaml -->
  (stubs `road-to-a-line-budget-that-does-not-tax-a-why-comment`,
  `road-to-a-minimal-diff-that-holds-under-load`).
  verify: both task ids present in `internal/bench/corpora/ab-trackb-v2.yaml` with their recorded `final_files`
- [x] **1.4** Paid attribution sweep, sized by `bench:ab:power`: `vanilla`, <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/bench_artifact_sweep.ts -->
  `package`, `rules-kernel-dc`, `placebo` and an A/A pair on the headroom tasks.
  Separates "which rule" from "how much context". Done 2026-11-05 on Haiku and
  Sonnet, 70 pairs per comparison: no pooled lift; scope discipline on Haiku lifts
  from 1/10 to 10/10 and the placebo does not reproduce it (`docs/benchmark.md`
  § Headroom sweeps).
  verify: report under `internal/bench/reports/ab-v2/` with an A/A pair and `bench_ab_interpret` labels for every comparison
- [ ] **1.5** Find why `package` makes Haiku ask the user for code in about 14% of
  runs instead of reading the repository (`trapC-ambig-01`, `hdrE-scope-large-01`
  in the 2026-11-05 Haiku sweep). Name the asset that triggers it from the
  transcripts before changing anything.
  verify: the transcripts of the asking runs name the asset; a rerun of the two tasks on Haiku shows the asking rate

## Phase 2 — The owner's domains

Evidence (read): `internal/bench/corpora/ab-artifact-v2.yaml` (nine `art-*` tasks, no drag-and-drop task) · `taskfiles/bench-ui.yml:14-16`

- [ ] **2.1** 2×2 prompt arms on the nine `art-*` tasks in
  `internal/bench/corpora/ab-artifact-v2.yaml`: vanilla + terse, AC + terse,
  vanilla + expert, AC + expert. "AC with a terse prompt reaches what vanilla
  needs an expert prompt for" is the owner's claim, stated as a testable one.
  verify: `grep -c 'prompt_variant' internal/bench/corpora/ab-artifact-v2.yaml` -> /^18$/
- [ ] **2.2** Add the missing UI task: drag & drop with keyboard and touch,
  responsive breakpoints, one custom component; graded by Playwright actions and
  axe, no model in scoring (the `taskfiles/bench-ui.yml` grader pattern).
  verify: the artifact selftest passes the reference and fails the untouched fixture for the new task
- [ ] **2.3** Web security: reuse the planted-findings fixture of
  `road-to-a-security-chain-measured` and add real exploit attempts (login, password
  storage, XSS) as the oracle.
  verify: the security oracle fails on the untouched fixture for every planted finding
- [ ] **2.4** Image → SVG: the two `art-svg` tasks graded by render similarity and
  editability (paths named, no embedded raster).
  verify: `npx vitest run tests/scripts/bench_artifact_svg.test.ts` -> 0
- [~] **2.5** Owner-released pilot over 2.1–2.4 with a `--max-usd` cap; the report
  states wins and losses alike. Blocked: `b-owner-spend`. Partial 2026-11-05: an
  artifact pilot ran before 2.1–2.4 exist, with one prompt per ladder rung; the
  three tasks it reached on Haiku sit at the ceiling for a short prompt, and so do
  the three UI tasks on Sonnet (`docs/benchmark.md` § Headroom sweeps).
- [ ] **2.6** Two faults the Sonnet artifact pilot exposed, both before any paid
  rerun: every `package` run stopped at the per-call budget on its first turn ($1
  and $3, against $0.14 for `vanilla`), with the cause unknown because the
  workspaces are disposed; and the three PHP tasks end `indeterminate` because the
  artifact path runs on a host without PHP. Keep the transcript of an errored run,
  find what the first turn spends, and run the PHP tasks where PHP exists.
  verify: one `package` run of `art-form-01` on Sonnet reaches an outcome other than `errored`, and the PHP tasks score on the untouched fixture
  verify: the report names wins and losses per domain with priced cost

## Phase 3 — Where the tokens go

Evidence (read): `docs/benchmark.md:76` · `src/scripts/preamble_byte_census.ts`

The full install cost 5.5–7.9× vanilla in tokens; the one significant arm before
(kernel + `downstream-changes`) cost 2.9×.

- [ ] **3.1** Default-context byte census per asset: extend
  `src/scripts/preamble_byte_census.ts` from subagent cold start to the main-session
  projection, one bucket per rule, hook output and catalog entry; 303 *listed*
  skills is not 303 *loaded*.
  verify: `./scripts-run src/scripts/preamble_byte_census --main-session` -> 0
- [ ] **3.2** A `minimal-prompt` arm in `src/scripts/_lib/bench_ab_arms.ts`: the
  shortest instruction that carries the intended behaviour. An asset must beat it,
  not only vanilla.
  verify: `grep -c "'minimal-prompt'" src/scripts/_lib/bench_ab_arms.ts` -> /^1$/
- [ ] **3.3** Smaller-default candidates (shortened rule, lazy reference, routed
  instead of always-loaded) are tried only on tasks where 1.4 or 2.5 showed an
  effect, compared on quality first, priced cost second.
  verify: each candidate's interpretation record compares quality first and priced cost second
- [ ] **3.4** "Does memory work" (owner turn 3) as an outcome, not a recall score:
  one multi-session task family (decision recall, a superseded decision, a stale
  entry) run with and without memory on this harness. Recall itself stays with
  `later/road-to-a-memory-the-consumer-owns`; this step only adds the task outcome.
  verify: a with/without-memory report over the multi-session family

## Phase 4 — Before anything is removed

Evidence (read): `docs/decisions/ADR-202-anchor-scoring-as-thin-quality-instrument.md:336-343` · `agents/evidence/metrics/skill-activation-census-all-slugs-2026-10-26.md:11-16`

The owner, turn 7: track real use before removing; check that the right benefit was
measured. A removal needs all of:

- [ ] **4.1** An interpretation record (sibling Phase 4) whose open questions are
  answered: construct matched the asset's purpose, the asset was delivered and
  followed, the cost is priced.
  verify: the record for the asset has no open construct, delivery or cost question
- [ ] **4.2** Real-use evidence: rerun the skill census over every project store,
  counting Read events on `SKILL.md` as well as `Skill` calls (stub
  `road-to-a-census-that-refuses-a-partial-store`), and record the result per asset.
  The 2026-10-26 "8 of 301" counted one repository and direct calls only.
  verify: the census report lists every store read and counts Read events on SKILL.md
- [ ] **4.3** A per-family non-inferiority margin declared before the deciding run;
  no universal 3 pp.
  verify: the margin is committed before the deciding report's timestamp
- [ ] **4.4** Security and safety assets are tested with adversarial fixtures, never
  judged by how often they fire.
  verify: each safety asset has an adversarial fixture that fails without it
- [ ] **4.5** Hide-from-default before delete: the first step of a removal is
  lazy-load or route, reversible in one release.
  verify: the removal PR changes routing or loading, not file existence

## Phase 5 — Against the packages AC is compared with

Evidence (claimed): `agents/tmp.old/inbox-2026-11-x/chat.txt:798` (owner turn 4)

Owner turn 4: run the rivals' own benchmarks, be better per area. Named packages
and their install recipes do not go into this tree (`source-confidentiality`).

- [ ] **5.1** Pick one rival whose published benchmark is runnable; reproduce *its*
  number in a container first, unchanged. A vendor percentage is never an AC score.
  verify: the reproduced number sits within the rival's published interval, or the gap is recorded
- [ ] **5.2** Rival image beside `Dockerfile.ac` with the same load proof; run AC
  and vanilla on the rival's tasks with the rival's scorer.
  verify: the rival trial passes the same load check as `bench-ac`
- [ ] **5.3** Where the rival wins: name the mechanism, rebuild the smallest part
  that carries it, re-measure on tasks not used for tuning; stop after three rounds
  and record the remaining gap.
  verify: the re-measurement uses tasks absent from the tuning set; at most three rounds recorded
- [~] **5.4** Where names, recipes and named reports live. Blocked:
  `b-private-store`.
  verify: the owner's choice recorded under `b-private-store`

## Phase 6 — The bench stays a lab part

Evidence (read): `package.json` `files[]` includes `src/scripts/` · `src/scripts/surface-tiers.yml:8-10`

- [ ] **6.1** Move the bench engine (`src/scripts/bench_*`, `src/scripts/_lib/bench_*`)
  to `internal/bench/core/`, the `internal/bench/ui/` precedent: `package.json`
  `files[]` ships `src/scripts/`, and 80 bench files currently ship to consumers.
  `agent-config benchmark` (the user command) stays.
  verify: `npm pack --dry-run` -> /^(?![\s\S]*scripts\/bench_)/
- [ ] **6.2** Durable evidence: each sweep's report, checkpoint and a sha256 manifest
  are copied out of the gitignored report directory into a store outside any
  checkout; offline re-scoring reproduces the numbers.
  verify: offline re-scoring of a stored bundle reproduces the report's numbers
- [ ] **6.3** The extraction gate stays as the companion plan wrote it: an app only
  when at least two of external demand, rival-dominated engine work, a licence
  conflict, CI burden, or an owner-wanted public ranking hold — and the owner agrees.
  verify: the T3 report carries the gate table with each criterion's current state

## Phase 7 — Measurement rides with change

Evidence (read): `src/scripts/_lib/dispatch_policy.ts:187` · `src/config/dispatch-policy.json`

- [ ] **7.1** Wire the existing `PolicyChange` diff (`src/scripts/_lib/dispatch_policy.ts:187`)
  into `check_claims`: a new default knob without a policy row fails.
  verify: a fixture adding a default knob without a policy row makes `check_claims` exit non-zero
- [ ] **7.2** A changed always-loaded asset reports its byte delta (3.1) in the PR;
  a behaviour claim names the tier of evidence it rests on.
  verify: a PR touching an always-loaded asset prints its byte delta
- [ ] **7.3** A roadmap that changed a default asset closes only with the
  measurement it ran, or one line naming why none was possible (owner turn 5:
  "after a roadmap, run tests for those areas").
  verify: a closing roadmap that changed a default asset carries a measurement line

## Blockers

### blocker: b-owner-spend

- **Owner:** user
- **What:** every paid sweep (2.5, 5.1–5.2). The first 2026-11-05 sweeps spent
  $17.85 of a $30 release; the headroom sweeps the same day ran under a separate
  $150 release (spend in `docs/benchmark.md` § Headroom sweeps).
- **Closes when:** the owner releases a budget per sweep.

### blocker: b-private-store

- **Owner:** user
- **What:** where rival names, recipes and named reports live — a private data
  repository (outward-facing, owner-reserved) or a local protected directory (v10
  P0.4). Also decides whether a confirmatory hold-out needs protection from
  authoring sessions.
- **Closes when:** the owner picks one.

## Decisions

| # | Decision | Reason | Revisit-if |
|---|---|---|---|
| D1 | Two packages the owner listed in turn 4 are not merged into one silently | the plans did that without saying so; Phase 5 starts with one rival and asks before treating two as the same (names under `b-private-store`) | the owner names the package |
| D2 | A catalogue on the owner's list is not a rival arm | it is a list of packages, not an installable package (v10 §P1.5) | — |
| D3 | No numeric cost target yet | v10 §P1.4: set after a pilot and a power calculation; lift-v8's ≤ 2× is a proposal without data | Phase 3 has a measured pilot |

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-11-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A rare asset looks unused | product | A security or rare-case asset is removed because it seldom fires | 4.4 tests safety assets adversarially; 4.5 hides before it deletes | Phase 4 — Before anything is removed |
| 2 | Tuning on the deciding tasks | implementation | Candidates are tuned on the tasks that then decide them | 3.3 and 5.3 re-measure on tasks not used for tuning | Phase 3 — Where the tokens go |
| 3 | Rival benchmarks favour their own design | product | A rival's task set rewards its own mechanism | 5.1 reproduces their number first; results per area, no composite score | Phase 5 — Against the packages AC is compared with |

## Acceptance Criteria

- Every reported effect names its tasks, pairs, priced cost and interpretation labels.
- No asset leaves the default without the Phase 4 record.
- At least one rival is reproduced on its own benchmark before any comparison is published.
- `npm pack --dry-run` contains no bench engine file.
