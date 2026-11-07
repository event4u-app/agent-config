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

> **Arrivals:** 1 — latest `inbox-2026-11-na` (2026-11-06): the owner's roles /
> second-agent / A/B thread, re-verified at `main@8206cc0`. It asks whether a reviewer
> or tester step earns its spawn; the only place that can answer is the three tasks
> every arm fails here, so it landed as step 1.7. It also re-raised 1.5 (the 14 %
> asking rate) as if it had no owner — it has one, this file.

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

Evidence (read): `docs/benchmark.md:63-76` · `internal/bench/core/_lib/bench_ab_arms.ts:100-110`

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
- [x] **1.4** Paid attribution sweep, sized by `bench:ab:power`: `vanilla`, <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: internal/bench/core/_lib/bench_artifact_sweep.ts -->
  `package`, `rules-kernel-dc`, `placebo` and an A/A pair on the headroom tasks.
  Separates "which rule" from "how much context". Done 2026-11-05 on Haiku and
  Sonnet, 70 pairs per comparison: no pooled lift; scope discipline on Haiku lifts
  from 1/10 to 10/10 and the placebo does not reproduce it (`docs/benchmark.md`
  § Headroom sweeps).
  verify: report under `internal/bench/reports/ab-v2/` with an A/A pair and `bench_ab_interpret` labels for every comparison
- [x] **1.5** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: internal/bench/core/bench_ab_v2_run.ts --> Find why `package` makes Haiku ask the user for code in about 14% of
  runs instead of reading the repository (`trapC-ambig-01`, `hdrE-scope-large-01`
  in the 2026-11-05 Haiku sweep). Name the asset that triggers it from the
  transcripts before changing anything.
  Done 2026-11-05: a kernel leave-one-out, then 40 runs per candidate, names
  `ask-when-uncertain`: blind questions (no tool call first) 7/40 with the kernel,
  1/40 without it (p = 0.028, ≈ 0.085 corrected for three candidates). Kept
  streams under `reports/ab-v2/streams/` carry the evidence (`docs/benchmark.md`
  § Which rule makes Haiku ask without looking).
  verify: the transcripts of the asking runs name the asset; a rerun of the two tasks on Haiku shows the asking rate
- [ ] **1.6** A wording of `ask-when-uncertain` that puts looking before asking
  ("read what the workspace already answers, then ask"), in its own PR under the
  kernel-rule soak. Measure it against the 2026-11-05 baseline before it merges:
  `rules-kernel-dc` with the new text on `trapC-ambig-01` and `hdrH-done-01`,
  40 runs per arm on Haiku. Asking after a look on a genuinely ambiguous request
  must not drop.
  verify: blind questions below 3/40 with the new wording, and `trapC-ambig-01` questions after a look not below the baseline's 6/20
  Measured 2026-11-06 (report `2026-11-06T08-13-53Z`, `docs/benchmark.md` § Headroom sweeps): the candidate
  `internal/bench/candidates/ask-when-uncertain.look-first.md` asked blind in 3/40 runs (same-day control 5/40),
  and after a look in 6/20 on `trapC-ambig-01` (control 11/20). The bar is missed, and the difference is
  within noise (p = 0.36). Open: the bar needs a sample size that can separate single-digit rates (`bench:ab:power`)
  before another wording is measured; the rule stays unchanged.
  Sized 2026-11-06 (`bench_ab_power`, paired sign test, α 0.05, power 0.8, independent
  per-run rates): the bar's own distance (control 15 % → candidate 7.5 % blind) needs
  **240 pairs per arm**; a candidate at 5 % needs 124, at 2.5 % needs 57. At the measured
  $0.023 per Haiku run, 240 pairs per arm is 480 runs, about $11. The next measurement
  runs at that size or not at all, and waits on `b-owner-spend`.
  Measured 2026-11-07 at that size (report `2026-11-07T09-54-45Z`, 480 runs, $11.46): blind 17/240
  (7.1 %, bar met) against 22/240 for the same-day control (p = 0.25); after a look on
  `trapC-ambig-01` 56/120 (floor met); joint pass on `trapC-ambig-01` 73 against 53 of 120
  (p = 0.007). Both verify bars hold. Open: the rule edit itself — `ask-when-uncertain` is a
  kernel rule, agent writes to it are refused by `block-kernel-rule-writes`, so the PR that
  adopts `internal/bench/candidates/ask-when-uncertain.look-first.md` is the owner's.
