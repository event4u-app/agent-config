---
model_tier: medium
name: alerting-doctrine
description: "Use when deciding what earns a page — the page, action and info classes stated provider-neutrally, and the rule that a page without an owner, a runbook and a first diagnostic step is malformed."
domain: devops
workspaces:
  - engineering
packs:
  - engineering-base
---

# alerting-doctrine

## When to use

Use when classifying an alert, reviewing an alert set, or deciding whether a
condition should wake a human. Provider-neutral: the classes below hold whichever
tool evaluates the rule.

Do NOT use when:
- Establishing which signals exist at all (use `logging-monitoring` first — you
  cannot alert on a signal the project does not have)
- Adjudicating a go/no-go verdict (use `operational-readiness`)
- Running an incident once it has started (use `incident-commander`)
- Building the dashboard the alert links to (use `dashboard-design`, `grafana`)

## The three classes

Every alert is exactly one of these. The class is decided by **what the recipient
must do**, never by how alarming the condition sounds.

| Class | Condition that earns it | Destination | Latency of response |
|---|---|---|---|
| `page` | A human must act **now** or the damage grows | Wakes a named human | Minutes |
| `action` | A human must act, but the next working day is soon enough | Ticket or queue | Hours to days |
| `info` | Nobody must act; it is context for when something else fires | Log, channel, dashboard | Never |

**What earns a `page`** — all three, as a condition rather than a preference:

1. **User-visible or irreversible.** Users are affected now, or damage
   accumulates while nobody looks (data loss, budget burn, a queue filling
   toward a ceiling).
2. **Actionable now.** A named human can do something about it at 3am. "The
   upstream provider is down" is not actionable unless failover is manual.
3. **Not self-clearing.** A condition that resolves itself before a human can
   log in is an `info` with a trend, not a page.

Fail any one → it is `action` or `info`.

**What a misclassification costs.** Too eager: alert fatigue, and the page that
mattered arrives in a stream of pages that did not. Fatigue is not an
inconvenience — it is the mechanism by which a real outage is missed, and it is
caused by pages that were never actionable. Too shy: the condition sits in a
channel nobody reads until a user reports it. The asymmetry is real but bounded
in both directions, which is why the three conditions above are stated as a test
and not as taste.

## A page is malformed without all three fields

```
A PAGE THAT CANNOT NAME AN OWNER, A RUNBOOK AND A FIRST DIAGNOSTIC STEP
IS A CONFIGURATION DEFECT, NOT A JUDGEMENT CALL.
```

| Field | What it must carry | Why it is mandatory |
|---|---|---|
| **owner** | A named human or an on-call rotation that resolves to one | An alert owned by "the team" is owned by nobody at 3am |
| **runbook** | A pointer to the procedure — see the contract below | Waking someone with no procedure transfers the whole diagnosis to the least-prepared moment |
| **first diagnostic step** | The single concrete first action | The most expensive minutes of an incident are the ones spent deciding where to look |

This is checkable from the alert definition alone, which is what makes it a
defect rather than an opinion. `action` and `info` alerts do not carry the
obligation — nobody is being woken.

## The runbook contract — deliberately lean

A runbook worth paging into carries five things. More than this and it rots
faster than the system changes; fewer and it is a link that wastes the minutes it
was supposed to save.

1. **What this alert means** — one sentence, in terms of user impact.
2. **First diagnostic step** — the one command, query or dashboard to open. The
   same value the alert definition carries, so the two cannot drift.
3. **The two or three most common causes**, each with how to confirm it.
4. **Mitigation vs fix** — how to stop the bleeding, marked separately from how
   to repair the cause. Under a page, mitigation is the goal.
5. **Escalation** — who is next, and the condition that triggers going to them.

Explicitly **not** in a runbook: architecture background, a full topology
diagram, anything the reader could get later. A runbook is read under time
pressure by someone who was asleep.

→ Once an incident is open, `incident-commander` owns the roles, the update
cadence and the post-mortem obligation. This skill stops at the moment the page
fires.

## Procedure: Classify and validate an alert

