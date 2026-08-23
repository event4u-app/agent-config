---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
---
# Road to override efficacy proof

> **Source:** agents/tmp.old/40k — an external token-economy analysis pass.

## Goal

The override layer stops being a surface nobody has measured. When this is
finished, two independent things are true and both are checkable by someone who
did not write them: (1) a deterministic CI check proves that an override file
placed in the documented location is discovered, audited and named in a
generated precedence table, and a deliberately broken fixture makes that check
go red; (2) a published number says whether an override actually changes what
the agent does, measured on paired sessions against a bar written down before
the run. If the answer to (2) is "no measurable change", that number ships as
the finding — an override layer that costs prose and delivers nothing is a
product-critical fact, not a failed roadmap.

## Context / What is verified

Re-verified against the tree on 2026-08-22.

- **The layer is agent-resolved, not loader-resolved.** `src/scripts/lint_override_kernel_guard.ts:7`
  states it in-band: *"the override layer is resolved by the \*agent reading the
  instructions\*, not by a loader"*. The obligation on the agent side is the
  five-step check in `src/agent-src/contexts/override-system.md:170`
  (`## Agent Behavior`), plus the citation obligation at
  `src/agent-src/contexts/override-system.md:158`.
- **The one existing check is a report, not a gate.** Same file, line 15: *"So
  the default output is a REPORT."* Only two conditions hard-fail (line 18): a
  `Mode: replace` on a kernel / safety-floor rule, and an `extend` on one with
  no registry entry. Both were deliberate — `docs/decisions/ADR-127-enforcement-claims-must-resolve.md:132`
  records *"A build-failing kernel-override lint. Rejected as security theatre"*.
- **The only test tests the lint, never the effect.** `tests/scripts/lint_override_kernel_guard.test.ts`
  is 306 lines across eight `describe` blocks — `parse_mode`, `has_citation`,
  `registered_rules`, `is_kernel_rule`, `classify_violations`. Every one asserts
  the classifier's own output. None asserts that an override reached anything.
- **The whole population of real overrides is one file.**
  `agents/overrides/rules/verify-before-complete.md` (an `extend` that adds a
  mandatory Playwright step for UI changes), registered in
  `agents/overrides/kernel-exceptions.yml` under `exceptions[0]`. The remaining
  five directories under `agents/overrides/` hold a `.gitkeep` and nothing else:
  `commands/`, `guidelines/`, `skills/`, `templates/`, and `rules/` itself.
- **No behavioural efficacy test exists anywhere in the tree.** The audit's own
  honest limit says why one is needed: *"an `extend` block whose prose says
  'ignore everything above' passes this check. No linter reads intent."*
  (`src/scripts/lint_override_kernel_guard.ts:25-27`).

**This roadmap carries one blocker, and it is a spend decision.** Nothing here
waits on host access, on a maintainer-only capture, or on another roadmap. What
it does wait on is Step 2.3, which runs paired agent sessions — model calls that
bill real tokens — so the Phase 2 number cannot be produced without a budget
someone names. Phases 1 and 3 are unaffected: Phase 1 is a fixture and a test,
Phase 3 is a read-only report line, and Step 2.1's pre-registration is written
before any run and therefore before any spend. That split is why this is still a
good candidate to sequence early — two of its three phases are the highest
confidence-per-effort work available, and it unblocks nothing else, so the
unfunded half can be deferred without cost if a batch runs short.

## Phase 1 — Reachability: prove the override is delivered, discovered and named

Reachability here is a claim about **delivery**, not about behaviour. The
question Phase 1 answers is narrow and fully deterministic: does a file the
consumer places at the documented path survive into the tree the agent reads,
get discovered by the audit, and appear in a table a reviewer can read? Phase 2
is where "and does the agent then do anything differently" lives; conflating the
two is how a delivery check ends up being quoted as an efficacy claim.

- [ ] **1.1 Add a reachability fixture pair under `tests/fixtures/`.** One valid
      override (a non-kernel rule, `Mode: extend`, with the `> Overrides: …`
      citation line the contract requires) and one deliberately broken twin —
      same rule name, citation line removed. The broken twin exists so the test
      can be shown red on demand; a check never observed failing has unknown
      sensitivity.
      verify: `ls tests/fixtures/override-reachability/` lists exactly two `.md`
      files, and `grep -c '^> Overrides:' tests/fixtures/override-reachability/*.md`
      reports `1` for the valid one and `0` for the broken twin.

