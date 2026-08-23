---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
---
# Road to terminal token economy

> **Source:** `agents/tmp.old/40k` — an external token-economy analysis pass,
> re-verified against this tree on 2026-08-22.

## Goal

The terminal-output lever — wrapping verbose CLI commands so their output costs
fewer tokens — rests on a probed host contract instead of an in-tree assertion,
runs on exactly one chosen mechanism with the rejected alternatives written down,
and carries a benchmark number that was pre-registered before it was measured.
When this is finished, the shipped documentation states a figure someone can
reproduce, including if that figure turns out to be a null.

## Context

The mechanism exists and is deliberately weak. `src/scripts/hooks/rtk_wrap_hook.ts`
is a PreToolUse nudge that is **default-OFF** (`hooks.rtk_wrap.enabled: false` at
`src/config/agent-settings.template.yml:1264`, verified), **warn-only**, and
**never blocks**. It is bound on the `pre_tool_use` slot in
`src/scripts/hook_manifest.yaml:190` and appears in two platform rows
(`:952`, `:960`).

Its header states the reason it can only warn, and that sentence is the whole
subject of Phase 1:

> *"It NEVER blocks (the v1 dispatcher contract is allow/block/warn — there is
> no transparent `updatedInput` rewrite …)"* — `rtk_wrap_hook.ts:13-15`,
> restated at `:190`.

**That is a tree-side assertion about a host contract, and nothing in this tree
records it ever being re-probed.** It is exactly the class of claim this
repository has already had to overturn: the `pre_tool_use` host-capability
statements in `src/rules/evaluator-independence.md` were **"Corrected
2026-08-17 — this paragraph was wrong on both sides of the line it drew"**
(`evaluator-independence.md:104`), and the corrected four-state table now lives
at `docs/contracts/hook-architecture-v1.md:370`. Both halves of that correction
were unbacked host-capability claims: one over-claimed enforcement, one
under-claimed reachability. An assertion of the same shape sits unexamined at
the head of this hook.

The consequence is concrete. If a transparent input rewrite *does* exist, the
lever is a rewrite and the nudge is the wrong mechanism entirely; if it does
not, the warn-only nudge is correct and the roadmap's remaining work is
documentation and measurement. **Nothing after Phase 1 can be scoped until that
is known**, which is why Phase 1 probes and builds nothing.

Two further verified facts shape the later phases:

- **A second branch already exists.** `OUTPUT_CAP_TABLE` at
  `rtk_wrap_hook.ts:211` covers commands the wrapper cannot handle — currently
  `grep` and `rg` — by warning with a bounded alternative rather than rewriting.
  Any mechanism chosen in Phase 2 has to say what happens to this branch.
- **The shipped benchmark number is stale and narrow.** The skill states
  *"33% overall, 0-57% per command"* from a *"2026-07-28, one repo, one macOS
  machine, 8-command corpus"* (`src/skills/rtk-output-filtering/SKILL.md:33-34`,
  raw data at `internal/bench/rtk-savings/RESULTS.md`). It is honestly scoped
  where it is written, which is the good half; it is also nearly a month old, on
  one machine, against a corpus of eight, and it is the number a reader takes
  away.
- **Name-collision detection is already solved.** `src/install/rtkDetection.ts`
  runs a two-stage probe — PATH presence, then an identity check on the
  `gain` subcommand's output — because the bare binary name is shared with an
  unrelated tool that has no such subcommand. No phase here needs to re-solve it.

## Phase 1 — probe the host rewrite contract, and pin what you probed

Build nothing in this phase. Its only output is a dated, versioned answer.

