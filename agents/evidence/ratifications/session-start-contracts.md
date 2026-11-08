---
proposed_by: claude-code session, road-to-a-session-start-under-the-host-limit
implemented_by: same session
reviewed_by: ai-council
subject: 7192f4deff0bbd274acc9bfec1f565804be607b3547e6d633bbd9a9febfcdf66
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Appends a startup contract to each of the 28 high-consequence and safety-floor rules, adds review-driven frontmatter triggers and one body paragraph, rewords one hook-manifest comment, and raises the layer-promotion hook chunk ceiling for the contract stub builder.

Verdict `ratified`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/session-start-contracts-ratification-r22-20261108.question.md`, committed at `892dccdb7f9942cc84f9060e031b84153e71bce7` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `ratified`

```text
**Assessment: Agree (with one structural caveat)**

## 1. My Position

These startup contracts are **equivalent in authority** to their full rule bodies for the stated purpose: carrying core obligations at session start until the full body arrives on trigger. The compression is sound, fail-closed where needed, and validated through 21 rounds of adversarial review.

## 2. Strongest Argument FOR

**The fail-closed architecture proves the compression is honest.** Four contracts (legal, finance, strategy, disclaimer) must copy exact text from their bodies. Their contracts explicitly state: "body unreadable → don't deliver, name the missing path." This is a **refusal to degrade gracefully**, which is the signature of a system that knows its limits. If the authors were willing to compress dishonestly, they'd have inlined those texts and avoided the dependency. Instead they:

- Point to the body for normative text
- Fail hard if the pointer breaks  
- Test the pointer resolution in `session_start_upgrade.test.ts`

This pattern appears in four contracts independently, suggesting it's a principled design choice, not a one-off. The round-by-round fixes (privilege markers → frontmatter triggers in round 12, redaction preview masking in round 13, image model-card check unconditional in round 12) show the review caught real weakenings and fixed them with tests. A 680-clause audit where every restored qualifier got a regression assertion is not a rubber stamp.

## 3. Strongest Counter-Argument to Consider

**Density under degradation creates a silent failure mode.** Several contracts (decision-revisit-gate at ~1,950 chars, domain-safety-pii at the 2,000 char ceiling, settings-ask-protocol at ~1,850 chars) compress complex decision trees into bullets. An agent with degraded context might:

- See the contract's opening "When:" clause
- Match the condition
- Begin reading the dense "Must:" section
- Hit a context limit mid-bullet
- Finish with a partial read it doesn't recognize as partial

The contracts are **at session start**, which means full context, so this seems theoretical. But if context compression (mentioned in system instructions) runs during a long session, a mid-bullet truncation could leave an agent that thinks it read the contract when it only got half. The full bodies have paragraph breaks and section headers that fail more obviously when cut. The contracts are optimized for token count, not degradation resilience.

**Counter to the counter:** The session-start injection happens once, before compression starts. The `<total_tokens>15000000 tokens left</total_tokens>` in the system block suggests ample headroom. And the round 16 note "no single review had compared every contract with its whole body" → round 22 shows all 28 full files together suggests the reviewers know the density risk and addressed it by reviewing everything in one coherent pass.

## 4. Concrete Next Steps

### If you agree (ratify):

1. **Merge** subject `7192f4d...` as the record shows rounds 12–21 fixed every finding and round 22 presents the full comparison requested
2. **Monitor** the one honestly-stated gap: mis-route rate for command-suggestion HIGH tier is "unmeasured, not low" (contract line admits this). A >5% mis-route over 50 auto-routes reverts to block-always per the contract itself
3. **Watch** the density concern above in practice - if session-end reports or user feedback show mid-contract truncation, that's the trigger to add section markers or paragraph breaks to the densest contracts (decision-revisit-gate, domain-safety-pii, settings-ask-protocol)

### If you disagree:

1. **Identify** which specific contract(s) drop a prohibition or soften a MUST that the body enforces - the 680-clause audit suggests there isn't one, but an independent eye might catch what 21 rounds missed
2. **Propose** either (a) inline the missing text into that contract (if under 2,000 chars), or (b) add the missing clause as a separate trigger-on-demand rule if it's truly weight-bearing
3. **Don't block** on the density-under-degradation concern alone - it's theoretical and solvable post-merge if it manifests

---

**STANCE: ratified | CONFIDENCE: high | DEALBREAKER: no**
```

### openai — `ratified`

```text
1. **Assessment: agree, within the supplied evidence.** I found no concrete, material weakening in the 28 startup contracts compared with their supplied bodies. The round-22 budget increase also appears justified. This is a textual review; I have not independently verified the digest, repository contents, or test results.

2. **Strongest argument:** The contracts preserve the operative gates rather than merely summarize intent. For example, `legal-safety-floor` retains acknowledgment, actual council execution, individual-case refusal, and jurisdiction restrictions. Where exact body text is required, it explicitly fails closed if that body cannot be read.

3. **Strongest counter-argument:** Textual equivalence does not establish delivery reliability. The delivery section says bodies arrive “on a trigger,” while the stub also instructs the agent to load them “on a match.” Those mechanisms must cover semantic matches beyond literal router keywords. Pointer-resolution tests prove files exist; they do not prove the agent receives or reads them before acting.

4. **Concrete next steps:** Accept the supplied contracts, then verify the exact subject’s required checks before merging. Include an installed-layer integration case with a semantic match lacking a frontmatter keyword, demonstrating body retrieval before the governed action. For the budget change, confirm the measured 60,848-byte chunk using the locked CI toolchain; 66,900 provides approximately 10% headroom.

STANCE: ratified | CONFIDENCE: med | DEALBREAKER: no
```

## Rounds

Twenty-two ratification rounds (anthropic + openai, subscription CLI, $0) plus two full-body equivalence passes over four groups of seven rules. Rounds 12–22 showed all 28 rule files in full (`council_cli --max-bundle-bytes`, `--member-timeout`). Every finding was verified against the rule body and fixed, each fix pinned by a test shown red against the prior text (`tests/scripts/startup_contract_activation.test.ts`, `tests/scripts/check_startup_contracts.test.ts`). Rounds 15–16 produced agreeing verdicts without the closing stance line under the PR template, so they record no verdict; round 21 was the first in which both seats closed `ratified` on a stance line; the pre-push preflight then found the layer-promotion hook chunk over its ceiling, the ceiling raise in the gated `hook-bundle-budget.json` changed the subject, and this record is rendered from round 22, where both seats ratified the full subject again. Every round's prompt is committed under `agents/evidence/council/session-start-contracts-*`.

## Independence

`proposed_by` and `implemented_by` are the same session; `reviewed_by` is the two-provider council, whose prompts are committed beside this record.
