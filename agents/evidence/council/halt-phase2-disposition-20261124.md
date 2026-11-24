<!-- evidence-type: analysis -->

# Council decision — Phase 2 of road-to-a-halt-that-holds-every-lane

| Field | Value |
|---|---|
| Roadmap | `agents/roadmaps/archive/road-to-a-halt-that-holds-every-lane.md` |
| Seats | anthropic/claude-sonnet-4-5, openai/codex-default (CLI, both concluded) |
| Rounds | 2 |
| Date | 2026-11-24 |
| Verdict | B — revert Phase 2, ship the halt alone, carry Phase 2 with the ten rounds' phrasings as its fixture corpus |

## Question (verbatim)

Decision needed on a pull request for a roadmap with two phases.

Phase 1 (done; no review round found a defect in it): an emergency halt switch now marks every queue entry non-dispatchable, and the dead-lane re-dispatch procedure reads it.

Phase 2: a regex-based prose parser decides whether a roadmap step is "held" by text such as "blocked by X", "not blocked by X", "was blocked by X, which has since shipped". The roadmap asked to fix four misreadings: a negation not adjacent to the hold phrase, a past-tense hold that has since resolved, results depending on match order, and a resolved named blocker masking an independent owner hold.

Ten independent completion-review rounds each found new phrasings. Several fixes introduced or exposed a case where the branch releases a hold that main kept. Releasing a hold means a step is dispatched against the owner's intent, which is the roadmap's rank-2 risk. Round 10 found one again: contractions added to the negator set (wasn't, weren't) release "It wasn't blocked by the probe until today; now it is." Each review round costs about 230k tokens. A follow-up roadmap already exists for an object-list parser that judges each object of a hold instead of matching phrasing patterns.

Options:
(A) Narrow once more: restrict the negator set to what main had (no longer / not / never) plus a one-adverb window, keep the other Phase 2 fixes, and run one more review.
(B) Revert Phase 2 entirely in this PR, ship only the halt (Phase 1), carry the Phase 2 steps into the existing follow-up roadmap, and run one review on the reduced diff.
(C) Ship as is and record the regression as an accepted risk.

Which option, and why? Name what would make the other options better.

## Member responses (verbatim)

### anthropic

## Round 2 Critique

### 1. Agreement with Prior Points

**Fully agree with Reviewers A & B:**
- **10-round pattern signals architectural mismatch** (A, B): Not a bug pile, but evidence that regex cannot reliably model negation scope, tense, and subordination—linguistic features that require syntactic structure.
- **Asymmetric risk** (A, B): Releasing a hold dispatches against owner intent (rank-2). False positives (keeping a resolved hold) are annoying; false negatives (releasing an active hold) violate intent.
- **Phase 1 is ready and separable** (A, B): The halt switch and dead-lane check are defect-free. No reason to block them.
- **Object-list parser roadmap exists** (A, B): Makes deferral actionable, not speculative.

**Agree with Reviewer A's framing:** "Phase 2's ten rounds weren't wasted—they surfaced the cases the follow-up must handle." This is requirements discovery, not sunk cost.

---

### 2. Disagreement / Refinement

**Reviewer A's "2.3M-token signal"**: Technically correct (10 × 230k), but the framing is misleading. The token count measures *review cost*, not cumulative evidence of a single flaw. Each round found *different* edge cases—the system isn't failing the same way ten times. The real signal is **categorical incompleteness**: each fix exposes new phrase patterns because the regex approach has no way to represent clause boundaries or time reference.

**Reviewer B's blind spot on the object-list parser**: "Lack of evidence about whether the object-list parser can reliably represent temporal changes" is a fair gap, but neither reviewer proposes a mitigation. The 10 rounds' phrasings are a natural test suite—capture them explicitly so the follow-up can prove coverage.

---

### 3. New Points Not Raised in Round 1

1. **The contraction regression reveals the real problem**: The issue isn't "wasn't wasn't in the negator set." It's that "It wasn't blocked by the probe **until today; now it is**" requires understanding that "until today" flips polarity and "now it is" reinstates the hold. No negator tuning fixes that—you need temporal clause parsing.

2. **Option A's one-adverb window is arbitrary linguistics**: Why one adverb? "It was not ever blocked by X" = 3 words between negator and phrase. "It wasn't blocked" = 0 words. The window doesn't map to the phenomenon (negation scope in a clause), it's a parameter tuned to observed failures. Next round finds "It was not, as previously reported, blocked by X" and you need a 4-word window.

