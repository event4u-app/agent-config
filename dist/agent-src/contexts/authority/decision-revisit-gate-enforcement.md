# Decision Revisit Gate — Enforcement Reach

Loaded by [`decision-revisit-gate`](../../rules/decision-revisit-gate.md).
The honest-enforcement record moved out of the rule verbatim: why the gate
ships `instruction-only`, and the two reach limits a consumer install has.

## Honest enforcement — `instruction-only`

`adr_cite_check` is deterministic where it runs, and nothing makes it run. No
gate can observe an agent citing a decision it never opened, so step 2 above is
model-carried — the same honesty boundary
[`security-sensitive-stop`](security-sensitive-stop.md) and
[`active-remediation`](active-remediation.md) state for their own obligations.

Two reach limits, named rather than implied. The tool lives in this repository's
`src/scripts/` and is **not** exposed as an `agent-config` verb, so a consumer
install performs step 2 by hand; wiring the verb touches six further surfaces
plus the curated `dist/agent-src/scripts/` list and is deliberately out of this
change. And `docs/decisions/` is projected into no agent-visible tree at all —
the agent sees ADR *numbers* cited across rules and skills, almost never ADR
*text*. Until that changes, "evaluate before citing" means opening the file.

`docs/contracts/` is unprojected on the same terms (`dist/agent-src/` carries no
`docs/`), so the burden table this rule points at is maintainer-reachable only.
That is why the reserved-set table above stays here rather than becoming a
pointer: a consumer install receives these lines and not the contract.

## Why the council is the default venue — the measurement

The old "offers the user a
path" wording made every lock an owner interrupt; measured across 26 days of
transcripts, the agent reported a lock and waited while the owner voided the
decision retroactively — twice with the lock report timestamped **before** the
override demand. The ordering was the defect; the permission was never missing.

## Why the five steps are inlined rather than only routed

The five are stated here, not only behind a route, because the route was
measurably unreachable: `decision-review` ships `install.default: false` in the
non-default `analysis-workbench` pack, so a pack-legal install received the
obligation and not the procedure. `routes_to` now names two always-on skills;
the backward-audit depth in
`decision-review` stays optional.
