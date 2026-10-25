<!-- evidence-type: analysis -->

# Council — does a safety floor ship with the skills it guards? (2026-10-25)

Question: `safety-floor-with-its-skills-20261025.question.md`. Mode `design`, members ["anthropic/claude-sonnet-4-5","openai/codex-default"], rounds 2, quorum {"status":"concluded","threshold":1,"total":2,"present":2}, cost $0 (subscription seats).

Outcome: both seats chose option 1. The legal, finance and strategy floors ship wherever a skill in their `routes_to` can ship, and `image-likeness-and-rights` stays pack-scoped (deferred). Both seats prefer a dedicated `requires_rules` field over `routes_to` in the long term.

## Seat: anthropic

here's my round-2 critique:

## 1. Points I agree with

**From Reviewer B:** The broken dependency contract framing is correct. If `contract-review/SKILL.md:84` says "Obeys `legal-safety-floor`", that's a declared dependency, and projecting the skill without the floor leaves it unguarded. B's call for build-time validation of `routes_to` completeness is the right control.

**From Reviewer A:** The gap exists only on lever hosts is factually correct per the projection mechanics described. The cost bound (~3200 chars when all four load) is small enough that standing-context inflation isn't the blocker.

## 2. Points I disagree with

**Reviewer A's claim that `consequence_class` marks an architectural constraint**: The facts cite no definition of what `consequence_class` values mean. This sounds like it's being reverse-engineered from desired behavior. If `consequence_class` has three values (the facts show two: `authority-bypass`, `irreversible-external`, implying a third exists), the design needs to say what ALL of them mean and whether this pattern applies to each.

**Both reviewers' treatment of `routes_to` as ground truth without verifying exhaustiveness**: The facts show ONE example of a skill naming its floor (`contract-review` → `legal-safety-floor`). The design assumes the other 7+ skills in those `routes_to` lists follow the same pattern but doesn't verify it. What if `routes_to` is intentionally incomplete — a rule author knows a skill has its own hardening and omits it to save context? Neither reviewer addresses whether `routes_to` MUST be exhaustive or MAY be selective.

**Reviewer B's rollback proposal**: "Disable the new implication only if it causes measurable projection failures" misses the safety gap this is fixing. The failure mode you're guarding against (guarded skill runs without floor, produces bad output) is SILENT. A rollback criterion that waits for "measurable failures" won't catch it.

## 3. New points not raised in round 1

**Trust boundary: who validates the bidirectional dependency?**  
- Skill prose says "Obeys X" → floor should ship with it  
- Floor metadata lists skill in `routes_to` → floor ships with it  
- What if they DISAGREE? Skill says Obeys but isn't in routes_to, or vice versa?

Neither reviewer names who checks this or when. B wants "build-time invariant" but doesn't specify: does the build FAIL if a skill-mentioned floor isn't in routes_to? Does it auto-add it? Warn? The dual-write problem is unresolved.

**Sequencing risk step N really does block step N+1:**  
The tree at c073ca2e5a has these rules already pack-scoped. Changing to skill-scoped requires:  
1. Update projection logic on every host  
2. Update rule frontmatter to mark them skill-scoped or consequence-class-linked  
3. Verify hosts actually implement the new coupling

If out of order: transient gaps where the rule projects but the skill doesn't, or vice versa. Neither reviewer sequences this. B says "ship atomically" but doesn't say what happens if atomicity is impossible (distributed projection system, multiple host implementations).

**The eight-rule-audit's "scoped correctly" rating is invalidated by the gap it didn't consider.**  
The facts cite `agents/evidence/analysis/rule-packs-eight-rule-audit-20261024.md` rating these "scoped correctly" but that audit didn't account for lever hosts getting skills without packs. That's not "correct scoping", it's undetected breakage. The design is fixing an audit blind spot, not implementing its conclusion.

**Open question disguised as decision: what counts as a guardable surface?**  
`image-likeness-and-rights` has triggers `/image:` and "image generation" but no `routes_to`. Both reviewers reject Option 2 (ship it unconditionally) because it has no skill dependencies, but:  
- Is `/image:` a command that's projected separately?  
- Is "image generation" a host capability that bypasses skills?  
- If either is yes, isn't that a dependency too?

The design assumes commands and skills are the same projection unit. Not verified.

**The single architectural call I'd push back on hardest:**

**Option 1 treats `routes_to` as the source of truth without a policy on what it must contain.**

Evidence that would change my mind:  
1. A sampled check showing the OTHER skills in the four `routes_to` lists (not just `contract-review`) actually invoke or depend on their floors  
2. A policy doc saying `routes_to` MUST list every skill that mentions the rule, or MAY list only strict runtime dependencies  
3. Data on what happens when the bidirectional check (skill mentions floor, floor lists skill) fails — is it a build error, a warning, auto-fixed, or ignored?

Without those, Option 1's "ship floor with skill" rule has no defined boundary. You're coupling projection to unchecked metadata.

