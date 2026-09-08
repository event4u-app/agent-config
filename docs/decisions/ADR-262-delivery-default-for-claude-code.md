---
adr: 262
status: accepted
date: 2026-09-07
decision: delivery-default-for-claude-code
supersedes: —
superseded_by: —
type: structural
reopen_policy: owner
protected_dimensions: governance
provenance:
  kind: human
  decision_makers: [owner]
  human_directed: true
evidence:
  strength: E1
  basis:
    - docs/CLAIMS.md
    - internal/bench/reports/thin-inject-2026-08-23.md
    - agents/evidence/analysis/standing-payload-by-host-2026-09.md
    - src/scripts/_lib/lean_projection_mode.ts
    - src/scripts/condense.ts
    - src/scripts/check_host_tree_parity.ts
    - src/config/hook-token-budget.json
review_trigger: >-
  Reopened by evidence that a rule stopped reaching a Claude Code session under
  delivery — a labelled rule unreachable in the recall endpoint, a stub in a
  tree whose host is not in lean_projection.hosts, or a consumer report of a
  rule whose body never arrived. Not reopened by the size of the saving, in
  either direction: the saving is measured and is not the property under
  protection here.
---

# ADR-262 — `delivery` is the shipped default for Claude Code, and for no other host

## Status

Accepted, owner-directed, 2026-09-07. Records owner ruling E1 of
`road-to-delivery-for-every-host`. It reopens neither ADR-202 nor ADR-094.

## Context

