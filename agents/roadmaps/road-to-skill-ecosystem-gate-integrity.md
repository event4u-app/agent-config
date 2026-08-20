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

## Outcome

Closed 2026-08-20 with **43 of 46 checkboxes satisfied, 3 transferred, 0 open**
— the dashboard reports the same state as 41 of 44 because its denominator omits
the two prerequisites. The three transferred boxes are Phase 3 Steps 6 and 7 plus
the cross-link half of one acceptance criterion, which was split into two boxes
rather than force-closed (so the total moved 45 → 46). Recorded here rather than
in a commit message because a reader who finds this file in `archive/` needs it:
**archived does not mean achieved.**

**Satisfied — the mechanism this roadmap set out to build exists.** Completeness
accounting (`_lib/gate_ledger.ts`), shrink-only base-ref enforcement
(`_lib/ratchet_base_ref.ts` behind `check_suppression_hygiene`), the two
authoring guidelines, the estate-level result classifier
(`_lib/gate_result.ts`), the CI-delta freshness gate
(`check_ci_local_parity`) and the measured-render invariant
(`_lib/measured_render.ts`) all landed and are proven by their own paired
fixtures. Phases 1, 2, 4 and 5 are complete as written, with the two execution
notes above recording where the landing differed from the literal wording.

**Narrowed in this closing pass.** Phase 3 Step 5 enumerated eight false-green
classes and the shipped catalogue covered six of them plus three it added on its
own. Two of the eight — **hook-bypass overrides** and **cached-green reuse** —
were absent, so the step's `[x]` was over-claimed against its own list. Both are
now entries 10 and 11 of `false-green.md`, each with a detection command run
against this tree before it was written down. This is the only build work in
this pass; everything else that remained was gated.

**Transferred — Phase 3 Steps 6 and 7, and half of one acceptance criterion.**
Destination
[`stubs/road-to-kernel-cross-link-soak.md`](stubs/road-to-kernel-cross-link-soak.md),
disposition **B**, outcome state `transferred`. The two edits add an ease
tripwire and two guideline cross-links to `src/rules/verify-before-complete.md`,
which is one of the nine kernel rules: the `block-kernel-rule-writes` PreToolUse
guard refuses every agent write to it, and the only two bypasses named in its own
deny message are human acts outside the session. The edits are **fully drafted**
and are preserved verbatim in the stub — the residual gate is a write guard, not
unfinished analysis. The ≥ 24 h kernel-merge spacing is already satisfied
(last kernel-rule merge `d74f1238a`, 2026-07-31), so nothing here is waiting on
a clock.

**What that leaves genuinely open.** `verify-before-complete` still does not
route to either guideline, so both remain reachable from the catalog, the index
and two contracts but **not** from the always-loaded rule Risk 4 named as their
routing surface. That risk — "a guideline nobody routes to is inert cost" — is
therefore mitigated in part and not in full, and it stays open until the stub's
P1 probe passes. Recording it as closed would be exactly the false green this
roadmap exists to prevent.

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

### Execution notes for Phase 2

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
- [-] **Step 6:** _(TRANSFERRED 2026-08-20 — disposition B, outcome `transferred`, to [`stubs/road-to-kernel-cross-link-soak.md`](stubs/road-to-kernel-cross-link-soak.md); the edit is preserved verbatim there and needs no re-derivation.)_ Add an ease tripwire to `verify-before-complete`'s red flags: a verification that was far easier than expected is a signal to check the path, not a signal of success. The existing red flags track confidence wording and not ease.
- [-] **Step 7:** _(TRANSFERRED 2026-08-20 — disposition B, outcome `transferred`, to [`stubs/road-to-kernel-cross-link-soak.md`](stubs/road-to-kernel-cross-link-soak.md); the token-optimizer half is recorded there as never-firing rather than carried.)_ Cross-link the new guideline from `verify-before-complete` and from the token-optimizer catalog row for that rule, per `token-optimizer-maintenance`.

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

### Execution notes for Phases 4-5

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

