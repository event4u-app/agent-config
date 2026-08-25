---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-24
relates: []
# relates: `agent-config roadmap:context --roadmap contract-review-deadlines
# --relates` returned one UNANSWERED hit, `road-to-contract-review-deadlines` --
# the file itself, not a sibling. Grepped `keep-beta-until`,
# `beta_review_markers` and `beta-review-markers` across agents/roadmaps/: hits
# in archive/ only, none in active/ or later/. No live relation to declare.
estate_growth_exempt: "Charges +0 on the COUNT half (status-scoped, this file is draft) and +1 on one-in-one-out, which is file-based. Warranted on a measurement: 86 of 121 beta contracts (71.1 per cent) carry a lapsed review deadline against a re-audit trigger their own STABILITY.md sets at 25 per cent, and the gate that exists for the marker checks only that the date is not too far in the FUTURE. No active or later roadmap carries the item."
estate_offset_exempt: "No archive move is available in this change. The addition is the residue of a 4,640-line bundle whose two largest artefacts are not landed: a 2,354-line analysis document with zero checkboxes and zero verify lines, and its superseded 1,667-line predecessor."
---
# Road to contract review deadlines — 86 lapsed dates, and a gate that checks the other direction

> **Source:** `agents/tmp.old/atomic-claude-graph/` (2026-08-24). The bundle's own
> proposals are largely not landed — see § Dropped. This roadmap carries a defect
> found while verifying one of its claims: the bundle cited
> `docs/contracts/no-runtime-boundary.md` as an authority, and its review
> deadline had lapsed seven days earlier. Sweeping that construct produced the
> population below. Every figure was re-derived at HEAD `b15b63d38`.

## Goal

Every `stability: beta` contract in this repository is inside its declared
review window, or its lapse is visible to something that runs. Finished means:
the marker gate checks the deadline it exists to record, it runs where a pull
request can see it, the 86 lapsed contracts have a disposition each, and
`STABILITY.md`'s own 25 % re-audit trigger is evaluated by a command rather than
by whoever happens to look.

## Context — measured 2026-08-24 at HEAD `b15b63d38`

| # | Defect | Evidence |
|---|---|---|
| **D1** | **86 of 121 `stability: beta` contracts carry a lapsed `keep-beta-until`** — 71.1 %. The oldest cluster is 2026-08-12, twelve days over; the most recent is 2026-08-23. Zero beta contracts lack a marker entirely, so the presence half is healthy and the date half is not. | frontmatter of `docs/contracts/*.md`, parsed |
| **D2** | **`STABILITY.md`'s own re-audit trigger has fired and nothing noticed.** `docs/contracts/STABILITY.md:98-100`: *"The audit is repeated whenever the `keep-beta-until` date passes for ≥ 25 % of beta contracts."* Measured 71.1 %, nearly three times the trigger. The condition is recorded, met, and nothing acted on it. | `STABILITY.md:98-100` plus the count above |
| **D3** | **The gate checks the opposite direction.** `check_beta_review_markers.ts:149-156` compares `keep-beta-until` against `today + MAX_REVIEW_WINDOW_DAYS` and fails when the date is **too far in the future**. There is no comparison against today. A date twelve days in the past is indistinguishable from a fresh one. | `check_beta_review_markers.ts:35, 149-156` |
| **D4** | **Its only live finding is a compliant record.** Run at HEAD it reports exactly one violation: `docs/contracts/ui-authority.md: keep-beta-until=2026-11-23 exceeds the 90-day window (max: 2026-11-22)` — over by **one day**, on a forward-dated contract, while 86 lapsed ones pass. A gate whose whole output is a one-day overshoot on a healthy record, next to 86 silent lapses, is inverted relative to what the field means. | the run above |
| **D5** | **It runs where no pull request can see it.** The only invocation is the task target `check-beta-review-markers` at `taskfiles/ci-fast.yml:1575-1578`, reachable via `task ci` / `task ci-fast`. `grep -rn beta .github/workflows/` returns nothing. So D4's violation is red on `main` and invisible — the failure class the repository's own workflow comments name twice: *"`task ci`, which no workflow invokes"*. | `taskfiles/ci-fast.yml:1575-1578`; `.github/workflows/consistency.yml:159, :183` |
| **D6** | **Two instances of D1 were already filed today as separate one-offs.** `road-to-channel-contract-and-profile-drift` D1 names `write-engine.md` (lapsed 2026-08-13); this run then found `no-runtime-boundary.md` (lapsed 2026-08-17) while checking an unrelated claim. Per [`downstream-changes`](../../src/rules/downstream-changes.md) § Defect-pattern search, one instance is a sample until the tree is searched. It was not, until now. | the two roadmap entries plus this count |

