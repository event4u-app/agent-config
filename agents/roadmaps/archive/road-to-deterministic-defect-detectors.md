---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates: []
# relates: manual sweep over agents/roadmaps/**/*.md on 2026-09-04 for
# `verify-repair-loop`, `tamper`, `assertion` and `error swallow` — no roadmap
# owns any of them. `later/road-to-mixed-trigger-activation-cost.md` is the
# adjacent reach question and is a different subject (delivery cost, not
# detection).
estate_offset_exempt: "Adds one active roadmap against a floor of 1. The single active roadmap is a council-topology carrier and cannot absorb a detector line. Parking it would leave verify-repair-loop naming its own blind spot at :54 and :185 with nothing that closes it, and archiving to pay for it would dispose of unfinished work."
---
# Road to deterministic defect detectors

> **Source:** `agents/tmp.old/inbox-2026-09-d/set-1/` — an external research
> pass on documented AI failure modes, mapped defect-first against the tree.
> Every claim below was re-checked against `main@46022ddd8`, which is one full
> drain run ahead of the artefacts' own pin, and one of its proposals is
> refuted by a decision already in the tree.

## Goal

Three failure modes that the tree already describes in prose acquire a
deterministic, diff-local check. `verify-repair-loop` says at `:54` that an
agent can "skip assertions, weaken checks — and still hit the threshold" and at
`:185` that "the numeric gate cannot catch this"; today nothing else catches it
either. The same holds for a newly introduced bare `except` or empty `catch`,
and for a green verdict claimed without a fresh runner timestamp. When this is
finished each of the three is decided by a check rather than by the agent that
produced the diff.

## Phase 0 — Anchor and corpus

- [x] **0.1 Commit the tamper corpus before any detector.** One fixture diff per
      detector class, each a minimal patch that a human reads as tampering:
      an assertion removed after a failure, an assertion weakened
      (`assertEquals` to `assertNotNull`, a narrowed range), a `skip` / `xfail` /
      `.only` added, an expected value rewritten to the broken output, an early
      exit injected before the runner, a test file deleted, and the function
      under test mocked away. Negative fixtures alongside: a legitimately
      deleted obsolete test, a legitimately relaxed assertion whose commit
      message says why.
      verify: the corpus exists and every positive fixture is unmatched before
      Phase 1 runs; every negative fixture stays unmatched throughout.
- [x] **0.2 Record the refuted proposal.** The source asks for a check that
      flags a pull request raising a function's **cyclomatic** complexity by
      three or more. The tree already answered that question the other way:
      `src/scripts/_lib/bench_ab_complexity.ts:32` rejects cyclomatic by name —
      "it scores a flat `switch` above a triply-nested `if`, so it cannot detect
      golfing" — and implements cognitive complexity over the tree-sitter pair
      instead. The proposal is not adopted; if a complexity-delta signal is
      wanted later it reuses that module and its metric.
      verify: the refutation is written into the evidence note with the file and
      line, so a tenth round proposing cyclomatic meets a record rather than a
      fresh argument.

## Phase 1 — The tamper detector, loop-local

- [x] **1.1 Specify the detector vocabulary before writing it.** Closed set of
      detector ids, one per class in 0.1, each with a severity and a mandatory
      `file:line` evidence field. Reuse `GateOutcome`
      (`src/scripts/_lib/gate_result.ts:46`) rather than inventing a second
      outcome vocabulary — `crashed` already separates "the check failed" from
      "the check found something", which is the distinction a tamper detector
      most needs.
      verify: the vocabulary is committed and every id in it has a fixture in
      0.1.
- [x] **1.2 Implement the post-fail diff check.** Deterministic, no model call:
      given the diff between a failing run and the next attempt, decide whether
      the path to green weakened the verification. `severity` for an added
      `skip` is the one genuinely contested call in the source — the field is
      split — so it ships as `warn` and its promotion is a later decision with
      the corpus as evidence.
      verify: every positive fixture of 0.1 is detected with its id, and every
      negative fixture stays clean.
- [x] **1.3 Bind it in the loop, not in CI.** `verify-repair-loop` gets the
      check as a loop-local step, fail-closed inside the loop only. It does not
      become a global gate in this roadmap: the tree's own measured lesson is
      that reach, not content, is the scarce thing, and a new always-on gate is
      the opposite of that lesson.
      verify: the loop refuses to record a green verdict on a fixture diff that
      trips a detector, and an ordinary passing run is unaffected.

## Phase 2 — Phantom verification

- [x] **2.1 Require a fresh runner timestamp for a green verdict.** "Claimed
      green without re-running" is the failure the repair loop is most exposed
      to, and it is decidable: the verdict carries the runner's own timestamp,
      and a verdict whose timestamp predates the last edit in the loop is its
      own outcome rather than a pass.
      verify: a fixture that reports green with a stale timestamp produces the
      distinct outcome, not `clean`.

## Phase 3 — Error-swallow, in the diff

- [x] **3.1 Detect a newly introduced silent catch.** Prose coverage exists
      across `error-handling-patterns`, `ai-code-blindspots` and
      `testing-anti-patterns/process-anti-patterns.md`, and no script decides
      it: `ls src/scripts/` matches nothing for `swallow`, `bare_except` or
      equivalents. Scope it to lines the diff **adds** — a pre-existing empty
      catch is debt this check does not own — and to the shapes that are
      unambiguous: an empty block, a block whose only statement is a `pass` or a
      comment, and a catch that discards the caught value without re-raising or
      logging.
      verify: a fixture diff adding each shape is flagged; a diff adding a catch
      that logs, re-raises, or returns a typed error is not.