- [ ] **1.2 Add `tests/scripts/override_reachability.test.ts`.** It points the
      audit at the fixture directory and asserts three things about the row it
      gets back: the file is discovered at all, its `rule` field resolves to the
      rule it overrides, and `cited` is `true`. Then it repeats against the
      broken twin and asserts `cited` is `false` with a `missing-citation`
      violation. The JSON contract is already stable — the audit emits an
      `overrides` array whose rows carry `rule`, `file`, `mode`, `kernel`,
      `safety_floor`, `registered`, `cited`, `violations`.
      verify: `npx vitest run tests/scripts/override_reachability.test.ts`
      exits 0 with both cases green.

- [ ] **1.3 Prove the broken fixture actually reds the check.** Temporarily
      restore the missing citation line on the broken twin, re-run the test, and
      confirm it FAILS; then revert. Record the observed failure message in the
      test file as a comment so the next reader knows the assertion has been
      exercised rather than assumed.
      verify: the sensitivity run is recorded — `grep -n 'sensitivity' tests/scripts/override_reachability.test.ts`
      returns a comment naming the observed failure, and
      `npx vitest run tests/scripts/override_reachability.test.ts` is green on
      the reverted tree.

- [ ] **1.4 Generate the precedence table.** A committed, generated section
      listing every override in the tree: which rule it overrides, its mode,
      whether it is kernel / safety-floor, whether it is registered, whether it
      is cited. Today the answer exists only as JSON nobody runs. Regenerating
      it on an unchanged tree must produce no diff, so the table is a fact about
      the tree rather than a snapshot of when someone last looked.
      verify: regenerate, then `git diff --exit-code -- <the generated table
      path>` exits 0 on an unchanged tree.

- [ ] **1.5 Wire the reachability test into the gate ledger.** Registered under
      CI-identical argv so a local pass and a CI pass mean the same thing.
      verify: `grep -n 'override_reachability' .github/workflows/*.yml` returns
      the registration, and the run named there exits 0.

## Phase 2 — Efficacy: does an override change what the agent does

- [ ] **2.1 Write the pre-registration BEFORE any session runs.** A committed
      file naming, in advance: the task corpus, the two arms (override present /
      override absent, everything else byte-identical), the pair count, the
      observable that counts as "the override was honoured", and the pass bar.
      Pre-registration exists so the bar cannot move to meet the result. The
      package already publishes this shape — `docs/benchmark.md:15` opens with
      `## Honesty labels (read first)` for exactly this reason.
      verify: `git show HEAD:docs/benchmark.md | grep -c 'HONEST'` establishes
      the pre-state (the precedent already exists and this step adds to it, not
      invents it), and the new pre-registration file is committed before any
      run artefact exists.

- [ ] **2.2 Pick an observable the override makes falsifiable.** The one real
      override in the tree is a good subject precisely because its obligation is
      textual and checkable: `agents/overrides/rules/verify-before-complete.md`
      demands that a completion claim on a UI change NAME the mode tested, the
      URL fetched, the screens walked and the text assertions that passed. That
      is a string-level observable in the transcript, not a judgement call.
      verify: `grep -n 'The completion message must name' agents/overrides/rules/verify-before-complete.md`
      resolves, and the pre-registration cites that line as its observable.

- [~] **2.3 Run the paired sessions.** Both arms, same corpus, same host, same
      session shape. Record every pair, including the ones that produce nothing
      interesting — dropping uninteresting pairs is how a null becomes a
      positive.
      verify: the run artefact records a pair count equal to the pre-registered
      one, with no pair excluded post-hoc.

- [~] **2.4 Publish the number either way, with its honesty label.** A measured
      lift is a `PASS` row; no measurable difference is an `HONEST NULL` row and
      is equally publishable. `docs/benchmark.md` already carries at least eight
      `HONEST-NULL` / `HONEST NULL` sections, so the honest outcome has a
      shipped precedent and needs no new argument.
      verify: `grep -c 'HONEST' docs/benchmark.md` is strictly greater than its
      value at `git show HEAD:docs/benchmark.md | grep -c 'HONEST'` when the
      outcome is a null, and the new section carries a label from the existing
      vocabulary.

