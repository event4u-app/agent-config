---
complexity: lightweight
execution:
  mode: phase-checkpoints
---

# Road to gate integrity — a gate that scanned nothing must never exit green

> Make coverage a structural property of the gate estate instead of a lesson this
> package re-learns per incident: every gate accounts for its planned work,
> names its skips from a closed vocabulary, prints its denominator on green, and
> refuses to report success it cannot substantiate.

## Context

Source + verdicts:
[`skill-ecosystem-sweep-2026-08`](../settings/contexts/skill-ecosystem-sweep-2026-08.md)
§ C1 and § Gate coverage this sweep exposes.

**Why this roadmap exists rather than another individual fix.** The sweep's
strongest convergence (§ C1, six independent sources) is the exact failure class
this package has recorded four separate times from its own history — a gate
scanning a dead scan root and exiting green, a budget report printing a share for
a dimension it never measured, release gates verifying an empty corpus, shape
gates over frozen corpora. Each was fixed at its instance. None produced a
general invariant. The predecessor roadmap closed its class-A sweep and shipped a
ratchet, a census, and a canary; the successor adoption roadmap carries the
remaining reach. This roadmap adds the layer neither has: **completeness
accounting**, so absence of findings and absence of scanning stop looking alike.

**In-tree facts verified before drafting.** `src/scripts/` holds 466 TypeScript
gates. `assertScanned` / `DeadScopeError` exist in `src/scripts/_lib/scan_scope.ts`
and are already imported by roadmap lints — a partial version of Phase 1 that
covers dead *roots* but not planned *items*. Ratchet baselines under
`src/scripts/` are shrink-only by convention plus a count comparison, and a count
comparison permits swap-one-out-add-one-in. `external_sources_denylist.json`
carries no per-entry reason field.

## Gap table

| Item from the sweep | Verdict | Where it lands |
|---|---|---|
| Completeness ledger: planned work → exactly one terminal outcome | KEEP | Phase 1 |
| Closed reason vocabulary for skips, with a message per code | KEEP | Phase 1 |
| Print the scanned denominator on the green path | KEEP | Phase 1 |
| Fail closed on a null result from a registered gate | KEEP | Phase 1 |
| Base-ref no-new-entries enforcement on every allowlist and ratchet | KEEP | Phase 2 |
| Per-entry `reason` required on human-authored suppressions | KEEP | Phase 2 |
| Suppression entries carry a re-runnable disproof command | KEEP | Phase 2 |
| Two-tier suppression: human glob-matched vs machine fingerprint | KEEP | Phase 2 |
| Advisory-until-empty, then promote to error | KEEP | Phase 3 |
| Self-describing allowlist key inside the finding message | KEEP | Phase 3 |
| Gaming-risk block required when authoring a new gate | KEEP | Phase 3 |
| Catalogue of ways a green result can be false | KEEP | Phase 3 |
| Validator self-test with an assertion-count floor | KEEP | Phase 4 |
| Sync checks require validity, not merely equality | KEEP | Phase 4 |
| Isolate a crashed gate; rethrow estate-invalidating conditions | KEEP | Phase 4 |
| Enumerated local-versus-remote check delta | KEEP | Phase 5 |
| Required-check path-filter trap recorded | KEEP | Phase 5 |
| Derived pages render only measured categories | KEEP | Phase 5 |
| Mutation kill-rate per gate family | FOLD | Deferred to the gate-hardening successor roadmap, which already measures reach |
| Duration-band plausibility on gate runs | FOLD | Phase 4, as the null-result check rather than a separate timing layer |
| Held-out slice for gaming detection | CUT | The authored corpus is the population; the existing canary covers it |

## Prerequisites

- [x] **Step 1:** Sweep record committed — `agents/settings/contexts/skill-ecosystem-sweep-2026-08.md` exists.
- [x] **Step 2:** Read `src/scripts/_lib/scan_scope.ts` and record which gates already import `assertScanned`, so Phase 1 extends rather than duplicates it.

## Phase 1: Completeness accounting

