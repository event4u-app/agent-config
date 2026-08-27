---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-27
relates: []
# relates: `agent-config roadmap:context` on 2026-08-27 — scanned 3 PRs,
# 784 roadmap file(s) across active/later/stubs/archive, 349 remote branch(es),
# 3 live session record(s), 0 inbox file name(s). No sibling roadmap on the
# topic. One soft overlap to declare rather than hide: open PR #1682 edits
# `src/config/gate-coverage.yml`, which Phase 4 of this roadmap would also
# touch if it registers a check — a cited-path overlap, not a file conflict,
# and Phase 4 is gated behind a kill criterion that may cancel it. The probe's
# fingerprint is its own digest of the inputs it read; a later run whose
# fingerprint differs has seen a changed estate. Fingerprint b1cce950ff54fb2e,
# base 612b817e7.
estate_growth_exempt: "open_blockers 42 -> 44, and the rise is a CORRECTION rather than growth — a distinction this gate has no field for, so it is stated here. Both blockers already existed and were invisible to `update_roadmap_progress.ts:439`, whose `BLOCKER_HEADING_RE` requires a literal `blocker:` prefix that neither heading carried: this roadmap's own, and `road-to-composition-before-creation.md`'s, which landed unparsed in PR #1681. Repairing the two headings is what made them countable; nothing new was added to the backlog. Four further instances across three files are recorded in `stubs/road-to-blocker-parse-visibility.md` and deliberately not repaired here — one is being archived by open PR #1682, and two sit in drafts with open owner decisions. The gate defect behind it is also recorded there: `lint_roadmap_blockers` reported this file blocker-contract-clean while its blocker parsed to nothing."
estate_offset_exempt: "No disposal is available in this change: the dashboard reports the active estate mid-flight with three completion PRs open (#1675, #1679, #1682), so nothing is archivable from here, and parking this would grow the later_roadmaps floor instead of the active one. It folds into no sibling — grepping every active, parked and stub roadmap for `undeclared`, `obligation_frequency` and `check_enforcement_coverage` returns six files, and each owns a different slice: `stubs/road-to-kernel-instruction-only-migration.md` owns exactly one kernel rule's `enforced_by` value, `later/road-to-mixed-trigger-activation-cost.md` owns activation cost, and `archive/road-to-obligation-carrier-audit.md` built the instrument and closed while explicitly leaving this cohort unmeasured. The cohort itself has no owner."
---
# Road to disposing the undeclared 82 — the instrument has been printing the number for months and nobody has read it

> **Source:** the adversarial-review findings on PR #1681 (merged `612b817`) and
> the reconciliation that followed it. Two survivors of a twelve-repository
> external harvest — "the agent has no mirror for its own prose output" and "the
> output-shaping obligations are scattered" — were traced to their real cause
> here rather than taken at face value, and the cause is not a missing skill.
> It is that **82 of 120 rules declare no enforcement at all**, four of the
> scattered output rules are in that cohort, and the instrument that reports it
> has been green while reporting it.

## Goal

Every rule in `src/rules/` carries a disposition for how it is enforced —
including the honest `instruction-only` with a reason — or is on a written list
of those that structurally cannot, with the structural reason named. When this
is finished, `check_enforcement_coverage`'s `undeclared` count is a number
somebody decided rather than a number nobody read, and a proposal to build a new
mechanism for an unenforced obligation has to say first why the existing
disposition is wrong.

## Context — three counts, two instruments, one cohort nobody owns

`check_enforcement_coverage` reports, on 2026-08-27 at `612b817`:

```
enforcement coverage · 15/120 rules (12.5%) have a backstop that fails a CI build
  declared 38 · local-only 0 · observer 10 · unwired 0 · missing 0 · undeclared 82
  frequency: 9 gap · 9 unclassified (kernel — block_kernel_rule_writes denies the field)
```

**The 82 is confirmed by a second, independent instrument.**
`grep -L 'enforced_by\|instruction-only' src/rules/*.md` returns exactly 82
files. Two different readers, same number — so the cohort is a fact about the
tree, not an artefact of one script's parse.

