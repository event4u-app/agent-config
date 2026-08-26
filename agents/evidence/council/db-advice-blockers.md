<!-- evidence-type: analysis -->
# Council decision — two blockers on shipped database advice

**Date:** 2026-08-27 · **Members:** anthropic/claude-sonnet-4-5, openai/codex-default · **Rounds:** 2 · **Peer review:** blind · **Quorum:** 2/2, needed 1 — concluded · **Actual cost:** $0.0439

**Verdict: 2/2 convergent — A = (a), B = (a).** Both seats added the same two
refinements independently, and both are load-bearing rather than stylistic.

## Why this record exists rather than a link

Council artefacts under `agents/runtime/council/` are gitignored and auto-pruned
after the retention window, so a path to one is a reference that rots
(`no-roadmap-references`, council clause).

## Verdicts, verbatim

### anthropic/claude-sonnet-4-5

Matze, both decisions are answerable.

## My decisions

**A: a** (two-branch recovery contract)  
**B: a** (FK/uniqueness is the rule; row-count is exception)

---

## Analysis

### Decision A

**Agreement with prior reviewers:** Both chose (a), and both are right that option (b) creates advice with no compliant path for genuinely irreversible migrations. Reviewer B's guard is stronger than Reviewer A's: "executable plan" with validation criteria and ownership is testably rigorous, while "specific steps" is checkable but vaguer.

**Where I differ:** Neither reviewer makes explicit that the roll-forward plan must live **in the migration file itself, not in external docs**. This matters for auditability: if the plan is somewhere else, "we'll document it later" becomes possible. The diff that lands the migration must carry the plan.

**The sentence that holds the line:**  
"A migration lacking reversible `down()` must document in its file comments: (1) why reversal is impossible (with concrete evidence, not assumption), (2) the specific roll-forward recovery procedure including data source and validation steps, (3) the responsible recovery owner. Vague intent or absent detail is the violation."

This creates three substantive, reviewable requirements. All must be present in the migration file.