- [x] **Step 1:** Add `src/scripts/_lib/gate_ledger.ts` exporting a `GateLedger` with `plan(target)`, `complete(target)`, `skip(target, reason)`, `fail(target, reason)`, `outOfScope(target, reason)`, and a `finalize()` that returns `{planned, completed, skipped, failed, out_of_scope, unaccounted}`. <!-- verify: task typecheck-ts -->
- [x] **Step 2:** Define the skip-reason enum in the same module as a closed union with a one-sentence message per code. Seed it from the reasons our own gates already emit in prose: excluded directory, size limit, binary content, missing credentials, rules unavailable, manifest absent, no applicable files, disabled by configuration, generated artifact, dead scan root. Reject an unlisted reason at the type level. <!-- verify: task typecheck-ts -->
- [x] **Step 3:** Make `finalize()` throw when `unaccounted > 0`, with a message naming each unaccounted target. A planned target that produces no terminal outcome is the defect this ledger exists to catch.
- [x] **Step 4:** Add a `report()` helper that prints `scanned=N planned=N skipped=N` on the success path, so the denominator is auditable on every green run rather than only on failure.
- [x] **Step 5:** Add `tests/scripts/gate_ledger.test.ts` with a positive fixture (all planned targets terminal) and a paired negative fixture (one planned target left unaccounted) that must throw. A gate module without a paired negative fixture cannot be shown to discriminate. <!-- verify: npx vitest run tests/scripts/gate_ledger.test.ts -->
- [x] **Step 6:** Adopt the ledger in three gates chosen because their scan roots have already failed in-tree: the framework-leakage lint, the reference checker, and the roadmap-complexity lint. Do not sweep all 466 — three adoptions prove the interface. <!-- verify: ./scripts-run src/scripts/lint_framework_leakage -->
- [x] **Step 7:** Add `src/scripts/check_gate_completeness.ts` asserting that every gate registered in the CI task list either imports the ledger or carries a `// ledger-exempt: <reason>` marker, and record the current exempt count as the initial ratchet value.

## Phase 2: Make shrink-only mechanical

- [x] **Step 1:** Add `src/scripts/_lib/ratchet_base_ref.ts` exporting `assertNoNewEntries(baselinePath, baseRef)` which reads the baseline at `baseRef` via `git show`, diffs the entry sets, and throws naming every entry present in the working copy and absent at base. Read renames from git so moving an entry is not counted as growth. <!-- verify: task typecheck-ts -->
- [x] **Step 2:** Wire the base-ref assertion into the framework-leakage ratchet first, since its line-keyed allowlist is the entry our own memory records as re-firing on insertion. <!-- verify: ./scripts-run src/scripts/lint_framework_leakage -->
- [x] **Step 3:** Wire it into `external_sources_denylist.json` consumers and the remaining baseline-bearing gates enumerated by Phase 1 Step 7's inventory.
- [x] **Step 4:** Add a required `reason` field to every human-authored suppression entry and fail on a missing or empty one. An unexplained suppression cannot be audited by the next reader.
- [x] **Step 5:** Add a required `falsifier` field carrying a re-runnable command that decides the entry. An entry with a falsifier is a ratchet; one without is a hole. Grandfather existing entries by recording the current count and refusing new entries without the field.
- [x] **Step 6:** Split any baseline that mixes human and machine entries into two tiers — human entries glob-matched and drift-tolerant, machine entries content-hashed and regenerable by a CLI verb, never hand-edited. Position-keyed human entries are the recorded failure this split removes.
- [x] **Step 7:** Add a test that an entry added in the working copy but absent at the base ref fails, and that a renamed entry does not. <!-- verify: npx vitest run tests/scripts/ratchet_base_ref.test.ts -->

### Phase 2 execution notes

Two steps landed differently from their literal wording; both are recorded here
rather than silently absorbed.

- **Steps 2–3 — enforcement is estate-level, not per-gate.** The mechanism lives
  in `_lib/ratchet_base_ref.ts`, and the enforcement point is one new gate,
  `check_suppression_hygiene`, whose `SUPPRESSION_INVENTORY` lists the
  framework-leakage allowlist **first** as the step asks. Two reasons the
  per-gate wiring could not match: a suppression file added next month is caught
  by the inventory check even if nobody wires it, and a lint that runs on every
  save does not acquire a dependency on git plumbing (`git show`, rename
  detection, base-ref resolution) — which is precisely where CI-versus-local
  divergence gets introduced in this repository.
