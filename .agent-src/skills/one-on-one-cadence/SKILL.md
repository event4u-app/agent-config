---
name: one-on-one-cadence
description: "Use when designing engineering 1:1s — cadence, agenda mix, growth-vs-blocker-vs-trust shape, cancellation anti-patterns. Triggers on 'fix my 1:1s', 'should I cancel 1:1s this week'."
status: active
tier: senior
source: package
domain: process
context_spine: [org-stage, product, customer-segment]
workspaces:
  - ops
packs:
  - ops-people
lifecycle: active
trust:
  level: professional
  confidence: high
  human_review_required: false
install:
  default: true
  removable: true
---

# one-on-one-cadence

## When to use

- An engineering manager is setting up 1:1s with their team for the first time, or after a reorg / role change, and the question is *cadence, length, and agenda shape*.
- 1:1s exist but are degrading — getting cancelled, devolving into status updates, becoming uncomfortable — and the question is *what's broken and how to repair*.
- A team is scaling and 1:1 capacity is starting to bind (skip-levels, growing reports) and the question is *what to keep, what to delegate, what to drop*.

Do NOT use this for non-engineering teams as the primary lens (Q4 `perf-feedback-craft` is the generalist surface; this skill specializes for the engineering context per the EM persona), as a comp-decision channel (route to Q2 `comp-banding`), or for 1:1-tooling-platform configuration.

## Cognition cluster

- **Mental model 1 — First principles.** Strip the 1:1 to: *what conversation can only happen between this manager and this report, that wouldn't happen anywhere else?* If the answer is "status that fits in standup", the 1:1 is mis-shaped. See [`mental-models.md`](../../../docs/contracts/mental-models.md) § 1.
- **Mental model 21 — Second-order thinking.** A cancelled 1:1 signals more than a missed conversation. Two consecutive cancellations from the manager side recalibrate the report's read of priority for months. Cancellation has compounding cost; protect the slot.
- **Mental model 28 — Inversion.** *"What 1:1 shape would make this report stop bringing up real problems?"* — usually: pure status-update format, manager-talks-most, no growth dimension, recurring cancellation, public location. Inversion surfaces the 5 canonical failure modes.
- **Mental model — Theory of constraints.** In a manager's week, 1:1 time is the binding constraint on people-leverage. Reducing per-1:1 time below 30 minutes for direct reports usually starves the channel; protecting 30–45 minutes weekly is the canonical default.
- **Context-spine — org-stage + product + customer-segment.** Read **org-stage** for what 1:1 infrastructure exists (10-person co: 1:1 is core; 50-person: standard; 150+: skip-levels matter). Read **product** for what topics surface (deep-tech = more growth; high-velocity = more blocker). Read **customer-segment** for stakeholder-load shape (enterprise = stakeholder management surfaces in 1:1s).

## Cross-wing handoff

- Specializes Q4 `perf-feedback-craft` for engineering-team context — Q4 is the generalist cognition, S1 is the eng-context channel.
- Composes Q3 `onboarding-program` at the 30 / 60 / 90 day milestones for new eng hires.
- Hands off to Q2 `comp-banding` when scope-growth conversations surface in 1:1s and need a comp-cycle decision.
- Owned by T4 `engineering-manager` persona; cited by T3 `people-strategist`.

## Procedure

### Step 0: Diagnose 1:1 intent per report

Before locking cadence, name the dominant mode for each report:

1. **New hire (first 90 days)** — orientation, decide-alone boundaries, early-win pathway. Weekly, 30–45 min, manager-prep heavier early.
2. **Tenured IC, steady-state** — growth, blockers, trust-banking. Weekly or biweekly, 30 min, report-prep dominates.
3. **Tenured IC, high-stakes / scope growth** — growth conversations, scope-shaping. Weekly, 45 min, growth dimension explicit.
4. **Senior IC / staff** — strategy alignment, peer-org navigation, multipliers conversations. Weekly or biweekly, 45 min, manager listens more than directs.
5. **Manager-of-managers report** — leadership patterns, team health, cross-org issues. Weekly, 45–60 min, more system-shaped than person-shaped.

Same cadence for every report = mis-shaped channel. Different modes need different shapes.

### Step 1: Set cadence and length

Defaults by report type:

1. **Weekly 30 min** — most ICs, steady state.
2. **Weekly 45 min** — new hires, scope-growth ICs, senior IC, manager-reports.
3. **Biweekly 45 min** — tenured ICs with stable scope; valid only when the report explicitly prefers it and the manager has high context.
4. **Monthly 60 min** — skip-levels (one-level-down reports).

Going below weekly without explicit report buy-in usually starves the channel. Going above weekly usually inflates manager load without proportional return.

### Step 2: Shape the agenda mix

Four canonical 1:1 dimensions; the mix shifts per report and per quarter:

1. **Blocker** — what's in the way this week. Useful but should not dominate — pure blocker focus reduces to status update.
2. **Growth** — what's the next rung; what scope / skill is being built. The most-skipped dimension; biggest leverage point.
3. **Trust / relationship** — informal check-in, signal that the manager sees the human. Skipping for too long correlates with surprise departures.
4. **Feedback (composes Q4)** — both directions; the 1:1 is the canonical feedback channel.

Target mix for tenured IC: 30% blocker, 30% growth, 20% trust, 20% feedback. Heavy skew to blocker = mis-shaped.

### Step 3: Set the agenda ownership rule

Pick one explicit shape:

1. **Report-owns** *(default for tenured IC)* — report sets the agenda in a shared doc before the 1:1; manager adds items but does not dominate.
2. **Manager-prep heavier** *(default for new hires, first 90 days)* — manager prepares orientation prompts, decide-alone exploration, early-win check-in.
3. **Alternating** — odd weeks report-owns, even weeks manager-prep; rare, only when the manager has a specific reason.