**Revisit-if:** A migration passes review with a roll-forward plan that cannot be executed as written, or where the "why impossible" rationale is later shown to have been false (e.g., data was recoverable but wasn't checked).

---

### Decision B

**Agreement with prior reviewers:** Both chose (a) and correctly identified that row count alone ignores access pattern. Reviewer B's "baseline with evidence-backed exception" framing is the right precedence. Reviewer A's point that constraints are "integrity first, performance second" is also correct and explanatory.

**Where I differ:** Neither reviewer makes the access-pattern axis **explicit in the revised text**. The current `:20` line can still be read mechanically ("< 1000 rows → no index") if the reader doesn't infer the access-pattern qualifier. The guideline should state it plainly.

**New point:** The phrase "small tables" itself is ambiguous. A 40-row dimension table joined in every report query and a 40-row config table read twice a week are both "small" but have entirely different indexing needs. The revision should replace "small" with "rarely accessed."

**Revised :20 line:**  
"Do not add non-constraint indexes to tables with < 1000 rows **that are rarely accessed**. Foreign-key and uniqueness constraint indexes are created regardless of table size, as they enforce data integrity. For frequently-accessed small tables, index based on observed query patterns, not row count."

**Revisit-if:** Engine-specific measurement shows that FK indexes on small, rarely-accessed tables cause material write or storage costs without supporting any actual queries or referential-integrity enforcement operations.

---

## Summary of differences from round 1

1. **A's guard must specify location:** In-file, not external docs.
2. **A's "impossible" claim must be evidenced:** Not assumed.
3. **B's access-pattern axis must be explicit:** Not left to inference.
4. **B's language should say "rarely accessed," not "small":** Size alone decides nothing.

Both (a) options are correct. The escape-hatch risk in A is real, but the three-part in-file requirement with evidence and ownership closes it. The row-count trap in B is real, but making FK/uniqueness the baseline and adding the access-pattern qualifier closes it.

### openai/codex-default

Matze, my assessment is **mixed but ultimately supportive of both recommendations**. Decision A is well-founded; Decision B reaches the right practical hierarchy but needs engine-neutral wording because the supplied rationale conflates constraints with indexes.

`A: a`

Adopt the two-branch contract. Its strongest argument is that option (b) creates an impossible compliance rule for genuinely irreversible changes, while option (c) knowingly ships contradictory gates. The counter-argument is decisive in shaping the text: merely naming a roll-forward plan is not enough, because a label can become boilerplate. The exception must require reviewable recovery mechanics before deployment.

**Escape-hatch guard:** “A migration may omit a restoring `down()` only when the migration records why restoration is impossible and includes, before deployment, an actionable roll-forward plan with ordered recovery steps, required recovery inputs, validation criteria, and a responsible owner.”

**Revisit A when:** migrations repeatedly pass review with roll-forward plans that cannot be executed or objectively validated.

`B: a`

Treat foreign-key columns and declared uniqueness as the baseline exceptions to the small-table heuristic; apply the heuristic only to optional performance indexes. The strongest argument is the adversarial fixture: row count cannot distinguish a 40-row relationship exercised millions of times from one barely used, so `<1000 rows` is incapable of governing relationship indexes by itself. The strongest counter-argument is that unconditional indexes can impose write and storage costs and may duplicate indexes supplied by the detected database design. Therefore, require the baseline unless schema inspection and workload evidence justify omission—without asserting how any particular engine implements constraints.

For the fixture: declare the required uniqueness constraint, index the child table’s foreign-key column, and evaluate other indexes from measured access patterns.

**Revisit B when:** engine inspection and workload measurements repeatedly show that the baseline creates redundant or materially harmful indexes without serving relevant access paths.

On the prior critiques:

- I agree with **Reviewer B** that A’s alternative branch needs operational evidence rather than a name, and with both reviewers that row count alone is an inadequate indexing axis.
- I disagree with **Reviewer A’s** statement that constraint indexes are “infrastructure for enforcement.” That is too broad and risks violating the engine-neutral constraint, particularly by treating uniqueness and foreign-key indexing as one mechanism.
- I also disagree with **Reviewer B’s** “evidence-backed exception” if it is read as allowing omission based only on anticipated costs. The evidence should include detected schema behavior and representative workload measurements.
- A refinement neither review makes explicit: B should separate three concepts in the corrected passage—declaring integrity constraints, indexing referencing foreign-key columns, and adding optional query-performance indexes. Combining them invites the same ambiguity the edit is meant to remove.

In short: choose **A(a)** with an auditable pre-deployment recovery standard, and **B(a)** as an engine-neutral baseline that clearly separates constraints from physical indexes.

## What was implemented, and where

### A — the recovery contract

| Refinement both seats required | Where it landed |
|---|---|
| The plan lives **in the migration file**, not in external docs | `src/skills/laravel-migration/SKILL.md` § The recovery contract |
| "Why restoration is impossible" carries **evidence**, not an assumption | same section, item 1 |
| **Ordered** steps, their inputs, and validation criteria | same section, item 2 |
| A named **responsible recovery owner** | same section, item 3 |
| Vague intent or missing detail is the violation | stated in as many words |

The guideline surface carries the identical obligation and points at the full
contract rather than restating a second version of it.

### B — the indexing section

| Refinement both seats required | Where it landed |
|---|---|
| Separate **three** concepts: declaring a constraint · indexing the referencing column · optional performance indexes | `docs/guidelines/php/database.md` § Indexing, opening list |
| The row-count guidance governs the third only | stated immediately after that list |
| "small" → "small **and rarely accessed**" | `### When NOT to add indexes` |
| Access pattern is explicit, not left to inference | the 40-row lookup vs 40-row config contrast |
| Engine-neutral: no claim about how an engine implements constraints | no engine named anywhere in the section |
| Omission needs inspected schema behaviour **plus** workload measurement, never an anticipated write cost | closing paragraph of the section |

## Revisit-if

**A** — a migration passes review with a roll-forward plan that cannot be
executed as written, or whose "why impossible" rationale is later shown false
(the data was recoverable and was never checked).

**B** — engine inspection plus workload measurement repeatedly shows the
baseline creating redundant or materially harmful indexes that serve no access
path.

## Delegation basis

Both blockers carried `Owner: maintainer`. The maintainer delegated
owner-reserved decisions for this autonomous drain run to the council. Neither
transition weakens a safety floor, creates an external or irreversible
commitment, or amends governance: both are reversible edits to advice inside
the authorised envelope (`decision-revisit-gate` § owner-reserved set).

**One caveat stated rather than buried:** decision A deletes a shipped `Do NOT`
line, so a consumer who read the old text will act on the new one. That is why
it was put to the council rather than authored — and why the replacement is
strictly more demanding on the branch a reader might treat as an escape hatch.