- **Step 6 — the "mixes human and machine entries" premise did not hold.** No
  baseline in this tree mixes the two; that half of the split is already the
  shape. What is real is the recorded drift failure the step names in its last
  sentence: 18 of 18 framework-leakage entries are position-keyed, so inserting
  a paragraph re-fires the ratchet on an entry nobody touched. Landed instead:
  optional content `anchor` matching in `lint_framework_leakage`, and a
  per-run position-keyed count on the hygiene gate's green line so the
  migration is visible rather than aspirational.

## Phase 3: Gate authoring discipline

- [x] **Step 1:** Add `docs/guidelines/agent-infra/gate-authoring.md` as the single authoring path for a new gate, covering: the advisory-until-empty lifecycle, the gaming-risk block, the paired-fixture requirement, the ledger obligation, and the self-describing finding format.
- [x] **Step 2:** Specify the advisory-until-empty lifecycle: a new gate lands advisory, its findings are classified on the real corpus, the baseline shrinks to empty, and only then is it promoted to error. Record the promotion condition in the gate's own header comment. This is the documented fix for shipping a gate that can only block.
- [x] **Step 3:** Require a gaming-risk block on every new gate or ratchet: name at least one degenerate way the metric passes without the underlying property holding, and name the mitigation. If one degenerate pass is nameable at authoring time, it will be found in practice.
- [x] **Step 4:** Require the finding message to carry its own suppression key inline, so silencing a false positive is copy-pasteable. Friction in the suppression path is what drives a maintainer to disable the gate instead.
- [x] **Step 5:** Add `docs/guidelines/agent-infra/false-green.md` cataloguing the ways a green result can be false in this estate, each with its detection command: allowlist growth, ratchet-entry deletion, threshold re-anchoring, suppression sweeps, dead scan roots, hook-bypass overrides, cached-green reuse, and a derived page reporting an unmeasured dimension.
- [ ] **Step 6:** _(BLOCKED — see `blocker: kernel-cross-link-soak`; the exact edit is drafted there)_ Add an ease tripwire to `verify-before-complete`'s red flags: a verification that was far easier than expected is a signal to check the path, not a signal of success. The existing red flags track confidence wording and not ease.
- [ ] **Step 7:** _(BLOCKED — see `blocker: kernel-cross-link-soak`; the exact edit is drafted there)_ Cross-link the new guideline from `verify-before-complete` and from the token-optimizer catalog row for that rule, per `token-optimizer-maintenance`.

## Phase 4: Second-order guards

- [x] **Step 1:** Add a `--self-test` mode to `src/scripts/_lib/gate_ledger.ts`'s three adopting gates that builds known-bad fixtures in a temporary directory and asserts each rejection fires. <!-- verify: ./scripts-run src/scripts/lint_framework_leakage --self-test -->
- [x] **Step 2:** Give the self-test an assertion-count floor and fail below it. A self-test is itself a checker, so a truncated fixture block must fail rather than print success.
- [x] **Step 3:** Audit every sync and parity gate for equality-without-validity. A byte comparison of two absent files passes; assert both sides exist and are well-formed before comparing. Record the audited gate list in the new guideline. <!-- verify: ./scripts-run src/scripts/check_condensation --quiet -->
- [x] **Step 4:** Add estate-level result handling to the CI aggregation path: a gate that throws degrades to a warning for that gate, except for conditions that invalidate the whole run, which rethrow. A crashed gate currently reads as a passing gate, and three of our recorded traps are estate invalidation misreported as a per-gate red.
- [x] **Step 5:** Fail closed when a registered gate reports a null or missing result. A registered gate that produced no verdict was skipped, and a skipped gate is not a passing gate.
- [x] **Step 6:** Add a test asserting that a deliberately crashing gate does not turn the aggregate green. <!-- verify: npx vitest run tests/scripts/gate_estate_result.test.ts -->

## Phase 5: Honest reporting surfaces

