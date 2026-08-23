---
model_tier: medium
name: logging-monitoring
description: "Use when establishing what observability a project actually has — the four Golden Signals, required signal to detected implementation to evidence, and SLI/SLO provenance."
domain: devops
workspaces:
  - engineering
packs:
  - engineering-base
---

# logging-monitoring

## When to use

Use when answering **"what does this project actually have"** for observability:
which required signal exists, what implements it, and what evidence says so. Also
when adding logging or wiring a monitoring stack — but the posture question comes
first, because you cannot add the missing signal until you know which one is
missing.

Do NOT use when:
- Classifying an alert or writing a runbook (use `alerting-doctrine`)
- Adjudicating a go/no-go readiness verdict (use `operational-readiness`)
- Creating Grafana dashboards or queries (use `grafana`)
- Dashboard layout and visualization decisions (use `dashboard-design`)
- Hardening the host itself (use `server-hardening`)

## Golden Signals

Four signals. The family is named in many places; these are the definitions.
A posture report covers all four or records why it cannot — never four minus the
inconvenient ones.

### Golden Signal: Latency

**Measures** how long a served request takes, split by outcome — successful and
failed latency are different distributions, and averaging them hides both. Read
it as percentiles (p50 / p95 / p99), never as a mean.

**A missing one costs** the ability to see degradation that is not yet an outage.
The system is up, users are leaving, and every error-rate panel is green.

**Typical detection paths** — APM transaction traces, a request-duration
histogram, reverse-proxy or load-balancer access logs, a middleware timer.

### Golden Signal: Traffic

**Measures** demand on the system — requests per second, jobs enqueued, messages
consumed, active sessions. The denominator every other signal needs.

**A missing one costs** all interpretation of the other three. Errors doubling is
meaningless without knowing whether traffic doubled; a quiet incident and a quiet
Sunday are indistinguishable.

**Typical detection paths** — a request counter, access-log volume, queue depth
and enqueue rate, a CDN or gateway request metric.

### Golden Signal: Errors

**Measures** the rate of requests that failed — explicitly (a 5xx, a raised
exception, a dead-lettered job) or implicitly (a 200 carrying a wrong body, a
policy-violating success). Rate, not count.

**A missing one costs** the ability to distinguish a broken deploy from a slow
one, and it is the signal most often mistaken for complete because an
error-tracking SDK is installed. An exception tracker is not an error rate: it
sees raised exceptions, not handled failures or wrong answers.

**Typical detection paths** — error-tracking SDK events, HTTP status
distribution, dead-letter queue depth, log-level counts at `error` and above.

### Golden Signal: Saturation

**Measures** how full the constrained resource is — the one that runs out first.
Connection pool, worker slots, disk, memory, file descriptors, a third-party
rate-limit budget. Expressed against its ceiling, which means the ceiling has to
be known.

**A missing one costs** every early warning. Saturation is the only one of the
four that is predictive: latency, traffic and errors report what already
happened, saturation reports what is about to. It is also the signal most often
absent entirely — see `scale-discipline` R-A12, which asks the finite-resource
question at review time.

**Typical detection paths** — pool-utilisation gauges, queue wait time (not
depth), host memory and disk metrics, rate-limit headers from an upstream
provider.

## Evidence states — a threshold carries its provenance

A number in a posture report is only as good as where it came from, and the
failure this prevents is an agent-suggested SLO becoming a commitment nobody
made. Provenance is part of the value, not a footnote.

| Provenance | Meaning | May be rendered as operational |
|---|---|---|
| `measured` | Observed in running telemetry | Yes |
| `committed` | Stated in a doc, contract or SLA, not yet verified | Yes, marked unverified |
| `proposed` | The agent suggested it | **Never** |
| `unknown` | Inspection could not establish a result | **Never** |

A `proposed` threshold stays `proposed` through every rendering. There is no
promotion path — not "it looks right", not "the user did not object". Promotion
requires a measurement or a stated commitment, which changes the provenance
first and the rendering second.

Two absences that are not the same thing, and collapsing them is how a gap
becomes invisible:

- **`unavailable`** — affirmatively established that the project cannot supply
  this signal. Requires a **non-empty reason**. A recorded null.
- **`unknown`** — nobody looked, or the look was inconclusive. Never counts as
  compliant, never counts as green, and is not a null — it is unfinished work.

Reported signal count equals four minus the recorded `unavailable` nulls.
`unknown` reduces nothing; it is an open question.

## Procedure: Establish the observability posture

1. **Take the four signals as the requirement.** Latency, traffic, errors,
   saturation. The list does not shrink to what the project happens to have.
2. **Detect what implements each one.** Read the project rather than assuming a
   stack: the logging config (`config/logging.php` in Laravel, `LOGGING` in
   Django, `winston`/`pino` config in Node, `config/environments` in Rails),
   then the metrics and APM wiring, then the dashboards and alert rules that
   already exist. An installed SDK is evidence of a *capability*, never of a
   *signal* — a Sentry integration does not give you latency percentiles.
3. **Attach evidence to every claim.** One concrete artefact per signal —
   `file:line`, a dashboard panel, a metric name, a config key. A signal with no
   artefact is `unknown`, not present.
4. **Record what is genuinely absent as `unavailable` plus a reason.** "No APM
   configured, so no request-duration distribution exists" is a null. Silence is
   not.
