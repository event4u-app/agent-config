---
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to estate drawdown — an agent-run campaign that ends with fewer roadmaps, enforced

> **Source:** `agents/tmp.old/mixed-trigger-cleanup/road-to-estate-drawdown.md`
> — external analysis session, 2026-08-17, drafted against `de76c38b932d1612d36cfc85d6b9fbaff4832350`.
> Adopted 2026-08-17 via `/analyze:inbox` after per-claim verification against
> `origin/main` @ `097ab6549`.

> **Sibling.** `road-to-gate-autonomy` provides the mechanics — the classes,
> `gates --execute`, the budget ledger, the delegate path. **This roadmap is the
> campaign that uses them, and the ratchet that makes the outcome stick.** It is
> deliberately a steering roadmap: its deliverable is the state of the estate, not
> a feature.

---

## 0. The defect, stated first

**The estate carries 37 active roadmaps, 44 in `later/`, and 38 open blockers — and
the count does not go down by itself.**

The failure mode is not laziness, it is structure. Blockers wait for humans to
courier commands. Fired resume-triggers go unseen. Decision-ready gates sit inside
files nobody re-reads — the autonomy-defaults gate carries its full recommendation
*in the tooling output* and still blocks a large step count. And new roadmaps
arrive faster than old ones terminate.

The requirement is explicit and becomes this roadmap's only success criterion:
**that the drawdown actually succeeds, rather than the estate continuing to carry
thirty-plus open roadmaps.**

**This roadmap's own adoption is an instance of the defect, and is recorded as
such.** The `/analyze:inbox` run that created this file added **seven** roadmaps to
the active tree in one sitting — from 37 to 44. Every one of them owns verified,
non-duplicated scope, so none is waste; and adding seven at once is exactly the
arrival rate T3 below exists to bound. The honest reading is that the campaign
starts from a *worse* count than the one it was drafted against, and that the seven
are the first cohort its triage sweep must dispose of rather than a set exempt from
it.

## 1. Verified provenance

Verified 2026-08-17 against `origin/main` @ `097ab6549`.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Active and `later/` roadmap counts | **overtaken, direction unchanged** | 37 active and 44 in `later/` at `origin/main`, against the draft's 42 and 44 — archival ran between the pin and adoption. The count then rose to 44 active with this cohort, so the drafted premise understates rather than overstates the problem |
| 2 | 38 open blockers, 13 user-owned; the top items carry large unblock counts | **still-true, exact** | `./agent-config gates --all` prints "13 decisions need you · 25 more with maintainer/external" |
| 3 | Decision-ready gates exist with recommendations already rendered | **still-true** | the gate output's own recommendation blocks |
| 4 | A fired-but-unresumed trigger class exists | **still-true** | `later/road-to-request-scoped-rule-load.md`'s park note against the archived rule-delivery-integrity P2.1 done-note |
| 5 | The estate already has a one-command decision inventory | **still-true** | `roadmap_gates.ts` with its needs-you split |
| 6 | House archive discipline exists — close-with-evidence, migration notes, reject lists | **still-true** | the archival precedents and the roadmap-writing skill's own contract |
| 7 | Batch-disposition precedent exists | **still-true** | the inbox-harvest triage records and their not-adopted register |

## 2. The target, registered before the work

Proposed for maintainer pre-registration. **The numbers are proposals; the *shape*
is the requirement.**

- **T1** — active roadmaps and open blockers each below a registered ceiling within
  a registered window from campaign start. The draft proposed fifteen active and
  twelve blockers over roughly six weeks; both numbers and the window belong to the
  maintainer, and no date is pinned in this file.
- **T2, anti-regrowth** — a CI ratchet on the dashboard counts, the same mechanism
  `preamble-payload-budget` uses: the committed baseline walks **down only**, and
  raising it requires a PR citing evidence in a real sentence rather than a number
  change.
- **T3, one-in-one-out** — while the active count sits above target, a PR adding a
  new active roadmap archives, merges or parks one in the same PR, or carries an
  explicit maintainer exemption tag. **A lint, not an honour system** — and note
  that this cohort of seven would have needed seven offsets or an exemption, which
  is the rule working rather than an argument against it.
- **Quality anchor, so drawdown is not burial** — every closure carries the house
  form: evidence-cited done-notes, a migration note for anything shipped-adjacent, a
  reject or not-adopted register for anything cut, and open steps either executed,
  migrated to a named owner, or parked with a **probe-able** resume condition.
  "Archived to make the number" is detectable: an archive commit missing one of
  these forms fails the lint.

