---
model_tier: inherit
name: analyze-postmortem
pack: analysis-workbench
tier: 2
visibility: internal
cluster: analyze
sub: postmortem
skills: [blameless-post-mortem, root-cause-frameworks]
description: Blame-free post-mortem after a resolved incident — consume the incident-commander skeleton, derive root cause, write corrective actions, draft an incident-learnings memory candidate.
suggestion:
  eligible: true
  trigger_description: "post-mortem, Nachbesprechung, incident review, was ist schiefgelaufen"
  trigger_context: "incident or outage is resolved and a structured write-up is needed"
workspaces:
  - engineering
packs:
  - analysis-workbench
---

# /analyze:postmortem

Blame-free post-mortem sub-command in the `/analyze` cluster.
Loads and runs the
[`blameless-post-mortem`](../../../../skills/blameless-post-mortem/SKILL.md)
skill, supported by
[`root-cause-frameworks`](../../../../skills/root-cause-frameworks/SKILL.md).

## Instructions

### 1. Gather the incident context

Ask the user (in their language) for what is known:

- Incident summary (title, affected system, start/end time, severity).
- Timeline bullet points (what happened, when).
- Known or suspected root cause (may be empty — that is fine; the
  skill will derive it in Step 3).
- Any existing `incident-commander` skeleton to consume.

Accept an incomplete skeleton per
[`analysis-memory-loop.md § 5`](../../../../docs/contracts/analysis-memory-loop.md):
a missing root cause is normal, not a blocker.

### 2. Retrieve prior incident-learnings

Before drafting, call `retrieve()` over the same key-space (incident
type, affected paths, decision areas) per
[`analysis-memory-loop.md § 2`](../../../../docs/contracts/analysis-memory-loop.md).

- **Stale entries** (age > `review_after_days`) appear in `skipped`
  — surface them to the user, do not silently use them.
- **Match found** → note the existing entry; propose a `frequency` or
  `supersedes` update instead of a new candidate.
- **No match** → proceed to draft a new candidate in Step 5.

### 3. Derive or confirm root cause

Load [`root-cause-frameworks`](../../../../skills/root-cause-frameworks/SKILL.md)
and run the appropriate framework (5-whys chain, fishbone, fault-tree,
or STAMP/STPA) against the timeline. The skill returns ranked
candidates with confidence levels — not a forced verdict. Present the
top candidates to the user.

If root cause remains unresolved after the pass, mark the post-mortem
`status: draft`; do not block or stall.

### 4. Write the post-mortem document

Following
[`blameless-post-mortem`](../../../../skills/blameless-post-mortem/SKILL.md),
produce a structured write-up covering:

1. **Summary** — what failed, impact, duration.
2. **Timeline** — chronological bullets.
3. **Root cause** — confirmed or `status: draft` if unresolved.
4. **Contributing factors** — systemic, not individual.
5. **Corrective actions** — numbered, owned, time-boxed.
6. **What went well** — preserve working safeguards.

Systems and processes are examined — never individuals.

### 5. Draft the memory candidate

Per
[`analysis-memory-loop.md § 1`](../../../../docs/contracts/analysis-memory-loop.md),
draft an `incident-learnings` candidate using `/memory propose`:

```jsonc
{
  "type":              "incident-learnings",
  "summary":           "<one-line pattern learned>",
  "evidence_paths":    ["<path/to/post-mortem>", "<path/to/timeline>"],
  "decision_surface":  ["<area1>", "<area2>"],
  "last_validated":    "<today-YYYY-MM-DD>",
  "review_after_days": 90,
  "applicable_scope":  "project"
}
```

If the post-mortem is `status: draft`, include the open question in
`summary` (e.g. `"root cause TBD — <symptom>"`).

Dedup check from Step 2 determines whether to propose a new entry or
update an existing one.

### 6. Surface the candidate to the user

Present the draft candidate and ask:

> 1. Propose this candidate to `/memory propose` (recommended)
> 2. Refine before proposing — suggest changes
> 3. Skip memory candidate for now

**Empfehlung:** 1

### Rules

- Do NOT commit, push, or open a PR.
- Do NOT auto-promote to curated memory — `/memory propose` is the
  intake; `/memory promote` requires the human to run the admission gate.
- Do NOT block on an incomplete root cause — accept any skeleton.
- Systems and processes only — never name individuals.

## See also

- [`blameless-post-mortem`](../../../../skills/blameless-post-mortem/SKILL.md)
- [`root-cause-frameworks`](../../../../skills/root-cause-frameworks/SKILL.md)
- [`analysis-memory-loop.md`](../../../../docs/contracts/analysis-memory-loop.md)
- [`/analyze`](../command.md) — cluster orchestrator
