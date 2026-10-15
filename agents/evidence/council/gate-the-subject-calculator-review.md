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

# Round 2 (stage 1) — reviewed `59f504d8d` with prompt `gate-the-subject-calculator-review-r2-20261015.question.md`, anthropic REQUEST_CHANGES (stated as REJECT) · openai REQUEST_CHANGES

Final-round text of each seat, verbatim, in the order the run recorded the seats.

## anthropic/claude-sonnet-4-5

Reviewing the stage-1 diff for the ratification gate mechanism widening.

## Agreement with prior reviewers

**Reviewer A** — ✓ temporal vulnerability is real, ✓ base/head consistency test needed, ✓ documentation gap identified

**Reviewer B** — ✓ **HIGH severity correct**: the `ratification_subject.ts` changes are ungated by both base and head gates, ✓ ledger test regression miss (uses old `READER_PATH`), ✓ closure test duplicates list instead of discovering it

## Disagreement

None — both reviewers identified the same core bootstrap issue. Reviewer B stated it more precisely: neither gate version digests the changed digest calculator itself.

## New points and refinements

1. **The "measured consistency" proves the vulnerability rather than disproving it.** Both gates digest only `check_kernel_edit_ratified.ts` at commit `6fbe358da`. That confirms ratification_subject.ts changes are excluded — not that stage-1 is safely bound. A malicious edit in lines 45-48 or 467-470 could subvert digest computation for future commits and ship undetected.

2. **The three-stage split Reviewer B implies is still insufficient.** Adding `ratification_subject.ts` to the mechanism set first (stage 0) doesn't close the gap — the base gate still won't know about it when CI runs. The chicken-and-egg requires **dual records** for this PR:
   - Record A ratifies `check_kernel_edit_ratified.ts` changes (gate logic, `isMechanismPath`, `MECHANISM_IMPORT_PATHS`)
   - Record B ratifies `ratification_subject.ts` changes (import list, `selfSet` → `isMechanismPath` delegation)
   
   Or redesign to add `isMechanismPath` in one PR (unused), then consume it in a second after the first is committed.

3. **Ledger test weakness is exploitable.** Using `READER_PATH` (already `self: true` pre-change) doesn't prove the new enumerate-mechanism-files logic works. A regression could miscount `MECHANISM_IMPORT_PATHS` entries while still passing. Should assert one of `['src/scripts/_lib/adr_frontmatter.ts', 'src/scripts/_lib/gate_ledger.ts', 'src/scripts/_lib/scan_scope.ts']` appears in the gated set AND is absent from `out_of_scope`.

4. **Import-cycle safety is correct but undocumented.** The call-time discipline (`isMechanismPath` invoked from `gatedFilesOf`, never at module scope) is sound under ESM evaluation order. But the comment at line 52-58 should explicitly state: *"Safe under circular import because both modules' top-level constants initialize before either function runs; `isMechanismPath` is called only from `gatedFilesOf`, post-initialization."*

5. **Stage-2 must follow immediately.** The temporal gap is **accepted** per owner decision, but acceptance doesn't eliminate the risk — it defers closure. Every commit between stage-1 and stage-2 merges operates under a digest calculator whose changes were never ratified. Recommend stage-2 PR opens the same day stage-1 merges.

## Failures found

**src/scripts/_lib/ratification_subject.ts:45-48, 467-470 — digest calculator changes ungated by both base and head — CRITICAL**

Neither the base gate (missing `MECHANISM_IMPORT_PATHS` / `isMechanismPath`) nor the head gate (deliberately excludes `ratification_subject.ts` until stage 2) digests the import-list change (line 45-48) or the `selfSet` → `isMechanismPath` refactor (467-470). A malicious actor could alter digest computation — e.g., make `isMechanismPath` always return `false` — and CI would accept the ratification record because it only digests `check_kernel_edit_ratified.ts`. The attack payload ships hidden in plain sight.

**tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts:74-78 — ledger test doesn't exercise new behavior — MEDIUM**

Uses `READER_PATH`, which `classifyPaths` already marked `self: true` before this PR. The old boolean-self implementation could still emit `out_of_scope 1` and pass this test. Doesn't prove the new enumerate-files logic counts `MECHANISM_IMPORT_PATHS` entries correctly. Use `'src/scripts/_lib/adr_frontmatter.ts'`, assert it's in the gated set with count `>= 1`, and assert it's NOT in the out-of-scope set.

**tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts:22-29 — test duplicates claimed closure instead of discovering it — HIGH**