5. **Mark every threshold's provenance** per the table above, before the report
   is rendered rather than after.
6. **Hand the normalized result on.** `alerting-doctrine` consumes it to decide
   what earns a page; `operational-readiness` consumes it as one input to a
   go/no-go verdict. Neither re-derives it.

### Validate

- Verify all four signals appear in the report — present, `unavailable` with a
  reason, or `unknown`. Four rows, always.
- Confirm every present signal cites a concrete artefact, not a stack guess.
- Confirm no `proposed` or `unknown` threshold is rendered as operational.
- Confirm `unavailable` rows carry a non-empty reason.
- Verify log level matches severity (no `error` for handled conditions).
- Confirm structured context is passed (not string interpolation).
- Check that no sensitive data (passwords, tokens, PII) appears in log output.

## Output format

1. A four-row signal table — signal, status, implementation, evidence artefact.
2. Any threshold with its provenance marked.
3. The `unavailable` nulls with their reasons, and the `unknown` rows as open
   questions.

## Examples

Contract fixtures. Each pair differs **only** in the condition under test, and
each case states the verdict it must produce. These are contract evidence for
review, not an executable suite — no parser or runner reads them.

### Missing signal — malformed vs clean

```yaml
# malformed — logs and error tracking, no saturation anywhere.
# Scored as missing a signal, NOT as observable.
signals:
  latency:    { status: present, evidence: "APM: http.server.duration p95" }
  traffic:    { status: present, evidence: "nginx access log rate" }
  errors:     { status: present, evidence: "error-tracker project 41" }
# saturation omitted entirely
verdict: "missing-signal: saturation"
reason: "no pool, memory, disk or rate-limit utilisation metric detected"
```

```yaml
# clean — the same project with the one signal supplied.
signals:
  latency:    { status: present, evidence: "APM: http.server.duration p95" }
  traffic:    { status: present, evidence: "nginx access log rate" }
  errors:     { status: present, evidence: "error-tracker project 41" }
  saturation: { status: present, evidence: "db_pool_in_use / db_pool_size gauge" }
verdict: all-signals-detected
```

### Provenance — malformed vs clean

```yaml
# malformed — an agent-suggested number rendered as a commitment.
slo:
  name: checkout_availability
  threshold: 99.9
  provenance: proposed
  operational: true      # <- promotion with no measurement and no commitment
verdict: invalid-provenance
```

```yaml
# clean — the suggestion stays a suggestion.
slo:
  name: checkout_availability
  threshold: 99.9
  provenance: proposed
  operational: false
verdict: valid-proposed-threshold
```

### Unavailable signal — malformed vs clean

```yaml
# malformed — a null with no reason is a silently dropped gap.
signals:
  saturation: { status: unavailable }
verdict: invalid-unavailable-signal
```

```yaml
# clean — the null carries why.
signals:
  saturation:
    status: unavailable
    reason: "managed runtime exposes no pool or host metrics on this plan"
verdict: valid-unavailable-signal
```

## Detected implementation — stack-specific evidence

Reached **after** detection, never before it. These are what a detected
implementation looks like in one common stack; the neutral model above is what
you reason from. Deep vendor material lives in the specialists, which this skill
points at rather than absorbing.

| Tool | Signal it can carry | Reached by |
|---|---|---|
| Error tracker (Sentry) | errors (raised only) | `sentry-integration` |
| Grafana | any, if the metric exists | `grafana`, `dashboard-design` |
| Loki | errors and traffic via log volume | `grafana` |
| Slack webhook | none — a delivery channel | `alerting-doctrine` |

A delivery channel is not a signal. Slack carrying error-level messages tells you
notifications work, not that an error *rate* exists.

A channel layout repeats across stacks whatever names it uses: a rotating file
channel, an error-alert channel, an aggregation channel, and a composite that
deliberately excludes the alert leg so a noisy job cannot page anyone. Aggregation
labels carry app, service and environment; the **service** label is what separates
log types in a query, and a workload needing its own labels gets its own scoped
channel rather than a shared one. Which categories reach which channel is gated by
config flags, not by call sites — so read the flags before concluding a category
is unlogged.

→ Log levels, structured context, what to log, and error-tracker patterns:
guideline `php/logging.md`.

## Gotcha

- An installed SDK is a capability, not a signal — the commonest false green.
- Queue **depth** is a traffic signal; queue **wait time** is the saturation one.
- Saturation needs a ceiling. A utilisation number with no known limit is
  `unknown`, not present.
- Error trackers see raised exceptions, not handled failures or wrong answers.
- Sentry has a 200KB event size limit — large context gets truncated.
- Structured logging keys must be `snake_case`.
- Don't create a log channel without the query or dashboard that reads it.

## Do NOT

- Do NOT report three signals because the fourth was inconvenient — record it as
  `unavailable` with a reason, or as `unknown`.
- Do NOT render a `proposed` or `unknown` threshold as operational.
- Do NOT treat `unknown` as green, compliant, or "probably fine".
- Do NOT infer a signal from an installed dependency.
- Do NOT interpolate variables into log messages — use a context array.
- Do NOT log at `error` level for expected, handled conditions.

## Auto-trigger keywords

- logging
- monitoring
- observability
- Golden Signals
- SLI
- SLO
- structured logging
- log levels
