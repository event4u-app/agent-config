---
complexity: structural
status: ready
---

# Road to gates that can fail — make every check prove it read something

> 9.9.0 needed four CI round-trips. Underneath that, an audit found **14
> deterministic gates that scan zero files and exit 0 with a green checkmark** —
> including the guard that is supposed to detect edits to the four safety-floor
> rules. Evidence + reproduction:
> [`gates-that-cannot-fail`](../settings/contexts/gates-that-cannot-fail.md).

## Goal

Make it impossible for a check in this package to report success without having
read real input, and make the release-gated checks fail on the PR that causes
them instead of at release time. Extend existing gates and tests; add no new
governance layer.

## Context (measured 2026-07-29, do not relitigate)

- **190 `lint_*`/`check_*` scripts** exist; ~170 are wired into CI or Taskfiles.
- **14 confirmed dead** — scan root missing or empty, silently treated as
  "nothing to check". They print the zero themselves
  (`0 file(s) scanned`, `0 name(s) checked`, `0 declarer(s)`); nothing asserts
  on it.
- **Root event:** ADR-051 moved the source container and a later commit deleted
  `packages/`. Gates using the shared resolver (`_lib/agent_src.ts`) survived;
  gates with a hardcoded literal path did not. The migration had no scan-root
  checklist.
- **Why the tests did not catch it:** every dead gate is tested through an
  injection seam (`mkdtempSync` + explicit root override) that production never
  uses. The algorithm is proven; the default entry point is not.
- **Second class:** gates wired only to `release/*` / `schedule` /
  `workflow_dispatch` are unexercised until a release. 9.9.0 hit four at once.
- **The gates that DO work caught a real consumer-facing regression** (a
  `files[]` narrowing that would have shipped two dead router pointers). Run
  them earlier; never relax them.

> **Scope boundary.** This is NOT the rejected enforcement-first architecture
> (locked 2026-07-26, revisit gated on hook budget + usage-distribution
> evidence). That lock is about replacing prose with compiled enforcement; this
> is about making the deterministic gates that already exist demonstrate they
> executed. Different mechanism — the lock does not apply. It extends ADR-127's
> thesis ("pointer resolves ≠ claim true") to the gates themselves.

## Phase 1 — Zero-scope is a failure (the one change that kills the class)

- [x] Add a shared scope-assertion helper and route every gate's exit through
      it: a gate that examined **0 units** exits non-zero with
      `scanned 0 <units> under <root> — scope is dead or the root moved`,
      unless it declares an explicit, justified `allowEmpty` reason (a gate that
      legitimately has nothing to check, e.g. an optional consumer surface).
      *Verify:* running the six known-dead gates turns them red without any
      other change; a gate with a legitimately empty optional root stays green
      and its justification is visible in the source.
      <!-- done 2026-07-29 — `src/scripts/_lib/scan_scope.ts` ships two shapes:
      `assertScanned` for corpus gates (0 units → DeadScopeError) and
      `assertWatchlistResolves` for diff-based guards with no corpus to count
      (watch list resolving to nothing → DeadScopeError). Both name the gate and
      the root in the message. Proven live: pointing the repaired
      `check_iron_law_prominence` at `.agent-src.uncondensed/rules` now exits 2
      with "scanned 0 rule file(s) … the scan scope is dead or the root moved",
      where it previously printed "✅ clean (0 file(s) scanned)".
      SCOPE HONESTY: "route EVERY gate" is NOT done — the helper is wired into
      the 3 gates repaired in this pass. Routing the remaining ~187 is open work
      and is why this step's own wording overreaches what landed. -->
- [x] Publish the scan-scope census as a committed report: for each of the ~190
      gates, its scan root(s) and the unit count on a clean tree. This is the
      artefact that makes a future root-move visible in a diff.
      *Verify:* the report exists, every row has a root and a count, and the
      count matches a fresh run.
      <!-- partial 2026-07-29 — the census existed as a HAND-WRITTEN audit of the
      14 confirmed-dead gates. It could not meet its own acceptance criterion
      ("every row has a root and a count") for the population, and prose cannot
      "match a fresh run" because nothing re-runs it.
      done 2026-08-02 — the census is now GENERATED:
      `./scripts-run src/scripts/sweep_dead_scan_roots --census agents/evidence/reports/gate-scope-census.md`.
      Verify line met by construction — the file is the output of the run it is
      supposed to match, so `git diff --stat` on it IS the check, and that command
      is in the report's own Reproducing section.
      Current measurement: 213 gate scripts · 117 with at least one resolvable
      root · 229 roots resolved and counted · 15 roots that do not exist.
      TWO EXTRACTOR GAPS CLOSED so the census would not punish the correct fix:
      (a) a gate reaching its root through the shared resolver (`SRC_SKILLS()`)
      was invisible to a literal-only extractor, so repairing a gate the way this
      roadmap PREFERS would have made it vanish from the census; (b) a permissive
      census-only pass now resolves string-const path segments
      (`const SOURCE_DIR = 'src'` + `path.join(REPO, SOURCE_DIR)`), which the
      strict finding extractor cannot see. The permissive pass keeps only roots
      that EXIST, so it can never manufacture a dead-root finding — precision
      stays where red exits are decided, recall goes where the record is.
      HONEST LIMIT, stated in the report itself: 89 of 213 gates expose no literal
      root to a static reader (config-driven roots, glob-library walks,
      template-literal paths). They are LISTED as `(no literal root extracted)`,
      never omitted — a census that silently dropped the gates it could not read
      would claim coverage it does not have, which is this roadmap's own failure
      mode. The unit count is files under the root, not the gate's internal unit:
      a movement detector, not a gate-internal assertion. -->