3. **Phase 1's urgency is unexamined**: Why does the emergency halt exist? If there's an operational incident driving it, blocking Phase 1 on Phase 2's whack-a-mole has external cost neither reviewer quantified. If Phase 1 is proactive (no incident), the merge pressure is lower but still present.

4. **Testing strategy gap**: Could the 10 rounds' examples become a regression suite? If yes, Phase 2's learnings transfer cleanly to the object-list parser. If no, then even the follow-up will have unknown coverage and you've learned nothing about *how* to test hold detection, only that this implementation is wrong.

5. **Usage data would guide C vs. B**: Neither reviewer asks: "How often do roadmap owners write 'wasn't blocked' vs. 'not blocked'?" If contractions + temporal context are <1% of real holds, Option C's risk is bounded. If they're 15%, C is reckless. The decision is data-informed, not pure architecture.

6. **Merge cost asymmetry**: If the object-list parser is a **rewrite** (not a delta on Phase 2), reverting is cheap—no re-integration later. If it's a **delta** (builds on Phase 2's structure), revert now means duplicating review effort when the follow-up merges. Neither reviewer clarified which architecture the follow-up uses.

---

### 4. Recommendation

**Option B, with refinement: Revert Phase 2, ship Phase 1 only, and extract the 10 rounds' phrasings into an explicit test suite for the object-list parser roadmap.**

**Why:**
- The contraction regression isn't a bug in the fix—it's a symptom that temporal polarity requires syntactic awareness regex doesn't have.
- Option A's one-adverb window won't converge because the linguistic phenomenon (negation scope, tense, clause boundaries) is **structural**, not **distance-based**. You're fitting a linear model to a recursive grammar.
- Option C accepts rank-2 risk with no runtime safeguard (e.g., owner approval gate before dispatch).
- Phase 1 is ready. Don't hold a defect-free halt switch hostage to a parser that's on its 10th round.

**Additional action before merge:**
Capture the 10 rounds' phrasings as a **requirements document** with test cases for the object-list parser. Otherwise you're discarding 2.3M tokens of discovery work. The follow-up roadmap should prove it handles all 10 rounds' patterns before claiming coverage.

---

### 5. What Would Make the Other Options Better

**Option A:**
- If rounds 7–10 found **zero issues** (convergence), not new ones each time.
- If a **linguistic analysis** proved the one-adverb window captures negation scope in roadmap prose (not just "it fixes this contraction").
- If the object-list parser roadmap were **speculative/distant**, not already scoped and ready.
- If you had **usage data** showing multi-word negation gaps are <5% of holds.

**Option C:**
- If **usage data** showed contractions + temporal context ("wasn't...until...now") <1% of roadmap text.
- If there's a **runtime safeguard** (e.g., owner must click "Yes, dispatch" before a hold-released step runs).
- If Phase 1's urgency is **externally driven** (operational incident) and a hotfix path exists for Phase 2 regressions post-ship.
- If the regression is in a **non-critical path** (e.g., hold detection for dashboards/metrics, not actual dispatch).
- If you instrument the released holds and **commit to a one-week revert** if real-world usage hits the edge case.

---

**Top-N consensus (what the analysis surfaces):**
1. Ten review rounds found new phrase patterns each time—Phase 2 hasn't converged.
2. Latest regression: contractions ("wasn't") release holds with temporal flip ("until today; now it is").
3. Rank-2 risk: unintended dispatch violates owner intent.
4. Phase 1 is defect-free, separable, and delivers value (emergency halt).
5. Object-list parser roadmap already exists as a better-architected successor.

**Strongest blind spot the analysis itself has:**
No proposal for **capturing the 10 rounds' learnings as a test suite** to prevent regression in the follow-up, and no examination of **Phase 1's urgency** (operational incident vs. proactive feature) to quantify the cost of further delay.

### openai

## Decision

Choose **B: revert Phase 2 from this PR, ship Phase 1, and carry the hold-detection work into the existing follow-up roadmap**. Ten rounds have surfaced new phrasings, including a concrete regression that releases a hold. Narrowing the negator set may address the latest example, but the information provided does not show that it bounds the broader risk. Phase 1 is described as done with no defects found, and Phase 2 can be reviewed separately later.

## Prior points

**Agree**

