---
proposed_by: the repository owner, in session on 2026-11-03 (invocation "/analyze:inbox … danach arbeite die roadmaps ab mit /roadmap:process-full … erstelle am ende einen pr und merge ihn")
implemented_by: claude-opus-5.5 session on analysis/inbox-2026-11-q
reviewed_by: ai-council
subject: 2774a5557ba7998d65735110eccbaba58cce44286cda49b1cf8b31bccc6464eb
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

A supplied reference image that depicts an identifiable real person whose likeness the output would reproduce is now a likeness-consent trigger in image-likeness-and-rights. Round 1 (both seats non-convergent) narrowed the wording to that; round 2 confirmed it but closed on a stance line the reader does not parse; round 3 repeated it in the parsed format.

Verdict `confirmed-non-expanding`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/likeness-reference-photo-inbox-2026-11-q-r3.question.md`, committed at `94436f59fe8ecee1a9427031d4f8ebbdfa880a73` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `confirmed-non-expanding`

```text
Matze, reviewing this constitutional change independently from the artifact alone.

## 1. Agreement with prior points

**Reviewer A:** Agree that the qualifier "whose likeness the requested image or video would reproduce" correctly ties activation to output content, addressing Round 1's finding. Agree the change routes to an existing gate and grants no new authority.

**Reviewer B:** Agree this is non-expanding. Strongly agree with the **routing inconsistency finding** — the existing row explicitly names both `media/likeness.md` + `media/public-figures.md`, while the new row names only `media/likeness.md` despite saying "the same release path." This is a valid operational concern.

## 2. Disagreement

None on substance. Both prior reviews correctly identified this as non-expanding.

## 3. New points or refinement

**Refined framing of Reviewer B's finding:** The phrase "the same release path" creates ambiguity. If "same" means identical to the row above (both policies), the text under-specifies by omitting `public-figures.md`. If "same" means only the likeness.md gate, it's inconsistent with "the same." This doesn't repeal the existing gate for public figures, but selective documentation could produce drift. **Remedy:** Explicit routing — either name both policies or clarify why only one applies here.

**Self-portrait friction is protective, not expanding:** The "including the user's own likeness" clause means the agent must surface consent even for selfies. This isn't inferred-consent permission (which would be expanding) — it's enforced caution. The context confirms consent is never inferred from the request. This protects against assumed permission, consistent with the existing floor.

**No false statements detected:** Each claim in the new row is accurate against the supplied context.

## 4. Concrete outcome

Accept as **confirmed-non-expanding**. The change restricts (adds consent gate for reference images), does not permit. The routing ambiguity is a documentation refinement, not a constitutional defect. Behavioral tests should verify: (a) reference used only for pose/lighting doesn't trigger, (b) selfie reproduction routes to consent, (c) public-figure reference routes to both applicable policies despite the documentation gap.

---

**STANCE:** confirmed-non-expanding | **CONFIDENCE:** high | **DEALBREAKER:** no
```

### openai — `confirmed-non-expanding`

```text
Matze, my assessment is **agree: confirmed-non-expanding**, based on the supplied diff and context.

1. **Strongest argument:** The added trigger requires the existing consent gate; it creates no permission or exception. The phrase “identifiable real person whose likeness the requested image or video would reproduce” also fixes the reported overbreadth by tying activation to likeness reproduction. Nothing in the new row contradicts the supplied context.

2. **Agreement with prior reviewers:** I agree with Reviewer A’s substantive non-expansion assessment and Reviewer B’s qualification that byte identity and provider diversity have not been independently verified. I also agree with B’s routing concern: the original row names both policies, while the new row names only `media/likeness.md`.

3. **Strongest counter-argument and refinement:** Operators may treat the more specific reference-image row as the complete routing instruction, inadvertently skipping `media/public-figures.md`. That is an enforcement ambiguity rather than a textual repeal of the existing gate. I therefore disagree with A’s unconditional “No further revision needed”: the ambiguity deserves a targeted check. The ongoing operational burden is deciding whether an output reproduces likeness, especially when a reference combines identity, pose, and lighting.

4. **Concrete next steps:** Confirm that applicable gates are cumulative, and check three cases: selfie reproduction requires consent; pose-only use without likeness reproduction does not activate this trigger; public-figure reproduction retains both applicable policy routes. Verify projection identity and independent provider diversity separately before recording procedural completion.

The supplied change preserves the consent floor; consistent routing is the remaining maintenance concern.

STANCE: confirmed-non-expanding | CONFIDENCE: high | DEALBREAKER: no
```
