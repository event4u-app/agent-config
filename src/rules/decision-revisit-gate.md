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

An agent that finds a beneficial change blocked by a recorded decision — an
honest-null verdict, a "don't relitigate" note, a budget-canon line, or an ADR —
does not quietly comply and drop it. It surfaces the conflict and re-evaluates
the lock **in the council by default**, reaching the user only for the reserved
set below. Locks encode what was true when they were written, not a ceiling on
what the package may ever become.

**The default venue is the council, and this is a correction, not a new
policy.** [`ai-council`](../skills/ai-council/SKILL.md)'s Iron Law already sends
a decision the agent cannot settle from the tree to the council first, and its
class table lists "reopening a recorded decision". The old "offers the user a
path" wording made every lock an owner interrupt; measured across 26 days of
transcripts, the agent reported a lock and waited while the owner voided the
decision retroactively — twice with the lock report timestamped **before** the
override demand. The ordering was the defect; the permission was never missing.

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

The five are stated here, not only behind a route, because the route was
measurably unreachable: `decision-review` ships `install.default: false` in the
non-default `analysis-workbench` pack, so a pack-legal install received the
obligation and not the procedure. `routes_to` now names two always-on skills;
the backward-audit depth in
[`decision-review`](../skills/decision-review/SKILL.md) stays optional.

Full catalog (honest nulls, don't-relitigate notes, budget-canon lines, ADRs,
hard structural caps), the per-step detail, when-NOT-to-fire and the failure
modes remain in [`skill:decision-review` § Decision-revisit gate — mechanics](../skills/decision-review/SKILL.md).
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## Reading a lock — the two descriptive axes

Step 2 reads, in order: **effective state** (status · amendments · successors) →
**provenance** → **evidence strength** → **discovery** → **current evidence**
(does the basis still resolve in a clone?) → **reversibility of the proposed
transition** → **reserved dimensions**. `adr_cite_check` prints all seven; the
evidence-priced burden table stays in
[`adr-layout § The reopen record`](../docs/contracts/adr-layout.md) and is not
restated here.

```
A GRADE IS A MEASUREMENT, NOT A PERMISSION — IT GRANTS NOTHING.
CITING AN E0 LOCK AS A HARD BLOCKER WITHOUT SURFACING ITS GRADE IS A VIOLATION.
NO GRADE LETS AN AGENT SUPERSEDE A RECORD, SKIP A COUNCIL, OR TAKE ANY ACTION
IT COULD NOT TAKE YESTERDAY. THE COUNCIL-FIRST VENUE STAYS, AT EVERY GRADE.
AN ADR'S HISTORICAL DECISION-MAKER DOES NOT DETERMINE ITS REOPEN VENUE.
A LOW-EVIDENCE RECORD MAY STATE A DECISION; IT DOES NOT ESTABLISH THAT ITS
ALTERNATIVES REMAIN INVALID.
```

Venue comes from the proposed transition, the trust boundaries it touches and
the reserved dimensions below — never from who decided originally, and never
from a grade. A weak grade changes how much a reopen must **do**, never who may
do it: `authority_basis: owner_intent` is surfaced with its accumulated cost and
never overruled, and council agreement never raises `evidence.strength` —
sources and measurements do.

**No E0/E1 agent path is enabled here, and no reading of this rule enables
one.** Whether an independently validated grade may ever reduce the
*authorization* burden is an owner-reserved open question — the
`authority-coupling-decision` blocker — left unanswered because the party
assigning a grade would be the party gaining authority from it, and would be
self-classifying the transition as reversible-internal on top.

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
**`unclassified`** — council investigation and reversible experiments are
permitted; only execution of a reserved transition is gated. Absent is
deliberately not `owner`: with 146 accepted ADRs that default would encode
today's blockage into the new schema. Full contract, the reopen record and the
precedent-creates-no-authority clause: [`adr-layout § Reopen authority`](../docs/contracts/adr-layout.md).

## See also

- [`recurring-criticism`](recurring-criticism.md) — the **other entrance**: this
  rule fires when a lock blocks a change, that one when the same criticism arrives
  again. It reuses the five steps and the owner-reserved table above.
- [`decision-review`](../skills/decision-review/SKILL.md) — the backward-audit
  procedure + the migrated gate mechanics.
- [`ai-council`](../skills/ai-council/SKILL.md) — the re-evaluation mechanism;
  owns the convergence-summary scope + `revisit-if` contract.
- [`decision-record`](../skills/decision-record/SKILL.md) — forward-flow decision
  locking; its **§ 4 Lock the choice + consequences** requires the `Revisit-if:`
  line that names the reopening condition up front.
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

`docs/contracts/` is unprojected on the same terms (`dist/agent-src/` carries no
`docs/`), so the burden table this rule points at is maintainer-reachable only.
That is why the reserved-set table above stays here rather than becoming a
pointer: a consumer install receives these lines and not the contract.