1. **Confirm the signal exists.** An alert on a signal `logging-monitoring`
   scored `unavailable` or `unknown` cannot fire meaningfully. Fix the signal
   first.
2. **Apply the three page conditions.** User-visible or irreversible, actionable
   now, not self-clearing. All three → `page`. Otherwise → `action` if a human
   must eventually act, else `info`.
3. **For a `page`, check the three mandatory fields.** Any missing → verdict
   `malformed-alert: missing-<field>`. Do not downgrade the class to dodge the
   obligation; a page whose fields cannot be named is either a defect to fix or
   was never a page.
4. **For a `page`, check the runbook against the five-item contract**, and
   confirm its first diagnostic step matches the alert's.
5. **Record the verdict per alert** — `valid-page-alert`, `valid-action-alert`,
   `valid-info-alert`, or `malformed-alert: <reason>`.

### Validate

- Verify every `page` names an owner resolving to a single human.
- Verify every `page` links a runbook that exists.
- Verify every `page` carries a first diagnostic step identical to its runbook's.
- Confirm no alert was reclassified downward purely to avoid the three fields.
- Confirm every alert's underlying signal is `present`, not `unknown`.
- Confirm the alert set contains no `page` that is self-clearing.

## Output format

1. One row per alert — name, class, verdict.
2. For each `malformed-alert`, the missing field named explicitly.
3. The pages, with owner, runbook pointer and first diagnostic step.

## Examples

Contract fixtures. Three pairs, one per mandatory field; each pair differs
**only** in the field under test, and each case states the verdict it must
produce. Contract evidence for review, not an executable suite.

### Missing owner — malformed vs clean

```yaml
# malformed
alert: checkout_error_rate_high
class: page
runbook: docs/runbooks/checkout-errors.md
first_diagnostic_step: "open the checkout error-rate panel, last 30m"
verdict: "malformed-alert: missing-owner"
```

```yaml
# clean — only the owner is added
alert: checkout_error_rate_high
class: page
owner: payments-on-call
runbook: docs/runbooks/checkout-errors.md
first_diagnostic_step: "open the checkout error-rate panel, last 30m"
verdict: valid-page-alert
```

### Missing runbook — malformed vs clean

```yaml
# malformed
alert: db_pool_saturation
class: page
owner: platform-on-call
first_diagnostic_step: "check db_pool_in_use / db_pool_size"
verdict: "malformed-alert: missing-runbook"
```

```yaml
# clean — only the runbook is added
alert: db_pool_saturation
class: page
owner: platform-on-call
runbook: docs/runbooks/db-pool.md
first_diagnostic_step: "check db_pool_in_use / db_pool_size"
verdict: valid-page-alert
```

### Missing first diagnostic step — malformed vs clean

```yaml
# malformed
alert: queue_wait_time_high
class: page
owner: platform-on-call
runbook: docs/runbooks/queue-wait.md
verdict: "malformed-alert: missing-diagnostic-step"
```

```yaml
# clean — only the first diagnostic step is added
alert: queue_wait_time_high
class: page
owner: platform-on-call
runbook: docs/runbooks/queue-wait.md
first_diagnostic_step: "open the queue wait-time panel; compare to enqueue rate"
verdict: valid-page-alert
```

## Gotcha

- Severity labels are not classes. `critical` in a tool's own vocabulary says
  nothing about whether a human must act now.
- A page nobody can action is the fastest route to ignoring all pages.
- Reclassifying a page to `action` because the owner is unknown hides the defect
  instead of fixing it.
- An alert on a threshold with `proposed` provenance is alerting on a guess —
  see `logging-monitoring`.
- Queue depth alerts fire late; queue wait time fires in time.

## Do NOT

- Do NOT ship a `page` without an owner, a runbook and a first diagnostic step.
- Do NOT page on a self-clearing condition.
- Do NOT page on a signal scored `unknown`.
- Do NOT put architecture background in a runbook — it is read under pressure.
- Do NOT let the alert's first diagnostic step and the runbook's disagree.

## Auto-trigger keywords

- alert
- alerting
- page
- on-call
- runbook
- alert fatigue
- what earns a page
