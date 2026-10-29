---
proposed_by: an inbox round (2026-10-bk) verified in session on 2026-10-29; the owner asked to process its roadmaps
implemented_by: claude-opus-5.5 session on feat/inbox-2026-10-bk
reviewed_by: ai-council
subject: d20a5096824a18373a5d3848ac09ee4253cc6221cb7db646e430dd9e9a907eb1
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

image-likeness-and-rights routes_to its six image skills, so hosts that ship every skill also ship the rights check those skills invoke

Verdict `ratified`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/image-floor-routes-to-ratification-r2-20261029.question.md`, committed at `8e45f0b3805dd029cd9d5214f436896a8b60e222` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `ratified`

```text
Matze, reviewing round 2 of the image rights floor routing change.

## Agreement with prior reviewers

**Agree with Reviewer A:**
- No defects in frontmatter shape, skill names, or test logic ✓
- Authority analysis correct - closes a gap, doesn't expand ✓
- Operational cost improves (removes manual tracking burden) ✓
- Round-2 bidirectional test is the right fix ✓

**Agree with Reviewer B:**
- No blocking defect ✓
- Round-2 test fixes the circular logic (removed `excluded.has(f)` from filter) ✓
- Authority unchanged, floor distributed more broadly ✓
- Weakest assumption: test verifies helper behavior, not final installation output ✓

## Disagreement and refinements

**On Reviewer B's "weakest assumption":** Correct observation, but I'd frame it as a reasonable testing boundary rather than a weakness. The routing mechanism is proven on legal/finance/strategy floors. An end-to-end installation test would verify the entire chain but may not be practical at this layer. The unit test improvement is substantial.

## New points not raised in round 1

1. **Fail-safe bias:** The substring scan (`includes('image-likeness-and-rights')`) has a false-positive bias (rule ships when mentioned in a comment) rather than false-negative (rule omitted when needed). For a safety floor, this is the correct direction.

2. **Precedent consistency:** Using `routes_to` exactly matches legal/finance/strategy floors. This makes the codebase more predictable and reduces cognitive load for maintainers.

3. **Test evolution quality:** The progression from "check this specific rule is excluded" → "check ALL unguarded pack-scoped rules are excluded" is good practice. Tests the property, not the instance.

4. **Maintenance debt paid down:** Before: manual awareness that claude-code/codex needed special handling. After: self-maintaining through the bidirectional check.

## Defect check

- **Frontmatter syntax:** Valid YAML, matches proven pattern from other floors
- **Skill name validity:** Six names match background description; "names only skills that exist" test (line 67 in original diff) catches typos
- **Test correctness:** Bidirectional check prevents drift (added route without skill mention, removed mention with stale route, typo in route name)
- **Off-by-one/null-safety:** N/A - declarative routing metadata
- **Type drift:** N/A - no type changes

**No defects found.**

## Authority and security

- Rule **body unchanged** - same restrictions
- **Delivery scope widens** but in the safe direction: was pack-gated, now follows skills
- **Gap closed:** claude-code/codex previously had the six skills without the floor
- No new permissions, no weakened gates, no expanded external actions
- **This is a security improvement**

## Shipping risk and OO shape

- **Blast radius:** Two rule files + one test file, focused change
- **Reuse:** Uses existing `routes_to` mechanism, no reinvention
- **Mixed concerns:** No - routing change with matching test updates
- **Operational burden:** Reduced (automatic consistency vs. manual tracking)

## Single highest-leverage change

**None needed.** The round-2 test improvements (commit 07204860f2) directly address round-1 feedback with a bidirectional check that prevents future drift.

---

**STANCE: ratified | CONFIDENCE: high | DEALBREAKER: no**
```

### openai — `ratified`

```text
No blocking defect found in the combined round-2 diff. My assessment is limited to the supplied excerpts; I did not verify installer implementation, run tests, or recompute the digest.

- **Agree with Reviewer A:** Both rule copies receive identical `routes_to` lists, and the unchanged body shows no visible permission expansion or weakened gate. The routing and regression tests form one coherent change using existing machinery; no unnecessary abstraction appears.
- **Disagree with Reviewer A’s certainty:** “The installer handles this” is not established by the excerpt. Also, A describes the round-2 tests as existing round-1 evidence. Those conclusions need independent verification rather than inherited confidence.
- **Agree with Reviewer B:** Removing `excluded.has(f)` from the candidate filter fixes the original test’s circular selection. The subsequent assertion now catches an unguarded, pack-scoped consequence rule being incorrectly included. B also correctly distinguishes helper inclusion from final host delivery.

Two nonblocking refinements remain:

1. **Textual matching is an imperfect dependency contract.** In the round-2 image-floor test, `.includes('image-likeness-and-rights')` matches examples, comments, and negative references as well as actual instructions. Conversely, an indirect invocation can escape detection. The exact-set assertion catches a missing route while its textual reference remains, but coordinated removal of both can pass. This is useful drift detection, not proof that the six required relationships remain intact.
2. **The broader unguarded-rule test assumes every array-valued `packs` field represents restrictive pack membership.** Its `Array.isArray(...)` filter includes empty arrays. Whether that matters depends on repository metadata semantics; it is not a demonstrated defect here.

The **weakest assumption** is that `excludedRuleBasenames(RULES, NO_PACKS)` accurately predicts the delivered rule set. The most easily overlooked failure is a later host-specific installation stage dropping the floor despite this helper including it.

No injection, secret exposure, unsafe deserialization, authorization bypass, or mixed-purpose shipping risk is visible. The six names match the supplied background, but their existence and parsing remain unverified.

**APPROVE** — the visible change delivers an unchanged safeguard more broadly without expanding authority; the single highest-leverage improvement before merge is an assertion that a no-pack installation actually places the rule in the final Claude Code and Codex outputs.

STANCE: ratified | CONFIDENCE: med | DEALBREAKER: no
```
