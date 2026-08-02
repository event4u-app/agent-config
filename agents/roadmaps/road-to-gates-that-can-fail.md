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
- [~] Publish the scan-scope census as a committed report: for each of the ~190
      gates, its scan root(s) and the unit count on a clean tree. This is the
      artefact that makes a future root-move visible in a diff.
      *Verify:* the report exists, every row has a root and a count, and the
      count matches a fresh run.
      <!-- partial 2026-07-29 — `agents/evidence/reports/gate-scope-census.md`
      exists and covers the 14 confirmed-dead gates with declared root, real
      root, measured unit count and disposition. It does NOT yet cover the full
      ~190 population; the report states that limit in its own scope section
      rather than implying broader coverage. Deferred rather than closed so the
      remaining coverage stays visible.
      ADVANCED 2026-08-02 — `src/scripts/sweep_dead_scan_roots.ts` +
      `agents/evidence/reports/gate-scope-sweep.md` measure the FULL population
      deterministically and re-runnably: 213 gate scripts (the ~190 estimate was
      low), 26 confirmed missing roots with positive read evidence, 13 of them
      class A, 15 unproven. Four of the class-A gates are OUTSIDE the censused
      14 — `audit_user_type_axis`, `lint_command_routing`,
      `lint_media_policy_linkage`, `lint_role_experiences` — which answers the
      base-rate question the census could not: the 14 were an undercount, not
      the population. STILL `[~]`: the sweep reports roots that are DEAD, not
      "root + unit count for every gate", so the census's own acceptance
      criterion is not met. Repairs are held under `dead-gate-finding-triage`
      for the same reason the census landed 3 of 14. -->
- [~] Fix the 14 confirmed-dead scan roots to the real ones
      (`src/rules`, `src/skills`, `src/domains/**/command.md`,
      `src/agent-src/personas`, …), preferring the shared resolver over new
      literals. Expect real, previously-invisible violations to surface — triage
      them, do not suppress them.
      *Verify:* each repaired gate reports a non-zero scan count, and its
      findings (or clean verdict) are against real artefacts.
      <!-- partial 2026-07-29 — 3 of 14 repaired and landed, all verified
      against real artefacts:
      · `check_safety_floor_untouched` → `src/rules` (see Phase 2)
      · `check_iron_law_prominence` → `src/rules`: 111 rule files scanned, 0
        violations (was 0 scanned)
      · `lint_new_skill_gate` → `src/skills`: 286 skills visible; against
        baseline 9.8.0 it now sees 10 new skills and runs them through the
        triggers+dedupe gate, where before it saw none and passed everything
      3 measured but DELIBERATELY NOT LANDED — repairing them surfaces
      pre-existing violations (`lint_handoffs` 19, `check_augment_description_cap`
      16, `check_context_paths` 1) whose disposition is the maintainer's call per
      blocker `dead-gate-finding-triage`. Landing them would turn CI red on debt
      this change did not create. Counts + samples are in the census.
      8 are STRUCTURAL, not path swaps — one container with subdirs became
      several independent roots, or `packages/` was deleted outright
      (`lint_namespace`, `lint_artefact_frontmatter`, `check_condensation`,
      `lint_load_context`, `lint_command_verbs`, `check_no_roadmap_refs`,
      `lint_pack_boundaries`, `lint_pack_dependencies`). Each needs its own
      change; none is a one-line repoint.
      METHOD NOTE worth keeping: repairing a gate PARTIALLY lies in both
      directions — fixing `check_context_paths`' contexts root alone reports 17
      orphans, 16 of them false, because the gate could not see the files doing
      the referencing. Repair every root a gate reads, or none. -->

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

- [ ] Add a default-entry-point test per gate: invoke the gate the way
      `scripts-run`/CI invokes it (no injected root) against the real tree and
      assert a non-zero scan count. This is the check that would have caught all
      14 at authoring time; the existing injected-root tests stay as the
      algorithm proof.
      *Verify:* reverting any Phase-1 root repair turns its default-entry test
      red.
- [ ] Add the missing violation tests for the gates classified `happy-path-only`
      (`check_safety_floor_untouched`, `check_augment_description_cap`, plus any
      the census adds): construct a real violation, assert rejection.
      *Verify:* each new test fails when the gate's logic is neutered.

**Exit:** for every gate, some test exercises the production invocation.

## Phase 4 — Exercise the release-gated checks before the release

- [ ] Add input-path triggers so the release-gated jobs also run on a PR that
      touches what they measure: `package.json` (`files[]`),
      `src/cli/registry.ts`, `src/config/evaluator-budgets.json`,
      `src/scripts/install.ts`, `src/scripts/consumer_matrix.ts`,
      `src/scripts/evaluator_umbrella.sh`. Keep nightly + release triggers.
      *Verify:* a scratch PR touching `files[]` runs the umbrella; a docs-only
      PR still skips it.
- [ ] Close the packaging↔runtime pointer gap: extend `prepack-check.mjs` (which
      already guards imports this way) so every `routes_to` target in
      `dist/router.json` must resolve inside the shipped `files[]` set.
      Single-source the kind→path table with
      `cmd_conformance.ts::routeTargetPaths` rather than copying it.
      *Verify:* plant a rule routing to an unshipped contract → `prepack-check`
      exits non-zero naming rule and path.
- [ ] Add a pre-release exercise step to `docs/release-runbook.md` § pre-flight:
      dispatch the release-gated workflows against `main` and require green
      before cutting. Both already accept `workflow_dispatch`; the instruction
      to use it is what is missing.
      *Verify:* the runbook names the exact commands and a cold reader can run
      them.