- **Reviewer A and Reviewer B:** Repeated new cases and hold-release regressions are evidence against shipping the current Phase 2. The specific “wasn’t” example makes the concern concrete.
- **Reviewer B:** The risk is asymmetric: releasing a hold can dispatch work against the owner’s intent. That supports a higher bar than simply passing another review round.
- **Reviewer A and Reviewer B:** Phase 1 is separable, and an existing object-list-parser roadmap makes deferral actionable.

**Disagree or qualify**

- **Reviewer A:** “Fundamental coverage holes” and “won’t converge cleanly” go beyond the evidence. Ten rounds found new phrasings, but the prompt does not say whether those cases were increasingly rare or whether the fixes were systematically expanding coverage. The rounds show repeated problems, not proof of non-convergence.
- **Reviewer A:** “2.3M-token signal” is arithmetically grounded in the stated round cost, but token volume is not itself evidence of defect severity or review effectiveness. The useful evidence is the ten rounds and the regressions they found.
- **Reviewer A:** Saying the object-list parser is “the correct architecture” is stronger than the prompt supports. It is an existing follow-up plan, but its ability to handle temporal changes and independent holds has not been demonstrated.
- **Reviewer A and Reviewer B:** Their proposed conditions for choosing A or C are plausible, but several are speculative thresholds. For example, “<1%” usage data or “one more review” providing confidence are not justified by evidence in the prompt.
- **Reviewer B:** “Phase 1 can ship without Phase 2” is plausible from the description that Phase 1 is done and Phase 2 is separate, but the prompt does not explicitly confirm there are no integration dependencies. Treat separability as an assumption to verify in the reduced diff review.

## Evidence and roadmap readiness

- **Phase 2 has repeated uncovered phrasings and hold-release regressions** — **Confirmed** by the stated ten rounds and regression examples. **Roadmap-ready:** yes, as a decision to defer the regex work and retain the discovered cases as acceptance criteria.
- **The “wasn’t” contraction releases “It wasn’t blocked by the probe until today; now it is.”** — **Confirmed** by the supplied example. **Roadmap-ready:** yes, as a regression case; fixing it alone does not establish the approach is safe.
- **Unintended release carries rank-2 risk** — **Confirmed** as a stated project risk. **Roadmap-ready:** yes, as a validation priority and release criterion.
- **Phase 1 is complete and has had no defects found in review** — **Confirmed** by the prompt. **Roadmap-ready:** yes, subject to the reduced-diff review checking that the revert did not affect it.
- **The object-list parser is the better or correct architecture** — **Inferred**, not confirmed; the prompt says a follow-up roadmap exists, not that the parser design has been validated. **Needs discovery:** test whether it can model temporal changes, negation, and independent holds.
- **Regex cannot converge, or the latest contraction is rare** — **Speculative** claims in Reviewer A’s suggested decision conditions. No convergence trend or usage data is given. These should not appear as established findings.

## Follow-up actions, ranked by leverage

1. **Revert Phase 2 and review the reduced diff for Phase 1 interactions.** Supported by the repeated regressions and the stated Phase 1 completion; this preserves the completed halt work while checking the separability assumption.
2. **Carry the discovered misreadings and release regressions into the object-parser roadmap as explicit cases.** Supported by the confirmed failure examples and existing follow-up plan.
3. **Run a discovery pass on the object-list parser’s representation of time and independent holds.** Supported by the strongest unresolved design question; the prior reviews correctly identify this as unproven.
4. **Define a release criterion for hold parsing that prioritizes unintended releases.** Supported by the stated rank-2 risk; a generic “one more review” is not itself a safety criterion.

## Top-N consensus

- **Phase 2 should be deferred:** repeated review rounds found new phrasings, and several fixes introduced or exposed hold-release regressions. *(Confirmed.)*
- **The latest contraction change has a concrete release regression.** *(Confirmed.)*
- **An unintended release is the higher-consequence failure mode described.** *(Confirmed.)*
- **Phase 1 is reported complete and can be reviewed as a reduced diff.** *(Confirmed as reported; independence from Phase 2 should be checked.)*
- **The follow-up parser is an actionable next direction, but its ability to represent temporal and independent holds remains unverified.** *(Existing roadmap confirmed; suitability inferred.)*

The strongest blind spot is that the analysis gives no evidence that the proposed object-list parser can handle temporal changes and independent holds correctly.

