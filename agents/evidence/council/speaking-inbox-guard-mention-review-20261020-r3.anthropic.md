<!-- evidence-type: original-review -->

<!-- The anthropic seat's reply of 2026-10-20 to the prompt in
     speaking-inbox-guard-mention-review-20261020-r3.question.md, verbatim. -->

Matze, reviewing round 3 of the speaking-inbox guard.

## 1. Agreement with Prior Points

**With Reviewer A:**
Fully agree on the security assessment. The implementation is non-expanding: no new speaking directory creation is allowed that the base refused. The helper-script regression is correctly closed by refusing relative shell tokens regardless of their existence anywhere.

**With Reviewer B:**
Strongly agree on the deny-message defect. Lines 374-375 claim "a shell command reaches it only by its absolute path," but `cd /tree && ls agents/tmp/<existing>` does reach via relative path—it's the **guard's recognition** that's limited, not shell resolution itself. Reviewer B's suggested rewording is clearer and technically correct.

Also agree on the temp directory cleanup issue in tests (lines 521-526).

## 2. Disagreements

None. Both reviewers correctly identified the core aspects.

## 3. New Points and Refinements

**The split exists-probe logic is the key correctness property:**

At lines 432-445, the code handles two surfaces differently:
- Shell tokens: probed only when `path.isAbsolute(v)`  
- Path-keyed tool candidates: probed unconditionally

This split is **correct** because:
- Shell tokens are unpredictable—they may invoke scripts/functions/aliases that `cd` elsewhere before resolving their argument
- Path-keyed tools have a known, absolute `cwd` from the native payload, so their relative paths resolve predictably

The helper-script test (lines 547-550) validates this: even though `speaking` exists under `tree` (the tool's `cwd`), the helper changes to `other` before creating, so trusting the relative token would be wrong. Round 3 correctly refuses it.

**The `cwd` fallback to empty string is conservative:**

When native `cwd` is missing or relative, falling back to `''` (hook process cwd) preserves the baseline behavior. This isn't new authority—it's the stated pre-existing default when no absolute `cwd` is provided.

**Evidence the guard tightens without expanding:**

The test at lines 575-586 ("still refused") confirms that shell tokens naming new speaking directories remain blocked in all tested forms—quoted literals, heredocs, redirects. The newly allowed case (relative Write into an existing round under native `cwd`) is legitimate: the directory already exists at the tool's actual resolution base.

## 4. Concrete Next Steps

1. **Fix the deny message** (lines 374-375) per Reviewer B's wording:
   > Already created? Rename it. Until then, this guard recognizes it from shell commands only when referenced by absolute path; relative arguments may resolve elsewhere and are judged as new.

2. **Add temp directory cleanup** in tests:
   ```typescript
   afterAll(() => {
       // Clean up tree, other, helper.sh
   });
   ```

3. **Optional: add a comment** explaining the split probe logic around lines 432-440, since the difference between shell-token and path-keyed-tool handling is load-bearing.

4. **Merge as-is** after the deny-message fix. The security posture is correct; the defect is documentation only.

---

**Final verdict: `confirmed-non-expanding`**

**Defect summary:**
- File: `src/scripts/hooks/block_speaking_inbox_dir.ts:374-375`
- Severity: **low** (documentation accuracy; behavior correct)
- Fix: rewording per Reviewer B

**Highest-leverage change:** The absolute-only probe for shell tokens—closes the helper-script regression while maintaining the exists-carve-out for absolute paths.

<!-- role-mode: reviewer | contract: verdict-severity-rationale-change -->