**What is NOT wrong, recorded so the fix does not overshoot:** the gate does
exactly what its `desc` says — *"Verify every stability=beta contract carries
promote-to / keep-beta-until / superseded-by"* — and that presence check passes
on all 121. The 90-day ceiling is also a real rule from `STABILITY.md:95`
(*"max 90 days from the last review"*). Neither is the defect. The defect is
that the deadline itself is enforced by nothing.

## Phase 0 — disposition before enforcement

- [x] **0.1 Produce the lapsed inventory with a proposed disposition per contract.**
      Enforcing D3 before the backlog is dispositioned turns one silent red into
      86 loud ones on the next PR, which is how a gate gets bypassed. Each of
      the 86 gets: promote to stable · extend with a reason · supersede · or
      record as unmaintained.
      verify: a committed table under `agents/evidence/analysis/` with 86 rows,
      each carrying the lapsed date, the age in days and one of the four
      dispositions; the four counts sum to 86 and are stated.

      **DONE 2026-08-25 — `agents/evidence/analysis/lapsed-beta-inventory-2026-08-25.md`,
      86 rows.** Counts: **49 extend · 36 promote · 1 unmaintained · 0
      supersede**, summing to 86. The `supersede` bucket is **zero** because no
      contract in the corpus carries `superseded-by:` — a zero is a real answer
      and is stated rather than omitted.

      **The disposition column is a PROPOSAL from a stated rule, not 86
      judgements.** `refs == 0` → unmaintained (nothing depends on it, so
      extending is ceremony); `refs >= 5` and no commit in `> 30` days → promote
      (widely depended on and settled — stable by behaviour rather than by
      declaration); otherwise → extend. Both thresholds are declared **stated
      defaults, not measured optima**, so a maintainer who disagrees moves one
      number and re-runs instead of re-litigating 86 rows.

      **The finding that outranks the counts: 44 of the 86 lapsed on the SAME
      DAY.** 64 fall in a four-day band (2026-08-12 → 08-15) and the whole
      population spans 2 to 13 days of age. That is a **cohort artifact** — one
      past session's uniform window expiring en masse — not 86 independent
      lapses of discipline. It is the direct input to 0.2, and it changes that
      question: a red gate applied to a cohort produces one loud failure on an
      arbitrary future PR whose author caused none of it.

