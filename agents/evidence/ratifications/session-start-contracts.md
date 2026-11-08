---
proposed_by: claude-code session, road-to-a-session-start-under-the-host-limit
implemented_by: same session
reviewed_by: ai-council
subject: f77bee9bcfdc20f9159cacc9c40b68387b1354f208c65e8db0058500718c06c7
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Appends a startup contract to each of the 28 high-consequence and safety-floor rules, adds review-driven frontmatter triggers and one body paragraph, and rewords one hook-manifest comment.

Verdict `ratified`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/session-start-contracts-ratification-r21-20261108.question.md`, committed at `4b4b405caeb6592ddbe86e0e893020b3df537b9e` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `ratified`

```text
## Assessment

**STANCE: ratified | CONFIDENCE: high | DEALBREAKER: no**

**1. Honest assessment:** I agree these contracts can ship. All 28 were tested through 20 two-seat council rounds with findings fixed test-first where testable. The compression is aggressive but preserves decision points: prohibitions stay prohibitions, gates stay gates, fail-closed requirements stay fail-closed. Three high-consequence late-round fixes are incorporated: `domain-safety-pii`'s five privilege markers + eight skill IDs as triggers (round 12), `image-likeness-and-rights`' unconditional model-card check (round 12/13), and `low-impact-corpus-privacy-floor`'s masked preview for all eight classes (round 13). The four body-copying contracts (disclaimer, finance, retention, strategy/legal) all carry "body unreadable → don't deliver, name the missing path". Session-start budget measured at 78,790 chars hits the 80,000 target.

**2. Strongest argument FOR:** Reading 28 contracts (~30,500 chars total) at session start and delivering full bodies on trigger is materially cheaper than holding 28 full bodies (342,342 chars) always-loaded, while preserving the authority structure—every contract names its body file, and the body is explicitly the authority. Twenty rounds found and fixed: git-history's standing-instruction scope (test-pinned), finance/strategy/disclaimer/retention fail-closed (test-pinned), one opening order across three rules (pinned), terms defined in place, installed stubs verified byte-for-byte, dead carrier kept full. The contracts passed group reviews that saw every body in full (this round), and the three Round 12–20 high-consequence fixes prove the process catches real gaps.

**3. Strongest counter-argument:** The compression is aggressive enough that a subtle weakening could hide in it. Example: `autonomous-execution`'s "repeat = same attempt" adds a clarification the body expresses as "REPEATING THE APPROACH IS NOT AN ATTEMPT, IT IS THE SAME ATTEMPT AGAIN"—the concept is there, but not those words. Domain-specific contracts (legal, finance, strategy, decision-revisit-gate) compress a lot into single Must/Stop clauses. An agent misreading a compressed contract might act on a weakened version because the contract reads fine in isolation—it's only weaker relative to the body. Mitigation: the body is authority and arrives on trigger. Risk: if the agent doesn't trigger the rule, it only has the contract, and that's where a compressed prohibition could be read permissively.

**4. Concrete next steps:** (1) Monitor real sessions for contracts that fail to route their body when they should—under-specified triggers would reveal themselves there. (2) Quarterly drift check: re-run a sample through an independent model to verify contracts still match bodies (guards accumulated edits weakening a contract unnoticed). (3) Build the instrument for `command-suggestion-policy`'s ">5% mis-route" kill criterion—it's honestly stated as unmeasured but it's a HIGH-tier carve-out gate, and unmeasured means unenforceable.
```

### openai — `ratified`

```text
1. **Assessment: agree, with limited assurance.** The supplied contracts appear to preserve the material safety obligations of their bodies. I found no specific remaining omission that warrants refusal. This assessment covers the supplied text; it does not independently verify the commit digest, generated files, or reported test results.

2. **Strongest argument:** The contracts preserve concrete gates and failure behavior, rather than merely summarizing intent. For example, `domain-safety-pii` retains the export recipient tiers, national-ID no-hashing prohibition, and privilege confirmation gate. `legal-safety-floor` retains acknowledgment, an actually executed council pass, and the individual-case STOP. The contracts requiring verbatim body text explicitly fail closed when that body is unreadable.

3. **Strongest counterargument:** Textual preservation does not establish reliable delivery. The delivery section says thinning depends on the “SessionStart carrier probe reached”; that alone does not demonstrate that a matching rule body reaches the agent before its first consequential action. Byte equality, pointer existence, and tests pinning restored wording cannot establish that behavioral property. The repeated activation repairs described in rounds 17–20 make this the strongest residual concern.

4. **Concrete next steps:** Merge with the assurance boundary stated accurately: textual review supports equivalence; runtime enforcement remains partly model-carried. Preserve the reviewed subject and independently verify its digest and generated projections. Add end-to-end delivery checks covering a prompt without a frontmatter keyword, an unavailable body, and the first consequential action after activation. Keep future body edits coupled to contract review.

STANCE: ratified | CONFIDENCE: med | DEALBREAKER: no
```

## Rounds

Twenty-one ratification rounds (anthropic + openai, subscription CLI, $0) plus two full-body equivalence passes over four groups of seven rules. Rounds 12–21 showed all 28 rule files in full (`council_cli --max-bundle-bytes`, `--member-timeout`). Every finding was verified against the rule body and fixed, each fix pinned by a test shown red against the prior text (`tests/scripts/startup_contract_activation.test.ts`, `tests/scripts/check_startup_contracts.test.ts`). Rounds 15–16 produced agreeing verdicts without the closing stance line under the PR template, so they record no verdict; this record is rendered from round 21, the first round in which both seats closed on a stance line over the same subject. Every round's prompt is committed under `agents/evidence/council/session-start-contracts-*`.

## Independence

`proposed_by` and `implemented_by` are the same session; `reviewed_by` is the two-provider council, whose prompts are committed beside this record.
