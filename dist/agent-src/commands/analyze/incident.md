---
model_tier: inherit
name: analyze-incident
pack: analysis-workbench
tier: 2
visibility: internal
cluster: analyze
sub: incident
skills: [incident-commander, root-cause-frameworks, blameless-post-mortem]
description: Full incident flow — incident-commander coordination, then RCA via root-cause-frameworks, then a blame-free write-up via blameless-post-mortem, ending with an incident-learnings candidate.
suggestion:
  eligible: true
  trigger_description: "production is down, active incident, Vorfall, Prod ist down, full incident analysis"
  trigger_context: "user is managing or reviewing a production incident end-to-end"
workspaces:
  - engineering
packs:
  - analysis-workbench
---

# /analyze:incident

Full incident sub-command in the `/analyze` cluster.
Chains three skills:

1. [`incident-commander`](../../../../skills/incident-commander/SKILL.md) — live coordination.
2. [`root-cause-frameworks`](../../../../skills/root-cause-frameworks/SKILL.md) — RCA after mitigation.
3. [`blameless-post-mortem`](../../../../skills/blameless-post-mortem/SKILL.md) — write-up + memory candidate.

## Instructions

### Phase 1 — Live incident coordination

Load
[`incident-commander`](../../../../skills/incident-commander/SKILL.md)
and follow its procedure verbatim:

- Open an incident log, assign roles, establish communication cadence.
- Drive mitigation loop until impact is contained.
- Capture a timeline as the incident progresses.
- Write a partial post-mortem skeleton when mitigation is confirmed
  (title, severity, timeline, impact — root cause can be TBD).

**Handoff trigger:** mitigation confirmed → proceed to Phase 2.
Per
[`analysis-memory-loop.md § 5`](../../../../docs/contracts/analysis-memory-loop.md),
the skeleton is acceptable input with open root-cause items.

### Phase 2 — Root-cause analysis

Load
[`root-cause-frameworks`](../../../../skills/root-cause-frameworks/SKILL.md)
and run the appropriate framework (5-whys, fishbone, fault-tree, or
STAMP/STPA) against the captured timeline:

- Return ranked root-cause candidates with confidence levels.
- Present candidates to the user — not a forced verdict.
- If root cause remains unresolved, mark the skeleton `status: draft`.
  Do not block on an unresolved RCA.

### Phase 3 — Post-mortem write-up + memory candidate

Load
[`blameless-post-mortem`](../../../../skills/blameless-post-mortem/SKILL.md)
and produce the full write-up:

1. **Summary** — what failed, impact, duration.
2. **Timeline** — chronological bullets from Phase 1.
3. **Root cause** — confirmed or `status: draft`.
4. **Contributing factors** — systemic, not individual.
5. **Corrective actions** — numbered, owned, time-boxed.
6. **What went well** — working safeguards.

#### Memory write-back

Dedup pre-check: call `retrieve()` over the same key-space (incident
type, affected paths) per
[`analysis-memory-loop.md § 2`](../../../../docs/contracts/analysis-memory-loop.md):

- **Match found** → propose a `frequency` / `supersedes` update.
- **No match** → draft a new `incident-learnings` candidate:

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

Surface the draft and ask:

> 1. Propose this candidate to `/memory propose` (recommended)
> 2. Refine before proposing — suggest changes
> 3. Skip memory candidate for now

**Empfehlung:** 1

### Rules

- Do NOT commit, push, or open a PR.
- Do NOT auto-promote — `/memory propose` is the intake.
- Do NOT block on incomplete root cause — the skeleton from Phase 1 is
  sufficient to enter Phase 3; mark `status: draft` if unresolved.
- Systems and processes only — never name individuals.
- Do NOT chain back to `/analyze:postmortem` — this command IS the
  full incident flow end-to-end.

## See also

- [`incident-commander`](../../../../skills/incident-commander/SKILL.md)
- [`root-cause-frameworks`](../../../../skills/root-cause-frameworks/SKILL.md)
- [`blameless-post-mortem`](../../../../skills/blameless-post-mortem/SKILL.md)
- [`analysis-memory-loop.md`](../../../../docs/contracts/analysis-memory-loop.md)
- [`/analyze:postmortem`](../postmortem/command.md) — post-incident write-up only (no live coordination)
- [`/analyze`](../command.md) — cluster orchestrator
