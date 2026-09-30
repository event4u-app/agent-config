---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Archiving is impossible — the defect is live and reproduced in this tree today; parking repeats the disposition that shipped the widening this fixes; merging into road-to-adversarial-verification-and-long-runs would bury a two-file hook fix inside a delivery-state roadmap that touches neither hook."
relates: []
---
# Road to one verification classifier

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t11/` — an external completion-contract analysis set (two competing model syntheses over the same two parents, plus their chat).

## Goal

This tree carries two regular expressions that both answer "did this command verify
anything", they disagree in both directions, and the stricter one's verdict is written
and never read. `_VERIFY_RE` (`src/scripts/hooks/turn_end_gate_hook.ts:709`) matches a
verification token **anywhere on the line**, so `ls tests`, `cat build.log`,
`git checkout main`, `mkdir build` and `git commit -m "fix ci"` all clear detector C —
the exact case the function's own header says it rejects. `_VERIFICATION_RE`
(`src/scripts/before_complete_hook.ts:153`) is head-anchored and refuses all five, but
also refuses `npx vitest run`, `tsc --noEmit` and `./scripts-run src/scripts/lint_*`,
which the gate's audited fixture accepts. Both accept `npm test || true`. Neither reads
an exit status: `ToolCall` (`turn_end_gate_hook.ts:997-1003`) carries `name`, `command`
and `path` and nothing else. The producer's witness `verified_this_turn` has exactly one
referencing file in `src/` — the producer. Done: one predicate module, two importers,
zero surviving regexes, a fixture that reds on the token-as-argument case at the pin and
passes after, and a per-host row saying whether a failed exit is even distinguishable.

## Phase 1 — One predicate, proven sensitive both ways

- [x] **1.1 Extract the predicate into one module.** `src/scripts/_lib/verification_command.ts`
      owns it. Head-anchored per shell segment (split on `&&`, `;`, `|`), seeded from the
      union of both current lists minus every row that only matches on an argument. A
      segment whose failure is discarded (`|| true`, `|| :`, `; true`) does not count.
      Both hooks import it; both inline regexes are deleted.
      verify: `grep -rc '_VERIFY_RE\|_VERIFICATION_RE' src/scripts` reports 0 outside the new module
      **DONE 2026-09-30, and two things this step said were already stale.**
      (a) The module already existed — a prior change moved the selector there
      byte-identical to break an import cycle with `verification_evidence.ts`.
      What did NOT exist was the fix: the predicate inside it was still the
      unanchored regex. (b) The Goal's claim that the stricter selector's verdict
      "is written and never read" is false at this head for the COUNTERS it
      feeds: `ci_last` is read by `turn_end_gate_hook.ts` and
      `measure_turn_end_gate.ts`. It is true only of `verified_this_turn`.
      The predicate is structural now rather than a regex, because a
      word-boundary pattern cannot express "the head of the segment" — which is
      the property separating `npm test` from `ls tests`. Split on shell
      separators, drop a segment whose failure the shell discards, classify each
      remaining segment on its head.
      **Two predicates remain in the one module, deliberately.**
      `isVerificationCommand` answers *did this verify* and is narrow;
      `mightBeVerification` answers *is this worth recording for `classifyRun`
      to judge* and is wide. Collapsing them was tried and reverted on evidence:
      a recorder that filters `echo test` out leaves the gate unable to tell a
      non-verification command from silence, which a pinning test asserts. The
      step's "zero surviving regexes" is met in the sense its own acceptance
      criterion states — the grep finds nothing outside this module.
- [x] **1.2 Two negative fixtures, each proven red at the pin first.** G1 — `ls tests`,
      `cat build.log`, `git checkout main`, `mkdir build`, `git commit -m "fix ci"`,
      `true # test` — must red against today's `_VERIFY_RE` before 1.1 lands. G2 —
      `npx vitest run x`, `tsc --noEmit`, `./scripts-run src/scripts/lint_thing` — must red
      against today's `_VERIFICATION_RE`. A fixture never seen red has unknown sensitivity.
      verify: `npx vitest run tests/scripts/turn_end_verify_allowlist` -> 0
      **DONE 2026-09-30.** `tests/scripts/verification_command_anchoring.test.ts`.
      G1 observed red first — all six rows returned `true` against the pre-fix
      `_VERIFY_RE`, plus three `|| true` / `|| :` / `; true` rows and the
      chained-head case, ten failures in all. G2 was proven red against
      `_VERIFICATION_RE` by probing that expression directly, because the
      permissive selector already accepted those three: the two directions
      belong to two different classifiers and cannot be shown red by one run.
      **One false negative was introduced and fixed here:** `node --test`
      selects a runner by FLAG, so head-anchoring alone refused it. Neither
      explicit list named it — the token-anywhere regex had been accepting it by
      accident — so the union seeding missed it. Caught by
      `verification_evidence.test.ts`, now pinned in the fixture. This is Risk 3
      firing and being caught by an existing test rather than in production.
