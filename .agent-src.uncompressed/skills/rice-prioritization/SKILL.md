---
name: rice-prioritization
description: "Use when ranking competing initiatives for a roadmap, breaking a tie between two features, or auditing a backlog for hidden low-value work via Reach × Impact × Confidence ÷ Effort."
status: active
tier: senior
source: package
domain: product
---

# rice-prioritization

## When to use

- A backlog has more candidates than capacity for the next quarter and someone has to pick.
- A PM and an engineering lead disagree on what ships first and need a shared framework.
- A draft roadmap reads like a wish list — no transparency on **why** these and not those.

Do NOT use for valuation, OKR decomposition, or funnel-stage diagnosis (see Related Skills).

## Procedure

### Step 0: Inspect

1. Confirm there are at least 5 candidates. RICE on 2 items is theatre; just argue the merits.
2. Confirm there is a shared definition of the **target user** for "Reach" — RICE breaks if two scorers count different populations.

### Step 1: Score Reach

1. Reach = number of users / events / requests **per fixed time window** (per quarter is the default).
2. Use absolute counts pulled from analytics or product DB, not percentages — percentages hide tiny denominators.
3. If the data isn't there, write the query you'd run and say so. Do not invent numbers.

### Step 2: Score Impact

1. Use the canonical 5-point scale: 0.25 (minimal) · 0.5 (low) · 1 (medium) · 2 (high) · 3 (massive).
2. Anchor each level with a concrete past shipped feature ("medium = like the search filter we shipped Q2"). Without anchors, scorers drift.
3. Impact is **per affected user**, not aggregate. Aggregate is what RICE produces, not what you input.

### Step 3: Score Confidence

1. Confidence is a **percentage** — 100 / 80 / 50 / "low and we should not score this yet".
2. Anything below 50 means: stop, do a spike or a research week, then re-score. RICE does not rescue ignorance.
3. Confidence multiplies — it is the model's discount for unknown unknowns.

### Step 4: Score Effort

1. Effort = person-months for the smallest viable shippable slice. Not the fantasy version.
2. Engineering owns this number. PMs scoring effort is the most common process failure.
3. Effort < 0.5 person-months almost always means scope is underestimated — surface and ask.

### Step 5: Compute and rank

1. RICE = `(Reach × Impact × Confidence) / Effort`.
2. Rank descending. The score is the artefact, not the answer — read the top 5 with a critical eye.
3. Anti-pattern: treating RICE rank as a contract. It is a structured argument, not a verdict.

### Step 6: Audit the bottom

1. Look at the bottom quartile. If a strategic must-have lives there, the model has a calibration error — usually Reach or Impact.
2. Look at the top item. If it is obviously absurd (e.g. one ad-hoc admin tool above a strategic platform play), the input scoring is uncalibrated.

## Gotcha

- Reach in percentages hides "this feature affects 100% of … 12 users."
- Impact inflation: every PM thinks every feature is a 2 or 3. Force at least 30% of items to score 0.5 or below.
- Confidence is the only multiplier that punishes uncertainty — do not let it default to 80 for everything.
- Effort discrepancy between PM and engineering on the same row is itself the signal — investigate, do not average.

## Do NOT

- Do NOT rank fewer than 5 candidates with RICE — overhead exceeds value.
- Do NOT mix strategic bets and BAU tickets in the same RICE table; their effort scales differ by 10×.
- Do NOT ship a roadmap that is exactly the RICE-sorted top-N — you need at least one strategic outlier with a written rationale.

## Related Skills

**WHEN to use this**

- Ranking is the actual question.
- The team needs a shared, auditable scoring frame.

**WHEN NOT to use this**

- Decomposing an objective into KRs — route to [`okr-tree-modeling`](../okr-tree-modeling/SKILL.md).
- Diagnosing why a funnel stage drops — route to [`funnel-analysis`](../funnel-analysis/SKILL.md).
- Modelling whether an investment is worth its capital cost — route to [`dcf-modeling`](../dcf-modeling/SKILL.md).
- CAC / LTV / payback questions — route to [`unit-economics-modeling`](../unit-economics-modeling/SKILL.md).

## When the agent should load this

- "Help me prioritize the backlog for Q3."
- "RICE-score these features."
- "Why is X above Y on the roadmap?"
- "We have 30 ideas and 6 engineers — what ships?"
- "Audit our roadmap for low-value work."

## Output

1. **`rice-table.md`** — markdown table: Item · Reach · Impact · Confidence · Effort · RICE · Owner · Notes. Sorted descending by RICE.
2. **`calibration-notes.md`** — one paragraph per anchor (what "Impact = 2" means with a named past feature) plus a list of items with confidence < 50 marked for spike-first.
3. **`top-5-critique.md`** — one paragraph per top-5 item: is the rank defensible, and what would change it.
