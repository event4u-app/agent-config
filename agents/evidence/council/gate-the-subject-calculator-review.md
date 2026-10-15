<!-- evidence-type: analysis -->

# Council review — branch fix/gate-the-subject-calculator

Prompt: `agents/evidence/council/gate-the-subject-calculator-review-20261015.question.md`,
committed verbatim. Run 2026-10-15 through the CLI seats, `--prompt-mode pr --rounds 2`,
quorum 2 of 2, nothing billed. Reviewed commit `8ee2a3452`.

| Round | anthropic/claude-sonnet-4-5 | openai/codex-default |
|---|---|---|
| 1 (2 deliberation rounds) | REQUEST_CHANGES | REQUEST_CHANGES |

The final-round text of each seat follows verbatim.

## anthropic/claude-sonnet-4-5

Matze, reviewing round 2 on the ratification gate's import-closure expansion:

## Agreement with Prior Reviewers

**Agree with Reviewer A:**
- Core import-closure logic is sound (the four added modules do run in the verdict path)
- Writer CLI exclusion is technically defensible (gate recomputes digest, doesn't execute writers)
- Static-import test coverage is strong and forward-looking

**Agree with Reviewer B:**
- **Finding 2 (bootstrap trust gap) is merge-blocking.** This is the critical issue Reviewer A completely missed. After these records land, a subsequent edit to `_lib/ratification_subject.ts` would:
  - Not be covered by the base gate's old subject (which CI runs)
  - Pass CI using the old base-subject record still in tree
  - Create an unratified edit of the digest calculator itself
  
  That's a fundamental vulnerability window.

- **Finding 3 (import-walker limitations) is valid.** The test only catches static relative imports that `relativeSpecifiers()` recognizes. Dynamic imports, re-exports, or future ESM forms could bypass coverage.

**Disagree with Reviewer B:**
- **Finding 1 (contract violation) isn't necessarily merge-blocking.** The contract text is ambiguous: "the reviewer itself — modules that compute the record's subject, write the record, ask questions and derive the verdict, **and this contract**" can be read narrowly (runtime imports only) or broadly (the logical reviewer system). The implementation chose narrow; that's defensible if documented.

**Disagree with Reviewer A:**
- The bootstrap is **not safe**. Reviewer A's analysis stops at "both records from same review" but ignores what happens to **subsequent** edits under base-gate CI.
- The test gap isn't just missing coverage—it's a missing security control.

## New Points

1. **Verification gap: `kernel_rules.ts` classification.** The comment claims it's "already gated as plumbing," but the test doesn't verify this. If it's in the import closure but NOT classified correctly, the test would still pass while leaving a hole.

2. **Ledger semantics change under-specified.** The change from `...(gated.self ? [SELF_PATH] : [])` to `...files.filter(isMechanismPath)` alters how mechanism files are counted. If other code depends on the old "exactly one file when self=true" behavior, this could break assumptions. The test only checks the count label, not downstream ledger consumers.

3. **`relativeSpecifiers()` parser trust.** Both prior reviewers accepted the import walker without questioning the parser's coverage. Does it handle `import './foo'`, `import './foo.mjs'`, `import './foo/index.js'`, bare `export * from './foo'`? The test's entire correctness depends on this unverified primitive.

4. **Test example swap unverified.** Replacing `gate_ledger.ts` with `link_crypto.ts` as "neither plumbing nor gated" assumes `link_crypto.ts` actually meets that criteria. Likely true, but both reviewers accepted it on faith.

5. **Contract document exclusion is the worse half of Finding 1.** Excluding the writer CLIs is defensible (runtime vs authoring). Excluding `docs/contracts/ratification-artifact.md`—the governance contract that defines the trust boundary—is not. That document IS the policy; changing it to weaken requirements is a governance edit that should require ratification under the very condition it's being excluded from.

## My Stance

**REQUEST_CHANGES** — Reviewer B's Finding 2 (bootstrap trust gap) is correct and merge-blocking. CI running the base gate cannot enforce coverage of files the base gate doesn't watch, so future edits to newly-watched imports would pass unratified.

**Highest-leverage change:**

Implement a **two-phase merge**:
1. **Phase 1:** Land only the import-closure expansion with a temporary CI override that runs the **HEAD gate** (not BASE) for `check_kernel_edit_ratified.ts` specifically, plus ratification record(s) covering the full change.
2. **Phase 2:** After Phase 1 merges to main, remove the override—future edits are now caught by base-gate CI (which has learned the expanded watch set).

This closes the bootstrap gap without complex staging machinery. Document the override's purpose and removal trigger explicitly in the workflow file so it can't be forgotten.

Alternatively: extend the contract to explicitly say "runtime import closure only, excluding writers and the contract document itself"—but that weakens governance and contradicts the stated condition 4.

## openai/codex-default

Matze, Reviewer B identifies the merge-blocking issues; Reviewer A’s approval rests on an unsafe bootstrap assumption.

## Prior points I agree with

- **Reviewer B, finding 1:** The watched set conflicts with the quoted contract. At `check_kernel_edit_ratified.ts:146-150`, writer modules and the contract are excluded because they are not runtime imports. Condition 4 explicitly includes modules that “write the record” and “this contract,” so runtime reachability is the wrong boundary.
- **Reviewer B, finding 2:** The two-record bootstrap does not secure base-gate CI against later calculator edits. Since the base gate ignores `_lib/ratification_subject.ts`, its digest remains valid after further changes to that file.
- **Reviewer B, finding 3:** The closure test proves only what `relativeSpecifiers()` recognizes, not every executable dependency.
- **Both reviewers:** The ledger correction is sound, replacing `gate_ledger.ts` with `link_crypto.ts` does not weaken the neighbor test, and `isMechanismPath()` is a proportionate functional extraction.
- **Reviewer A:** Shared-module gating creates real operational overhead. That cost is defensible for verdict-affecting modules, but it strengthens the case for defining the protected surface canonically rather than equating it with imports.

## Prior points I disagree with

- **Reviewer A: “Bootstrap is safe.”** Two records from one review may express the same human authorization, but enforcement is asymmetric. Base CI validates only the base-compatible record; it does not establish that the head-compatible record still describes the final branch. A subsequent calculator edit can leave the base digest unchanged and therefore pass CI using the stale record.
- **Reviewer A: “Writer CLI exclusion is correct.”** It may be correct under a purely runtime-integrity model, but it contradicts the explicitly quoted governance contract. If the contract is authoritative, the test at `check_kernel_edit_ratified_mechanism_closure.test.ts:84-89` codifies a policy violation.
- **Reviewer A: the missing bootstrap test is merely a coverage gap.** A test of current multi-record OR behavior would not fix the trust transition. The missing invariant is that every post-ratification change to a newly protected file invalidates what base CI accepts.

## Findings and refinements

1. **High — `src/scripts/check_kernel_edit_ratified.ts:146-150`; `tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts:84-89`**

   Failure scenario: an author changes the subject/header writer or the governing contract without ratification. The gate accepts the branch because those files are deliberately outside `isMechanismPath()`, despite condition 4 defining them as part of the reviewer mechanism.

   The protected surface should come from a canonical policy list encompassing the contract-defined mechanism; the import closure can then be an additional completeness check.

2. **High — `src/scripts/_lib/ratification_subject.ts:482`; proposed two-record bootstrap**

   Failure scenario: after both records are committed, the author modifies `_lib/ratification_subject.ts` again without updating either record. Base CI ignores that file, computes the same old base digest, and accepts the unchanged base-compatible record. Local head checks may fail, but the stated CI trust boundary does not enforce them.

   Staging the transition or adding a base-trusted transition check is necessary. Merely testing that either of two records can validate would preserve the vulnerability.

3. **Medium — `tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts:35-43`**

   Failure scenario: verdict-affecting code is introduced through dynamic `import()`, a project alias/package import, or syntax not recognized by `relativeSpecifiers()`. The walker omits it, and both assertions remain green.

   Re-exports are only a defect if `relativeSpecifiers()` fails to recognize `export … from`; that implementation is absent, so this specific case cannot be concluded from the diff. The test should either reject unsupported first-party dependency forms or use module resolution capable of enumerating them.

4. **Medium — `check_kernel_edit_ratified.ts:146-150`**

   The rationale conflates “cannot change what the gate accepts at runtime” with “is outside the ratification mechanism.” Those are different invariants under the quoted contract. This is a reviewer-fatigue hazard because the detailed comment makes the exclusion look conclusively justified while silently choosing the narrower definition.

No injection, secret exposure, unsafe deserialization, null-safety, type-drift, or unjustified OO issue is evident in the supplied diff.

**REQUEST_CHANGES** — the head gate is improved, but base CI can accept unratified follow-up edits to the newly watched calculator, and the protected set contradicts contract condition 4. **Highest-leverage change:** introduce and test a trusted staged bootstrap based on one canonical, contract-defined reviewer-surface list that includes the writers and contract.