- [x] **1.3 Add the missing negative rows to the audited fixture.** The current AUDIT array
      carries seven negatives (`tests/scripts/turn_end_verify_allowlist.test.ts:98-104`) and
      not one of them puts a verify token in an argument position — which is why the
      defect passed the audit. G1 becomes part of that array.
      verify: `grep -c "'ls tests', false" tests/scripts/turn_end_verify_allowlist.test.ts` -> 1
      **DONE 2026-09-30 — returns 1.** Nine rows added: the six G1
      argument-position cases and the three discarded-failure cases. The table
      was not wrong before, it was SILENT on the case that mattered, which is
      why it passed for the whole time `ls tests` cleared detector C.

## Phase 2 — The witness gets a reader, and says when it does not know

- [x] **2.1 Record the outcome, not only the name.** On `post_tool_use` the witness gains
      `last_edit_at` and, where the host surfaces a tool result, `last_verification.failed`.
      Unknown stays `null`, and a `null` never clears the gate.
      verify: `npx vitest run tests/scripts/before_complete_hook` -> 0
      **ALREADY DONE when this run arrived, by a different mechanism than the
      step describes, and the difference is an improvement worth recording.**
      `verification_runs[]` carries `exit_code` (null when the host says
      nothing), `exit_source`, `stdout_tail`, `runner` and `after_edits`. The
      edit ordering is `after_edits` — an ORDINAL comparison against the turn's
      total edit count — not the `last_edit_at` timestamp this step asked for,
      and the ordinal survives a host whose clock is coarse or absent where a
      timestamp would not. `verification_evidence.ts` classifies
      `exit_code_unavailable` as an INSTRUMENT gap that may never refuse, which
      is this step's "a `null` never clears the gate" stated from the other side.
- [x] **2.2 Detector C reads the witness.** Cleared only by a verification recorded after
      `last_edit_at` and not `failed`. The transcript scan stays as the labelled fallback
      for hosts with no `post_tool_use` output.
      verify: fixture G3 — edit, then a `npm test` that exits 1, then stop, is refused
      **ALREADY DONE, and G3 exists and passes** — `turn_end_gate_hook.test.ts`
      "refuses a turn whose record is a FAILING run", an `npx vitest run` with
      `exit_code: 1`, executed 2026-09-30. The record path returns
      `mode: 'record'` with a named reason; the transcript scan remains as the
      labelled fallback, as the step requires.
      **One thing this run changed here.** A sibling test asserted that the
      transcript scan ALLOWED `echo test` — documenting the hole as the contrast
      that justified the record path. Phase 1 closes that hole at the source, so
      both paths now agree and the assertion is inverted rather than removed.
- [x] **2.3 One row per stop-binding host.** Is tool output surfaced on `post_tool_use`, and
      is a failed exit distinguishable. A host where it is not reads "name-match only" in
      the enforcement-by-host page. No row may be inferred; an unprobed host reads `unknown`.
      verify: the evidence page names the observed payload field per row, with the probe date
      **DONE 2026-09-30 — eight rows, one probed, seven `unknown`.** The table is
      in `docs/enforcement-by-host.md` § Detector C's record path and in the
      evidence file. `claude` is a LIVE reading of a real session's witness, not
      a fixture: output surfaced, `exit_code` present, `exit_source:
      "response_shape"`, `after_edits` populated.
      **Its middle column reads `undetermined`, not `yes`, and that is the
      finding.** Across 24 records in that session none carried a non-zero exit
      code — including a command that genuinely failed and is absent from the
      record entirely. `_cap_runs` preserves the earliest failing record by
      design, so eviction does not explain it. Cause unresolved. Writing `yes`
      would have asserted about the HOST what was only shown about the parser,
      which the fixtures do feed non-zero exits to and do classify correctly.
      This is Risk 2's shape reaching further than Risk 2 described: it names a
      host that surfaces NO output, and this is a host that surfaces output for
      passing runs and possibly not for failing ones.
- [x] **2.4 Re-measure before and after.** `measure_turn_end_gate` on the maintainer corpus
      at both ends, with corpus size and date. 1.1 and 2.2 are separate commits so either
      reverts alone.
      verify: both readings committed under `agents/evidence/` with their corpus sizes
      **DONE 2026-09-30.** Same corpus, same instrument, same day, differing in
      the selector and nothing else — the "before" was taken by restoring
      `HEAD~1`'s two files into the working tree and restoring `HEAD` after.
      **30 sessions · 184 turns · 43 of them edited a file.** Detector C:
      **13 turns (7.1 %) → 18 turns (9.8 %)**. A, B, E and F are unchanged, which
      is a check on the measurement rather than a finding — they read the reply
      text and never the command list.
      The sign is the intended one: C fires MORE, because five turns in this
      corpus were clearing an unverified edit on a word match. Recorded with its
      own limits in
      `agents/evidence/analysis/verification-classifier-before-after-2026-09-30.md`
      — it is a fire-rate delta, not a precision reading, and none of the five
      newly-caught turns was hand-labelled.

