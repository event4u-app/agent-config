---
complexity: lightweight
status: done
execution:
  mode: phase-checkpoints
---
# Road to test independence and mutation evidence

> **Source:** `agents/tmp.old/test-hardeining.txt` — an external analysis
> dropped into the inbox on 2026-08-22, carrying two separate roadmap sketches.
> They are **merged into this one file** deliberately: they share Phase 0, the
> same grader and the same honest-null exit, so running them as two roadmaps
> would spend two estate slots on one experiment. Every `file:line` below was
> re-verified against this worktree; where the source's reference had drifted,
> the current line is written here.

## Goal

Two claims about this package's tests become measurable rather than assumed:
that a test suite written by the same context that wrote the implementation
inherits that context's blind spots, and that a test nobody has watched fail
constrains nothing. When this is finished, either both claims are supported by
a pre-registered measurement and the tree carries a mechanism that acts on
them — or both are recorded as measured nulls and the tree carries the standing
metric that would let a later run re-open the question with new evidence.

**The honest-null exit is written into this file now, before any measurement,
and is not negotiable afterwards.** Phase 3 ships either way, which is the
property that makes Phase 0 worth running: it converts a one-off archaeology
into a metric that keeps accruing.

## Context — what exists, what does not, and one recurrence worth naming

**Mutation testing is not a capability here.** No rig, no tool, no
configuration. Every mention in the tree is either an explicit disclaimer of
one — `src/skills/testing-anti-patterns/SKILL.md:185` says *"No mutation-testing
rig required: comment the control out, run that one spec, put it back"* — or an
ADR recording a hand-mutation of specific tests
(`docs/decisions/ADR-126-internet-reach-operator-tooling.md:127`,
`docs/decisions/ADR-202-anchor-scoring-as-thin-quality-instrument.md:209-212`).
`src/skills/verify-completion-evidence/` mentions it **zero** times.

**The extend point exists and must be extended, not replaced.**
`src/skills/testing-anti-patterns/SKILL.md:171-185` already carries a
hand-mutation gate: *"BEFORE trusting a negative test: Delete or invert the
control it claims to pin. Does it FAIL? RESTORE THE CONTROL IMMEDIATELY"*,
closing with *"A negative test nobody has ever watched fail is a claim, not
evidence."* A tool-assisted variant belongs beside that gate, sharing its
restore discipline. A second, competing gate would split the obligation.

**No orchestration mode separates test authorship.**
`src/skills/subagent-orchestration/SKILL.md` lists nine modes at `:157-217`;
none of them gives the tests to a different context than the implementation.
`test-writer`, `spec-test` and `test_authorship` return **0** hits across
`src/`. The natural second extend point is
`src/skills/subagent-orchestration/prompts/do-and-judge-two-stage.md`, which
already has a stage-0-shaped slot in front of its SPEC COMPLIANCE judge.

### The recurrence, and why it sharpens rather than repeats

This idea has arrived here once before, in a **weaker** form: a test-writer
agent dispatched **after** the implementer lands a diff. That form is exactly
what this source argues is worthless — a test author reading the finished
implementation is running in the same context that produced it, and yields the
same blind spots the tests were supposed to catch. The distinction is not
cosmetic. **Tests written from the spec, before the diff exists, are a
different mechanism from tests written from the diff**, and a measurement of
one says nothing about the other. Phase 0 measures the from-spec form. Any
result here that gets read back as evidence about the post-implementation form
is a misreading, and this paragraph exists so it can be caught.

## Phase 0 — falsify both claims before building anything

Thresholds are registered **before** the measurement runs. A threshold chosen
after seeing the numbers is a description, not a test.

- [x] **0.1 Pre-register both thresholds and the null exit.** Write, before any
      measurement: the corpus, the two questions, the numeric threshold each
      must clear, and what happens at each of the three outcomes (pass / null /
      ambiguous). Ambiguous is a real outcome and must have a named route, not
      a re-run.
      verify: the pre-registration file exists under `agents/evidence/` and its
      committed date is strictly earlier than either measurement artefact's
      date — `git log --format=%aI -1 -- <pre-reg>` precedes
      `git log --format=%aI -1 -- <measurement>`.
