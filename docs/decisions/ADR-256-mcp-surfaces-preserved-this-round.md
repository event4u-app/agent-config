---
adr: 256
status: accepted
date: 2026-09-07
decision: mcp-surfaces-preserved-this-round
supersedes: —
superseded_by: —
phase: road-to-mcp-bridge-integrity-and-reach-truth · Blockers
type: structural
reopen_policy: directional
protected_dimensions: security_floor
provenance:
  kind: agentic
  decision_makers: [anthropic/claude-sonnet-4-5, openai/codex-default]
  human_directed: true
  agentic_mode: council
evidence:
  strength: E1
  basis:
    - agents/roadmaps/road-to-mcp-bridge-integrity-and-reach-truth.md
    - docs/mcp-server.md
    - src/cli/mcp/dispatch.ts
    - src/cli/mcp/telemetry.ts
    - src/scripts/install.ts
    - src/scripts/_lib/mcp_bridge.ts
    - src/agent-src/templates/scripts/telemetry/mcp_lite.ts
    - docs/contracts/rule-router.md
review_trigger: >-
  Three of the four rulings below are round-scoped refusals and are reopened by
  new evidence, not by a date. The prompt-catalogue ruling is reopened by an
  OBSERVATION: a telemetry window on the MCP-lite surface with a non-trivial
  denominator — real calls from at least one host, over a window long enough
  that the count is about consumer behaviour rather than about when the
  instrument was switched on. Explicitly NOT a reopen trigger for any of the
  four: a re-proposal with no new argument, or a larger zero from the same
  newborn instrument. Explicitly NOT a trigger: reading a refusal as settled
  policy — each closes a roadmap dependency, not the underlying question.
---

# ADR-256 — four MCP surfaces are preserved for this round

## Status

**Accepted** · 2026-09-07. Supersedes nothing and amends nothing.

Decided by an **AI council** (2 seats — `anthropic/claude-sonnet-4-5` and
`openai/codex-default` — 2026-09-07, 2 rounds, blind chairman, both seats
answering) under the maintainer's standing delegation, on the framework that a
**refusal** which preserves a recorded control is council-decidable *as
preservation of the status quo*, while **acceptance** of a control-lowering
proposal is categorically unreachable by a council.

**Read the asymmetry first.** Nothing below establishes that a refused proposal
is wrong. Each records that the change was **not authorized in this round**,
that current behaviour is **unchanged**, and that **no future ruling is
prejudged**.

**On the evidence grade.** `E1` — one dated council session, not a repeated or
comparative measurement. Per `decision-revisit-gate`, a grade is a measurement
and grants no authority; the authority here is the preservation framework above.

**A procedural note the council itself raised, and this record obeys.** The
disposition letters `(a)/(b)/(c)` used in the framework collide with the option
letters `(a)/(b)/(c)` in the fourth blocker's own `Resolved when:` clause. Every
ruling below therefore names its disposition in words — DECIDE, RE-SCOPE,
DESCOPE — and quotes the option it selects rather than referring to it by
letter.

## Context

`road-to-mcp-bridge-integrity-and-reach-truth` carried four blockers, all
recorded as gating work the roadmap deliberately excluded. Each names a proposal
that would lower a consent boundary, reopen a recorded decision, spend a fourth
measurement in a family whose prior three returned null, or remove a surface
consumers may be using. None was settled by building the smaller version.

## Decision

### 1. `mcp-user-scope-approval-consent` — DECIDE: reject, this round

The proposal was to write `enabledMcpjsonServers: ["agent-config"]` into the
managed block of the **user-global** host settings file, so the project-scoped
server starts without the interactive approval.

**Rejected for this round.** The key applies to every project on the machine,
not only the one being installed into, so the write replaces per-project consent
with user-global pre-authorization as the default. Refusing that is preservation
of the status quo and therefore council-reachable; authorising it is not. Both
seats also recorded that the case *for* authorisation is not evidence-ready: the
host's scope, precedence and rollback semantics for the key are asserted in the
proposal and cited nowhere.

Current behaviour is unchanged: the installer writes `.mcp.json`, does not
pre-approve it, and each project's first use triggers its own approval. This
ruling is specific to automatic user-global enablement. It prejudges nothing
about an explicit opt-in command, a project-scoped mechanism, or any consent
model that keeps per-project approval as the default.

### 2. `mcp-runtime-resolver-reopen` — RE-SCOPE: ADR-054 stands

The proposal was a thin read-only MCP wrapper over `match_prompt`, argued as
mechanically distinct from the push-time resolver ADR-054 rejected.

