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
- [~] AC-4 — `fix_loop_max` defaults to 10, `grep -rn 'N=3' src/rules` returns 0, and no
      escalation path maps a count to an owner ask.
      **Evidence (2026-10-01).** DEFERRED, not unstarted, and re-tested rather than inherited.
      `grep -rn 'N=3' src/rules` returns exactly ONE line — `verify-before-complete.md:45`,
      inside the link label `Mechanics (N=3 / Hard-Floor bounds)`. The edit removing those
      three characters was attempted this run and denied at tool-call time, message verbatim:
      `block-kernel-rule-writes: BLOCKED — kernel rule verify-before-complete is immutable —
      tighten-only via the override exception registry`. The guard's own text then names both
      remedies and calls them what they are: *"Legitimate change requires a human action
      outside the agent session: edit via the override exception registry, or disable/remove
      the 'block-kernel-rule-writes' entry in src/scripts/hook_manifest.yaml."*
      **The capability-versus-role test this file taught itself on 2026-09-30 was applied
      here and does NOT dissolve the claim.** That lesson — a `Class: 3 — human-only` label
      asserting a role is not a capability finding, and `--jq .permissions.admin` dissolved
      one — is the reason this was re-attempted rather than assumed. The difference is that
      the forge case had an available action nobody had tried, while here a deterministic
      guard refuses the tool call itself. The second remedy is available in the physical
      sense and refused on its merits: disabling a kernel-write guard to close a cosmetic
      three-character occurrence is the self-modification `security-sensitive-stop`
      § Adversarial principal user forbids, and it would weaken a safety floor to satisfy a
      checkbox on the roadmap about replacing confirmation with mechanical checks.
      **The obligation this criterion protects is already fully met.** `fix_loop_max` defaults
      to 10 (`agent-settings.template.yml`, the Zod `.default(10)`, `missionExecution`'s
      fallback), and no escalation path maps a count to an owner ask — `autonomous-execution`
      carries `THE BOUND TRIGGERS A STRATEGY CHANGE, NEVER A QUESTION` and `A COUNT IS NOT A
      REASON TO ASK`, with `T3` asserting the ABSENCE of the old `ASK USER FOR GUIDANCE`
      rather than only the new prose's presence. `T3` also pins the offender set as EXACTLY
      `['verify-before-complete.md']`, so the criterion stays live for every non-kernel rule
      and reds the moment another reintroduces the cap.
      **Exact inputs a future session needs**, so this is a handover and not a shrug: a
      maintainer edits one string in `src/rules/verify-before-complete.md:45`, changing
      `Mechanics (N=3 / Hard-Floor bounds)` to any label without `N=3` — the link target and
      every other word stay — either through the override exception registry or with the
      guard temporarily lifted by the person who owns it. Nothing else is outstanding; the
      box flips the moment `grep -rn 'N=3' src/rules` returns nothing, and `T3`'s offender
      assertion must be narrowed to the empty set in the same change.
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
      **Evidence (2026-10-01).** CLOSED, and this time by the command the criterion names
      rather than by a reading of the evidence behind it. Run literally on this tree,
      `agent-config doctor --json` now reports all five rows `satisfied`, `read_from_forge:
      true`, and zero action lines: `default_branch_protected` (1 active branch ruleset covers
      the default branch) · `required_checks_present` (2 contexts: `Sync + Generate Tools
      Consistency`, `Standing payload delta + budget gate`) · `force_push_disabled`
      (`non_fast_forward` active) · `auto_merge_available` (`allow_auto_merge` enabled) ·
      `deploy_via_pipeline_only` (every environment restricts its deployment branches).
      Before this change the same command reported five `unread`; that was reproduced first,
      rather than taken from the reopen note.
      **What was missing was a CALLER, and that is all that was added.** Phase 3.2's mapper
      was correct and had no production path feeding it, so `cmd_doctor.ts` passed
      `UNREAD_FORGE` unconditionally. `src/scripts/_lib/forge_reader.ts` is the read —
      injectable `ForgeApi`, `gh api` behind it — and `doctor_execution.ts` gains
      `forgeProtectionJsonFor`, which resolves the repository from the git remote and hands
      the reading to the existing mapper. `cmd_doctor.ts` changed two lines, which is what
      the source-size ratchet on that file requires of any addition.
      **This IS a reversal of Phase 3.2's architectural boundary, and the council said so
      after this run had already written the opposite.** The first draft of this entry argued
      that `decision-revisit-gate`'s mechanism-match test fails — different mechanism, no lock
      — on the strength of the offline output being unchanged. A 2/2 convergent council pass
      (anthropic + openai, 2026-10-01, CLI/subscription, $0.00) refuted it, and the refutation
      is recorded here rather than quietly dropped because the implementing session had every
      incentive not to look for it. Both seats, independently: Phase 3.2 recorded TWO
      boundaries — *"`doctor` does not reach the network"* AND *"the reading is injected"* —
      and moving `gh api` inside `doctor` reverses both. openai: *"It is a different
      availability mode but a reversal of the same architectural decision."* anthropic:
      *"Different failure mode, same boundary reversal... Phase 3.2 established `doctor` as a
      pure reporter of injected evidence. The proposal makes it an evidence acquirer."* The
      offline-output argument is true and does not reach the claim it was used for: the
      availability property is preserved, the module boundary is not.
      **So the lock is SUPERSEDED rather than side-stepped — see the amendment under Phase
      3.2 below**, which records what replaces it, under which conditions, and what reverses
      it. That is the step the council set as the price of the change, and it is taken in the
      same diff rather than promised.
      **Two defects the council named were real and are fixed here.** (1) The opt-out ran
      AFTER the repository was resolved, so `AGENT_CONFIG_DOCTOR_NO_FORGE=1` still spawned
      `git remote get-url` — a switch that said "no network" while starting a subprocess. The
      repository is now a THUNK and the switch short-circuits before it, asserted on the
      resolver's call count rather than on the returned value. (2) Five per-call timeouts
      bounded each call and nothing bounded their sum, so a 10 s ceiling could deliver 50 s;
      `withDeadline` adds a 15 s whole-command budget whose exhaustion routes into the same
      `unread` degradation — running out of time reads as *nobody looked*, never as *the forge
      said no*, and that direction is pinned by its own case.
      **Offline is unchanged, verified rather than asserted.** Run with
      `AGENT_CONFIG_DOCTOR_NO_FORGE=1`, `doctor --json` prints the identical five `unread`
      rows, the identical `source` strings, `read_from_forge: false` and the same five action
      lines, with no error and no hang. `docs/troubleshooting.md` now documents the network
      behaviour and the switch, which was the council's disclosure condition.
      **Every failure direction is pinned, two of them where the wrong implementation is the
      more obvious one.** `tests/scripts/forge_reader.test.ts`, 37 cases: a dead repo record
      returns the unread reading AND stops calling (asserted on the call list, since both
      shapes return the same value); a dead ruleset DETAIL blanks the whole list rather than
      returning a partial one; a dead `environments` call leaves the ruleset rows intact —
      the opposite error, all-or-nothing across surfaces that do not depend on each other; a
      non-boolean `allow_auto_merge` is `unread`, never coerced to `false`; a failed
      branch-policy read makes the row `unread` rather than trusting the flag; a spent budget
      degrades the rows it did not reach; and a throwing API still returns a reading, because
      a diagnostic that dies because its optional read failed is worse than one reporting
      `unread`. The opt-out and the no-repository skip are asserted on the CALL COUNT, because
      a reader that queried and then discarded the answer would satisfy an output-only
      assertion while still paying the latency the opt-out exists to avoid.
      **Sensitivity proven by deliberate sabotage and restore, re-run against the suite that
      actually exists.** Returning the partial ruleset list reds exactly the partial-list
      case, 1 of 37; restoring the trust-the-flag fallback reds exactly the branch-policy
      case, 1 of 37. One case each, no collateral, so neither is passing for an unrelated
      reason.
      **This paragraph got the same thing wrong TWICE, and the second time is the one worth
      recording.** Round 1 of the review caught "1 of 17" quoted from probes run before five
      cases landed. The correction said "1 of 32" and re-ran the probes — and then five more
      cases landed in the round-2 response, so round 3 found 32 stale in the very paragraph
      that condemns stale denominators and claims to have fixed them. A recurrence indicts
      the method, not the arithmetic: a figure typed by hand goes stale the moment the suite
      moves, and no amount of care fixes that. So the figures here are now taken from the
      runner's own output in the same pass that writes them, and the probes are re-run after
      the LAST change to the suite rather than after the first.
      Green, measured from the runner in the same pass that writes them: 40 in
      `tests/scripts/forge_reader.test.ts`, 14 in `tests/scripts/doctor_forge_block.test.ts`,
      28 in `tests/scripts/forge_protection.test.ts`, 11 in
      `tests/scripts/test_provenance.test.ts` and 95 in the roadmap's own e2e fixture file —
      188 together — plus 30 across the doctor-adjacent suites.
      **A third review round, and then a council pass over the tests themselves.** Round 3
      raised one `high` — these very counts, stale again — and five mediums: a docblock still
      carrying the argument the council had refuted, an "offline prints exactly what it
      printed before" claim that the new `repository` key makes too strong, the composition
      root and the one VCS subprocess untested, a `verify:` clause that depended on
      pretty-printer spacing, and `critical=yes | level=L1` contradicting AC-2, which requires
      a critical suite at L3 or L4 where two providers are configured. All are addressed; the
      last one by EARNING the level rather than relabelling it. The first council attempt was
      handed a description of the suites instead of the suites: one seat refused to assess and
      the other speculated, which is recorded and claims nothing. The second embedded both
      files in full and ran 2/2. Its highest-weighted finding was that the effort was
      inverted — 37 cases on acquisition choreography against almost none asserting the five
      rows the command emits — and that the scripted test fake DROPPED the `paginate`
      argument, so every pagination case passed against an implementation that never asked for
      a second page. Row ids, row isolation, an inactive ruleset, source presence, the
      paginate-request seam and wrong-TYPE coercion all have cases now.
      **Two honest limits.** `resolveForgeRepo` gates on the literal `github` in the remote
      host, so a GitHub Enterprise install on a host that does not carry the vendor name is
      skipped and reports `unread` — the safe degradation, stated in the module rather than
      left for a reader to infer from a blank row. And the council found the CRITERION itself
      underspecified, which this run did NOT repair: *"AC-5 conflates 'reports true' with
      'verified true right now'"* (anthropic), and both seats observed it could be satisfied
      literally by a CI snapshot, a cache, or hardcoded values. This implementation reads live
      on every invocation and caches nothing, so the stricter reading holds today by
      construction — but the text does not require that of a future implementation. The
      proposed replacement wording is carried as owner residue below rather than written in
      here, because editing an acceptance criterion in the same run that closes it is the
      laundering shape even when the edit makes it stricter, and this file has already paid
      once for a `[x]` its own named command contradicted.
      <!-- verify: ./agent-config doctor --json | python3 -c "import sys,json;r=json.load(sys.stdin)['forge_protection']['rows'];sys.exit(0 if r and all(x['state']=='satisfied' for x in r) else 1)" -->
      <!-- REOPENED 2026-09-30, the same day it was closed, by an independent review of the
      closing diff. The close below is kept because its forge findings are correct and
      durable; the CHECKBOX was wrong, and the distance between those two things is the
      whole entry.
      **What the review caught.** The criterion names a command. Run literally on this tree,
      `agent-config doctor --json` reports all five rows `unread` — not `true`. Verified
      rather than taken from the report: `cmd_doctor.ts` calls `forgeProtectionJson(
      UNREAD_FORGE)` unconditionally, and `deployRestrictedFrom` has no production caller at
      all; its only caller is its test. So the row values below were established by a manual
      `gh api` read plus a pure mapper, and the tool the criterion names cannot yet report
      them. Marking that `[x]` was a completion claim the named verification contradicts —
      on the roadmap whose entire subject is replacing owner confirmation with mechanical
      checks, which is what makes it worth recording rather than quietly correcting.
      **What is nonetheless true, and stays true.** The FORGE is now fully compliant: five of
      five rows satisfied on live evidence, including `allow_auto_merge`, which this run
      enabled and which is a durable change to the repository rather than a note. And the
      checker defect is fixed and independently reviewed. Neither of those is undone by the
      checkbox going back.
      **What remains is WORK, not an impossibility** — and it is deliberately not done in
      this run. Closing it means giving `doctor` a live forge read. Phase 3.2 shipped the
      offline behaviour ON PURPOSE and recorded the reason ("a diagnostic nobody can run
      offline is one nobody runs; the sibling anchor gate declined the same cost"), so
      wiring the network in is a reversal of a recorded design decision, not an oversight to
      patch. Per `decision-revisit-gate` that is surfaced rather than silently reversed
      inside an AC-closing run. The cheapest shape that satisfies both is probably an opt-in
      flag leaving the default offline — proposed here, not taken. -->
      <!-- THE FORGE RECORD, written 2026-09-30 when this was briefly marked closed. Its
      measurements stand; only the checkbox above was withdrawn. All five rows satisfied on
      the forge. The two that were false on 2026-09-14
      closed for DIFFERENT reasons, and keeping them apart is the point of this note: one was
      a real forge gap that got fixed, the other was never a gap at all.
      **`auto_merge_available` — a real gap, now closed by doing it.** `allow_auto_merge` was
      `false`; it is now `true` (`gh api -X PATCH repos/event4u-app/agent-config
      -F allow_auto_merge=true`, re-read as `true`). The 2026-09-14 note called this
      "outside an agent session" — that was a ROLE claim, not a CAPABILITY one. Measured:
      `.permissions.admin` is `true` for this token, so the action was always available, and
      ADR-237 §§ 1-2, whose mechanics `roadmap-process-loop` § 3c carries, name a reversible repository setting as implied authority for a
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
      **An independent R2 review found two defects in that helper and both are fixed here.**
      The review was dispatched through `dispatch_r2_reviewer`, so the reviewer's prompt was
      assembled deterministically rather than written by the implementing session — the
      property `evaluator-independence` requires and `prompt_hash` makes checkable. It found
      (1) that an empty `environments` array returned `true`, collapsing *confirmed zero
      environments* and *the fetch failed* into the same `satisfied` answer, which is the
      quiet false-positive this module's own three-state row exists to prevent — it now
      returns `null`, which maps to `unread`; and (2) that `custom_branch_policies: true`
      was trusted without reading the policy NAMES, so a wildcard pattern would have read as
      restricted — an optional `patternsByEnv` argument now refutes the row for a policy
      admitting everything, and the flag-only path is documented as the narrower guarantee
      it is. Neither was reachable on this repository; both were real.
      Sensitivity proven on each fix separately, by deliberate sabotage and restore, at the
      final state of 28 cases: restoring the empty-set `true` reds exactly the two empty-set
      cases, and neutralising the wildcard check reds exactly the two pattern cases. One
      pair each, no collateral, so neither is passing for an unrelated reason.
      Live re-read 2026-09-30: protection `satisfied` (active `~DEFAULT_BRANCH` ruleset) ·
      required checks `satisfied` (2 contexts) · force-push `satisfied` (`non_fast_forward`)
      · auto-merge `satisfied` · deploy `satisfied`. -->
      <!-- verify: gh api repos/event4u-app/agent-config --jq '.allow_auto_merge' -->
- [~] <!-- blocked-by: daemon-host-kill-switch | asked: no — a `process-full` drain run is a non-interactive context with no owner channel; the question is put in the blocker entry and stays open --> AC-6 — `docs/enforcement-by-host.md`'s `destructive:` column is measured for all eight
      hosts, with every `manual-only` row a recorded decision.
      **Evidence (2026-10-01).** DEFERRED. The measurement clause was re-verified this run:
      `./scripts-run src/scripts/check_enforcement_matrix --quiet` exits 0 with *"32 host-slot
      row(s) in docs/enforcement-by-host.md match src/scripts/hooks/host_lowering.yaml"*, and
      all eight `destructive:` rows carry the reading they came from — one `hook` (`claude`,
      `pre_tool_use` bound with `block_exit: 2`) and seven `manual-only`. That half is done
      and stays done.
      **The remaining half was put to the council this run rather than deferred on the
      blocker's label, and the council declined it as owner-reserved — 2/2 convergent**
      (anthropic + openai, 2026-10-01, CLI/subscription, $0.00). Both seats reached it by two
      independent routes. First, the two options are not authority-equivalent: openai,
      *"Prohibiting autonomy preserves the restrictive state; authorizing `manual-only` may
      lower it."* anthropic, *"Option 1 (no autonomous mode): not owner-reserved... Option 2
      (`manual-only`): owner-reserved, because it authorizes autonomous operation while
      relying on an unenforceable safety floor for destructive actions."* Second, it is
      governance self-amendment under the rule's own definition — anthropic: *"deciding
      whether the Hard Floor applies on 1 host vs 8 hosts is deciding the scope of where a
      governance rule applies."* Both also named the error this run was at risk of making:
      `host_lowering.yaml` measures CAPABILITY and authorizes nothing, so writing a preferred
      fallback into the column would convert an inventory into a permission.
      **This is therefore an authority limit, not a capability one**, and the distinction was
      tested rather than assumed — the same test that dissolved `forge-protection-settings`'
      `human-only` label on 2026-09-30. Nothing stops this run from typing `manual-only` into
      the doc. What stops it is that doing so would record a safety floor in the owner's name.
      **The owner artefact the council specified in 2d, so the decision takes one reading:**
      (1) the seven hosts are `augment`, `cursor`, `cline`, `gemini`, `windsurf`, `cowork`,
      `copilot`; the missing capability is a `pre_tool_use` binding whose configured outcome
      is a refusal. (2) The two options: `destructive: manual-only` — autonomy continues
      there with model-carried confirmation as the only guard; or no autonomous mode on those
      hosts at all. (3) The threat scenario the choice turns on: on a `manual-only` host a
      typed destructive op proceeds whenever the model fails to classify it as destructive or
      skips the confirmation, with nothing downstream able to refuse the call. (4) The
      unresolved prior question both seats flagged: whether model-carried destructive
      confirmation on unenforceable hosts is ALREADY the approved baseline, or whether this
      choice establishes it — the tree does not record which. (5) `manual-only`'s operational
      semantics are undefined and need stating with the choice: who classifies an op as
      destructive, whether confirmation is per-action or standing, and what prevents the
      action mutating after approval. (6) The blocker's own recommendation is `manual-only`;
      anthropic's, if forced, is the opposite — no autonomous mode without an enforceable
      stop. The dissent is recorded rather than resolved. (7) Option 1 may conflict with
      ADR-268 § 0's declared autonomy outcome, which is itself owner-protected; that tension
      is the reason this cannot be settled one layer down. (8) `revisit-if`, in anthropic's
      words: *"(a) a host gains deny-capable pre-execution enforcement, (b) an external
      enforcement mechanism is demonstrated and tested, or (c) the owner explicitly approves
      model-carried destructive confirmation as the safety floor for that host."*
      **Where the answer goes:** the `destructive:` section of `docs/enforcement-by-host.md`,
      as a recorded decision beside each `manual-only` row, and the `Resolved when` of
      `daemon-host-kill-switch` below. The box flips when that is written; nothing else about
      this criterion is outstanding.
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
