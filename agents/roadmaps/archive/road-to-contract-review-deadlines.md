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

- [x] **2.1 Wire the task target into the workflow that owns contract surfaces.**
      `consistency.yml` already runs 24 individual `task` targets, so this is one
      more step in an existing job rather than new infrastructure. Its own
      comments record two incidents of a ratchet sitting red on `main` because it
      lived only in `task ci`.
      verify: `grep -rn beta .github/workflows/` returns the step, and a branch
      with a deliberately lapsed contract reds the check on its PR.

      **DONE 2026-08-26 — `.github/workflows/consistency.yml`.** `grep -rn beta
      .github/workflows/` now returns the step; before this change it returned
      nothing, which is D5 exactly.

      **The lapsed-contract half is demonstrated, not asserted.** A contract
      planted at `docs/contracts/zz-canary-beta-lapse.md` with
      `keep-beta-until: 2026-01-01` makes the gate exit **1** and report it as a
      `[FRESH lapse — not in the frozen baseline, which may not grow]`, while the
      85 inherited ones stay warnings and the gate stays green without it. That
      is the Phase-0 ratchet working end to end: inherited debt warns, new debt
      fails, and a pull request now sees the difference.

- [x] **2.2 Register it in gate-coverage.**
      `grep -n beta .github/gate-coverage.yml` returns nothing today, so the
      gate is outside the coverage census that exists to notice exactly this.
      verify: the entry exists with its `scanned:` line, and the coverage census
      counts it.

      **DONE 2026-08-26 — `src/config/gate-coverage.yml`.** `min_scanned: 100`
      against a live corpus of 121 beta contracts; the floor sits below it
      deliberately, because the beta population **shrinks** as contracts promote
      to stable, so a slow decline is expected and a drop under 100 is a
      scan-root collapse rather than a promotion wave.

      The row carries a canary, and it fires: `check_gate_coverage --canary`
      reports `✅ check_beta_review_markers: caught the planted
      contract-violation defect (exit 1)`. Coverage proves a gate READ
      something; only the canary proves it can still FAIL.

      Denominators in the manifest header were **recomputed, not incremented** —
      292 gate scripts, 61 rows, both re-run on this tree.

- [x] **2.3 Resolve the one live violation, or record why it stands.**
      `ui-authority.md` is over by a single day. Either the date moves inside the
      window or the 90-day ceiling gets the same 0.2 treatment as the floor.
      verify: the gate is green at HEAD, or the exception carries a written
      reason at the contract.

      **DONE 2026-08-26 — the gate is green at HEAD, and the honest reason is
      that the violation CLEARED ITSELF. No file was edited to achieve it.**

      `ui-authority.md` still carries `keep-beta-until: 2026-11-23`, unchanged.
      What moved is today: the ceiling is computed as `today + 90`
      (`check_beta_review_markers.ts:248`), so the maximum was 2026-11-22 when
      the roadmap measured on 08-24 and is 2026-11-24 now. The same date is
      outside the window on one day and inside it two days later.

      **That is a defect in the ceiling's ANCHOR, and recording it is the point
      of writing this down rather than ticking the box.** `STABILITY.md:95` says
      *"max 90 days from the last review"* — from the LAST REVIEW, not from
      today. No contract carries a `last-reviewed:` field, so the check
      substitutes today, and against that anchor a forward date can only drift
      INTO range as time passes. The upper bound is therefore unenforceable by
      construction, while the lower bound (the lapse check Phase 1 added) is
      real.

      Not fixed here: a real ceiling needs a `last-reviewed:` field on 121
      contracts, which is a schema change to `STABILITY.md` and a migration, not
      a step in this roadmap. What this step buys is that the number is no longer
      mistaken for enforcement.

## Phase 3 — close the two one-off filings