- **Status:** resolved 2026-08-20 — **transferred**, not done. Disposition **B**
  per the drain-run framework
  `agents/evidence/council/drain-blocker-dispositions-b.md` <!-- ref-ignore -->
  (read from `origin/drain/council-records`, PR #1463 — not yet on `main`, hence
  the marker). Its rationale, verbatim: *"Rule 3 requires B because bypassing
  the kernel write guard and merging the dedicated PR are externally controlled
  actions."* Outcome state `transferred`; destination
  [`stubs/road-to-kernel-cross-link-soak.md`](stubs/road-to-kernel-cross-link-soak.md),
  which carries the original criterion verbatim, the full list of dependent
  items moved, a named re-entry producer, and three detection probes measured
  2026-08-20 (P3 passing, P1 and P2 not-yet). **Nothing below was executed** —
  the two edits are preserved verbatim in the stub so the maintainer applies
  rather than re-derives them.
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** nothing further in this roadmap. It blocked Phase 3 Step 6 and
  Step 7 and the cross-link half of one acceptance criterion; all three are now
  `[-]` transferred, and the *existence* half of that criterion is closed on its
  own evidence.
- **What to do:** apply the two edits below to
  `src/rules/verify-before-complete.md` in their OWN pull request.
  `verify-before-complete` is one of the nine kernel rules
  (`docs/contracts/kernel-membership.md`), and `scope-control § Kernel-rule
  edits` requires one rule per PR — a guarantee no autonomous mandate lifts.
  Commit the re-anchored `internal/bench/reports/kernel-prefix.json` from
  `./scripts-run src/scripts/check_kernel_prefix_stability --update-baseline`
  in the same PR; the byte-stability gate stays red without it and local
  preflight does not catch that.

  **This is maintainer-applied end to end — an agent cannot author it**
  (measured 2026-08-10, on the attempt). The `block-kernel-rule-writes`
  PreToolUse guard in `src/scripts/hook_manifest.yaml` refuses every agent
  write to a kernel rule outright: *"kernel rule verify-before-complete is
  immutable — tighten-only via the override exception registry"*. Its own
  message names the only legitimate bypass, and both branches are human acts
  outside the session: go through the override exception registry, or disable
  the guard entry. Same shape as `road-to-kernel-question-triangle`, whose
  one-line kernel amendment is maintainer-owned for exactly this reason.
  So the residual gate here is the **write guard**, not a waiting period —
  which is worth stating because the ≥24 h is a *spacing* constraint between
  merges of consecutive kernel-rule PRs, and it is already satisfied: the last
  merge touching any of the nine kernel rules was 2026-07-31 (`d74f1238a`).
  A screen that reads the 24 h as an unstarted soak will wrongly conclude this
  roadmap is one merge away from closing.

  1. **Step 6 — the ease tripwire.** Add to the `## Red flags — STOP
     immediately` list:

     > - A verification that was **far easier than expected** — check the path
     >   before believing the result, per [`false-green`](../../docs/guidelines/agent-infra/false-green.md)

     The existing red flags track confidence *wording* ("should pass", "seems
     fine") and not *ease*; every false green catalogued in `false-green.md`
     felt like a pass at the moment it happened.

  2. **Step 7 — the cross-links.** Add to `## Verification commands`:

     > Authoring a new gate → [`gate-authoring`](../../docs/guidelines/agent-infra/gate-authoring.md).
     > Ways a green result can be false, with detection commands →
     > [`false-green`](../../docs/guidelines/agent-infra/false-green.md).

     **Link depth corrected 2026-08-10.** Both drafts above originally said
     `../docs/…`. From a source file under `src/rules/` that resolves to
     `src/docs/`, which **does not exist**; `../../docs/` reaches the real
     repo-root `docs/`. The two-level form is also what the majority of
     `src/rules/` uses when it links a guideline, `direct-answers` (the other
     kernel rule in that set) included — though three rules do carry the
     one-level form, so the tree is not unanimous and the filesystem is the
     deciding evidence, not the count.

     **No gate catches this, which is why the source form has to be right.**
     Probed by canary the same day: a deliberately nonexistent
     `../../docs/guidelines/agent-infra/<bogus>.md` appended to a roadmap left
     `check_references` at rc=0 over 1118 scanned references — it did not
     resolve the path at all. So "the reference checker is green" is not
     evidence that either form works, in either direction.

     **No `token-optimizer` edit rides along** — this instruction previously
     said to update the `verify-before-complete` row in
     `src/skills/token-optimizer/SKILL.md` per `token-optimizer-maintenance`.
     There is no such row: the catalog does not carry `verify-before-complete`,
     and that rule's cited-asset list does not name this file, so the
     maintenance obligation never fires. Do not invent a row to satisfy it —
     that would add a catalog entry nobody asked for.

- **Resolved when:** both edits are merged and the soak has elapsed. Everything
  else in Phase 3 — both guidelines, the lifecycle, the gaming-risk block, and
  the inline suppression key — landed in this change and does not wait on it.
  **This criterion is carried verbatim into the stub and is satisfied there, not
  here.** It is deliberately left unedited: the transfer moves who owns the
  condition, never what the condition says.

## Acceptance Criteria

- [x] `src/scripts/_lib/gate_ledger.ts` exists, is typechecked, and has a paired positive and negative fixture.
- [x] Three named gates adopt the ledger and print a scanned denominator on success.
- [x] A planned-but-unaccounted target throws, proven by a test.
- [x] An allowlist entry present in the working copy and absent at the base ref fails, proven by a test.
- [x] Every human-authored suppression entry carries a non-empty `reason`, and new entries additionally carry a `falsifier`.
- [x] `docs/guidelines/agent-infra/gate-authoring.md` and `docs/guidelines/agent-infra/false-green.md` exist. _(177 and 232 lines; `gate-authoring.md` carries all five obligations Phase 3 Step 1 enumerates, `false-green.md` carries eleven catalogue entries covering all eight classes Phase 3 Step 5 enumerates — see § Outcome for the two that were missing until 2026-08-20. Both cross-link each other and are referenced from `docs/catalog.md`, `agents/index.md`, `docs/contracts/ci-green-floor.md` and `docs/contracts/branch-protection-policy.md`.)_
- [-] Both guidelines are cross-linked **from `verify-before-complete`**. _(TRANSFERRED 2026-08-20 — disposition B, outcome `transferred`, to [`stubs/road-to-kernel-cross-link-soak.md`](stubs/road-to-kernel-cross-link-soak.md). `verify-before-complete` is a kernel rule and the `block-kernel-rule-writes` guard refuses every agent write to it; the criterion's other half is closed above.)_
- [x] A deliberately crashing gate does not produce a green aggregate, proven by a test.
- [x] `docs/contracts/ci-green-floor.md` carries a `## CI delta` section and a gate keeps it fresh.
- [x] A generator given an unmeasured dimension emits no percentage for it, proven by a test.
- [x] Quality gates delegated to remote CI on the pull request. _(PR #1181: 43 checks pass, 1 skipping, 0 failures.)_

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-20 | reviewer: claude/host -->

Re-reviewed 2026-08-20 at the roadmap's close, against measurements taken the
same day rather than by restamping the date. Two rows changed materially:
Risk 4's mitigation was **falsified in both halves** and is rewritten, and
Risk 5's premise was corrected during execution so its mitigation describes
something that no longer happens. Risks 1, 2 and 3 keep their wording and gain
an outcome line each.

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Ledger adoption becomes a 466-gate sweep | implementation | Adopting the ledger everywhere at once is a very large mechanical diff across the whole gate estate, and a batch touching the kernel-prefix set would trip the byte-stability gate. | Phase 1 adopts exactly three gates and records an exempt count as a ratchet; the remainder migrates incrementally as gates are touched, never as a sweep. **Held — measured 2026-08-20: 46 of 261 registered gates carry the ledger (38 ledgered + 8 exempt, 17.6%), grown from the three named adoptions by the adopt-or-exempt rule firing on new arrivals rather than by any sweep; the ratchet went 216 → 215 that way and carries zero headroom, so the next un-adopted arrival reds it immediately.** | Phase 1: Completeness accounting |
| 2 | The falsifier field lands as a pro-forma string | product | A required field invites a placeholder value that satisfies the schema without deciding anything, which is the gate-fatigue failure this package has already recorded. | New entries only, no retro-fill; the field holds a command, and Phase 3's gaming-risk discipline applies to this gate as much as to any other. **Held so far, on a small sample — measured 2026-08-20: 6 of 11 `gate-violation-baselines.json` entries carry a falsifier and all six are real re-runnable `./scripts-run` commands, none a placeholder. Narrower than it reads, though: the field lives on that file only, and the eleven allowlist surfaces `check_suppression_hygiene` tracks carry `reason` without a falsifier, so the pro-forma risk is unmeasured there rather than absent.** | Phase 2: Make shrink-only mechanical |
| 3 | Base-ref enforcement false-reds on a legitimate ratchet reset | implementation | A deliberate baseline reset after a real tooling change would present as new entries and block the change that performs the reset. | Renames read from git; a documented reset path records the reason in the commit and the gate reports the reset rather than failing silently. **Untested, not disproven — measured 2026-08-20: `check_suppression_hygiene` is green across 12 declared surfaces with 0 removals, and no reset has been performed since the mechanism landed. The mitigation has therefore never been exercised; treat a first reset as the moment this row is decided.** | Phase 2: Make shrink-only mechanical |
| 4 | Two new guidelines add reading surface without changing behaviour | product | This package already carries a large guideline layer, and a guideline nobody routes to is inert cost. | **FALSIFIED in both halves, 2026-08-20 — this cell previously read "routed from an existing always-loaded rule and from the token-optimizer catalog", and neither is true.** The always-loaded route is `verify-before-complete`, which is a kernel rule the write guard refuses; that work is transferred to `stubs/road-to-kernel-cross-link-soak.md` and has not landed. The token-optimizer route does not exist and never will: the catalog carries no `verify-before-complete` row and that rule is not in `token-optimizer-maintenance`'s cited-asset list, so the obligation never fires — inventing a row to satisfy this mitigation was explicitly refused. What the guidelines DO have is four inbound references (`docs/catalog.md`, `agents/index.md`, `docs/contracts/ci-green-floor.md`, `docs/contracts/branch-protection-policy.md`) plus a mutual cross-link, and `gate-authoring.md` is named as the single authoring path for a new gate. **The risk is mitigated in part and stays OPEN until the stub's P1 probe passes.** | Phase 3: Gate authoring discipline |
| 5 | The estate-level result change masks a real failure | implementation | Degrading a crashed gate to a warning could hide a genuine break that previously surfaced as a hard failure. | **Did not arise — the change that would have created it was not made.** Phase 4 Step 4's premise ("a crashed gate currently reads as a passing gate") was measured half-wrong: a crash was already ❌ in `check_gate_coverage`. What was missing was the distinction between *found violations* and *could not measure at all*, so `_lib/gate_result.ts` classifies on structural error names and the aggregator gained an `estate_invalid` verdict. **No crash was softened to a warning, so there is nothing here to mask a failure**; the null-result check fails closed as originally specified. A test pins it (`tests/scripts/gate_estate_result.test.ts`). | Phase 4: Second-order guards |

## Provenance

- Source: six independent third-party agent-skill suites converging on the same
  completeness invariant, plus two first-party vendor suites for the base-ref and
  self-test mechanisms. Anonymized per `source-confidentiality`; per-source links
  in the sweep record's § Provenance.
- Sweep record + full verdict set:
  [`skill-ecosystem-sweep-2026-08`](../settings/contexts/skill-ecosystem-sweep-2026-08.md).
- Council: see the sweep record § Council for the freeze disposition and the
  sequencing verdict that authorized this roadmap set.
