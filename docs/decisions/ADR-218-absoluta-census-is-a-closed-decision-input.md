# ADR-218 — The absoluta census is a closed decision input, not instrumentation

- **Status:** Accepted
- **Date:** 2026-08-06
- **Deciders:** maintainer; AI council round 3 (`anthropic/claude-sonnet-4-5` + `openai/gpt-4o`, blind + peer review)

## Context

`road-to-rule-coherence` was designed around the claim that **17 rules carry
competing absolutes**. On that basis it planned a 4-class precedence lattice and
a coverage ratchet ("every absoluta-carrying rule appears in ≥1 declared pair").

A census run during the roadmap refuted the 17 and reported **97 of 111**. That
refutation is what killed both mechanisms: governance over 17 outliers is
proportionate, the same governance over ~90% of the corpus is declaration debt
across almost all of it. The council agreed and the lattice was cut.

The 97 then turned out to have the same defect as the 17 — it came from a
throwaway script in a scratch directory and could not be re-run. An unverified
number had replaced an unverified number.

## Decision

**1. Cite the range and the structural figure. Never a point estimate.**

`src/scripts/measure_rule_absoluta.ts` re-derives all three readings of the same
corpus:

| reading | result |
|---|---|
| strict — ALL-CAPS imperatives only | 79 / 111 (71.2%) |
| same lexicon, case-insensitive | 97 / 111 (87.4%) |
| carries an Iron Law block — structural | 94 / 111 (84.7%) |

The 97 is reproducible: it is the case-insensitive reading. Neither lexical
reading is clean — the strict one scores `downstream-changes` at zero despite a
full Iron Law block ("EVERY EDIT IS INCOMPLETE … IS A CRITICAL FAILURE") that
uses none of its terms.

"Absolute" is a vernacular concept being instrumented, not a term this repo
defines, so forced precision here would be false precision. The three readings
are a **sensitivity analysis**: they land at 71–87%, so the conclusion that cut
the lattice is invariant to the method. That invariance is the finding — not any
one number.

**2. If a future artefact must cite one reading, it cites the structural one.**
Iron-Law-block presence is direct observation of declared authorial intent
rather than a surface-form proxy, and its definitional choice is explicit,
versioned and centralised rather than re-litigated per rule.

**3. The census is a closed decision input. It is not ongoing instrumentation.**

This is the council's kill-question verdict, converged across both members, and
it is the load-bearing part of this record. The census answered one question,
that answer killed one architecture, and the question is now closed. Keeping it
framed as instrumentation implies it might be re-run to enforce something — but
nothing consumes the number, and there is deliberately no threshold, because
"how many rules speak in absolutes" is a property of the house writing style
rather than a defect. A diagnostic with no diagnosis is purposeless precision.

The script stays in the tree for exactly one reason: it makes the figures in
this record **re-derivable instead of cited from a commit message**. That is the
defect this ADR closes. It is not a gate, carries no threshold, has no
`gate-coverage.yml` registration, and its `measure_` prefix keeps it outside the
gate population by construction.

## Consequences

- No artefact cites a point estimate for absoluta prevalence. The archived
  roadmap's P2.1 carries a correction block to that effect.
- Nothing is enforced. No rule is blocked, rewritten or ratcheted because of a
  number in this record.
- **A future "did this PR introduce a new absolute?" check would be a different
  tool** — one that watches diffs, not one that counts the corpus — and it gets
  built when there is an intent to enforce that boundary, not before.
- The follow-up roadmap's F5.2 ("decide what the absoluta figure is for") is
  answered by this record and can close against it.

## Alternatives considered

- **Pick one definition and defend it.** Rejected: all three readings have
  demonstrated false positives or false negatives, and the decision they
  informed does not depend on which is chosen. Choosing one would conceal the
  methodological choice rather than expose it.
- **Delete the script, keep only the numbers.** Rejected: that reproduces the
  original defect — figures nobody can re-derive. Re-derivability is the whole
  point of keeping it.
- **Promote it to a CI gate with a threshold.** Rejected twice, by two councils:
  it would recreate the coverage ratchet that this very measurement argued
  against, over a corpus where ~90% of rules would be in scope.

## References

- `src/scripts/measure_rule_absoluta.ts` — the census; run it to re-derive the table.
- `tests/scripts/measure_rule_absoluta.test.ts` — pins the lexicon-sensitivity and the documented false negative.
- `agents/roadmaps/archive/road-to-rule-coherence.md` § P2.1 — original claim plus correction block.
- `agents/evidence/analysis/rule-conflict-audit-2026-08-06.md` — the sibling one-time audit, same "run once, do not gate" posture.