- [~] **2.5 Record what a null would mean, in the same commit as the null.** If
      the override changes nothing measurable, the finding is that the layer
      costs prose in `override-system.md`, a lint, a registry and a contract for
      no observed effect — a live input to whether the layer is worth its
      surface. Write that consequence down; do not leave a null sitting as a
      neutral fact.
      verify: the published section names the consequence explicitly, and
      `grep -n 'consequence' <the new benchmark section>` resolves.


      **DEFERRED `[~]` 2026-08-23 — steps 2.3, 2.4 and 2.5, by AI council (b),
      2 of 2 convergent.** Members anthropic/claude-sonnet-4-5,
      openai/codex-default; $0.033. **Spend was pre-authorized for the run**, so
      this is not a budget refusal — the deferral is on **population validity**:

      > A paired-session run against the single real override in the tree produces
      > a result about **that file**, not about override efficacy. Pre-authorized
      > spend makes it affordable; it does not make it generalizable.

      **The seats disagreed on one point and the disagreement sharpens the reopen
      condition, so it is recorded rather than smoothed.** One argued that going
      from one override to two *"changes the measurement class, not just
      precision"*. The other refused that: *"n=2 remains weak and may add little if
      the overrides are not **materially distinct**."* The reopen condition
      therefore says **materially distinct**, not merely *second*.

      The same seat named the honest alternative, which is a narrowing rather than
      a spend: an explicitly scoped **n=1 case study** could still falsify the
      mechanism or reveal instability — and that would be legitimate **only** if
      the registered claim is deliberately narrowed to single-override reliability
      or falsification, never presented as generalized efficacy.

      Phases 1 and 3 are unaffected and are the delivery this roadmap ships. Per
      the blocker's `Resolved when`, the Phase 3 report line must state that
      **efficacy is unmeasured** — a reachability check proves the override is
      delivered, discovered and named, and proves nothing about whether it changes
      what the agent does.
## Phase 3 — Surface it where a reader already looks

- [ ] **3.1 Add an override line to the doctor report.** The report already
      knows about `agents/overrides/` — `src/scripts/_cli/cmd_doctor.ts:832`
      tests for the directory as an install-mode marker. Extend it to say how
      many overrides exist, how many are kernel / safety-floor, how many are
      unregistered or uncited, and — once Phase 2 lands — link the published
      efficacy number.
      verify: `agent-config doctor` output contains an override line naming the
      counts, and on the current tree that line reads one override, kernel,
      registered, cited.

- [ ] **3.2 Keep the doctor line honest about what it does not know.** The line
      reports delivery and audit state. It must not read as a claim that the
      override was honoured — that is Phase 2's number and it belongs behind its
      own label.
      verify: the emitted line carries no honoured / applied / enforced
      vocabulary — `agent-config doctor 2>&1 | grep -iE 'override.*(enforced|applied|honoured|honored)'`
      returns nothing.

## Blockers

### blocker: b-paired-session-spend
- **Status:** resolved
- **Owner:** maintainer
- **Class:** 2 — consent-once (paired agent sessions bill real model tokens)
- **Blocks:** Phase 2 steps 2.3, 2.4 and 2.5. Step 2.1 is the pre-registration
  and Step 2.2 picks the observable; both are writing, not running, and proceed
  without spend — deliberately, because a pre-registration written after the
  budget conversation is a pre-registration written after someone has an
  expectation. Phases 1 and 3 are unaffected.
- **What to do:** pick exactly one — (a) name a budget for the paired run,
  sized against the pair count Step 2.1 pre-registers, and run it so the
  efficacy question gets an answer with an honesty label either way; or (b)
  defer the run, mark steps 2.3–2.5 deferred in the same change, and ship
  Phase 1 and Phase 3 on their own — the reader then gets a delivery claim that
  is explicitly labelled as delivery-only, with the efficacy question recorded
  as unmeasured rather than answered.
- **Recommendation:** **(b) — defer and label.** Phase 1 and Phase 3 already
  close the defect that a reachability check reads as an efficacy claim, which
  is the highest-value part of this roadmap and costs no tokens. The measurement
  is n=1 against the single real override in the tree, so buying it now buys a
  result about that one file; the spend is better placed once a second override
  exists to widen the population.
- **If you do nothing:** Phase 2 stalls with a pre-registration and no run,
  which is the worst of the three states — a committed bar, no number against
  it, and nothing in the tree saying the efficacy question was left open on
  purpose rather than forgotten.
- **Resolved when:** one of (a) or (b) is recorded at this blocker, and — for
  (b) — steps 2.3–2.5 are marked deferred and the Phase 3 report line states
  that efficacy is unmeasured.