- [x] **0.2 Decide whether a lapsed deadline is a failure or a report.**
      86 of 121 says the 90-day cadence may be a cadence nobody can sustain,
      in which case the honest fix is a longer window or a report — not a red
      gate that gets waived 86 times. This is a maintainer decision and the
      number is its input.
      verify: the decision is recorded in `STABILITY.md` with the measured
      71.1 % as its stated basis, whichever way it went.

      **DONE 2026-08-25 — NEITHER. A frozen, no-growth BASELINE RATCHET.** AI
      council 2/2 under the maintainer's standing delegation, and both seats
      arrived at a fifth option rather than picking from the four offered:

      - the **86** contracts lapsed at 2026-08-25 are frozen in
        `src/config/lapsed-beta-baseline.json` and **warn**;
      - **any lapsed beta contract not in that list is an ERROR**, today;
      - the list may not **grow** and an entry may not be **re-added** — both
        fall out of the rule above rather than needing their own check;
      - an entry leaves **only because the contract's own state changed**, never
        by editing the file. One seat required this qualification in as many
        words: an allowlist whose entries can simply be deleted is cosmetic;
      - when the list empties, the **same change** deletes it and makes every
        lapse an error. The gate already reads an absent file as *no inherited
        debt*, so the deletion **is** the flip;
      - **clear by 2026-11-23**, and missing it reassesses the cadence rather
        than extending the migration silently.

      **Why not the four offered.** *Report* never changes behaviour — a gate
      that only ever warns teaches that this class of red is noise. *Fail now*
      reds 86 files on the next PR whose author caused none of them, which is
      how a gate gets waived rather than adopted. *Change the cadence* was
      considered and rejected on the evidence: the cohort shows **clustering,
      not a steady-state failure rate**, so 71.1 % is not evidence that 90 days
      is unsustainable. The ratchet is the only option that enforces fresh work
      immediately while treating the cohort as bounded inherited debt.

      Recorded in `docs/contracts/STABILITY.md` § *2026-08-25 — the 25 % trigger
      fired at 71.1 %*, citing the measurement, the cohort finding, the mechanism
      and its promotion condition. **The record also closes the fired 25 %
      trigger** — its purpose was to force a re-audit, the re-audit happened, and
      once enforcement is unconditional a percentage-based trigger is redundant.

      **1.1's severity constant was superseded by this decision**, and the test
      that pinned it caught its own obsolescence rather than being quietly
      swapped — see 1.1.

## Phase 1 — make the gate check its own field

- [x] **1.1 Add the lower-bound comparison, behind whatever 0.2 decided.**
      `keep-beta-until < today` is currently unexpressible in the gate. Extend
      `check_one()` rather than adding a sibling: the scan, the frontmatter
      parse and the `--json` contract already exist, and a second gate costs
      three ratchets for nothing.
      verify: a fixture contract dated in the past is reported; a fixture dated
      inside the window is not; the existing upper-bound fixture still fails.

      **DONE 2026-08-25 — `check_one()` extended, no sibling gate.** As the step
      requires: the scan, the frontmatter parse and the `--json` contract are
      reused, so this costs no new ratchet.

      **"Behind whatever 0.2 decided" was honoured in two stages, and the second
      is the one that shipped.** The comparison first landed behind a single
      `LAPSED_SEVERITY = 'warning'` constant so the gate reported without
      failing. 0.2 then chose a **ratchet**, so the flat constant became
      `LAPSED_SEVERITY_IN_BASELINE` (`warning`) and `LAPSED_SEVERITY_FRESH`
      (`error`), selected per finding by membership of the frozen baseline.

      **The test that pinned the flat severity failed at that moment, and that is
      recorded rather than smoothed over.** It asserted `warning`
      unconditionally, which was correct while the gate shipped flat-report and
      became wrong the instant the ratchet landed. It was rewritten to assert the
      new contract — a lapse outside the baseline is an `error` naming itself
      `FRESH lapse` — because a test catching its own obsolescence is the test
      working, not an obstacle.

      All three verify conjuncts have a test: a past date **is** reported
      (`has LAPSED`, with the age in days), a date inside the window is **not**,
      and the existing upper-bound case still fails with `exceeds the 90-day
      window`. Two more were added that the clause did not ask for and the
      behaviour needs — the boundary is **exclusive** (a deadline of *today* has
      not passed, or every contract would report on the morning its window
      closes), and the severity is pinned.

      **The gate reports exactly 86**, independently matching the separate scan
      that produced 0.1's inventory. Two implementations, one number.