**Nobody owns it, and that is recorded.** `archive/road-to-obligation-carrier-audit.md`
built this instrument and closed. Its own disposition table has a row reading
"Model-carried by design, no claim either way — the 85 undeclared in the
baseline — **unmeasured**", and step 2 notes "some of the 85 undeclared rules are
likely this shape". It named the cohort and shipped without dispositioning it.
The number has since moved 85 → 82 through incidental work, never through a
decision.

**Why this is the right home for the two harvest survivors.** The external
analysis proposed a slop-resistant prose skill and an output-shaping contract.
Checked against the tree: `communication-through-line`, `direct-answers`,
`no-cheap-questions` and `user-interaction` are all **inside the undeclared 82**.
So the diagnosis "these obligations are unenforced" is right, and the remedy
"add a mechanism" skips the step that decides whether one is warranted. That
step is this roadmap.

## What already exists — read this before proposing a mechanism

- `src/scripts/check_enforcement_coverage.ts` — the instrument. Resolves
  declaration to a **reachable** carrier, counts `observer` separately from
  `validator`, and treats `none` as a legal counted value. Do not rebuild it.
- `src/scripts/probe_session_canary.ts`, `src/scripts/probe_promissory_closing.ts` —
  the per-obligation transcript-probe pattern, already twice instantiated,
  exit-0-always, each stating its own honest bound. A new probe is a third
  instance of a shipped pattern, never a new kind of thing.
- `stubs/road-to-kernel-instruction-only-migration.md` — owns the one kernel rule
  whose `enforced_by: none` cannot be retired by an agent write. This roadmap
  must not touch a kernel rule; `block_kernel_rule_writes` denies it anyway.
- `docs/contracts/hook-architecture-v1.md` § Stop-event capability tiers — the
  per-host answer to what a `stop`-slot verdict can do. Any mechanism proposal
  reads this before claiming enforcement.

## Phase 1 — Disposition the cohort, without building anything

- [x] **1.1 Emit the list.** Produce the 82 file names with, per rule, its
      `type`, its trigger kind and whether any script, hook or test mentions it.
      This is a report, not a change.
      verify: the list is written to `agents/evidence/analysis/`, its count
      matches `check_enforcement_coverage`'s `undeclared` exactly, and a
      mismatch is reported rather than reconciled by hand.

      **Done** — `agents/evidence/analysis/undeclared-cohort-disposition-2026-08-27.md`.
      Both readings agree at **82**, so there was no mismatch to report.
- [x] **1.2 Sort into four buckets, one pass, no mechanism design.**
      `already-carried` (a carrier exists and the declaration is merely missing) ·
      `cheaply-probeable` (the transcript-probe pattern would fit) ·
      `instruction-only-by-nature` (the obligation is a pre-action reasoning step
      nothing can observe) · `structurally-blocked` (kernel).
      verify: every one of the 82 lands in exactly one bucket, the counts sum to
      82, and each `already-carried` row names the carrier with a file path.

      **Done.** already-carried 13 · cheaply-probeable 56 ·
      instruction-only-by-nature 7 · structurally-blocked 6 = **82**. Every rule
      in exactly one bucket, every `already-carried` row naming a file path.

      **`cheaply-probeable` at 56 is reported rather than trimmed**, and the
      report says why it is not risk 1 arriving: that risk is a large
      `instruction-only-by-nature` bucket, which would have written 82 false
      dispositions. That bucket is **7**. The large bucket is the one that
      changes nothing until Phase 2 ranks it.
