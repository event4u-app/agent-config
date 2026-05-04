# Tier 2 Nudge Surface — Design Lock

> Phase 5 design deliverable for [`road-to-rule-hardening.md`](../roadmaps/road-to-rule-hardening.md).
> Locks the **mechanism** the prototype will implement; the prototype
> itself (`model-recommendation` Tier 2a) is the next roadmap's first
> task. Empirical compliance measurement (≥ 20 sessions) is deferred for
> the same reason — it cannot start before the prototype lands.
>
> Last refreshed: 2026-05-04.

## Tier 2 vs Tier 1 — what the surface needs to do

Tier 1 hooks **act** — they regenerate dashboards, gate sessions, count
turns. The platform fires, the hook does the work, the agent never sees
it. Tier 2 is different: the trigger is platform-detectable, but the
**response** must come from the agent (model switch, "are you sure",
verify before claim). The surface's job is to make the trigger
observable to the agent at the right moment, **without** asking the
agent to self-detect.

## Two sub-tiers, two mechanisms

| Sub-tier | Mechanism | Cost | Pilot rule | Pilot rule (round 2) |
|---|---|---|---|---|
| **2a** | PostToolUse marker → `additionalContext` injection | Low | `model-recommendation` | `slash-command-routing-policy` |
| **2b** | Structured state injection / tool-call gate | Medium | `verify-before-complete` | `downstream-changes` |

### Tier 2a — marker injection

- **Hook surface:** `PostToolUse` (Augment + Claude Code).
- **What the hook does:** detects the trigger (e.g. first-tool-use of a
  session, command invocation, topic shift) and writes a single-line
  marker to stdout. On Claude Code, the marker arrives as
  `additionalContext`. On Augment, the marker is appended to the next
  prompt frame via the standard hook output channel.
- **Marker payload format:** `RULE:<rule-name> TRIGGER:<reason>
  ACTION:<one-line-instruction>`. Single line, < 200 chars, no
  Markdown — keeps the budget impact zero.
- **Agent contract:** when the marker appears, the agent MUST act on it
  before the next user-visible content. The rule body becomes the spec
  of "act on it". No self-check loop is required because the marker is
  the trigger.
- **Failure mode:** missed marker = soft failure (compliance metric).
  No hard block — Tier 2 by definition cannot block.

### Tier 2b — structured injection / tool-call gate

- **Hook surface:** `PostToolUse` (state write) + `PreToolUse` (read +
  optional deny) on Augment + Claude Code.
- **What the hook does:** maintains a state file
  (`.augment/state/<rule>.json`) with the rule's structured field
  (e.g. `{"verified": false, "last_verified_at": null}`). On
  `PreToolUse` for the gated tool (commit, push, PR), the hook reads
  the state and either passes through or denies with a structured
  reason in stderr.
- **Agent contract:** the agent reads the state file via the standard
  context-loading path; on gated tool denial, the agent sees the deny
  reason and corrects the gap (run the test, refresh the verification)
  before retrying.
- **Failure mode:** gate is hard for blocking-event-capable platforms
  (Claude Code, Augment); on platforms without `PreToolUse` deny
  semantics, falls back to Tier 2a marker.
- **Cost:** medium — state schema, atomic write, cross-platform persistence
  parallels `context-hygiene`.

## Compliance threshold + escalation

Roadmap requires ≥ 70% expected-behavior on the next turn over ≥ 20
measured sessions. The threshold is per-rule, not aggregate.

- **≥ 70%** → promote nudge to standard, document on the rule body's
  `Enforced by:` callout.
- **< 70% on Tier 2a** → escalate to Tier 2b structured injection.
- **< 70% on Tier 2b** → accept as Tier 3 (soft, with re-audit clock),
  document the empirical failure in the rule body.

Measurement vehicle: `telemetry.artifact_engagement` log already
captures rule activations. Add a `nudge_outcome` field per Phase 5
prototype landing — it is the same JSONL surface, no new infrastructure.

## Why prototype = deferred, not in-this-session

The prototype is genuinely net-new infrastructure: a hook script
(`scripts/model_recommendation_hook.py`), an Augment trampoline, a
Claude Code wiring entry, the marker-injection contract documented in
the rule body, and unit tests parallel to `context_hygiene_hook.py`'s
14-test suite. That is a focused engineering session, not a closure
turn — and the empirical step (≥ 20 sessions) is independently blocked
on calendar time. Closing Phase 5 with the design locked + prototype
deferred is honest; building half a prototype during closure is not.

## Acceptance for Phase 5 closure

- ✅ Nudge mechanism locked (this doc).
- ✅ Marker payload format locked.
- ✅ Compliance threshold + escalation path documented.
- ⏸ `model-recommendation` prototype — deferred to next roadmap.
- ⏸ ≥ 20-session compliance measurement — blocked on prototype.
- ⏸ `verify-before-complete` Tier 2b application — blocked on Tier 2a
  validation.

The three deferred items become the seed for the next roadmap;
Phase 5's contract is "the mechanism is decided", not "the mechanism is
shipped".

## See also

- [`hardening-pattern.md`](hardening-pattern.md) — Tier 1 four-artefact
  contract; Tier 2 inherits the hook + trampoline + rule-body shape,
  swaps the "act" for "mark"
- [`rule-trigger-matrix.md`](rule-trigger-matrix.md) — 17 Tier 2a + 10
  Tier 2b rules waiting on this mechanism
- [`road-to-rule-hardening.md`](../roadmaps/road-to-rule-hardening.md)
  Phase 5 — the roadmap step this artefact discharges
