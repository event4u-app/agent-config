# Spec: Promotion flow — from observation to team truth

> **Spec for `agent-memory`, authored from `agent-config`.**
> See [`README.md`](README.md) for the ownership split.

## Status

Draft. Reviewed by Opus, GPT, Claude in the design session that led to
this subdirectory. Open for implementation in the `agent-memory` repo.

## Prerequisites

- `agent-memory` already implements **quarantine** and
  **trust threshold** (README of the package)
- [`../road-to-engineering-memory.md`](../road-to-engineering-memory.md)
  defines the six content types that feed this flow
- [`../road-to-curated-self-improvement.md`](../road-to-curated-self-improvement.md)
  defines the five-stage pipeline that cross-project promotion plugs into

## Vision

> **Self-improving, but gated.** (GPT review, verbatim.)

The agent never mutates team truth on its own. It **proposes**;
a human **decides**. Promotion is an explicit state transition, not a
side effect of usage frequency.

## Non-goals

- **No** autonomous writes above quarantine level
- **No** promotion based on access count alone (quantity ≠ quality)
- **No** cross-project promotion without explicit consumer opt-in
- **No** direct rule or skill generation from memory — that is handled
  by [`../road-to-curated-self-improvement.md`](../road-to-curated-self-improvement.md)
  which *consumes* promoted memory as one of its input signals

## Intra-project promotion — single consumer scope

The lifecycle agent-memory exposes to agent-config:

```
observation → working (session)
     │
     ▼ (trigger fires — see below)
quarantined → episodic (single occurrence, trust < 0.6, not served)
     │
     ▼ (repeat / review / human approve)
episodic → semantic (pattern, trust ≥ 0.6, served to agents)
     │
     ▼ (embedded in workflow)
semantic → procedural (canonical; decay slowed to near-zero)
```

Agent-memory is expected to **only serve** entries at `semantic` or
`procedural` level, and to mark `episodic` as "supporting evidence,
not authoritative" when surfaced for debugging.

## Promotion triggers (agent-config calls agent-memory)

agent-config is responsible for *detecting* these; agent-memory is
responsible for *accepting a `propose()` call* with the right payload.

| Trigger | Where detected in agent-config | Memory target type |
|---|---|---|
| Bug fix without matching pattern | `/bug-fix` command post-step | `historical-pattern` |
| Incident closure | Incident role mode exit (see [`../road-to-role-modes.md`](../road-to-role-modes.md)) | `incident-learning` |
| D-class eval failure + root cause | [`../road-to-trigger-evals.md`](../road-to-trigger-evals.md) runner | `historical-pattern` |
| ≥ 3 review findings on same path | `review-routing` statistics | `domain-invariant` or `historical-pattern` |
| Explicit user request | `/propose-memory <type>` command | any allowed type |

Each call lands the entry in **quarantine** with full metadata; trust
score starts low, nothing is served.

## Impact levels — evidence requirements before promotion

Salvaged from the superseded `feat/hybrid-agent-memory` ADR. Defines
how many independent pieces of evidence a quarantined entry needs
before it can leave quarantine, and what trust ceiling a single piece
of evidence can reach.

| Level | Types | Min evidence | Trust cap with 1 evidence |
|---|---|---|---|
| Critical | `architecture-decision`, `domain-invariant` | 2+ | 0.70 |
| High | `product-rule`, `integration-constraint` | 1+ | 0.85 |
| Normal | `historical-pattern`, `incident-learning` | 1 | 1.00 |
| Low | `ownership`, `glossary` | Optional | 1.00 |

`propose()` records the impact level; `promote()` rejects Critical/High
entries that do not meet the evidence floor. "Evidence" means a
distinct `source` reference (incident id, PR, test, ADR) — multiple
sightings of the same source count as one.

## Extraction guard — block, do not warn

Salvaged guard that prevents polluted entries from ever reaching
quarantine. `propose()` is rejected when the current task state shows
any of:

- Tests fail for the affected area (when tests exist)
- Quality tools (PHPStan, Rector, ECS, eslint, tsc, etc.) report new
  errors caused by the same change
- The diff that produced the observation contains **only deletions** —
  nothing meaningful to extract

Agent-config detects these via the existing `verify-before-complete`
evidence gate; `propose()` carries the gate result so agent-memory can
enforce the block without re-running checks.

## Gate criteria (agent-memory enforces on promote)

`promote(id)` must reject if any of the following fail:

- Mandatory fields present — `id`, `status`, `confidence`, `source`,
  `owner`, `last_validated`
- At least one `source` reference (incident id, PR, ADR) — no orphans
- **Impact-level evidence floor** satisfied (table above)
- **Extraction guard** clean at time of the proposal
- **"3-future-decisions" heuristic** — proposer must name three
  plausible future scenarios the entry will inform; fewer → reject
- Non-duplication against existing semantic entries — returns the
  existing id instead of creating a sibling
- `allowed_target_types` (from `.agent-project-settings.memory.promotion`)
  includes the target type for this consumer

## Cross-project (Stage 3) promotion — upstream to agent-config

The second loop introduced in GPT's review. Scope:

- A pattern has reached `semantic` in **≥ 3 independent consumers**
- Consumers have opted in via `.agent-project-settings.memory.cross_project_feed: true`
- agent-memory emits an **anonymised signal** (pattern summary +
  counts, no repo-specific identifiers)

Target: a pull request on `agent-config` proposing a new rule, skill,
or guideline update. See
[`road-to-cross-project-learning.md`](road-to-cross-project-learning.md)
for the mechanics; this spec only covers the **promotion side** of the
contract.

## Contract agent-config consumes

Minimum API surface (names indicative; final names set by agent-memory):

```
retrieve(query, types[], trust_min, max_tokens) → entries[]
propose(entry, type, source, confidence) → proposal_id
promote(proposal_id) → id | rejection reasons
deprecate(id, reason, superseded_by?) → ok | error
health() → {tier_counts, avg_trust, stale_count, quarantine_size}
prune(policy) → counts of decayed/archived
```

`propose()` accepts the agent-config proposal envelope; `promote()`
is expected to run the gate criteria above. Both can be called from
CLI, MCP, or library.

## Open questions (decided in `agent-memory` repo)

- **Promote authority.** Who triggers `promote()` — agent autonomously
  after N confirmations, or always a human via command / PR? Proposed
  default: **human-only**, configurable per consumer.
- **Rate limiting.** Per-user and per-path cap on `propose()` to stop
  "every bug fix proposes a pattern" noise. Default cap: to be tuned
  after observation window.
- **Deprecation propagation.** When a semantic entry is deprecated,
  do episodic children get archived or retained for audit? Proposed
  default: **retained**, marked with `superseded_by`.

## See also

- [`road-to-decay-calibration.md`](road-to-decay-calibration.md) — how
  trust and decay interact with promotion pressure
- [`road-to-cross-project-learning.md`](road-to-cross-project-learning.md) —
  Stage-3 upstream loop
- [`../road-to-agent-memory-integration.md`](../road-to-agent-memory-integration.md) —
  agent-config side: commands and hooks that call this contract