Manager-dominated agenda for tenured ICs is a canonical anti-pattern; it converts the 1:1 from peer-shape to status-meeting.

### Step 4: Cancellation policy

Three rules:

1. **Two-cancel rule** — two consecutive cancellations on the manager side triggers an explicit conversation about whether the cadence or relationship needs reshaping. Cancellation is the loudest signal in the 1:1 channel.
2. **Replace, not skip** — if a slot truly can't happen, replace within the week, not skip entirely. Skip = signal that 1:1 isn't real.
3. **Report-side cancel** — different signal; usually means topic is exhausted or there's a relationship issue. Worth a check-in conversation if it happens twice consecutively.

A 1:1 cadence with regular cancellation is theatre.

### Step 5: Validate the 1:1 design before rolling out

Before formalising the cadence, inspect three things:

1. **Per-report shape diagnosis** — confirm Step 0 named the mode per report; one-shape-for-all reports fails the check and must be re-run.
2. **Growth dimension present** — assert Step 2's target mix has growth ≥ 20% for tenured ICs; growth-starved 1:1s are the canonical mis-shape and must be re-balanced before rolling out.
3. **Capacity check** — verify total 1:1 hours fit the manager's week with focus-time and meeting-load room; a cadence that doesn't fit capacity collapses within 6 weeks.

All three must pass. If any fails, return to the failing step.

### Step 6: Emit the 1:1 cadence design

Produce the cadence artifact for the manager: per-report cadence + length + agenda-ownership + dimension mix. For diagnostic use, also produce a cancellation log review and the gap-vs-target read.

## Related Skills

**WHEN to use this**

- New EM setting up 1:1s for their team.
- Existing 1:1s degrading (cancellations, status-creep, growth-starved).
- Scaling EM with skip-levels emerging.
- Post-reorg 1:1 re-design.

**WHEN NOT to use this**

- Non-engineering teams as primary lens — route to [`perf-feedback-craft`](../perf-feedback-craft/SKILL.md) (Q4) which is the generalist surface.
- Comp decisions surfacing in 1:1s — route to [`comp-banding`](../comp-banding/SKILL.md) (Q2).
- Hiring-loop / calibration — route to [`hiring-loop-design`](../hiring-loop-design/SKILL.md) (S2).
- Team-velocity / throughput-vs-burnout conversations — route to [`throughput-vs-morale-tradeoff`](../throughput-vs-morale-tradeoff/SKILL.md) (S3).

## When the agent should load this

- "Fix my 1:1s."
- "Should I cancel 1:1s this week?"
- "How long / how often for senior eng 1:1s?"
- "My 1:1s have become status updates."
- "Wie strukturiere ich meine 1:1s?"

## Output

1. **`per-report-mode.md`** — diagnosed 1:1 mode per direct report (new hire / tenured / scope-growth / senior IC / mgr-of-mgrs).
2. **`cadence-and-length.md`** — weekly vs biweekly × 30 vs 45 vs 60 min per report.
3. **`agenda-mix.md`** — blocker / growth / trust / feedback target mix × ownership rule.
4. **`cancellation-policy.md`** — two-cancel rule + replace-not-skip + report-side signal handling.
5. **`capacity-check.md`** *(manager-side)* — total 1:1 hours / week vs focus-time and meeting-load remaining.

## Gotcha

- "Skip this week, busy" is the most damaging 1:1 sentence in the manager's vocabulary. Replace, don't skip.
- Pure blocker focus is the canonical degradation; growth gets starved silently for months.
- Same cadence and agenda for every report = mis-shaped channel. Different reports need different shapes.
- Skip-levels are not optional past ~15 reports; they are the only way to keep skip-level signal flowing without overloading direct managers.

## Do NOT

- Do NOT default every report to the same shape; one-size-fits-all 1:1s collapse the growth dimension.
- Do NOT cancel two consecutive 1:1s without an explicit conversation; the report's read of priority recalibrates in ways that are hard to repair.
- Do NOT confuse this with feedback-craft (Q4); Q4 is what's said, S1 is when and how often.

## Runnable example

Mid-stage EM, 6 direct reports (2 new hires in months 1–2, 3 tenured ICs, 1 senior staff eng), 1:1s have devolved into status updates.

- Step 0 — Per-report diagnosis: 2 new hires = onboarding mode; 2 tenured = steady-state; 1 tenured = scope-growth mode (taking on first lead role); 1 senior staff = strategy alignment mode.
- Step 1 — Cadence: weekly 45 min for new hires + scope-growth IC + senior staff; weekly 30 min for steady-state ICs. Total: 4 × 45 + 2 × 30 = 4 hours / week (within capacity).
- Step 2 — Mix re-design: current is 80% blocker. Target for steady-state ICs = 30/30/20/20. New hires = 50% onboarding-specific (decide-alone + early-win), 30% growth, 20% trust. Senior staff = 40% strategy, 40% growth, 20% trust.
- Step 3 — Ownership: report-owns for all 4 tenured; manager-prep heavier for the 2 new hires.
- Step 4 — Cancellation policy locked: two-cancel rule + replace-not-skip; explicit prior pattern (3 cancels in last quarter on the steady-state ICs' slots) acknowledged in the next 1:1.
- Step 5 — Validate: per-report shape diagnosed; growth dimension restored to ≥ 20% (was ~0); capacity fits in 4 hrs / week with room for skip-levels at monthly cadence. Pass.
- Step 6 — Emit cadence redesign + share with reports + name the change ("we've been status-heavy; here's what I'd like to shift") in next 1:1 round.