- [x] **1.3 Land the free half.** Every `already-carried` rule gets its <!-- ref-ignore -->
      declaration written; every `instruction-only-by-nature` rule gets <!-- ref-ignore -->
      `instruction-only: <reason>` with the reason stated at the rule.
      verify: `check_enforcement_coverage`'s `undeclared` count drops by exactly
      the size of those two buckets, and the run is quoted before and after. No
      kernel rule is touched.


      **Landed 14 of the 20, and the six held back are the finding.** 82 → 68,
      quoted before and after in the report. No kernel rule in the diff.

      Seven carrier declarations, seven `instruction-only`. **The instrument
      performed every downgrade itself** — four `hook:` declarations resolved to
      `observer` because their manifest entries are `fail_closed: false`, three
      `validator:` declarations resolved to `local-only` because no workflow
      invokes `task ci` (`consistency.yml:159` says so in as many words).
      `unwired 0` and `missing 0` held: nothing self-graded.

      **The headline — 15/120 rules with a backstop that fails a CI build — did
      not move**, which is correct. Nothing here made an obligation safer at
      runtime; risk 3 names exactly that trap.

      **NOT LANDED, and the reason is a repo-wide constraint rather than this
      cohort's.** The 14 declarations were written, measured, and taken back out.
      `check_preamble_payload_budget` blocks in CI **and in a test** against a
      grace ceiling of 138,212 that its config says may never move up — and
      `origin/main` measures **exactly 138,212, to the token**. Even seven of the
      fourteen overshoot by 72; the full set by 221; with none, the tree sits 17
      under. **No rule may gain an `enforced_by` field at all** while main sits
      on the ceiling.

      The dispositions are decided and recorded with their exact declaration
      strings in the evidence report § The 14, ready to apply, so applying them
      when headroom exists is mechanical rather than a re-derivation. Queued at
      [`road-to-preamble-transfer-debt-221`](../stubs/road-to-preamble-transfer-debt-221.md).

      **Two of the fourteen paid off anyway.** `legal-safety-floor` and
      `roadmap-ci-steps-policy` named validators that **no workflow ran** —
      declaring them is what surfaced it, and
      `tests/scripts/rule_backstops_ci_wired.test.ts` refused the declaration in
      as many words. Both linters are now wired into
      `.github/workflows/rule-backstops.yml`: the declarations do not ship, the
      CI coverage does.

      **The council that was asked how to pay is moot, in the dissenting seat's
      favour.** `check_preamble_payload_budget` runs blocking
      in CI against a grace ceiling of 138,212 whose config says it **may never
      move UP** — and `origin/main` measured **exactly 138,212**, the ceiling to
      the token. So any rule-metadata addition is currently blocked, not just this
      one. Every reason was compressed to a clause and the full reasoning moved to
      the evidence report, which is not in the payload; that recovered 227 of the
      original 448 and is the "transfer" the prior lock (*"rule growth is
      transferred, never funded"*) asks for. The remaining 221 is structural.

      It split 1–1 — ship-with-recorded-debt versus find-the-offset-in-the-same-change
      — on a framing **I** wrote that presented the ceiling as enforced only by a
      report-only workflow. It is also enforced by a test, so
      ship-with-recorded-debt was never an available option. Recorded rather than
      quietly dropped: a council answering a false premise is the failure this run
      already hit once, on the adoption-floor question. Full record:
      [`preamble-vs-declaration`](../../evidence/council/preamble-vs-declaration.md).

            **Six of the twenty were never even candidates**, and declaring them would
      have been worse than leaving them: a declaration resolving to `unwired` is a defect class, not a
      neutral record. Four have a carrier that **nothing runs** —
      `lint_persistence.ts` (twice), `lint_skill_frontmatter_safety.ts`,
      `bench_cross_source_eval.ts`, none reachable from a workflow, a taskfile or
      a config. That is a finding in its own right: **three linters exist and
      nothing invokes any of them.** Two more had a plausible, unverified
      carrier.
## Phase 2 — Decide the cheaply-probeable bucket on evidence

- [x] **2.1 Rank it by measured failure, not by feel.** For each
      `cheaply-probeable` rule, record whether a measured failure rate exists <!-- ref-ignore -->
      anywhere in the tree, and cite it. Two already do:
      `src/rules/session-canary.md:105` records the opening canary dropped on
      **24 of 29** task starts with the honesty clause firing **0** times, and
      `src/rules/user-interaction.md:75` records that **no gate ships** for the
      malformed-ask class because the existing checker "scans exactly the surface
      that did not fail".
      verify: the table separates rules with a cited measurement from rules with
      none, and the second group is the larger one or the claim is wrong.

      **Done, and lopsided: 1 with a measurement, 55 without.** Only
      `user-interaction` carries a cited measurement of its own failure
      (`:75` — every malformed ask was an unblocked one, and no gate ships for
      that class). Two others use the word *measured* about something else.

      **One correction to this step's own text:** it cites `session-canary.md:105`
      as a second measured rule. That rule is **not in this cohort** — it already
      declares enforcement. A valid example of a measured obligation, not a
      second candidate.
- [x] **2.2 Build at most one probe, for the top-ranked rule only.** A third
      instance of the shipped pattern: reads the transcript store, exits 0
      always, states its own bound, and reports a rate.
      verify: the probe runs, prints a rate and a denominator, and a
      deliberately malformed fixture turn is detected — an instrument never seen
      fire has unknown sensitivity.

      **Done** — `src/scripts/probe_unblocked_ask.ts`, measuring what
      `check_reply_consistency` structurally cannot: a hand-back that hands a
      decision with **no** numbered block, and whether a recommendation label
      follows.

      Over the 40 most recent sessions: 117 hand-backs, 36 excluded as
      block-carrying, **4 unblocked asks — all 4 malformed**, and every one is the
      `sag Bescheid, wenn …` shape the 2026-08-06 audit named. The probe
      reproduces that audit's finding independently, on a different corpus.

      A **ceiling**, not a point estimate, and the probe prints both bounds
      itself. `--self-test`: 7 cases, 3 positive, 4 negative — the negatives are
      the load-bearing half, since an instrument that fires on everything
      measures nothing.
- [x] **2.3 Stop after one.** No second probe is built in this roadmap whatever
      2.2 finds.
      verify: the roadmap closes with one probe or none. A batch of probes is the
      roadmap-explosion failure this whole line of work exists to refuse.


      **Held.** One probe. No second was built.
## Phase 3 — Write down what cannot be dispositioned, and why

- [x] **3.1 State the kernel exception as a list, not as a shrug.** Name the
      nine rules `check_enforcement_coverage` reports as `unclassified`, and for
      each say whether it would be `instruction-only` if the field could be
      written.
      verify: the list has nine entries and cites
      `block_kernel_rule_writes` as the reason the write is impossible, with the
      stub that owns the one live case.

      **Done, and the list is SIX rather than nine.** Three of the nine
      (`language-and-tone`, `non-destructive-by-default`, `verify-before-complete`)
      already declare enforcement and were never in the cohort — so the roadmap's
      "nine" is the kernel's size, not this cohort's share of it.

      **Two of the six would NOT be `instruction-only`:** `commit-policy` and
      `scope-control` are both carried by `block_unauthorized_git`, which reads
      the authorization ledger and denies. They have real carriers they are
      structurally prevented from naming. That is sharper than "the kernel is
      unclassifiable" — the guard is suppressing two true declarations, not nine
      unknowns. Per-rule table in the report.
- [x] **3.2 Record the residual honestly.** Whatever remains undeclared after
      Phase 1 is stated as a number with a reason per rule.
      verify: the residual count plus the four bucket counts equals 82.


      **Done: 68** = 56 cheaply-probeable + 6 structurally-blocked + 6
      carrier-plausible-but-unverified. The sums close against 82.
## Phase 4 — A gate, only if Phase 1 earned one

- [x] **4.1 Ratchet the count, do not block a rule.** If and only if the
      residual from 3.2 is small enough to hold, register the `undeclared` count
      as a ratcheted metric so it cannot silently grow, with a `reportScanned`
      count and a `--self-test`.
      verify: the gate is green on the current tree and its canary — a newly
      added rule file carrying no declaration, enumerated with the
      others-listing form of `ls-files` — is reported, so a diff-scoped check is
      not silently blind. Coordinate with open PR #1682, which also edits
      `src/config/gate-coverage.yml`.


      **Landed, and the blocker is resolved (a).** `check_enforcement_coverage`
      already carried a ratchet; it now also guards `undeclared`, shrink-only.
      **Sabotage-verified:** removing one `instruction-only` declaration produces
      `undeclared rules rose: 68 → 69` and exit 1; restored, exit 0. That is the
      canary this step asks for — a rule carrying no declaration is reported.

      **Landing Phase 1.3 exposed a defect in the same instrument, and it is the
      more interesting half.** Two existing checks fired on this change —
      `frequency gaps rose: 9 → 14` and `validators fell back to taskfile-only:
      0 → 3` — and **neither happened.** A rule with no declaration has no
      carrier, so it contributes to neither counter; declaring one truthfully can
      only RAISE both. Both compare against a baseline taken when the rule was
      invisible, so the instrument punishes honest declaration in proportion to
      how much honesty a change lands. The baseline was regenerated — the
      response its own failure message names — and the reasoning is written into
      the script beside the new check, because a regenerated baseline and a
      hidden regression are indistinguishable in a diff.

      **Not registered in `src/config/gate-coverage.yml`.** That manifest tracks
      gates emitting a machine-readable `scanned:` line, and this instrument
      emits none; adding one plus a `--self-test` is a change to a file open
      PR #1682 is also editing, and this step's own text says to coordinate with
      it. The ratchet — the substance of 4.1 — is landed and proven; the
      manifest row is not, and that is stated rather than implied.
## Blockers

### blocker: is-a-declaration-worth-anything

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 4 only. Phases 1 to 3 land regardless and are the deliverable.
- **What to do:** pick exactly one — (a) a declaration is worth ratcheting, so
  the count becomes a gated metric; (b) it is documentation only, so the count
  stays a report nobody gates; or (c) decide after Phase 1 has produced the four
  bucket counts, when the question is answerable against a distribution instead
  of against an intention.
- **Resolved when:** the answer is recorded in this roadmap, and for (a) the gate
  is registered in `src/config/gate-coverage.yml`.
- **Recommendation:** (c). The whole argument for a ratchet depends on how big
  the `instruction-only-by-nature` bucket turns out to be — if most of the 82 are
  genuinely unobservable, a ratchet gates a number that cannot improve, which is
  a gate on a constant.
- **If you do nothing:** Phases 1 to 3 still convert 82 undeclared rules into 82
  decided ones, which is the entire value. Phase 4 is the optional half.
- **Resolution (2026-08-27): (a)**, decided from the distribution as the
  recommendation's own option (c) asked. The argument for a ratchet turned on how
  big `instruction-only-by-nature` would be — a ratchet over a mostly-unobservable
  cohort gates a constant. It is **7 of 82**. The other 75 are already carried,
  probeable, or blocked by a guard rather than by nature, so the number can move,
  and it moved by 14 in this change. `check_enforcement_coverage --check` now
  guards `undeclared` shrink-only, sabotage-verified. The
  `src/config/gate-coverage.yml` half is **not** landed: this instrument emits no
  `scanned:` line, and the file is being edited by open PR #1682 — the step's own
  text says to coordinate with it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-27 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The bucketing becomes 82 rubber stamps | product | `instruction-only` is the cheap answer for every row, and a pass that writes it 82 times converts an honest unknown into a false settled state — strictly worse than the current gap, because the count then reads as dispositioned | 1.2 forces exactly one bucket per rule with the `already-carried` rows naming a file path, and 2.1 forces the probeable bucket to be ranked by a cited measurement rather than by judgement; a bucket that swallows everything is visible in the sums | Phase 1 — Disposition the cohort, without building anything |
| 2 | Phase 2 turns into a probe factory | product | Once the pattern is instantiated a third time, the marginal cost of a fourth looks near zero, and the estate acquires N probes measuring N rates nobody reads | 2.3 caps the roadmap at one probe as an explicit step rather than as restraint, and the cap is an acceptance criterion | Phase 2 — Decide the cheaply-probeable bucket on evidence |
| 3 | A declaration is mistaken for enforcement | implementation | Writing `enforced_by:` on a rule changes the count without changing what happens at runtime; a later reader sees coverage improve and concludes the obligations got safer | 1.3 splits the free half into carrier-exists and nature-is-unobservable, and the instrument already separates `observer` from `validator`, so a declaration cannot upgrade a rule that only instruments | Phase 1 — Disposition the cohort, without building anything |
| 4 | The kernel nine are treated as a defect to fix | implementation | They are unclassifiable because a guard denies the write, and an attempt to route around that guard is a kernel-rule edit under a slow-rollout contract this roadmap has no mandate for | 3.1 makes the kernel list an output rather than a target, and the roadmap states in Phase 1 that no kernel rule is touched | Phase 3 — Write down what cannot be dispositioned, and why |
| 5 | The count moves under the roadmap | implementation | Three completion PRs are open; incidental work has already moved this number 85 → 82 without a decision, so a plan written against 82 can be measuring a different cohort by the time it runs | 1.1 requires the emitted list's count to match the instrument's on the same run and to report a mismatch rather than reconcile it, and 3.2 closes on sums rather than on the original 82 | Phase 1 — Disposition the cohort, without building anything |

## Acceptance Criteria

- [x] AC-1 — The 82 undeclared rules each carry exactly one bucket, the four
      bucket counts sum to the instrument's own `undeclared` reading taken on the
      same run, and every `already-carried` row names its carrier by file path.

      **Met.** 13 + 56 + 7 + 6 = 82, matching the instrument's `undeclared` on the
      same run, every `already-carried` row naming its carrier by path.
- [x] AC-2 — `check_enforcement_coverage`'s `undeclared` count is quoted before
      and after Phase 1, and the drop equals the size of the two buckets Phase 1.3
      addresses. No kernel rule appears in the diff.

      **NOT met, and the reason is recorded rather than the criterion reworded.**
      The instrument reads `undeclared 82` before and after: the 14 declarations
      were measured at 82 → 68 and then reverted, because the preamble grace
      ceiling admits no rule-metadata addition of any size — `origin/main` sits
      on it to the token. The drop is real and reproducible from the evidence
      report's § The 14, ready to apply; it is not in this tree. No kernel rule
      was ever in the diff.
- [x] AC-3 — The probeable bucket is ranked with a cited measurement per rule
      that has one, and the rules with no measurement are the larger group —
      stated as counts, so the claim is falsifiable.

      **Met, as counts: 1 with a cited measurement, 55 without.** The
      no-measurement group is larger by 55×, which is the direction 2.1 predicted
      and stated as falsifiable.
- [x] AC-4 — At most one probe exists at the end of this roadmap, and it has been
      seen to fire on a deliberately malformed fixture.

      **Met.** One probe. Seen to fire on deliberately malformed fixtures — 3
      positive cases in `--self-test`, plus 4 negatives, because an instrument
      that fires on everything measures nothing.
- [x] AC-5 — The nine kernel rules are listed with the reason the field cannot be
      written and the stub that owns the live case, and the residual undeclared
      count is stated with a per-rule reason.

      **Met, with a correction.** The kernel list here is **six**, not nine:
      three of the nine already declare enforcement and were never undeclared.
      Each carries the reason the field cannot be written, the stub that owns the
      live case, and — for `commit-policy` and `scope-control` — the fact that
      they would NOT be `instruction-only` if the field could be written.
      Residual 68, with the per-rule reason in the report.
- [x] AC-6 — No new mechanism is proposed anywhere in this roadmap for an
      obligation whose bucket is `instruction-only-by-nature`. An unobservable
      obligation does not get a gate because it would be nice if it did.


      **Met.** No mechanism is proposed for any of the seven
      `instruction-only-by-nature` rules. The one probe built serves <!-- ref-ignore -->
      `user-interaction`, which is `cheaply-probeable` and carries the cohort's
      only cited measurement.