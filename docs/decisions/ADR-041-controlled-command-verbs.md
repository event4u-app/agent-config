---
adr: 041
status: accepted
date: 2026-06-03
decision: controlled-command-verbs
supersedes: —
superseded_by: —
phase: v6.0.0 · governance, evals, evidence-based pruning
type: forward-looking
---

# ADR-041 — Controlled verb vocabulary for visible commands

## Status

**Accepted** · 2026-06-03. Authored as Phase 2 / Step 4 of
[`road-to-6.0.0-c-governance-and-evals`](../../agents/roadmaps/road-to-6.0.0-c-governance-and-evals.md),
the governance front of the experience-first rebuild. Sits alongside the
per-pack command budget ([`capability-packs.md` § Budget exemption
process](../contracts/capability-packs.md)) and the routing-metadata
requirement (Step 4b). Builds on
[`ADR-003`](ADR-003-command-invocation-syntax.md) (cluster / colon syntax) and
the locked-cluster contract
([`command-clusters.md`](../contracts/command-clusters.md)).

## Context

6.0.0-B made the capability **pack** the surfacing unit; 6.0.0-C installs the
governance that keeps the surface from re-bloating. A per-pack command budget
caps *how many* visible commands a pack carries. This ADR governs *how they are
named*: a visible command's leading token must be a controlled verb, so the
surface reads as a small, predictable verb vocabulary (`work`, `implement`,
`review`, `fix`, …) rather than an open-ended noun soup.

Without a controlled vocabulary, every new visible command invents its own
naming shape and the "fewer, navigable commands" promise of the pack rebuild
erodes one well-meaning addition at a time. The `create-*` shape is singled out
for an outright ban: which files to create is an in-flow decision the agent
makes, not a command surface to enumerate.

> **Council convergence (anthropic/claude-sonnet-4-5 + openai/gpt-4o,
> 3-round design debate, 2026-06-03):** both members converged on
> forward-only enforcement (grandfather the existing surface, gate new
> additions), a **version-controlled YAML allowlist** reviewed via PR with an
> ADR for any new verb, **grandfathering `create-pr`** through an explicit
> documented exception rather than a broad exemption, and a **single modular
> lint** (one pass, configurable severity) over two/three separate lints — the
> "vocabulary gate + structure advisor" split was rejected because a
> CI-passes / review-fails wedge trains contributors to ignore warnings.

## Decision

1. **Controlled verb allowlist.** Visible commands (tier 0/1) must have a
   leading token (the substring before the first `-`, or the cluster sub-name
   for `cluster:sub` commands) drawn from the allowlist in
   [`config/discovery/command-verbs.yml`](../../config/discovery/command-verbs.yml).
   The allowlist seeds the curated verbs (`work`, `audit`, `plan`, `implement`,
   `review`, `fix`, `test`, `ship`, `sync`, `explain`, `estimate`, `refine`,
   `publish`) plus the established cluster-head / standalone tokens already in
   use on the visible surface (so the existing 20 visible commands all pass).

2. **No `create-*` commands.** `create` is a banned leading token for *new*
   visible commands. The agent decides which files to create in-flow; the
   command surface does not enumerate creation targets.

3. **`create-pr` is grandfathered** via an explicit `grandfathered:` entry in
   the YAML — a documented single-command exception, not a broad waiver.

4. **Forward-only enforcement.** The lint
   ([`scripts/lint_command_verbs.py`](../../scripts/lint_command_verbs.py))
   checks only command files **added or promoted to visible since the `main`
   baseline**, mirroring `lint_no_new_atomic_commands.py`. The existing surface
   is grandfathered; no rename wave.

5. **A new verb requires an ADR.** Adding a token to `approved_verbs` is a
   governance change: it lands in its own PR with a short ADR (or an addendum
   referencing this one) justifying the new verb. The YAML is the machine list;
   the ADR is the human rationale.

6. **Single modular lint.** One lint pass implements both the approved-verb rule
   and the banned-prefix rule. No separate "advisory" lint that warns without
   gating — every rule the lint carries blocks CI (configurable per-rule, but
   default error), so there is no CI-green / review-red wedge.

## Consequences

- **Positive.** The visible surface stays a small, scannable verb vocabulary.
  New commands are nudged toward reuse of an existing verb (and therefore an
  existing cluster) before inventing a new one. The `create-*` ban removes a
  whole class of "expose a creation target as a command" growth.
- **Positive.** Forward-only + grandfathering means zero disruption to the
  current surface; the gate only ever fires on a *new* visible command.
- **Negative / accepted.** The seeded allowlist includes established cluster-head
  nouns (`feature`, `judge`, `council`, `memory`, `roadmap`, `agents`), so the
  vocabulary is not purely verbs on day one. This is the cost of forward-only
  grandfathering; the teeth come from "a new token needs an ADR", not from
  retroactively purging the established heads.
- **Negative / accepted.** Leading-token tokenization is a heuristic
  (`review-changes` → `review`). Compound or underscore-shaped names are out of
  scope until a real case appears.

## Alternatives considered

- **Retroactive enforcement** (every existing visible command must conform now).
  Rejected: forces a rename wave across a heavily-referenced surface for no
  user-facing gain. Both council members rejected it.
- **Two/three separate lints** (cluster-head structure advisor + sub-verb gate +
  banned-pattern gate) with mixed soft/hard severity. Rejected per the council:
  advisory-only warnings that never graduate to errors become noise and create a
  CI-passes / review-fails wedge.
- **Rename `create-pr`.** Rejected: breaking change across docs, READMEs, and
  other commands for no benefit; an explicit grandfather entry is cheaper and
  honest.

## References

- [`config/discovery/command-verbs.yml`](../../config/discovery/command-verbs.yml) — the allowlist + banned prefixes + grandfathered exceptions.
- [`scripts/lint_command_verbs.py`](../../scripts/lint_command_verbs.py) — the forward-only single lint.
- [`command-clusters.md`](../contracts/command-clusters.md) — locked clusters + sub-command naming.
- [`capability-packs.md`](../contracts/capability-packs.md) — sibling per-pack budget governance (Phase 1).
- [`ADR-003`](ADR-003-command-invocation-syntax.md) — invocation / colon syntax.