- [x] **1.1 Probe whether the current host dispatcher offers a transparent input
      rewrite.** The header's claim is `allow/block/warn` with no `updatedInput`.
      Establish whether that is still true against the host build in front of
      you, and record the probe method — not a recollection, an observation.
      verify (discharged): the finding is written under `agents/evidence/analysis/` and quotes the pre-state, which is `git show HEAD:src/scripts/hooks/rtk_wrap_hook.ts | grep -c "updatedInput"` = 2 (the two assertions at `:15` and `:190`). **Pre-state confirmed = 2.**

      **THE PROBE REFUTED THE SHIPPED CLAIM.**
      `agents/evidence/analysis/host-input-rewrite-probe-2026-08-23.md`. Method: field-name
      and context extraction from the shipped host binary — an observation, not a
      recollection. Claude Code **2.1.241** documents, in its own strings:

      > `` - `updatedInput` - Modified tool input (PreToolUse only) ``
      > `Expected {behavior: 'allow', updatedInput?: object} or {behavior: 'deny', message: string}.`
      > `… returned updatedInput that failed schema validation:`
      > `… : updatedInput is missing or empty, falling back to original tool input`

      A documented field, a documented shape, **schema validation** on the value and a
      **documented fallback**. A host that validates a field's schema and logs a fallback
      for it implements the field. So *"there is no transparent `updatedInput` rewrite"* is
      **false for this build**.

      **The half that survives, and it is the useful one:** this dispatcher does not emit
      it. `host_semantics.ts:107-117` builds exactly one envelope shape
      (`hookSpecificOutput: { hookEventName, additionalContext }`) and nothing under
      `src/scripts/hooks/` constructs an `updatedInput` or a `permissionDecision`. The
      shipped claim collapsed a fact about our plumbing into a claim about the host, and
      only the first half was true.

      A count alone would have been weak evidence — the file also records that, and quotes
      the context rather than resting on `grep -c` = 86.
- [x] **1.2 Pin the answer to a named host build and a date.** An unpinned
      capability claim rots exactly the way the one being replaced did. The
      finding names the host, its version, and the date, so a later reader can
      tell whether it still describes anything.
      verify (discharged): `grep -cE "20[0-9]{2}-[0-9]{2}-[0-9]{2}" <the finding>` is non-zero and a host build identifier appears in the same paragraph as the verdict. **Both: the finding carries a pinned table (host, version 2.1.241, probed 2026-08-23, platform) and the verdict sentence names 2.1.241 inline.**

      The pin is the substance rather than bookkeeping: a later reader compares their own
      `claude --version` against 2.1.241 and knows whether the paragraph still describes
      anything. The claim being replaced had no date, which is why nobody could tell it had
      gone stale — or, as it turned out, that it was wrong.
