---
adr: 120
status: accepted
date: 2026-07-12
decision: council-chairman-mode
supersedes: —
superseded_by: —
phase: opt-council-deliberation
type: structural
---

# ADR-120 — Council chairman mode supersedes always-host synthesis

## Status

Accepted (2026-07-12).

## Context

The council skill's own Iron Law argues the host agent, having framed the
artefact, cannot independently judge it — yet the shipped engine always let the
host author the synthesis ("the host runs the council and synthesises
convergence"). `road-to-opt-council-deliberation` Phase 2 applies the bias
argument to the synthesis step itself. The contested `auto`-selection detail
was resolved by a billable two-round council pass (anthropic/claude-sonnet-4-5 +
openai/gpt-4o, 2026-07-12): provider-family difference is the binding
independence property for a judge; capability (tier) is the tie-break.

## Decision

`ai_council.chairman: { mode: host | member | auto, member? }` — **default
`host`**, preserving today's behaviour byte-for-byte (the compatibility
guarantee). When `mode != host`, a **non-deliberating member** authors the
synthesis as one billable call through the existing `consult` path (spend gate,
daily ledger, metadata stamping unchanged):

- `member` — the named member, validated fail-closed at config load (must exist
  and be enabled) and rejected at selection time if it deliberated (a member
  that argued cannot self-judge).
- `auto` — provider-family difference primary (non-deliberating ⇒
  provider-different under the one-member-per-provider invariant), optional
  `members.<name>.tier` tie-break, deterministic config order final.
- Every fallback path (member deliberated / unavailable / auto with no
  candidate / call failed) degrades to the host template with a **visible
  annotation** — never a silent substitution.

## Consequences

- The synthesis slot can carry a chairman-authored body (`payload.chairman`
  → `render()`); `council:estimate` shows the extra call as its own row.
- A new optional `tier` field exists on member config solely as the `auto`
  tie-break.
- Host synthesis remains the default; no consumer behaviour changes without
  an explicit opt-in.

## Alternatives

- **Always-host synthesis (status quo)** — rejected: contradicts the skill's
  own independence argument.
- **Tier-first auto selection** — rejected by the council pass: chairing with
  the strongest model when the deliberators share its provider concentrates
  the decision surface on one provider's priors.

## References

- `docs/contracts/ai-council-config.md` § Chairman synthesis.
- `src/scripts/ai_council/chairman.ts` (selection), `council_cli.ts`
  `_maybe_run_chairman` (dispatch).
- Council convergence: `road-to-opt-council-deliberation` § Council notes
  (2026-07-12).
