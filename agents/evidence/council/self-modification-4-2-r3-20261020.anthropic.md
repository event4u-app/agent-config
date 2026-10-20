<!-- evidence-type: original-review -->

<!-- The anthropic seat's reply of 2026-10-20 (round 3) to the prompt in
     self-modification-4-2-r3-20261020.question.md, verbatim. Historical: it
     describes the diff at 2beedee36, which round 4 changed. -->

I'm reviewing this as an independent seat, having not seen prior reasoning. Let me work through the nine questions methodically.

## 1. What behaviour changes?

**Core change**: 28 additional rules beyond the 9-member kernel now require owner-ratified modification reviews. The consequence class list (`src/config/rule-consequence-class.json`) becomes self-gating. Membership is computed as the **union** of base and head commits, so adding a member while editing that rule (head sees it, base doesn't) still gates the rule.

**Cascading**: An unreadable list at either base or head **halts all PRs** with a refusal, not just the PR that broke it. This fail-closed behaviour is deliberate but creates a potential deadlock requiring owner forge-bypass to clear.

**Implicit**: The schema defining the criterion (`rule.schema.json#/properties/consequence_class`) remains **ungated**. The three clauses are pinned in gate code, so adding a fourth clause requires gating the gate itself—but someone could redefine what "authority-bypass" *means* in the schema without triggering this gate.

## 2. Authority/safety boundaries?

**Narrows authority significantly**: 28 rules shift from "needs-council" to "needs-owner" at merge. Measured historical impact: **7 of 457 commits** (1.5%) over 30 days. This routes more changes through the highest authority tier.

**Reinforces safety**: These rules govern irreversible external actions, security boundaries, and authority bypasses—surfaces where a council clearance was arguably insufficient.

## 3. Does it weaken what judges it?

**The list gates itself**: `CONSEQUENCE_CLASS_PATH` is added to mechanism paths and classified as `self: true`. Adding/removing members requires ratification.

**Fixture semantics changed**: Tests now seed an empty consequence class by default (`seedConsequenceClass: false` opts out). This is pragmatic but means fixtures don't mirror production's 28-member class. The test `every tracked copy of a member rule in this repository is classified as one` provides coverage, but fixture divergence is a smell.

**The schema gap**: The criterion lives in `rule.schema.json`, which is explicitly **not gated**. Author's reasoning: "The gate never reads it, so a schema edit changes no membership until the list changes." But this misses that schema changes shape *future* list additions. The three clauses are pinned in gate code (`CONSEQUENCE_CLAUSES`), so adding a fourth requires editing the gate (gated)—but **redefining** what an existing clause means wouldn't trip the gate until someone adds a rule under the corrupted definition. That rule addition would be gated, but under a semantically shifted criterion.

**Assertion weakening check**: I don't see evidence of weakened assertions. The fail-closed test validates refusal behaviour. The union-computation test proves both sides are consulted. No xfail'd or skipped tests.

## 4. Other hosts/projections as a workaround?

**Coverage claim**: Test verifies "every tracked copy of a member rule in this repository is classified." Projections listed: `src/rules/`, `.claude/rules/`, `.augment/rules/`, `dist/agent-src/rules/`, `.cursor/rules/`. Author states untracked projections are "generated at install time"—wouldn't appear in diffs.

**Potential gap**: An edit in a **gitignored projection** wouldn't be in the diff. But if those projections are truly generated from tracked sources, the tracked source would be in the diff. This seems sound, but only if install-time generation is deterministic and can't be overridden.

## 5. Reversibility?

**Recovery path**: ADR-281 § 5—owner forge bypass. For a broken list on main:
1. All new PRs fail (can't compute subject with unreadable base)
2. Owner bypasses forge to merge fix
3. Fix is "judged by a base whose list reads"—meaning you'd use an older base commit

**Circular dependency issue**: To judge the repair, you compute a subject, which reads the list at base, which is broken. The resolution: use a base *before* the breakage (commit N-1 if breakage is at N). But this is **manual** and undocumented. A broken list on main doesn't just block one PR—it deadlocks the entire repository until the owner intervenes with a bypass that itself bypasses all gates, not just this one.

**Rollback**: The change itself is reversible (remove consequence rules from classification), but there's no defined threshold for "this gates too much." The 7/457 figure is historical measurement, not a monitored SLO.

## 6. Observations and rollback criteria?

**Missing**:
- No metric defined for "the claimed benefit (reduced governance risk) is real"
- No threshold for "too many commits are routing to owner"
- No monitoring of gate behaviour or bypass frequency
- The 1.5% historical figure is stated but not tracked going forward

## 7. Could it be smaller?

The 28 rules meet a **defined criterion** (three clauses), not an arbitrary selection. You could gate fewer by narrowing the criterion—e.g., only `irreversible-external`, not all three clauses—but the author's position is that all three clauses deserve gating.

**Why not incremental?** Start with 10 most critical, measure, expand? The author chose principled boundary over phased rollout.

## 8. Standing instruction weight?

Every gated commit now:
- Reads JSON list from git objects at **two** revisions (base and head)
- Validates list structure at both
- Computes union membership
- Potentially routes to modification review

Measured cost is real but bounded. No network calls, just JSON parsing.

## 9. Untrusted content steering?

**Reading from git objects** (not working tree) at specific revisions prevents working-tree tampering. An attacker would need to:
1. Get a commit onto main that breaks the list (requires ratification—list is self-gating)
2. Edit a previously-gated rule while list is broken

Step 1 is blocked: changing the list requires ratification. If someone bypasses that, the list becoming unreadable **fails all subsequent PRs**, not just their own.

**Residual risk**: The schema defining what the clauses mean could be corrupted, then rules added under the corrupted definition. But the schema isn't executable—it's documentation. The gate code pins the clause strings.

---

## My stance

**STANCE: ratified | CONFIDENCE: 70 | DEALBREAKER: none, but see concerns**

### Why ratified:
- The fail-open and base/head union dealbreakers from prior reviews are **resolved**
- Test coverage is thorough (end-to-end through `classifyTarget`, projection inventory, fail-closed validation)
- Fail-closed behavior is correct for a governance control
- The change makes the governance surface consistent—arbitrary that some high-consequence rules were gated and others weren't

### Why confidence is 70, not 95:

1. **Deadlock recovery is documented but not smooth**: Broken list on main requires owner forge-bypass, which bypasses *all* gates. There's no surgical option. The "judged by a base whose list reads" requires manually picking an older base commit. This could be tested but isn't.

2. **Schema gap is explained but not eliminated**: The criterion's *meaning* lives in an ungated schema. The three clause strings are pinned in gate code, so you can't add a fourth without gating the gate—but you can redefine what "authority-bypass" means, then add rules under that shifted definition. That said, this is more theoretical than practical—changing what "kernel rule" means conceptually is also possible.

3. **No production monitoring**: The 1.5% historical impact is measured, but there's no ongoing tracking or defined rollback threshold. If this turns out to gate 10% of commits, when do we revert?

4. **Test fixtures diverged from production**: Empty-class default is pragmatic but obscures whether tests would catch production issues. The inventory test partially covers this, but fixture-production divergence is a smell.

### What would raise my confidence to 90+:

- A test demonstrating the deadlock recovery path (base list broken, repair PR uses older base, passes)
- Either gate the schema's `consequence_class` enum OR add a test pinning the definitions against corruption
- Define a rollback criterion (e.g., "if >5% of commits route to owner for 3 months, revisit")

**The strongest architectural call to push back on**: The schema not being gated. But the author's counter-argument—that the clause *strings* are pinned in gate code and the schema is documentation—is defensible. I'd still prefer the schema gated, but it's not a dealbreaker.