**Recommendation:** Option 1 with three additions:  
1. **Fail the build** if a skill's prose mentions a floor not in that floor's `routes_to` (or vice versa)  
2. **Sample the routes_to lists** — verify at least 3 of the 7+ listed skills actually invoke their floors  
3. **Name the rollback criterion**: if a consequence-class rule projected with a skill causes **any** of: build breakage on that host, context budget exceeded, or silent safety bypass detected in post-deployment audit → **unprojec

t the skill too**, not just the rule

## Seat: openai

## Decision: Option 1, with a required refinement

Ship a consequence-class floor whenever a projected skill depends on it. However, do not make `routes_to` the long-term source of truth. Introduce an explicit dependency such as:

```yaml
requires_rules:
  - legal-safety-floor
```

`routes_to` describes routing; dependency projection is a different architectural concern. Overloading it would turn incidental metadata into a security boundary.

### 1. Prior points I agree with

- **Reviewer A:** “The correct discriminator is: does the guarded capability exist?” That is the right invariant. The Facts section demonstrates that pack membership no longer answers that question on lever hosts.
- **Reviewer A:** Option 3 creates a listed-but-unusable capability. It also distributes enforcement across every guarded skill, increasing drift and fail-open risk.
- **Reviewer B:** The projection change and dependency validation must ship atomically. Releasing projection first and validation later leaves malformed dependency declarations undetected.
- **Reviewer B:** A rollback may not restore 18.0.0 behavior while leaving guarded skills enabled. The safe fallback is to suppress affected skills or make projection fail closed.
- **Reviewer B:** Option 2 lacks sufficient evidence. The phrase “image generation” in trigger metadata does not prove that every host exposes an uncontrolled image capability.

### 2. Points I disagree with

- **Reviewer A’s proposed `routes_to` fix for image generation:** Commands, host capabilities, and skills are distinct dependency types. Adding `/image:*` to a field apparently intended to name skills conceals the missing model rather than solving it. Define guarded commands or required host capabilities explicitly.
- **Reviewer A’s context estimate:** The claimed “~800 chars each” and “~3200 chars” are not present in the supplied facts. More importantly, “installed” and “loaded into every spawn” need verification because the rules are described as tier 2a and keyword-triggered. No rollout decision should rest on that estimate.
- **Reviewer B’s framing of `routes_to` as the safety-critical metadata:** That is acceptable as an immediate compatibility patch, but not as the desired architecture. The dependency should be declared by the consumer or in a dedicated dependency graph, then cross-validated against routing metadata.

### 3. New findings and refinements

**Must-fix — Trust boundary:** The proposal implicitly trusts metadata authors and the projector. Add build-time checks that:

- every named `requires_rules` target exists;
- every consequence-class dependency is projected with its consumer;
- no host renderer silently drops that dependency;
- direct skill-to-rule references such as `contract-review/SKILL.md:84` agree with structured metadata.

Test this across the full host matrix, especially default `runtime.active_packs: []`.

**Must-fix — Sequencing:** The actual order is blocking:

1. Establish explicit dependency metadata and validation.
2. Add fixture tests for every host/profile/active-pack combination.
3. Change projection behavior.
4. Update the audit and D14.

Step 3 must not ship before steps 1–2. The prior audit’s “scoped correctly” conclusion is invalidated by the newly identified lever-host case.

**Must-fix — Kill switch:** Provide a narrow switch for dependency-implied projection. Its activation must fail closed: suppress affected guarded skills or abort generation. Define rollback criteria before release—for example projection failure, host context-limit regression, or unexpected rule activation. “More installed content” alone is not sufficient.

**Deferred — `image-likeness-and-rights`:** Keep it pack-scoped for now, but record this as unresolved—not decided. Inventory which hosts expose image generation independently of projected skills or commands. If such reachability exists without `ai-image`, neither Option 1 nor simple unconditional projection is precise enough; projection should follow a declared host capability.

**Rejected — Keep 18.0.0 unchanged:** The Facts section establishes a known broken dependency on lever hosts. Option 4 knowingly leaves a safety control absent while its consumer remains invocable.

### Hardest pushback

I would push back hardest on using `consequence_class + routes_to` as the dependency algorithm. `consequence_class` states impact, while `routes_to` appears to state routing applicability; neither necessarily means “hard runtime prerequisite.” Conflating those concepts creates hidden coupling and makes future metadata edits security-sensitive without making that responsibility obvious.

I would accept that design permanently only if repository-wide evidence showed that every `routes_to` edge already means a mandatory installed dependency, is validated bidirectionally, and has no legitimate routing-only uses.

### Risk and revisit condition

The principal risk is stale dependency metadata causing silent omission or unnecessary context expansion. Revisit Option 1 if host-matrix evaluations show either:

- guarded skills reliably fail closed without external floors; or
- dependency-following projection measurably harms unrelated tasks or exceeds host context budgets.

For `image-likeness-and-rights`, revisit when a capability inventory or invocation test proves image generation is reachable while `ai-image` is inactive.

**End-summary:** Choose Option 1, but model and validate a real skill-to-rule dependency; ship it atomically with host-matrix tests and a fail-closed rollback.