`IMPORTED` hardcodes the three-file list, duplicating `MECHANISM_IMPORT_PATHS`. Adding a fourth verdict-affecting import without updating both lists passes all tests. The PR's security property is **closure completeness** — every module the verdict runs through must be gated. Static-import traversal (e.g., read `check_kernel_edit_ratified.ts` imports, recursively walk, filter to `src/scripts/`, assert equals `MECHANISM_IMPORT_PATHS ∪ {known plumbing}`)) would prove completeness. Current test proves list-list consistency, not coverage.

**src/scripts/check_kernel_edit_ratified.ts:142-148 — comment ambiguity on writer CLI exclusion — LOW**

"`_lib/ratification_subject.ts`… joins in a separate change" might suggest `src/scripts/ratification_subject.ts` (the writer CLI) also joins. Clarify: "*The `_lib/` module joins; the writer CLIs `src/scripts/ratification_subject.ts` and `ratification_header.ts` stay outside per owner decision — the gate imports nothing from them.*"

## Verdict

**REJECT**

**Single highest-leverage change:** Abort stage-1 as designed. Ship under **dual ratification records** in one PR — Record A for gate changes (`check_kernel_edit_ratified.ts`), Record B for digest-calculator changes (`ratification_subject.ts`) — or split into two sequential PRs where stage-1 adds `isMechanismPath` unused, stage-2 consumes it after stage-1 commits. The temporal-vulnerability acceptance doesn't eliminate the vulnerability; it defers closure while executable digest logic ships unratified. That's structurally unacceptable for a security gate whose job is preventing unratified code from shipping.

## openai/codex-default

## Prior-round assessment

I agree with Reviewer A that:

- Replacing `selfSet()` with `isMechanismPath()` strictly widens the digest set by the three new mechanism imports; it does not narrow existing coverage.
- The circular import is safe because the imported predicate is evaluated only when `gatedFilesOf()` runs, after module initialization.
- Enumerating actual mechanism paths in the ledger is stronger than substituting `SELF_PATH`.
- Replacing `gate_ledger.ts` with `link_crypto.ts` preserves the neighboring-file negative test.

I agree with Reviewer B that:

- The changed digest calculator is absent from both the base and head subjects.
- The ledger regression test does not distinguish the old behavior from the new behavior.
- `IMPORTED` duplicates the production declaration and cannot prove import-closure completeness.

I disagree with Reviewer A’s characterization of the unbound calculator as merely an “accepted temporal vulnerability.” The owner decision explains why it was staged, but it does not make the stage-1 bytes cryptographically bound. Base/head equality proves agreement on one selected file, not completeness of that selection.

I also disagree with Reviewer B’s proposed sequencing as stated. With the old calculator, merely making `_lib/ratification_subject.ts` gated does not make its own bytes enter the digest: the old `selfSet()` does not contain that path. A clean bootstrap therefore needs an independent trust mechanism—such as an externally verified blob hash or explicit bootstrap attestation—not just another ordering of the same two edits.

## Findings

### High — Changed digest calculator is not bound

`src/scripts/_lib/ratification_subject.ts:45-48, 456-470`

Failure scenario: this PR changes executable code deciding which bytes a ratification subject covers, but neither the base nor head mechanism set includes this file. Both gates consequently accept a record whose subject covers only `check_kernel_edit_ratified.ts`. A defect or malicious alteration in the calculator can therefore merge without the ratification record committing to its bytes. Stage 2 cannot retroactively bind the version introduced here.

This is especially material because the advertised invariant is that changes to the ratification mechanism are content-bound. An explicit owner decision can authorize a trust-root bootstrap, but that exception itself needs independently verifiable evidence.

### Medium — Ledger regression test passes under the old implementation

`tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts:70-78`

The test supplies `READER_PATH`, which was already a self-classified path. The previous implementation would also report `out_of_scope 1`, so the assertion does not prove that newly added mechanism imports are now counted as gated targets.

Use a path from `MECHANISM_IMPORT_PATHS`, and assert both its positive gated classification/accounting and its absence from the out-of-scope set.

### Medium — Test does not establish closure completeness

`tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts:25-29`

`IMPORTED` manually repeats the production list. If another verdict-affecting static import is added but omitted from both arrays, every test still passes. Thus this diff does not establish that the target stage-2 set covers every verdict-affecting module.

The promised stage-2 import-closure traversal would address this, but until then completeness rests on manual inspection of unchanged imports that were not supplied. The named modules appear internally consistent, but the complete closure cannot be independently verified from this artefact.

### Low — Base/head equality deserves executable bootstrap evidence

`tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts:1-81`

Reviewer A’s proposed regression test would be useful, but it is not the primary defect: equality can coexist with both gates omitting the calculator. Any such test must assert both equality and the intended exceptional bootstrap scope, otherwise it risks institutionalizing the incomplete subject as success.

## Other review dimensions