- [x] **Step 1:** Add a `## CI delta` section to `docs/contracts/ci-green-floor.md` enumerating every check the local task runner cannot run, with the reason for each. A local pass followed by a remote fail is a defect in the delta list, not in the remote.
- [x] **Step 2:** Add a gate that diffs remote workflow job names against local task targets and fails when the delta list is stale.
- [x] **Step 3:** Record the required-check path-filter trap in `docs/contracts/branch-protection-policy.md`: because the required check is enforced by a ruleset, adding a path filter to its pull-request trigger means a change touching no filtered path never reports and blocks permanently.
- [x] **Step 4:** Add the render-only-measured-categories invariant to every generator that writes a derived page: a category with no measurement renders as absent or explicitly not measured, never as a zero or a computed share.
- [x] **Step 5:** Add an assertion to the derived-page tests that a generator given an unmeasured dimension does not emit a percentage for it. <!-- verify: npx vitest run tests/scripts/derived_page_truthfulness.test.ts -->
- [x] **Step 6:** Publish the gap list beside every coverage number this package emits — name the un-measured artifacts rather than reporting only the covered count.

### Phase 4-5 execution notes

- **Phase 4 Step 3 (sync/parity audit) — 27 gates audited, 19 guarded, 8
  vulnerable, 0 undecided.** The full list is recorded in
  `false-green.md § The audited sync/parity gates`. ONE was fixed here —
  `verify_physical_move._diff_manifest(null, null)`, the literal `diff a b`
  where both sides are absent and the answer comes back "equal". The other
  seven are recorded rather than swept: they span release, sync, and bench
  surfaces this change does not otherwise touch, and batching them would be the
  unreviewable diff the authoring guideline warns against.
- **Phase 4 Step 4 — the premise was half-wrong and the fix is narrower than
  stated.** "A crashed gate currently reads as a passing gate" does not hold for
  `check_gate_coverage`: a crash was already ❌. What genuinely did not exist is
  the distinction between *found violations* and *could not measure at all*, so
  `_lib/gate_result.ts` classifies on the structural error names and the
  aggregator gained an `estate_invalid` verdict. No crash was softened to a
  warning — softening was the roadmap's own Risk 5, and with the premise
  corrected there was nothing to soften.
- **Phase 5 Steps 1-2 — the freshness gate already existed and was RED.**
  `check_ci_local_parity` walks both directions and fails on an undeclared
  delta; it had 5 undeclared entries on `main`. Four were genuinely CI-only and
  are now declared with reasons; the fifth, `check_review_dispositions`, had no
  reason it could not run locally, so it was wired into `task ci` instead — the
  direction the manifest itself asks for. The `## CI delta` section names the
  manifest and its vocabulary rather than copying its rows, so the two cannot
  drift. A pre-existing trunk red is green as a side effect.
- **Phase 5 Steps 4-6 — helper plus one adoption, not a sweep.**
  `_lib/measured_render.ts` carries the invariant and `check_gate_completeness`
  adopts it (its coverage line now names the un-covered gates). Every other
  generator is covered by the guideline section, not by this diff. Worth
  recording: wiring `check_review_dispositions` into `task ci` immediately
  tripped the ledger ratchet at 218 against a baseline of 217, and the fix was
  to adopt the ledger there rather than raise the number — the mechanism
  working on its author within the hour of shipping.

## Blockers

### blocker: kernel-cross-link-soak

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 3 Step 6 and Step 7, and the acceptance criterion that both
  new guidelines are cross-linked from `verify-before-complete`.
