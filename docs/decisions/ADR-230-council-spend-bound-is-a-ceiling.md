---
adr: 230
status: accepted
date: 2026-08-13
decision: council-spend-bound-is-a-ceiling
supersedes: —
superseded_by: —
phase: —
type: structural
review_trigger: >-
  Revisit when a billable council run lands a spend the user did not expect
  WHILE a ceiling was configured — that would mean the ceiling is not
  functioning as the standing authorization this record treats it as, and the
  per-run confirmation was carrying weight the caps do not. Observable from a
  single user report plus `~/.event4u/agent-config/council-spend.jsonl`; not a
  date.
---

# ADR-230 — The council's spend bound is a ceiling, not a per-run approval

## Status

**Accepted** · 2026-08-13. Maintainer decision, requested directly.

## Context

The `ai-council` skill's Procedure § 3 read:

> **Confirm spend.** Before any network call, surface members + cost ceiling and
> require an explicit user `1` to proceed. Autonomy settings do not override
> this gate.

Unconditional. It fired even when every configured member ran `mode: cli` under
subscription auth and was therefore `billable=False` — i.e. when the projected
spend was exactly **$0**. The user's own council is two such members
(`anthropic`, `openai`), so in practice the gate asked permission to spend
nothing, on every consultation.

Meanwhile the config already carries a real bound: `cost_budget.max_total_usd`,
`cost_budget.daily_limit_usd`, and the per-member `on_overrun` callback that
pauses before any member whose projected spend would breach a cap. That layer
was doing the actual work; the per-run confirmation sat on top of it and
duplicated the decision the caps had already recorded.

## Decision

Procedure § 3 resolves in three cases instead of one:

| Situation | Behaviour |
|---|---|
| **No billable member** (all `mode: cli`, subscription auth) | No gate. Estimate rendered as information; fan out. Spend is $0. |
| **Billable member with a ceiling** (`cost_budget.max_total_usd` or `daily_limit_usd` non-zero) | No per-run ask — the ceiling **is** the authorization the user already gave. `on_overrun` still fires per member on breach; that is where the user regains the decision. |
| **Billable member with no ceiling** (both `0`, i.e. both disabled) | Ask, as before. Nothing bounds the spend, so the user must. |

`personal.autonomy` neither creates nor lifts that bound — autonomy is not a
ceiling.

Consumers who want the old per-invocation gate back set a small
`cost_budget.max_total_usd`: every call then breaches and `on_overrun` asks, per
member. Nothing was removed from the config surface to make this reachable.

## Consequences

- A council run against subscription-authed members is now silent end-to-end —
  the common case costs no round trip.
- The one case that still asks is the one where asking is the only remaining
  control: a billable member with every cap disabled.
- The estimate table is still computed and rendered in all three cases. It moved
  from being the *prompt* to being *information*; it did not disappear.
- **The command surfaces are aligned in the same change.** A grep for the exact
  wrong construct — the literal string `ALWAYS ASK` — found **three** sites:
  `/council default` § 3, the `/council` overview step list, and `/council debate`
  § 4. All three now carry the three-case bound; zero remain. The five wrapper
  commands that say "the cost gate from `/council default` Step 3 still applies"
  needed no edit — Step 3 still exists and still applies, it is simply no longer
  unconditional.
- **`/council debate` keeps its between-rounds gate.** That is a separate,
  per-round control and is untouched; a debate that turns out expensive is still
  stoppable mid-flight.

## Alternatives considered

- **Add an `ai_council.confirm_spend` key.** Rejected: `cost_budget` already
  expresses the bound. A second control over the same money would be two sources
  of truth, and the failure mode — the two disagreeing — is worse than the
  friction removed.
- **Remove the gate outright.** Rejected: a billable member with no ceiling has
  nothing bounding it. "Standing authorization" has to be a bound the user
  actually set, not the absence of one.
- **Keep the gate and special-case `billable=0`.** This is the minimal fix and
  was seriously considered. Rejected because it leaves the redundancy for every
  API-key consumer: they set a ceiling AND get asked, which is the duplicate
  decision this record removes.

## References

- `src/skills/ai-council/SKILL.md` § Procedure 3 — the three-case bound.
- `docs/contracts/ai-council-config.md` § `cost_budget` — the caps and the
  `billable` semantics per transport mode.
- `src/domains/meta/council/default/command.md` § 3 — the surface still to align.
