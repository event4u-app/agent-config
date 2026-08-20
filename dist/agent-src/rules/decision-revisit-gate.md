---
type: "auto"
tier: "2b"
description: "Beneficial change blocked by a lock (honest-null, don't-relitigate memory, budget canon, ADR) — surface a council re-evaluation offer, never drop"
alwaysApply: false
council_depth: deep
triggers:
  - keyword: "don't relitigate"
  - keyword: "honest null"
  - keyword: "already decided"
  - keyword: "locked decision"
  - keyword: "budget blocks"
  - keyword: "adr-"
  - keyword: "adrs"
  - keyword: "superseded"
  - keyword: "review_trigger"
  - phrase: "the adr"
routes_to:
  - "skill:ai-council"
  - "skill:decision-record"
workspaces: [agent-config-maintainer, engineering]
packs: [meta]
collision_ok:
  "honest null": "this rule asks whether a recorded null may be REVISITED; evaluator-independence asks how one was PRODUCED — different decision points on the same artefact"
# obligation: line 31
obligation_frequency: "per-task"
---

# Decision Revisit Gate

## The Iron Law

```
A LOCK IS A DECISION UNDER PAST CONDITIONS, NOT A PERMANENT LAW.
BENEFIT BLOCKED BY A LOCK → SURFACE + OFFER RE-EVALUATION.
NEVER SILENT COMPLIANCE. NEVER SILENT DROP OF A GOOD CHANGE.
RE-EVALUATION GOES TO THE COUNCIL FIRST, NOT TO THE USER FIRST.
THE USER IS REACHED FOR THE RESERVED SET — AND ALWAYS FOR IT.
NEVER CITE A LOCK YOU HAVE NOT EVALUATED THIS TURN.
```

An agent that finds a genuinely beneficial change blocked by a recorded
past decision — an honest-null eval verdict, a "don't relitigate"
memory or context note, a token-frugality/budget canon line, or an ADR —
does not quietly comply and drop the change. It surfaces the conflict and
re-evaluates the lock — **in the council by default**, reaching the user only
for the reserved set below. Progress means adaptation: locks encode what was
true when they were written, not a ceiling on what the package may ever become.

**The default venue is the council, and this is a correction, not a new
policy.** [`ai-council`](../skills/ai-council/SKILL.md) has said since its own
Iron Law that *"a design decision the agent cannot settle from the tree goes to
the council first, not to the user first"*, and its class table already lists
"reopening a recorded decision". This rule used to say "offers the user a path",
which contradicted that and made every lock an owner interrupt. The measured
cost of the contradiction: across 26 days of transcripts, the agent reported a
lock and waited, and the owner had to void the decision retroactively before the
work resumed — in the two clearest cases the lock report is timestamped **before**
the override demand. The ordering was the defect; the permission was never
missing.

**Mechanism-match check comes FIRST**: a verdict settles the *mechanism it
tested*, not every future proposal that resembles it — if the blocked change
is a different mechanism, the lock does not apply; proceed, noting the
distinction.

## The five steps, carried here — the depth is elsewhere, the obligation is not

1. **Mechanism-match** (above) — different mechanism, no lock, proceed.
2. **Evaluate the lock before citing it.** An ADR may not be presented as a
   reason not to act until its status, `review_trigger` state, amendments and
   successors have been read. In this repository that is one command —
   `./scripts-run src/scripts/adr_cite_check <ADR-NNN>`; elsewhere it is the
   same four reads done by hand. A `superseded` / `deprecated` status means it is
   not a live lock at all; a fired or indeterminate trigger means it is not an
   **unqualified** one. `rejected` is NOT in the dead set — on an ADR it records
   a rejected *proposal*, so the rejection binds until its premise is shown to
   have changed.
3. **Surface** the change, the lock, the condition it recorded, and what has
   changed since.
4. **Route it** — council by default (below), user only for the reserved set.
5. **Record** the outcome with scope and `revisit-if`.

