---
complexity: lightweight
status: ready
tree_pin: 3445cf41d6
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Owner request of 2026-11-09 to park the session with every open item findable on main. The third look (ask-scope variant) reads NON-INFERIOR under the owner's exclusion reading, so the adapted form is a release candidate; its payload lives only on the pushed measurement branch `bench/variant-ask-scope-20261109`, and no other roadmap names the steps that would bring it to main. The two parked parents hold the measurements, not this landing work."
estate_offset_exempt: "No active roadmap is done or parkable in this change: the session is being parked by the owner, and archiving unrelated work to make room would hide it. The parents that hold the measurements are already in later/, so there is nothing to merge this into. Owner search: a grep over agents/roadmaps/{*,later,stubs} for `variant-ask-scope` and `adapted-layer` returns nothing."
relates:
  - slug: road-to-a-start-as-light-as-the-field
    relation: extends
    note: "Its blocker start-cut-waits-on-full-vs-reduced stays open on the two gate decisions this file resolves."
  - slug: road-to-a-setup-that-decides-itself-carried
    relation: extends
    note: "Its 5.2 note records the third look; this file lands the candidate it names."
  - slug: road-to-a-session-start-under-the-host-limit
    relation: extends
    note: "Owns `check_session_start_budget` (≤80k); step 1.2 here must stay inside it or decide on it."
---
# Road to the adapted layer on main

> **Source:** owner decision of 2026-11-09 recorded in
> `agents/evidence/metrics/ask-scope-vs-full-layer-result-20261109.md`
> § Owner decision, 2026-11-09 (merged in PR #2946).
>
> **Arrivals:** 1 — `inbox-2026-11-wn` (2026-11-09): an external review asks
> that the release rest on a fresh pre-registered run rather than on the
> post-data reading of the third look, with pre-model aborts settled in the
> protocol beforehand, a padded arm, and Haiku plus Sonnet 5.5 (→ 1.4, 1.5,
> blocker options (f) and (g)).

## Goal

The adapted start layer that measured NON-INFERIOR is on main, with
`check_startup_contracts` and `check_session_start_budget` both green, or the
owner has decided in writing why it does not ship.

## Where things stand

- **Payload:** two commits on the pushed branch `bench/variant-ask-scope-20261109`
  (`ced3e99b3b` contract stubs, `51add0fc53` scoped ask-first line). They
  touch four files only: new startup-contract stubs for `downstream-changes`
  and `think-before-action` under `src/agent-src/startup-contracts/rules/`,
  plus their `dist/agent-src/` projections (+26 lines). The stubs do not
  exist on main yet. The branch base is older than
  main, so it is cherry-picked, never merged.
- **Gate 1:** `check_startup_contracts` fails on the adapted form.
- **Gate 2:** `check_session_start_budget` reads 81,544 of 80,000 chars
  (+1,544 over).
- The measured text is what was benchmarked. Any change to it in step 1.x
  is a new variant; see the decision rule under Phase 1.

## Phase 1 — clear the two gates

Decision rule for every step here: a fix that leaves the benchmarked
wording of the two contracts byte-identical needs no new measurement. A fix
that changes that wording is a new variant and needs a re-measure under a
fresh pre-registration before it can ship.

- [x] **1.1 Diagnose `check_startup_contracts`.** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> Cherry-pick the two commits
      onto a branch from main, run
      `./scripts-run src/scripts/check_startup_contracts`, and record which
      assertion fails and why.
      verify: the failing assertion and its cause are written under this step.
      Done 2026-11-09: both rules are refused as "not a consequence-class or
      safety-floor rule" — the check has no optional contract, and a clause
      audit is missing next. The wording is not what fails
      (`agents/evidence/analysis/adapted-layer-gate-diagnosis-2026-11-09.md`).
- [x] **1.2 Find the 1,544 chars.** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> Run `check_session_start_budget` on the
      cherry-picked branch and list candidates that cut ≥1,544 chars outside
      the two benchmarked contracts (other start-layer text), or the cost of
      raising the budget.
      verify: a table of candidates with char deltas under this step.
      Done 2026-11-09: main 79,845, adapted 81,544. Candidates (Δ chars): the
      `source_path:` prefix −2,200; pack floors only with their pack −5,479;
      frontmatter block up to −9,624; budget raise to 82,000. Table and notes
      in the same evidence file.
- [x] **1.3 Owner decision on both gates.** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      Present 1.1 and 1.2 as options (fix the check, fix the text, trim
      elsewhere, raise the budget, or do not ship), each marked whether it
      keeps the benchmarked wording.
      verify: the decision is recorded in the result file's owner section.
      Done 2026-11-10: option 1 — (a) extend the check, (c) the `source_path` prefix, (g) confirm first. Recorded in the result file § Owner decision on the two gates.
- [x] **1.4 Pre-model aborts settled before data.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/eval_publication.ts --> Write into
      `docs/contracts/eval-measurement-integrity.md` the convention the owner
      applied post-data on 2026-11-09: a run that ends before any model call
      is an environment failure, rerun up to a pre-registered bound and
      reported, never scored. Executable half beside `ABORT_REASONS`, with a
      test that excludes a pre-model abort and keeps a post-call timeout.
      verify: the contract's "Where each rule is executable" table has the row, and its test passes.
      Done 2026-11-09: contract section plus `countedTrials`; tests seen red first.
      production entry: `internal/bench/core/bench_ab_v2_run.ts` (since 1.6)
- [x] **1.6 Wire the rule into the runner.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: internal/bench/core/_lib/bench_ab_container.ts --> `internal/bench/core/bench_ab_v2_run.ts`
      writes each run's `load_check` (`ok: false` when the stream has no
      `system/init` event); map that to `reachedModel`, rerun a pre-model abort
      up to the bound the pre-registration names, and score through
      `countedTrials`. Must land before 1.5's run.
      verify: a runner test where a stream with no init event is rerun and not scored, and one with a post-call timeout is scored.
      Done 2026-11-09: `--pre-model-reruns N` (default 0), recorded in the report.
      production entry: `internal/bench/core/bench_ab_v2_run.ts`
