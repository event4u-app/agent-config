## Acceptance Criteria

- [x] AC-1 — `T1`-`T10`, `G8` and `G9` exist under `tests/e2e/` and are green.
      <!-- closed 2026-09-14. `tests/e2e/adversarial-verification-fixtures.test.ts`, 74 green.
      `T2`-`T5`, `T7`, `T8`, `G8` and `G9` landed with their phases on 2026-09-13; the four
      this criterion was still waiting on — `T1`, `T6`, `T9`, `T10` — landed here over the
      modules their phases shipped (`continuation_ladder`, `mission_record`, `typed_op_grant`,
      `council_transport`).
      **Each of the four pins the direction its mechanism could plausibly have gone wrong**,
      which is the bar Phase 2.3 sets and the reason a fixture restating an implementation line
      is not evidence. `T1` asserts the ladder's WHOLE action vocabulary carries no rung
      matching `/ask|question|confirm|owner/` — a count mapped to an ask is what Phase 4.1
      removed, and the union is where it would come back. `T6` asserts a twelve-hour gap
      exceeds `WALL_CLOCK_CAP_MS` by more than 2× and still resumes: the wrong implementation
      expires the MISSION record with the RUN's wall clock. `T9` asserts a confirmed ask naming
      a category is still `ask-required` — the wrong implementation reads the `confirmed`
      boolean and never reads what was named. `T10` asserts an estimate exactly AT the ceiling
      is within it, and that `renderReport` emits no `?` anywhere.
      **Sensitivity proven on two, by deliberate sabotage and restore**: neutralising
      `restore`'s ledger-revocation branch reds exactly `T6`'s withdrawn-grant case, and
      turning `<=` into `<` in `routeCouncil` reds exactly `T10`'s at-the-ceiling case — one
      test each, no collateral, so neither is passing for an unrelated reason. -->
      <!-- verify: npm run test:ts -- tests/e2e/adversarial-verification-fixtures.test.ts -->
- [x] AC-2 — independent test provenance is recorded per test, and critical tests are at L3 or
      L4 wherever two providers are configured.
      <!-- closed 2026-09-14. Phase 2.1 shipped the LEVELS; it shipped no place to write one
      down, so until now the level a given test reached was unrecorded and therefore
      uncheckable — the same shape as the recorded failure `evaluator-independence` exists
      over, a verdict nobody could trace back to the prompt that produced it.
      **The record** is a marker line directly above each `describe` — `// provenance:
      level=L4 | critical=yes | evidence=<slug>` — parsed by `_lib/test_provenance.ts` (pure,
      11 unit tests). Three decisions with plausible opposites: an unmarked group is
      `ungoverned` and never defaulted to L0, because defaulting would make "provenance is
      recorded per test" true by construction; the provider count is a PARAMETER rather than a
      probe, since `council:status` resolves from a user-global file a CI runner does not have
      and probing would relax the floor exactly where the obligation matters; and `evidence` is
      required at L3/L4 and ignored below, because an unattributed claim of independence
      cannot be checked for the independence it claims.
      **The independence is real and was bought, not asserted.** `council:status` reports two
      providers (`anthropic`, `openai`), so the reachable level is L4. Three peer-reviewed
      runs, `2/2 present` AFTER each — scoped by the 51,200-byte bundle ceiling, covering every
      group in the file between them. Nine convergent findings were folded in the same day:
      `T1`'s first test was a tautology passing against a `findingFor` that always returned
      null; `terminalStateFor(halt) !== null` passed against a map sending every halt to
      `success`; the ask-regex was evaded by a rung named `escalate`; `T6` used `Date.now()`,
      which made its boundary cases unwritable, and asserted the ledger precedence in one
      direction only and one field of fourteen; `T7/T8` tested five of eleven delivery states,
      so an implementation recognising only those five passed. `G9` was RENAMED — its title
      claimed "test-first across two sessions" while its own body conceded the gate cannot see
      a session boundary, which both seats called a title-body contradiction.
      **Four findings are NOT folded in, and the reason is stated rather than implied.** They
      are defects in the authority IMPLEMENTATION (`objectIsExact` accepts `!!!!!!!!` and
      `all-branches` as exact objects; `op` is never validated; `confirmed` carries no turn
      provenance; `restore` ignores `ledger.grant`), and `security-sensitive-stop` puts a
      threat pass before the first edit to a surface like that. They ship as
      `road-to-authority-object-exactness` — the tracked-follow-up disposition, not a note.
      Full record incl. the prompts and what the pass did not close:
      `agents/evidence/analysis/ac2-independent-test-authorship-2026-09-14.md`.
      **The honest limit**, stated there and worth repeating: L4 means a multi-provider council
      participated as an evaluator on that group. It does not mean the group was independently
      authored end to end, and reading the marker that way would over-claim. -->
      <!-- verify: npm run test:ts -- tests/scripts/test_provenance.test.ts -->