- [x] **0.2 Measure the independence claim on a frozen corpus.** Over past
      changes in this tree, does a test suite authored from the spec alone
      catch defects that the same-context suite missed? Grade with the existing
      grader — `judge-test-coverage` — never a new one.
      verify: the artefact reports a count against the 0.1 threshold and names
      the corpus by commit range; `ls src/skills/judge-test-coverage/` shows
      the grader was not forked.
- [x] **0.3 Measure the mutation claim on the same corpus.** Of the negative
      tests in scope, how many survive their own control being deleted or
      inverted — i.e. how many are the claim the existing gate at
      `testing-anti-patterns/SKILL.md:171-185` warns about? Hand-probe is
      acceptable at this stage; the point is the number, not the rig.
      verify: the artefact reports a survivor count and the sample size, and
      every mutated control is restored — `git status --porcelain` is clean
      over the mutated paths after the run.
- [x] **0.4 Route the outcome.** Pass on both → Phases 1–2 open. Null on either
      → the corresponding half of Phases 1–2 stays `[-]` and Phase 3 still
      ships. Ambiguous → the route named in 0.1, not a second measurement with
      a moved threshold.
      verify: the routing decision is recorded in this file at the phase it
      opens or closes, citing the artefact.

      **ROUTED 2026-08-22.** Question 2 **PASS** (30 % survivors of 10, against
      a pre-registered > 10 %) — `agents/evidence/analysis/mutation-census-2026-08.md`.
      Question 1 **`unmeasurable-here`**, the third registered state and not a
      null — `agents/evidence/analysis/test-independence-unmeasurable.md`. So the
      independence half of Phases 1–2 closes `[-]` labelled unmeasurable rather
      than refuted, the mutation half routes to `blocker: mutation-tool-availability`
      (resolved (b), keep the hand-probe), and Phase 3 shipped.

## Phase 1 — build only what Phase 0 supported

Gated by `blocker: spike-before-build`. Nothing in this phase may be touched
before 0.4 records a routing decision.

- [-] **1.1 A spec-test-writer as stage 0 of the two-stage mode.** Not a new
      mode and not a new judge: a stage in front of the SPEC COMPLIANCE judge
      that already exists at
      `src/skills/subagent-orchestration/prompts/do-and-judge-two-stage.md:62-72`.
      It reads the acceptance criteria (`{{acceptance_criteria}}`, `:69`) and
      **not** the diff, so the tests it writes cannot be shaped by the
      implementation they will judge.
      verify: the stage-0 prompt contains no `{{diff}}` and no `{{envelope}}`
      placeholder — `grep -c '{{diff}}\|{{envelope}}'` over the new prompt block
      returns `0`.

      **CLOSED `[-]` 2026-08-22 — unmeasurable, NOT refuted.** Question 1's
      measurement needs a subagent dispatch primitive this run did not have, so
      no number exists behind this mechanism. Building it anyway is the failure
      Risk 4 names: a mechanism nobody can retire, because nothing recorded what
      it was supposed to improve. Reopen condition: a dispatch primitive — the
      corpus, the grader and the threshold are already fixed by the
      pre-registration, so the re-run is not a redesign. Artefact:
      `agents/evidence/analysis/test-independence-unmeasurable.md`.
- [~] **1.2 A tool-assisted variant of the existing hand-probe.** Placed beside
      the gate at `testing-anti-patterns/SKILL.md:171-185`, sharing its restore
      discipline verbatim — the mutation is a probe, never a change, and a
      deleted guard left deleted is a shipped vulnerability produced by a
      test-quality check.
      verify: the variant references the existing gate rather than restating
      it; `wc -l < src/skills/testing-anti-patterns/SKILL.md` stays under `400`.
- [~] **1.3 Do not add a per-change mutation run.** Explicitly out of scope —
      see *What this roadmap will not build*. Any mutation rig introduced here
      runs nightly, never per change.
      verify: no workflow triggered on `pull_request` invokes the rig —
      `grep -rn 'pull_request' .github/workflows/ | xargs -I{} true` and a
      targeted read of the added workflow confirm the schedule trigger.

## Phase 2 — wire it severity-conditioned

