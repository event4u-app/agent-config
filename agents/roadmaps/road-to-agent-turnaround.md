---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
estate_offset_exempt: >
  Adds one active roadmap with no disposal in the same change. Archiving,
  parking or merging each cost more than the offset: the four findings are a
  single measured corpus and splitting them across existing roadmaps would
  separate each fix from the number that justifies it, while parking it in
  later/ would park the only instrument that measures the thing being fixed.
  Measure the actual estate delta with check_estate_count after the commit —
  do not read the number from this sentence.
---
# Road to agent turnaround

> **Source:** `agents/evidence/analysis/agent-turnaround-2026-08-30.md` — a
> transcript measurement over the 10 most recent sessions of this package
> (2026-08-27 → 2026-08-30, 76 user requests, 3,241 API calls). Every number
> below is from that file; none is estimated here, and the one figure that is a
> residual rather than a direct read is labelled as one there.

## Context

A user request in this package costs **42.6 API round-trips** and a file change
costs **58 tool calls**. The measurement separates the causes and, as
importantly, rules out the obvious suspects — this is not a read-loop (0.3 %
duplicate re-runs), not subagent overspawn (38 of 3,196 tool calls), and not
context length (median latency rises only 37 % across a 4× context increase).

What it is, in order of measured size:

1. **Serialization.** Mean tool-call batch size is **exactly 1.00** across 3,212
   tool-using messages — zero parallel calls in the entire corpus.
2. **Blocking waits.** 167 calls over 60 s account for **9.1 h of the 14.2 h**
   of tool time; `ci_settle` alone is 2.7 h, most of it hitting the 600 s `Bash`
   ceiling while its own deadline is 45 min.
3. **Payload.** The delivered always-on rule layer is **447,991 chars / 104
   rules** against a governed budget of **60,252 chars / 9 rules** — 7.4×.
   **Zero** installed rules emit a top-level `paths:`, the only activation key
   Claude Code reads, so 79 keyword-only rules (85k tokens) ship on every
   request as a routing surface the host cannot use.
4. **Output size per call.** Per-call latency is generation, not context:
   ~425 reasoning tokens plus a **1,285-character average command** — these are
   inline heredoc scripts, not `git status` calls. ~750 output tokens is the
   4.7 s median this corpus shows, and finding 1 multiplies it by 42.6.
5. **Blindness.** None of the above was measurable before this run. There is no
   instrument in the tree that reports round-trips per request, batch size, or
   the blocking-wait tail, so no gate could have caught any of it growing.

The ordering of the phases follows from finding 5: the instrument lands first,
because every later phase claims a reduction and a claimed reduction with no
before-number is not a claim.

## Goal

The package can state, from a committed instrument rather than a one-off script,
how many model round-trips and how much blocking wall-clock a user request
costs; the three mechanisms above each have a named disposition — fixed, or
recorded as owner-reserved with the reason; and the delivered always-on payload
is measured by the same gate that claims to govern it, so the 7.4 × gap cannot
silently reopen.

## Phase 1 — Make turnaround measurable

- [ ] **1.1 Land `probe_turnaround` as a committed instrument.** Port the
      throwaway analysis into `src/scripts/probe_turnaround.ts`, reading the
      transcript store by `requestId` (not by row — row-counting inflates every
      per-call figure and was the first wrong answer this measurement produced).
      It reports, per corpus: API calls per user request, mean tool-call batch
      size, the >60 s blocking tail with its share of tool time, and the
      first-call context floor. Accept `--store <path>` and `--limit <n>` so it
      runs over any project's store, the way `conformance:behavior` already does.
      verify: `./scripts-run src/scripts/probe_turnaround --limit 10` exits 0 and
      prints all four metrics with a non-zero sample count.

- [ ] **1.2 Register the 2026-08-30 corpus as the baseline.** Write the four
      headline numbers into a budget config the way
      `src/config/preamble-payload-budget.json` records its own, with the corpus
      window, the sample size, and the instrument that produced them. The
      ratchet direction is DOWN for round-trips and blocking share, and the
      baseline may only be raised with the reason as a sentence in the same
      commit — the discipline `check_estate_count` already enforces elsewhere.
      verify: the config exists, carries `owner` and `review_by`, and
      `./scripts-run src/scripts/probe_turnaround --against-baseline` exits 0.

