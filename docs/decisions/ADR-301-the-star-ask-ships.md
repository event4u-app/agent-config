---
adr: 301
status: accepted
date: 2026-10-25
decision: the-star-ask-ships
amends: ADR-286 (§ D2 only — the star ask; every other in-product ask stays refused)
supersedes: —
superseded_by: —
phase: owner ruling on ADR-286 § D2
type: structural
reopen_policy: owner
protected_dimensions: [purpose]
provenance:
  kind: human
  decision_makers: [owner]
  human_directed: true
authority_basis: owner_intent
evidence:
  strength: E1
  basis:
    - agents/evidence/owner-directives/2026-10-25-star-ask.md
    - docs/decisions/ADR-286-discoverability-is-a-goal-asking-is-not.md
    - docs/contracts/adoption-signal-floor.md
    - src/scripts/star_ask_hook.ts
    - tests/scripts/star_ask_hook.test.ts
review_trigger: >-
  Reopened by the owner, and only by the owner. Not reopened by an agent round
  that finds the benefit unmeasured: the benefit is the owner's stated purpose
  (discoverability), not a measurement this tree is asked to produce. Worth
  reopening if the ask is found to reach a user more than once per interval,
  to reach a user who said they starred, or to need any network call or user
  identity to decide.
---

# ADR-301 — The star ask ships

## Status

Accepted 2026-10-25. Decided by the repository owner
(`agents/evidence/owner-directives/2026-10-25-star-ask.md`). Amends ADR-286
§ D2 for the star ask only. ADR-286 stays `accepted`: its § D1 (discoverability
is a goal) is unchanged, and § D2 keeps refusing every other in-product ask —
ratings, reviews, testimonials, referrals.

## Context

On 2026-10-16 the owner asked for four things in one round, one of them a
monthly in-product ask for a GitHub star until the user has starred. The round
recorded the request as colliding with ADR-216, offered three resolutions, and
ADR-286 took the narrow one: discoverability yes, asking no. § D2 called it "a
refusal rather than a deferral" and gave three missing conditions — a measured
benefit, a defensible cadence, a checkable stop condition.

The owner did not notice the refusal among the round's questions and did not
intend it. A request from the owner for a purpose the owner sets is not a
hypothesis the tree has to prove before it may act on it.

## Decision

### D1 — The star ask ships as its own concern

`star-ask` (`src/scripts/star_ask_hook.ts`): a `session_start` concern, bound on
claude only, `effect: notification`, advisory, fail-open. Its text goes out
through the user channel `update-notice` uses (`hooks/user_notice.ts`,
`systemMessage`): shown to the user, not added to the model's context. It is a
separate concern so that `update.mode: off` never silences it and its own kill
switch never silences an update notice.

### D2 — Cadence: monthly, after a week

The first ask comes 7 days after the concern first runs on the machine; after
that at most once per 30 days. An ask counts the moment it is emitted, and the
state recording it is written before the emission; if that write fails, nothing
is emitted. The read-decide-write-emit step holds an exclusive lock file, so
two simultaneous session starts cannot both ask. A notice the host dropped
waits for the next interval. (The first
draft counted an ask only on the dispatcher's delivery receipt; the AI council
refused that on 2026-10-25, 2/2, because a lost receipt or an unwritable state
file then asked on every session.)

### D3 — Stop condition: the user's word, read locally

`star_ask.starred: true` stops it for good. It is a class-A key, so the agent
may set it with `agent-config settings:set star_ask.starred true` when the user
says they starred. `star_ask.mode: off` and `AGENT_CONFIG_NO_STAR_ASK=1` stop it
too; CI, replay mode and hosts without a user channel never see it. Both keys
are read from the user-global layers only: a repository can neither ask its
contributors for stars nor silence the ask for them.

This answers ADR-286's objection that "until starred" is uncheckable without
the user's external identity: the tree does not check GitHub, it believes the
user. Nothing is fetched, nothing leaves the machine, and the adoption-signal
floor is untouched.

### D4 — The limit this record sets for any later ask

This record admits exactly one ask, and it is not a precedent an agent may
extend. Any further in-product ask on behalf of the package needs its own owner
ruling and its own record, and must keep every property D1–D3 hold: emitted
through the user channel, never into model context; at most once per 30 days,
counted on emission and fail-closed; stopped for good by the user's own word,
read from user-global settings a repository cannot change; no network call and
no identity read. ADR-286 § D2 keeps refusing ratings, reviews, testimonials
and referrals.

## Consequences

- One more `session_start` concern on claude (concern_count +1, claimed in
  `road-to-an-update-that-installs-itself-only-when-it-is-safe`), loaded from
  its own chunk; the dispatch bundle stays under its unchanged ceiling.
- A user who starred and never says so is asked up to twelve times a year. The
  text tells them how to stop it on every ask, which is the trade the owner chose
  over a GitHub lookup.
- The anti-nag gate in `skill_linter.ts` is unchanged: it governs skill bodies,
  and no skill asks for anything.

## Alternatives considered

**Check the star through `gh api user/starred/...`.** Rejected for now: an
outbound call and an identity read at session start, which the adoption-signal
floor forbids and which would put network latency on the hook path. Revisit only
as an explicit, opt-in addition.

**Fold the ask into `update-notice`.** Rejected: the two would share kill
switches, which is wrong in both directions.

## Evidence

The owner directive file holds the order verbatim. ADR-286 holds the refusal
this record reverses and the three conditions it set; D3 above answers the
third without touching the adoption-signal floor. The concern and its tests
show the cadence, the fail-closed count and every stop condition:
`tests/scripts/star_ask_hook.test.ts` (22 cases, including an end-to-end run
through a claude envelope and the user-global `star_ask.starred` switch). The
benefit is the owner's stated purpose and is not claimed as a measurement.

## References

- `src/scripts/star_ask_hook.ts`, `src/scripts/hook_manifest.yaml` (`star-ask`).
- `agents/decisions/concern-admissions.jsonl` (`star-ask` row).
- `docs/contracts/settings-classes.md` (`star_ask.mode`, `star_ask.starred`).
