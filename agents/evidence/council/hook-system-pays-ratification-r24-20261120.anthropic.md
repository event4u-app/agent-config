<!-- evidence-type: original-review -->

<!-- The anthropic seat's reply of 2026-11-20 to the prompt in
     hook-system-pays-ratification-r24-20261120.question.md, verbatim (claude-sonnet-4-5). -->

# Independent Review — Hook System Environment Optimization + Bundle Budget Restructure (Round 24)

## Assessment: **AGREE** (with conditions)

---

## 1. Points from Prior Round

### Agree with Reviewer A:
- Round 23 point 1 is **CLOSED**: `recoverConcernEnv()` at line 1 of `main()` (dispatch_hook.ts:1059) closes the early-return bypass. The environment recovery runs before argument parsing, before `--project-dir`, before every branch.
- The environment system **strengthens fail-closed** in three ways: cross-dispatch recovery (throws on write failures), failed resets refuse the dispatch (no verdict), spawned children get the baseline even if in-process reset failed.
- The documentation conditions are correct: (a) monitoring expectation on backstop trips, (b) test coverage verification, (c) `update_json_under_lock` return contract.
- The "half-applied `enterConcernEnv`" failure mode is correctly analyzed: the env is at baseline, next concern's drift check is false, no leak.

### Disagree with Reviewer B:
- **"Widens CI acceptance" ≠ "expands authority"**. The ratification gate asks about runtime authority (what the system can DO), not build-time acceptance criteria (what gets built). The dispatcher runs with identical permissions whether the bundle is 1.5 MB or 1.9 MB. The budget change is a **preventive control relaxation**, not a capability grant.
- D1 (owner directive) explicitly authorizes the +20% size increase for "near-term growth". The budget file documents this (line 9). The dependency allowlist is STRICTER than the old rule (blocks unlisted packages, not just counts them). This is a policy change, authorized and documented.
- The "supplied evidence does not establish that D1 exempts the relaxation" point conflates policy authorization with ratification criteria. D1 authorizes the policy; ratification checks the implementation doesn't introduce bugs or security holes. The five gated files don't expand runtime authority.

**However**, Reviewer B correctly notes the missing checker implementation. The round-23 description says the checker "exits 1 for an unlisted package or an overage", but the checker code isn't shown in this round's diff. That's a gap, though the checker isn't one of the five gated files under review.

---

## 2. New Points Not Raised in Round 1

### Cross-dispatch recovery is bulletproof:
The `pendingRestore` mechanism (concern_env.ts:30) outlives the dispatch. If a scope close fails to restore the environment AND the rollback also fails (line 85: `pendingRestore = prev`), the next dispatch in the same process MUST recover it first (line 48: `recoverConcernEnv()` throws when it cannot). This is a **two-layer fail-closed design**: rollback + cross-dispatch replay. No dispatch can proceed on a dirty environment inherited from a previous failure.

### The feedback write optimization is correct but subtle:
Quiet allows (EXIT_ALLOW, no crash, no reason) now skip their per-concern file **only if `summary.json` was written** (dispatch_hook.ts:897: `if (summaryWritten && isQuietAllow(entry)) continue`). This prevents: a quiet allow skips its file, then `summary.json` is lost (operational damage), leaving an older block as the latest visible outcome with no contradicting summary. The fallback: write the quiet allow's file anyway. Good.

### The allowlist is a stronger composition control:
`allowed_packages: ["yaml"]` refuses a second YAML parser under any name (not just counts yaml packages). Adding `js-yaml`, `yaml-js`, `yamljs`, or any other parser requires changing the allowlist, which is reviewed. This closes the **original incident** (95,846-byte second YAML parser reached a release unseen). The old `max_yaml_packages: 1` could have been bypassed by renaming the package.

### The per-chunk ceiling removal has one consequence:
The old system could detect "chunk X grew by Y bytes" per commit. The new system only detects "total bundle > 1.915 MB". Between backstop fires (expected "a few times a year"), that 320 KB slack can accumulate across dozens of commits. The file documents the monitoring expectation ("look at what grew before moving the number"), but doesn't enforce it. **Recommendation**: Add a post-backstop-fire review checklist to the budget file or ADR-268 (what modules grew, by how much, was it necessary, refactor before raising ceiling).

---

## 3. Concrete Next Steps (Ratification Conditions)

