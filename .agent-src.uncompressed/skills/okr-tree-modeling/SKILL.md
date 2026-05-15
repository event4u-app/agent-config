---
name: okr-tree-modeling
description: "Use when decomposing a company objective into team OKRs, auditing a draft OKR tree, or stress-testing an existing one for measurability and laddering."
status: active
tier: senior
source: package
domain: product
recommended_for_user_types: [founder]

---

# okr-tree-modeling

## When to use

- A leadership team wrote a quarterly objective and needs three measurable KRs that actually move it.
- A draft OKR tree needs review for orphan KRs, vanity metrics, or KRs that ladder to two parents.
- A team-level OKR set needs to be checked against the company objective it claims to serve.

Do NOT use for ranking competing initiatives within one OKR — that's prioritization, not decomposition (route elsewhere — see Related Skills).

## Procedure

### Step 0: Inspect

1. Identify the cognition cluster. OKR-as-strategy lives near the CEO/COO; OKR-as-PM-tool lives near the head of product. The decomposition mechanic is the same; the ladder-up target differs.
2. Confirm timeframe (quarter / half / year) — KR cadence depends on it.

### Step 1: Lock the parent objective

1. Restate the parent in one sentence with **a verb of change** (grow, reduce, ship, win) and an outcome — not an output.
2. Bad: "Improve onboarding." Good: "Reduce time-to-first-value for new accounts to under 7 days."
3. If the parent has no verb of change or no outcome, the tree is built on sand. Stop and rewrite the parent.

### Step 2: Decompose into 3 KRs

1. Each KR must satisfy four tests: (a) measurable end-state, (b) the team owns the lever, (c) achievable iff the parent is achieved, (d) failing it should be visibly bad.
2. Three is the floor and the ceiling. One KR makes the objective brittle; five dilutes ownership.
3. Anti-pattern: "ship X feature" as a KR. Shipping is an output. The KR is what changes when the feature lands.

### Step 3: Cascade to team-level

1. For each company KR, define 2–3 team-level KRs that, taken together, achieve the parent KR — not duplicate it.
2. Anti-pattern: copy-paste the parent KR with a smaller number ("60% of company KR is 30% for our team"). Real cascades change shape — input metrics for some teams, leading indicators for others.
3. Mark each team KR as **trailing** (lagging outcome — revenue, retention) or **leading** (input the team controls — activation rate, response time). A tree that is all-trailing is unactionable.

### Step 4: Cadence + check-ins

1. Weekly check-in: leading KRs only. Trailing KRs are reviewed monthly.
2. End of period: confidence score (0.0–1.0) per KR, written 3× across the period to surface drift.

### Step 5: Validate

1. Walk the tree top-down: does every leaf KR ladder cleanly to exactly one parent KR?
2. Walk it bottom-up: if every team hits 0.7 confidence, does the company objective land?
3. Count vanity metrics — KRs that move but don't matter. If more than zero, rewrite.

## Gotcha

- "100% of teams adopt X" is a participation metric, not an outcome KR. The model loves to write these.
- A KR owned by two teams is owned by no team. Single accountability is non-negotiable.
- Stretch goals that nobody believes are achievable produce sandbagging on the OKR after, not stretch.
- "Customer happiness" + NPS is a sentiment proxy, not an outcome metric. Tie KRs to behavior (renewal, expansion, usage), not feeling.

## Do NOT

- Do NOT write more than 3 KRs per objective — focus is the entire point.
- Do NOT use "achieve $X revenue" as a KR for a team that doesn't own pricing or pipeline; that's setting them up to fail blameably.
- Do NOT cascade by simple percentage allocation — different teams contribute different mechanisms, not different fractions.

## Related Skills

**WHEN to use this**

- The ask is decomposition of an objective into measurable KRs.
- A draft OKR tree needs structural review (cascade integrity, leading/trailing balance).

**WHEN NOT to use this**

- Prioritization of competing features inside one KR — route to [`rice-prioritization`](../rice-prioritization/SKILL.md).
- Conversion-rate diagnosis on a funnel KR — route to [`funnel-analysis`](../funnel-analysis/SKILL.md).
- Valuation-impact modeling of strategic objectives — route to [`dcf-modeling`](../dcf-modeling/SKILL.md).

## When the agent should load this

- "Help me write OKRs for next quarter."
- "Review this OKR tree — does it ladder up?"
- "What KRs would actually move our retention objective?"
- "Are these team OKRs measurable?"
- "We have 8 KRs per team — too many?"

## Output

1. **`okr-tree.md`** — markdown tree: company objective → 3 company KRs → 2–3 team KRs each. Each leaf carries owner, measure, target, trailing/leading tag, check-in cadence.
2. **`cascade-audit.md`** — orphans (KRs with no parent), oversubscribed parents (KR with >3 children), vanity metrics flagged with a one-line replacement suggestion.
3. **`confidence-template.md`** — empty 3-column table (start / mid / end) per KR, ready for the period's confidence updates.