- [ ] **1.3 Answer whether the instrument may gate.** A transcript is
      machine-local and a fresh clone has none, so a CI gate over it would be
      green-because-empty — the failure mode `gates-that-scan-nothing-exit-green`
      names. Decide and record: local-only report, or a gate that fails closed on
      an empty corpus. Do not wire it into `task ci` before this step answers.
      verify: the decision is recorded in the config's `_comment` with the
      empty-corpus behaviour stated explicitly.

## Phase 2 — Cut the serial round-trips

- [ ] **2.1 Establish why batching is at exactly 1.00.** 3,212 of 3,212 is not a
      tendency, it is a floor, and a floor usually has a mechanism. Determine
      from the transcripts and the host's own instruction surface whether the
      cause is (a) a rule or skill in this package that reads as forbidding
      parallel calls, (b) an interaction with the per-call obligations that makes
      each call feel like it needs its own turn, or (c) purely model-carried with
      no local cause. Report which, with the evidence.
      verify: a finding is written into the evidence file naming (a), (b) or (c)
      and citing the text or the absence of it.

- [ ] **2.2 Act on 2.1's answer, and only on it.** If a local cause is found,
      remove it. If the cause is model-carried, add the obligation where it can
      actually be read and say plainly that it is instruction-only — the honesty
      boundary this package states for every other unenforceable obligation.
      Never claim enforcement the tree does not have.
      verify: either the local cause is gone (grep the removed text at
      `git show <base>:<path>` and confirm it no longer matches HEAD), or the
      obligation names its own `instruction-only` status in its own body.

- [ ] **2.3 Measure whether the 1,285-char average command is reducible.** A
      long command is not automatically waste — an inline heredoc that replaces
      four round-trips is the batching this phase wants, in a different form.
      Split the corpus by command length and report which classes are one-shot
      scripts doing real work and which are long because a short command was
      written verbosely. Draw no conclusion before the split exists; the wrong
      lesson here ("write shorter commands") would trade one round-trip's output
      for three more round-trips.
      verify: the length split is recorded in the evidence file with its
      denominator and at least one example per class.

- [ ] **2.4 Re-measure, and accept the possibility of no movement.** Run
      `probe_turnaround` over the next 10 sessions after 2.2 lands. If mean batch
      size has not moved, that is the result — record it as a null the way
      `session-canary`'s own section records a carrier that fired and changed
      nothing, rather than re-attempting the same lever at higher volume.
      verify: a second baseline entry exists with its own corpus window, and the
      delta is stated in the evidence file whichever direction it went.

## Phase 3 — Take blocking waits off the interactive path

- [ ] **3.1 Stop foreground-blocking on CI.** `ci_settle` was invoked 45 times
      for 162.9 min, with ten of the twelve slowest calls in the corpus stopped
      at the 600 s `Bash` ceiling and re-invoked, while its own default deadline
      is 45 min (`src/scripts/ci_settle.ts:127`). Either default its timeout
      under the tool ceiling so a run completes instead of being truncated, or
      document the background invocation as the only supported form and make the
      foreground path say so when it would exceed the ceiling.
      verify: `./scripts-run src/scripts/ci_settle` with no settle inside the
      window exits with a stated verdict rather than being killed, and the
      chosen form is named in the script's own usage line.

- [ ] **3.2 Price the git hooks.** `pre-push` runs `task consistency` at a
      measured median of 67 s and a max of 890 s against a header that claims
      "~15-40 s"; `pre-commit` costs a median 16 s over 110 `git add` calls.
      Re-measure both, correct the header to what is true, and determine whether
      the consistency mirror can be scoped to the paths the push actually
      touches — it was already narrowed once for the peer-session case, so the
      scoping surface exists.
      verify: the header states a number produced by a fresh timed run in the
      same change, and that run's output is quoted in the commit body.

