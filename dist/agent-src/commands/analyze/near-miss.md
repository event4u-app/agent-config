---
model_tier: inherit
name: analyze-near-miss
pack: analysis-workbench
tier: 2
visibility: internal
cluster: analyze
sub: near-miss
skills: [blameless-post-mortem]
description: Blame-free near-miss analysis — same post-mortem flow as analyze:postmortem but framed around a close call that did not result in a production incident.
suggestion:
  eligible: true
  trigger_description: "near-miss, almost failed, beinahe-Vorfall, close call, we almost had an outage"
  trigger_context: "user wants to analyse a close call or near-miss event that did not produce a full incident"
workspaces:
  - engineering
packs:
  - analysis-workbench
---

# /analyze:near-miss

Near-miss analysis sub-command in the `/analyze` cluster.
Uses the
[`blameless-post-mortem`](../../../../skills/blameless-post-mortem/SKILL.md)
skill with a near-miss framing — same structure as
[`analyze:postmortem`](../postmortem/command.md) but the emphasis is
on *what prevented actual impact* and *what systemic changes prevent
recurrence*, not on cataloguing damage.

## Instructions

### 1. Gather the near-miss context

Ask the user (in their language) for:

- Event summary — what happened, what was at risk, what contained it.
- Timeline bullets (what occurred, in what order).
- Known trigger or suspected root cause (may be empty).
- What safeguard, luck, or human action prevented full impact.

Accept incomplete information; the write-up may include open items
with `status: draft`.

### 2. Retrieve prior incident-learnings

Before drafting, call `retrieve()` over the same key-space (affected
system, incident type, decision area) per
[`analysis-memory-loop.md § 2`](../../../../docs/contracts/analysis-memory-loop.md):

- **Stale entries** (age > `review_after_days`) are in `skipped` —
  surface them; do not silently use them.
- **Match found** → propose a `frequency` / `supersedes` update.
- **No match** → proceed to draft a new candidate in Step 4.

### 3. Write the near-miss document

Following
[`blameless-post-mortem`](../../../../skills/blameless-post-mortem/SKILL.md),
produce a write-up covering:

1. **Summary** — what was at risk, what contained it.
2. **Timeline** — chronological bullets.
3. **Trigger / contributing factors** — systemic, not individual.
4. **What prevented impact** — named safeguard, human catch, timing.
5. **Corrective actions** — numbered, owned, time-boxed.
6. **What went well** — preserve the working safeguards.

Emphasise the containing mechanism over the potential damage — the goal
is to reinforce what worked and close the gap that allowed the close
call.

### 4. Draft the memory candidate

Per
[`analysis-memory-loop.md § 1`](../../../../docs/contracts/analysis-memory-loop.md),
draft an `incident-learnings` candidate via `/memory propose`:

```jsonc
{
  "type":              "incident-learnings",
  "summary":           "<one-line pattern: near-miss type + containing mechanism>",
  "evidence_paths":    ["<path/to/near-miss-doc>"],
  "decision_surface":  ["<area1>", "<area2>"],
  "last_validated":    "<today-YYYY-MM-DD>",
  "review_after_days": 90,
  "applicable_scope":  "project"
}
```

### 5. Surface the candidate to the user

> 1. Propose this candidate to `/memory propose` (recommended)
> 2. Refine before proposing — suggest changes
> 3. Skip memory candidate for now

**Empfehlung:** 1

### Rules

- Do NOT commit, push, or open a PR.
- Do NOT auto-promote — `/memory propose` is the intake.
- Do NOT block on incomplete root cause — accept skeletons.
- Systems and processes only — never name individuals.
- Frame the write-up around the containing mechanism, not the
  potential damage.

## See also

- [`blameless-post-mortem`](../../../../skills/blameless-post-mortem/SKILL.md)
- [`analysis-memory-loop.md`](../../../../docs/contracts/analysis-memory-loop.md)
- [`/analyze:postmortem`](../postmortem/command.md) — same flow, full incident
- [`/analyze`](../command.md) — cluster orchestrator