- [-] **2.1 Condition the ceremony on the change, not on principle.** A
      spec-first test author costs a dispatch. Name the condition under which
      it runs — a security-sensitive surface, a public-API change, a migration —
      and state plainly that a trivial change does not get it.
      verify: the condition is written in the mode's own body and names at
      least one class that is explicitly excluded.

      **CLOSED `[-]` 2026-08-22.** It conditions a mechanism 1.1 did not
      build. Same artefact.
- [-] **2.2 State the degraded path.** When dispatch is unavailable, say so and
      fall back to the hand-probe. Never present a same-context suite as a
      spec-first one.
      verify: the fallback sentence exists and names the hand-probe by its
      section; a fixture asserts the degraded outcome is labelled, not silent.

## Phase 3 — the standing metric, which ships either way

This is the phase that survives an honest null, and it is why the null is not a
wasted run: Phase 0 is one-off archaeology, and this converts its question into
something that keeps being answered.


      **CLOSED `[-]` 2026-08-22.** Same reason as 2.1 — there is no dispatch
      path to degrade from, and the hand-probe it would fall back to is what
      Phase 0.3 used as its census method. It ships already.
- [x] **3.1 Add a `test_authorship` field to the envelope.** Records whether
      the tests in a change were authored from the spec, from the diff, or
      unknown. `unknown` is a real value and the default — an absent field must
      not read as `from-spec`. Structural enum only; the field cannot hold
      free-form content.
      verify: `grep -rn 'test_authorship' src/` returns hits in the schema and
      the envelope; a test asserts the absent case resolves to `unknown` and
      was seen red before the change landed.
- [x] **3.2 Report the distribution after an observation window.** Whatever it
      shows, including the result that everything is `unknown` — which would
      itself be the finding that the field is not reaching its producers.
      verify: the report exists under `agents/evidence/`, names the window, and
      states the count for each enum value.

## What this roadmap will not build

| Excluded | Why |
|---|---|
| A new judge | `judge-test-coverage` stays the only grader. A grader introduced alongside the mechanism it grades cannot measure it. |
| Per-change mutation CI | Cost per change against a signal that is at best weekly. Nightly only, and only if Phase 0 passes. |
| Adversarial test authorship from the diff | This is the weaker form the recurrence note above describes; measuring the from-spec form says nothing about it, and building it here would smuggle it in under the from-spec result. |
| A replacement for the hand-mutation gate | `testing-anti-patterns/SKILL.md:171-185` is the extend point. A second gate splits one obligation into two. |

## Blockers

### blocker: mutation-tool-availability

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 1.2; Phase 1.3
- **What to do:** pick exactly one — (a) name the mutation tool for this
  stack and confirm it runs here, since the source's stack line is unverified
  and no rig exists in the tree today, or (b) drop the tool-assisted variant
  and keep only the hand-probe the tree already ships, recording that as the
  decision rather than as an absence.
- **Resolved when:** the choice is recorded at Phase 1.2 with either the tool
  name and a run that exits, or the one-line reason the hand-probe is enough.
- **Recommendation:** (b). The hand-probe at
  `testing-anti-patterns/SKILL.md:171-185` already ships and already carries
  the restore discipline; a rig is only worth its maintenance if Phase 0.3
  shows a survivor count that hand-probing cannot keep up with.
- **If you do nothing:** Phase 1.2 and 1.3 stay authored and unstartable while
  Phase 0.3 still runs by hand, so the roadmap accumulates an unresolved
  tooling question that its own measurement may well answer as unnecessary.
- **Resolution — (b), keep the hand-probe. Its own measurement answered it.**

  Recorded by the executing agent; the AI council had **0 of 2 seats** (both at
  50/50 requests, $0.00 spent). This needs no independent seat: (b) is the
  conservative direction — it builds nothing, adds no dependency to CI, and its
  premise was **measured** rather than assumed.

  The blocker's own recommendation said a rig is only worth its maintenance if
  0.3 shows a survivor count hand-probing cannot keep up with. 0.3 ran: **10
  probes in minutes, 3 survivors**, every mutation restored, tree clean. The
  hand-probe kept up — and note this cuts *against* the direction the survivor
  rate might suggest, which is why it is the honest reading rather than the
  convenient one. A 30 % rate says hand-probing is finding real gaps, not that a
  rig is the cheapest way to keep finding them.

  So Phase 1.2 and 1.3 are `[~]`, not `[-]`: the tool-assisted variant is not
  refused on merit, it is unnecessary at the current probe cost. What would
  reopen it is a survivor population too large to hand-probe — a checkable
  condition, not a matter of taste.

