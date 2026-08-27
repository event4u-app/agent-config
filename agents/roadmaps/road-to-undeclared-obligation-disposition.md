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

- [ ] **1.1 Emit the list.** Produce the 82 file names with, per rule, its
      `type`, its trigger kind and whether any script, hook or test mentions it.
      This is a report, not a change.
      verify: the list is written to `agents/evidence/analysis/`, its count
      matches `check_enforcement_coverage`'s `undeclared` exactly, and a
      mismatch is reported rather than reconciled by hand.
- [ ] **1.2 Sort into four buckets, one pass, no mechanism design.**
      `already-carried` (a carrier exists and the declaration is merely missing) ·
      `cheaply-probeable` (the transcript-probe pattern would fit) ·
      `instruction-only-by-nature` (the obligation is a pre-action reasoning step
      nothing can observe) · `structurally-blocked` (kernel).
      verify: every one of the 82 lands in exactly one bucket, the counts sum to
      82, and each `already-carried` row names the carrier with a file path.
- [ ] **1.3 Land the free half.** Every `already-carried` rule gets its
      declaration written; every `instruction-only-by-nature` rule gets
      `instruction-only: <reason>` with the reason stated at the rule.
      verify: `check_enforcement_coverage`'s `undeclared` count drops by exactly
      the size of those two buckets, and the run is quoted before and after. No
      kernel rule is touched.

## Phase 2 — Decide the cheaply-probeable bucket on evidence

- [ ] **2.1 Rank it by measured failure, not by feel.** For each
      `cheaply-probeable` rule, record whether a measured failure rate exists
      anywhere in the tree, and cite it. Two already do:
      `src/rules/session-canary.md:105` records the opening canary dropped on
      **24 of 29** task starts with the honesty clause firing **0** times, and
      `src/rules/user-interaction.md:75` records that **no gate ships** for the
      malformed-ask class because the existing checker "scans exactly the surface
      that did not fail".
      verify: the table separates rules with a cited measurement from rules with
      none, and the second group is the larger one or the claim is wrong.
- [ ] **2.2 Build at most one probe, for the top-ranked rule only.** A third
      instance of the shipped pattern: reads the transcript store, exits 0
      always, states its own bound, and reports a rate.
      verify: the probe runs, prints a rate and a denominator, and a
      deliberately malformed fixture turn is detected — an instrument never seen
      fire has unknown sensitivity.
- [ ] **2.3 Stop after one.** No second probe is built in this roadmap whatever
      2.2 finds.
      verify: the roadmap closes with one probe or none. A batch of probes is the
      roadmap-explosion failure this whole line of work exists to refuse.

## Phase 3 — Write down what cannot be dispositioned, and why

- [ ] **3.1 State the kernel exception as a list, not as a shrug.** Name the
      nine rules `check_enforcement_coverage` reports as `unclassified`, and for
      each say whether it would be `instruction-only` if the field could be
      written.
      verify: the list has nine entries and cites
      `block_kernel_rule_writes` as the reason the write is impossible, with the
      stub that owns the one live case.
- [ ] **3.2 Record the residual honestly.** Whatever remains undeclared after
      Phase 1 is stated as a number with a reason per rule.
      verify: the residual count plus the four bucket counts equals 82.

## Phase 4 — A gate, only if Phase 1 earned one

- [ ] **4.1 Ratchet the count, do not block a rule.** If and only if the
      residual from 3.2 is small enough to hold, register the `undeclared` count
      as a ratcheted metric so it cannot silently grow, with a `reportScanned`
      count and a `--self-test`.
      verify: the gate is green on the current tree and its canary — a newly
      added rule file carrying no declaration, enumerated with the
      others-listing form of `ls-files` — is reported, so a diff-scoped check is
      not silently blind. Coordinate with open PR #1682, which also edits
      `src/config/gate-coverage.yml`.

## Blockers

### blocker: is-a-declaration-worth-anything

- **Status:** open
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

- [ ] AC-1 — The 82 undeclared rules each carry exactly one bucket, the four
      bucket counts sum to the instrument's own `undeclared` reading taken on the
      same run, and every `already-carried` row names its carrier by file path.
- [ ] AC-2 — `check_enforcement_coverage`'s `undeclared` count is quoted before
      and after Phase 1, and the drop equals the size of the two buckets Phase 1.3
      addresses. No kernel rule appears in the diff.
- [ ] AC-3 — The probeable bucket is ranked with a cited measurement per rule
      that has one, and the rules with no measurement are the larger group —
      stated as counts, so the claim is falsifiable.
- [ ] AC-4 — At most one probe exists at the end of this roadmap, and it has been
      seen to fire on a deliberately malformed fixture.
- [ ] AC-5 — The nine kernel rules are listed with the reason the field cannot be
      written and the stub that owns the live case, and the residual undeclared
      count is stated with a per-rule reason.
- [ ] AC-6 — No new mechanism is proposed anywhere in this roadmap for an
      obligation whose bucket is `instruction-only-by-nature`. An unobservable
      obligation does not get a gate because it would be nice if it did.