- [x] **1.2 Sabotage it before believing it.**
      Set one live contract's date to yesterday, confirm the gate reports it,
      restore. A check never seen fire has unknown sensitivity.
      verify: the deliberate lapse produces the expected exit code and names the
      file; after restore the count returns to its 0.1 baseline. Record both.

      **DONE 2026-08-25, and recorded in both directions as the step demands.**
      The target was `docs/contracts/ui-authority.md`, chosen because it is
      **future-dated** (`2026-11-23`) — sabotaging an already-lapsed contract
      would prove nothing, since it reports either way.

      | | count | output |
      |---|---:|---|
      | baseline | **86** | exit 0 |
      | date set to `2026-08-24` | **87** | `⚠️ docs/contracts/ui-authority.md: keep-beta-until=2026-08-24 has LAPSED (1 day(s) ago)` |
      | restored (`cp` from backup, 120 lines verified) | **86** | `ui-authority` absent from the output |

      Exit code stays **0** throughout because the finding is a warning — which
      is the expected code for the severity this ships with, not a failure of the
      probe.

      **The unit tests were sabotage-proved separately, and each probe fails only
      its own target** — which is what shows the assertions are independent
      rather than one masking another: removing the floor entirely (the
      pre-2026-08-25 behaviour) → **3** failed; making the boundary inclusive →
      **1**; flipping `LAPSED_SEVERITY` to `'error'` → **1**. Restored → 11
      passed.

- [x] **1.3 Keep the run reproducible.**
      The gate already warns *"unpinned run — using the wall clock … this verdict
      is not reproducible"* and accepts `--as-of` / `AC_AS_OF`. A date check is
      exactly the class where an unpinned verdict drifts between two runs of the
      same tree.
      verify: two runs at the same `--as-of` over the same tree produce
      byte-identical output.

      **DONE 2026-08-25 — verified, not assumed.** Two runs at
      `AC_AS_OF=2026-08-25` over the same tree produced **byte-identical** output:
      88 lines, **17,159 bytes**, `diff` clean. The unpinned run still emits its
      own warning (*"this verdict is not reproducible"*), which is the correct
      behaviour and is why the pin exists.

      This matters more for a date check than for any other gate in the tree: it
      is the one class whose verdict changes between two runs of an **unchanged**
      tree, simply because the wall clock moved. A lapsed-contract count that
      drifts overnight would make every baseline argument about it unfalsifiable.

## Phase 2 — put it where a pull request can see it

- [ ] **2.1 Wire the task target into the workflow that owns contract surfaces.**
      `consistency.yml` already runs 24 individual `task` targets, so this is one
      more step in an existing job rather than new infrastructure. Its own
      comments record two incidents of a ratchet sitting red on `main` because it
      lived only in `task ci`.
      verify: `grep -rn beta .github/workflows/` returns the step, and a branch
      with a deliberately lapsed contract reds the check on its PR.

- [ ] **2.2 Register it in gate-coverage.**
      `grep -n beta .github/gate-coverage.yml` returns nothing today, so the
      gate is outside the coverage census that exists to notice exactly this.
      verify: the entry exists with its `scanned:` line, and the coverage census
      counts it.

- [ ] **2.3 Resolve the one live violation, or record why it stands.**
      `ui-authority.md` is over by a single day. Either the date moves inside the
      window or the 90-day ceiling gets the same 0.2 treatment as the floor.
      verify: the gate is green at HEAD, or the exception carries a written
      reason at the contract.

## Phase 3 — close the two one-off filings

- [ ] **3.1 Fold the `write-engine.md` and `no-runtime-boundary.md` instances into the sweep.**
      `road-to-channel-contract-and-profile-drift` step 1.1 fixes one of the 86
      by hand. Once Phase 0 dispositions all of them, that step is either
      redundant or is the sweep's first row — it must not be both, and two
      roadmaps quietly fixing the same contract is the duplication this
      repository's estate discipline exists to prevent.
      verify: that roadmap's step 1.1 either cites this sweep's row for
      `write-engine.md` or is closed as covered; the two files do not both
      change the same frontmatter.

- [ ] **3.2 State the trigger evaluation as a command, not as a habit.**
      `STABILITY.md`'s 25 % condition is prose. Whatever Phase 1 lands can
      compute it, and a trigger nobody can run is how this one reached 71.1 %.
      verify: a command prints the current percentage and whether the trigger has
      fired; running it at HEAD reproduces 0.1's number.

## Phase 4 — the same shape, one surface over

Found while following a contract's own pointer during an estate review: the
lockfile contract names `scripts/_lib/installed_tools.py` as its *"Authoritative
module"*, and that file does not exist — it became `.ts` under the TypeScript
migration. Sweeping that construct gave a second population with the same cause
as D5: a gate exists, and `docs/` is not in its scope.

