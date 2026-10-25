---
proposed_by: claude-opus-5.5/drain-self-modification-20261021
implemented_by: claude-opus-5.5/drain-self-modification-20261021
reviewed_by: ai-council
subject: 32577436593dc42d0300826ad646e7fc1337e988ee493187e086c1acd339e137
providers: [anthropic, openai]
verdict: refused
seats:
  anthropic: ratified
  openai: refused
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review — step 6.2, one learning as a change to a skill body

A **non-passing** record, kept because the owner decides this case and needs it
in front of him. The header is round 3's, printed by `ratification_header` from
the two seats' stance lines. `subject` is `proposalSubjectOf` over
`src/skills/testing-anti-patterns/SKILL.md` at `ec866ae5b` — the digest
`proposal:check` binds a package proposal's review to (step 6.1) — not the
gate's subject: the skill body is not on the ratification gate's watch list.

## What was reviewed

Step 6.2 of `road-to-self-modification-that-a-council-must-pass`: a learning
from this branch's own step 5.2 review — a green suite over a builder function
said nothing about what `main` printed — captured and proposed in
`agents/proposals/test-through-the-entry-point.md` as Iron Law 8 of
`testing-anti-patterns` ("NEVER stop at the function when the claim is about
delivery"). All rounds design mode, `--rounds 1`, CLI seats, nothing billed;
every prompt committed verbatim under
`agents/evidence/council/skill-law-8-review-*20261021.question.md`.

| Round | anthropic | openai | openai's dealbreaker, and what changed after it |
|---|---|---|---|
| 1 | ratified | refused | "through the entry point" could mean real hooks or hosted CI; undefined terms; exit-0-only assertions; unverifiable dated anecdote; no denominator — law redefined, Gotcha made timeless, signal given a denominator |
| 2 | ratified | refused | the "unless they are the contract" exception let prose authorise crossing the isolation boundary; merge sequence not enforced — exception removed, signal made a seeded-fault rate, enforcement per link stated |
| 3 | ratified | refused | the merge is not bound to the authorization; no kill switch for installed copies; the law names hooks as entry points and then forbids real hooks; the metric validates an assertion, not the law |

## Disposition

Three consecutive splits with a different provider tried: condition 1 of
`docs/contracts/ratification-artifact.md` § When the user decides — the owner
decides. Under ADR-281 as amended a council refusal fails closed for a
learning-originated package change, so the skill edit was taken off the branch
(empty net diff per file against `origin/main`); it is reachable at
`ec866ae5b`. The proposal stays at `stage: proposed` naming this record: the
lane's capture, proposal and review were walked, and the review did not pass.

The seat's later findings are recorded rather than answered here because they
are about the package, not the law: that no check binds the merged commit to
the authorized digest, and that an installed skill has no revocation path. Its
round-3 point that the law lists a hook as an entry point while forbidding real
hooks is a real inconsistency in the text and is the first thing a next attempt
fixes; its alternative — a procedure checklist item instead of an eighth "NEVER"
— is the smaller change it named in rounds 2 and 3.