- [x] **1.7** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: internal/bench/ab/fixtures-v2/hdhI-invalidation-01/src/auth/roles.mjs --> Does a second agent earn its spawn where every arm fails? Re-opens
  `team-defect-finding-null` through its own condition (a): a corpus that breaks the
  ceiling (`docs/benchmark.md` § Defect-finding). Four harness-orchestrated arms on
  `capH-debug-08`, `hdrH-done-01`, `hdrL-multistep-01` plus a sealed hold-out of three
  new tasks of the same edge-case class (boundary value, invalidation, sentinel value),
  written with reference fix and validity gate before the run and hashed into the
  evidence record:
  - **A** one agent, base profile (control, descriptive only);
  - **B** as A with one effort step more, priced to match D — the same-cost arm; without
    it a second agent only measures more compute;
  - **C** as A plus a test-first step: a fresh subagent writes edge-case tests from the
    requirement (method, not persona — `docs/CLAIMS.md` `persona-identity-placebo-null`),
    the harness runs them, then the implementation runs;
  - **D** as A plus a slim reviewer on diff + requirement (the arm of
    `road-to-token-economy-dispatch-followup` 3.2a); findings go back to the author once.
  Primary endpoints C vs B and D vs B on the hidden verifier, paired, Holm over both,
  analysed per task cluster. Safety endpoints: reviewer findings the verifier does not
  confirm (false positives) and unneeded changed lines. Pairs from `bench:ab:power` on
  this setup's A/A. Budget-stop counts as fail; p50/p95 priced cost per arm. Gates before
  the first paid run: 6.2 report durability, the Sonnet `package` first-turn budget
  stop explained or excluded for the chosen host (2.6), the verdict comparison of
  `road-to-token-economy-dispatch-followup` 3.2a passed, and `b-owner-spend` released
  for 1.7 with its bars. The harness drives the steps as separate CLI calls, so
  the run measures the mechanism, not prompt obedience. A ladder `review`/`test` rung is
  proposed only if C or D beats **B** on the headroom tasks **and** the hold-out and holds
  the false-positive bar — then as a shadow `would_choose` beside the real verdict of
  `src/scripts/_lib/judgment_ladder.ts`, never a second classifier.
  Pair/driver-navigator, a PO agent and an expert huddle (owner turns 3-4) stay parked
  until this step is positive **and** a separate pre-registered question exists that
  arm D does not answer.
  verify: pre-registration committed before the first run; a result record with the hold-out, either direction
  **Result (2026-11-06, A/B/C only — D dropped by Amendment 1):** C vs B 7–5, p = 0.39,
  not detected at this size; arm C's tests reject the reference fix in 39.6 % of runs
  (ceiling 25 %); net value −$0.067/run; $67.41 of the $150 release. No rung.
  `agents/evidence/analysis/headroom-17-second-agent-2026-11-06.md`,
  `docs/benchmark.md` § Second agent on the headroom tasks.
- [ ] **1.7d** Arm D of 1.7 (slim reviewer on diff + requirement, one revision) on the
  same corpus and seal, against B, under the D4 false-positive ceiling. Blocked until a
  reviewer passes the verdict comparison of `road-to-token-economy-dispatch-followup`
  3.2a, which the slim reviewer failed on 2026-11-06 (false positives on contested
  controls 2/3 vs full 1/3). Needs its own spend release.
  verify: a pre-registration amendment for D committed before its first paid call; a result record D vs B with the hold-out, either direction

