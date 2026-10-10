# Law-heading review — `runtime-safety`

<!-- evidence-type: analysis -->

verdict: land

> **Scope:** step 4.2 of `road-to-a-thinned-layer-measured-in-one-unit` — does the
> new law section change what the rule obligates, or omit a duty the full body
> carries? The question matters because `project_thin_rules` ships such a rule as
> a STUB PLUS ITS LAW SECTION: a consumer of the thinned install sees the law
> alone until the pointer is pulled, so a duty living only in the body is one
> they never see.

## Verdict

**land** — AI council 2026-10-10, two rounds, anthropic + openai, 2/2 both
rounds, $0.00 metered (subscription-authed). The law section stays.

## Round 1 — owner, one omission, both seats naming the same one

The section said `HANDLERS ARE AN ALLOWLIST — NO ARBITRARY CODE EXECUTION` but
did not carry the allowlist. A thinned consumer would know handlers must be
allowlisted and not know *which*, so they could neither write nor review an
execution block, and could not tell that `python` is invalid. One seat put it
as: the constraint is unactionable without the list, exactly as "obey the speed
limit" is unactionable without the limit.

One seat supplied the repair text verbatim and added that the law "does not
otherwise change the full rule's obligations". Applied as given, including the
consequence clause — every other value is a linter error.

## Round 2 — land, with the pattern question answered explicitly

Round 2 asked the seats to distinguish a repairable gap from the failure mode
the sibling rule `tool-safety` hit, and not to reach for `owner` because a
sibling got it. Both answered directly: no second omission, and no evidence
this rule resists compression. One listed the coverage — defaults, `assisted`
behaviour, `automated` prerequisites, handler allowlist, anti-bypass,
escalation.

## Recorded but NOT part of this verdict

One seat added: "I would not yet greenlight automated runtime execution based
on this rule alone," naming handler safety semantics, the definition of
`safety_mode` and the absence of a kill switch. That is a finding about the
RULE, not about whether this section faithfully restates it, and the review
question was fidelity. It is written down here rather than dropped, because a
reviewer who read only the verdict would otherwise not meet it.

## Why this one landed when three siblings did not

Its law already existed as one coherent set of constraints under a single
heading. The three that failed carry duties distributed across prose,
carve-out sections and several fenced blocks, and compression lost one every
round. The discriminator is not rule length — `runtime-safety` is the shortest
of the four at 1,553 characters, but `question-not-instruction` is only 3,200
and still failed.
