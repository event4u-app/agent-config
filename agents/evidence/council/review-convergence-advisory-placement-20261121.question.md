<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-11-21 for step 1.4 of
     road-to-review-loops-that-converge, committed verbatim beside the record. -->

# Where should a 335-character advisory paragraph go when its planned file is at its budget cap?

A repository of rules for AI coding agents planned to add this paragraph to
`contexts/authority/kernel-rule-edits.md`, a context file that an always-loaded
rule (`scope-control`) pulls in via `load_context`:

> Before writing round N+1's ratification packet, run
> `./scripts-run src/scripts/review_convergence --subject <slug>`. On `stalled`
> or `diverging`, stop re-submitting and take ADR-268 § 4's owner rung, with the
> subject's row from `agents/evidence/analysis/review-loop-replay-2026-11.md`
> attached. Advisory: the verdict refuses nothing.

A CI gate caps the characters each always-loaded rule carries including its
loaded contexts. `scope-control` sits at 19,327 of an allowlisted ceiling of
19,332 (5 characters of headroom); the paragraph takes it to 19,662 and the gate
fails as "allowlisted-breach growth". Those characters are also part of the
cached prompt prefix of every request. The roadmap step's own verify greps the
file for `review_convergence` (at least one hit in source and projection).

Options:

- (A) Keep the paragraph in the file at net ≤ 5 characters: a one-line pointer
  (~120 characters) plus deleting ~115 characters of existing provenance text in
  the same file (a parenthetical naming the roadmap phase that introduced a CI
  guard, and a "Source" line pointing at an archived roadmap).
- (B) Raise the allowlisted ceiling by 335 characters.
- (C) Put the full paragraph in the `ai-council` skill (loaded on demand, not on
  the always budget, and the skill an agent uses to run a ratification round),
  and keep in the context file only a pointer whose characters are offset as in
  (A).
- (D) Something else.

Answer: which option, why, and the one fact that would change your answer.