These five are the obligation and they are stated here rather than only behind
a route, because the route was measurably unreachable: `decision-revisit-gate`
lives in the always-on `meta` pack while `decision-review` ships
`install.default: false` in the non-default `analysis-workbench` pack, so a
pack-legal install received the obligation and not the procedure. `routes_to`
now names two always-on skills; the backward-audit depth in
[`decision-review`](../skills/decision-review/SKILL.md) stays optional, which is
the correct status for depth.

Full catalog (honest nulls, don't-relitigate notes, budget-canon lines, ADRs,
hard structural caps), the per-step detail, when-NOT-to-fire and the failure
modes remain in [`skill:decision-review` § Decision-revisit gate — mechanics](../skills/decision-review/SKILL.md).
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## Who decides — the owner-reserved set

The discriminator, in one question: **does the proposed transition weaken an
owner-reserved invariant, or create an undelegated external, irreversible, or
destructive commitment?** No, and reversible inside the authorised envelope →
the council decides. Yes, or not establishable from tree evidence → the owner.

The routing unit is the **transition**, never the document: the same ADR may be
strengthened by the council and weakened only by the owner.

| Reserved to the owner | Council-decidable |
|---|---|
| Changes the project's purpose or a declared non-negotiable outcome | Any mechanism serving that purpose |
| **Lowers or removes** a recorded security / privacy / safety / data-handling floor | Strengthening a floor, or an equivalent swap above it |
| Irreversible or materially destructive | Reversible within the envelope |
| Spend or liability **above** a delegated threshold | Budgeted, threshold-bounded spend |
| Creates / removes / weakens a legal, regulatory, contractual, licensing, compatibility, or public commitment | Internal-only commitments |
| Governance self-amendment — reopening authority, quorum, escalation, this set | What the rules already permit |
| Cannot be bounded from available evidence | Bounded, with the evidence cited |

Council split, abstention, or no quorum is an **escalation condition**, not a
class: that transition escalates, the ADR does not become owner-reserved
forever. Availability is `agent-config council:status`, never a project file
([`council-availability`](council-availability.md)).

Field on the ADR: `reopen_policy: directional | owner | unclassified`, absent →
**`unclassified`**, which permits council investigation and reversible
experiments and gates only execution of a reserved transition. Absent is
deliberately not `owner`: with 146 accepted ADRs that default would encode
today's blockage into the new schema. Full contract, the reopen record, and the
precedent-creates-no-authority clause: [`adr-layout § Reopen authority`](../docs/contracts/adr-layout.md).

## See also

- [`recurring-criticism`](recurring-criticism.md) — the **other entrance**: this
  rule fires when a lock blocks a change, that one when the same criticism arrives
  again. It reuses the five steps and the owner-reserved table below.
- [`decision-review`](../skills/decision-review/SKILL.md) — the backward-audit
  procedure + the migrated gate mechanics.
- [`ai-council`](../skills/ai-council/SKILL.md) — the re-evaluation mechanism;
  owns the convergence-summary scope + `revisit-if` contract.
- [`decision-record`](../skills/decision-record/SKILL.md) — forward-flow decision
  locking; its **§ 4 Lock the choice + consequences** requires the `Revisit-if:`
  line that names the reopening condition up front. (This pointer used to cite an
  "escalation litmus" heading; `grep` over `src/` + `docs/` returns two hits and
  neither is in that file — the heading never existed, so the pointer led
  nowhere. Corrected to the section that carries the obligation.)
- [`token-budget-discipline`](token-budget-discipline.md) — the frugality-canon
  value-over-budget escalation this rule's budget-lock case defers to.
- [`no-cheap-questions`](no-cheap-questions.md) — the question-quality floor a
  revisit-offer must still clear.
- [`ask-when-uncertain`](ask-when-uncertain.md) — the numbered-options shape
  used to present the revisit offer.

## Honest enforcement — `enforced_by: none`

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