- [x] **3.1 Fold the `write-engine.md` and `no-runtime-boundary.md` instances into the sweep.**
      `road-to-channel-contract-and-profile-drift` step 1.1 fixes one of the 86
      by hand. Once Phase 0 dispositions all of them, that step is either
      redundant or is the sweep's first row — it must not be both, and two
      roadmaps quietly fixing the same contract is the duplication this
      repository's estate discipline exists to prevent.
      verify: that roadmap's step 1.1 either cites this sweep's row for
      `write-engine.md` or is closed as covered; the two files do not both
      change the same frontmatter.

      **DONE 2026-08-26 — the other roadmap's fix is treated as the sweep's first
      row, and the ratchet was tightened to record it.**

      Verified live rather than from the roadmap text:
      `road-to-channel-contract-and-profile-drift` is **archived**, and
      `docs/contracts/write-engine.md` now carries `keep-beta-until: 2026-09-24`
      — its 1.1 shipped. This branch touches that file **zero** times, so the
      two-roadmaps-one-file collision the risk register names did not occur.

      **What that left, and what was done about it.** The frozen baseline still
      listed `write-engine.md` among the 86, so it was carrying an entry for a
      contract that is no longer lapsed. Measured: baseline 86, currently lapsed
      85, difference exactly that one file. Per Phase 0's own rule — *"an entry
      leaves only because the contract's own state changed, never by editing the
      file"* — its state changed, so the entry left: **86 → 85** in
      `src/config/lapsed-beta-baseline.json`, with the `count` field moved to
      match. That is the ratchet shrinking for the one reason it is allowed to.

      `no-runtime-boundary.md` remains lapsed and remains **inside** the frozen
      baseline, which is its disposition: Phase 0 dispositioned all 86 as a
      cohort, so hand-fixing it here would be the second roadmap editing the same
      frontmatter that this step exists to prevent.

- [x] **3.2 State the trigger evaluation as a command, not as a habit.**
      `STABILITY.md`'s 25 % condition is prose. Whatever Phase 1 lands can
      compute it, and a trigger nobody can run is how this one reached 71.1 %.
      verify: a command prints the current percentage and whether the trigger has
      fired; running it at HEAD reproduces 0.1's number.

      **DONE 2026-08-26 — `check_beta_review_markers --trigger`.**

      ```
      $ ./scripts-run src/scripts/check_beta_review_markers --trigger
      beta contracts: 121 · lapsed: 85 · 70.2 % · STABILITY.md re-audit trigger (>= 25 %): FIRED
      ```

      `--json` emits the same verdict as a record. The threshold lives in one
      exported constant next to the data it measures, so the prose condition in
      `STABILITY.md` and the number a command prints cannot drift apart.

      **Deliberately a REPORT, and it returns 0 even when FIRED.** The
      enforcement half is Phase 0's frozen baseline plus the fresh-lapse error; a
      second failing check over the same population would red the same pull
      request twice for one cause.

      **It reproduces 0.1's number with one honest difference: 85, not 86.** The
      missing row is `write-engine.md`, whose deadline was extended by the other
      roadmap's PR after 0.1 measured — the same state change 3.1 records. 85 of
      121 is 70.2 %, still nearly three times the 25 % trigger, and the verdict
      is unchanged in the direction that matters.

## Phase 4 — the same shape, one surface over

Found while following a contract's own pointer during an estate review: the
lockfile contract names `scripts/_lib/installed_tools.py` as its *"Authoritative
module"*, and that file does not exist — it became `.ts` under the TypeScript
migration. Sweeping that construct gave a second population with the same cause
as D5: a gate exists, and `docs/` is not in its scope.

- [x] **4.1 Measure the dead-reference population in `docs/` and split it by whether the file ships.**

      **DONE 2026-08-26 — `agents/evidence/analysis/docs-dead-links-2026-08-26.md`,
      reproducible by `./scripts-run src/scripts/measure_docs_dead_links`.**
      Measured **544 dead relative links across 701 files**, split
      **104 shipped · 440 internal · 152 `.py`-target** — the shipped and `.py`
      figures reproduce this step's numbers **exactly**. The total is higher than
      the recorded 487 because `docs/` grew between the two measurements; stated
      rather than reconciled away, because the two figures describe different
      trees.

      **`measure_*`, deliberately not `lint_*` / `check_*`.** The scope decision
      is 4.3 and was still open; a gate landed before it would have pre-empted a
      choice this roadmap explicitly reserves.
      Measured 2026-08-24: **487 dead relative links across 656 files, 11.2 %**;
      **104** of them sit in files `package.json:files[]` actually ships
      (`docs/guidelines/` is a shipped root); **152** point at `.py` paths left
      by the migration. `check_references.ts:58` sets
      `SCAN_DIRS = ['dist/agent-src', 'agents']`, and the run reports
      `excluded_directory ×4496` — so the tree is green with 487 broken links in
      it, and no other gate does general link validation over `docs/`.
      verify: a committed count under `agents/evidence/analysis/` split
      shipped / internal / `.py`-target, reproducible by a command in the file.

