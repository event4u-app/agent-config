---
proposed_by: claude-opus-5.5/feat-inbox-2026-10-aw
implemented_by: claude-opus-5.5/feat-inbox-2026-10-aw
reviewed_by: ai-council
subject: 5d87e26965f3ef6dd5dbe1ab6008d97c721ca192b4345b2eaf483942be6209ac
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

One routes_to line on legal-safety-floor lists legal-practice-profile, the one skill that says it obeys the floor and was missing from it.

Verdict `confirmed-non-expanding`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/legal-floor-routes-ratification-20261025.question.md`, committed at `9307f3af5d85ee7a3d8c7e18453f8f0fb21cbda6` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `confirmed-non-expanding`

```text
# Round 2 Assessment

## 1. Agreement with Prior Critiques

**I agree with both reviewers' core verdicts** (A and B: confirmed-non-expanding).

**Reviewer A's fundamental analysis is correct**: This is metadata alignment for a skill that already existed and already claimed to obey the floor. The `routes_to` addition is routing metadata, not authorization. The analogy to "fixing a broken hyperlink" is apt.

**Reviewer B's assessment is also sound**: The change makes a pre-existing unidirectional relationship bidirectional in the routing metadata. It doesn't alter permissions, gates, triggers, or consequence class.

## 2. Engagement with Reviewer B's Counter-Argument

Reviewer B raises: "the router consumes `routes_to`, the line changes runtime reachability. If routing to this skill can trigger actions before the floor is enforced—or if the skill grants authority independently—then the change could indirectly expand behavior."

**This is well-formed but resolves negative**:

1. **Order of operations**: The floor is a *rule* that fires on triggers. When it fires, it *points* to skills via `routes_to`. The floor loads and applies *before* skill execution - that's the architectural contract of safety floors.

2. **Routing ≠ authorization**: `routes_to` tells an agent "when this rule triggers, these skills are relevant." It's discovery metadata, not permission-granting.

3. **The skill pre-existed**: Even if routing somehow expanded authority (which it doesn't), `legal-practice-profile` was already present and reachable. This line doesn't make it newly available.

4. **Consequence class unchanged**: The rule's enforcement severity, triggers, and Iron Laws are untouched.

## 3. New Point: Safety Strengthening Through Completeness

Neither reviewer explicitly named this: **The change actually strengthens safety** by closing a metadata gap.

The new test requires bidirectional consistency: if a skill claims to obey a floor, that floor must list it in `routes_to`. This prevents **orphaned safety claims** - scenarios where a skill might execute without the floor it claims to respect being enforced or routable.

By making `routes_to` complete, the change ensures the floor can reach all skills that claim it. This doesn't expand authority; it ensures existing constraints apply consistently.

---

**STANCE: confirmed-non-expanding | CONFIDENCE: high | DEALBREAKER: no**
```

### openai — `confirmed-non-expanding`

```text
1. **Assessment — confirmed-non-expanding.** I agree with Reviewers A and B that the added `routes_to` entry aligns an existing safety-floor dependency. It changes routing and installation reachability, but it does not authorize new actions, remove consent/council/attorney gates, weaken the RDG boundary, or broaden the EU/DE scope.

2. **Strongest argument.** `legal-practice-profile/SKILL.md:22` already says it “Obeys `legal-safety-floor`,” while the rule’s “When this rule applies” section already names `legal-practice-profile`. The new line therefore makes delivery consistent with an existing constraint relationship—and may ensure the restrictive floor ships with the skill—rather than creating new authority.

3. **Strongest counter-argument.** Reviewer B is right that `routes_to` is operational, not merely documentary: the router contract defines it as identifying artifacts that fulfil a rule. Adding the edge can make `legal-practice-profile` load or surface in circumstances where it previously did not. That expands reachability, but not authority: the skill remains advisory and subordinate to unchanged Iron Laws. I disagree only with Reviewer A’s stronger “no behavioral change” wording; selection behavior may change even though the authority envelope does not.

4. **New refinement / next steps.** Treat “behavioral expansion” and “authority expansion” as distinct. Verify that the generated router contains the new edge, the source and projection remain byte-identical, and the new backlink/install-scope test passes. Also consider updating the rule’s “no final legal call” enumeration, which currently names four review skills but omits `legal-practice-profile`, to avoid ambiguity—provided that separate prose edit receives its own review.

In sum: this repairs enforcement and routing consistency without raising the agent’s authority ceiling.

STANCE: confirmed-non-expanding | CONFIDENCE: high | DEALBREAKER: no
```