`lean_projection.mode` has had three values since the switch was repaired:
`eager-all` (every rule body projected into every host's rule tree), `thin`
(pointer stubs, no delivery mechanism) and `delivery` (pointer stubs plus a
`rule-inject` hook concern that delivers a body back on trigger match). The
shipped default was `eager-all`, and `delivery` had been available and unused
since it was measured.

Two facts framed the decision.

**The measurement was in.** `docs/CLAIMS.md`'s `thin-inject-delivery-equivalence`
row is `backed`: 579/579 byte-equal deliveries, 94/94 labelled rules reachable,
0 false fires over 194 near-misses, and a price of \$0.7285 against \$4.0335 per
50-turn × 5-spawn session. Re-run on this branch over the widened corpus it
reads 616/616 byte-equal, **101/101 reachable**, **0 of 212 near-misses fired**,
\$0.7167 against \$4.0401. What that licenses is delivery equivalence and cost,
and nothing wider.

**The cost of not deciding had a date.** `src/config/preamble-payload-budget.json`
carried a `grace_ceiling` of 138,273 expiring 2026-11-10, against a measured
total of 138,200 — 73 tokens of headroom. After that date the design ceiling
applies and every PR inherits a red gate.

## Decision

1. The package ships `lean_projection.mode: delivery` with
   `lean_projection.hosts: [claude-code]` as the **default**.
2. `hosts` is a real axis, not a comment. The projector writes stubs only for a
   host in that list; every other host receives exactly what `eager-all` writes,
   asserted byte-for-byte by `check_host_tree_parity` in CI.
3. Rollback is one setting: `lean_projection.mode: eager-all` and a
   regeneration. A consumer who does nothing else gets today's behaviour back.
4. **The default is the shipped TEMPLATE value, and the code fallback stays
   `eager-all`.** `src/config/agent-settings.template.yml` ships
   `mode: delivery` + `hosts: [claude-code]`; `DEFAULT_LEAN_PROJECTION_MODE` in
   `_lib/lean_projection_mode.ts` remains `eager-all` and is deliberately NOT
   flipped with it. The two answer different questions: the template is what a
   consumer is given, the constant is what happens when the value cannot be
   read. That module's own contract - "a mode nobody can spell must never
   silently thin the standing corpus" - is a fail-safe, and flipping it would
   make an unparseable settings file thin the corpus without anyone choosing to.
   The same reasoning governs `hosts`: absent resolves to `[claude-code]`, but a
   list that resolves to nothing thins nothing rather than falling back.
5. The completeness invariant holds and is not weakened by this record: **every
   rule file is written for every host, and every body is delivered on match.**
   A stub is a form, not a subset.

## Why Claude Code, and only Claude Code

Delivery needs a host that both binds the slots the concern runs on and acts on
its verdict. `docs/enforcement-by-host.md:18-28` records that Claude Code is
the only host that refuses on a deny; Cowork and Augment bind slots and discard
the dispatcher's output, Cursor, Cline and Gemini carry no `pre_tool_use`
binding, Windsurf has no tool-lifecycle surface, and Copilot and Codex bind
nothing. Thinning any of those would remove a body and put nothing in its place.
That is why the host axis exists and why its default has exactly one member.

## Consequences

- A Claude Code session's standing rule payload falls from the eager projection
  to the kernel plus the always-eager residue; the residue is now three classes,
  not one — kernel rules, rules the router gives no trigger, and rules whose
  only triggers are path-shaped while the concern is unbound on `pre_tool_use`.
- `user_prompt_submit`'s per-slot sum cap rises from 4,096 to 16,384 bytes. The
  number is the measured p90 gate-open fire size rounded up to 512, not a
  chosen headroom, and it is the activation charge the `rule-inject` budget row
  had already assigned to the flipping run.
- `pre_tool_use` loses the `rule-inject` binding and keeps its 2,048-byte cap.
- Every non-Claude host's rule tree is now under a CI byte-identity assertion it
  did not have before. That is a tightening, and it is the half of this change
  that survives even if the default is rolled back.

## What this does NOT reopen

- **ADR-202** closed the paired-judging instrument behind the `thin` quality
  null (thin win-rate 36.2 % against a 48 % pre-registered threshold). This
  record does not reopen it and does not depend on it: `delivery` re-delivers
  the identical bytes and is licensed on delivery equivalence and cost, which
  is a different claim from behavioural equivalence. Citing that null as a gate
  for `delivery` is K7 of the roadmap that produced this record.
- **ADR-094** is untouched.
- No behavioural-equivalence claim is made here, and none should be read into
  the saving.

## Alternatives considered

- **Keep `delivery` opt-in.** Rejected on the ground the ruling states: an
  opt-in nobody flips is no flip. The mode had been available since it was
  measured and had never been taken, so "available" was operationally
  indistinguishable from absent.
- **Flip every host.** Rejected: it is the D1 defect this roadmap repairs, and
  on five of the eight other hosts there is no bound slot to deliver a body back
  through. It would remove bodies and replace them with nothing.
- **Shorten rule prose to fit the ceiling.** Rejected as K5 of the same roadmap.
  It trades a measured mechanism for an unmeasured loss of obligation surface.
- **Raise `design_ceiling`.** Rejected as K4. A ceiling that moves up when the
  payload does is not a ceiling.

## Evidence

| Claim | Basis |
|---|---|
| Delivery is byte-equal to eager projection on a trigger match | `internal/bench/reports/thin-inject-2026-08-23.md` — 616/616 byte-equal deliveries over the frozen `tests/eval/routing-matrix` corpus |
| Every labelled rule stays reachable under delivery | Same report — 101/101 labelled rules reachable; 0 of 212 near-misses fired |
| The per-slot activation charge is measured, not chosen | `src/config/hook-token-budget.json` — `user_prompt_submit` raised to the p90 gate-open fire size rounded up to 512 B; distribution p50 6,674 B, p90 16,188 B, max 20,406 B over 318 gate-open fires |
| Hosts outside `lean_projection.hosts` receive what `eager-all` writes | `src/scripts/check_host_tree_parity.ts` asserts it byte-for-byte in CI |
| `delivery` was accepted by the resolver long before the schema admitted it | `src/scripts/_lib/lean_projection_mode.ts` accepted the value while `agent-settings.schema.json` did not, so a consumer setting the documented value failed validation |
| The saving is per-host and not a behavioural claim | `docs/CLAIMS.md` — `thin-inject-delivery-equivalence`, whose `non_inference` field scopes it to one host and states delivery equivalence is a byte claim, never a session-behavior claim |

**The grade is E1 — single-source and directed.** Every row above is a
measurement or a file read in this tree, but the **authority** for shipping the
flip as the default is not: `road-to-delivery-for-every-host` states plainly
that "the authorization for E1/E2 rests on the owner instruction of 2026-09-07
alone", and `docs/CLAIMS.md:365` does not carry the `owner-reserved` label a
reader might expect to find there. So the measurements are reproducible and the
mandate is not reconstructible from the tree — recorded here rather than
implied, because `authority_basis: owner_intent` governs authority and never
disclosure.

## References

- `agents/evidence/analysis/standing-payload-by-host-2026-09.md` — the per-host
  baseline and the per-slot fire-size distribution behind the cap.
- `docs/CLAIMS.md` — `thin-inject-delivery-equivalence`.
- `internal/bench/reports/thin-inject-2026-08-23.md` — the four endpoints.
- `src/scripts/check_host_tree_parity.ts` — the byte-identity assertion.