- [x] **4.2 Repair the shipped 104 first, and the migration leftovers as a class.**

      **DONE 2026-08-26 — shipped 104 → 0, `.py`-target 152 → 9, and the nine
      survivors carry a reason.**

      The repair is driven by the same classifier that produced the measurement,
      and rewrites a target only when **exactly one** file in the tree matches
      it, through four ordered strategies: path tail from a known segment,
      `.py` → `.ts`, pytest's `test_x.py` → vitest's `x.test.ts`, and unique
      basename. Two tie-breaks, both principled: toward `src/` (the single source
      of truth, every other tree being a projection) and toward the path the
      author literally wrote once `../` is stripped — which is what separates
      `src/scripts/memory_status.ts` from its templates twin. **Anything still
      ambiguous is reported, never guessed:** a link silently repointed at the
      wrong candidate is worse than a dead one, because a dead link is visible.

      **The nine survivors are not a fixable class, and the reason is a bigger
      finding than the link count.** Each names a file the TypeScript migration
      **deleted** rather than renamed — no successor exists under any name — and
      each is a contract or architecture page citing a TEST as evidence that its
      rule holds. So the citation is a **coverage claim with nothing behind it**,
      and six of the nine sit in `docs/contracts/`. Repairing the link is
      impossible without first deciding whether the coverage still exists, which
      is seven contracts read against the current suite and its own change. This
      step admits a survivor that *carries a reason*; that is the reason, and it
      is recorded at the evidence file rather than buried here.
      The `.py` targets are mechanical — the same path with a different
      extension, or a file that no longer exists at all. Shipped-first because a
      dead link a consumer follows is the only half of this that reaches anyone.
      verify: the shipped count is 0; the `.py`-target count is 0 or every
      survivor carries a reason.

- [x] **4.3 Decide whether `docs/` enters `check_references`'s scope — and price it before deciding.**

      **DONE 2026-08-26 — the NARROW option: `SCAN_DIRS` gains `docs/guidelines`,
      the shipped root, and nothing else.**

      Priced before choosing, which is what the step demanded. Widening to **all**
      of `docs/` lands ~300 findings on the next unrelated pull request — the
      flood that gets a gate waived rather than adopted, and the same argument
      Phase 0 already accepted for the beta backlog. Widening to the shipped root
      lands **zero**, because 4.2 repaired all 104 first: the gate arrives green
      and holds the gain instead of announcing a backlog.

      The excluded class is named in the code, not left implicit — 297 dead links
      in non-shipped `docs/`, re-measurable any time. The three named single-file
      contracts in `files[]` are **not** added, because a directory scan cannot
      express "these three files under a directory that is otherwise excluded",
      and all three measure zero today.

      **Turning it on found 13 defects the link measurement could not see**,
      because `check_references` also reads backticked path references: a renamed
      pack directory, four PHP pattern pages cited one directory too shallow, a
      rule renamed to `skill-improvement-trigger`, and six prose strings that are
      not references at all (hypothetical filenames in README-splitting advice, a
      consumer-side settings path). All repaired; the six carry
      `<!-- ref-ignore -->`. `check_references` exits 0 with the wider scope.
      Widening the scan is one constant, and it lands 383 internal findings on
      the next PR unless 4.2 ran first. The same flood argument as Phase 0
      applies, and the same three outcomes are legitimate: widen, widen to the
      shipped roots only, or record the exclusion with the excluded class named.
      verify: `SCAN_DIRS` carries the decision, or `check_references.ts`'s module
      docstring names `docs/` as deliberately out of scope and says why.