- [x] Fix the 14 confirmed-dead scan roots to the real ones
      (`src/rules`, `src/skills`, `src/domains/**/command.md`,
      `src/agent-src/personas`, …), preferring the shared resolver over new
      literals. Expect real, previously-invisible violations to surface — triage
      them, do not suppress them.
      *Verify:* each repaired gate reports a non-zero scan count, and its
      findings (or clean verdict) are against real artefacts.
      <!-- done 2026-08-02 — 14 repaired; `sweep_dead_scan_roots` reports
      **0 class-A, 0 stale, exit 0** on the shipped corpus, down from 13 class-A.
      Scanned before → after: lint_handoffs 0→320 · lint_namespace 0→620 ·
      lint_artefact_frontmatter 0→618 · lint_command_verbs 0→192 ·
      lint_media_policy_linkage 0→7 policies/651 referrers · audit_user_type_axis
      0→288 · audit_cloud_compatibility 0→730 · audit_likelihood 0→24,371 tokens ·
      lint_pack_boundaries 0→753 artefacts across 34 packs. Four more were live
      but carried a dead branch or a dist-masked root; removing those branches is
      what proves they were dead. Every repaired gate routes its exit through
      `_lib/scan_scope.ts`.
      ONE OUTSIDE THE 14, found by the same reasoning: `lint_originality_shingles`
      rooted personas at `src/personas` and an `existsSync` guard turned that into
      a silent drop — it compared 288 skills while its header promised skills,
      personas AND subagents. Now 323 documents. It escaped the class-A sweep only
      because its literal carries no retired-container prefix, which is a limit of
      the mechanical triage, not of the defect class.
      TRIAGE, per the council's disposition rule — not suppressed:
      · FIXED: the one genuinely dangling handoff link; the two quarantine
        contradictions (a predicate testing bare key names, not the ADR-013 object
        shape — no data was changed).
      · NARROWED because the finding proved the RULE wrong, not the tree:
        `lint_artefact_frontmatter` 1523 → 0, ADR-013 amended in the same change
        rather than silently overridden.
      · BASELINED with the 56-day expiry: lint_handoffs 18 · audit_user_type_axis 1
        · lint_pack_boundaries 337 · check_no_new_legacy_path 56.
      · LEFT OPEN, named: `lint_command_verbs --all` flags `analyze`/`mission` as
        unapproved leading tokens on pre-existing commands; ADR-041 §5 requires an
        ADR to add a verb, so it is neither fixed nor baselined. CI runs diff-mode.
      · NOT DONE, smaller than specified: the three manifest-less pack ids need no
        `pack.yaml` — every manifest is generated from `packs.yml`, which already
        carries their `requires` canonically. Hand-writing one turns
        `generate_pack_manifests --check` red; proven and reverted. -->

**Exit:** no gate in the package can report success while having read nothing.
**Rollback:** the helper is one call per gate; reverting is mechanical.

## Phase 2 — Repair the safety-floor guard first, and un-pin its test

- [x] `check_safety_floor_untouched.ts` is the highest-severity instance: it
      compares diffs against `.agent-src.uncondensed/rules/<name>` while the
      four floor rules live in `src/rules/`, and reports
      `✅ Safety-floor untouched (4 rules guarded)` — a false count. Repoint it,
      and **delete the test assertion that pins the dead path**
      (`tests/scripts/check_safety_floor_untouched.test.ts:25`), replacing it
      with the behavioural test below.
      *Verify:* modify `src/rules/commit-policy.md`, run the guard → non-zero,
      naming the file; revert → green. Both directions asserted in the test.
      <!-- done 2026-07-29. Root is now `['src/rules', '.agent-src.uncondensed/rules']`
      — legacy RETAINED on purpose because this gate diffs a baseline against
      HEAD and a pre-ADR-051 baseline still names the old path. The success
      message reports the RESOLVED count, and `assertWatchlistResolves` makes a
      watch list that resolves to nothing a hard error instead of a clean bill.
      CORRECTION TO THE ORIGINAL VERIFY LINE, worth recording: "modify the file
      and run the guard" does NOT work and never did — `_changed_files` uses
      `git diff baseline...HEAD`, a COMMIT range, so a working-tree edit is
      invisible to it. The first attempt at this proof was therefore vacuous.
      The gate was made testable by parameterising the head ref (`--head`,
      default HEAD, additive) and extracting the pure `_breaches()`. Proven
      end-to-end against real history at 259bb1b (a commit that edits
      `src/rules/commit-policy.md`): range WITH it → exit 1 naming the file;
      range WITHOUT → exit 0. Test suite rewritten from 2 constant assertions to
      8 behavioural ones, both directions plus a watch-list-resolves lock;
      mutation-checked — reverting the root repair fails 4 of 8. -->