- [x] AC-3 — `check_test_delta` and `check_test_weakening` run in `ci-fast`, and this
      repository is green under them at promotion or ratcheted from a measured baseline.
      <!-- closed 2026-09-14, VERIFIED rather than assumed: both halves were re-read on this
      tree rather than taken from Phase 2.4's landing note.
      Registration: `taskfiles/ci-fast.yml` carries `check-test-delta` and
      `check-test-weakening`; `Taskfile.yml`'s `ci` aggregate calls both; `.github/workflows/
      tests.yml` runs both under `static-checks` with the same `--quiet` argv the Taskfile
      uses, which is the identical-argv condition a gate registration owes.
      Green: both run clean on this tree — `scanned=0` on an empty diff, which is the honest
      reading of a diff-scoped gate with nothing yet to scan, and `0 code path(s)` /
      `no net weakening` on the working diff.
      **No ratchet entry, and that is the correct shape for these two.** Both are DIFF-scoped:
      they measure the change under review, never a tree-wide population, so there is no count
      to ratchet down and a baseline file would pin a number that is zero by construction on
      every clean branch. "Green at promotion" is the branch this criterion takes. -->
      <!-- verify: ./scripts-run src/scripts/check_test_delta --self-test -->
- [ ] AC-4 — `fix_loop_max` defaults to 10, `grep -rn 'N=3' src/rules` returns 0, and no
      escalation path maps a count to an owner ask.
      <!-- OPEN 2026-09-14 — two of three clauses are met and the third is agent-impossible.
      MET: `fix_loop_max` defaults to 10 (`agent-settings.template.yml:760`, the Zod schema's
      `.default(10)`, and `missionExecution`'s fallback). MET: no escalation path maps a count
      to an owner ask — `autonomous-execution` carries `THE BOUND TRIGGERS A STRATEGY CHANGE,
      NEVER A QUESTION` and `A COUNT IS NOT A REASON TO ASK`, the old `ASK USER FOR GUIDANCE`
      and `DO NOT ITERATE BEYOND` are gone, and `T3` asserts their absence rather than only
      the new prose's presence.
      NOT MET, and not by an agent: `grep -rn 'N=3' src/rules` returns ONE, in
      `verify-before-complete.md` — one of the nine kernel rules. The edit was ATTEMPTED on
      2026-09-14 and refused at tool-call time: `block-kernel-rule-writes: BLOCKED — kernel
      rule verify-before-complete is immutable`. Reproduced, not assumed, and the denial names
      its own remedy: a human action outside the agent session, via the override exception
      registry. The occurrence is a pointer in a mechanics link — `Mechanics (N=3 / Hard-Floor
      bounds)` — so the obligation this criterion protects is already satisfied everywhere the
      cap could bind; what is left is a stale three characters in a file no agent may open.
      `T3`'s fixture asserts the offender set is EXACTLY `['verify-before-complete.md']`, which
      keeps the obligation live for every non-kernel rule and reds the moment another
      reintroduces the cap.
      **RE-REPRODUCED 2026-09-30, and the second route was checked and refused.** The edit was
      attempted again this run and denied at tool-call time with the same message:
      `block-kernel-rule-writes: BLOCKED — kernel rule verify-before-complete is immutable —
      tighten-only via the override exception registry`. The denial names two remedies and both
      are human: the override exception registry, or removing the guard's entry from
      `hook_manifest.yaml`. The second was considered and REFUSED rather than left unmentioned —
      disabling a kernel-write guard to satisfy an acceptance criterion is precisely the
      self-modification `security-sensitive-stop` § Adversarial principal user forbids, and it
      would weaken a safety floor to close a cosmetic three-character occurrence. The remaining
      distance is a stale string in a mechanics link label, not a live cap: the obligation this
      criterion protects is already satisfied everywhere the bound binds. -->
      <!-- verify: grep -rln 'N=3' src/rules -->
- [x] AC-5 — `agent-config doctor --json` reports every `forge_protection` row true on this
      repository.
      <!-- closed 2026-09-30. All five rows satisfied. The two that were false on 2026-09-14
      closed for DIFFERENT reasons, and keeping them apart is the point of this note: one was
      a real forge gap that got fixed, the other was never a gap at all.
      **`auto_merge_available` — a real gap, now closed by doing it.** `allow_auto_merge` was
      `false`; it is now `true` (`gh api -X PATCH repos/event4u-app/agent-config
      -F allow_auto_merge=true`, re-read as `true`). The 2026-09-14 note called this
      "outside an agent session" — that was a ROLE claim, not a CAPABILITY one. Measured:
      `.permissions.admin` is `true` for this token, so the action was always available, and
      ADR-237 § 3c names a reversible repository setting as implied authority for a
      `process-full` run while the forbidden-non-halt list names "a GitHub setting must
      change" as work. Enabling the setting grants nothing: auto-merge still queues behind
      the two required contexts and the ruleset's `non_fast_forward` entry. The blocker's own
      recommendation was "enable all five".
      **`deploy_via_pipeline_only` — never a gap; the 2026-09-13 reading was wrong.** That
      table recorded "it accepts a deployment from any branch" from
      `protected_branches: false`, without reading the policy LIST. Read here:
      `environments/github-pages/deployment-branch-policies` returns `total_count: 1`, the
      single policy `main` — so the environment accepts deployments from `main` ALONE, and
      Pages is `build_type: workflow` with `source.branch: main`. The environment was already
      restricted to the protected trunk; only the checker could not see it.
      **Fixed as code, not as a forge change, and the choice is deliberate.**
      `deployRestrictedFrom` (`_lib/forge_protection.ts`, 8 tests) now derives the row from
      BOTH mechanisms instead of one. Switching the forge to `protected_branches: true`
      was considered and REFUSED: the effective set would be identical (`{main}`), while on
      a ruleset-protected repository `protected_branches` resolves against the notion of
      protection whose classic endpoint 404s here — trading a precise one-branch restriction
      for the exact ambiguity this blocker was re-scoped over, with a live Pages deployment
      as the blast radius. A correct checker over a correct setting beats a riskier setting
      that flatters a naive checker.
      Sensitivity proven rather than claimed: narrowing the derivation back to
      `protected_branches` alone reds exactly 2 of 22 — the custom-policy case and the row
      it feeds — and nothing else.
      Live re-read 2026-09-30: protection `satisfied` (active `~DEFAULT_BRANCH` ruleset) ·
      required checks `satisfied` (2 contexts) · force-push `satisfied` (`non_fast_forward`)
      · auto-merge `satisfied` · deploy `satisfied`. -->
      <!-- verify: gh api repos/event4u-app/agent-config --jq '.allow_auto_merge' -->
- [ ] <!-- blocked-by: daemon-host-kill-switch | asked: no — a `process-full` drain run is a non-interactive context with no owner channel; the question is put in the blocker entry and stays open --> AC-6 — `docs/enforcement-by-host.md`'s `destructive:` column is measured for all eight
      hosts, with every `manual-only` row a recorded decision.
      <!-- OPEN 2026-09-14 — the MEASUREMENT half is complete, the DECISION half is
      owner-reserved and that is the whole remaining distance. All eight rows carry a value
      and the reading it came from (`host_lowering.yaml`, 2026-09-13): one `hook`, seven
      `manual-only`, and the four distinct states inside those seven kept apart rather than
      collapsed. `daemon` is in the vocabulary and describes nothing, which the doc says
      rather than leaving as an unreachable value a reader would take for a live option.
      What is missing is not a measurement. `daemon-host-kill-switch` is Class 3, human-only,
      and its question is what the FALLBACK should be on a host with no process-level stop:
      `manual-only`, or no autonomous mode there at all. The doc currently records what layer
      exists, which is an observation; "a recorded decision" is the owner choosing between
      those two, and an agent recording a preference as a decision would be taking it in the
      owner's name. The blocker's own recommendation is `manual-only`; it is not this run's to
      accept. -->
      <!-- verify: ./scripts-run src/scripts/check_enforcement_matrix --quiet -->
- [x] AC-7 — a throttled four-phase long-run fixture ends merged, with one continuity resume
      and zero owner asks.
      <!-- closed 2026-09-14 as the `AC-7` describe in
      `tests/e2e/adversarial-verification-fixtures.test.ts`. Every other fixture in that file
      pins ONE mechanism; this one pins the COMPOSITION, which is where this roadmap's actual
      claim lives — that a run can cross more wall-clock time than any single run may spend and
      still reach `merged` without spending one owner question on it.
      **The two modules have to disagree about scope for that to work, and they do.**
      `continuation_ladder` bounds ONE run (25 iterations, four hours) and a run that hits
      either bound reports `exhausted` — a budget word. `mission_record` carries the MISSION,
      which is longer than a run by construction. Collapsing them is the plausible wrong
      implementation in both directions: a ladder that never halted is the unbounded loop K1
      killed, and a record that expired with the run's wall clock makes a long run impossible
      and every resume an owner interrupt.
      The fixture runs phases 1-2 under one clock, stops run A at `halt-wall-clock` five hours
      in, asserts that rung maps to `exhausted` and NOT to `blocked` — a `blocked` here would
      route a nameable continuation to the owner-owned rung, which is Phase 4.1's
      count-to-an-ask move under a different name — restores twelve hours later with the
      decisions closed, and runs phases 3-4 under a FRESH clock to `merged`. Total span 14h
      against a 4h per-run cap, asserted rather than left for the reader to add up.
      **One negative and one sensitivity.** Zero-open over `ci-red` still returns `engage`, so
      four phases of flipped checkboxes over a red CI is not an ending. And a record carrying
      no decisions closes nothing, which is what makes the resume load-bearing rather than
      decorative. Neutralising the ladder's wall-clock branch reds this fixture's halt case
      (plus one pre-existing T7/T8 case that pins the same branch) and nothing else. -->
      <!-- verify: npm run test:ts -- tests/e2e/adversarial-verification-fixtures.test.ts -->