### From Reviewer A (endorse):
1. **Document the monitoring expectation**: When the backstop trips, the review must identify what grew (which modules, by how much), justify the growth, and decide whether to refactor before raising the ceiling. Add this to the budget file notes or ADR-268.
2. **Verify test coverage**: The environment recovery tests (no-op when nothing owed, throws on write failures, recovers exactly once, `main()` pays it before argument parsing, failed close → owed restore → next dispatch throws if it cannot replay) should be in the commit. The diff shows the implementation but not the test files.
3. **Confirm `update_json_under_lock` signature**: The feedback write code checks `=== "written"` and `=== "failed"` (dispatch_hook.ts:874, 897). Verify that function's contract guarantees those exact strings.

### New condition:
4. **Verify the composition checker implementation**: Round 23 says the checker "exits 0 only for a measured, in-budget bundle; 1 for an unlisted package or an overage; 2 for an invalid budget or a failed build". The budget policy change is meaningless if the checker doesn't enforce the allowlist. The checker isn't one of the five gated files, but its exit-code behavior is the enforcement layer for this policy. Confirm the checker reads `allowed_packages` and exits 1 when a package outside the list contributes bytes.

---

## 4. Five-File Check: No Runtime Authority Expansion

- **concern_env.ts**: New module. Only touches `process.env` and stderr. Strengthens fail-closed (throws on repair failures, never bypasses owed restores). No new I/O, no new permissions.
- **feedback_policy.ts**: Pure functions (`isQuietAllow`, `keepNewerOutcome`, `compareRuns`, `withLatestRuns`, `isLatestRun`). No I/O, no side effects. Testable in isolation.
- **dispatch_hook.ts**: Uses the new modules. `main()` opens one scope (line 1296), closes in finally (line 1399), asserts restore (line 1402). Feedback writes optimized (skip quiet-allow files if summary succeeded). No new child-process authority, no new file access, no new spawn capabilities.
- **hook-bundle-budget.json**: Policy change. Allowlist is STRICTER (blocks unlisted packages). Backstop is WIDER (D1-authorized +20%). Still fail-closed on violations (checker exits 1). **This is a build-time constraint, not a runtime authority grant.**
- **consistency.yml**: Comment update only ("one YAML reader" → "only allowlisted packages").

**No weakening** of fail-closed guards (environment system strengthens them), exit-code contracts (unchanged), child-process hardening (spawned concerns still get baseline via `concernSpawnEnv`), or isolation (environment reset only when concern changed it, next concern cannot inherit drift).

**No expansion** of runtime authority. The dispatcher runs with identical permissions regardless of bundle size.

---

## Failure Mode Most Likely Overlooked

**A three-way write failure**: scope open → `replaceEnv(hardened)` fails mid-loop → rollback → `replaceEnv(prev)` also fails → `pendingRestore = prev` set (line 85) → next dispatch → `recoverConcernEnv()` → `replaceEnv(pendingRestore)` ALSO fails.

This requires `process.env` assignment itself to fail **three times in a row**. The first two are caught during scope open (concern_env.ts:78–90). The third is at the top of `main()` (line 1059) and DOES throw, refusing the dispatch. So even this extreme case is fail-closed: the dispatch gives no verdict, and the host command refuses it.

**The weakest assumption**: That `process.env` operations are "fail-atomic" (either fully applied or leave prior state unchanged). The `replaceEnv()` loop (lines 52–59) does deletes + sets. If a set throws mid-loop, the environment is half-applied. The rollback path (line 82) handles this by restoring `prev`. If the rollback also fails, `pendingRestore = prev` is set, and the next dispatch's `recoverConcernEnv()` replays it. **This two-layer recovery (rollback, then cross-dispatch replay) is correct.**

---

## Weakest Assumption Underneath the Budget Change

**That the 320 KB slack (1,915,000 − 1,595,089) won't be consumed by gradual creep before the next backstop fire.** The budget file says the backstop is "expected to fire a few times a year at most". If it fires, the monitoring note says "look at what grew". But if it doesn't fire (because growth stays under the slack), no alert is raised. The per-chunk ceilings could detect "this module grew 50 KB" per commit. The wide backstop only fires when the total crosses 1.915 MB.

**Mitigation**: The dependency allowlist blocks the **original incident** (second YAML parser). Own-code growth still requires commit review. The backstop is a **slow-creep detector**, not a per-commit ratchet. D1 authorizes this tradeoff.

---

**VERDICT: ratified** — the five gated files do not expand runtime authority; the environment system strengthens fail-closed; the dependency allowlist is stricter; the size backstop is a D1-authorized policy relaxation with documented monitoring expectations. Apply the four conditions (documentation note, test verification, `update_json_under_lock` contract, composition checker enforcement).
