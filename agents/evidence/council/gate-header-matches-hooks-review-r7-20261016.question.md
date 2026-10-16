<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-16 for branch fix/gate-header-matches-hooks-20261016,
     round 7, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch fix/gate-header-matches-hooks-20261016, round 7 — delta after round 6

Round 6 (prompt `agents/evidence/council/gate-header-matches-hooks-review-r6-20261016.question.md`, reviewed `85d209961`): openai APPROVE; anthropic REQUEST_CHANGES. Both seats named the same change: an actionable maintenance instruction above `REVIEWED_PRE_TOOL_USE`, so a maintainer meeting the failing case knows what to do.

Disposition: comment-only, in `tests/scripts/check_kernel_edit_ratified_header_claims.test.ts`, below. No assertion and no gated file changed; the subject digest is still `611276120fee1278c9d819d284d1a3872ba2c106571b6e1bf085198cb05c2bc4`. The four cases pass.

```diff
  * `one-question-per-ask`, which reads only the question tool. The rest are
  * advisory in the manifest and cannot deny.
+ *
+ * When the last case fails because a concern was bound: if it can deny (its
+ * manifest `severity` is `blocking`), send an edit of both paths through the
+ * built dispatcher and see whether it refuses; if it refuses either, change the
+ * header of `check_kernel_edit_ratified.ts`, which then needs a record. Either
+ * way, add the concern here, sorted, and say how it was checked above.
  */
```

Review the delta. Report any remaining defect with file:line, scenario and severity. State your stance (APPROVE or REQUEST_CHANGES).