## Phases

### Phase 0 — One sitting, thirteen answers

The human's entire contribution, front-loaded. **This phase needs nothing from the
sibling roadmap — it is runnable with today's tooling.**

- [x] **0.1** Generate ONE consolidated decision sheet from the gate output,
      `owner: user` only — thirteen items: per item the one-line question, the
      rendered recommendation, a default, and what it unblocks, sorted by unblock
      count descending. Items whose entry records no recommendation get one
      **drafted by the agent from the roadmap's own text and marked as
      agent-drafted**, so the provenance of each default is visible.
      `verify:` the sheet contains all thirteen, each with a question, a default and
      its recommendation source labelled.
      - **Done 2026-08-18.** `agent-config gates --sheet` is the generator;
        `agents/decisions/consolidated-decision-sheet.md` is the artefact.
        **The step says thirteen and the estate says 21** — the count grew between
        drafting and execution, which is the arrival rate T3 exists to bound
        rather than a mis-drafted step. The sheet is generated, so the number is
        whatever `Owner: user` currently reports.
      - **The agent-drafted defaults were written into the ROADMAPS, not into the
        sheet**, and that is a deliberate departure from the literal reading. 7 of
        the 21 entries recorded no `Recommendation:`; drafting into the sheet would
        have made it a hand-edited generated file, so the next regeneration would
        silently drop the drafts. Six were written into their own blocker's
        `Recommendation:` field marked `(agent-drafted …)`, and the sheet READS that
        marker — so provenance is visible per row, the sheet stays fully derived,
        and `gates` / `--reply` gained the same recommendations.
      - **The seventh has no field to carry one and the sheet says so.**
        `road-to-gated-reach-followup` states its gate as a legacy
        `> Blocked until …` note rather than a `### blocker:` entry, so it has no
        `Recommendation:` slot. That row is labelled `none — legacy note` and names
        the conversion as what would give it a default; converting another
        roadmap's structure was left out of this change.
      - **By-product:** the drain took `lint_roadmap_blockers:decidability` from a
        **pre-existing red** (28 against a baseline of 26 on `origin/main`) to 22,
        and the baseline was lowered to match. Second recorded instance of that
        ratchet being red on main undetected — it runs in `task ci`, which no
        workflow invokes.
      - `verify:` `./scripts-run src/agent-src/scripts/roadmap_gates --sheet`
        (21 rows, each with a question, a default or a stated reason it has none,
        and a labelled source); 12 renderer cases in
        `tests/scripts/roadmap_gates.test.ts`.
- [~] **0.2** The maintainer answers the sheet once. **Accept-all-defaults is a
      valid answer.** The answers are then appended into each roadmap file at its
      blocker as the decision record — by the agent, not by the human. Blocked on
      `b-consolidated-decision-sheet`.
- **AC-0:** a short, bounded amount of maintainer time consumed; most of the thirteen
  user-owned blockers terminal; and the two largest-unblock items dispositioned.

### Phase 1 — Execute everything runnable

- [ ] **1.1** Once the sibling's classification sweep lands, `gates --execute`
      clears every class-0 blocker: time-window checks, telemetry-count gates, and
      stale-artifact deletions. Where a window is genuinely unfilled, **the blocker
      is re-dated, which is also progress** — an honest "not yet, and here is the
      count" beats an open gate nobody probed.
      `verify:` each cleared blocker carries its evidence append; each re-dated one
      carries the probed count.
- [~] **1.2** Class-1 tranche under the budget ledger, highest-unblock first: the
      live trigger eval — one run, two blockers, three waiting roadmaps — then the
      bench-spend items up to the weekly cap. Blocked on
      `b-consolidated-decision-sheet` and on the sibling's budget-preauth blocker.
- **AC-1:** open blockers materially below the starting 38; every resolution carries
  its evidence append; the ledger shows spend inside its caps.

### Phase 2 — Triage sweep over the whole estate, in batches, with terminal verdicts

- [ ] **2.1** Batches of at most ten roadmaps, one PR each, one verdict per file
      from a **closed vocabulary**: **EXECUTE** (remaining steps are agent-workable
      now — schedule into the recurring pass) · **FINISH-THIN** (nearly done; close
      the tail and ship the closure) · **MERGE-INTO-OWNER** (scope owned elsewhere;
      migrate open steps verbatim, marked moved-not-cancelled) · **DECISION-SHEET**
      (needs one class-2 answer; feeds the next Phase-0-style sitting) ·
      **PARK-PROBEABLE** (legitimately waiting; the resume condition is rewritten to
      be machine-probeable) · **ARCHIVE** (dead or superseded; migration note plus
      not-adopted register).
      `verify:` each batch PR carries one verdict row per file, and no file leaves a
      batch without one.