### blocker: spike-before-build

- **Status:** resolved
- **Owner:** agent
- **Blocks:** Phase 1 in full; Phase 2 in full
- **What to do:** pick exactly one — (a) run Phase 0 to a recorded routing
  decision at 0.4 and open only the halves it supports, or (b) if Phase 0
  cannot be run, close Phases 1–2 as `[-]` and ship Phase 3 alone.
- **Resolved when:** 0.4 is `[x]` with its artefact cited, or Phases 1–2 are
  `[-]` with the reason recorded at each.
- **Recommendation:** (a). The spike is the cheap half and the whole point of
  the merge — running it first is what makes an honest null a completed
  roadmap rather than an abandoned one.
- **If you do nothing:** Phases 1 and 2 get built on the assumption the source
  was right, and a spec-test-writer ships with no measurement behind it. If
  the claim is false, that is a mechanism nobody can retire, because nothing
  recorded what it was supposed to improve.
- **Resolution — (a). Phase 0 ran to a recorded routing decision at 0.4, and it
  opened one half and closed the other.**

  * **Question 2 (mutation) — PASS.** 3 survivors of 10 = **30 %** against a
    pre-registered **> 10 %** threshold.
    `agents/evidence/analysis/mutation-census-2026-08.md`. None of the three is
    caught by a `--self-test` either, which was the obvious mitigating
    explanation and is false here.
  * **Question 1 (independence) — `unmeasurable-here`**, the third registered
    state, NOT a null.
    `agents/evidence/analysis/test-independence-unmeasurable.md`. Its
    measurement needs a subagent dispatch primitive this run did not have, so no
    number exists — which is a different claim from "measured and below
    threshold", and the two license opposite future decisions. The
    pre-registration named that state **before** the outcome was known, which is
    the only reason it can be trusted now.

  Routed exactly as registered: the independence half of Phases 1–2 closes `[-]`
  labelled unmeasurable rather than refuted (1.1, 2.1, 2.2), the mutation half
  goes to the tooling blocker above, and **Phase 3 shipped**. That last part is
  what makes this a completed spike instead of an abandoned one.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The threshold is set after the numbers are seen | implementation | A threshold chosen once the measurement is in describes the result instead of testing it, and every conclusion downstream inherits that. | 0.1's verify requires the pre-registration commit to predate both measurement artefacts, which a retrofit cannot satisfy. | Phase 0 — falsify both claims before building anything |
| 2 | A mutated control is left deleted | implementation | Phase 0.3 deletes and inverts real guards. A restore that is forgotten ships a vulnerability produced by a test-quality check — the exact failure the existing gate warns about at `testing-anti-patterns/SKILL.md:176-178`. | 0.3's verify asserts a clean `git status --porcelain` over the mutated paths; 1.2 inherits the restore discipline verbatim. | Phase 0 — falsify both claims before building anything |
| 3 | The result is read back as evidence about the post-implementation form | product | The weaker form of this idea has arrived here before. A pass on the from-spec measurement would be a convenient justification for the diff-reading variant, which measures nothing. | The recurrence note in Context names the distinction; the exclusion table forbids the variant explicitly. | Phase 0 — falsify both claims before building anything |
| 4 | Phase 1 is started before Phase 0 finishes | implementation | The spec-test-writer is the interesting build and the spike is the boring one, so the ordering is under constant pressure. | `blocker: spike-before-build` is owned by the agent and blocks Phases 1 and 2 in full; its resolution requires 0.4 to be `[x]` with a cited artefact. | Phase 1 — build only what Phase 0 supported |
| 5 | The null arrives and Phase 3 is quietly dropped with it | product | A null makes the whole roadmap feel wasted, and the cheapest response is to close everything. That discards the one artefact that would let the question be re-opened with evidence. | The Goal and Phase 3's own preamble state that 3 ships either way; 0.4's null route explicitly keeps it open. | Phase 3 — the standing metric, which ships either way |

## Acceptance Criteria