- [x] **1.5 A fresh confirmation, if the owner takes option (g).** <!-- receipt: class=R0 · active · scope=safe · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> The owner took it (2026-11-10). Pre-registered in `agents/evidence/preregistration/adapted-layer-confirmation-protocol-20261110.md`: seven held-out tasks, a guard task, Haiku 4.5 and Sonnet 5.5, three arms.
      Pre-register, before any transcript, a run on fresh seeds (and unseen
      tasks where the corpus has them) under the 1.4 convention, on Haiku 4.5
      and Sonnet 5.5, with a third arm: the reduced layer padded with neutral
      text to the full layer's length, so content loss and first-turn size are
      separated. Rough cost $20–45 per model.
      verify: the pre-registration is on `main` before the run's report, and the report prints a verdict per model and per arm.
      Done 2026-11-10: NON-INFERIOR on both — Haiku [−0.010, +0.050], Sonnet
      [+0.013, +0.106] (`adapted-layer-confirmation-{haiku,sonnet}-result-20261110.md`).
      Found on the way: a timeout carries no `stream`, so 1.4's rerun never fires
      on it (step 2.3).

## Phase 2 — land it

- [ ] **2.1 Land the candidate.** Cherry-pick plus the fixes chosen in 1.3,
      regenerate projections (`task sync`, `task generate-tools`), both gates
      green, PR merged.
      verify: `./scripts-run src/scripts/check_startup_contracts` -> 0
      verify: `./scripts-run src/scripts/check_session_start_budget` -> 0
