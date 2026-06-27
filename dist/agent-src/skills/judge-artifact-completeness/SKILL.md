---
model_tier: high
name: judge-artifact-completeness
description: "Use when scoring a roadmap, PR review, ADR, or ticket for completeness — risk, tests, migration, maintainability. Dispatched by /refine-ticket, /adr-create, /review-changes; never auto-gates."
domain: quality
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# judge-artifact-completeness

> Judge specialized in **artifact completeness**. Score non-code deliverables — roadmap, PR review, ADR, ticket — against a rubric and surface missing/partial dimensions. Does **not** judge code quality, bugs, or security. Never auto-gates: score + gaps → human decides.

## When to use

* Roadmap produced — score completeness against AC, risk, migration surface.
* PR review complete — check evidence quality + test coverage.
* ADR drafted — alternatives / consequences / reversibility completeness pass.
* Ticket exits refinement — DoR readiness check.
* `/refine-ticket`, `/adr-create`, `/roadmap:create`, `/review-changes` surface score as optional output pass.

Do NOT use when:

* Code quality / naming / DRY → [`judge-code-quality`](../judge-code-quality/SKILL.md)
* Functional bug → [`judge-bug-hunter`](../judge-bug-hunter/SKILL.md)
* Missing test files → [`judge-test-coverage`](../judge-test-coverage/SKILL.md)
* Security issue → [`judge-security-auditor`](../judge-security-auditor/SKILL.md)

## Procedure

### 1. Identify artifact type

| Artifact | Rubric schema |
|---|---|
| Roadmap / plan | `rubrics/roadmap-score.json` |
| PR review / code-review comment | `rubrics/pr-review-score.json` |
| ADR / architecture decision | `rubrics/architecture-score.json` |
| Jira / Linear ticket | `rubrics/ticket-quality-score.json` |

Ambiguous type → one question before scoring.

### 2. Score each dimension

* **0** — absent. Criterion not addressed.
* **1** — partial. Mentioned but too vague to be actionable (e.g., "risks exist" without naming one).
* **weight** — fully present. Criterion met concretely and traceably.

Use only `criterion` field. Do not penalise for style or length. Short artifact covering all dimensions scores same as long one — completeness ≠ verbosity.

Mark **N/A** (full credit) only when rubric schema explicitly allows it.

### 3. Compute verdict

```
total_earned   = sum of all dimension scores (N/A = weight)
total_possible = sum of all dimension weights
ratio          = total_earned / total_possible
```

| Ratio | Verdict |
|---|---|
| ≥ 0.80 | `complete` |
| ≥ 0.50 | `partial` |
| < 0.50 | `incomplete` |

### 4. Surface gaps

Top 1–3 gaps — dimensions with score = 0 or 1, highest weight. Gap entry names dimension + specific unmet criterion.

## Validation

Before finalising:

1. Every scored dimension maps to rubric schema field.
2. No dimension penalised for length or word count.
3. N/A credit granted only where schema allows.
4. Verdict follows ratio thresholds, not intuition.
5. Top gaps = highest-weight missing — not every minor gap.

## Output format

```
Judge:   judge-artifact-completeness
Type:    roadmap | pr-review | architecture | ticket
Target:  <one-line artifact description>
Verdict: complete | partial | incomplete
Score:   <earned>/<possible> (<pct>%)

Dimensions:
  ✅  <dimension-name> (<earned>/<weight>) — <one-line note, or "meets criterion">
  ⚠️  <dimension-name> (<earned>/<weight>) — PARTIAL: <specific gap>
  ❌  <dimension-name> (0/<weight>)        — MISSING: <what would satisfy the criterion>

Top gaps:
  1. <highest-weight missing dimension>: <concrete action to close the gap>
  2. ...
```

Required fields (ordered):

1. **Judge**, **Type**, **Target** — identification
2. **Verdict** — `complete`, `partial`, or `incomplete`
3. **Score** — raw earned/possible and percentage
4. **Dimensions** — one line per dimension with emoji + score + note
5. **Top gaps** — highest-weight missing with concrete close action

Output surfaced as recommendation. Human decides whether to act on gaps.

## Gotcha

* **Length ≠ completeness** — terse complete roadmap scores same as long one.
* **N/A abuse** — `migration_effort` is only N/A when no public-interface change. Mark 1 (partial) when unsure.
* **Partial credit creep** — "mentioned but vague" = partial (1), not full credit. "Risks exist" without naming one = partial.
* **Verdict as gate** — recommendation, never blocker. Surface it; human decides.

## Do NOT

* NEVER penalise artifact for being short or concise
* NEVER grant full credit to vague mention — that is partial (1)
* NEVER auto-reject or auto-approve based on verdict alone
* NEVER score code quality, correctness, or security — out of scope
* NEVER invent dimensions not in rubric schema

## Calibration

Fixtures: `calibration/fixtures.json`. Rubric designed monotone: removing a fully-present dimension lowers score by at least `dimension.weight`. No single dimension dominates (max weight = 3; total possible = 12–15 per rubric).

Anti-length: fixtures include `SHORT_COMPLETE` (short, all dimensions) and `LONG_INCOMPLETE` (verbose, missing high-weight dimensions). Correct judge scores `SHORT_COMPLETE` > `LONG_INCOMPLETE`.

## References

- Sibling judges: [`judge-code-quality`](../judge-code-quality/SKILL.md), [`judge-bug-hunter`](../judge-bug-hunter/SKILL.md), [`judge-security-auditor`](../judge-security-auditor/SKILL.md), [`judge-test-coverage`](../judge-test-coverage/SKILL.md).
- Dispatchers: [`/refine-ticket`](../../commands/refine-ticket.md), [`/adr-create`](../../commands/adr-create.md), [`/review-changes`](../../commands/review-changes.md).
- Rubric schemas: `rubrics/roadmap-score.json`, `rubrics/pr-review-score.json`, `rubrics/architecture-score.json`, `rubrics/ticket-quality-score.json`.