- [x] **1.3 Amend or confirm the header comment in the same change.** Whatever
      1.1 finds, `rtk_wrap_hook.ts:13-15` and `:190` either gain a re-probed date
      or gain the correction. A header that asserts a host contract with no
      date is the defect, independent of whether the assertion is true.
      verify (discharged): `grep -n "re-probed\|dispatcher contract" src/scripts/hooks/rtk_wrap_hook.ts` shows the dated form; `npx vitest run tests/scripts/hooks/rtk_wrap_hook.test.ts 2>&1 | tail -3` still passes. **Dated form present at `:17`; 21/21 tests green.**

      Both sites corrected — the header at `:13-15` and the cap-advisory comment at `:190` —
      and **a third the step did not name**:
      `src/config/hook-token-budget.json:90` carried the same false cause (*"no updatedInput
      in the v1 contract"*). A defect found in one place is presumed to recur until searched;
      `grep -rn 'updatedInput' src/` found exactly three sites and all three are corrected.

      The correction keeps the **outcome** and replaces the **cause**: the hook still only
      warns, and now says why it does — no emitter and no composition policy — rather than
      asserting a host limitation that does not exist.
- [x] **1.4 Route the answer into the hook-architecture contract.** The four-state
      host table at `docs/contracts/hook-architecture-v1.md:370` is where
      per-host capability facts live in this tree. A rewrite-capability finding
      belongs beside it, not only in a hook header.
      verify (discharged): `grep -n "rewrite" docs/contracts/hook-architecture-v1.md` returns the new entry. **Returns `:401` and following.**

      Added as a **fifth capability** section beside the four-state `pre_tool_use` table,
      which is where per-host capability facts live. It records the host as *offered at
      2.1.241* and every other host as **unprobed** — *"absence of a claim, not a claim of
      absence"* — because that table's own header warns twice that collapsing its states
      produces false claims, and inventing a rewrite verdict for seven unprobed hosts would
      be the same mistake in a new column.

## Phase 2 — choose ONE wrapper mechanism, and record the two you rejected

- [x] **2.1 Enumerate the candidate mechanisms against Phase 1's answer.** At
      least three are on the table and they are not interchangeable: a
      transparent input rewrite (only if 1.1 found one), the existing warn-only
      nudge, and the bounded-alternative branch that `OUTPUT_CAP_TABLE` already
      implements for commands the wrapper cannot take. Write them out with what
      each costs and what each cannot do.
      verify (discharged): `grep -n "OUTPUT_CAP_TABLE" src/scripts/hooks/rtk_wrap_hook.ts` resolves to `:211` and the enumeration cites it as the existing second branch. **Resolves at `:211`; cited.**

      `agents/evidence/analysis/rtk-wrapper-mechanism-decision.md` enumerates all three with
      what each costs and what each **cannot do** — the second column is the one that made
      the decision, and Phase 1 is why it could be written honestly: the rewrite had to be
      weighed on its real costs rather than dismissed on a premise that turned out false.
- [x] **2.2 Pick one and record the rejections with reasons.** One mechanism
      ships. The other two are written down as rejected-with-reason in the same
      note — a rejected alternative with no reason attached is re-proposed within
      the quarter, which is the pattern this tree keeps a decision-record
      discipline for.
      verify (discharged): the note names exactly one chosen mechanism and gives a reason per rejected one; `grep -ci "rejected" <the note>` is at least 2.

      **CHOSEN: (b), the warn-only nudge.** AI council 2026-08-23, 2/2 quorum (anthropic/claude-sonnet-4-5 + openai/codex-default), convergent.

      **Rejected — (a) the transparent rewrite**, and the *reason* is the part that matters:
      **not** "the host cannot", which Phase 1 refuted, but two real costs. First, **no
      composition rule exists** — the dispatcher reduces many concerns per event to one exit
      code, and precedence, conflict detection and failure semantics for two concerns
      rewriting the same input are undecided; that is design work with a safety surface, not
      wiring. Second, a default-OFF hook that **silently changes what the agent runs** is a
      materially different safety posture from one that warns. One seat put it in a sentence
      worth keeping: *"A host capability is not yet a safe dispatcher capability."*

      **Rejected as a sole mechanism — (c) the cap table**, because it covers only the
      commands the wrapper *cannot* take; choosing it alone leaves every wrappable command
      unaddressed. It is retained rather than discarded — see 2.3.

      **Rejected-for-now, not rejected permanently.** Both seats flagged that *"merely
      rejecting rewrite risks turning a temporary design gap into permanent inertia"*, so the
      note names the reopening condition: an accepted composition policy for per-concern
      input rewrite in this dispatcher. And one seat's correction is adopted verbatim rather
      than paraphrased — the unavailable capability must be labelled accurately:
      `updatedInput` **is** available; what is absent is a safe composition policy here.
- [x] **2.3 State what happens to the second branch under the chosen mechanism.**
      `grep` and `rg` are covered today by a warn naming a bounded alternative.
      If the chosen mechanism supersedes that, say so; if it coexists, say how
      the two decide which fires.
      verify (discharged): the decision is written and, if code changed, `npx vitest run tests/scripts/hooks/rtk_wrap_hook.test.ts 2>&1 | tail -3` and `./scripts-run src/scripts/lint_hook_manifest 2>&1 | tail -3` both exit green.

      **They coexist, and there is no precedence question to answer** — the split is by
      command and the two sets are **disjoint by construction**: membership in
      `OUTPUT_CAP_TABLE` is precisely the record that the wrapper has no form for that
      command. So the chosen mechanism supersedes nothing.

      **No code changed for this step**, which is the honest outcome for a decision that
      ratified what already ships. The hook's behaviour is untouched; only the *reason*
      recorded in its header changed (1.3).
- [x] **2.4 Leave default-OFF alone unless Phase 3 earns the flip.** The setting
      ships `false` and a default flip is a change to what every consumer session
      does. It is not part of choosing a mechanism.
      verify (discharged): `grep -n -A1 "^  rtk_wrap:" src/config/agent-settings.template.yml` still shows `enabled: false`. **Confirmed at `:1263-1264`.**

      Untouched, and deliberately: choosing a mechanism is not flipping a default, and a
      flip changes what every consumer session does. Phase 3 would have to earn it, and
      Phase 3's run is deferred — so nothing in this change comes close to earning it.

## Phase 3 — pre-register the re-bench, then publish it including a null

The ordering is the whole point. A benchmark whose success bar is written after
the numbers arrive is not a benchmark.

- [x] **3.1 Register the bench design before running anything.** Corpus size and
      composition, machines, commands, the metric, and the bars — both the
      success bar and the kill bar — written down and dated ahead of the first
      run. Explicitly widen past the existing shape: one repo, one machine,
      eight commands is what the current figure rests on.
      verify (discharged): the registration file exists under `agents/evidence/analysis/` with a date preceding any results file, and `git log --diff-filter=A --format=%ad -1 -- <registration>` precedes the results file's add date. **No results file exists, so the ordering holds trivially and verifiably.**

      `agents/evidence/analysis/rtk-rebench-registration.md`. Widened on all three axes the
      current figure is narrow on: **>= 3 repositories · >= 2 machines · >= 20 commands**.

      The **command composition is fixed in advance** — 8 verbose, 6 already-compact, 6
      mixed — and that is the step's real content rather than a detail. The existing
      figure's own breakdown shows why: verbose commands save ~55 % and already-compact
      output passes through at ~0 %, so the headline is a function of the mix, and a corpus
      reweighted toward verbose would raise the number without measuring anything new.

      Bars in both directions: **success** median per-command saving >= 30 % · **kill**
      <= 10 % · **inconclusive** in between, reported as such and **not rounded toward
      either**. 30 % is chosen as "the existing 33 % survives widening" rather than pulled
      from nothing; 10 % is where the wrapper's startup and the advisory's cognitive cost
      stop being obviously repaid.

      It also states what the run does **not** measure: compliance. A 55 % compression on a
      command nobody re-runs wrapped saves nothing, and that is the acknowledged limit of
      the mechanism Phase 2 chose.
- [-] **3.2 Run it and publish the number, whatever it is.** A result at or near
      zero is a publishable outcome and closes the lever honestly. A result that
      misses the pre-registered bar closes it the same way.
      verify: the results file cites the registration by path and reports the metric against the pre-registered bars, naming any bar it missed.
- [-] **3.3 Correct the shipped documentation to whatever 3.2 measured.** The
      skill currently carries the 2026-07-28 figure. Replace it with the new one
      and its scope, or — if 3.2 produced a null — replace it with the null and
      the scope, keeping the honest-scoping style the current text already has.
      verify: `grep -n "2026-07-28" src/skills/rtk-output-filtering/SKILL.md` no longer returns the stale figure as the headline; the pre-state is `git show HEAD:src/skills/rtk-output-filtering/SKILL.md | grep -c "2026-07-28"` = 1.
- [-] **3.4 Reconcile the upstream-reported range against this tree's own.** The
      skill quotes an upstream 60–90 % range next to a measured 33 %. Whatever
      3.2 produces, state the relationship between the two rather than letting a
      reader pick the flattering one.
      verify: the skill text names both figures with their sources, and `./scripts-run src/scripts/skill_linter src/skills/rtk-output-filtering 2>&1 | tail -3` exits green.


      **DEFERRED `[~]` 2026-08-23 — steps 3.2, 3.3 and 3.4, by AI council (b),
      2 of 2 convergent.** Members anthropic/claude-sonnet-4-5,
      openai/codex-default; $0.033. Spend was **pre-authorized for the run**, so
      this is not a budget refusal — the deferral is on **subject**, and both
      seats called the ordering decisive:

      > Phase 2 *chooses* the wrapper mechanism and Phase 3 benchmarks it. Phase 2
      > is not done. Benchmarking now would buy a number about a mechanism that
      > has not been selected, and if Phase 2 picks differently the number is
      > invalidated.

      One seat added the honest carve-out, which is recorded so a future run does
      not mistake it for permission: measuring the **current** mechanism could give
      a baseline, but that would need its **own** pre-registered, explicitly
      labelled baseline design and must never be presented as the planned widened
      re-bench.

      **The `Resolved when` half is discharged in this same change**, and it went
      further than the blocker asked. The blocker wanted the skill's savings
      paragraph labelled; one seat pointed out that a scope stated only at the
      canonical definition *"does not survive being copied or summarised"*, so the
      label had to travel with **every** reader-facing occurrence. Swept
      `src/` and `docs/`: two sites carry this claim
      (`src/skills/rtk-output-filtering/SKILL.md`,
      `docs/contracts/rtk-detection.md`) and **both** now state date, machine,
      corpus size **and supersession status**. The other six `33 %` hits in the
      tree are a different claim (judge inconsistency) and were left alone — the
      count is reported so "I labelled it" is distinguishable from "I labelled the
      one I happened to see".

      **IRON-LAW-3 RESOLUTION 2026-08-23 — steps 3.2, 3.3 and 3.4 carried, and the
      DEFERRAL'S REASON CHANGED IN THIS SAME CHANGE.** Recorded per the preservation
      test:

      · **Criterion, verbatim:** 3.2 *"A result at or near zero is a publishable
        outcome and closes the lever honestly"* · 3.3 *"Replace it with the new one
        and its scope, or — if 3.2 produced a null — replace it with the null and the
        scope"* · 3.4 *"state the relationship between the two rather than letting a
        reader pick the flattering one."*
      · **Blocker:** `b-ab-session-spend`, resolved to (b) earlier on 2026-08-23 —
        and **re-evaluated in this change**, because its recorded condition no longer
        holds.
      · **The lock, and why it was reopened rather than obeyed.** The original
        deferral rested on **ordering**: *"Phase 2 has not chosen the mechanism Phase 3
        exists to benchmark."* Phase 2 chose in this change. `decision-revisit-gate`
        requires a lock whose condition has changed to be surfaced rather than silently
        complied with, so it was put back to the council.
      · **Options considered:** (a) the deferral is void, run what can be run on one
        machine · (b) it stands on a NEW condition, the registration's own >= 2-machine
        requirement · (c) amend the registration down to one machine.
      · **Verdict: (b)**, AI council 2026-08-23, 2/2 quorum (anthropic/claude-sonnet-4-5 + openai/codex-default), convergent. The ordering objection is **discharged**; what
        defers it now is that the frozen design needs two machines and one is
        reachable. A one-machine re-bench would replace a dated single-machine figure
        with a fresh single-machine figure and call it progress — reproducing exactly
        the narrowness the widening exists to fix.
      · **(c) was refused** because it lowers a bar written before any number was seen,
        which is the one thing a pre-registration exists to prevent.
      · **Destination:** `agents/roadmaps/stubs/road-to-rtk-rebench-run.md`, created in
        this change, carrying all three steps with the frozen design.
      · **What closes it:** a **second machine** is reachable. A CI runner counts and
        the registration names it as acceptable.

      **The skill's label was updated in the same change**, because the deferral reason
      it quotes was the discharged one. It now names the >= 2-machine condition instead
      of the ordering objection — a stale reason attached to a correct outcome is still
      a doc that misleads.
## Blockers

### blocker: b-ab-session-spend
- **Status:** resolved
- **Owner:** maintainer
- **Class:** 2 — consent-once (a benchmark run bills real session tokens)
- **Blocks:** Phase 3 steps 3.2, 3.3 and 3.4. Step 3.1 is the registration and
  proceeds without spend — that is deliberate, because a registration written
  after the budget conversation is a registration written after someone has an
  expectation. Phases 1 and 2 are unaffected.
- **What to do:** pick exactly one — (a) name a per-run budget for a widened
  re-bench, sized against the design registered in 3.1, and run it; or (b) defer
  the re-bench and mark the shipped figure **stale-with-scope** in the skill in
  the same change — the reader then sees a dated, single-machine, eight-command
  number labelled as such rather than an unqualified 33 %.
- **Recommendation:** **(b) — defer and label.** The existing figure is already
  honestly scoped where it is written; the defect is that the scope does not
  travel with the number. Labelling costs nothing, removes the misreading today,
  and leaves the spend decision for a moment when the mechanism chosen in Phase 2
  is actually settled — benchmarking a mechanism before it is chosen measures the
  wrong thing anyway.
- **If you do nothing:** Phase 3 stalls with a registration and no run, and the
  skill keeps presenting a one-machine month-old figure as the package's
  measured claim, which is the exact drift 3.3 exists to close.
- **Resolved when:** one of (a) or (b) is recorded at this blocker, and — for (b) —
  the skill's savings paragraph carries the staleness label and steps 3.2–3.4 are
  marked deferred rather than left open-looking.
- **CONDITION CHANGED 2026-08-23, same day, re-evaluated rather than obeyed.** The
  resolution below rested on **ordering** — *"Phase 2 has not chosen the mechanism Phase
  3 exists to benchmark."* **Phase 2 chose in this change** (option (b) of the mechanism
  decision: the existing warn-only nudge), so that condition is **discharged** and
  `decision-revisit-gate` required the lock to be surfaced rather than silently complied
  with.

  Put back to the council with three options — void the deferral and run on one machine ·
  stand on a new condition · amend the registration down to one machine. Verdict: **the
  deferral STANDS, on a NEW condition**, AI council 2026-08-23, 2/2 quorum (anthropic/claude-sonnet-4-5 + openai/codex-default), convergent.

  **The new condition is the registration's own `>= 2 machines`**, and only one is
  reachable. A one-machine re-bench would replace a dated single-machine figure with a
  fresh single-machine figure and call it progress — reproducing the exact narrowness the
  widening exists to fix. Amending the registration down was refused: it lowers a bar
  written before any number was seen, which is the one thing a pre-registration prevents.

  **Reopens when a second machine is reachable** — a CI runner counts, and the
  registration names it as acceptable. Steps 3.2-3.4 are carried to
  `agents/roadmaps/stubs/road-to-rtk-rebench-run.md`, and the skill's staleness label was
  updated in the same change to name this condition rather than the discharged one.

