---
proposed_by: road-to-a-correction-that-is-heard 1.1 and 1.3, owner invocation of inbox-2026-10-bi
implemented_by: claude-opus-5.5 session on worktree-inbox-2026-10-bi
reviewed_by: ai-council
subject: e084c3763db8f932d37891ca5d2e43e38ad0ce0fa2702a47ab299b6a83a6a2a6
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Hook-bundle ceiling raised 1,556,670 -> 1,557,800 B for the recurrence detector and the local-only subject field; no permission, tool or floor change.

Verdict `confirmed-non-expanding`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/hook-bundle-raise-ratification-r5-20261029.question.md`, committed at `d7900210b395d91317d07fca92a780f0fc09ed99` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `confirmed-non-expanding`

```text
Matze, reviewing the final content at revision `7476c9da8e`.

## Agreement with prior reviewers

**Agree with Reviewer A:**
- No authority expansion - verified through test proof (both `payload-has-only-closed-fields` tests would fail if `subject` leaked) and explicit inclusion in `egressBlockedReason()`
- Measurements correct: 1,557,734 B final, 66 B headroom
- Pattern precision improved with first-person requirement

**Agree with Reviewer B:**
- The 1,128 B → 1,178 B documentation tells the optimization story but could confuse quick readers expecting just final numbers. The raise_log IS accurate (explicitly states "Measured 1,557,734 B on a base of 1,556,556 B"), but the intermediate step makes it denser than typical entries.
- Subject extraction via "first backticked token anywhere" is imprecise (unrelated tokens could be selected), but this is documented as later work and doesn't block the raise since subject stays local-only.

**Disagree with Reviewer B on allowlist wording:** The phrase "ordinary word without an addressee" is imprecise for `schon mehrfach` (a bare count, not about addressing), but this is a documentation nit, not a technical error. The drift test records the actual reason per phrase.

## New points

1. **First-person pattern still matches some ordinary questions**: "How many times should I retry before giving up?" matches `how many times should I`. This is a known edge case - round 3 accepted it as non-blocking after fixing the purely third-person cases ("how many times does it retry?"). The improvement was selective, not perfect.

2. **Optimization documentation is unusually thorough**: Most raise_logs state final numbers only. This one documents the merging step (1,274 B → 1,128 B) AND the precision fix (+50 B → 1,178 B final). More transparent, but also more complex to parse.

3. **Test proof is concrete**: The two must-not-fire cases aren't theoretical - they're the exact phrasings that fired in round 3 and are now pinned as regression guards.

## Findings

### 1. Authority expansion: None
- Subject field kept local-only (provably: test failures when probed for upstream inclusion)
- Detection only, no new commands or git operations
- Egress guard includes subject in redaction array

### 2. Raise_log accuracy: Accurate but verbose
- Final measurements stated correctly: 1,557,734 B, 66 B headroom
- Scope claim backed by named test failures
- Round 3 outcome recorded accurately
- The optimization narrative (1,274 → 1,128 → 1,178) is complete but denser than needed

### 3. Round 3 conditions: Met
- Wording fixes: ✓ re-measured bundle, scoped claim, round 3 outcome recorded
- Precision fix: ✓ first-person requirement added, false positives pinned as must-not-fire

**Remaining limitations (documented, non-blocking):**
- Some first-person questions match complaint patterns
- Subject extraction is imprecise (later work)
- Raise_log optimization narrative could be simpler

STANCE: confirmed-non-expanding | CONFIDENCE: high | DEALBREAKER: no
```

### openai — `confirmed-non-expanding`

```text
Matze, **mixed: the supplied diff supports scoped non-expansion, but not an unqualified finding that the raise_log is accurate.** I have not independently run the tests or verified the digest.

1. **Strongest supporting argument:** no shown change grants execution authority, permissions, or additional egress. In `egressBlockedReason()`, adding `record.subject` extends screening. The reported mutation tests support exclusion from the tested outgoing payloads and fingerprint.

2. **Agreement with prior reviewers:** Reviewer B correctly distinguishes reported test evidence from independent verification, identifies remaining ordinary-question matches, and flags the globally selected backticked subject. Both reviewers correctly calculate final growth as **1,178 B** and headroom as **66 B**. Round 3’s conditions appear met **as summarized**; the original conditions are not supplied.

3. **Disagreement:** Reviewer A’s statement that screening would block `subject` if someone tried to send it overstates the guard: screening content does not enforce field exclusion. Its “raise_log accuracy: verified” conclusion also overlooks that `why_it_could_not_be_avoided` leaves **1,128 B** unlabeled as an intermediate measurement. Reviewer B’s narrower assessment is better supported.

4. **Strongest counter-argument and refinement:** first-person grammar does not establish a complaint: “how many times should I retry?” still matches. Also, `mergeRecord()` preserves `existing.subject` preferentially while subject stays outside the fingerprint. Combined with selecting the first backticked token anywhere, an unrelated subject can persist across merges. This is a metadata-quality concern before repeat counting depends on it, not demonstrated authority expansion.

Concrete next steps:

- **Documentation correction:** label 1,128 B as intermediate and 1,178 B as final; replace “each is an ordinary word without an addressee” with “each requires contextual constraints.”
- **Deferred precision work:** add first-person ordinary-question corpus cases.
- **Before repeat counting:** test unrelated backticks and conflicting subjects across merges.
- Any gated-file correction needs a fresh digest; this assessment applies only to the supplied content.

Overall: scoped non-expansion is supported; log wording and detector/subject precision remain limited.

STANCE: confirmed-non-expanding | CONFIDENCE: med | DEALBREAKER: no
```

## Notes recorded here rather than in the gated file

- The raise_log's "1,274 B to 1,128 B" is the intermediate reading after the
  pattern merge; the final growth, after round 3's precision fix added 50 B, is
  1,178 B (1,557,734 − 1,556,556). Correcting it in the gated file would move
  the digest again; both seats confirmed the final measurement.
- Deferred, owned by `later/road-to-a-noted-that-is-a-write` step 1.2: a
  first-person question ("how many times should I retry?") still matches, and
  the subject is the first backticked token anywhere and is kept on merge —
  both are tested before any count over subjects is built.