## Phase 2 — The owner's domains

Evidence (read): `internal/bench/corpora/ab-artifact-v2.yaml` (nine `art-*` tasks, no drag-and-drop task) · `taskfiles/bench-ui.yml:14-16`

- [x] **2.1** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: internal/bench/core/_lib/bench_artifact_corpus.ts --> 2×2 prompt arms on the nine `art-*` tasks in
  `internal/bench/corpora/ab-artifact-v2.yaml`: vanilla + terse, AC + terse,
  vanilla + expert, AC + expert. "AC with a terse prompt reaches what vanilla
  needs an expert prompt for" is the owner's claim, stated as a testable one.
  verify: `grep -c 'prompt_variant' internal/bench/corpora/ab-artifact-v2.yaml` -> /^20$/ (18 for the nine tasks, 2 for `art-dnd-01` added by 2.2)
  Done 2026-11-06: each task carries `terse` (its prompt) and `expert` (the prompt plus
  its pre-registered `informed` ladder); `--prompt-variant both --arms vanilla,package`
  runs the 2×2 and tags every record `prompt_variant` (`internal/bench/corpora/SCHEMA-v2.md`).
  The run itself is 2.5's and waits on `b-owner-spend`.
- [x] **2.2** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: internal/bench/core/_lib/bench_artifact_browser_worker.ts --> Add the missing UI task: drag & drop with keyboard and touch,
  responsive breakpoints, one custom component; graded by Playwright actions and
  axe, no model in scoring (the `taskfiles/bench-ui.yml` grader pattern).
  verify: the artifact selftest passes the reference and fails the untouched fixture for the new task
  Done 2026-11-06: `art-dnd-01` (reorderable list: mouse, touch, keyboard, two
  breakpoints, a custom switch) graded by the new `browser-acceptance` grader in
  headless Chromium. Selftest: reference 8/8, a draggable-only page 4/8, `--swap` red,
  the untouched fixture fails on the missing deliverable. The axe column reads
  `unknown` until `axe-core` is installed, as for the DOM grader.
- [ ] **2.3** Web security: reuse the planted-findings fixture of
  `road-to-a-security-chain-measured` and add real exploit attempts (login, password
  storage, XSS) as the oracle.
  verify: the security oracle fails on the untouched fixture for every planted finding
  Waiting 2026-11-06: the planted-findings fixture this step reuses does not exist yet.
  `stubs/road-to-a-security-chain-measured` owns it (see `relates`) and is not active;
  building it here would take over that scope. Resumes when the stub lands its fixture.
- [x] **2.4** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: internal/bench/core/_lib/bench_artifact_graders.ts --> Image → SVG: the two `art-svg` tasks graded by render similarity and
  editability (paths named, no embedded raster).
  verify: `npx vitest run tests/scripts/bench_artifact_svg.test.ts` -> 0
  Done 2026-11-06: both tasks require every shape named (`id` or `<g id>`) and at most
  40 shapes; the raster task also scores colour agreement with `mascot.png` in
  Chromium, min 0.85 from calibration (faithful reference 0.890, two-rectangle sketch
  0.738, blank 0.204, wrong colours 0.026). Render similarity applies only where a
  source raster exists; the prompt task has none, so it is graded on editability.
  Briefs and ladders state the new requirement, so earlier pilot runs of these two
  tasks are not comparable with later ones.