- [ ] **2.2** Sequencing: the active tree first, `later/` second, oldest-untouched
      first within each. **The seven roadmaps this cohort added are in the first
      batch, not exempt from it.** The council may decide MERGE-versus-ARCHIVE calls
      inside its configured reversible class; EXECUTE-versus-ARCHIVE on anything with
      shipped surface stays a maintainer call on the sheet.
      `verify:` the batch order is recorded, and every council-decided verdict names
      the class it was decided under.
- **AC-2:** every file in the estate carries a terminal verdict row; the active count
  reaches T1's registered ceiling; **no closure lands without its house-form
  artifacts.**

### Phase 3 — The ratchet lands

- [x] **3.1** An estate-count gate: read the dashboard, compare against the
      committed baseline, red on growth, with the raise-reason discipline for any
      increase. Plus the one-in-one-out lint per T3.
      `verify:` the gate is green at the registered ceiling, and a fixture PR that
      adds an active roadmap without an offset **fails**.
      - **Done 2026-08-18.** `src/scripts/check_estate_count.ts` +
        `src/config/estate-count-budget.json`. Both halves under one gate id, so
        the registration surface is one row rather than two.
      - **"Read the dashboard" is implemented as reading the dashboard's own
        parser**, not as scraping its markdown: `collect()` from
        `update_roadmap_progress`, imported. Verified that `collect().length` is 38
        and its summed open blockers are 49 — exactly the two numbers the dashboard
        header prints, so the gate cannot disagree with the page it is named after.
        `later/` is counted from the filesystem because parked roadmaps are outside
        that corpus by design.
      - **No ceiling was invented.** T1's proposed 15 / 12 are recorded in the
        budget under `target` and read by nothing, because this roadmap says both
        the numbers and the window belong to the maintainer. T3's "while the active
        count sits above target" therefore has no registered threshold, and
        `one_in_one_out.applies_above_active: null` states that and applies the
        lint. The baseline is the **measured** estate (38/44/49), not a target — a
        hard 15-roadmap gate would be red the day it lands.
      - `verify:` `./scripts-run src/scripts/check_estate_count` green at the
        baseline; `--self-test` 5/5 (3 rejecting); 16 vitest cases over throwaway
        git repos covering growth, the addition-without-offset fixture, the
        paid-for-by-archive fixture, un-parking, the exemption tag, the registered
        ceiling in both directions, and a dead scan root exiting 2 rather than 1;
        `check_gate_coverage --canary` reports "caught the planted
        contract-violation defect (exit 1)", so the gate is verified-not-blind.
- **AC-3:** both gates exist and are red/green against fixtures in both directions.
  **Met 2026-08-18** — the two directions are the `--self-test` accept/reject pairs
  and the vitest fixtures above; the canary proves it against the shipped CLI.

### Phase 4 — The recurring agent pass, so this never regrows

- [~] **4.1** A scheduled agent run over the delegate path executes, in order: the
      fired-trigger probe from the sibling's Phase 4, then `gates --execute` over
      classes 0 and 1, then a draft of the next decision-sheet delta if class-2 items
      accumulated, then a one-paragraph estate report — counts, deltas, spend — the
      maintainer can read in under a minute. The pass is capped by the per-day call
      cap and the budget ledger, and **never touches class 3.** Blocked on the
      sibling's delegate-gate blocker.
- **AC-4:** several consecutive reports exist; the open-blocker count is flat or
  falling across them; maintainer reading time per period is the one report.

## Blockers

### blocker: b-consolidated-decision-sheet
- **Status:** open
- **Owner:** user
- **Class:** 2 — consent-once
- **Blocks:** Phase 0 step 0.2, and through it the class-1 tranche in 1.2. Step 0.1
  generates the sheet without it, and Phase 2's triage sweep proceeds independently.
- **What to do:** answer the consolidated decision sheet that step 0.1 produces —
  thirteen user-owned blockers, sorted by unblock count, each with a one-line
  question, a rendered or agent-drafted recommendation, and a default. Options:
  (a) accept all defaults, which is an explicitly valid answer and the fastest path;
  (b) answer item by item, overriding where the default is wrong; (c) answer only
  the two largest-unblock items and defer the rest to a later sitting, which still
  discharges most of the blocked step count. Whichever path, the agent writes the
  answers back into each roadmap at its blocker — that is not maintainer work.