- [ ] **2.2 Close the parent blocker.** Update
      `road-to-a-start-as-light-as-the-field` (blocker
      `start-cut-waits-on-full-vs-reduced`) and the 5.2 note in
      `road-to-a-setup-that-decides-itself-carried` with the landing commit.
      verify: both notes cite the merge commit.
- [ ] **2.3 A timeout keeps its stream.** The claude task runner's timeout
      result carries no `stream`, and `reached_model` reads a missing stream as
      reached, so a pre-model timeout is scored instead of rerun (two such trials
      in the Sonnet confirmation). Return the partial stdout as `stream` on a
      stream-mode timeout. Its own PR, after 2.1.
      verify: a runner test where a timeout with no init event and no tokens reads `reached_model` false.
      production entry: `internal/bench/core/bench_ab_task_runner.ts`

## Blockers

### blocker: adapted-layer-gate-decisions

<!-- asked: 2026-11-09 | record: agents/evidence/metrics/ask-scope-vs-full-layer-result-20261109.md -->

- **Status:** resolved — 2026-11-10, the owner chose option 1: (a) extend the check, (c) trim the `source_path` prefix, (g) confirm first (result file § Owner decision on the two gates).
- **Class:** 3 — human-only. A ship decision on a benchmarked default is the owner's; steps 1.1 and 1.2 prepare the options and are agent work.
- **Owner:** the repository owner.
- **Blocks:** 1.3, and through it Phase 2.
- **What to do:** run `./scripts-run src/scripts/check_startup_contracts` and `./scripts-run src/scripts/check_session_start_budget` on a branch carrying `ced3e99b3b` and `51add0fc53`, then choose one of: (a) fix the check, (b) fix the contract text and re-measure, (c) trim 1,544 chars elsewhere, (d) raise the budget, (e) do not ship (the reduced form stays), (f) restore the full layer for the release while the adapted form is pursued, (g) ship only after the 1.5 fresh confirmation. (f) and (g) combine with (a)-(d).
- **Resolved when:** the owner section of the result file names the chosen
  path for both gates.
- **Recommendation:** 1.1 and 1.2 are done (2026-11-09). Gate 1 is the check, not the text: (a) — let a measured non-class rule carry a contract, with its clause audit — keeps the benchmarked wording. Gate 2: the `source_path:` prefix cut (−2,200) clears it without touching rule text. Take (g) as well: the third look rests on a post-data reading, and 1.4 now freezes that rule for the next run.
- **If you do nothing:** the shipped start layer stays the reduced form that
  read INFERIOR in the first look.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-10 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A gate fix that changes the measured text | product | Trimming or rewording the two contracts to pass a gate ships text that was never benchmarked | The decision rule under Phase 1: any wording change is a new variant and is re-measured first | Phase 1 — clear the two gates |
| 2 | A post-data reading taken as a clean pass | product | NON-INFERIOR rests on the owner's exclusion of two pre-model timeouts, not on the frozen text alone | The result file states the reading as post-data; the landing PR cites it; 1.4 freezes the abort rule for every later run; option (g) offers a fresh confirmation | Phase 2 — land it |
| 3 | A form fitted to eight tasks | product | Three looks on the same eight tasks, each built after the previous result was known, can tune the form to that corpus | 1.5 runs on fresh seeds and unseen tasks, with a padded arm that separates content loss from first-turn size, on two models. Done: NON-INFERIOR on both, though only two of seven held-out tasks discriminate per model | Phase 1 — clear the two gates |
| 4 | A pre-model timeout scored as a trial | implementation | The timeout result carries no stream, so the 1.4 rerun never fires on a timeout and a run that never reached the model is scored | 2.3 returns the partial stream on a timeout; the Sonnet result reports both readings, and both are NON-INFERIOR | Phase 2 — land it |

## Acceptance Criteria

- [ ] AC-1: Main carries the adapted contracts with both gates green, or the
      owner's written decision not to ship them.
- [ ] AC-2: Any wording change to the benchmarked contracts is backed by a new
      pre-registered measurement before it lands.