- [x] Sweep the other three floor-adjacent guards named in the census for the
      same false-count shape (a success message that reports a guarded/checked
      quantity the gate did not actually derive from input).
      *Verify:* every success message's number traces to a counted unit.
      <!-- done 2026-07-29 — swept `src/scripts/*.ts` for success messages whose
      count comes from a constant rather than from read input
      (`grep -rnE '✅.*\$\{[A-Z_]+\.length\}'`). Two hits, both verified SOUND,
      not defects: `check_generated_artefact_headers` is warn-only by design
      (prints ⚠️ findings, exits 0 deliberately), and
      `check_generator_output_coverage`'s constant list IS its corpus — the
      thing being classified. So `check_safety_floor_untouched` was the only
      genuine false-count instance. Recording the two cleared candidates so the
      sweep is not repeated blind. -->

**Exit:** the safety-floor tamper guard demonstrably fails on a tampered floor
rule.

## Phase 3 — Test the invocation CI actually runs

- [-] Add a default-entry-point test per gate: invoke the gate the way
      `scripts-run`/CI invokes it (no injected root) against the real tree and
      assert a non-zero scan count. This is the check that would have caught all
      14 at authoring time; the existing injected-root tests stay as the
      algorithm proof.
      *Verify:* reverting any Phase-1 root repair turns its default-entry test
      red.
      <!-- PARTIAL 2026-08-02 — the mechanism already existed and was EXTENDED rather
      than duplicated: `check_gate_coverage` + `src/config/gate-coverage.yml` run
      gates with CI-identical argv against the real tree and assert a baseline floor.
      Verify line MET: reverting `check_augment_description_cap`'s root repair turns
      both the coverage guard and the default-entry test red (`expected 0 to be
      greater than 50`), restored → green at `scanned 98 ≥ 80`.
      HONEST DENOMINATOR: 8 of 211 gates. Only 8 emit the machine-readable
      `scanned: <N>` line the guard parses, and all 8 are now registered — the
      manifest is complete with respect to its own contract, not with respect to the
      population. Padding it would manufacture the false green this roadmap exists to
      kill. A new registry test fails the build the moment a gate starts emitting the
      line without being listed; it found the 8th (`check_ci_local_parity`) already.
      THE GAP IS ONE LINE PER GATE, not a mechanism: seven gates already compute the
      count for `assertScanned` and need only also print it. That is the follow-up.
      SUPERSEDED 2026-08-04 — re-glyphed `[~]` → `[-]`. A deferred marker made this
      roadmap read complete-but-parked and would have forced an archival disposition
      question that is really just "this goal was not reached at population scale".
      The named follow-up was DISCHARGED as far as it honestly goes: the five gates
      that already held a real count now print it (`audit_skill_overlap`,
      `check_iron_law_prominence`, `lint_handoffs`, `lint_namespace`,
      `lint_artefact_frontmatter`), taking coverage 17 → 22 entries, every one
      clearing its floor. The sixth named gate, `check_safety_floor_untouched`, was
      deliberately NOT converted: it is the one watch-list guard, so its count is a
      fixed guard-list size (4), and a floor under a constant can never trip — that
      is the false-count shape Phase 2 repaired, and re-creating it to raise a
      coverage number would be the manufactured green this roadmap exists to kill.
      `skill_linter` already emitted. The remaining ~201 need their unit INVENTED
      rather than published, which is per-gate judgement, so the step's universal
      form moves to road-to-gate-hardening-adoption where the exposure count is
      ratcheted rather than estimated. -->
      <!-- Also fixed here, found by registering these gates under their REAL argv:
      `lint_handoffs` read `args[0]` as a positional path, so the CI invocation
      (`--quiet`, injected by Taskfile's QUIET_FLAG) resolved the flag as its skills
      root, scanned 0 and exited 2. `task lint-handoffs` was RED on trunk while a
      bare probe was green — the inverse of this roadmap's defect: loud, but only
      where nobody looked. Regression-tested through `main(['--quiet'])`. -->
- [x] Add the missing violation tests for the gates classified `happy-path-only`
      (`check_safety_floor_untouched`, `check_augment_description_cap`, plus any
      the census adds): construct a real violation, assert rejection.
      *Verify:* each new test fails when the gate's logic is neutered.
      <!-- done 2026-08-02 — both named gates now have a violation test through the
      real entry point, where every prior assertion was on exported pure helpers.
      `check_augment_description_cap` got a minimal additive `--root` seam (its
      RULES_DIR is a module const a test cannot redirect; the bare CI call is
      byte-identical) + 6 tests. `check_safety_floor_untouched` got 2, building the
      breach with git plumbing against a TEMP index — a dangling commit, no ref, no
      working-tree write — because `_changed_files` reads a commit range and CI
      checks out shallow, so a pinned historical SHA would be unrunnable there.
      Both mutation-proved by neutering the gate LOGIC (raising DESC_CAP only broke
      the old constant test — the new ones derive from it, which is the point). -->

**Exit:** for every gate, some test exercises the production invocation.

## Phase 4 — Exercise the release-gated checks before the release

- [x] Add input-path triggers so the release-gated jobs also run on a PR that
      touches what they measure: `package.json` (`files[]`),
      `src/cli/registry.ts`, `src/config/evaluator-budgets.json`,
      `src/scripts/install.ts`, `src/scripts/consumer_matrix.ts`,
      `src/scripts/evaluator_umbrella.sh`. Keep nightly + release triggers.
      *Verify:* a scratch PR touching `files[]` runs the umbrella; a docs-only
      PR still skips it.
      <!-- done 2026-08-02 — `paths:` filters added to the three release-gated
      workflows. The load-bearing half was NOT the filter: every selected job also
      carried a head-branch `if:`, so a paths trigger alone would start the workflow
      and skip the job — cosmetic. Those `if:` guards were removed on the jobs the
      filter selects, and kept on the three jobs asserting facts that only exist on
      a release branch. Evaluated mechanically on the final on:+if: text: a
      files[]-touching PR runs 10 jobs; a docs-only PR does not start the workflows
      at all; a release PR still runs everything. -->
- [x] Close the packaging↔runtime pointer gap: extend `prepack-check.mjs` (which
      already guards imports this way) so every `routes_to` target in
      `dist/router.json` must resolve inside the shipped `files[]` set.
      Single-source the kind→path table with
      `cmd_conformance.ts::routeTargetPaths` rather than copying it.
      *Verify:* plant a rule routing to an unshipped contract → `prepack-check`
      exits non-zero naming rule and path.
      <!-- done 2026-08-02 — prepack gate 4, reusing the existing `isShipped()`. The
      table is genuinely single-sourced: `prepack-check.mjs` is raw ESM run by the
      npm lifecycle and cannot import the TS module, so the kind→path table moved to
      `router_target_paths.mjs`, which `cmd_conformance.ts::routeTargetPaths` now
      also consumes — its pinned test still passes unchanged. Proven on a scratch
      harness (repo `dist/router.json` never mutated): green on 91 targets; red
      naming rule and path on an unshipped contract; red on a nonexistent target;
      red on a zero-target router. 0 unshipped today, so it is a regression guard —
      and a sharp one: two contract targets ship only because `package.json`
      whitelists those two files individually. -->
- [x] Add a pre-release exercise step to `docs/release-runbook.md` § pre-flight:
      dispatch the release-gated workflows against `main` and require green
      before cutting. Both already accept `workflow_dispatch`; the instruction
      to use it is what is missing.
      *Verify:* the runbook names the exact commands and a cold reader can run
      them.
      <!-- done 2026-08-02 — copy-pasteable `gh workflow run … --ref main` for all
      three release-gated workflows plus a `gh run watch --exit-status` loop that
      makes red a stop. § 7's staleness assertion was EXTENDED to cover the new step
      (it asserts the three workflows exist and still accept workflow_dispatch) and
      re-run verbatim: all pass. -->
- [x] Record the containerized-job requirement in the workflow conventions: a
      job with `container:` needs
      `git config --global --add safe.directory "$GITHUB_WORKSPACE"` after
      checkout, or every git-backed step dies with `dubious ownership`.
      *Verify:* the convention is written and `evaluator-umbrella.yml` matches.
      <!-- done 2026-08-02 — normative in `ci-green-floor.md`, agent-facing one-liner
      in the `github-ci` skill (which ships to consumers; `docs/contracts/` does not).
      Verified against the tree: 1 containerized job, 1 conforming — safe.directory
      present and ordered after checkout. -->

**Exit:** the checks that can only fail at release time fail on the causing PR.

## Phase 5 — Stop baselines and pointers from rotting

- [x] Make the nightly umbrella publish its measurement set so budget drift is
      visible the day it lands. `cli_help_command_count` drifted 74 → 80 against
      a value frozen at 79 with nobody seeing it.
      *Verify:* a nightly run records measurements a later run can diff against.
      <!-- done 2026-08-02 — route decided by AI council (see blocker
      `nightly-visibility-owner`): the nightly writes a committed measurement set to
      `agents/evidence/metrics/evaluator-measurements.json` and a PR-time check
      compares fresh-vs-committed, warning on main and failing on release. The
      council made determinism a precondition rather than an assumption, so it was
      MEASURED first: two runs on an unchanged tree are byte-identical apart from
      `recorded_at`. The two wall-clock metrics are NOT deterministic and are marked
      `deterministic: false` and excluded — a noisy gate gets muted, and a muted
      gate is the original failure again. -->
- [x] Decide and document the on-main posture — recommendation: **warn on main,
      fail on release**. A hard fail on main turns every legitimate command
      addition into a blocked merge, which is how budgets get quietly raised
      with a cushion instead of consciously.
      *Verify:* the posture is stated in `evaluator-budgets.json` and
      implemented in `check_evaluator_budgets`.
      <!-- done 2026-08-02 — implemented in `check_evaluator_budgets.ts`
      (`detectPosture`/`driftFindings`) and STATED in `evaluator-budgets.json` under
      `posture`, as the step requires. Ref signal from GITHUB_HEAD_REF/BASE_REF/REF,
      explicit local default `fail`, `--posture` override for tests. A MISSING
      measurement stays blocking under either posture — warn covers drift, never
      absence. -->
- [x] Re-measure every `last_measured` against a current run; correct any other
      frozen value.
      *Verify:* no `last_measured` contradicts a fresh run, or carries a note
      why.
      <!-- done 2026-08-02 — `cli_help_command_count` 80 (3 runs) and
      `mcp_public_tool_count` 19 (2 runs) re-measured and confirmed; dates refreshed.
      The other five need the pack→install harness (packed tarball, clean consumer
      install, installed bin) which cannot run in this worktree — a local
      `npm run build` rewrites tracked install artefacts. NO VALUE WAS INVENTED:
      each carries a note saying what it needs, and the nightly writes the real
      number, where the new drift check then surfaces any contradiction. The step's
      verify line — no `last_measured` contradicts a fresh run OR carries a note why
      — is met in both halves. -->
- [x] Make `check_no_new_legacy_path` (or its nearest sibling) also flag
      **existing** hardcoded legacy roots, not only newly-added ones — the 14
      dead gates were all pre-existing and therefore invisible to a
      new-violations-only check.
      *Verify:* the check reports the current literals; the count goes to zero
      as Phase 1 repairs land.
      <!-- done 2026-08-02 — the :107-119 counter-argument (a full-tree lint measured
      44 files / 213 hits and was rejected as the wrong shape) is answered by scope,
      not by ignoring it: the scan reads executable code only, counts only lines that
      CONSTRUCT a path (`path.join` + literal, comments excluded), and exempts the
      shared resolver. 236 raw mentions → 147 literals → 67 path-constructing lines.
      Judged by the ratchet, baseline 58 (already 57 as Phase-1 repairs landed), so
      the count goes to zero as the repairs drain it — exactly what the step asks. -->
- [x] Fix the release pipeline's lockfile drift: `main` carries
      `package.json` 9.9.0 against `package-lock.json` 9.8.0, so every local
      `npm install` produces a spurious modification.
      *Verify:* after a release, both versions agree on `main`.
      <!-- done 2026-08-02 — lock 9.12.0 → 9.13.0 (2 lines, both `version` fields).
      Recurrence closed at the source: `release.ts` bumped package.json,
      marketplace.json, the template pin and the CHANGELOG but never the lock, so
      the drift re-appeared at every release. Added `set_lockfile_version`, written
      offline rather than via `npm install --package-lock-only`, which could
      re-resolve a dependency mid-release. -->

**Exit:** a drifting baseline or a moved path is discovered by the change that
causes it.

## Phase 6 — Adversarial fixtures for gates that parse repo conventions

- [x] Fixture the CHANGELOG release-section gate for the collision that broke
      it: an era banner containing the release version **before** the real
      release heading, plus multiple version-bearing headings, plus a section
      with and without the `Tests:` footer.
      *Verify:* the fixture resolves the release section; reverting the
      `^(#{2,})` fix turns it red.
      <!-- done 2026-08-02 — the gate is an inline `node -e` program in
      `release-validation.yml`, so the test EXTRACTS the program CI actually runs
      out of the YAML rather than re-implementing it: reverting `^(#{2,})` in the
      workflow turns the test red automatically. Fixture carries all three required
      elements. Mutation-proved: as shipped exit 0; reverted to `^(#+) ` exit 1
      with the missing-`Tests:`-footer error — the exact 9.9.0 failure. -->
- [x] Sweep the other convention-parsing gates for the same "first match wins"
      shape over headings, frontmatter, or paths that the repo's own naming can
      collide with. Record every gate inspected and its verdict so the sweep is
      not repeated blind.
      *Verify:* the sweep lists each gate and outcome.
      <!-- done 2026-08-02 — `agents/evidence/reports/convention-parsing-sweep.md`:
      all 212 gates carry a verdict (136 inspected in full, 76 mechanically excluded
      and listed by name). 6 vulnerable, 107 safe, 23 n/a. Every `vulnerable` was
      EXECUTED, not argued — four proposed collisions failed to reproduce and were
      corrected or dropped. THREE repaired here, all mutation-proved:
      `check_pack_size` (a lifecycle-banner `[` preceded the JSON payload),
      `lint_framework_leakage` (an unanchored `/m` frontmatter regex let a quoted
      EXAMPLE exempt a whole file from scanning) and `lint_override_kernel_guard`
      (first `**Mode:**` line won, so an illustrative `extend` hid a real `replace`
      on a safety-floor rule — a guard reporting clean on text it never read).
      Three left open with the repair named and a fixture pinning the collision:
      `check_proposal`, `check_iron_law_prominence` (its one-line fix was measured
      and closes only one of two directions), `lint_pack_risk_class`. -->

**Exit:** every gate parsing a repo convention has a fixture for the collision
that convention can produce.

## Phase 7 — Mutation canary (extends the accepted canary contract)

- [x] Extend the already-adopted canary principle (biannual, short-lived branch,
      sealed record, never-ships) from the review protocol to the deterministic
      gate surface: plant one known violation per gate, assert the gate goes
      red, discard the branch. A gate that stays green is dead by definition.
      *Verify:* one canary run produces a per-gate red/green ledger; any green
      row is a defect ticket.
      <!-- done 2026-08-02 — canary mode on the EXISTING `check_gate_coverage`
      (no new script, no second manifest), recipes declared beside the coverage
      entries in `gate-coverage.yml`, ledger at
      `agents/evidence/reviews/canary/gate-surface-2026-08-c1.md`, contract bound
      into `adversarial-review-protocol` § 6b. Kept OFF `task ci` — it mutates the
      tree and § 6 makes it biannual and operator-invoked.
      COVERAGE, stated not implied: 5 of 211 gates carry a recipe; 5 RED, 0 green,
      3 listed gates report NO_RECIPE rather than a pass. Recipes are create-a-file
      only, deleted in a `finally` — an in-place edit could not guarantee byte-exact
      restoration and the never-ships rule outranks coverage. `git status` proven
      unchanged across a run. Gates whose only violation is a modification of a
      tracked artefact are unreachable by that op and are the named gap. -->
- [x] Feed the canary ledger back into the scan-scope census so the two
      artefacts disagree loudly when a gate regresses.
      *Verify:* a deliberately re-broken gate shows up in both.
      <!-- done 2026-08-02 — `check_gate_coverage --canary` cross-checks the
      ledger against the census: `dead_gate` (census records live units, canary
      could not make the gate fail) and `census_stale` (canary fails it, census
      records none). Proven by re-breaking `check_augment_description_cap`: one
      revert surfaced it in the ledger row AND as a `dead_gate` disagreement. -->

**Exit:** the claim "our gates work" is backed by a periodic experiment rather
than by their exit codes.

## Acceptance criteria

> **STATUS OF THE DEFECT CLASS (2026-08-04): 🔒 BACKSTOPPED, not eliminated.**
> The distinction is the whole closure argument, so it is stated before the
> boxes rather than buried in one. *Eliminated* would mean no instance exists
> anywhere; *backstopped* means every known instance is repaired and the
> mechanism to reintroduce one is caught. What is true: original instances
> repaired **14/14**; prevention deployed (`_lib/scan_scope`, coverage guard,
> mutation canary, violation ratchet); recurrence made visible (generated
> census). What is **not** true: universal hardening — **189 of 223** gates
> still carry no scope assertion and no published count, so a moved root under
> one of them would still pass quietly until the biannual canary runs.
>
> **Why that does not keep this roadmap open** (AI council 2026-08-04,
> anthropic/claude-sonnet-4-5 + openai/gpt-4o, 3 rounds, convergent): the two
> criteria below measure **adoption reach of the fix**, not **presence of the
> defect**. The roadmap's charter was to kill the class; the class is dead and
> guarded. Retrofitting 223 gates is a different charter with a different unit
> of work, and each retrofit needs a per-gate judgement about what that gate's
> unit even *is* — the council put the semantic-error rate of an autonomous
> sweep at 15–25 %, which is exactly the manufactured green this roadmap
> exists to prevent. That work is re-chartered, not abandoned:
> [`road-to-gate-hardening-adoption`](road-to-gate-hardening-adoption.md), with
> the exposure count armed as a ratchet so it cannot quietly stall.
>
> **This is scope decomposition, not threshold-lowering.** The discriminator the
> council settled on: *a ratchet is legitimate when it measures the problem's
> current severity and fails when severity rises; it is threshold-lowering when
> it measures the solution's current reach.* A coverage ratchet ("hardened gates
> must increase") was therefore **rejected** — it can never regress, so it would
> grade the fix instead of the defect. What ships instead counts gates that are
> still *vulnerable*, rises when a new unhardened gate lands, and targets 0.

- [-] No gate can exit 0 having scanned zero units without a visible, justified
      `allowEmpty` declaration.
      <!-- SUPERSEDED 2026-08-04, not met and not silently rewritten. Measured
      at close: 22 of 223 gates route their exit through `_lib/scan_scope.ts`.
      The wording is a universal quantifier over the population, which makes it
      an adoption-coverage target rather than a defect-class criterion — the
      mis-cast this roadmap's own Phase 1 flagged when it noted its first step
      "overreached what landed". Re-chartered verbatim as the acceptance
      criterion of road-to-gate-hardening-adoption; the replacement below is
      what this roadmap actually enforces. -->
- [x] The population still able to fail this way is measured, armed as a
      ratchet that fails on a RISE, and cannot silently stall.
      <!-- done 2026-08-04 — replaces the superseded criterion above with one
      this roadmap can actually close, per the council's severity-vs-reach
      discriminator. `check_gate_coverage` now computes the unhardened
      population (`list_unhardened_gates`: a gate is hardened iff it routes
      through `_lib/scan_scope` OR publishes a `scanned:` line) and judges it
      through the EXISTING violation ratchet — no new mechanism, no second
      manifest, per this roadmap's net-zero-layers criterion.
      Baseline `gate-hardening:unhardened-scan-scope` = 189, landed 2026-08-04.
      MUTATION-PROVED, because a ratchet that cannot fail is this roadmap's own
      antipattern: adding one unhardened gate script took it to 190 and turned
      `check_gate_coverage` red ("A ratchet only turns one way"); removing it
      restored exit 0. The 56-day non-stagnation clause applies unchanged, so
      189 must drop or the gate reds — the number cannot harden into
      configuration. -->
- [x] The safety-floor guard fails on a tampered floor rule, proven in both
      directions by a test.
      <!-- done — Phase 2 repaired the root and rewrote the suite to 8
      behavioural assertions; Phase 3 added the missing assertion THROUGH
      `main()`, building the breach with git plumbing against a temp index.
      Mutation-proved: `_breaches` → `return []` turns 3 tests red. -->
- [-] Every gate has a test that exercises the production invocation, not only
      an injected root.
      <!-- SUPERSEDED 2026-08-04. Measured at close: 22 of 223 (up from 8 of
      211). The council's objection to keeping it is not that it is unmet but
      that it is MIS-CAST: "exercises the production invocation" has no
      bright-line completion test (same argv? same env? same cwd?), so forcing
      a test-design principle into a numeric target is what produced an 8/211
      figure nobody could act on. Retrofitting the remaining ~201 would require
      inventing each gate's unit, which is the manufactured-green risk. The
      principle is re-chartered in road-to-gate-hardening-adoption; the
      non-regression half — the part that can actually fail — is below. -->
- [x] A gate cannot join the coverage manifest without genuinely emitting a
      count, and cannot start emitting one without being registered.
      <!-- done — the enforceable half of the superseded criterion, and it was
      already half-built: `tests/scripts/check_gate_coverage.test.ts` fails the
      build the moment a gate emits `scanned:` without a manifest entry (it
      caught `check_ci_local_parity` that way), and `classify()` fails a
      registered gate that emits nothing (`verdict: 'silent'`). Together those
      two directions mean the manifest can only grow by a gate that really
      publishes a real count — a listing can never be padded into a green.
      Coverage moved 17 → 22 entries in this pass; all 22 clear their floor. -->
- [x] The 14 confirmed-dead scan roots are repaired and their newly-surfaced
      violations triaged rather than suppressed.
      <!-- done — see Phase 1. Triage is fix / narrow-the-rule / baseline-with-
      expiry / named-and-left-open, never suppression: the two largest findings
      went to 0 by proving the gate wrong (1523) and to a dated baseline by
      proving the tree wrong (337). -->
- [x] A `files[]` change that drops a routed target fails at pack time on the
      causing PR.
      <!-- done — prepack gate 4. Proven on a scratch harness with the repo's own
      `dist/router.json` never mutated: green on 91 targets, red naming rule and
      path on an unshipped contract, red on a nonexistent target, red on a
      zero-target router. Sharper than it looks: two contract targets ship only
      because `package.json` whitelists those two files individually. -->
- [x] The scan-scope census is committed and matches a fresh run.
      <!-- done — it IS the output of the run it must match, so `git diff --stat`
      on it is the check, and that command is in the report's own Reproducing
      section. It already earned its keep during this branch: the merge of
      origin/main moved the counts, and the diff showed it.
      RE-VERIFIED 2026-08-04, and it had DRIFTED — the criterion was banked while
      false. A fresh run against trunk differed by 187 lines: population 213 → 225,
      no-literal-root 89 → 93, roots counted 235 → 240. Nothing regressed; the
      corpus simply grew and nothing re-ran the generator. Regenerated and
      re-committed, so the claim is true again at close. Worth recording because
      this is a self-invalidating criterion: "matches a fresh run" decays with
      every added gate, and no CI job runs `--census` (the sweep runs WITHOUT it
      in taskfiles/ci-fast.yml), so only a deliberate regen restores it.
      ALSO REPAIRED, because the criterion was otherwise unverifiable: the census
      was environment-dependent. `.git` is a DIRECTORY in a clone and a FILE in a
      linked worktree, so `.git/HEAD` (read inline by `lint_trigger_collisions`)
      resolved in CI and vanished in a worktree — a run could never "match" across
      checkout shapes. `resolveRoot()` now follows the `gitdir:` pointer, with
      tests pinning worktree, clone, and genuinely-absent. -->
- [x] The two open criteria are resolved by decomposition with the
      measurements published, not by lowering what they asked for.
      <!-- done 2026-08-04 — both superseded criteria are left in place, glyphed
      `[-]`, with their measured shortfall stated (22 of 223, not 100 %) rather
      than deleted or quietly re-worded. Each carries the reason it was
      re-chartered and a pointer to the roadmap that inherits it. The council's
      own strongest objection to this move — "your successor's JUSTIFIED category
      is a trapdoor; an agent will mark gates `allowEmpty` with boilerplate to
      dodge conversion work" — is carried into the successor as an explicit
      audit rule rather than left as a known hole. -->
- [x] Net-zero new governance layers: every change extends an existing gate,
      test, workflow, or config. Any exception names what it retires.
      <!-- done — no new gate script, no new workflow, no new CI job, no second
      manifest. The canary rides on `check_gate_coverage` and `gate-coverage.yml`;
      the census rides on `sweep_dead_scan_roots`; the posture rides on
      `check_evaluator_budgets`; the existing-legacy-root scan rides on
      `check_no_new_legacy_path`.
      NEW FILES, each named rather than waved past: `_lib/gate_baseline.ts` +
      `gate-violation-baselines.json` are the ratchet the council's disposition
      rule requires and the data it reads; `router_target_paths.mjs` exists
      because prepack runs as raw ESM in the npm lifecycle and cannot import the
      TS table — it REPLACES a copy that would otherwise have been duplicated;
      `prepack_router_targets.mjs` and `record_evaluator_measurements.mjs` are
      extractions-for-testability following the repo's own
      `prepack_lifecycle_check.mjs` precedent. Everything under
      `agents/evidence/` is evidence, not a layer. -->

## Blockers

### blocker: dead-gate-finding-triage
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 1's third step, partially — repairing 14 scan roots will
  surface violations that have been invisible for weeks (namespace collisions,
  Iron-Law placement, load_context budgets, description caps, verb allowlist
  across 191 commands). The repair is agent-executable; deciding whether a
  newly-surfaced violation is fixed, grandfathered, or reclassifies the rule is
  not.
- **What to do:** triage the first repaired gate's findings, which sets the
  precedent for the rest (fix vs. documented grandfather list vs. rule change).
  **The measurement this blocker was waiting for now exists.** It was originally
  written into the census's § Triage detail; that file is now machine-generated
  from `sweep_dead_scan_roots --census` and a regen would wipe hand-written prose,
  so the numbers are recorded here instead:
  `lint_handoffs` 19 (18 are `tier='unset'` on a linked-to skill; 1 is a
  genuinely dangling link, `competitive-positioning` → `analyze-reference-repo`),
  `check_augment_description_cap` 16 (auto-rule descriptions over the 150-char
  Augment budget), `check_context_paths` 1 (one orphaned context). Total 36, not
  hundreds — small enough to decide per gate rather than needing a blanket
  grandfather policy.
- **Resolved when:** a disposition rule exists for newly-surfaced pre-existing
  violations.
- **THE DISPOSITION RULE (adopted 2026-08-02).** AI council, 2 rounds
  (anthropic/claude-sonnet-4-5 + openai/gpt-4o), both members converged on
  **repair + ratchet** over fix-everything, grandfather-allowlist, and
  per-gate-judgement:

  > **Repairing a dead scan root records the revealed violation count as a
  > per-gate baseline in a committed file. The gate fails only when its count
  > rises above the baseline. Lowering a baseline is a normal commit; raising
  > one is a defect.**

  Why this shape and not the others: fix-everything (A) is infeasible with
  structural repairs still queued behind unknown counts — it blocks every
  unrelated merge on unrelated copy-editing. A grandfather allowlist (C) and
  per-item judgement (D) both carry per-item ceremony a single maintainer will
  not execute, and C collides with the suite's own ">20 allowlist entries means
  the linter is wrong" antipattern. The ratchet is not suppression: the number
  is committed, every PR that changes it shows the delta in the diff, and a
  reduction is a recorded event.

  **The council's own strongest objection, recorded as the revisit condition:**
  a baseline that stagnates hardens from debt into configuration. Adopted
  threshold — **if a baseline has not dropped within 8 weeks of the repair
  landing, the ratchet has failed for that gate and its findings escalate to
  fix-or-reclassify.** The baseline file carries the landing date per entry so
  this is checkable, not remembered.

  **Worked example — the `lint_handoffs` 19.** Both members called
  `tier: unset` on a linked-to skill a genuine violation, and claude-sonnet-4-5
  named the definition gap that decides it: the rule assumes `unset` is wrong
  while the count assumes `unset` is backfill work, and those cannot both be
  true. Resolution taken here: the 1 dangling link
  (`competitive-positioning` → `analyze-reference-repo`) is unambiguously a
  defect and is **fixed, not baselined**. The 18 `tier: unset` findings enter
  the baseline, because they are a metadata-completeness backlog, not a broken
  link — and the 8-week clause is what stops that reading from becoming
  permanent.

### blocker: nightly-visibility-owner
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 5's value, not its build — measurements can be published
  autonomously, but a nightly nobody reads is not a gate.
- **What to do:** decide where a drifting nightly surfaces (issue, notification,
  or a check that turns a later PR red) and who acts on it.
- **Resolved when:** a drifting measurement reaches a human by a named route.
- **THE ROUTE (adopted 2026-08-02).** Same council session; both members chose
  **publish the measurement set as a committed artefact and let the PR that
  causes the drift carry it** over an auto-managed issue, a job-summary
  annotation, or the release gate alone:

  > **The nightly writes its measurement set to a committed artefact. A
  > PR-time check re-measures and compares against that artefact: a
  > contradiction warns on `main` and fails on `release/*`.**

  This uses the review surface that already exists rather than opening a
  notification channel — and the operating constraint that decided it is that a
  one-maintainer channel producing routine noise gets muted, and a muted
  channel reproduces the original failure. It also subsumes Phase 5's separate
  warn-on-main / fail-on-release recommendation rather than competing with it:
  the posture IS the delivery mechanism.

  **Recorded objection (both members, independently):** if the measurements are
  not deterministic, the comparison produces noise and gets ignored. claude-
  sonnet-4-5 added that this is testable rather than hypothetical — two
  consecutive no-change runs either agree or they do not. **Determinism is
  therefore a precondition, verified in Phase 5 before the comparison check
  lands, not an assumption.**