- **Resolution 2026-08-23 — (b), AI council, 2 of 2 convergent.** Steps 2.3-2.5
  are `[~]` with the reasoning at 2.5. **Spend was pre-authorized and the
  deferral is still correct**: both seats concluded that pre-authorized budget is
  *"permission without reason"* and does not refute a population-validity
  objection. n=1 buys a result about one file.

  **The second half of `Resolved when` — the Phase 3 report line stating efficacy
  is unmeasured — is NOT discharged here**, because Phase 3 has not been built.
  Saying so is the point: the blocker is resolved as a *decision*, and the
  *delivery* obligation it names travels with Phase 3. A blocker marked resolved
  whose second clause was quietly dropped would be the silent-green this run is
  forbidden from reintroducing.

  **Reopen condition, sharpened by a recorded disagreement.** One seat held that
  1 → 2 overrides *"changes the measurement class"*; the other refused that —
  *"n=2 remains weak and may add little if the overrides are not materially
  distinct"*. The condition is therefore a **materially distinct** second
  override, or a claim deliberately narrowed to single-override reliability or
  falsification.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The reachability check is quoted as an efficacy claim | product | Phase 1 proves delivery only. A reader who sees a green check named "override reachability" can reasonably conclude the override works. That is the exact coverage-inflation defect ADR-127 exists to remove, reintroduced by a name. | The phase opens by drawing the line explicitly, and Step 3.2 forbids honoured / applied / enforced vocabulary on the reported line, with a grep that proves it. | Phase 1 — Reachability: prove the override is delivered, discovered and named |
| 2 | The efficacy bar moves to meet the result | implementation | A bar written after the run is not a bar. The pull is strongest when the first pairs look null and the corpus is still small enough to extend. | Step 2.1 commits the pre-registration before any run artefact exists, and Step 2.3 forbids post-hoc pair exclusion. The pair count is checkable against the pre-registered one. | Phase 2 — Efficacy: does an override change what the agent does |
| 3 | A null is filed and nothing follows from it | product | Publishing a null discharges the measurement obligation while leaving the real question — is this layer worth its surface — unasked. A null nobody acts on is indistinguishable from not measuring. | Step 2.5 requires the consequence to be written in the same commit as the null, so the finding cannot land as a neutral fact. | Phase 2 — Efficacy: does an override change what the agent does |
| 4 | The generated precedence table drifts silently | implementation | A table generated once and never regenerated is a snapshot with a fact's authority. The tree has one override today; the table stays trivially correct long after the generator stops matching reality. | Step 1.4 requires `git diff --exit-code` on regeneration, so drift surfaces as a red diff rather than as stale prose. | Phase 1 — Reachability: prove the override is delivered, discovered and named |
| 5 | The measurement population is one file | implementation | Every number this roadmap produces is measured against a single real override. A result from n=1 is a result about that override, not about the layer. | Phase 2's published section states the population size in-band. The claim is scoped to what was measured; generalising it is left as an explicit follow-up rather than assumed. | Phase 2 — Efficacy: does an override change what the agent does |

## Non-goals

- **Making the audit a build-failing gate on all overrides.** Rejected once
  already, with reasoning that still holds — `docs/decisions/ADR-127-enforcement-claims-must-resolve.md:132`.
  Failing the build on one route moves the override to a route with no
  visibility while the red X reads as coverage.
- **A byte-parity golden rig as the efficacy instrument.** Worth stating because
  the shape is available and looks apt: `tests/_lib/parity_oracle.ts` exists and
  is in active use across the suite, freezing a deterministic invocation into a
  committed snapshot and byte-comparing later runs against it. It is the wrong
  instrument here, and the reason is structural rather than a matter of taste —
  it proves that a deterministic producer still emits the same bytes. An
  override changes agent behaviour, which is not byte-deterministic and has no
  snapshot to compare against. Reaching for it would produce a green check over
  a question it never asked.
- **Blocking a consumer from writing an override.** The layer stays usable. This
  roadmap measures it; it does not police it.
- **Generalising the Phase 2 result to overrides the tree does not contain.**
  See Risk 5.

## Acceptance Criteria

- [ ] AC-1 — A reachability test exists, is registered in CI under the same argv
      CI runs, and is green; the broken fixture has been observed red and the
      observation is recorded in the test file.
- [ ] AC-2 — A generated precedence table is committed, and regenerating it on
      an unchanged tree produces no diff.
- [ ] AC-3 — A pre-registration file naming corpus, arms, pair count, observable
      and pass bar is committed, and its commit is strictly earlier than the
      first run artefact.
- [ ] AC-4 — An efficacy number is published in `docs/benchmark.md` under one of
      the existing honesty labels, with the pair count and the population size
      stated in-band. A null satisfies this criterion exactly as a positive does.
- [ ] AC-5 — When the published outcome is a null, the same commit states what
      follows from it for the layer's surface cost.
- [ ] AC-6 — `agent-config doctor` reports override delivery and audit state, and
      its line carries no vocabulary implying the override was honoured.
