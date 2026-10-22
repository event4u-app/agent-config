---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
estate_growth_exempt: "One active roadmap and one open blocker (delegated-owner-defaults). The blocker is the owner's own Iron Law (ownership_classes.ts: product-owned is locked to the owner) meeting a run delegation that applied council answers to locked-class decisions; only the owner can say whether a delegation may ever do that."
estate_offset_exempt: "No active roadmap owns whether a ticked step is true on the shipped path: road-to-a-step-that-costs-what-it-changes owns how much ceremony a step pays (receipts, depth), not whether its verify reaches production; the enforcement-coverage gate resolves rules to validators, not steps to callers. Archiving an unrelated finished file to buy the slot would hide the growth this key exists to show."
relates:
  - slug: road-to-a-step-that-costs-what-it-changes
    relation: disjoint
    note: "That file's receipts record a step's ceremony class; this file adds what a tick must prove. Phase 3 here reads the receipt line, never changes its grammar."
  - slug: road-to-a-tier-the-dispatch-carries
    relation: extends
    note: "Phase 1 reverts its 2.3 definition flip and reopens 2.2/2.3 and both tier claims until Phase 4's rerun; its other steps stand."
  - slug: road-to-a-cold-start-paid-once
    relation: extends
    note: "Phase 1 reverts the 2.5 ship-on edit until a constraint carrier exists (2.3 here); its other steps stand."
  - slug: road-to-free-hands-a-paid-head-checks
    relation: extends
    note: "Phase 1 returns A9/A10 and both blockers to open; Phase 5 repairs 3.2, 3.5, 4.1 and 6.2 defects in place. The shipped code stays dormant meanwhile."
  - slug: road-to-one-detector-and-the-senders-we-own
    relation: extends
    note: "Phase 1 reopens 2.5 (built, not wired); Phase 4 adds the store-rule precision reading its PREREG (b) never took."
depends: []
---
# Road to a tick the shipped path earns

