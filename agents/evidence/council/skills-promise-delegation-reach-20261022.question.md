<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-22, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence). Not edited after the run. -->

# Does a general "resolve the open decisions in the council" delegation reach a public-commitment choice?

Repository: event4u/agent-config, a governed skill/rule/command suite published to npm.
Release under preparation: 17.0.0. A two-seat release council ruled the item below
must be closed before the cut: "An owner-reserved public commitment cannot rely on
ambiguous general delegation; explicit owner authorization is required."

## The governance rule

`decision-revisit-gate` reserves to the OWNER any transition that "creates /
removes / weakens a legal, regulatory, contractual, licensing, compatibility, or
public commitment". Everything else goes to the AI council. "Cannot be bounded
from available evidence" also goes to the owner.

## The facts

1. 2026-10-16: a council round on "which skills does the package promise to make
   available" escalated 2/2 to the owner, because choosing the promise creates a
   public commitment.
2. 2026-10-18: the owner wrote, in German, "versuche die offenen entscheidungen
   im ai council zu lösen" ("try to resolve the open decisions in the AI
   council"). This is the whole delegation; it names no decision class.
3. On that basis a 2026-10-18 council round
   (`agents/evidence/council/completeness-skills-owe-20261018.md`) chose option
   (b) "reach": every packaged skill is either installed locally or retrievable
   by name in one deterministic operation; plus keeping 13 declared skills.
   ADR-289 records the contract text.
4. `README.md:59` cites ADR-289 WITHOUT claiming the contract is met (71 skills
   are still unreachable without the MCP server). No other public surface
   states the promise as achieved.

## The question

- (A) The delegation reaches it: "the open decisions" included the one
  the council had just escalated to the owner, so the owner answered that
  escalation by sending it back. Disposition: state this reading explicitly in
  the 2026-10-18 record (which open decisions existed on 2026-10-18, and that
  this one was among them), and keep ADR-289's contract as a target, not a
  published claim.
- (B) The delegation does not reach it: a general instruction cannot discharge
  a reserved-class decision without naming it. Disposition: mark ADR-289's
  contract text and the 2026-10-18 verdict as a council RECOMMENDATION awaiting
  owner ratification, remove the README:59 citation of ADR-289 as a commitment
  (or label it "proposed"), and add an open owner blocker.
- (C) Something else; state it.

Answer with one letter, a one-sentence decisive reason, and the exact sentence
the record should carry. No outcome is expected in either direction.
