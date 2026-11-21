---
proposed_by: claude-code workflow session executing road-to-questions-that-reach-the-right-decider (2026-11-21)
implemented_by: the same claude-code workflow session
reviewed_by: ai-council
subject: ff8f72a5845056cb47a6e481f220ec81e00845b54de1f4129806cc0b32402fbe
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Adds an Owner class column and one paragraph to the owner-reserved table of decision-revisit-gate: rows 1-4 map to the owner's four classes, rows 5-7 are marked outside and stay reserved to the owner; no row added, removed, reworded or rescoped.

Verdict `confirmed-non-expanding`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/decision-revisit-gate-owner-class-ratification-r3-20261121.question.md`, committed at `e8a558f9729969138cf8e42a180a2d8013ef23fa` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `confirmed-non-expanding`

```text
## Independent Assessment

I'm reviewing this change fresh, without assuming prior reviewers were correct.

### 1. What behaviour changes?

The table now carries an explicit classification: rows 1-4 map to the owner's four stated classes (purpose, safety-floor, irreversible, money); rows 5-7 are labeled "outside" those four but still owner-reserved. The added paragraph clarifies that "first column decides routing" and "outside" rows "go to the owner until the owner folds, keeps or removes the row."

**Routing behavior does not change** - same reserved column, same rows.

### 2. Authority boundary direction?

**No boundary moves.** The classification is documentary. Every row in the left column still requires owner decision. The right column's scope is unchanged. This documents an already-performed mapping; it doesn't authorize new paths.

### 3. Weakens its own judge?

No. This rule is instruction-only (no tests). The change doesn't delete tests, lower thresholds, or weaken assertions. The clarifying text *strengthens* the instruction by making the "outside" label unambiguous.

### 4. Route-around?

No. The dist/agent-src projection carries the identical hunk (confirmed line-by-line in round 2, CI-enforced). No other delivery path exists.

### 5. Undo?

Simple git revert. Remove third column, remove paragraph. Standard commit authority.

### 6. Falsifier?

Claimed benefit: clarity about which rows match which owner class. Falsified if agents consistently misroute "outside" rows to council despite the clarifying text. Rollback criterion: documented misrouting incidents from the "outside" label.

### 7. Smaller change available?

Yes - could add just the clarifying paragraph without the column, or use a clearer label than "outside" (e.g., "pending-owner-resolution"). 

Larger change buys: visible documentation of the classification gap, explicit labels for discussing row disposition, makes the unresolved state transparent rather than hidden.

### 8. Instruction weight?

Adds ~3 table cells + ~50-word paragraph. Modest but non-zero. Agents reading this rule pay the parse cost every time.

### 9. Untrusted steering?

No. Routing is locked by: (a) first column controls, (b) rows unchanged, (c) text explicitly says "outside rows go to owner." Untrusted content can't override the reservation or redefine columns.

---

## Findings

**F1: Routing preserved** - Diff adds column 3, changes no column 1 or 2 content. First column still decides, as the new paragraph states.

**F2: "Outside" ambiguity** - The label "outside" in a table of "Reserved to the owner" creates semantic tension. Round 1 caught this. The added paragraph resolves it explicitly: "still reserved to the owner: a transition on it goes to the owner."

**F3: Classification visibility** - Makes transparent that rows 5-7 were mapped outside the four classes. This is information the owner needs to resolve the blocker; keeping it in an external note would hide it from the routing instruction.

**F4: Conservative default** - Disputed rows stay owner-reserved (not moved to council-decidable). This is the safe side: broadening owner work vs. delegating prematurely.

**F5: Instruction-only enforcement** - An agent that skims the table and skips the paragraph could misread "outside" as "not owner business." The text is clear, but reading it isn't programmatically enforced. That's the nature of instruction-only rules, and nothing about this change makes it worse than the base state.

