<!-- evidence-type: analysis -->

# Does a general delegation reach the skills-promise public commitment?

**Date:** 2026-10-22 · **Members:** `anthropic` (claude-sonnet-4-5), `openai` (codex-default)
**Mode:** prompt, one round · **Cost:** $0.00 (subscription transport, nothing billed)
**Quorum:** 2/2 · **Prompt:** `skills-promise-delegation-reach-20261022.question.md`, beside this file
**Raised by:** 17.0.0 release finding `852d58ec59a3` (release council: fix before the cut)

## Verdict — (B), 2/2

The 2026-10-18 delegation does not reach the public-commitment class. ADR-289
Decision 1 (the reach contract) is a recommendation pending explicit owner
ratification; `README.md` cites it as proposed; the 2026-10-18 record carries
an authority correction. Open owner decision: ratify, amend or reject Decision 1.

## Seat answers, verbatim

### `anthropic`

I'll analyze this against the governance rule's reserved-class table.

**(B)** — The delegation does not reach it.

**Decisive reason:** A general delegation cannot discharge a reserved-class authorization boundary without explicitly naming that class; the reservation exists to prevent exactly this kind of silent authority expansion.

**Sentence for the record:** "The 2026-10-18 general delegation ('resolve the open decisions in the AI council') did not explicitly name the public-commitment class, so the completeness-skills-owe verdict (ADR-289) remains a council RECOMMENDATION awaiting owner ratification before it becomes a published contract."

**Why this matters:** If "the open decisions" could reach a reserved class two days after escalation, the reservation loses its protective function. The rule reserves public commitments to the owner because they're externally binding and hard to retract. A general instruction — even a well-intentioned one — shouldn't silently override that safeguard.

**Next steps:**
1. Mark ADR-289's contract text as "PROPOSED (awaiting owner ratification)"
2. Remove or label the README:59 citation accordingly
3. Add an open owner blocker to the decision record
4. When the owner explicitly chooses on THIS class, that choice closes the blocker

### `openai`

**B.** The owner’s general instruction to resolve open decisions in the council does not explicitly authorize the council to make a public commitment that the governance rule reserves to the OWNER.

“The 2026-10-18 council verdict and ADR-289 contract text are a recommendation only, pending explicit OWNER ratification, and do not establish a public commitment.”