- [x] **4.4 Correct the two stale pointers the contract itself carries.**

      **DONE 2026-08-26 — both resolve, in `docs/contracts/installed-tools-lockfile.md`.**
      The *Authoritative module* line named `scripts/_lib/installed_tools.py`,
      a file the TypeScript migration renamed, while its link target already
      pointed at the `.ts` — so the label and the link disagreed, which is worse
      than either being wrong alone. Both now read
      `src/scripts/_lib/installed_tools.ts`.

      The *Active roadmap* line cited P1.1 of `road-to-multi-package-coexistence`;
      that roadmap is archived, verified in `agents/roadmaps/archive/`. Replaced
      with the true state — **none** — rather than with a different roadmap,
      because inventing a current owner for a contract nobody is driving is the
      same defect in the other direction.
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
<!-- risk-review: v1 | reviewed: 2026-08-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The lower bound lands before the backlog and 86 reds teach the maintainer to waive | implementation | This repository documents the pattern directly: a gate that floods is a gate that gets bypassed, and 86 simultaneous violations on the next PR is a flood by any reading. | **MITIGATED BEYOND THE PLAN (2026-08-25).** 0.2's ratchet is stronger than the ordering this row relied on: the 86 are frozen and **warn**, so no flood is possible at any point, while a fresh lapse **errors immediately** — the original mitigation deferred all enforcement until cleanup finished. Residual: none for the flood; the ratchet's own failure mode moves to rank 7. | Phase 0 — disposition before enforcement |
| 2 | The 90-day cadence is unsustainable and the fix encodes it harder | product | 71.1 % lapsed is not 86 individual oversights; it is evidence about the cadence. Enforcing the floor without questioning the window would make a real constraint out of a number nobody has met. | **CONSIDERED AND REFUSED, WITH THE REASON (2026-08-25).** 0.2 put the window in scope as this row required, and kept 90 days: 44 of 86 lapsed on one day and 64 within four, which is **clustering, not a steady-state failure rate**, so 71.1 % is not evidence the window is too short. **Not retired** — `clear_by: 2026-11-23` reassesses the cadence on measured workload if the baseline is not empty, which is the falsifier this row was asking for. | Phase 0 — disposition before enforcement |
| 3 | Two roadmaps edit the same contract frontmatter | implementation | **The premise changed and the row is corrected rather than left standing.** It said *"the two are in the same PR"*. They are not: `road-to-channel-contract-and-profile-drift` shipped `write-engine.md`'s extension to `2026-09-24` in a **separate PR**, and this branch touches that file **zero** times (`git diff --name-only origin/main...HEAD`). The risk is now a cross-PR ordering one, not a same-diff collision. | Unchanged in shape and now easier to satisfy: 3.1 treats the already-shipped extension as its first row rather than re-fixing it, and AC-8's *"exactly once across this PR's roadmaps"* is satisfied by the other PR having done it. **Residual: if that PR is reverted, this row's subject returns.** | Phase 3 — close the two one-off filings |
| 4 | Wiring a previously-unwired gate reds the branch that wires it | implementation | **The subject AGED OUT, and that is worth recording as a hazard rather than a relief.** D4's single live violation was `ui-authority.md: keep-beta-until=2026-11-23 exceeds the 90-day window (max: 2026-11-22)` — over by **one day**. The window is measured from *today*, so the run of the clock alone retired it: at `AC_AS_OF=2026-08-25` the gate reports **zero** upper-bound violations. | 2.3 now has **nothing to resolve** on the upper bound, so 2.1 can wire without that red. But the row stays open because it generalises: **a violation that expires with the calendar can also reappear with it**, and a gate whose findings drift on an unchanged tree is exactly why 1.3 pinned `--as-of`. | Phase 2 — put it where a pull request can see it |
| 5 | Widening the reference scan floods the next PR with 383 internal findings | implementation | Same failure as rank 1, on a second gate: 4.3's cheapest branch is to widen the constant, and 383 simultaneous reds is a flood. | **Unchanged — Phase 4 was not touched.** Reviewed and left standing. Note for whoever reaches it: rank 1's flood was solved by a frozen no-growth baseline rather than by ordering, and the same shape is available here if 4.3 chooses to widen. | Phase 4 — the same shape, one surface over |
| 6 | The disposition pass becomes a promotion pass | product | The cheapest disposition for 86 lapsed contracts is "promote to stable", and promotion by exhaustion turns a review backlog into a stability claim nobody reviewed. | **THE CONTROL FIRED AND HELD (2026-08-25).** 0.1 proposed **36 promotions of 86** — a large fraction, and visible as one number exactly as this mitigation intended. It is a *proposal from a stated rule* (`refs >= 5` and quiet `> 30 days`), not an applied disposition: **no contract's frontmatter was edited**, so no stability claim was made by this pass. Residual, and named: the rule's proxy is *quiet and depended-on*, which cannot distinguish *settled* from *abandoned*. | Phase 0 — disposition before enforcement |
| 7 | The baseline becomes a permanent exception registry | implementation | **New 2026-08-25**, and it is the risk 0.2's mechanism creates. A council seat named it directly: *"Baseline systems can become permanent exception registries. If entries can be renewed repeatedly, manually deleted, or re-added under new identifiers, the ratchet is cosmetic."* | Three properties, each tested: the list cannot **grow** (anything absent errors), an entry cannot be **re-added** (same rule), and removal is **derived from the contract's own state** rather than from editing the file. Plus `clear_by: 2026-11-23`, which converts a stalled migration into a cadence review instead of silence. Residual: nothing enforces the clear-by date automatically — it is a recorded condition, not a gate. | Phase 0 — disposition before enforcement |