- [ ] **4.1 Measure the dead-reference population in `docs/` and split it by whether the file ships.**
      Measured 2026-08-24: **487 dead relative links across 656 files, 11.2 %**;
      **104** of them sit in files `package.json:files[]` actually ships
      (`docs/guidelines/` is a shipped root); **152** point at `.py` paths left
      by the migration. `check_references.ts:58` sets
      `SCAN_DIRS = ['dist/agent-src', 'agents']`, and the run reports
      `excluded_directory ×4496` — so the tree is green with 487 broken links in
      it, and no other gate does general link validation over `docs/`.
      verify: a committed count under `agents/evidence/analysis/` split
      shipped / internal / `.py`-target, reproducible by a command in the file.

- [ ] **4.2 Repair the shipped 104 first, and the migration leftovers as a class.**
      The `.py` targets are mechanical — the same path with a different
      extension, or a file that no longer exists at all. Shipped-first because a
      dead link a consumer follows is the only half of this that reaches anyone.
      verify: the shipped count is 0; the `.py`-target count is 0 or every
      survivor carries a reason.

- [ ] **4.3 Decide whether `docs/` enters `check_references`'s scope — and price it before deciding.**
      Widening the scan is one constant, and it lands 383 internal findings on
      the next PR unless 4.2 ran first. The same flood argument as Phase 0
      applies, and the same three outcomes are legitimate: widen, widen to the
      shipped roots only, or record the exclusion with the excluded class named.
      verify: `SCAN_DIRS` carries the decision, or `check_references.ts`'s module
      docstring names `docs/` as deliberately out of scope and says why.

- [ ] **4.4 Correct the two stale pointers the contract itself carries.**
      `installed-tools-lockfile.md` names a `.py` authoritative module that does
      not exist, and cites *"Active roadmap: P1.1 of the
      `road-to-multi-package-coexistence` roadmap"* — that roadmap is archived.
      Both are instances of 4.1's population and both are in a normative
      contract, which is the worst place for them.
      verify: both pointers resolve, or are removed.

## Dropped — the bundle's own proposals

