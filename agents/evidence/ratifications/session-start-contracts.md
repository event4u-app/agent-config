---
proposed_by: claude-code session, road-to-a-session-start-under-the-host-limit
implemented_by: same session
reviewed_by: ai-council
subject: 2d4468836a50612a94b44477d3e94bef9565167ccf8c14bdfa296d820ede59fb
providers: [anthropic]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: no-final-verdict
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Each of the 28 high-consequence rules gains a startup contract in its own file; five rule files change (triggers, the low-impact refusal fence, See-also lines, two body clarifications); one hook-manifest comment; the layer-promotion hook chunk ceiling.

Verdict `confirmed-non-expanding`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/session-start-contracts-ratification-r31-20261108.question.md`, committed at `1c14c5cc8f5834b96f3f951a314fa3181f6ee723` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `confirmed-non-expanding`

```text
**Assessment: confirmed-non-expanding**

Reviewed all 28 contracts against their rule bodies. Each contract accurately compresses its rule's obligations without material loss. Specific verifications:

**Structural integrity maintained:**
- All Iron Laws captured without softening (MUST → must, NEVER → never)
- Multi-step procedures complete (5 steps in `decision-revisit-gate`, stop-ask-resume in `user-interrupt-priority`, quarantine in `evaluator-independence`)
- Numeric bounds preserved (allowlist > 20, fix-loop 1-3/4-6/7-10, session-budget one question, interrupt-budget zero non-interactive)
- Fail-safes intact (body-unreadable → don't deliver, no council → refuse, no name → inert)

**No authority expansions:**
- `decision-revisit-gate` contract's "unbounded by available/tree evidence (files/records/measurements)" clarifies the body's "cannot be bounded from available evidence" with examples, doesn't narrow scope
- `finance-safety-floor` and `domain-safety-disclaimer` "gist only:" notations are contract-brevity markers paired with "body unreadable → don't deliver", not substitutions
- `image-likeness-and-rights` makes the model-card check explicit for ordinary subjects, which the body implies by placing it in the universal gates table
- Round 29/30 fixes verified: `question-not-instruction` includes fast-path marker and canary greeting ordering, `decision-revisit-gate` preserves body's transition test wording

**Enforcement honesty consistent:**
- Instruction-only declarations match rule bodies (`evaluator-independence` items 2-4, `security-sensitive-stop`, `git-history-discipline` pre-edit reasoning)
- Host-specific gaps declared (`session-canary` Augment/Windsurf/Copilot, `git-history-discipline` claude-only block-no-verify)
- Deterministic coverage stated plainly (`secret-vcs-guard` check_secret_leak, `tool-safety` lint_agent_security)

**Strongest counter-argument:**
The contracts' compression inevitably loses some operational detail (the full disclaimer templates, the complete See-also webs, the worked examples). An agent holding only the contract might miss a nuance the full body would have clarified. This is the deliberate trade: session-start budget discipline requires compression, and the trigger-based routing means the full body arrives when the rule fires.

**Concrete next step:**
Merge as written. The contracts achieve their stated goal (session-start presence under 80k chars, measured 79,845) without material weakening. Any agent spawned with these contracts can act safely within their bounds and knows when to route to the full body.

---

STANCE: confirmed-non-expanding | CONFIDENCE: high | DEALBREAKER: no
```

### openai — `no-final-verdict`

```text
1. **Assessment: mixed; I would withhold ratification pending clarification.** The contracts preserve most substantive prohibitions, exceptions, and escalation conditions across the 28 supplied pairs. However, several introduce explicit obligations absent from their corresponding bodies. That conflicts with treating this as purely non-expanding compression.

2. **Strongest argument:** the contracts sometimes add policy rather than summarize it:

   - **`git-history-discipline`, contract § Must:** “that re-push needs this-turn OK first.” The body’s protocol requires “an immediate re-push in the same turn,” but does not itself state that additional permission requirement. Its cross-reference to the canonical Hard Floor may justify this, but that dependency needs an explicit clause-level attribution.
   - **`domain-safety-disclaimer`, contract § Must:** “body unreadable → don't deliver, name the missing path.” The body requires the disclaimer “verbatim or translated,” but contains no missing-path reporting requirement. Similar additions appear in the finance, strategy, retention, and legal contracts.
   
   These additions are generally conservative. Nevertheless, additional mandatory behavior is a semantic change, even when it reduces authority.

3. **Strongest counter-argument:** these clauses may simply operationalize existing requirements. An agent cannot reproduce a required footer reliably without reading it, and another standing rule may already require permission before pushing. If those dependencies are established, the additions could be faithful composition rather than new policy. I found no comparably clear dropped substantive prohibition in the supplied pairs.

4. **Concrete next steps:**

   - Attribute each additional obligation to its authoritative rule, or add it explicitly to the corresponding body and review it as a policy change.
   - Separate **preserved**, **dependency-derived**, and **new** obligations in the clause audit.
   - Address the documented missing-contract fallback: a readable audit omitting a high-consequence member produces a law-only stub, despite the comment that missing contracts should not deliver less than the ratified contract. CI rejection limits this risk but does not make that runtime behavior fail-safe.
   - Keep the verdict bounded to the evidence: supplied hashes and test descriptions do not establish that the implementation or tests were independently verified.

The displayed rule-body delta removes no clear operative obligation. The masking change strengthens privacy; the model-card and reply-order changes explicitly alter the bodies to match their contracts.
```

## Rounds and the owner decision

Thirty-one ratification rounds (anthropic + openai, subscription CLI, $0) plus two full-body equivalence passes. From round 12 each round saw all 28 rule files in full (`council_cli --max-bundle-bytes`, `--member-timeout`). Every finding was verified against the rule body and fixed with a regression test shown red first, or answered in the next prompt. anthropic ratified or confirmed every round from 18 on; openai refused or withheld a stance in every round, each time on new points — from round 30 on no dropped prohibition, only scope, modality and evidence-binding points, some reversing its own earlier requests.

That is the non-convergence ADR-268 § 4 / ADR-281 § 4 hands to the owner. Asked in-session on 2026-11-08 with the council's recommendation, the dissent, the change, its gain, risk and rollback, the owner chose option 1, owner ratification:
`agents/evidence/owner-directives/2026-11-08-session-start-contracts-owner-ratification.md`.
The merge over the red `check_kernel_edit_ratified` is the owner's own act on the forge; the bypass record follows it.

Every round's prompt is committed under `agents/evidence/council/session-start-contracts-*`.

## Independence

`proposed_by` and `implemented_by` are the same session; `reviewed_by` is the two-provider council; the decision is the owner's.