- No injection, secret exposure, unsafe deserialization, authorization, null-safety, or type-drift defect is visible.
- `evaluate()` normalizes mechanism paths and deduplicates them through `Set`, so repeated or Windows-style paths do not inflate ledger targets.
- The shared predicate is appropriate reuse in this functional design; introducing an object or class would add structure without removing complexity.
- The PR’s blast radius is larger than a routine membership-set expansion because it edits the digest calculator while changing the gate that protects it.
- The most rubber-stamp-prone evidence is the matching base/head digest: it sounds conclusive but proves consistency rather than complete content binding.

<details>
<summary>Dropped false positives</summary>

- `src/scripts/_lib/ratification_subject.ts:467` — no temporal-dead-zone failure: `isMechanismPath` is not invoked during module evaluation.
- `src/scripts/check_kernel_edit_ratified.ts:557` — duplicate paths are harmless because ledger targets are accumulated in a `Set`.
- `tests/scripts/check_kernel_edit_ratified.test.ts:225-232` — replacing the now-gated example does not weaken that negative classification test.

</details>

Coverage & confidence: deep-reviewed all four supplied files; unchanged static import closure was bounded out; high confidence in the binding and ledger-test findings, medium confidence on final closure completeness.

REQUEST_CHANGES — the PR changes the digest calculator without binding those changed bytes to the ratification record accepted by CI.

Highest-leverage change: add an independently verified bootstrap attestation for the exact `_lib/ratification_subject.ts` blob, then add a regression test proving both the bootstrap scope and base/head subject agreement.

# Round 3 (stage 1, delta) — reviewed `7afc062c3` with prompt `gate-the-subject-calculator-review-r3-20261015.question.md`, anthropic REQUEST_CHANGES · openai REQUEST_CHANGES

Final-round text of each seat, verbatim, in the order the run recorded the seats.

## anthropic/claude-sonnet-4-5

Matze, reviewing round 3 delta and prior critiques:

## Agreement with Prior Reviewers

**I agree with both Reviewers A and B on the blob attestation gap (HIGH/MEDIUM severity).**

Both correctly identify the critical window: after this PR merges but before stage 2, `ratification_subject.ts` can be modified without CI detection. The closure test would pass (path still equals `PENDING`), both gates omit its bytes, and the prose attestation could silently become stale. This is particularly serious because that module decides which files require ratification.

Reviewer A's suggested fix (stage 2 blob verification) is sound but occurs too late—it only catches drift at stage 2 merge time. Reviewer B's "machine-bind the blob" framing is the stronger approach: prevent drift during stage 1.

**I agree with Reviewer B's dynamic import detection concern (MEDIUM).**

Lines 48-51: The regex-based comment stripping (`/\/\*[\s\S]*?\*\//g` and `/\/\/.*$/gm`) cannot distinguish comments from string contents or regex literals. While unlikely in this codebase, a contrived source file with `/*` inside a string could cause the subsequent `import(` check to miss a real dynamic import. Since `relativeSpecifiers` already parses the source, extend that to report dynamic imports rather than adding a second regex pass.

## Disagreement

**Severity levels:** I rate the blob gap as **HIGH**, not MEDIUM (Reviewer A). The ungated file defines ratification itself, so a silent change could weaken the entire gate. The failure is undetected, and the window is real (review → merge → stage 2 could span days).

## New Points Not Raised

**1. PENDING should be explicitly verified as ungated**

Line 87: `expect(ungated).toEqual(PENDING)` verifies discovered ungated files match `PENDING`, but doesn't verify that `PENDING` files are actually ungated. If someone accidentally gates `ratification_subject.ts` early (e.g., mistakenly adding it to a gated list), the equality could still hold. Add:

```typescript
for (const p of PENDING) {
    expect(requiresRatification(classifyPaths([p], [])), `${p} must remain ungated in stage 1`).toBe(false);
}
```

**2. Blob hash should be CI-enforced in stage 1, not just documented**

The disposition of Finding 1 documents blob `3842d91528ec5229819dbd0da2f1a67a1f0eb06c` but relies on human verification in stage 2. Add a temporary assertion to `check_kernel_edit_ratified.ts` itself (which is already gated):

```typescript
// Temporary stage 1: removed when stage 2 gates this file
const STAGE_1_REVIEWED_BLOB = '3842d91528ec5229819dbd0da2f1a67a1f0eb06c';
const currentBlob = execSync('git rev-parse HEAD:src/scripts/_lib/ratification_subject.ts').toString().trim();
if (currentBlob !== STAGE_1_REVIEWED_BLOB) {
    throw new Error(
        'ratification_subject.ts modified after stage 1 review (ungated file must not change until stage 2). ' +
        `Expected ${STAGE_1_REVIEWED_BLOB}, got ${currentBlob}`
    );
}
```