- [ ] Record the containerized-job requirement in the workflow conventions: a
      job with `container:` needs
      `git config --global --add safe.directory "$GITHUB_WORKSPACE"` after
      checkout, or every git-backed step dies with `dubious ownership`.
      *Verify:* the convention is written and `evaluator-umbrella.yml` matches.

**Exit:** the checks that can only fail at release time fail on the causing PR.

## Phase 5 — Stop baselines and pointers from rotting

- [ ] Make the nightly umbrella publish its measurement set so budget drift is
      visible the day it lands. `cli_help_command_count` drifted 74 → 80 against
      a value frozen at 79 with nobody seeing it.
      *Verify:* a nightly run records measurements a later run can diff against.
- [ ] Decide and document the on-main posture — recommendation: **warn on main,
      fail on release**. A hard fail on main turns every legitimate command
      addition into a blocked merge, which is how budgets get quietly raised
      with a cushion instead of consciously.
      *Verify:* the posture is stated in `evaluator-budgets.json` and
      implemented in `check_evaluator_budgets`.
- [ ] Re-measure every `last_measured` against a current run; correct any other
      frozen value.
      *Verify:* no `last_measured` contradicts a fresh run, or carries a note
      why.
- [ ] Make `check_no_new_legacy_path` (or its nearest sibling) also flag
      **existing** hardcoded legacy roots, not only newly-added ones — the 14
      dead gates were all pre-existing and therefore invisible to a
      new-violations-only check.
      *Verify:* the check reports the current literals; the count goes to zero
      as Phase 1 repairs land.
- [ ] Fix the release pipeline's lockfile drift: `main` carries
      `package.json` 9.9.0 against `package-lock.json` 9.8.0, so every local
      `npm install` produces a spurious modification.
      *Verify:* after a release, both versions agree on `main`.

**Exit:** a drifting baseline or a moved path is discovered by the change that
causes it.

## Phase 6 — Adversarial fixtures for gates that parse repo conventions

- [ ] Fixture the CHANGELOG release-section gate for the collision that broke
      it: an era banner containing the release version **before** the real
      release heading, plus multiple version-bearing headings, plus a section
      with and without the `Tests:` footer.
      *Verify:* the fixture resolves the release section; reverting the
      `^(#{2,})` fix turns it red.
- [ ] Sweep the other convention-parsing gates for the same "first match wins"
      shape over headings, frontmatter, or paths that the repo's own naming can
      collide with. Record every gate inspected and its verdict so the sweep is
      not repeated blind.
      *Verify:* the sweep lists each gate and outcome.

**Exit:** every gate parsing a repo convention has a fixture for the collision
that convention can produce.

## Phase 7 — Mutation canary (extends the accepted canary contract)

- [ ] Extend the already-adopted canary principle (biannual, short-lived branch,
      sealed record, never-ships) from the review protocol to the deterministic
      gate surface: plant one known violation per gate, assert the gate goes
      red, discard the branch. A gate that stays green is dead by definition.
      *Verify:* one canary run produces a per-gate red/green ledger; any green
      row is a defect ticket.
- [ ] Feed the canary ledger back into the scan-scope census so the two
      artefacts disagree loudly when a gate regresses.
      *Verify:* a deliberately re-broken gate shows up in both.

**Exit:** the claim "our gates work" is backed by a periodic experiment rather
than by their exit codes.

## Acceptance criteria

- [ ] No gate can exit 0 having scanned zero units without a visible, justified
      `allowEmpty` declaration.
- [ ] The safety-floor guard fails on a tampered floor rule, proven in both
      directions by a test.
- [ ] Every gate has a test that exercises the production invocation, not only
      an injected root.
- [ ] The 14 confirmed-dead scan roots are repaired and their newly-surfaced
      violations triaged rather than suppressed.
- [ ] A `files[]` change that drops a routed target fails at pack time on the
      causing PR.
- [ ] The scan-scope census is committed and matches a fresh run.
- [ ] Net-zero new governance layers: every change extends an existing gate,
      test, workflow, or config. Any exception names what it retires.

## Blockers

### blocker: dead-gate-finding-triage
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 1's third step, partially — repairing 14 scan roots will
  surface violations that have been invisible for weeks (namespace collisions,
  Iron-Law placement, load_context budgets, description caps, verb allowlist
  across 191 commands). The repair is agent-executable; deciding whether a
  newly-surfaced violation is fixed, grandfathered, or reclassifies the rule is
  not.
- **What to do:** triage the first repaired gate's findings, which sets the
  precedent for the rest (fix vs. documented grandfather list vs. rule change).
  **The measurement this blocker was waiting for now exists** — see
  `agents/evidence/reports/gate-scope-census.md` § Triage detail:
  `lint_handoffs` 19 (18 are `tier='unset'` on a linked-to skill; 1 is a
  genuinely dangling link, `competitive-positioning` → `analyze-reference-repo`),
  `check_augment_description_cap` 16 (auto-rule descriptions over the 150-char
  Augment budget), `check_context_paths` 1 (one orphaned context). Total 36, not
  hundreds — small enough to decide per gate rather than needing a blanket
  grandfather policy.
- **Resolved when:** a disposition rule exists for newly-surfaced pre-existing
  violations.

### blocker: nightly-visibility-owner
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 5's value, not its build — measurements can be published
  autonomously, but a nightly nobody reads is not a gate.
- **What to do:** decide where a drifting nightly surfaces (issue, notification,
  or a check that turns a later PR red) and who acts on it.
- **Resolved when:** a drifting measurement reaches a human by a named route.
