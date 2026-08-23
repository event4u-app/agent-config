---
complexity: lightweight
---

# Stub: road to the frontend-power default flip

> **Stub — not active work.** A **drain-run transfer**, not a demand-gated stub.
> Created 2026-08-23 when
> [`road-to-frontend-power`](../archive/road-to-frontend-power.md) was drained.
> Two steps are **shipped-default flips**, which rule 3 of
> [`drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md)
> makes categorically `B` and never `D`: "a shipped-default flip … takes `B`,
> never `D`. The council may record its preferred choice inside the stub; the
> parent may not record the action as done." Outcome state on the parent:
> **transferred**.
>
> **This stub crosses a Hard Floor in its own right.** Flipping a shipped
> default changes behaviour in every consumer install that takes the update, so
> it is an owner action under
> [`non-destructive-by-default`](../../../src/rules/non-destructive-by-default.md),
> not a measurement anyone can promote by running a probe.

## The criteria, verbatim from the parent

> **E1.4 Pack-scoped default-ON** for the carriers, after E1.5 produces its
> number. This is the intervention arm the 0.0 % measurement never had.
> `verify:` `agent-config hooks:status` reports the design concern ON in a store
> carrying `frontend-design` and OFF in a bare store.

> **Z.3** Default-ON follows Z.2's margin; it does not precede it.
> `verify:` the commit flipping the pack default is later than Z.2's results
> commit and cites its number.

## What moves here — the complete list

| Item | Parent location | Why it moves |
|---|---|---|
| E1.4 pack-scoped default-ON | Phase E1 | A shipped-default flip. Also gated on E1.5's number, which is itself transferred. |
| Z.3 the default-ON flip | Phase Z | The same flip, gated on Z.2's margin. Its verify is an ORDERING assertion between two commits, and one of them does not exist. |

A third item moves here, discovered while landing the carrier rather than
planned: **the P0 refusal itself.**

`design-pass-stop` is declared `severity: advisory`, and the dispatcher enforces
advisory as a ceiling — `_is_advisory` downgrades EXIT_BLOCK to EXIT_WARN and
`host_semantics.emitFor` maps stop+warn to exit 0. So a concern that returned
EXIT_BLOCK from here would run, log, inject its context, and let the turn end:
an INERT refusal, with every other assertion about it still passing. That is the
exact defect `run-continuation` records in its own allowlist entry.

Rather than ship it, the code was matched to the declaration: the stop pass
COMPUTES the P0 verdict and reports it as *would block at stop*. Making the
refusal real means adding `design-pass-stop` to `BLOCKING_ALLOWLIST` in
`tests/hooks/concern_severity.test.ts`, whose header states that adding to it is
a security-relevant decision — and this would be the **third turn-END** refusal
in the tree, blast radius every session rather than one command. A frontend
change is not where that is decided unilaterally.

Nothing else. The carrier itself **landed** and is `[x]` on the parent:
`design-pass` is bound on six `post_tool_use` chains and `design-pass-stop` on
seven `stop` chains. What is transferred is the value of
`hooks.design_pass.enabled` (which ships `false`) and the allowlist entry above.

## The distinction that keeps this honest

```
BINDING A CARRIER IS NOT ENABLING IT. THE PARENT DID THE FIRST AND MAY NOT
DO THE SECOND. A ROADMAP THAT TICKED E1.4 BECAUSE THE HOOK EXISTS WOULD BE
CLAIMING AN INTERVENTION THAT IS STILL SWITCHED OFF — WHICH IS EXACTLY THE
STATE THE 0.0 % MEASUREMENT RECORDED.
```

That sentence is the reason this stub exists rather than a checkbox.

## Recorded preference — the council's, not an authorisation

Rule 3 permits recording a preference here. The 2026-08-23 pack-reach council
(2 of 2, convergent) chose **option (c)** — keep `suggests:`, scope the claim —
and that is now `docs/decisions/ADR-245-frontend-design-pack-reach.md`,
`status: accepted`, `reopen_policy: owner`.

Read together, the preference for *this* stub is: **enable per pack, not per
install.** `hooks.design_pass.enabled: true` inside a store that carries
`frontend-design`, `false` elsewhere. That is E1.4's own shape, and it is
consistent with ADR-245 because it changes nothing for an install that never
opted into the pack.

**A recorded preference is not a licence.** The owner may pick differently, and
ADR-245's own `reopen_policy: owner` says so.

## Producer and probe — named, not wished

- **Producer:** the **maintainer**, at a release gate. Not a session, not a
  council, not a probe.
- **Probe — four readings, and all four must be positive:**
  0. Is `design-pass-stop` in `BLOCKING_ALLOWLIST`
     (`tests/hooks/concern_severity.test.ts`) with its own recorded
     justification answering the three questions that entry demands — scope,
     `fail_closed`, and termination? Without it the flip enables a carrier whose
     P0 verdict is reported and never enforced.
- **Probe — the remaining three:**
  1. Does `internal/bench/frontend-power/` carry an E1.5 tiering result with a
     corpus digest? (The parent makes E1.4 explicitly "after E1.5 produces its
     number".)
  2. Is there a commit recording a Z.2 margin **before** a commit recording Z.2
     results?
  3. Is the measured first-run false-positive rate on the clean corpus zero for
     every rule the carrier would block on? A P0 that fires on clean UI is Risk 1
     of the parent, and one such block turns the carrier off for good.
- **Measured on this machine, 2026-08-23 — the control, recorded so a later
  reader can tell movement from noise:**
  - E1.5 tiering result: **absent**. No file under `internal/bench/frontend-power/`
    carries an arm comparison.
  - Z.2 margin commit: **absent**.
  - Clean-corpus FP rate for the P0 set: **unmeasured**. The carrier has never
    run with `enabled: true` anywhere, so there is no first-run rate at all —
    which is the same absence the 0.0 % recorded, now one layer in.
  - `hooks.design_pass.enabled` in the shipped template: **false**
    (`src/config/agent-settings.template.yml`).

## Promotion gates

The README's shared criteria do **not** govern a drain-run transfer. These do:

1. **All three probe readings positive**, in the order the parent states:
   E1.5's number, then Z.2's margin-before-results, then the flip.
2. **The flipping commit cites Z.2's number.** Z.3's verify is that citation,
   not the flip.
3. **A named human performs it.** The gate here is *authority*, not a
   measurement — there is no number that authorises a shipped-default change on
   its own.

## Seed content on promotion

- Flip `hooks.design_pass.enabled` pack-scoped, then verify with
  `agent-config hooks:status` in two stores: one carrying `frontend-design`
  (expect ON) and one bare (expect OFF). Both halves — an ON with no matching
  OFF is not the pack-scoped behaviour E1.4 specifies.
- Cite the Z.2 number in the commit message. A flip that cites nothing is
  indistinguishable from a flip taken on preference.
- Keep the rollback one line: setting the key back to `false` restores the
  measured state, and the published numbers stay, which is the point.
