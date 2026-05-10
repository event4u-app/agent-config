---
name: customer-research
description: "Use when shaping a discovery slice — JTBD-framed interview guide, switch-event focus, verbatim quotes not summaries. Triggers on 'talk to users', 'why did they cancel', 'before we build X'."
status: active
tier: senior
source: package
domain: product
context_spine: [product]
---

# customer-research

## When to use

- A backlog item is fuzzy because no one has talked to a current user about the underlying job in the last quarter.
- A churn or refund spike needs a switch-event explanation, not a feature gap list.
- A product owner is about to write AC for a feature that has not been validated against a real user job.

Do NOT use for quantitative funnel diagnosis (see `funnel-analysis`),
RICE-style ranking (see `rice-prioritization`), or surveying at scale —
this skill is about depth-5-to-10 interviews, not statistics.

## Cognition cluster

- **Mental model 2 — Jobs-to-be-Done.** Frames every question against
  the **switch event**: what caused the user to fire the previous
  solution? See [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 2.
- **Mental model 3 — Pareto principle.** A research week that
  produces 12 distinct insights is usually re-discovering the same
  three. See `mental-models.md` § 3.

## Procedure

### Step 0: Frame the job

1. Write one sentence: *"Users hire \<thing\> to make progress in \<situation\>, when motivated by \<pressure\>, expecting \<outcome\>."* If you cannot finish the sentence, the discovery slice is not yet shaped — stop and route to `po-discovery`.
2. Read the **product** slot of the [context-spine](../../../docs/contracts/context-spine.md) (if the consumer project has filled it) for bounded scope. Skip if absent — note in the brief.
3. Identify **one** competing solution the user might fire. Multiple competitors per session blurs the switch event.

### Step 1: Recruit the right 5–8

1. Recruit **switchers** (joined in last 60 days) and **leavers**
   (cancelled in last 60 days). Long-tenure power-users go in a
   separate bucket — they explain habits, not jobs.
2. 5 minimum, 8 maximum. Saturation hits around 6 in a tightly
   scoped job — the Pareto cut. Beyond 8 is research theatre.
3. Avoid friends, employees, beta-program over-talkers — selection bias is the failure mode that survives the AC.

### Step 2: Run the interview

1. Open with the **switch event**: *"Walk me through the day you decided to start using \<product\>."* Time, place, trigger, alternative considered.
2. Past behaviour, not hypothetical. Replace *"would you use"* with *"the last time you needed X, what did you do?"*.
3. Capture **quotes**, not summaries. Verbatim quotes survive the AC; paraphrases get re-interpreted into pre-existing beliefs.
4. Listen for the **anxiety / habit** pair — what they feared in switching, what habit died.

### Step 3: Code the evidence

1. One quote per insight. Tag each with: switch-event, anxiety, habit, expected-outcome, unexpected-outcome.
2. An insight without a quote is a hypothesis, not a finding — mark it.
3. Frequency-rank by how many distinct interviewees touched the insight (≥ 3 is signal; 1 is anecdote).

### Step 4: Hand back

1. Produce the three artifacts (see `## Output`).
2. Hand the brief to the senior PO. Do **not** translate findings into AC inside this skill — that is `refine-ticket`'s job.

## Related Skills

**WHEN to use this**

- The unit of analysis is **a real user's switch event**.
- Discovery is fuzzy and the team is about to ship without validation.
- A retention or churn spike needs a narrative, not a metric.

**WHEN NOT to use this**

- Quantitative drop-off across stages — route to [`funnel-analysis`](../funnel-analysis/SKILL.md).
- Ranking competing initiatives — route to [`rice-prioritization`](../rice-prioritization/SKILL.md).
- Reframing a fuzzy product ask before any user contact — route to [`po-discovery`](../po-discovery/SKILL.md).
- AC sharpening on an already-validated ticket — route to [`refine-ticket`](../refine-ticket/SKILL.md).

## When the agent should load this

- "We need to talk to users before we build X."
- "Why are people churning at month 2?"
- "Run customer research on the new pricing tier."
- "I keep guessing what the user wants — let's actually ask."
- "Before refining this ticket, do we know the real job?"

## Output

1. **`research-brief.md`** — frame sentence, recruit criteria, target sample, JTBD focal job, list of competing solutions in scope. Pre-interview artifact.
2. **`evidence-log.md`** — one row per insight: quote · interviewee ID · tag (switch / anxiety / habit / outcome) · frequency. Sorted by frequency descending. Verbatim only.
3. **`switch-event-summary.md`** — narrative of the dominant switch event(s) the research surfaced, with ≥ 3 supporting quotes per claim. Hand-off artifact for [`refine-ticket`](../refine-ticket/SKILL.md) and the senior product owner persona (currently [`product-owner`](../../personas/product-owner.md); senior persona shipping in next plate).

## Gotcha

- Asking *"would you use"* contaminates the answer with politeness; ground every question in past behaviour.
- One articulate interviewee can swamp evidence-log. Frequency-rank by distinct people, not distinct quotes.
- Tagging too aggressively pre-interview hides surprise findings — leave room for `unexpected-outcome`.
- A research week without ≥ 3 disqualified hypotheses is suspect — research that confirms everything is research that asked nothing.

## Do NOT

- Do NOT translate findings into acceptance criteria inside this skill — hand off to `refine-ticket`.
- Do NOT recruit only happy users; switchers and leavers carry the switch-event signal, satisfied users do not.
- Do NOT skip the frame sentence. An unframed interview produces 50 quotes about 8 different jobs.

## Runnable example

Pricing-tier churn at month 2:

- Frame: *"Customers hire \<product\> to make progress in \<weekly reporting\>, motivated by \<board cadence\>, expecting \<one-click roll-up\>."*
- Recruit: 6 leavers (cancelled within 30 days of month 2), 2 switchers from competitor C.
- Interview: open with *"Walk me through the day you decided to cancel."* Capture verbatim.
- Output: `evidence-log.md` shows 5 of 8 cite the *manual export step* as the cancellation trigger — switch-event signal, ≥ 3 frequency. `switch-event-summary.md` recommends the senior PO scope a discovery slice on the export step, not the report itself.