> **Source:** `agents/tmp.old/inbox-2026-10-aa/` — one owner chat of 2026-10-22 and three supplied
> artefacts for it (a plan in this repo's format, a P0–P5 plan from a second reviewer, a 21-finding
> annex). The supplied plan was pinned to `pr2585@b48e33b5`; every tree fact below was re-read on
> 2026-10-23 at `feat/subagent-system-2583-rest@23fbc95112` (#2588), which already carries the
> owner decisions O1–O6 of 2026-10-23. Where the two disagree, this file states the live tree.

## Goal

A step is ticked only when what its verify proves is what ships: the code it names is reached
from a production entry, the evidence it cites was produced from the bytes it pins, a flip ships
no wider than the claim that backs it, and an owner-locked decision is closed by the owner. Each
of the four is a check that can say no, not a convention.

Success is checkable:

1. A roadmap decision row of class `product-owned`, `business-owned` or `destructive-owned` with
   a resolver other than `owner` fails the decision lint; a class-3 blocker set `resolved`
   without an owner decision line fails the blocker lint (Phase 2).
2. A newly ticked step whose verify exercises a `src/` symbol fails unless the symbol is in the
   import closure of a declared production entry, or the step says `built, not wired` and stays
   open (Phase 3).
3. A bench result cites a commit whose clean archive reproduces every corpus answer, and the
   verify reads the measured leg's own output (Phase 4).
4. Every step ticked in #2585 is re-read under 1–3 and the reopened count is published (Phase 6).

## What this roadmap is not

Not a re-review of the archived estate (only ticks from #2585 onward), not a new council round
to re-ratify anything, not a semantic "is this step done" judge, not a coverage gate. It adds
three checks to three existing lints and one harness rule, reverts three edits, and repairs the
latent defects the review found.

## Context — defects reproduced at `pr2585@b48e33b5`

| # | Defect | Evidence | How checked |
|---|---|---|---|
| D1 | **The owner Iron Law is enforced on council config, not on roadmaps.** `ownershipModeError` locks `product-owned`, `business-owned`, `destructive-owned` to the owner — "never resolve on a model" (`src/scripts/ai_council/ownership_classes.ts:35`, `:103-108`). `lint_decision_classes` checks only that the resolver is from a vocabulary (`src/scripts/lint_decision_classes.ts:58-65`, `:195-208`), so `product-owned \| council:…` passes. Four such rows were added in #2585 (free-hands A9, A10; tier A7; one-detector D11) — **since re-filed as owner rows by O1–O3 on 2026-10-23 in #2588**; four older rows elsewhere still carry a council resolver on a locked class (`road-to-an-update-that-installs-itself-only-when-it-is-safe.md` D7, D8; `road-to-authority-routing-mechanism.md` D11; `road-to-placeholders-on-the-wire.md` D7). `lint_roadmap_blockers` treats any `Status: resolved` as history (`src/scripts/lint_roadmap_blockers.ts:416-418`), though an absent `Class` means human-only (`:243`). The deciding council's openai seat could not read the three roadmaps (`agents/evidence/council/subagent-system-2583-owner-blockers-20261022.md`, Bound), and both seats called `free-route-admission` only partially reversible while the delegation covered reversible choices. | files cited | read + grep |
| D2 | **A step closes on a function no production path calls.** (a) Cold-start 2.5 shipped `omit_project_instructions: true` on `ac-worker` and `ac-researcher` (`src/subagents/ac-worker.md:34`, `ac-researcher.md:31`) against `composeSpawnBrief`, whose only non-test importer is `subagent_bundle.ts`, itself imported only by tests; a host Agent call carries the baked floor but not the consumer's CLAUDE.md or rules. (b) One-detector 2.5: `detectNormalized` (`src/scripts/_lib/egress_normalize.ts:59`) is imported only by its test. (c) Free-hands 3.2: the chooser reads `m['content_ceiling']` (`src/scripts/ai_council/route_chooser.ts:152`), a field no client sets; the "never lands" test uses synthetic candidates. The pattern exists for rules — "resolution over declaration" (`src/scripts/check_enforcement_coverage.ts:10-17`) — and an import closure exists for the dispatcher (`src/scripts/_lib/dispatch_import_closure.ts:136`); nothing applies either to a ticked step. | grep of importers | grep |
| D3 | **Evidence is not bound to the bytes it pins.** The tier bench computes corpus answers from the live working tree (`internal/bench/tier-downshift/run.ts:25`, `:37-69`) and records only `HEAD` (`results.head` = `f4e20ba12f`). The corpus answer `461` for `count-ts-src/scripts/_lib` is wrong at that pin and at the report's pin `5653d32f` (460 files each, `git ls-tree`), right only at `75da434d`. `verified` compares the head session's reply, not the measured leg's (`run.ts:152`). The haiku price row is dated 2026-05-14 and a former generation's rate (`internal/bench/pricing.yaml:14-20`) while the leg was served `claude-haiku-5-5`. The store redaction ships `STORAGE_IDENTIFIER_RULES` with every context word dropped (`src/scripts/_lib/identifier_redaction.ts:13-14`); PREREG (b) measured the context-bearing rows only, and the store rules hit 1.29 % of tree text files against the < 1 % bar (`2147483647` → `[PHONE]`). | executed + read | ls-tree, probe |
| D4 | **A flip ships wider than its claim.** `ac-researcher` declares `model_tier: lite` (`src/subagents/ac-researcher.md:7`) and keeps `WebFetch`/`WebSearch` (`:13-14`); the backing is "exact-lookup read-only fan-out" (`docs/CLAIMS.md:1406`). The older backed claim's negative control says a synthesis slice "never resolves below the session tier … never lite" (`docs/CLAIMS.md:374`). The record hook writes `tier_source: 'inherit'` whenever no per-call model is passed (`src/scripts/hooks/orchestration_record_hook.ts:309-316`), so a definition-served haiku leg is recorded as inherit — the blind spot T2 of the tier roadmap removed. | files cited | read |
| D5 | **Latent defects in shipped-dormant code** (each reproduced by the review, none reachable by a configured route today): the hand payload strips only the last top-level block (`src/scripts/ai_council/hand_payload.ts:106-123`) while `--callee-file` reads whole files (`src/scripts/ask_transport.ts:430`); shadow mode sends the raw prompt without the hand contract (`src/scripts/ai_council/free_hand_shadow.ts`, no production caller); a route member without `billing_proof` counts as paid and can chair (`src/scripts/council_cli.ts:1343-1353`); a stance-repair `resumeNext` survives three paths that skip its clear (`src/scripts/ai_council/orchestrator.ts:503-504`, `clients.ts:1467`), so a blind chairman can resume; a host rate marker inherits a council marker's `source` and `parked_at` (`src/scripts/_lib/quota_parked.ts:78-79`); `StopFailure` is bound with no host-version gate (`hooks/hooks.json:103`). | review + read | read |

**Reused, not rebuilt:** `ownershipModeError` and `OWNER_LOCKED_CLASSES`; the decision and
blocker lints; `dispatchImportClosure` and the resolution-over-declaration pattern of
`check_enforcement_coverage`; `check_step_receipts` (reads only the PR's own ticks); the
`verify:` grammar with expectations (`src/scripts/_lib/verify_clause.ts`); `kindTierAfter`;
the bench harnesses and `pricing.yaml`.

## Phase 1 — Before #2585 merges: put the tree back on the true side

- [x] **1.1 The three #2585 blockers carry the owner's decision, not the council's (D1).** Overtaken
  in substance: the owner answered all three on 2026-10-23 (O1–O3) and A7, A9, A10, D11 are owner
  rows in #2588. Left: the two free-hands blocker `Status:` lines still say "council 2/2 chose …
  applied as the default under the run's delegation"; they are rewritten to name the owner
  decision and its date. Built code stays dormant (no route configured, no default).
  verify: `grep -n "Status:" agents/roadmaps/road-to-free-hands-a-paid-head-checks.md` names the owner and 2026-10-23 on both, and no row of A7, A9, A10, D11 carries a `council:` resolver.
      Done 2026-10-23: both free-hands blocker `Status:` lines name the owner decisions O2/O3 of 2026-10-23; A7, A9, A10, D11 were already owner rows in #2588.
- [x] **1.2 Revert the 2.5 ship-on edit (D2a).** `omit_project_instructions` off on `ac-worker`
  and `ac-researcher` until 2.3 lands; cold-start 2.5 back to open with the reason.
  verify: the projected definitions carry no `omitClaudeMd`; `package-workers-skip-project-instructions` is renamed to its negation or skipped with the blocker reason.
      Done 2026-10-23: `omit_project_instructions` removed from `ac-worker` and `ac-researcher` (and the `docs/wedge` copies); the test is now `package-workers-load-project-instructions-until-a-carrier-exists`, seen red against the old definitions; cold-start 2.5 reopened with the reason.
- [x] **1.3 Revert the definition-level tier flip (D4).** `ac-researcher` back to
  `model_tier: inherit`; `lite` stays a per-call argument for the fan-out kind (tier A3).
  Tier 2.3 and both tier claims back to `unbacked` pending 4.2.
  verify: `ac-researcher-tier-follows-the-claim` passes with `inherit` and both claims unbacked.
      Done 2026-10-23 for the definition: `ac-researcher` is `model_tier: inherit`; `ac-researcher-tier-follows-the-claim` is replaced by `ac-researcher-with-web-tools-is-never-lite`, seen red against the `lite` definition, because the claims back exact lookups and the definition keeps web synthesis. The two tier claims are re-decided by 4.2, either way.
- [ ] **1.4 Reopen one-detector 2.5** as "built, not wired" and correct the `raise_log` text that
  cites it (`src/config/hook-bundle-budget.json`).
  verify: the step is `[ ]` with that note; the raise_log entry names only code in the chunk.

## Phase 2 — The owner lock reaches the roadmap (D1)

- [x] **2.1 Red first.** A fixture roadmap with `| X | product-owned | council:… |` and a
  class-3 blocker `Status: resolved` with no owner line; both lints pass it today.
  verify: both self-test cases are red at the base commit.
      Done 2026-10-23: `tests/scripts/roadmap_owner_lock.test.ts`, 4 of 8 cases red before either lint changed.
- [x] **2.2 `lint_decision_classes` imports `OWNER_LOCKED_CLASSES`** and refuses a locked class
  whose resolver is not `owner`. A council answer on a locked class is legal only as text in the
  row ("proposed — council recommends …") with resolver `owner` and the row's decision cell
  starting `proposed`; the lint and `closure_scan` count such a row as open.
  The four pre-#2585 rows named in D1 are not rewritten here (K1): they enter a committed
  baseline, each with its file, id and the reason, and are listed for the owner; the lint refuses
  any row not in it.
  verify: 2.1's decision case red → green; the estate passes with exactly those four baselined.
      Done 2026-10-23: `lint_decision_classes` imports `OWNER_LOCKED_CLASSES`; the four pre-#2585 rows are `LOCKED_RESOLVER_BASELINE`, confirmed to be the only estate hits with the baseline cleared; self-test covers both directions; the roadmap template states the rule. `closure_scan` does not yet count a `proposed` row as open.
- [x] **2.3 `lint_roadmap_blockers` refuses `resolved` on a class-3 blocker** unless the file's
  `## Decisions` table has a row naming the blocker id with resolver `owner` and a date.
  verify: 2.1's blocker case red → green.
      Done 2026-10-23: a resolved class-3 blocker with no dated `owner` row naming it reds the new `lint_roadmap_blockers:owner-close` ratchet; 20 historic entries baselined (K1), headroom zero.
- [ ] **2.4 A constraint carrier for skipping workers (D2a, unblocks cold-start 2.5).** The
  consumer's constraints reach a worker that skips instruction files on the host's own Agent
  path — a `SubagentStart` injection of the floor plus a bounded digest of the project's
  instruction files, or a dispatch rule the delegation nudge enforces — with a fixture on that
  path, not on `composeSpawnBrief`.
  verify: a fixture Agent dispatch of `ac-worker` with `omitClaudeMd` receives a planted
  constraint line from a fixture CLAUDE.md.
  Bound: both carriers live in the hook bundle (`dist/hooks/dispatch.js`), which sits at
  1,549,951 of 1,550,000 B; a ceiling raise is ratification-gated and was refused to the agent in
  #2588. If no carrier fits under the ceiling, the step stays open and 1.2 stays reverted.

## Phase 3 — A tick reaches production (D2)

- [ ] **3.1 Declare the production entries** once: the hook dispatcher, the CLI registry
  commands, shipped command scripts, and the projected subagent definitions. Reuse
  `dispatchImportClosure`'s resolver for the import walk.
  verify: the entry list is a committed file; its closure is printed by a `report_` script and
  is stable across two runs.
- [ ] **3.2 `check_step_production_reach`** reads only the PR's own new ticks (the
  `check_step_receipts` diff walk). For each tick whose verify names a test file, it collects
  the `src/` modules that test imports; a tick passes when at least one of them is in the
  closure, or when the step text carries `production entry: <path>` that is. A step may instead
  stay `[ ]` with `built, not wired` — never `[x]`.
  verify: replaying #2585's ticks reds cold-start 2.5, one-detector 2.5 and free-hands 3.2;
  `--self-test` covers a wired and an unwired fixture.
- [ ] **3.3 Shadow first, then enforce.** One release in report mode (exit 0, list printed),
  then enforcing, like the receipts check. False positives are allow-listed per step with a
  reason, never globally.
  verify: the flip commit cites the shadow report with its hit list.

## Phase 4 — Evidence bound to the bytes it pins (D3)

- [ ] **4.1 Bench harness rule.** A bench refuses to run on a dirty tree (`git status
  --porcelain` non-empty) unless pointed at a `git archive` of a named commit; every result
  row carries that commit; corpus answers are computed from the same archive; `verified` reads
  the measured leg's final message from its transcript, never the dispatching session's reply.
  verify: a seeded dirty tree refuses; a fixture result whose corpus answer disagrees with its
  pinned archive fails the bench self-test.
- [ ] **4.2 Rerun the tier pair** under 4.1, with the haiku row re-sourced for the served model
  and dated, and the quality bound from an exact (Clopper–Pearson) or Wilson interval on the
  discordant pairs; hold only below the bar. Both tier claims are re-decided by this run, either
  way. The interval lives in `src/scripts/_lib/tier_downshift_verdict.ts`, whose 0-error branch
  (rule of three) is stricter than its 1-error branch (Wald) — the inversion the annex names F7.
  verify: the new report's pin, corpus and result rows agree; the claims cite it; a fixture with 1
  discordant failure is never held where 0 is refused.
- [ ] **4.3 Price rows carry a freshness bound.** A row older than 120 days, or whose tier
  maps to a served model of a newer generation than its source, refuses to price.
  verify: a fixture row dated 2026-05-14 against `claude-haiku-5-5` refuses.
- [ ] **4.4 Store-rule precision (D3, one-detector).** PREREG (b) gains a reading over
  `STORAGE_IDENTIFIER_RULES` on the tree corpus; phone and card lookaheads become
  `(?![0-9A-Za-z])`, NANP keeps a context word or validator in stores, a leading `+` on a diff
  line needs a grouped shape.
  verify: the store reading is below 1 %; `2147483647`, `+192.168.100.200` and a digit-led hex
  SHA stay untouched in fixtures.

## Phase 5 — Repairs, red first (D5)

- [ ] **5.1 Hand payload:** one named declaration per callee via the code-graph extractor, or
  refuse unless exactly one top-level declaration remains; assert after extraction that no
  block body survives. Fixtures: two functions, `export default`, trailing comment, Python with
  imports, PHP namespace.
  verify: each fixture is red at the base commit and sends signatures only after.
- [ ] **5.2 Ceiling on members:** `FreeRouteClient` and built seats carry `content_ceiling`
  from `routeCeiling` or seat config; an unknown `base_url` member defaults to
  `public-artifact`; a probed self-hosted route reaches `ask_transport`.
  verify: an injected base_url member without a ceiling refuses a `project-content` payload.
- [ ] **5.3 Shadow takes a `HandSlice`,** builds the payload, records exposure, requires a
  non-route paid side.
  verify: a shadow fixture's outbound body equals `buildHandPayload`'s output.
- [ ] **5.4 Any `route !== null` member is ineligible** for chair, synthesis and verdict.
  verify: a base_url member without `billing_proof` is refused as chair with a named reason.
- [ ] **5.5 `resumeNext` is cleared in a `finally`** around the stance-repair round, and the real
  `blind` flag reaches `ask`.
  verify: a quota-gated stance repair followed by a blind chairman call carries no resume flag.
- [ ] **5.6 A host marker sets its own `source` and refreshes `parked_at`.**
  verify: a council marker followed by a host `StopFailure` reads `would_wait`.
- [ ] **5.7 `StopFailure` binding gated** on the oldest host version recorded as accepting it;
  record that version or gate in the generator.
  verify: the generator emits no `StopFailure` key for a host row below the recorded version.
- [ ] **5.8 Corrections:** cold-start 4.3 says `server_error` observed, `rate_limit` unobserved;
  AC-4 says `name_key`; the egress setting description names identifier rows; each
  ratification record commits its seats' answers or a verdict digest beside the prompt.
  verify: the four texts read as stated.

## Phase 6 — Re-read #2585 and publish the count

- [ ] **6.1 Replay every tick of #2585** through 2.2, 2.3, 3.2 and 4.1; reopen what fails; publish
  `ticked / reopened / reason` in `agents/evidence/analysis/`.
  verify: the analysis lists every ticked step id of #2585 with a verdict.
- [ ] **6.2 Fingerprint the `main` residue** (second reviewer P0.3): each gate red on clean
  `origin/main` is recorded with job, SHA, toolchain and failure class, so a new red cannot hide
  under an old one.
  verify: the fingerprint file names every residue gate listed in #2588 with a SHA.

## Kill register

| # | Not done | Why |
|---|---|---|
| K7 | The second reviewer's P1–P5 (acceptance-contract schema, oracle repository, eight task families, grader calibration, release aggregation, consumer feedback) | each is a programme, not a defect; the defects that plan grounds in (#2585 evidence and flips) are D1–D5 here, and the rest overlaps owners already named in its own § 8 |
| K8 | Re-running the 55 stale trigger evals (second reviewer P0.4) | a red identical on `main`, owned by the eval-freshness gate, not by this file; listed as `main` residue with its fingerprint (6.2) |
| K1 | Re-auditing the archived estate | the checks read new ticks only, like `check_step_receipts`; a backlog gate reds the world and gets weakened |
| K2 | A model judging "is this step really done" | a semantic judge drifts and is the detector that gets weakened until it finds nothing (`lint_roadmap_producers` doctrine) |
| K3 | A new council round to re-ratify #2585 | the defects are mechanical; a council found none of them |
| K4 | Coverage percentages as a gate | reach of a named symbol is the question, not line coverage |
| K5 | Letting a run delegation resolve a locked class | `ownership_classes.ts` Iron Law; only the owner can change it (blocker below) |
| K6 | Deleting the dormant free-hands code | it is correctly dormant; Phase 5 makes it safe before anything turns it on |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| A1 | reversible-technical | agent | Phase 1 lands in #2585 before it merges; Phases 2–6 follow in their own PRs | the three reverts and the reopened blockers are what make #2585 true as merged; the checks need their own shadow window | the owner merges #2585 first — then Phase 1 is the first follow-up PR |
| A2 | reversible-technical | agent | Reach is decided by the test's `src/` imports, not by parsing verify prose | the verify grammar names commands, not symbols (`verify_clause.ts`); imports are the one machine-readable link from a test to code | a verify form names symbols directly |
| A3 | reversible-technical | agent | One release of report mode before 3.2 enforces | the receipts check took the same path; the hit list of the shadow is the allow-list's evidence | the shadow shows zero false positives |
| A4 | reversible-technical | agent | Reverting the two flips (1.2, 1.3) rather than patching forward | each flip shipped behaviour to every consumer on a claim or carrier that does not hold; a revert is one line each and loses nothing measured | — |
| A5 | reversible-technical | agent | A1 is applied as: every phase lands in #2588, the PR that already carries O1–O6 | #2585 merged before this file existed; #2588 is its open follow-up and the owner asked for this roadmap in it | the owner splits #2588 |
| A6 | reversible-technical | agent | Pre-#2585 locked-class rows with a council resolver are baselined, not rewritten | K1: rewriting four other roadmaps' decisions is a backlog re-audit; a baseline keeps them visible and refuses a fifth | the owner rules on blocker `delegated-owner-defaults` |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-23 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Reach check is gamed by an import | implementation | A test imports a production module it never exercises. | The check proves the tested code is reachable, not tested; the step's verify still has to fail without the change (2.1 red-first pattern). | Phase 3 — A tick reaches production (D2) |
| 2 | Constraint carrier blows the hook budget | implementation | Injecting instruction-file digests at `SubagentStart` exceeds the slot cap. | Bounded digest within the existing per-slot cap; failing that, 2.5 stays reverted. | Phase 2 — The owner lock reaches the roadmap (D1) |
| 3 | Rerun reverses the tier verdict | product | Under 4.1 the lite arm fails the bar. | That is the purpose; the kind keeps inherit and the claim records the null. | Phase 4 — Evidence bound to the bytes it pins (D3) |
| 4 | Night runs stall on owner blockers | product | Without delegation, runs stop at product-owned questions. | Dormant build under an open blocker stays allowed (K6); blocker below lets the owner choose. | Blockers |

## Blockers

### blocker: delegated-owner-defaults
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** nothing in Phases 1–6; it decides whether 2.2/2.3 ship with an exception.
- **What to do:** pick exactly one — (a) a run delegation may never resolve a locked class; a council answer on one is recorded as the blocker's recommendation and work behind it may be built only dormant (no default, no configured route, no network) while the blocker stays open; or (b) a written owner delegation committed under `agents/evidence/delegations/`, naming the blocker ids and dated, lets a run apply the council default to those ids only when both seats call the choice fully reversible; the lint accepts resolver `owner:delegation:<file>` for exactly those ids.
- **Recommendation:** (a). The Iron Law is the owner's own, and the one case that tested it failed both conditions (a seat that could not read the files, a choice both seats called only partially reversible). (a) loses no work, because dormant building stays allowed.
- **If you do nothing:** 2.2/2.3 ship as (a), the stricter reading of today's law.
- **Resolved when:** a dated owner decision line naming (a) or (b) is in this file's `## Decisions` table.

## Acceptance Criteria

- [ ] AC-1 The three #2585 blockers carry the owner's dated decision, and no locked-class row outside the baseline carries a non-owner resolver (1.1, 2.2).
- [ ] AC-2 No consumer-facing default changed by #2585 ships without a holding claim or carrier (1.2, 1.3).
- [ ] AC-3 Both lints red on the D1 fixtures and green on the estate (2.1–2.3).
- [ ] AC-4 The reach check reds the three D2 cases on replay and enforces after one shadow release (3.2, 3.3).
- [ ] AC-5 The tier claims are re-decided on a run whose pin reproduces its corpus (4.1, 4.2).
- [ ] AC-6 Every D5 repair is red at its base and green after (Phase 5).
- [ ] AC-7 The #2585 replay is published with its reopened count (6.1).
