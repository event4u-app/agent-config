---
name: root-cause-frameworks
description: "Use when tracing the root cause of a resolved incident or recurring bug — 5-whys chain, fishbone categorisation, contributing-factors split — even if the user says 'why does this keep breaking?'."
source: package
domain: quality
model_tier: high
workspaces:
  - engineering
packs:
  - analysis-workbench
lifecycle: active
trust:
  level: professional
  confidence: medium
  human_review_required: false
install:
  default: false
  removable: true
---

# root-cause-frameworks

> Structured root-cause analysis for resolved incidents and recurring bugs.
> Sibling of [`systematic-debugging`](../systematic-debugging/SKILL.md) (live
> reproduction loop) and [`bug-analyzer`](../bug-analyzer/SKILL.md) (static
> call-site analysis) — this skill takes the post-resolution "why did this
> happen and how do we stop it recurring?" view.

## When to use

- A resolved incident needs a structured cause investigation before
  writing the post-mortem.
- A bug recurs and the team needs to understand the underlying system
  condition, not just the symptom.
- Invoked directly or by [`blameless-post-mortem`](../blameless-post-mortem/SKILL.md)
  to populate the cause section.

Do NOT use when:

- Actively debugging a failing test or unresolved crash — use
  [`systematic-debugging`](../systematic-debugging/SKILL.md) instead.
- The goal is to enumerate call-site impact of a change — use
  [`blast-radius-analyzer`](../blast-radius-analyzer/SKILL.md) instead.

## Procedure

Work through the three methods in order; return the best-supported result.

### 1. 5-Whys chain

Ask "Why did X happen?" iteratively, attaching **evidence** to each
link. Continue until the link is unfalsifiable, evidence runs out, or
you reach a systemic condition outside the team's control.

Rules:

- Each link must cite at least one piece of evidence (log line, metric,
  test failure, code path, human observation). Label unverified links
  explicitly as `[speculative]`.
- If a link branches into two independent causes, follow both — a
  branching chain is common and valid.
- Stop a branch when: (a) the next Why has no available evidence, or
  (b) the answer is outside the system boundary (e.g. "the cloud
  provider had an outage").

### 2. Fishbone / Ishikawa (if chain stalls or branches widely)

When the 5-whys chain stalls before reaching a systemic cause, or
branches into more than three independent paths, map contributing
factors across six categories:

| Category | Sample questions |
|---|---|
| People | Knowledge gap, on-call fatigue, ambiguous ownership? |
| Process | Missing review step, deploy gate skipped, alert threshold wrong? |
| Technology | Library version, configuration drift, race condition, hardware limit? |
| Data | Unexpected input shape, stale cache, missing validation, schema mismatch? |
| Environment | Infra difference between environments, dependency version skew? |
| Communication | Unclear spec, siloed knowledge, delayed escalation? |

List each identified factor as a bullet under its category. A factor
may appear in more than one category — that is evidence of a systemic
coupling worth naming.

### 3. Contributing-factors split

Classify every cause surfaced in steps 1–2 into exactly one bucket:

| Bucket | Definition |
|---|---|
| `root` | The condition that, if absent, the incident would not have occurred. |
| `contributing` | A condition that increased likelihood or severity, but not sufficient alone. |
| `amplifying` | A condition that made recovery slower or harder once the incident started. |
| `coincidence` | Present at the time but causally unrelated. |

A well-formed analysis typically has **one** root cause and two to
four contributing causes. Multiple `root` entries indicate the chain
has not been traced far enough, or that the incident was a genuine
compound failure — label it explicitly.

## Output

The output has three ordered sections:

1. **Why-chain** — numbered chain, each link with evidence (or
   `[speculative]` flag) and any branch markers.
2. **Cause taxonomy** — each identified cause labelled
   `root` / `contributing` / `amplifying` / `coincidence`, with a
   one-sentence justification.
3. **Evidence gaps** — explicit list of claims that could not be
   verified and what evidence would resolve them. An empty list is
   fine; omitting the section is not.

May invoke [`systematic-debugging`](../systematic-debugging/SKILL.md) or
[`bug-analyzer`](../bug-analyzer/SKILL.md) mid-procedure to gather
evidence for a specific hypothesis, then continue the analysis.

## Do NOT

- Do NOT present a `[speculative]` link as confirmed cause.
- Do NOT collapse multiple contributing factors into a single root
  cause to produce a cleaner narrative.
- Do NOT invent evidence — if a log line is needed but unavailable,
  name the gap.
- Do NOT reproduce the systematic-debugging reproduce → isolate → fix
  loop; this skill assumes the bug is already understood or resolved.

## Gotchas

- Single "root cause" is often an oversimplification — a compound
  failure with one root and several contributing causes is the norm,
  not an edge case.
- An unfalsifiable why-link (e.g. "we don't know") is a stop signal
  for that branch; do not guess past it.
- Correlation ≠ causation — require a causal mechanism for every link,
  not just temporal proximity.

## See also

- [`blameless-post-mortem`](../blameless-post-mortem/SKILL.md) — invokes
  this skill for the cause section.
- [`systematic-debugging`](../systematic-debugging/SKILL.md) — live
  reproduction and fix loop.
- [`bug-analyzer`](../bug-analyzer/SKILL.md) — static call-site analysis.
- [`risk-officer`](../risk-officer/SKILL.md) — mitigation framing for
  corrective actions after the cause is established.