- [~] **2.5** Owner-released pilot over 2.1–2.4 with a `--max-usd` cap; the report
  states wins and losses alike. Blocked: `b-owner-spend`. Partial 2026-11-05: an
  artifact pilot ran before 2.1–2.4 exist, with one prompt per ladder rung; the
  three tasks it reached on Haiku sit at the ceiling for a short prompt, and so do
  the three UI tasks on Sonnet (`docs/benchmark.md` § Headroom sweeps).
  Run 2026-11-07 (report `artifact-2026-11-07T09-56-16-929Z`, $73.92, stopped at its $70 cap
  after 3 of 10 tasks): where both arms have data `package` never does better and costs 5–11× as
  much; 22 of 40 ladders hung on the host's second API call, now re-run once by `host_call`.
  The full pilot is about $600–700 (two ladders × up to five resumed prompts at ~100k tokens each
  for `package`), so the remaining seven tasks wait on a release of that size under
  `b-owner-spend` (`docs/benchmark.md` § Artifact pilot over the owner's domains).
- [x] **2.6** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: internal/bench/core/_lib/bench_artifact_install.ts --> Two faults the Sonnet artifact pilot exposed, both before any paid
  rerun: every `package` run stopped at the per-call budget on its first turn ($1
  and $3, against $0.14 for `vanilla`), with the cause unknown because the
  workspaces are disposed; and the three PHP tasks end `indeterminate` because the
  artifact path runs on a host without PHP. Keep the transcript of an errored run,
  find what the first turn spends, and run the PHP tasks where PHP exists.
  Done 2026-11-05: the arm loaded the repository's `agents/` tree as subagents via
  `--plugin-dir` (~370k tokens); it now installs the packed checkout with the public
  installer and is load-checked. Installed, `art-form-01` reaches parity on Sonnet
  at $0.96 per run (vanilla $0.14). PHP grading runs through
  `internal/bench/containers/php-in-docker.sh`; the self-test separates all three
  PHP tasks (`docs/benchmark.md` § Headroom sweeps).
  verify: one `package` run of `art-form-01` on Sonnet reaches an outcome other than `errored`, and the PHP tasks score on the untouched fixture
  verify: the report names wins and losses per domain with priced cost

## Phase 3 — Where the tokens go

Evidence (read): `docs/benchmark.md:76` · `src/scripts/preamble_byte_census.ts`

The full install cost 5.5–7.9× vanilla in tokens; the one significant arm before
(kernel + `downstream-changes`) cost 2.9×.

- [x] **3.1** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/main_session_census.ts --> Default-context byte census per asset: extend
  `src/scripts/preamble_byte_census.ts` from subagent cold start to the main-session
  projection, one bucket per rule, hook output and catalog entry; 303 *listed*
  skills is not 303 *loaded*.
  verify: `./scripts-run src/scripts/preamble_byte_census --main-session` -> 0
  Done 2026-11-06: measured from what the host recorded delivering (transcript
  `instructions`, `skill_listing` and hook attachments), not modelled from files. On
  this repo's session that day: ~401k chars (~100k tokens) at start-up — 119
  instruction files (367k chars), a 29k-char skill catalog listing 633 skills of which
  235 carry a description and 398 arrive as a bare name — and 346 chars of hook
  output on every prompt turn. Exit 2 when no transcript holds an instructions delivery.
  Reading written up in `docs/benchmark.md` § Where the main session's default context
  goes: rules are 91 % of the start-up load, and 21 domain and stack rules (~64k chars,
  17 % of the instructions) load in every session on a repository that never uses them.
- [x] **3.2** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: internal/bench/core/bench_ab_v2_stats.ts --> A `minimal-prompt` arm in `internal/bench/core/_lib/bench_ab_arms.ts`: the
  shortest instruction that carries the intended behaviour. An asset must beat it,
  not only vanilla.
  verify: `grep -c "'minimal-prompt'" internal/bench/core/_lib/bench_ab_arms.ts` -> /^1$/
  verify: a synthetic report with `vanilla`, `minimal-prompt` and `package` renders the `package` vs `minimal-prompt` comparison (`npx vitest run tests/scripts/bench_ab_minimal_prompt_comparisons.test.ts` -> 0)
  Done 2026-11-06: four plain sentences (smallest change, update what it affects,
  read before asking, test before done), injected with this package scoped away and
  no package vocabulary. Not yet run; its first reading rides with the next paid sweep.
  Re-verified 2026-11-06 under the sharper verify: the report compares `package` and
  `rules-kernel-dc` against the arm and the arm against `vanilla`, and the injected text
  is frozen in `docs/benchmark.md` § The minimal-prompt baseline before its first run.
  `minimal-prompt` is in `CODEX_VALID_ARMS` since 2026-11-07 (pure injection, like
  `bare-principle`). Probed 2026-11-07 before 2.5 (report `2026-11-07T08-01-00Z`): first-turn
  context 7,963 tokens against 7,826 for `vanilla` and 99,370 for `package`
  (`docs/benchmark.md` § The minimal-prompt baseline).
- [ ] **3.3** Smaller-default candidates (shortened rule, lazy reference, routed
  instead of always-loaded) are tried only on tasks where 1.4 or 2.5 showed an
  effect, compared on quality first, priced cost second.
  verify: each candidate's interpretation record compares quality first and priced cost second
  First candidate set from 3.1: the 21 domain and stack rules that load unconditionally
  under the full profile (finance, legal, strategy, media, persistence packs, stack
  routing; ~64k chars). Still gated on an effect from 1.4 or 2.5.
- [x] **3.4** "Does memory work" (owner turn 3) as an outcome, not a recall score:
  one multi-session task family (decision recall, a superseded decision, a stale
  entry) run with and without memory on this harness. Recall itself stays with
  `later/road-to-a-memory-the-consumer-owns`; this step only adds the task outcome.
  verify: a with/without-memory report over the multi-session family
  Done 2026-11-07: three tasks (`memA-recall-01`, `memB-supersede-01`, `memC-stale-01`) and the
  arms `package-memory` / `package-no-memory` (`strip_paths`); report `2026-11-07T08-54-56Z`, Haiku,
  90 runs, $5.77. NULL: 0/10 on memA and memB in every arm, 10/10 on memC in every arm, and no
  run opened the store (`docs/benchmark.md` § Memory as a task outcome). Delivery is the gap;
  recall stays with `later/road-to-a-memory-the-consumer-owns`.

## Phase 4 — Before anything is removed

Evidence (read): `docs/decisions/ADR-202-anchor-scoring-as-thin-quality-instrument.md:336-343` · `agents/evidence/metrics/skill-activation-census-all-slugs-2026-10-26.md:11-16`

The owner, turn 7: track real use before removing; check that the right benefit was
measured. A removal needs all of:

- [x] **4.1** An interpretation record (sibling Phase 4) whose open questions are
  answered: construct matched the asset's purpose, the asset was delivered and
  followed, the cost is priced.
  verify: the record for the asset has no open construct, delivery or cost question
  Enforced 2026-11-07 by `check_default_asset_removal` (CI: standing-payload-delta,
  local: `task check-default-asset-removal`): deleting a rule or a skill's `SKILL.md`
  needs `agents/evidence/removals/<name>.md`, whose frontmatter answers an interpretation record with no `construct|delivery|cost: open` line.
- [x] **4.2** Real-use evidence: rerun the skill census over every project store,
  counting Read events on `SKILL.md` as well as `Skill` calls (stub
  `road-to-a-census-that-refuses-a-partial-store`), and record the result per asset.
  The 2026-10-26 "8 of 301" counted one repository and direct calls only.
  verify: the census report lists every store read and counts Read events on SKILL.md
  Done 2026-11-07: `report_skill_activation --all-stores --per-skill` reads every store
  under both projects roots (1640 stores, 4072 sessions; names withheld) and counts
  `Read` of a `SKILL.md`. 36 of 303 shipped skills were reached, 34 only by a direct
  read. Per-asset table: `agents/evidence/metrics/skill-use-census-all-stores-2026-11-07.md`.
- [x] **4.3** A per-family non-inferiority margin declared before the deciding run;
  no universal 3 pp.
  verify: the margin is committed before the deciding report's timestamp
  Enforced 2026-11-07 by `check_default_asset_removal` (CI: standing-payload-delta,
  local: `task check-default-asset-removal`): deleting a rule or a skill's `SKILL.md`
  needs `agents/evidence/removals/<name>.md`, whose frontmatter answers `margin`, `margin_commit` and `deciding_report`, the margin commit older than the report.
- [ ] **4.4** Security and safety assets are tested with adversarial fixtures, never
  judged by how often they fire.
  verify: each safety asset has an adversarial fixture that fails without it
  Partly enforced 2026-11-07: the removal gate refuses a record with `safety: true` and no
  existing `adversarial_fixture`. Open: the fixtures themselves — one per security or safety
  asset that fails without it — are a measurement per asset, not a gate.
- [x] **4.5** Hide-from-default before delete: the first step of a removal is
  lazy-load or route, reversible in one release.
  verify: the removal PR changes routing or loading, not file existence
  Enforced 2026-11-07 by `check_default_asset_removal` (CI: standing-payload-delta,
  local: `task check-default-asset-removal`): deleting a rule or a skill's `SKILL.md`
  needs `agents/evidence/removals/<name>.md`, whose frontmatter answers `hidden_in`, an earlier base commit where the asset was already out of the default (rule `type: manual`, skill `disable-model-invocation: true`).

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

- [x] **6.1** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: .github/workflows/bench-drift.yml --> Move the bench engine (`src/scripts/bench_*`, `src/scripts/_lib/bench_*`)
  to `internal/bench/core/`, the `internal/bench/ui/` precedent: `package.json`
  `files[]` ships `src/scripts/`, and 80 bench files currently ship to consumers.
  `agent-config benchmark` (the user command) stays.
  verify: `npm pack --dry-run` -> /^(?![\s\S]*scripts\/bench_)/
  Done 2026-11-07: 88 files under `internal/bench/core/`, typechecked and linted
  there; `npm pack` carries no bench file. Eleven maintainer-only scripts that import
  the engine (showcase, evolution lab, bench linters, release and its drill,
  llm_propose) stay in `src/scripts/` and are excluded from the package by name;
  `prepack-check` now honours npm's negated `files` entries. Frozen records keep the
  paths they were written with.
- [x] **6.2** Durable evidence: each sweep's report, checkpoint and a sha256 manifest <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: internal/bench/core/_lib/bench_artifact_sweep.ts -->
  are copied out of the gitignored report directory into a store outside any
  checkout; offline re-scoring reproduces the numbers.
  verify: offline re-scoring of a stored bundle reproduces the report's numbers
- [x] **6.3** The extraction gate stays as the companion plan wrote it: an app only
  when at least two of external demand, rival-dominated engine work, a licence
  conflict, CI burden, or an owner-wanted public ranking hold — and the owner agrees.
  verify: the T3 report carries the gate table with each criterion's current state
  Done 2026-11-07: `internal/bench/core/bench_extraction_gate.ts` renders the table —
  G2 (rival share of engine commits) and G4 (bench share of failed CI runs) measured
  over 90 days, G1/G3/G5 from `internal/bench/extraction-gate.json`, unmeasurable reads
  `unknown`. First reading in `docs/benchmark.md` § Extraction gate: 0 of 5 hold
  (0 of 197 engine commits, 0 of 52 failed runs) — the bench stays. No T3 report exists
  yet; the first one (Phase 5) carries this table.

## Phase 7 — Measurement rides with change

Evidence (read): `src/scripts/_lib/dispatch_policy.ts:187` · `src/config/dispatch-policy.json`

- [x] **7.1** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/dispatch-policy.json --> Wire the existing `PolicyChange` diff (`src/scripts/_lib/dispatch_policy.ts:187`)
  into `check_claims`: a new default knob without a policy row fails.
  verify: a fixture adding a default knob without a policy row makes `check_claims` exit non-zero
  Done 2026-11-06, by enumeration rather than by the release delta: `knobsIn` reads
  every dispatch default from the places the table already binds (subagent
  `model_tier` / `omit_project_instructions`, the template's `subagents:` section, the
  council's round defaults), and `check_claims` fails on one with no row. The six
  that predate the check sit in `known_unbound`, a baseline that may only shrink.
- [x] **7.2** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/standing_asset_delta.ts --> A changed always-loaded asset reports its byte delta (3.1) in the PR;
  a behaviour claim names the tier of evidence it rests on.
  verify: a PR touching an always-loaded asset prints its byte delta
  Done 2026-11-07. The bucket half already existed: `standing-payload-delta.yml` posts
  `check_standing_payload_delta` as a sticky PR comment (#2845 showed +4 tok on project
  rules). Added: a per-asset table of every always-loaded asset whose loaded size
  changed (projected rule, skill catalog entry, CLAUDE.md), and a PR-template field that
  names a behaviour claim's evidence tier from `docs/contracts/evidence-basis.md`. The
  tier field is a prompt to the author; no gate reads it.
- [x] **7.3** A roadmap that changed a default asset closes only with the
  measurement it ran, or one line naming why none was possible (owner turn 5:
  "after a roadmap, run tests for those areas").
  verify: a closing roadmap that changed a default asset carries a measurement line
  Done 2026-11-07: the archival sweep (`archive_completed_roadmaps`) refuses a complete
  roadmap whose closed steps name a rule, a skill's `SKILL.md`, `CLAUDE.md` or
  `AGENTS.md` until it carries `Measurement: …` or `Measurement: none possible — …`
  (`src/agent-src/scripts/measurement_line.ts`, `tests/scripts/measurement_line.test.ts`).
  "Changed" is read from the roadmap's own steps and receipts; a false positive costs one line.

## Blockers

### blocker: b-owner-spend

- **Owner:** user
- **What:** every paid sweep (1.6, 1.7, 1.7d, 2.5, 5.1–5.2). 1.7 is sized at about $130 against a $150 cap on Sonnet 4.6, and its release carries
  the three bars it is judged against, set before the run and never after: the
  false-positive ceiling for reviewer findings, the cost `D` of an escaped defect for the
  net-value line `p_catch · D − C_review − r_FP · C_FP`, and arm A's base profile
  (`essential` or `package`). The first 2026-11-05 sweeps spent
  $17.85 of a $30 release; the headroom sweeps the same day ran under a separate
  $150 release (spend in `docs/benchmark.md` § Headroom sweeps).
- **Released for 1.7 (owner, 2026-11-06):** up to $150 (sized at about $130), with
  the bars set by the agent on the owner's instruction and recorded as D4 below
  before any run. Spent 2026-11-06: $67.41 (smoke $1.94, sweep $65.47); arms A–C ran,
  D did not (its 3.2a gate failed), so the release does not cover 1.7d. Not released:
  1.6 (sized at about $11), 1.7d, 2.5, 5.1–5.2.
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
| D4 | Bars for 1.7, fixed before the first run (2026-11-06, owner released the budget and delegated the values): **false-positive ceiling** — at most 25 % of arm D's reviewer findings, pooled over the headroom tasks and the hold-out, may be unconfirmed by the hidden verifier; for arm C a test that fails on the reference fix counts as a false positive under the same ceiling. **Escaped-defect cost** `D` = 10 × arm A's p50 priced cost per run, and `C_FP` = 1 × that cost, so the net-value line is priced in the run's own currency. **Base profile** of arm A = `package` (the shipped full set), not `essential` | the question is whether a second agent pays over what consumers actually run; `essential` is opt-in and its default status waits on its own measurement. 25 % keeps one bogus finding in four, beyond which a reviewer costs the author more re-work than its catches save at `D` = 10× | the 6.2/3.2a gates change the arm design, or the default profile changes before the run |

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
