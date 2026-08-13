---
model_tier: medium
name: agents-user-accept
pack: meta
visibility: internal
cluster: agents
sub: user
skills: [agents]
description: Apply a buffered observation to .agent-user.md or the global profile.md after explicit user confirmation; bumps last_updated and drops the applied observations from the buffer.
argument-hint: "[field]"
suggestion:
  eligible: false
  rationale: "Mutates .agent-user.md — only run from /agents user review or explicit user invocation."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /agents user accept

Apply a buffered observation from either
[the project-local or the global observation buffer](../../../../docs/contracts/agent-user-schema.md#observation-buffer)
to the matching profile file — `.agent-user.md` for a project-local
observation, the global `~/.event4u/agent-config/user/profile.md` for a
global one (ADR-138, road-to-global-user-memory Phase 2) — after
explicit confirmation.

This is the **only** step in the learning channel that writes a profile
file. Everything upstream (the miner, the buffers, `/agents user review`)
only ever proposes.

Use when:

- `/agents user review` surfaced an observation worth applying.
- The user invoked `/agents user accept <field>` directly.

Never runs autonomously — always asks before writing.

## Steps

### 1. Preconditions

```bash
ls .agent-user.md 2>/dev/null
ls .agent-user.observations.jsonl 2>/dev/null
```

Resolve the global buffer/profile paths via
`user_global_observations.resolveGlobalObservationsPath()` /
`agent_user_profile.resolveGlobalProfilePath()`.

Both the project-local file/buffer AND the global profile/buffer
missing → print "Run `/agents user init` and accumulate observations
first." and stop. Otherwise proceed with whichever layer(s) have a
buffered observation.

### 2. Resolve target field + layer

| Invocation | Resolved field + layer |
|---|---|
| Handed off from `/agents user review` option 1 | The most-frequent field, with the layer `review` reported it under |
| Handed off from `/agents user review` option 4 (a promotion candidate) | The candidate's `suggest` text, layer `global` — see § 2b below, skip straight to step 4 with the promotion framing |
| `/agents user accept <field>` | `<field>` (must match the schema enum); if both layers have an observation for it, ask which layer |
| `/agents user accept` with no arg | Print the field list (both layers), ask which |

Invalid field → print the schema enum and stop.

### 2b. Promotion candidates need a `promotion_reason` (road-to-global-user-memory Phase 3)

A candidate handed off from review option 4 has `seen_count ≥ 3` and a
`seen_in[]` project list — human-confirmed recurrence across that many
DIFFERENT projects (per
[`findPromotionCandidates`](../../../../../src/scripts/_lib/user_global_observations.ts)).
Crossing that threshold is candidacy only; it never auto-promotes
(mirroring ADR-121's rule that a knowledge card has no auto-`shareable`
path). Before step 4's confirmation, collect one additional line from the
user:

```
This observation recurred in {seen_count} projects: {seen_in joined by ", "}.

Why should this generalise to your global profile?
> {free-text promotion_reason — required, no default}
```

An empty answer is not accepted — re-ask once, then fall back to
"Cancel" if the user still declines to give a reason. The
`promotion_reason` is shown in step 4's confirmation block (below) but is
**never written to `profile.md`** — see § 3 write below; it exists to make
the human's judgment call visible in this transcript, not to persist
alongside the fact.

### 3. Compute proposed change

For the resolved field + layer — or, for a promotion candidate (§ 2b),
the single matched buffer entry:

1. Read every matching observation from that layer's buffer only —
   `.agent-user.observations.jsonl` for `project`,
   `user_global_observations.readGlobalObservations()` for `global`.
2. Pick the **latest** `suggest` value (most recent `ts` wins). For a
   promotion candidate, the proposed value is
   [`promotionValueFor(candidate)`](../../../../../src/scripts/_lib/user_global_observations.ts) —
   the fact text ONLY, never the `context` or `seen_in` metadata attached
   to it.
3. Read the current value from that layer's profile file
   (`.agent-user.md` or the global `profile.md`) — NOT the merged
   effective value, so the confirmation shows exactly what this layer
   will change.
4. If they match, print "No change — current value already matches
   the latest observation." and skip to step 6.

### 4. Confirm

```
Apply this change to {.agent-user.md | the global profile}?

  layer   : {project | global}
  field   : {field}
  current : "{current_value}"
  proposed: "{proposed_value}"
  source  : {n} observations between {oldest_ts} and {newest_ts}
  evidence: {latest_evidence, truncated to 200 chars}

> 1. Apply
> 2. Skip — keep current value, drop these observations from the buffer
> 3. Cancel — leave the profile and buffer untouched
```

For a promotion candidate, append two lines above `> 1. Apply` instead of
`source`/`evidence`:

```
  seen in : {seen_count} projects ({seen_in joined by ", "})
  reason  : "{promotion_reason from § 2b}"
```

One question per turn. Wait for the user's number.

### 5. Write

On `1. Apply`:

- **`project` layer:** rewrite the targeted field in `.agent-user.md`
  frontmatter, preserving every other field (a YAML round-trip loader
  that keeps formatting), bump `last_updated` to today (ISO
  `YYYY-MM-DD`), validate ≤100 lines + privacy floor clean — any
  violation rolls back and prints the error.
- **`global` layer:** call
  [`applyObservationToGlobalProfile(field, value, { today })`](../../../../src/scripts/_lib/agent_user_profile.ts) —
  it round-trips the existing `profile.md` (or starts from empty),
  sets the field, bumps `last_updated`, and throws (never partially
  writes) if the result would exceed the global layer's own 100-line
  cap. A thrown error is the roll-back signal — print it and stop. For a
  promotion candidate, `value` is `promotionValueFor(candidate)` — the
  `promotion_reason` collected in § 2b is shown in step 4's confirmation
  only; it is **never** passed to `applyObservationToGlobalProfile` and
  never appears in `profile.md`, alongside `context`/`seen_in`, which are
  likewise never written. This is the only generalisation path, and it
  leaves the durable profile with zero project references (see
  [`agent-user-schema.md § Project attribution`](../../../../docs/contracts/agent-user-schema.md#project-attribution-road-to-global-user-memory-phase-3)).

Either layer: drop **all** applied observations for that field from
**that layer's own buffer only** (rewrite the JSONL minus matching
lines) — never touch the other layer's buffer. For a promoted candidate,
this drops only the ONE matched buffer entry (identified in § 2b), not
every `notes`-field entry in the buffer.

On `2. Skip`: leave the profile untouched but still drop the
observations for that field from that layer's buffer.

On `3. Cancel`: stop without any write.

### 6. Confirm

```
✅  {layer} profile updated ({field}: "{old}" → "{new}", last_updated: YYYY-MM-DD).
   Buffer: {n} observations removed, {m} remaining.
```

Do NOT commit. Do NOT auto-chain to a second field.

## Rules

- One field per invocation. The user runs `/agents user accept` again
  for the next field.
- Never write without explicit confirmation in step 4.
- Never bypass the privacy-floor scan, even if the buffer writer
  already redacted.
- Never write to the layer the observation did NOT come from — an
  observation buffered as `global` writes `profile.md`, never
  `.agent-user.md`, and vice versa.
- Never accept a promotion candidate without a non-empty
  `promotion_reason` (§ 2b) — a `seen_count ≥ 3` tally is candidacy, not
  authorization.
- Never write `context` or `seen_in` to `profile.md` — a promotion writes
  `promotionValueFor(candidate)`, the fact text only.
- Mirror the user's language for prompts per
  [`language-and-tone`](../../../../dist/agent-src/rules/language-and-tone.md).

## See also

- Schema + buffer contract: [`agent-user-schema § Observation buffer`](../../../../docs/contracts/agent-user-schema.md#observation-buffer).
- Project attribution + promotion: [`agent-user-schema § Project attribution`](../../../../docs/contracts/agent-user-schema.md#project-attribution-road-to-global-user-memory-phase-3).
- Global write primitive: [`agent_user_profile.applyObservationToGlobalProfile`](../../../../src/scripts/_lib/agent_user_profile.ts).
- Promotion primitives: [`findPromotionCandidates`, `promotionValueFor`](../../../../../src/scripts/_lib/user_global_observations.ts).
- Parent: [`/agents user`](../user.md).
- Sibling: [`/agents user review`](review.md), [`/agents user update`](update.md).