- **What to do:** apply the two edits below to
  `src/rules/verify-before-complete.md` in their OWN pull request, with the
  ≥24 h kernel soak. `verify-before-complete` is one of the nine kernel rules
  (`docs/contracts/kernel-membership.md`), and `scope-control § Kernel-rule
  edits` requires one rule per PR plus the soak window — a guarantee no
  autonomous mandate lifts. Batching them into this change would also risk the
  kernel-prefix byte-stability gate, which local preflight does not catch.

  1. **Step 6 — the ease tripwire.** Add to the `## Red flags — STOP
     immediately` list:

     > - A verification that was **far easier than expected** — check the path
     >   before believing the result, per [`false-green`](../docs/guidelines/agent-infra/false-green.md)

     The existing red flags track confidence *wording* ("should pass", "seems
     fine") and not *ease*; every false green catalogued in `false-green.md`
     felt like a pass at the moment it happened.

  2. **Step 7 — the cross-links.** Add to `## Verification commands`:

     > Authoring a new gate → [`gate-authoring`](../docs/guidelines/agent-infra/gate-authoring.md).
     > Ways a green result can be false, with detection commands →
     > [`false-green`](../docs/guidelines/agent-infra/false-green.md).

     Then update the `verify-before-complete` row in
     `src/skills/token-optimizer/SKILL.md` in the same PR, per
     `token-optimizer-maintenance` (the rule's summary changes, so the catalog
     row must too).

- **Resolved when:** both edits are merged and the soak has elapsed. Everything
  else in Phase 3 — both guidelines, the lifecycle, the gaming-risk block, and
  the inline suppression key — landed in this change and does not wait on it.

## Acceptance Criteria

- [x] `src/scripts/_lib/gate_ledger.ts` exists, is typechecked, and has a paired positive and negative fixture.
- [x] Three named gates adopt the ledger and print a scanned denominator on success.
- [x] A planned-but-unaccounted target throws, proven by a test.
- [x] An allowlist entry present in the working copy and absent at the base ref fails, proven by a test.
- [x] Every human-authored suppression entry carries a non-empty `reason`, and new entries additionally carry a `falsifier`.
- [ ] `docs/guidelines/agent-infra/gate-authoring.md` and `docs/guidelines/agent-infra/false-green.md` exist and are cross-linked from `verify-before-complete`.
- [x] A deliberately crashing gate does not produce a green aggregate, proven by a test.
- [x] `docs/contracts/ci-green-floor.md` carries a `## CI delta` section and a gate keeps it fresh.
- [x] A generator given an unmeasured dimension emits no percentage for it, proven by a test.
- [x] Quality gates delegated to remote CI on the pull request. _(PR #1181: 43 checks pass, 1 skipping, 0 failures.)_

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Ledger adoption becomes a 466-gate sweep | implementation | Adopting the ledger everywhere at once is a very large mechanical diff across the whole gate estate, and a batch touching the kernel-prefix set would trip the byte-stability gate. | Phase 1 adopts exactly three gates and records an exempt count as a ratchet; the remainder migrates incrementally as gates are touched, never as a sweep. | Phase 1: Completeness accounting |
| 2 | The falsifier field lands as a pro-forma string | product | A required field invites a placeholder value that satisfies the schema without deciding anything, which is the gate-fatigue failure this package has already recorded. | New entries only, no retro-fill; the field holds a command, and Phase 3's gaming-risk discipline applies to this gate as much as to any other. | Phase 2: Make shrink-only mechanical |
| 3 | Base-ref enforcement false-reds on a legitimate ratchet reset | implementation | A deliberate baseline reset after a real tooling change would present as new entries and block the change that performs the reset. | Renames read from git; a documented reset path records the reason in the commit and the gate reports the reset rather than failing silently. | Phase 2: Make shrink-only mechanical |
| 4 | Two new guidelines add reading surface without changing behaviour | product | This package already carries a large guideline layer, and a guideline nobody routes to is inert cost. | Both files are routed from an existing always-loaded rule and from the token-optimizer catalog; the authoring path is the single entry point for a new gate rather than optional reading. | Phase 3: Gate authoring discipline |
| 5 | The estate-level result change masks a real failure | implementation | Degrading a crashed gate to a warning could hide a genuine break that previously surfaced as a hard failure. | The rethrow set covers estate-invalidating conditions, and the null-result check fails closed, so the only softened case is a single gate crash that is now reported as itself rather than as a false pass. | Phase 4: Second-order guards |

## Provenance

- Source: six independent third-party agent-skill suites converging on the same
  completeness invariant, plus two first-party vendor suites for the base-ref and
  self-test mechanisms. Anonymized per `source-confidentiality`; per-source links
  in the sweep record's § Provenance.
- Sweep record + full verdict set:
  [`skill-ecosystem-sweep-2026-08`](../settings/contexts/skill-ecosystem-sweep-2026-08.md).
- Council: see the sweep record § Council for the freeze disposition and the
  sequencing verdict that authorized this roadmap set.