- **Resolution 2026-08-23 — (b), AI council, 2 of 2 convergent.** Both halves of
  the `Resolved when` are discharged in the same change: 3.2-3.4 are `[~]` with
  the reasoning at 3.4, and the staleness label is on the number at **every**
  reader-facing site rather than only the canonical one.

  **Spend was pre-authorized, and the deferral is still correct** — that is the
  part worth recording. The mandate for this run pre-authorizes benchmark spend,
  so the council decided *how*, not *whether*. Both seats concluded that
  pre-authorized budget is *"permission without reason"*: it does not refute a
  methodological objection, and the objection here is ordering — Phase 2 has not
  chosen the mechanism Phase 3 exists to benchmark.

  What (b) bought immediately: the live misreading is gone. An unqualified "33 %"
  was reading as this package's general measured claim while being a one-machine,
  eight-command, month-old spot measurement.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Phase 2 picks a mechanism before Phase 1 answers | implementation | The candidate set depends entirely on whether a transparent input rewrite exists. Choosing first and probing later produces a mechanism justified by an assumption, which is the failure this roadmap opened on | Phase 1 builds nothing and its output is a dated verdict; 2.1 enumerates candidates explicitly against that answer | Phase 1 — probe the host rewrite contract, and pin what you probed |
| 2 | The probe answer is recorded without a version pin | implementation | An unpinned host-capability claim is what rotted the current header. A fresh probe written down with no host build and no date reproduces the defect in a newer font | 1.2 requires host build plus date in the same paragraph as the verdict; 1.4 routes it into the contract file that already keeps four-state per-host facts | Phase 1 — probe the host rewrite contract, and pin what you probed |
| 3 | The bench is run before it is registered | implementation | Success bars written after results are not bars. The pressure is real here because a null is an unattractive outcome and the temptation is to set the bar where the data landed | 3.1 is gated on file-creation order, which `git log --diff-filter=A` makes checkable rather than asserted | Phase 3 — pre-register the re-bench, then publish it including a null |
| 4 | A null result goes unpublished | product | The lever may be worth little on a modern corpus. An unpublished null leaves the stale 33 % in the shipped skill and the lever permanently half-open | 3.2 names a null as a publishable outcome and 3.3 requires the shipped text to carry whatever was measured | Phase 3 — pre-register the re-bench, then publish it including a null |
| 5 | The second branch is silently orphaned | implementation | `OUTPUT_CAP_TABLE` covers `grep` and `rg` through a different mechanism. A new wrapper that ignores it leaves two overlapping nudges with no precedence rule | 2.3 requires an explicit supersede-or-coexist decision with the firing rule written down | Phase 2 — choose ONE wrapper mechanism, and record the two you rejected |
| 6 | Default-OFF is flipped as a side effect | product | Flipping a warn-only nudge to on changes what every consumer session does, and it is the kind of change that rides along in a mechanism commit without being argued | 2.4 pins the setting explicitly and makes the flip out of scope for that phase | Phase 2 — choose ONE wrapper mechanism, and record the two you rejected |