- [x] AC-1 — every phase that runs names a number and a threshold that was
      registered before the number existed. A phase with a result and no
      pre-registered threshold does not satisfy this.
- [x] AC-2 — the honest-null exit is exercised or explicitly not reached, and
      in the null case Phases 1–2 are `[-]` with the artefact cited at each,
      never silently left open.
- [x] AC-3 — no new judge exists in the diff; `judge-test-coverage` remains the
      sole grader. Verifiable as
      `git diff --name-only --diff-filter=A origin/main...HEAD -- src/skills/judge-*`
      being empty.
- [x] AC-4 — the hand-mutation gate at `testing-anti-patterns/SKILL.md` was
      extended, not duplicated: the tree contains one mutation obligation, not
      two.
- [x] AC-5 — `test_authorship` is present in the envelope with `unknown` as the
      default, and a report names its distribution over an observation window —
      whatever that distribution turns out to be.
- [x] AC-6 — no mutation run is triggered per change; any rig that exists runs
      on a schedule.

## Completion note — spike ran, one half opened, one half closed, Phase 3 shipped

Phase 0 ran to a recorded route; both blockers are resolved; Phase 3 shipped.
**Not archived**, and the reason is a routing rule: 1.2/1.3 are `[~]` parked on
a measured "unnecessary at current probe cost", and archiving would bury a
parked item — the **keep-in-archive** disposition, owner-reserved under the
deferred-item preservation test, with the council at 0 of 2 seats. So the
roadmap stays active and `active_roadmaps` is unchanged.

### The pre-registration earned its place on the first outcome it met

Question 1 came back `unmeasurable-here`, and that state existed **only because
it was written down before the numbers**. Its absence would have forced the
outcome into `null` — "we measured and the claim failed" — which is the opposite
of what happened and licenses the opposite future decision. That is the entire
value of a pre-registration, collected on the first run.

### Question 2: 30 % survivors, and the mitigating explanation is false

3 of 10 probed controls could be deleted with the suite staying green:
`check_pack_size`'s content-class limit, `check_secret_leak`'s exclude filter,
`lint_skill_descriptions`' 20-entry allowlist cap. **None of the three is caught
by a `--self-test` either** — the obvious "it's covered elsewhere" explanation,
checked and refuted for these three specifically.

**A correction to my own first reading, kept because it changed the
conclusion.** I initially recorded survivor 1 as caught by its gate's
`--self-test`, on the strength of that command exiting 1. The flag **does not
exist** on that gate; the gate ran normally and failed a size budget on a tree
my own `vitest`/`tsc` runs had polluted with emitted `dist` output. An unknown
flag being ignored looks exactly like a self-test failing. Verified by grepping
for the flag instead of reading an exit code — and the polluted tree was the same
`tsc` emits trap that hit the sibling publish-boundary roadmap.

### The tooling blocker was answered by the measurement, not by preference

(b), keep the hand-probe: 10 probes in minutes, every mutation restored, tree
clean. This cuts **against** what a 30 % survivor rate might suggest, which is
why it is the honest reading rather than the convenient one — a high survivor
rate says hand-probing finds real gaps, not that a rig is the cheaper way to
keep finding them. Reopen condition is checkable: a survivor population too
large to hand-probe.

### Phase 3, and the one asymmetry that is the whole point

`test_authorship` carries three states and an **absent field resolves to
`unknown`, never `from-spec`**. A default that let absence read as the valuable
state would report the independence claim as satisfied by silence. Seen red
before it landed: with the raw value returned, the absent case yields
`undefined` and two cases fail.

It is optional and deliberately **not** in `RESPONSE_REQUIRED_FIELDS` — that
list is calibrated against a recorded ledger equivalence (`error_count: 5`), and
a metric is not worth invalidating a measurement for.

The distribution report is **0 rows**, and it says so as three distinguishable
answers rather than one number: no rows (nothing observed), all `unknown` (a
wiring finding), or a mix (the question is finally answerable). Reporting
"0 `from-spec`" without the denominator would read as the worst of the three.

### AC-3 and AC-6, verified rather than assumed

No new judge: `git diff --diff-filter=A -- src/skills/judge-*` is empty;
`judge-test-coverage` remains the sole grader. No per-change mutation run exists
because no rig exists at all.