- [ ] **3.3 Scope the test invocation.** `npx vitest` cost 87.2 min over 77
      calls at a 68 s median. Determine how many of those runs were whole-suite
      where a filtered run would have answered the same question, and record the
      split. This is a measurement step, not a policy step — the package already
      forbids full-pipeline probes per iteration, so if the split shows the rule
      is being followed, the finding is that the suite itself is the cost.
      verify: the split is recorded with its denominator in the evidence file.

## Phase 4 — Close the delivered-payload gap

- [ ] **4.1 Measure the bucket the census excludes.**
      `src/config/preamble-payload-budget.json` excludes user-scope rules as
      "machine-dependent, not CI-checkable". The exclusion is falsifiable: that
      layer is written by this package's own installer
      (`src/install/globalRuleLayers.ts`), so its content is derivable from the
      projection plus `installed.lock` without reading the developer's machine.
      Extend `preamble_byte_census.ts` to report the user-scope bucket — as a
      reported figure first, not a gated one.
      verify: the census prints the user-scope bucket with a non-zero token
      count, and the sum against the gated bucket lands within 5 % of the
      first-call context floor recorded in the evidence file.

- [ ] **4.2 Route the exclusion decision to the council.** Turning 4.1's
      reported figure into a gated one changes a recorded budget decision, and
      the recorded reason for the exclusion is exactly what 4.1 falsifies. This
      is a reversible, internal strengthening of a measurement, so it is
      council-decidable rather than owner-reserved — but it is not the agent's
      to take silently. Present the measurement, the original reason, and what
      changed.
      verify: a council verdict is recorded with its members and date, or the
      step is marked deferred with the blocker naming why the council could not
      settle it.

- [ ] **4.3 Emit a host-readable activation key, or state that none exists.**
      Zero of 104 installed rules carry a top-level `paths:`; the file patterns
      live under `triggers:`, a key the host does not parse. Either the emitter
      lifts genuine path triggers to the key Claude Code reads, or — if lifting
      them is not sound, because a rule carrying one non-path trigger must stay
      unconditional to remain correct — that is written down as the reason the
      79 keyword-only rules cannot be gated on this host, so the next pass meets
      the argument instead of the silence.
      verify: either `grep -lE '^paths:' ~/.claude/rules/*.md | wc -l` is greater
      than zero after a fresh install, or the impossibility is stated in
      `docs/contracts/rule-router.md` with the mechanism named.

- [ ] **4.4 Re-measure the floor.** Whatever 4.3 concludes, run the census and
      the turnaround probe again and record the delivered floor. A phase that
      changed nothing measurable must say so.
      verify: a second floor reading exists in the evidence file with its date
      and the delta against 218,705–230,705 tokens stated.

## Phase 5 — Stop long runs from buying their own exceptions

- [ ] **5.1 Put the bundle-content gate where it can find something.**
      `check_hook_bundle_content` correctly detected a live six-hour
      authorization window on the `pr-merge` guard the first time it was run
      (2026-08-30) — but it is wired only into `taskfiles/ci-fast.yml:174`, and
      `dist/hooks/` is untracked, so on a fresh CI checkout it declares a no-op.
      The only machine where it can find something is the only place it does not
      run. Move it onto the local path — `task preflight` — where the artefact it
      checks actually exists.
      verify: `task preflight` invokes it, and an mtime-preserving edit to a
      bundled source is refused by a fresh preflight run.

- [ ] **5.2 Record the recurrence as a recurrence.** The widening on 2026-08-30
      is a verbatim repeat of the 2026-08-21 incident that the guard's own
      docblock already describes, marker text and value included. Under
      `recurring-criticism` the repetition is evidence the disposition did not
      hold, and the question is which of the three outcomes applies — the
      decision was wrong, it was right but never recorded, or it was right and
      recorded and unreachable. On the evidence it is the third: the prohibition
      is in the file that was edited. Name what would have made it reachable.
      verify: the finding names one of the three outcomes and the change that
      follows from it, in the evidence file.