- **Recommendation:** **option (c) — answer the two largest-unblock items, defer the
  rest.** It discharges most of the blocked step count for a fraction of the reading,
  which is the whole point of sorting the sheet by unblock count. Option (a) is
  faster still but accept-all-defaults over thirteen items includes the
  agent-drafted defaults, and those are the ones risk 2 flags as least examined.
  Option (b) is the most careful and the most likely not to happen — this blocker
  exists because thirteen reading assignments already did not happen once.
- **If you do nothing:** thirteen user-owned blockers stay open, the two largest
  unblocks keep holding their step counts, and the campaign starts from a count that
  rose rather than fell — 44 active after this cohort. Phase 2's triage sweep still
  runs, so verdicts land, but every DECISION-SHEET verdict routes back to this same
  unanswered sheet.
- **Resolved when:** each of the thirteen carries either an answer or an explicit
  deferral recorded at its own blocker, and the sheet records which option was used.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-17 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Drawdown by burial — real work archived to hit the target | product | A count target creates direct pressure to close files rather than finish work, and an archived roadmap with live open scope is a silent loss of governed intent | The § 2 quality anchor is a **lint, not a norm**: every ARCHIVE needs a migration note and a register entry, and one batch per campaign is spot-audited against the anchor | Phase 2 — Triage sweep |
| 2 | The decision sheet front-loads bad defaults | product | Accept-all-defaults is offered as the fastest path, so a wrong agent-drafted default becomes a decision nobody examined | Every default names its source — rendered recommendation versus agent-drafted — the agent-drafted ones are the first spot-audit targets, and every class-2 call is reversible by definition | Phase 0 — One sitting, thirteen answers |
| 3 | Council overreach on dispositions | product | Letting the council decide MERGE-versus-ARCHIVE moves governance decisions off the maintainer for a class that can contain shipped surface | The council decides only inside its configured reversible class; anything with shipped surface or user-visible behaviour goes on the sheet, and each council verdict names its class | Phase 2 |
| 4 | The recurring pass drifts into feature work | implementation | A scheduled agent run with repo write access will find things to fix, and a janitor that opens feature PRs is no longer a janitor | Its command list is **closed** — probe, execute, draft the sheet delta, report — and a pass that opens a PR beyond blocker-evidence appends violates its own contract, which the orchestration ledger records | Phase 4 — The recurring agent pass |
| 5 | The target number was wrong | product | A ceiling chosen before the triage distribution is known could be unreachable, and an unreachable gate teaches readers to ignore it | The **ratchet direction is the commitment, not the number**: a maintainer PR can re-register the target with a reason, and only silent drift is forbidden | 2. The target |
| 6 | This cohort's own arrival is treated as exempt | product | Seven roadmaps landed in one sitting under the campaign that is supposed to bound arrivals; exempting them would make T3 advisory from day one | § 0 records the cohort as an instance of the defect, and step 2.2 puts the seven in the **first** triage batch rather than outside the sweep | Phase 2 |
| 7 | The estate is under-resourced rather than over-grown | product | If the verdicts come back overwhelmingly EXECUTE-with-real-work, the count is a symptom and cutting it would destroy real plans | The honest-null consequence below publishes the per-verdict distribution and re-registers the target against the measured throughput of the recurring pass, rather than loosening the quality anchor to make the number | Honest-null consequence |

## CUT list — do not re-litigate

- **Auto-merging closure PRs.** Merge stays human — Hard Floor and the inherited
  anti-goals; auto-merge is permanently excluded. Cut.
- **Deleting `later/` wholesale.** Parked-whole is the house discipline;
  PARK-PROBEABLE replaces silent deletion. Cut.
- **A standing roadmap-janitor daemon.** The recurring pass is a one-shot scheduled
  run; residency stays rejected, the same verdict that killed the dispatcher daemon.
  Cut.
- **Counting `archive/` growth as failure.** Archives are the intended terminal
  state; only the active count and open blockers are ratcheted. Cut.

## Honest-null consequence

If after Phase 2 the estate resists — the active count stuck well above target
because the verdicts came back overwhelmingly EXECUTE-with-real-work — then the
finding is that the estate is **under-resourced, not over-grown**. The campaign
publishes the per-verdict distribution, the target is re-registered against the
measured throughput of the recurring pass, and the drawdown claim is downgraded in
public rather than the quality anchor being loosened to make the number.