**Re-reviewed 2026-08-25** after Phases 0 and 1 landed. Five of the six original
rows changed on evidence and one row was added; the changes are recorded per row
rather than the review date being bumped in silence. Rank 1 is mitigated beyond
its plan, rank 2 was considered and refused with its reason, rank 3's premise
turned out to be false, rank 4's subject aged out with the calendar, rank 6's
control fired and held, and rank 7 is new — it is the risk the new mechanism
itself creates.

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
- [x] **AC-6** — the gate runs in a workflow, a deliberately lapsed contract reds its PR, and the gate is registered in `gate-coverage.yml`.
      **Met on all three.** Step in `.github/workflows/consistency.yml`;
      `docs/contracts/zz-canary-beta-lapse.md` at `keep-beta-until: 2026-01-01`
      makes the gate exit 1 as a `[FRESH lapse]` while the 85 inherited ones stay
      warnings; row in `src/config/gate-coverage.yml` with `min_scanned: 100`,
      and `check_gate_coverage --canary` reports it caught the planted defect.
- [x] **AC-7** — the gate is green at HEAD, `ui-authority.md` included, or its exception carries a written reason at the contract.
      **Met on the first branch, with the reason stated rather than implied.**
      The gate exits 0 and `ui-authority.md` produces no finding — but no file
      was edited to achieve that. Its date is unchanged; the CEILING moved,
      because it is computed as `today + 90` rather than from a last-review date
      no contract carries. 2.3 records that as a defect in the ceiling's anchor
      instead of banking it as a fix, which is the only honest way to tick this.
- [x] **AC-8** — `write-engine.md` and `no-runtime-boundary.md` are each fixed exactly once across this PR's roadmaps, and no two files change the same frontmatter.
      **Met.** `write-engine.md` was fixed once, by the now-archived
      `road-to-channel-contract-and-profile-drift`; this branch touches that file
      zero times and instead removes its stale row from the frozen baseline
      (86 → 85), which is the ratchet recording a state change rather than a
      second fix. `no-runtime-boundary.md` is fixed zero times here on purpose —
      it sits inside the Phase-0 cohort disposition, and hand-fixing it would be
      exactly the second-roadmap edit this criterion forbids.
- [x] **AC-9** — the `docs/` dead-reference count is measured and split shipped / internal / `.py`-target, the shipped count is driven to 0, and `check_references`'s scope either includes `docs/` or names it as deliberately excluded with the class stated.
      **Met on all three.** Measured 544 dead links across 701 files, split
      **104 shipped / 440 internal / 152 `.py`-target**, reproducible by
      `./scripts-run src/scripts/measure_docs_dead_links` and written up at
      `agents/evidence/analysis/docs-dead-links-2026-08-26.md`. Shipped is now
      **0**. `check_references` carries the decision in `SCAN_DIRS` — widened to
      `docs/guidelines`, the shipped root, with the 297 excluded internal links
      named in the code rather than left implicit.
- [x] **AC-10** — a command prints the current lapsed percentage and whether `STABILITY.md`'s 25 % trigger has fired, and reproduces AC-1's number at HEAD.
      **Met, with the one-row difference stated.**
      `check_beta_review_markers --trigger` prints
      `beta contracts: 121 · lapsed: 85 · 70.2 % · STABILITY.md re-audit trigger
      (>= 25 %): FIRED`. AC-1's number was 86 / 71.1 %; the missing row is
      `write-engine.md`, whose deadline the other roadmap's PR extended after
      that measurement. Same population, one real state change, and the verdict
      is unchanged in the direction that matters — still nearly three times the
      trigger.