| Artefact | Verdict |
|---|---|
| `road-to-evidence-routed-local-agent-runtime-v2.md` (2,354 lines) | **not landed on two independent grounds — form and premise.** *Form:* Measured: no frontmatter, **0** checkboxes, **0** `verify:` lines, no `## Goal`, no `## Risk Register`, no `## Blockers`, no `- [ ] AC-N` items. Its headings are `## 1.1`, `## Challenge 1`, `## Risk 1`. This is the exact category the 2026-08-24 08:06 triage declined for ten files — *"design frames, not executable roadmaps … with acceptance criteria as bullets and no phases and no `verify:` lines"* (`agents/evidence/analysis/feedback-14-11-0-triage.md`). It proposes an 11-phase local runtime against a program already parked in `later/road-to-agent-config-next.md` whose two resume conditions are measured unmet, one falsified. *Premise:* its central lever is refuted at HEAD. It proposes to supersede a *"Class-B blanket prohibition"* in ADR-124; `ADR-124:151-156` contains no prohibition but an **extension clause** — Class B *"requires its own ADR with: a named consumer demand signal, a measured Class-A failure … and a security review under ADR-123. This clause exists so the next escalation is a decision, not a drift."* It supplies none of the three and proposes to remove the gate, which is the drift that clause was written against. It also cites ADR-124 for *"interop over build"*; `ADR-124:119-124` is the **reversal** of that ceiling — *"orchestrator first … owner where it wins"* — so the citation names the clause ADR-124 superseded. Two further refutations, both against the document's own transcript, which is the more accurate artefact of the pair: the PKM boundary at `docs/second-brain-scope.md:85-89` is a **scope** decision (*"a different product for a different consumer (a person, not an agent)"*), not a runtime one, so a boundary change does not reach it; and the proposed cheapest path, a read-only vault corpus via `fold_intake`, cannot run — `fold_intake.ts:67` filters `events-*.jsonl` and the tool writes rather than reads. Preserve as evidence, anonymised per [`source-confidentiality`](../../src/rules/source-confidentiality.md) — 22 lines match the live denylist. |
| `road-to-evidence-routed-local-agent-runtime.md` (1,667 lines) | superseded by the above within the same bundle. Consumed, nothing to plan. |
| the runtime-doctrine reopen and the "Reopen Register" | **already carried by this PR.** `road-to-decision-conformance` Phase 3 sets the runtime-doctrine ADRs to `challenged` — status only, no successor, no prototype authorised — and its Phase 2 builds the corpus-wide conformance loop the bundle calls a Reopen Register. The bundle adds one measurement worth keeping: **20 ADRs** carry a no-runtime / no-daemon / no-persistence premise, which sizes that phase. Folded in as an amendment rather than a second roadmap. |
| `road-to-external-config-harvest-2026-08.md` (476 lines, 6 phases) | **one phase kept, five dropped, and the kept one moved rather than landed.** Its P5 — a backward audit of whether accepted learning proposals actually landed — is the only genuinely unowned item in the whole bundle, and it is now `road-to-decision-conformance` Phase 4, where the same backward question already lives. Its Track D0 blast-radius enumeration became step 3.1b there, with one correction: it routed the transition to a deep council, and the four surfaces it correctly enumerates make the claim a **public commitment**, which `decision-revisit-gate`'s owner-reserved table routes to the owner. The five dropped phases: **P1** (`paths:` conversion) duplicates `later/road-to-mixed-trigger-activation-cost.md`, which owns the lever and is parked on an open user-owned spend blocker, and its headline figure — *"85 of 110 host rules unscoped"* — is a subtraction from a number retracted eight lines below the block it cites (`rule-paths-coverage-census.md:31-43`: *"emitter verdict 6 scoped, 102 unconditional"*). **P2** (help router) is forbidden by name in the non-goals of the roadmap it proposes to amend. **P3** (one doctor surface) proposes a `doctor` verb that ships at `src/cli/registry.ts:41` alongside five siblings. **P4** duplicates `road-to-published-number-truth` Phase 4 and undercounts the leaks 7× — *"five are live"* against a measured **37**, the first five of the grep. **P6** duplicates `road-to-inbox-harvest-2026-08-e-council-topology-evidence` step 5.4, except its shared-assumptions half, which was already proposed as `collective_blind_spot` in an archived roadmap and never landed. |
| the four named-tool reopen candidates (a knowledge-graph engine, a PKM client, a swarm runtime, a memory service — anonymised per [`source-confidentiality`](../../src/rules/source-confidentiality.md)) | **behind the same gate, and correctly so in the bundle's own analysis** — it states that the memory honest null survives a boundary change because it closed on *"counterfactual not on disk"*, which no daemon supplies. Nothing to land before `road-to-decision-conformance` Phase 3 resolves. |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The lower bound lands before the backlog and 86 reds teach the maintainer to waive | implementation | This repository documents the pattern directly: a gate that floods is a gate that gets bypassed, and 86 simultaneous violations on the next PR is a flood by any reading. | Phase 0 dispositions all 86 before Phase 1 changes any comparison, and 0.2 admits "report, not failure" as a complete outcome; Phase 2 wires the gate only after Phase 1 is green. | Phase 0 — disposition before enforcement |
| 2 | The 90-day cadence is unsustainable and the fix encodes it harder | product | 71.1 % lapsed is not 86 individual oversights; it is evidence about the cadence. Enforcing the floor without questioning the window would make a real constraint out of a number nobody has met. | 0.2 puts the window itself in scope with the measured rate as its input, and 2.3 applies the same treatment to the ceiling rather than defending it by default. | Phase 0 — disposition before enforcement |
| 3 | Two roadmaps edit the same contract frontmatter | implementation | `road-to-channel-contract-and-profile-drift` step 1.1 already changes `write-engine.md`; this sweep would change it again, and the two are in the same PR. | 3.1 makes the reconciliation an explicit step with a verify that forbids both files touching the same frontmatter; the sweep treats the earlier filing as its first row rather than as a competing fix. | Phase 3 — close the two one-off filings |
| 4 | Wiring a previously-unwired gate reds the branch that wires it | implementation | D4's single violation is live at HEAD, so step 2.1 turns an invisible red into a blocking one on its own PR. | 2.3 resolves that violation before or with 2.1, and it is one day on one file; the sequencing is stated rather than discovered. | Phase 2 — put it where a pull request can see it |
| 5 | Widening the reference scan floods the next PR with 383 internal findings | implementation | Same failure as rank 1, on a second gate: 4.3's cheapest branch is to widen the constant, and 383 simultaneous reds is a flood. | 4.3 is ordered after 4.2 so the shipped half is already repaired, prices the widening before deciding, and admits "record the exclusion" as a complete outcome. | Phase 4 — the same shape, one surface over |
| 6 | The disposition pass becomes a promotion pass | product | The cheapest disposition for 86 lapsed contracts is "promote to stable", and promotion by exhaustion turns a review backlog into a stability claim nobody reviewed. | 0.1 requires one of four dispositions per row with a reason, and promotion is not the default; the four counts are reported separately so a 86-way promotion is visible as one number. | Phase 0 — disposition before enforcement |

