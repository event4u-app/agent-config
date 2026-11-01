---
proposed_by: the repository owner, in session on 2026-11-01 (answer "1" to decision E7 of PR #2785)
implemented_by: claude-opus-5.5 session on feat/truncated-stance-abstains
reviewed_by: ai-council
subject: e3d4fa8bf4731d476774fa9de430230a9ca4b195b5feee5867b6cfa1d3d6a4f2
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: confirmed-non-expanding
  openai: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

A member whose answer the provider cut short (stop_class truncated or context_exceeded) counts in w_total and backs no option in the stance tally.

Verdict `ratified`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/truncated-stance-abstains-ratification-r1-20261101.question.md`, committed at `3a3cac6ae07ee65cd3fb3f140dc1536aac58580f` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `confirmed-non-expanding`

```text
## 1. Behaviour changes

**Direct changes:**
- Members with `stop_class` of `truncated` or `context_exceeded` now abstain regardless of whether their stance line parses correctly
- These members count in `w_total` (denominator) but back no option
- A new `incomplete` field lists cut-off members (omitted when empty to preserve shape)

**Unstated consequences:**
- **Consensus becomes harder:** Truncated responses raise the ⅔ threshold without adding numerator weight. Two `ship` votes with one truncated (w_total=2, threshold=1.33, votes=1) → no consensus.
- **Asymmetry by seat type:** CLI seats reporting `unknown` still vote if their stance line parses; provider seats flagged `truncated` abstain even with a valid stance line. This privileges opaque reporting over transparent truncation classification.
- **No retry path:** Unlike consensus scoring, there's no re-ask. A truncated stance is permanently lost.
- **Provider control shift:** The stop classification (provider-owned) now overrides parseable content (what the seat actually output).

## 2. Authority boundaries

**Narrower (more restrictive):**
- Consensus approval scope narrows — fewer responses count as votes
- The effective threshold rises (denominator grows, numerator doesn't)
- Fail-safe direction: makes it harder to ship, not easier

**No widening detected.** The change does not expand what can achieve consensus.

## 3. Weakening of judges

**Standards check:**
> the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code

- ✅ No existing tests modified or deleted
- ✅ New tests added (truncated member behavior, shape preservation)
- ✅ Threshold formula unchanged (⅔ × w_total)
- ✅ Tests were RED before the change (mentioned explicitly in the diff)
- ❌ **Missing test:** `stop_class: 'unknown'` should still parse normally — current tests don't verify this, leaving CLI seat behavior implicit

The change RAISES the effective bar (by increasing denominator for truncated members) rather than lowering it. No weakening of existing assertions.

## 4. Workarounds and bypasses

Both entry points (`orchestrator.render`, `tallyFromResponses`) now route through `stanceMembersFrom`, so the control is consistently enforced. Potential bypasses:

- **Misreporting stop class:** A seat could report `unknown` instead of `truncated` to avoid abstention. This affects CLI seats (which already report `unknown`) but not provider seats (where the provider owns the classification).
- **Direct `tally_stances` call:** Internal API, not a public workaround.

No inadvertent bypass detected, but the CLI seat asymmetry is a design choice, not a bug.

## 5. Reversibility

**Code level:** Clean revert target. The change is scoped to `stance_tally.ts` and its two callers.

**Data level:** Past tallies computed from responses will yield different results if re-computed (truncated members now abstain). However, the `incomplete` field is omitted when empty, so pre-truncation-support tallies remain valid.

**Authority:** The file is owner-reserved under ADR-268. The owner can revert without the two-provider gate that protects the forward change (because the gate governs changes TO owner-reserved files, not changes BY the owner).

**Revision target:** `468d565daa` (the commit covered by subject digest `e3d4fa8bf4731d476774fa9de430230a9ca4b195b5feee5867b6cfa1d3d6a4f2`).

## 6. Falsification and rollback criteria

**Claimed benefit:** "Truncated stances should abstain rather than count as votes."

**Falsifying observations:**
- High truncation rate in practice → consensus gridlock (no quorum-eligible votes)
- Stance lines from truncated responses are logically complete → valid votes discarded

**Omitted criteria:**
- No metric for acceptable truncation rate
- No monitoring hook to track `incomplete.length` over time
- No A/B test or gradual rollout
- No continuation/retry mechanism if truncation exceeds threshold
- No kill switch beyond full revert

Deployment is atomic with no operational guard rails.

## 7. Smaller alternatives

**Current change does:** Skip parsing, list in `incomplete`, count in `w_total`, render in output.

**Smaller alternative:** Mark truncated responses as `needs_repair` (reuse existing abstention category).

**What the larger change buys:**
- Explicit distinction between unparseable vs. truncated (different remediation: fix stance format vs. fix context management)
- Audit trail of truncation events
- Debuggability when consensus mysteriously fails

The distinction is justified — unparseable and truncated have different root causes. **Larger change is defensible.**

## 8. Standing instruction weight

Adds to the conceptual model:
- Third category of non-voting member (alongside abstain and unparseable)
- Relationship between `stop_class`, `incomplete` flag, and tally behavior
- CLI vs. provider asymmetry (`unknown` can vote, `truncated` cannot)

**Weight:** Medium. The "responded but didn't vote" pattern already existed (`needs_repair`). This is one more variant, with slightly more complex provenance (stop classification vs. parse failure).

## 9. Untrusted content steering

`stop_class` values come from:
- Provider's own stop reason (Anthropic/OpenAI/Gemini)
- CLI seats: hardcoded `unknown`

**Attack surface:** Provider lies about truncation (reports `truncated` when complete) → seat abstains when it should vote. But:
- Provider already controls response content (easier to just send garbage)
- Only degrades the lying seat's influence (fail-safe)
- No privilege escalation possible

**Bounds:** `isIncompleteStop` checks specific enum values; no injection risk.

**Untrusted content risk: LOW.** Worst case: a seat voluntarily weakens its own vote.

---

## Skeptical lens: Weakest assumption and overlooked failure mode

**Weakest assumption:** A parseable stance line from a truncated response is untrusted.

**Why it's weak:**
The stance line appears at the **end** of the response by contract (`STANCE:` closing line). If it's present and parseable, the reasoning that produced it was likely complete — the provider may have truncated trailing boilerplate, not the core judgment. Providers have different thresholds for "context exceeded." Some may flag truncation conservatively, cutting after the stance line is already output.

**Overlooked failure mode:**
A provider **consistently truncates just after the stance line** (so the line is complete) but flags it as `truncated` anyway. These would be valid votes systematically converted to abstentions, biasing the tally toward deadlock. The change assumes providers truncate mid-reasoning, not post-conclusion.

**Evidence gap:** No empirical data on where truncation typically occurs relative to the stance line. The change treats all truncation as mid-reasoning, which may be false.

---

## Verdict

The change correctly implements the fail-safe direction (truncated stances abstain, raising the consensus bar). Code is type-safe, doesn't weaken existing tests, and adds new coverage. The distinction between unparseable and truncated is debuggable. However:

1. **Missing test coverage** for `stop_class: 'unknown'` — should verify CLI seats still vote normally
2. **No rollback criteria** or truncation-rate monitoring
3. **Assumes parseable stance lines from truncated responses are untrusted** — may discard valid votes if providers truncate post-conclusion

**Single highest-leverage change before merge:**
Add a test verifying `stop_class: 'unknown'` results in normal parsing and voting (not abstention), protecting CLI seats from silent regression if `isIncompleteStop` logic changes.

STANCE: confirmed-non-expanding | CONFIDENCE: med | DEALBREAKER: no
```

### openai — `ratified`

```text
The supplied diff supports the intended rule: a response known to be incomplete retains its denominator contribution and contributes no option backing. I found no blocking correctness or security defect. This is a review of the supplied diff; I did not verify the subject digest, execute tests, or confirm the two-provider ratification record. The referenced `RTK.md` was unavailable in the working directory.

1. **Behaviour and consequences.** In `stance_tally.ts`, the new `cut === true` branch runs before parsing, so even a perfectly formed stance is discarded. `w_total` still includes that member. Incomplete members enter neither `parsed` nor `needs_repair`; their separate diagnostic is optional and omitted when empty.

   This affects every option, including opposition to shipping. It validates response completeness, not the substantive safety of a verdict. It also means “abstains” describes denominator treatment: the diff does not increment `abstain_count` for incomplete responses. That matches the stated treatment of unparseable responses, but consumers must not interpret `abstain_count` as encompassing all non-backing members.

2. **Authority and safety boundary.** The boundary narrows: provider stop metadata can disqualify text that previously counted as a vote. It gains no ability to grant backing. Keeping the denominator prevents the remaining respondents from acquiring more voting power through that disqualification. The trust boundary remains the provenance of `stop_class`; its provider-derived origin is asserted in the background, not demonstrated by this diff.

3. **Weakening its judges.** None is visible. Existing assertions are not removed or relaxed; no test is skipped, threshold lowered, or fixture semantics changed. Removing the test-file comment about owner reservation does not itself remove the ratification gate. The claimed red-before execution is not independently evidenced here.

4. **Other projections and bypasses.** Both shown projections use `stanceMembersFrom`: `tallyFromResponses` and the orchestrator’s render path. That shared adapter is a useful consistency improvement. However, direct callers of exported `tally_stances` can still omit `incomplete`, and `unknown` or absent stop metadata intentionally remains eligible. These are limits to enforcement, not newly introduced bypasses. A repository-wide caller audit is needed before claiming complete coverage.

5. **Reversibility and authority.** The change has no visible persistent-state migration and can be reverted through source control. Because reverting changes the same reserved verdict rule, it should undergo the applicable owner and ratification process. The supplied subject identifies `stance_tally.ts` at commit `468d565daa`; it does not authenticate the other changed files. Any revised reserved file needs a newly computed subject and corresponding review.

6. **Falsification and rollback criteria.** The benefit is falsified if a nonerrored response marked `truncated` or `context_exceeded` contributes backing in either production projection, or disappears from `w_total`. Compatibility is falsified if unaffected inputs change their result shape or tally.

   **Medium, deferred coverage concern:** the added tests cover `truncated` through the adapter, but do not directly exercise `context_exceeded`, `unknown`, error exclusion, or the orchestrator render integration. The diff states no rollback criteria. Appropriate triggers would be backing leakage, denominator drift, or disagreement between projections. Disabling stance tally is broader than reverting this change and should not be assumed to preserve equivalent protection.

7. **Smallest change and reuse.** Duplicating the stop check in both callers would involve less abstraction but create two opportunities for drift. The small shared adapter buys consistency and reuses `isIncompleteStop`. No class hierarchy or speculative framework is warranted or introduced. The three-file scope is cohesive.

8. **Standing instruction weight.** No standing agent instruction is added. The ongoing cost is an optional result field, one input flag, an exported adapter, and their maintenance.

9. **Untrusted influence.** Response text can supply stance content, but cannot override `incomplete: true` in this implementation. Untrusted content could indirectly induce a long response and truncation, withholding a vote and potentially preventing consensus. Retaining its denominator bounds that influence toward lost backing. No new execution, deserialization, or secret-handling surface appears in the diff.

**APPROVE** — the implementation coherently removes incomplete backing without lowering the threshold; the highest-leverage pre-merge improvement is a table-driven regression test covering every stop class through both production projections.

STANCE: ratified | CONFIDENCE: med | DEALBREAKER: no
```

## Notes from the implementer

- **Session path normalised.** The review ran from the main checkout because the
  worktree holds no seat-probe history, so the session recorded its artefact by
  absolute path into this worktree. The copy this record was rendered from
  carries the same prompt as the repo-relative
  `agents/evidence/council/truncated-stance-abstains-ratification-r1-20261101.question.md`;
  no other field was changed. There was one review run, not two.
- **Tests added after the review.** Both seats named the same coverage gap
  (`context_exceeded`, `unknown`, errored responses untested). The tests were
  added in a later commit; neutralising the abstention branch reds two of them.
  Tests are not gated, so the subject digest above is unchanged.
- **Owner decision.** The change itself is the owner's E7 answer; this record is
  the two-provider review ADR-268 § 4 requires on top, and the merge stays the
  owner's act (ADR-281).