This executes on every gate invocation (including CI), prevents silent drift, and stage 2 removes it when the file is finally gated.

**3. Closure walker assumes .ts/.js correspondence**

Line 53: `.replace(/\.js$/, '.ts')` assumes all `.js` imports have `.ts` sources. While `fs.existsSync` (line 55) catches mismatches, the error message would be generic. Add context:

```typescript
const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec).replace(/\.js$/, '.ts'));
expect(fs.existsSync(path.join(REPO, target)), `${rel} imports ${spec} → expected ${target}`).toBe(true);
```

## Code Quality Assessment

The delta correctly addresses findings 2-4:
- ✅ Closure walk (lines 40-61): follows static imports, forbids dynamic, validates existence
- ✅ `PENDING` equality (line 87): ungated remainder must exactly match the named list
- ✅ Ledger test (lines 123-128): now covers `gate_ledger.ts` itself
- ✅ Comment clarification (line 144): names writer CLIs explicitly

## Verdict: REQUEST_CHANGES

## Single Highest-Leverage Change

**Add CI-enforced blob hash verification for `PENDING` files** (my new point #2 above). This closes the critical gap where the ungated file defining ratification subjects could be modified between review and stage 2, potentially weakening the gate. The temporary check should live in `check_kernel_edit_ratified.ts` (already gated), execute on every invocation including CI, and be removed in stage 2.

**File:** `src/scripts/check_kernel_edit_ratified.ts:147` (after existing comment)  
**Issue:** Prose attestation of `ratification_subject.ts` blob is not CI-enforced  
**Fix:** Add temporary blob equality assertion as shown above

## openai/codex-default

## Findings

### HIGH — The pending policy module remains unbound

`tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts:35-41, 86-90`

`PENDING` constrains the exemption’s identity, but not its contents. After review, a commit can modify `_lib/ratification_subject.ts`; it will remain the sole expected ungated module, so the closure test passes, while neither gate digest commits to the changed bytes. The prose blob attestation then silently becomes stale.

The owner’s decision records acceptance of staged gating, but the stated constraint does not preclude a temporary machine-enforced content pin. Put the expected blob/content hash in an already-gated mechanism file and verify the pending module against it. Updating both would then modify gated material and require ratification.

### MEDIUM — Dynamic imports can be hidden from the closure check

`tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts:48-51`

The regex comment stripping is not syntax-aware. For example, valid source shaped like this hides the executable import from the check:

```ts
const start = "/*";
import("./dependency.js");
const end = "*/";
```

The first regex treats the delimiters inside those strings as a comment and removes the intervening dynamic import. If `relativeSpecifiers` only reports static imports—as its name and the accompanying comment indicate—the dependency is absent from the closure.

Use the existing import parser or the TypeScript AST to report both static and dynamic imports. This avoids maintaining a second, weaker lexical interpretation.

## Prior critiques

- **Agree with Reviewer B:** both the mutable pending-file gap and regex bypass are concrete, correctly scoped defects.
- **Agree partly with Reviewer A:** CI-enforced binding is the right remedy, but enforcement belongs in this stage, not merely as a promise for stage 2. The vulnerable interval exists now.
- **Disagree with Reviewer A’s claim that the closure walk has no visible bypass:** regex comment removal demonstrably permits one.
- **Refinement:** stage 2 verifying only its base blob protects the eventual handoff, but does not make this PR’s current CI verdict attest to the pending bytes. A temporary pin in gated stage-1 code does.

The exact `PENDING` equality does correctly reject every additional *discovered* ungated module, and the per-module `gatedFilesOf` assertions cover digest inclusion for discovered non-pending members. The ledger strengthening and clarified writer-CLI comment are sound. No new secret, deserialization, authorization, injection, or unjustified OO concern appears.

<details>
<summary>Dropped false positives</summary>

- Import cycles are safe because each path enters `seen` before its imports are traversed.
- `PENDING` ordering is deterministic here and is not a defect.
- `.js`-to-`.ts` resolution is narrow, but the existence assertion converts unsupported paths into test failures rather than silently omitting them.
- Whether `relativeSpecifiers` misses re-exports cannot be established without its implementation; this remains a coverage limitation, not a reported defect.

</details>

Coverage & confidence: deep-reviewed both shown files and the stated dispositions; unchanged stage-1 code and the implementations of `relativeSpecifiers`, `requiresRatification`, and `gatedFilesOf` were unavailable. Confidence: medium-high.

REQUEST_CHANGES — CI still permits undetected mutation of the policy module and the closure oracle can miss executable dynamic imports; the single highest-leverage change is to machine-bind `_lib/ratification_subject.ts` from already-gated code now, while replacing regex import detection with the existing parser before merge.
