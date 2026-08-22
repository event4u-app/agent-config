---
complexity: lightweight
status: draft
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

- [ ] **1.1 Probe whether the current host dispatcher offers a transparent input
      rewrite.** The header's claim is `allow/block/warn` with no `updatedInput`.
      Establish whether that is still true against the host build in front of
      you, and record the probe method — not a recollection, an observation.
      verify: the finding is written under `agents/evidence/analysis/` and quotes the pre-state, which is `git show HEAD:src/scripts/hooks/rtk_wrap_hook.ts | grep -c "updatedInput"` = 2 (the two assertions at `:15` and `:190`).
- [ ] **1.2 Pin the answer to a named host build and a date.** An unpinned
      capability claim rots exactly the way the one being replaced did. The
      finding names the host, its version, and the date, so a later reader can
      tell whether it still describes anything.
      verify: `grep -cE "20[0-9]{2}-[0-9]{2}-[0-9]{2}" <the finding>` is non-zero and a host build identifier appears in the same paragraph as the verdict.
- [ ] **1.3 Amend or confirm the header comment in the same change.** Whatever
      1.1 finds, `rtk_wrap_hook.ts:13-15` and `:190` either gain a re-probed date
      or gain the correction. A header that asserts a host contract with no
      date is the defect, independent of whether the assertion is true.
      verify: `grep -n "re-probed\|dispatcher contract" src/scripts/hooks/rtk_wrap_hook.ts` shows the dated form; `npx vitest run tests/scripts/hooks/rtk_wrap_hook.test.ts 2>&1 | tail -3` still passes.
- [ ] **1.4 Route the answer into the hook-architecture contract.** The four-state
      host table at `docs/contracts/hook-architecture-v1.md:370` is where
      per-host capability facts live in this tree. A rewrite-capability finding
      belongs beside it, not only in a hook header.
      verify: `grep -n "rewrite" docs/contracts/hook-architecture-v1.md` returns the new entry.

## Phase 2 — choose ONE wrapper mechanism, and record the two you rejected

- [ ] **2.1 Enumerate the candidate mechanisms against Phase 1's answer.** At
      least three are on the table and they are not interchangeable: a
      transparent input rewrite (only if 1.1 found one), the existing warn-only
      nudge, and the bounded-alternative branch that `OUTPUT_CAP_TABLE` already
      implements for commands the wrapper cannot take. Write them out with what
      each costs and what each cannot do.
      verify: `grep -n "OUTPUT_CAP_TABLE" src/scripts/hooks/rtk_wrap_hook.ts` resolves to `:211` and the enumeration cites it as the existing second branch.
- [ ] **2.2 Pick one and record the rejections with reasons.** One mechanism
      ships. The other two are written down as rejected-with-reason in the same
      note — a rejected alternative with no reason attached is re-proposed within
      the quarter, which is the pattern this tree keeps a decision-record
      discipline for.
      verify: the note names exactly one chosen mechanism and gives a reason per rejected one; `grep -ci "rejected" <the note>` is at least 2.
- [ ] **2.3 State what happens to the second branch under the chosen mechanism.**
      `grep` and `rg` are covered today by a warn naming a bounded alternative.
      If the chosen mechanism supersedes that, say so; if it coexists, say how
      the two decide which fires.
      verify: the decision is written and, if code changed, `npx vitest run tests/scripts/hooks/rtk_wrap_hook.test.ts 2>&1 | tail -3` and `./scripts-run src/scripts/lint_hook_manifest 2>&1 | tail -3` both exit green.
- [ ] **2.4 Leave default-OFF alone unless Phase 3 earns the flip.** The setting
      ships `false` and a default flip is a change to what every consumer session
      does. It is not part of choosing a mechanism.
      verify: `grep -n -A1 "^  rtk_wrap:" src/config/agent-settings.template.yml` still shows `enabled: false`.

## Phase 3 — pre-register the re-bench, then publish it including a null

The ordering is the whole point. A benchmark whose success bar is written after
the numbers arrive is not a benchmark.

- [ ] **3.1 Register the bench design before running anything.** Corpus size and
      composition, machines, commands, the metric, and the bars — both the
      success bar and the kill bar — written down and dated ahead of the first
      run. Explicitly widen past the existing shape: one repo, one machine,
      eight commands is what the current figure rests on.
      verify: the registration file exists under `agents/evidence/analysis/` with a date preceding any results file, and `git log --diff-filter=A --format=%ad -1 -- <registration>` precedes the results file's add date.
- [ ] **3.2 Run it and publish the number, whatever it is.** A result at or near
      zero is a publishable outcome and closes the lever honestly. A result that
      misses the pre-registered bar closes it the same way.
      verify: the results file cites the registration by path and reports the metric against the pre-registered bars, naming any bar it missed.
- [ ] **3.3 Correct the shipped documentation to whatever 3.2 measured.** The
      skill currently carries the 2026-07-28 figure. Replace it with the new one
      and its scope, or — if 3.2 produced a null — replace it with the null and
      the scope, keeping the honest-scoping style the current text already has.
      verify: `grep -n "2026-07-28" src/skills/rtk-output-filtering/SKILL.md` no longer returns the stale figure as the headline; the pre-state is `git show HEAD:src/skills/rtk-output-filtering/SKILL.md | grep -c "2026-07-28"` = 1.
- [ ] **3.4 Reconcile the upstream-reported range against this tree's own.** The
      skill quotes an upstream 60–90 % range next to a measured 33 %. Whatever
      3.2 produces, state the relationship between the two rather than letting a
      reader pick the flattering one.
      verify: the skill text names both figures with their sources, and `./scripts-run src/scripts/skill_linter src/skills/rtk-output-filtering 2>&1 | tail -3` exits green.

## Blockers

### blocker: b-ab-session-spend
- **Status:** open
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

- [ ] AC-1 — Whether the host dispatcher offers a transparent input rewrite is a
      written, dated, host-build-pinned finding under
      `agents/evidence/analysis/`, not an undated assertion in a code comment.
- [ ] AC-2 — `src/scripts/hooks/rtk_wrap_hook.ts` no longer asserts a host
      contract without a re-probe date, and the per-host capability table in
      `docs/contracts/hook-architecture-v1.md` carries the rewrite finding.
- [ ] AC-3 — Exactly one wrapper mechanism is chosen, and the alternatives are
      recorded as rejected with a reason each, so a later reader can see why they
      lost rather than re-proposing them.
- [ ] AC-4 — The relationship between the chosen mechanism and the existing
      `OUTPUT_CAP_TABLE` branch is written down as supersede or coexist, with the
      rule that decides which fires.
- [ ] AC-5 — A bench design with its success and kill bars exists and was created
      before any results file, provable from the file-creation order in history.
- [ ] AC-6 — `src/skills/rtk-output-filtering/SKILL.md` states a figure that
      matches what this roadmap measured — including if that figure is a null —
      with its corpus, machine count and date travelling alongside the number.
- [ ] AC-7 — `hooks.rtk_wrap.enabled` is still `false` in
      `src/config/agent-settings.template.yml` unless a flip was argued on its
      own terms and recorded separately from the mechanism choice.