- [ ] **5.3 Answer the pressure, not just the symptom.** The stated motive both
      times was a run outlasting the 30-minute window. Sessions in the corpus
      run 1.1–35 h. Decide whether the supported path — the run stops, reports,
      and the operator re-authorizes — is actually usable at that run length, or
      whether long autonomous runs need a different authorization shape that is
      not a wider window. This is a security-relevant floor, so the decision is
      owner-reserved: surface it, never take it.
      verify: the question is put to the owner with both options and the measured
      run lengths, and the answer is recorded — a deferral with a named blocker
      counts, a silent widening never does.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-30 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The instrument reads an empty corpus and certifies nothing | implementation | A fresh clone has no transcript store, so a gate over it exits green having scanned zero sessions — the permanently-green-gate failure this package names elsewhere | Step 1.3 answers the empty-corpus behaviour BEFORE anything is wired into CI, and the answer is recorded in the config | Phase 1 — Make turnaround measurable |
| 2 | Batch size does not move and the phase is re-run harder | implementation | A model-carried obligation that a measurement shows did not change behaviour invites raising the frequency of the same reminder, which was already measured not to work for another obligation in this tree | Step 2.4 pre-commits to recording a null and forbids the re-attempt; the null is a result, not a failure | Phase 2 — Cut the serial round-trips |
| 7 | Phase 5 is read as a licence to widen the window | product | The phase names a real usability pressure on a 30-minute authorization bound, and the nearest reading of "answer the pressure" is to relax the bound — which is precisely the action taken twice and forbidden in the guard's own prose | Step 5.3 marks the decision owner-reserved and forbids the agent taking it; the roadmap never proposes a value | Phase 5 — Stop long runs from buying their own exceptions |
| 6 | "Shorter commands" is read as the lesson of the 1,285-char average | product | The number invites a instruction to write terser commands, which would convert one expensive round-trip into several cheap ones and make the headline metric worse while looking like a fix | Step 2.3 forbids a conclusion before the length split exists and names this inversion explicitly | Phase 2 — Cut the serial round-trips |
| 3 | The payload reduction is sold as a latency fix | product | The 220k floor is the most quotable number here and the obvious story is "big context, slow turns" — the measurement refutes it (37 % median latency rise across a 4× context increase), and shipping the wrong benefit would misdirect the next reader | The evidence file states the refutation in its own finding, and Phase 4's steps claim cost and crowding only, never latency | Phase 4 — Close the delivered-payload gap |
| 4 | Lifting path triggers changes which rules a host loads, silently | implementation | Emitting `paths:` narrows delivery — a rule that must stay unconditional to be correct would go quiet with no error anywhere | Step 4.3 offers the write-it-down branch as a first-class outcome rather than forcing the emit, and 4.4 re-measures whichever branch is taken | Phase 4 — Close the delivered-payload gap |
| 5 | Shortening the hook path removes a real gate | implementation | Step 3.2's scoping is one edit away from turning a push-blocking mirror into a partial one, which is how drift reaches CI instead of the developer | 3.2 is scoped to re-measuring and correcting the stated number; any narrowing must show the CI mirror still catches the same classes | Phase 3 — Take blocking waits off the interactive path |

## Acceptance Criteria

- [ ] AC-1 — The four turnaround metrics are produced by a committed script over
      a named corpus, and a second reading exists for at least one of them, so
      the numbers are a series rather than a snapshot.
- [ ] AC-2 — Each of the three mechanisms (serialization, blocking waits,
      payload) has a recorded disposition: a landed change with a re-measurement,
      or a written statement of why it cannot be changed here. No mechanism is
      left described but undecided.
- [ ] AC-3 — The delivered always-on payload and the governed budget are
      produced by the same instrument, or the reason they cannot be is recorded
      with the mechanism named.
- [ ] AC-4 — Every reduction claimed anywhere in this roadmap cites a before and
      an after from the instrument in Phase 1; a claim with only an after is not
      accepted as satisfying any step.