**F6: Label quality** - "outside" is weaker than alternatives like "pending-classification" or "owner-unresolved." But poor labeling isn't the same as unsafe routing. The text disambiguates adequately.

---

## Assessment

**AGREE** - This is a confirmed-non-expanding change.

**Strongest argument FOR:**
The diff adds documentary information without touching routing logic. Same rows reserved, same council-decidable scope, same first-column control. The paragraph explicitly closes the ambiguity gap from round 1. Behavior identical; documentation improved.

**Strongest counter-argument:**
The "outside" label is semantically poor in a table of "Reserved to owner" items, and instruction weight grows for marginal benefit. The classification it documents is unresolved - might be cleaner to wait until the owner decides whether to fold/keep/remove those rows, then label them definitively. If an agent skims and misses the paragraph, "outside" reads backward. Better label: "pending-owner-resolution" or similar.

**Concrete next steps:**
1. Land this as confirmed-non-expanding - it's safe and clearer than the unlabeled base state.
2. Monitor for any agent misrouting on "outside" rows; that's your rollback signal.
3. Prioritize owner decision on rows 5-7 to exit the "outside" state.
4. Consider relabeling "outside" → "pending-classification" in follow-up if any confusion occurs.

STANCE: confirmed-non-expanding | CONFIDENCE: high | DEALBREAKER: no
```

### openai — `confirmed-non-expanding`

```text
**Assessment: Agree.** The diff supports `confirmed-non-expanding`. The strongest argument is that the routing cells are unchanged and the new paragraph explicitly sends transitions on all three `outside` rows to the owner. The strongest counterargument is that `outside` can look like a routing instruction when an agent reads the table without the paragraph. Round 2(c) reports no behavioral test for that failure mode.

1. **behaviour-change** — The table now displays the council’s mapping to the owner’s four classes. The paragraph after the table explicitly resolves a potential conflict between that mapping and the existing routing. For example, reopening quorum still goes to the owner even though its class is `outside`.
2. **boundary-direction** — The written authority boundary stays in place. The legal and public commitments, governance self-amendment, and insufficient-evidence rows all remain owner-reserved. Their disposition remains an owner decision.
3. **weakens-its-own-judge** — The supplied hunk changes no assertion, test, threshold, fixture, or review requirement. The instruction-only gate still depends on the model applying the prose. The reported CI check in round 2(b) checks projection parity.
4. **route-around** — Round 2(b) reports that the source and distribution hunks are identical and that no other delivery path carries the table. I reviewed the supplied diff and did not independently verify the installed copies. A host that shows the table without the trailing paragraph would lose the explicit precedence instruction.
5. **undo** — An authorized maintainer can reverse the table hunk reviewed at `0d9905e4d6c8fc73170a1294ac713e72d3b7c078` on the branch where it lands, then regenerate the distribution projection. The rollback restores the two-column wording shown against `911b91dd27` and leaves the reserved transitions in place.
6. **falsifier** — An agent routing a quorum change to the council because the row says `outside` would falsify the claim that the annotation preserves routing in practice. The change defines no runtime kill switch or rollback trigger. Treat any reproducible misroute caused by the label as grounds to remove the annotation.
7. **smaller-change** — A note below the existing table could record that the council mapped three rows outside the four classes and that all three still require the owner. The column buys a per-row mapping for the pending owner decision.
8. **instruction-weight** — Each session that loads the rule gets one extra column, seven short labels, and a four-line interpretation paragraph.
9. **untrusted-steering** — Untrusted content could quote `outside` in isolation and claim it delegates the transition to the council. The published rule bounds that attempt by making the first column control routing and expressly requiring the owner for every `outside` row.

Before landing, verify the generated projection and spot-check that an agent routes an `outside` governance transition to the owner even when the request quotes the label as grounds for council review. Keep the disposition of those rows with the owner.

STANCE: confirmed-non-expanding | CONFIDENCE: high | DEALBREAKER: no
```
