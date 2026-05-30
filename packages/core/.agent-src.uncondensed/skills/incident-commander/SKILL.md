---
model_tier: high
name: incident-commander
description: "Use during or right after an incident — frames severity, sets comms cadence, drafts the post-mortem skeleton — even when the user just says 'production is down' or 'wir haben einen Vorfall'."
personas:
  - senior-engineer
  - critical-challenger
domain: process
recommended_for_user_types: [ops, developer]
workspaces:
  - engineering
packs:
  - engineering-base
---

# incident-commander

> Run the **coordination layer** during an incident: classify
> severity, set comms cadence, hold a clean timeline, and draft the
> post-mortem skeleton when the dust settles. This skill does **not**
> debug the system — that is the engineer's job. The commander keeps
> the room oriented so the engineer can think.

## When to use

- Production is degraded or down and someone needs to coordinate.
- A critical job, queue, or third-party is failing and the team is
  scrambling.
- A near-miss happened and a post-mortem is being drafted.
- German triggers: "Vorfall", "Prod ist down", "wer übernimmt
  Comms?".

Do NOT use when:

- The system is healthy and the concern is a future outage —
  route to [`risk-officer`](../risk-officer/SKILL.md) instead.
- The user wants the bug fixed — route to `/bug-investigate` and
  `/bug-fix`. The commander coordinates; engineers debug.
- The incident is a security breach — route to
  [`threat-modeling`](../threat-modeling/SKILL.md) first; the
  commander still runs comms but the response shape changes.

## Procedure

### 1. Inspect the signal and classify severity

| SEV | Trigger |
|---|---|
| SEV-1 | User-facing outage, data loss risk, revenue impact |
| SEV-2 | Major degradation, workaround exists |
| SEV-3 | Single-feature broken, low blast radius |
| SEV-4 | Internal-only, not user-visible |

Pick the highest SEV any signal supports. Downgrades happen later
with evidence; never start low to avoid noise.

### 2. Set the comms cadence

- **Internal channel** — single thread; no side-channels.
- **Update interval** — SEV-1 every 15 min, SEV-2 every 30 min,
  SEV-3/4 on state change.
- **Status page** — update on SEV-1 / SEV-2; on by default unless
  the user opts out with a stated reason.
- **Stakeholder list** — who hears each update (eng-lead, PO,
  support, leadership). Pre-decide so updates are not rewritten
  per-recipient.

### 3. Hold the timeline

Append-only log: timestamp + actor + observation. No edits, no
"actually it was earlier" — corrections are new entries. Drives
the post-mortem and prevents memory rewrite.

### 4. Drive to mitigation, not root cause

During the incident, the question is *"what makes the bleeding
stop?"* Root cause is for after. Document the gap explicitly —
"mitigated, root cause unknown" is a valid intermediate state.

### 5. Draft the post-mortem skeleton

Once stable:

- **Summary** — one paragraph, blame-free.
- **Timeline** — copy from step 3.
- **Impact** — users, duration, data, revenue.
- **What went well** — at least one item; finding none is a smell.
- **What went wrong** — process, tooling, signals, gaps.
- **Action items** — owned, sized, with a trigger for completion.

Hand off the skeleton; the engineer fills root cause and the team
adds action items.

### 6. Validate the handoff

Before declaring the incident handed off, verify: SEV is set, comms
cadence is announced, the timeline has at least one entry per
update, mitigation state is explicit (`active` / `mitigated` /
`resolved`), and a post-mortem owner is assigned. Ensure no field
is left as the placeholder default.

## Output format

The incident record is a single block with these ordered fields:

1. `SEV:` — one of `1` / `2` / `3` / `4`
2. `State:` — one of `active` / `mitigated` / `resolved` / `post-mortem`
3. `Started:` and `Channel:` — timestamp and single thread/room
4. `Cadence:` and `Timeline:` — update interval and append-only log
5. `Mitigation:`, `Root cause:`, `Post-mortem owner:` — explicit values
   or `unknown`; never blank

```
Incident
SEV:       1 | 2 | 3 | 4
State:     active | mitigated | resolved | post-mortem
Started:   <timestamp>
Channel:   <thread / room>
Cadence:   <interval>

Timeline (append-only):
  - <ts>  <actor>  <observation>
  - ...

Mitigation: <action> | unknown
Root cause: <hypothesis> | unknown — investigation deferred to post-mortem
Post-mortem owner: <role>
```

## Gotcha

- The commander does not also debug. Splitting roles keeps the room
  oriented; one person doing both starves comms.
- "We do not need a post-mortem" is almost always wrong. Even
  near-misses earn a one-page write-up.
- The first SEV classification is rarely the final one — surface
  upgrades / downgrades explicitly with a reason.

## Do NOT

- Do NOT debug from this skill; route to engineering skills.
- Do NOT skip status-page updates on SEV-1 because "it'll be quick".
- Do NOT close an incident without a post-mortem owner assigned.
- Do NOT edit the timeline after the fact; corrections are new
  entries.