## Acceptance criteria

- One predicate module exists; `grep -r '_VERIFY_RE\|_VERIFICATION_RE' src/scripts` returns
  only the new module's own definition.
- G1 and G2 each red at the pre-fix commit and pass at the head, demonstrated by the commit
  order, not asserted.
  **MET for G1 by commit order; G2 differently, and the difference is real.**
  G1's ten rows were run and observed red before the predicate changed. G2
  could NOT be shown red the same way: the permissive selector already accepted
  all three of its rows, so G2's red belongs to `_VERIFICATION_RE` — the other
  classifier, in the other file. It was demonstrated by executing that
  expression directly against the three commands (all `false`). Two directions
  of disagreement cannot both be shown by one run against one selector, which
  the criterion's wording did not anticipate.
- A turn that edits a file, runs a verification command that exits non-zero, and stops is
  refused on every host whose 2.3 row says a failed exit is distinguishable.
  **MET VACUOUSLY on 2026-09-30, and the vacuity is the point.** No row says
  `yes`: seven hosts read `unknown` and `claude` reads `undetermined`. So the
  criterion quantifies over an empty set and cannot fail. The mechanism itself
  is proven — G3 refuses exactly that turn shape against a record — but it is
  proven against a FIXTURE, and this criterion asks about hosts. Recorded as
  vacuous rather than ticked, because a criterion that passes by having no
  subjects is the failure `road-to-release-holds-that-refuse` spent a whole
  phase naming elsewhere in this estate.
- No new hook concern, no new per-session store, no new closed-vocabulary member.
- Every number in this file was re-read at the execution head; a moved one is corrected in
  place with its date.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Unifying two classifiers moves two measured fire rates in one commit, and neither delta is attributable | implementation | `_VERIFY_RE` and `_VERIFICATION_RE` disagree in both directions, so replacing both with one predicate changes what two different hooks accept at the same moment. If the combined fire rate moves, nothing in the result says whether the loosened side or the tightened side caused it, and a regression cannot be reverted without also reverting the fix — which is how a correct change gets rolled back wholesale. | Step 1.2 proves sensitivity per regex separately, with G1 red against today's `_VERIFY_RE` and G2 red against today's `_VERIFICATION_RE` before 1.1 lands. Step 2.4 re-measures with `measure_turn_end_gate` at both ends with corpus size and date, and 1.1 and 2.2 ship as separate commits so either reverts alone. | Phase 1 — One predicate, proven sensitive both ways |
| 2 | A host that surfaces no tool output keeps today's name-match behaviour while the page reads as fixed | implementation | Step 2.1 can only record `last_verification.failed` where the host surfaces a tool result on `post_tool_use`, and hosts differ. On a host that surfaces nothing, detector C still clears on a command name alone — exactly the pre-fix behaviour — while the enforcement page shows the mechanism as shipped. The gap is invisible precisely where it matters, because a name-match host looks identical to a working one from the output. | Step 2.3 publishes one row per stop-binding host naming the observed payload field and the probe date, with an unprobed host reading `unknown` and no row inferred. Step 2.1 makes unknown `null` and states that a `null` never clears the gate, so a host without tool output degrades closed rather than silently passing. | Phase 2 — The witness gets a reader, and says when it does not know |
| 3 | Narrowing the predicate turns detector C into a source of false refusals | product | Head-anchoring per shell segment and dropping argument-position matches will refuse commands that genuinely verify — the current `_VERIFICATION_RE` already refuses `npx vitest run`, `tsc --noEmit` and every `./scripts-run src/scripts/lint_*`, all of which the audited fixture accepts. A gate that refuses honest turns gets disabled by whoever meets it, which is the failure the archived `road-to-stop-gate-honesty` was written to prevent. | G2 in Step 1.2 is precisely the false-refusal fixture — those three command shapes — and it must pass at the head, so a predicate that refuses them fails a test rather than shipping. Step 1.1 seeds from the union of both current lists rather than from either alone, and Step 2.4's before-and-after reading on the maintainer corpus is the bar the change has to clear. | Phase 1 — One predicate, proven sensitive both ways |
| 4 | The witness gains a reader and the reader becomes the only path | implementation | Once `verified_this_turn` finally has a consumer, the transcript scan looks like legacy duplication and deleting it is the tidy move. But the witness only carries an outcome where the host surfaces one, so removing the scan would strip detector C of its only signal on every host without `post_tool_use` output — trading a partial mechanism for none on exactly the hosts that had coverage before. | Step 2.2 keeps the transcript scan as an explicitly labelled fallback for hosts with no `post_tool_use` output rather than deleting it, and the label is what stops a later reader mistaking it for dead code. Step 2.3's per-host rows make visible which hosts depend on that fallback, so its removal would be a visible loss rather than an invisible one. | Phase 2 — The witness gets a reader, and says when it does not know |