## Acceptance Criteria

- [x] AC-1 — Whether the host dispatcher offers a transparent input rewrite is a
      written, dated, host-build-pinned finding under
      `agents/evidence/analysis/`, not an undated assertion in a code comment.
- [x] AC-2 — `src/scripts/hooks/rtk_wrap_hook.ts` no longer asserts a host
      contract without a re-probe date, and the per-host capability table in
      `docs/contracts/hook-architecture-v1.md` carries the rewrite finding.
- [x] AC-3 — Exactly one wrapper mechanism is chosen, and the alternatives are
      recorded as rejected with a reason each, so a later reader can see why they
      lost rather than re-proposing them.
- [x] AC-4 — The relationship between the chosen mechanism and the existing
      `OUTPUT_CAP_TABLE` branch is written down as supersede or coexist, with the
      rule that decides which fires.
- [x] AC-5 — A bench design with its success and kill bars exists and was created
      before any results file, provable from the file-creation order in history.
- [-] AC-6 — `src/skills/rtk-output-filtering/SKILL.md` states a figure that
      matches what this roadmap measured — including if that figure is a null —
      with its corpus, machine count and date travelling alongside the number.
      **CANCELLED 2026-08-23 with steps 3.2-3.4**, carried to
      `stubs/road-to-rtk-rebench-run.md`. No new figure exists, so there is nothing to
      state one against — and marking this met would be the silent green.
      **What DID change, and it is most of the value:** the number now carries a
      staleness label naming the condition that actually defers it, the re-bench design
      is frozen with bars in both directions, and the mechanism it would measure is
      chosen. Reopens with a second machine.

- [x] AC-7 — `hooks.rtk_wrap.enabled` is still `false` in
      `src/config/agent-settings.template.yml` unless a flip was argued on its
      own terms and recorded separately from the mechanism choice.