- [x] **3.2 Ship it warn-first with a counted baseline.** The false-positive
      rate over the tree's own history is unknown, and this repository does not
      promote a detector to a blocker on an unmeasured rate.
      verify: the check runs over a recorded range of merged commits and the
      finding count is written down before any promotion is discussed.

## Phase 4 — The named smells

- [x] **4.1 Give the smells their field names.**
      `grep -ricE 'assertion roulette|magic number'` over
      `src/skills/testing-anti-patterns/` returns zero. The skill describes the
      behaviours; a reviewer cannot cite them by the names the literature uses,
      which is what a checklist reference needs. Add the canonical names —
      assertion roulette, magic-number test, eager test, lazy test, duplicate
      assert — each mapped to the behaviour the skill already describes, with a
      backstop grep column in the shape `ai-code-blindspots` already uses.
      verify: each name resolves to a row with a behaviour and a grep, and no
      row duplicates an existing entry under a new name.
      <!-- finding: the premise is partly false. Measured 2026-09-04 over both
      files of the skill, `roulette`, `eager`, `lazy` and `duplicate` each
      return 0 and `hardcoded` returns 6, so only ONE of the five names has a
      behaviour the skill already describes. Two rows shipped (magic-number
      test, assertion roulette — the latter mapping onto the multi-case stack
      Anti-Pattern 6 prescribes at src/skills/testing-anti-patterns/SKILL.md:132-170).
      Three are deliberately NOT rows and the reason is recorded in the skill:
      `eager test` would carry the same behaviour AND the same grep as
      assertion roulette, which is the duplicate this step's own verify line
      forbids; `lazy test` and `duplicate assert` are described nowhere and
      neither is greppable without parsing test boundaries, so a row for either
      would be new guidance under a naming step. -->
- [x] **4.2 Give flakiness a state instead of a mention.** Fifteen skills
      mention `flaky` and `docs/contracts/evidence-artifact-types.md` carries no
      repeat-run evidence mode, so a test that passes on the second attempt has
      no way to be recorded as anything but green. Declare an n-times-repeated
      run as its own evidence mode, and flaky as its own outcome — never a
      silent red or a silent green. (The source said six skills; the count at
      `46022ddd8` is fifteen, `corrected-from-reproduction`.)
      verify: the evidence-type contract carries the mode, and a fixture that
      passes 4 of 5 runs is recorded as flaky rather than as passing.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-04 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The tamper detector fires on legitimate work | implementation | Deleting an obsolete test and relaxing an over-tight assertion are both normal, and a detector that calls them tampering makes the repair loop unusable | 0.1 requires the negative fixtures before the detector exists, and 1.2 ships the contested class as warn rather than block | Phase 0 — Anchor and corpus |
| 2 | A loop-local check quietly becomes a global gate | implementation | The obvious next step after a working detector is to run it everywhere, which is the always-on cost the tree's own measurements argue against | 1.3 states the boundary as a step rather than as intent, and 3.2 requires a counted baseline before any promotion | Phase 1 — The tamper detector, loop-local |
| 3 | The error-swallow check is defeated by one token | implementation | A `pass  # intentional` comment satisfies a naive shape check while changing nothing, so the detector teaches evasion rather than discipline | 3.1 scopes the shapes to the unambiguous set and 3.2 measures the rate rather than assuming it | Phase 3 — Error-swallow, in the diff |
| 4 | The smell names become a second vocabulary | product | Adding five canonical names beside the behaviours already described risks two ways of saying the same thing, which is the drift a catalog exists to prevent | 4.1 requires each name to map onto an existing behaviour and forbids a row that duplicates one | Phase 4 — The named smells |

## Acceptance Criteria

- [x] AC-1 — Every positive fixture in the tamper corpus is detected by id with
      a `file:line`, and every negative fixture stays clean.
- [x] AC-2 — The repair loop cannot record a green verdict on a diff that
      weakened the verification, and cannot record one on a stale runner
      timestamp.
      <!-- honest limit: the deterministic half is real — the detector exits 1
      on a block finding, 3 on a warn finding and 4 on a stale verdict, proven
      by `--self-test` (18/18, 10 rejecting). The loop itself is a conversation,
      not a process, so the obligation to honour that exit code is carried by
      `verify-repair-loop` step 3.4 in prose and by nothing that can refuse.
      Stated rather than implied: no gate observes a loop that ran the check
      and ignored it. -->
- [x] AC-3 — A diff that newly introduces a silent catch is flagged, the check
      is warn-first, and its finding count over a recorded commit range is
      written down.
- [x] AC-4 — The canonical test-smell names resolve to behaviours already in
      `testing-anti-patterns`, each with a backstop grep and no duplicate row.
      <!-- met as an invariant, not as a count: every row shipped resolves to a
      described behaviour and carries a runnable grep, and no row duplicates
      another. Two of the five proposed names cleared that bar; the other three
      are recorded as not clearing it, with the measurement, in the skill and
      in the 4.1 note above. -->
- [x] AC-5 — A repeated run is a declared evidence mode and flaky is its own
      outcome, never a silent pass.
