---
stability: beta
---

# Persona-Voice Rubric for `judge-*` Skills

> **Audience:** authors and reviewers of any future `judge-*`
> consolidation spike. Also loaded via `load_context:` by future
> `judge-*` slim shapes when an A-shape ships.

This rubric defines **what "persona voice" means** for the four
`judge-*` skills (`judge-bug-hunter`, `judge-code-quality`,
`judge-security-auditor`, `judge-test-coverage`) and **how to score
voice preservation** when comparing a slimmed (Option-A: separate skill
+ shared procedure context) output against the current single-file
baseline. The rubric is the measurement instrument behind the 3a.0.1
voice gate (≥ 4.0/5) and the 0.5 author + 2-reviewer protocol (avg ≥
3.5/5).

## The five dimensions

Each dimension scored independently on a 1–5 integer scale. Scorers
record one numeric score plus one short rationale per dimension.

### 1. Tone

The judge's posture toward the diff. Distinctive markers per persona:

| Skill | Tone marker |
|---|---|
| `judge-bug-hunter` | Skeptical, edge-case-first ("what input breaks this?") |
| `judge-code-quality` | Reformist, convention-bound ("this clashes with the codebase pattern at X") |
| `judge-security-auditor` | Adversarial, threat-modeling ("what would an attacker do here?") |
| `judge-test-coverage` | Falsification-first ("does this test fail without the fix?") |

Score 5 = posture indistinguishable from baseline. Score 1 = generic
"reviewer voice" with no persona signal.

### 2. Vocabulary

Domain-specific terms the persona reaches for unprompted. Captured by
keyword profile from the baseline SKILL.md (e.g., `judge-security-auditor`
uses *trust boundary*, *sink*, *SSRF*, *mass assignment*;
`judge-test-coverage` uses *uncovered branch*, *over-mocking*,
*regression test*, *tautological assertion*).

Score 5 = ≥ 80% of baseline keyword profile present in slimmed output
on a representative diff. Score 1 = < 20% present, or vocabulary leaks
in from a sibling persona (collision marker — see § 5 below).

### 3. Prompt-shape preservation

The structural skeleton of the output (Verdict, Issues, Severity,
Required fields). Must match the baseline `Output format` block
verbatim in field order, label spelling, and severity icon set.

Score 5 = byte-identical field structure (only finding content
differs). Score 3 = minor reorder, no missing fields. Score 1 = a
required field dropped, renamed, or merged.

### 4. Refusal patterns

How the judge handles out-of-scope concerns. Each `judge-*` baseline
explicitly **refuses** to comment on dimensions another judge owns
(e.g., `judge-test-coverage` refuses to flag correctness or style;
`judge-security-auditor` refuses to flag pure logic bugs).

Score 5 = refusal triggers fire on the same out-of-scope inputs as
baseline, with the same handoff phrasing ("route to `judge-X`"). Score
1 = persona accepts an out-of-scope finding silently (mode-collision
risk realized).

### 5. Evidence-citation style

How findings are anchored to the diff. Baselines all cite `path:LINE`
with a one-line reason and (where applicable) a "what the test should
assert" / "what the attacker would do" clause.

Score 5 = every finding has the same citation shape as baseline —
`path:LINE` plus the persona-specific clause (uncovered branch /
threat class / pattern violated / failing input). Score 1 = findings
are vague ("there's a problem in the validator") or use a sibling
persona's citation shape.

## Scoring template

For each scored output, fill out the matrix below — once per scorer
(author + 2 reviewers, see scoring protocol):

```
Skill under test:  judge-<persona>
Diff sample id:    <pr-number-or-fixture-id>
Baseline output:   <attached or hash>
Slimmed output:    <attached or hash>

| Dimension                  | Score (1–5) | Rationale (≤ 30 words)         |
|----------------------------|-------------|--------------------------------|
| 1. Tone                    |             |                                |
| 2. Vocabulary              |             |                                |
| 3. Prompt-shape preservation |           |                                |
| 4. Refusal patterns        |             |                                |
| 5. Evidence-citation style |             |                                |
| **Per-scorer mean**        |             | (sum / 5, one decimal)         |
```

## Acceptance arithmetic

Three independent scorers produce three per-scorer means. The 3a.0.1
gate fires on **two** thresholds simultaneously:

- **Aggregate mean** (all dimensions, all scorers) **≥ 3.5/5** —
  matches the 0.5.1 protocol.
- **Tone dimension specifically** mean **≥ 4.0/5** — matches the
  3a.0.1 voice-preservation kill-criterion. Tone is the load-bearing
  dimension; vocabulary, prompt-shape, and citation style mostly track
  it.

Either threshold missed → escalate to council per 0.5.1 (any
individual scorer < 3.0 also escalates). Council either revises the
slim shape (one rework only) or invokes the 3a.0.2 abort branch and
files `contexts/judges/no-consolidate-rationale.md`.

## What this rubric does NOT measure

- **Verdict parity** — covered separately by 3a.3 (cosine-token
  similarity ≤ 10% drift, 100% verdict parity).
- **Latency budget** — covered by 3a.0.1 (≤ +50ms vs. baseline).
- **Mode-collision proxy** — explicit security-only-diff probe under
  3a.0.1. Failure here aborts 3a regardless of voice score.
- **Implementation correctness** — judges read diffs, this rubric
  reads judges. The diff under test is a fixture, not the artefact
  graded.

## References

- [`docs/contracts/context-paths.md`](../../../docs/contracts/context-paths.md)
  — locked path tree (this file lives at `contexts/judges/`).
- [`docs/contracts/load-context-schema.md`](../../../docs/contracts/load-context-schema.md)
  — frontmatter contract for citing this rubric from a slimmed `judge-*`
  skill in Phase 3a.2.
