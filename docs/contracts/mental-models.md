---
stability: stable
---


# Mental Models — Top-30 Cross-Role Reference

> **Status:** active · **Stability:** stable · **Owner:** unified-senior-roles Block K4
> · **Hard cap:** 30 models · **R23 mitigation:** additions require removing one (zero-sum)

A ranked, citation-only reference. Senior skills cite a model by
its number when the cognition step it triggers needs framing prose
the skill would otherwise re-invent. The doc is not auto-loaded
and never appears in a prompt unless a skill names a row.

## How this list was built

Council iter-1 (Anthropic `claude-sonnet-4-5` + OpenAI `gpt-4o`,
2026-05-05) Q2 verdict: **Ranked Top-30**, cross-role bias.
Channel-specific (CAC/LTV-as-model, ad-auction, SEO keyword),
C-suite strategy (Blue Ocean, Porter's Five Forces), and sales
pipeline (BANT, MEDDIC) **explicitly cut** — they are domain
heuristics, not cross-role cognition tools. Additions require
removing one.

Each entry: title · domain · ≤ 8-line summary · one citation example
from a shipped skill (path is the proof of provenance, not a load
instruction).

## The 30 models

### 1. First-principles thinking

Strip the problem to assumptions you can defend from physics, contract,
or hard data. Re-derive the answer from those, not by analogy to past
decisions. The expensive part is identifying which "principle" is
actually load-bearing vs. inherited belief; the cheap part is the
re-derivation. Use when an inherited approach feels stale and you
suspect the real constraint moved.
*Cited by:* `.agent-src.uncompressed/skills/improve-before-implement/`
(challenges weak requirements before code is written).

### 2. Jobs-to-be-Done (JTBD)

A user "hires" a product to make progress in a specific situation;
the job is the situation × motivation × expected outcome, not the
demographic. The unit of analysis is the **switch event** — what
caused them to fire the previous solution. JTBD reframes feature
requests as evidence of an unmet job, not feature gaps.
*Cited by:* `.agent-src.uncompressed/skills/po-discovery/`
(reframes fuzzy product asks via job-shape).

### 3. Pareto principle (80/20)

Roughly 80% of effects come from 20% of causes. The lift is in
**identifying** the 20% — which user segment, which test failure,
which N+1 query — not in re-stating the ratio. Anti-pattern: using
80/20 as permission to ignore the long tail without measuring it.
*Cited by:* `.agent-src.uncompressed/skills/performance-analysis/`
(N+1 detection prioritizes the 20% of queries causing 80% of latency).

### 4. Second-order thinking

Ask "and then what?" until the chain breaks down. First-order picks
what looks best now; second-order weighs the consequences of the
consequences. Most "obvious" decisions die at second-order — the
optimization that ships now creates the maintenance debt that kills
velocity in 6 months.
*Cited by:* `.agent-src.uncompressed/skills/adversarial-review/`
(stress-tests a plan by walking past the immediate verdict).

### 5. Opportunity cost

The real cost of any choice is the **next-best alternative you did
not pick**, not the dollar / time spent. A 2-week feature is not
"2 weeks expensive" — it is the highest-value 2-week feature you
chose not to ship instead. Naming the alternative makes the cost
legible; pretending there isn't one is the failure mode.
*Cited by:* `.agent-src.uncompressed/skills/rice-prioritization/`
(scores compete for capacity; non-shipped items are the cost basis).

### 6. Theory of constraints

System throughput is bounded by exactly one constraint at a time.
Improving any non-constraint resource is local optimization with
zero system effect — usually negative, since it loads the actual
constraint harder. The discipline: identify, exploit, subordinate,
elevate, then find the next constraint.
*Cited by:* `.agent-src.uncompressed/skills/funnel-analysis/`
(identifies the single funnel stage that bounds conversion throughput).

### 7. MVP (Minimum Viable Product)

The smallest thing that produces real evidence about whether the
hypothesis holds. MVP is a **measurement instrument**, not a
junior-grade product. The trap is shipping an MVP that cannot
distinguish "user behavior validates the hypothesis" from "user
behavior was driven by something else"; that is just a small
product.
*Cited by:* `.agent-src.uncompressed/skills/po-discovery/`
(scopes a discovery slice that produces a learning, not a feature).

### 8. Build-Measure-Learn

A loop: build the smallest test, measure the actual signal, decide
to persevere or pivot. The skill is in **shortening the loop** —
weeks beat months because months let teams rationalize a failed
hypothesis. The loop is the artefact; any individual cycle is just
one iteration.
*Cited by:* `.agent-src.uncompressed/skills/test-driven-development/`
(the build-measure-learn loop applied to one function at a time).

### 9. Hypothesis-driven development

State the hypothesis as a falsifiable sentence with a metric and a
threshold **before** writing the code. "If we do X, metric Y will
move by Z." Without the threshold, the team will declare any
movement victory. With it, the team learns from the misses.
*Cited by:* `.agent-src.uncompressed/skills/project-analysis-hypothesis-driven/`
(competing hypotheses + validation loops + evidence-based conclusions).

### 10. Reversible vs. irreversible decisions

One-way doors deserve a high bar; two-way doors deserve a low bar
plus speed. The bias under uncertainty: shipping a reversible
decision early is almost always cheaper than the meeting required
to decide. The skill is recognizing irreversibility — usually data
shape, public API surface, or hiring.
*Cited by:* `.agent-src.uncompressed/skills/decision-record/`
(records the reversal-criteria so the irreversibility verdict is auditable).

### 11. DX as first-class concern

Developer experience is a leading indicator of throughput; it is not
a polish task. Slow tests, fragile local setup, and surprising tool
output compound — every developer pays the tax every day. Treat DX
issues like user-facing bugs, with severity and SLA. The compounding
math makes "fix it later" almost always wrong.
*Cited by:* `.agent-src.uncompressed/skills/test-performance/`
(test-suite latency is a developer-facing metric, optimized as such).

### 12. Conway's Law

The systems an organization builds mirror its communication structure.
Re-orgs propagate to architecture; architecture changes that fight the
org chart fail. The lever is bidirectional: pick the architecture you
want, then engineer the communication paths that produce it.
*Cited by:* `.agent-src.uncompressed/skills/api-design/`
(bounded-context choices follow team boundaries, not the other way around).

### 13. Occam's Razor

Among hypotheses that fit the evidence equally well, prefer the one
that introduces the fewest new entities. In debugging, the boring
explanation (typo, off-by-one, stale cache) is usually correct. The
trap is **assuming** instead of **falsifying** — Occam suggests
order of investigation, not a verdict.
*Cited by:* `.agent-src.uncompressed/skills/systematic-debugging/`
(reproduce → isolate → hypothesize, simplest hypothesis first).

### 14. Meadows leverage points

Donella Meadows' ranking: the highest-leverage interventions in a
system are paradigm shifts, then goals, then rules — far above
parameter tweaks. Most "improvement" effort fights parameters
(numbers, delays) at the bottom of the ranking. Climb the ranking
before optimizing.
*Cited by:* `.agent-src.uncompressed/skills/architecture-review-lens/`
(boundary / dependency-direction issues are higher-leverage than tweaks).

### 15. Signal vs. noise

Every metric is a sum of underlying signal and measurement noise.
A change of size N is meaningful only if N exceeds the noise floor
for that metric × that horizon. The discipline: estimate the noise
band first, then evaluate the change. Without the noise band, every
movement looks like a trend.
*Cited by:* `.agent-src.uncompressed/skills/funnel-analysis/`
(stage-to-stage drop is read against the typical week-on-week noise).

### 16. Leading vs. lagging indicators

Lagging indicators (revenue, churn, retention) are accurate and
late. Leading indicators (activation events, repeat-use, support
volume) are noisy and early. Operating on lagging alone means the
team learns about problems after they cost money. Pair them: lagging
is the score, leading is the steering wheel.
*Cited by:* `.agent-src.uncompressed/skills/dashboard-design/`
(RED / USE / Golden Signals split leading from lagging explicitly).

### 17. Churn as health metric

Retention curves expose what acquisition cannot: whether the product
delivers ongoing value. A flat retention tail means the product
works for the survivors; a sliding tail means the underlying job is
not getting done. Churn is upstream of CAC payback — fix it first,
then scale.
*Cited by:* `.agent-src.uncompressed/skills/funnel-analysis/`
(retention bend distinguishes activation problems from product-fit).

### 18. Pull vs. push systems

Pull systems start work when downstream capacity opens; push systems
start work when upstream capacity is free. Push optimizes individual
utilization, pull optimizes flow. Most software teams claim pull and
operate push (queues filling up, sprints overcommitted, WIP
unmanaged). The fix is WIP limits, not motivation.
*Cited by:* `.agent-src.uncompressed/skills/laravel-horizon/`
(queue-balance strategies are pull-vs-push policy in concrete form).

### 19. Shift-left

Move quality / security / accessibility checks earlier in the
lifecycle — to the developer's machine, the PR, the design — where
the cost of fixing is order-of-magnitude lower. The trade-off:
shift-left adds friction at the front; the math holds when defect
escape rate drops faster than the friction cost.
*Cited by:* `.agent-src.uncompressed/skills/threat-modeling/`
(threats enumerated before implementation, not after pen-test).

### 20. Latency vs. throughput

Optimizing one usually hurts the other; the trade-off is structural,
not implementation-detail. Batch processing trades latency for
throughput; real-time pipelines trade throughput for latency. The
mistake is optimizing without naming which one matters for the user
job at hand.
*Cited by:* `.agent-src.uncompressed/skills/database/`
(index strategy and query batching surface the trade-off explicitly).

### 21. Trust boundaries

Every system has explicit lines across which inputs cannot be
trusted: client → server, tenant A → tenant B, free tier → paid
tier, public endpoint → internal service. Threats enter at boundary
crossings; defense lives at the crossing, not deeper. Drawing the
boundary correctly is half the security work.
*Cited by:* `.agent-src.uncompressed/skills/threat-modeling/`
(produces trust boundaries + abuse cases mapped to files).

### 22. Defense in depth

No single control is sufficient; layer entry validation, business
rules, environment hardening, and instrumentation so a bypass at
one layer is caught at the next. The trap is mistaking redundancy
for security theatre — each layer must have an independent failure
mode, not a copy of the previous one.
*Cited by:* `.agent-src.uncompressed/skills/defense-in-depth/`
(turns local fix into structural one across four guard layers).

### 23. Blast radius

Before changing shared code, enumerate every call site, event
consumer, queue worker, API client, migration, and test that the
change touches. The radius is the work; the diff is the artefact.
Underestimating radius is the failure mode that breaks production
when the change "looked small".
*Cited by:* `.agent-src.uncompressed/skills/blast-radius-analyzer/`
(file:line citation per dependency, BEFORE the edit).

### 24. Iron triangle (scope / time / quality)

Scope, time, and quality are coupled — fix two, the third moves.
Pretending to fix all three is how teams ship at low quality and
call it on-time. The honest move is naming which two are fixed and
which one absorbs the variance, BEFORE the work starts.
*Cited by:* `.agent-src.uncompressed/skills/refine-ticket/`
(AC sharpening forces explicit scope decisions before estimation).

### 25. Definition of Done

A shared, auditable description of what "done" means for a unit of
work — tests, docs, deployment, comms. Without one, every team
member ships their personal threshold and disputes downstream. The
discipline is making it visible, agreed, and consistently applied —
not the specific items on it.
*Cited by:* `.agent-src.uncompressed/skills/verify-completion-evidence/`
(fresh evidence is required before any "done" claim).

### 26. Postmortem-driven learning

Incidents are signal-rich; the team that captures the signal beats
the team that hides the incident. Blameless postmortems separate
contribution from blame, surface systemic causes, and produce
mitigations that reduce future incident rate — not just the count
of one-off fixes.
*Cited by:* `.agent-src.uncompressed/skills/incident-commander/`
(severity framing + comms cadence + post-mortem skeleton).

### 27. Tech debt as interest

Tech debt has a principal (the shortcut taken) and an interest
payment (the ongoing tax on velocity). Carrying the debt is the
right call when the principal is repayable and the interest is
small; the failure is treating ongoing high-interest debt as a
fixed cost. Track it like a balance sheet.
*Cited by:* `.agent-src.uncompressed/skills/tech-debt-tracker/`
(interest-vs-principal framing, prioritisation by carrying cost).

### 28. Mise en place

Prepare every input — data, fixtures, dependencies, decisions —
before the cooking step starts. Switching between prep and cook is
where errors enter. In software, the analogue is staged commits,
prepared test fixtures, and decisions locked before implementation.
The discipline is the savings, not the metaphor.
*Cited by:* `.agent-src.uncompressed/skills/existing-ui-audit/`
(inventory before any non-trivial UI edit, hard gate).

### 29. Premortem

Before kickoff, assume the project failed and ask why — names the
risks the team already knows but has not voiced. The trick is the
past-tense framing; "what could go wrong" surfaces less than "it
failed, what happened". Cheap; high signal-to-noise; the residual
output is a risk register the team actually defends.
*Cited by:* `.agent-src.uncompressed/skills/risk-officer/`
(blast-radius framing, mitigations, residual-risk verdict pre-commit).

### 30. Inversion

Instead of asking "how do I succeed at X?", ask "how would I
guarantee failure at X?" — then avoid that. Inversion exposes the
non-obvious failure modes that direct planning misses, especially
in security, ops, and people problems where the failure surface is
larger than the success surface.
*Cited by:* `.agent-src.uncompressed/skills/adversarial-review/`
(devil's-advocate stress-test poking holes in a plan).

## Adding or removing a model

Hard cap is 30. Adding a 31st requires removing one and naming the
swap in the PR description — the council verdict (R23) is that the
list earns its weight only if every entry is load-bearing. Removal
criteria: ≤ 1 citation across the catalog after one minor release,
or superseded by a more general entry.