**The mechanism distinction is real and is not decision-relevant.** The standing
evidence a reopen had to address is the **0-of-67** candidate-failure null from
`road-to-activation-evidence-or-refusal` (closed 2026-08-02, against a required
5). That null is not about the push mechanism specifically — it says no
measurable routing failure was found for any mechanism to solve. A narrower
scope is not itself new evidence, so **ADR-054 stands** and
`docs/contracts/rule-router.md`'s "no runtime resolver" is unchanged.

Reopened by new evidence of missed-routing harm, not by a restatement of the
proposal.

### 3. `mcp-instructions-index-preregistration` — DECIDE: decline, this round

The proposal was to raise the 400-byte `instructions` cap
(`src/cli/mcp/dispatch.ts`) and fill the headroom with a generated family index.

**Declined for this round: the pre-registration is not drafted and the cap is
not raised.** This would be the fourth entry in a family whose prior three
measurements returned nothing, including a reminder-injection apparatus that
measured a zero-point difference on both host tiers. Declining further spend on
a vector that has produced no signal three times is a reversible internal
choice.

The 400-byte cap is retained unchanged. Reopened only by a new
decision-relevant hypothesis explaining why this vector would succeed where
three attempts found no effect — not by another payload for the same vector.

### 4. `mcp-prompt-emission-scope` — RE-SCOPE: keep the catalogue on every host

The blocker's `Resolved when:` requires this record to name one of its three
options and cite the Phase 4 reading. It names the first: **keep the prompt
catalogue on every host.**

**The Phase 4 reading, cited as required.** `agent-config telemetry:report` on
the machine this record was written on, 2026-09-06 (UTC), renders:

```
## MCP lite surface

- calls recorded: **0**
```

**What that zero is, and what it is not.** The emitter that fills this sink did
not exist before this roadmap and ships default-off behind
`telemetry.artifact_engagement.enabled`. The zero is therefore a statement about
the age and the default of the instrument, and about nothing else. It is not
evidence that consumers do not use the surface, and it cannot carry a decision
to remove one. Both seats reached this independently, and the second named the
adjacent error explicitly: rejecting the newborn zero as usage evidence and then
suppressing the catalogue anyway would be reaching the same conclusion through a
different unsupported premise — that a host's native file listing is
functionally equivalent to the catalogue, which the documentation shows
coexisting with it and nowhere shows replacing it.

The catalogue is therefore **retained on every host**, and the record states
that present telemetry is insufficient to condition it, remove it, or keep it on
the evidence. Reopened by an observation, per this record's `review_trigger` —
not by a bigger zero.

## Consequences

- No consent boundary moves; `enableAllProjectMcpServers` stays untouched and
  unwritten, as does `enabledMcpjsonServers`.
- The trigger matcher stays unreachable through any consumer MCP path, and the
  roadmap's remaining MCP-truth work proceeded without it.
- The `instructions` budget stays at 400 bytes.
- The prompt catalogue keeps duplicating the host's own listing on hosts that
  have one. That cost is accepted for this round in exchange for not removing a
  surface on a reading that cannot support the removal.
- The MCP-lite telemetry added by Phase 4 is the instrument that makes the
  fourth question answerable later. It answers nothing today, and this record
  says so rather than letting a future reader mistake its zero for a finding.

## Alternatives

- **Authorise the user-global write with safeguards.** Unreachable by a council:
  acceptance of a consent-boundary change is owner-reserved, and the safeguards
  bound the blast radius without changing what the key means.
- **Reopen ADR-054 on the mechanism distinction alone.** Rejected: the
  distinction is mechanical and the null it must answer is not mechanism-specific.
- **Approve the pre-registration now and measure later.** Rejected for this
  round: a pre-registration is cheap only if the measurement it schedules is
  worth taking, and no hypothesis distinguishes the fourth attempt from the
  three that failed.
- **Suppress the catalogue on hosts with a native listing.** Rejected: it rests
  on an equivalence nobody established, and the only reading that could test it
  is a zero from an instrument that has not run.
- **Drop the catalogue entirely and serve through resources.** Rejected on the
  same grounds, more strongly — it removes more on the same absent evidence.

## References

- `agents/roadmaps/road-to-mcp-bridge-integrity-and-reach-truth.md` — the four blockers.
- `docs/contracts/rule-router.md` — the "no runtime resolver" statement ADR-054 backs.
- `src/cli/mcp/dispatch.ts` — the 400-byte `instructions` cap and the prompt catalogue.
- `src/cli/mcp/telemetry.ts`, `src/agent-src/templates/scripts/telemetry/mcp_lite.ts` — the Phase 4 instrument and the section that publishes its zero.