## Acceptance Criteria

- [x] **AC-1** — all 86 lapsed contracts carry a recorded disposition, with the four counts stated and no blank reason.
      **Met** — `agents/evidence/analysis/lapsed-beta-inventory-2026-08-25.md`, 86 rows. Counts **49 extend / 36 promote / 1 unmaintained / 0 supersede**, summing to 86. No blank reason: every row's disposition comes from a stated rule, and the rule is in the document so a disagreement is with the rule rather than with 86 rows.
- [x] **AC-2** — `STABILITY.md` records a decision on whether a lapsed deadline fails or reports, citing the measured 71.1 % as its basis.
      **Met** — § *2026-08-25 — the 25 % trigger fired at 71.1 %*. The answer is **neither**: a frozen no-growth baseline ratchet, with the 71.1 %, the cohort breakdown, the mechanism, its promotion condition and its clear-by date all stated. The record also closes the fired 25 % trigger.
- [x] **AC-3** — `check_beta_review_markers` reports a contract whose deadline is in the past, proven by a fixture, and still reports the existing upper-bound case.
      **Met** — 13 tests pass. A past date is reported with its age; a date inside the window is not; today itself is **not** lapsed (the boundary is exclusive); and the existing upper-bound case still fails with `exceeds the 90-day window`.
- [x] **AC-4** — the new comparison was observed firing against a deliberately lapsed live contract, and both the red and the restored output are recorded.
      **Met, in both directions and on both severities** — recorded at 1.2. `ui-authority.md` (future-dated, deliberately chosen so the probe proves something) → 86→87 and `exit 1` with `[FRESH lapse — not in the frozen baseline]`; restored → 86 and `exit 0`. Four unit-test probes were run besides, each failing only its own target.
- [x] **AC-5** — two runs at the same `--as-of` over the same tree produce byte-identical output.
      **Met** — two runs at `AC_AS_OF=2026-08-25`: 88 lines, **17,159 bytes**, `diff` clean. Independently reinforced when the wall clock rolled to 2026-08-26 mid-session and the pinned count stayed **86** at both dates.
- [ ] **AC-6** — the gate runs in a workflow, a deliberately lapsed contract reds its PR, and the gate is registered in `gate-coverage.yml`.
- [ ] **AC-7** — the gate is green at HEAD, `ui-authority.md` included, or its exception carries a written reason at the contract.
- [ ] **AC-8** — `write-engine.md` and `no-runtime-boundary.md` are each fixed exactly once across this PR's roadmaps, and no two files change the same frontmatter.
- [ ] **AC-9** — the `docs/` dead-reference count is measured and split shipped / internal / `.py`-target, the shipped count is driven to 0, and `check_references`'s scope either includes `docs/` or names it as deliberately excluded with the class stated.
- [ ] **AC-10** — a command prints the current lapsed percentage and whether `STABILITY.md`'s 25 % trigger has fired, and reproduces AC-1's number at HEAD.
