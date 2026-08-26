---
complexity: lightweight
review_by: 2026-12-24
---

# Stub: road to team telemetry behind the experimental flag

> **Stub — not active work.** Transferred out of
> `road-to-always-on-orchestration.md` (Phase 5.4 + blocker
> `team-telemetry-behind-flag`) by the autonomous drain run of 2026-08-20.
> Council 2026-08-20 (anthropic/claude-sonnet-4-5 + openai/codex-default,
> quorum 2/2), disposition **B — transferred**, outcome state `transferred`.
> Rationale recorded by the council: *"No instrument can produce the required
> payload evidence until the experimental surface is active in a real
> environment."*
>
> **Promotion note.** The three shared promotion criteria in
> [`README.md`](README.md) (recruited customer, funded security audit,
> maintainer ADR) **do not govern this stub.** They were written for the
> org-mode surfaces of the employee-product workstream, which cross a
> Hard-Floor item. This stub crosses no Hard Floor: it is blocked on a host
> environment variable. Its gate is the re-entry probe below, and nothing else.

## 1. Original criterion (verbatim)

The transferred blocker's `Resolved when` clause, copied without edit:

> payload evidence exists and the concerns ship, or teams leave the
> experimental state and this re-cuts.

## 2. Dependent steps moved (complete list)

- **Phase 5.4** — full team telemetry concerns plus the `TaskCompleted`
  artifact-check ("the report is the interface, not the verification" — a
  teammate's confident completion report is counted, checked against the
  declared deliverable, never adopted unverified).
- **The observation half of Phase 5.1.** The spike *script* already shipped
  (`src/scripts/team_events_spike.ts`, flag-gated with a clean exit-0 skip),
  so what moves is not the code but the thing the code cannot do while the
  flag is unset: observe real `TaskCreated` / `TaskCompleted` / `TeammateIdle`
  payloads and record their shapes.
- **Payload classification** — deciding which observed fields are stable
  enough to bind a concern to.
- **Concern binding** — with the same fail-open discipline as the #1223 set.
- **The re-cut decision** — if teams leave the experimental state, whether
  this work re-enters as a phase rather than a stub.

Nothing else in Phase 5 moves. 5.1's script, 5.2's ADR-109 contract line
(`tools` + `model` honoured, `skills`/`mcpServers` not) and 5.3's AGENTS.md
obligation all shipped and stay shipped.

## Probe — 3. re-entry producer and detection

- **Named producer:** the maintainer of a **flag-enabled environment** — a
  host session running with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` set. Not
  "whoever notices"; not "when the team surface exists for its own reason".
  The producer is whoever first has that environment.
- **Detection probe, two steps in order:**
  1. Flag-state check — `env | grep --line-number EXPERIMENTAL_AGENT_TEAMS`
     returns a set value.
  2. Captured `TaskCompleted` payload fixtures exist, produced by
     `src/scripts/team_events_spike.ts` running without its skip path.
- **Probe value measured today (2026-08-20):** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`
  is **unset**. This is the **third** dated reading of the same value
  (2026-08-09 unset, 2026-08-13 unset, 2026-08-20 unset — eleven days across
  three readings, no change).

**What three identical readings establish.** Not "wait longer" — the opposite.
The parent roadmap's blocker already recorded the inference at the second
reading: this condition does not clear by waiting on this host, so the
realistic paths are an upstream flag flip or the "teams leave the experimental
state" branch. A fourth reading of the same value would add nothing, which is
precisely why the work belongs in a stub keyed on the probe rather than in an
open step that re-reads an unchanging environment. Movement is detectable
because the value is recorded; noise is distinguishable because it is recorded
three times.

## Seed content on re-entry

- Bind the team concerns in `hook_manifest.yaml` against the **observed**
  payload shape, never the documented one — the host_semantics discipline that
  motivated 5.1 applies to the binding as much as to the spike.
- The `TaskCompleted` artifact-check compares the teammate's declared
  deliverable against what exists, and a mismatch is a finding, not a retry.
- Fail-open on every path, per the #1223 concern set.
- Re-read the rung-3 degrade path in
  [`auto-dispatch-classification`](../../../src/agent-src/contexts/execution/auto-dispatch-classification.md)
  before binding: the ladder already degrades rung 3 to rung 2 when the host
  reports no team capability, and the concerns must not contradict it.
