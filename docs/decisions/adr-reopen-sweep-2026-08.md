# ADR reopen sweep — 2026-08

> Every ADR the transcript record shows blocking work, given a disposition and a
> route. Candidates only: **no reopen is executed here.**

```
NO SILENT RE-OPENINGS. NO SILENT RE-AFFIRMATIONS.
```

Same Iron Law and the same three dispositions as the 2026-07 engine
reclassification, which is the precedent this file follows deliberately rather
than inventing a second shape for the same job.

## Why this file exists

Measured over 26 days of transcripts (2026-07-25 – 2026-08-19): the owner
demanded in **11 distinct messages** that recorded decisions be challengeable,
and in **at least 13 assistant passages** a change was parked or refused citing
a named ADR. Zero of those refusals followed an explicit overturn instruction —
the friction is entirely upstream of the instruction. Two passages quantify it:
*"60–80 % of every substantive file is already built, already planned, or
forbidden by a lock the file never read"*, and *"roughly two thirds of the
recommendations … predominantly prevented work"*.

The owner's instruction was not only "make ADRs challengeable" but *"go through
everything it blocked. Now, and in the past, and unblock it."* This table is
that pass.

## How to read a disposition

| Disposition | Means |
|---|---|
| `RE-OPENED (candidate)` | The premise this decision rested on is questionable **today**. Someone must decide it — the route column says who. Not yet reopened. |
| `RE-AFFIRMED` | Checked and still correct, or already reopened elsewhere and needing nothing further. |
| `STAY-KILLED` | The decision holds and no evidence suggests otherwise; citing it as a blocker is legitimate. |

Route per [`adr-layout § Reopen authority`](adr-layout-reopen-authority) — the
discriminator is whether the proposed transition weakens an owner-reserved
invariant. `council` = the council may decide it; `owner` = reserved.

## The table

Trigger state from `./scripts-run src/scripts/adr_cite_check <ADR-NNN>`,
2026-08-19. `indeterminate` is the honest reading of a semantic condition, not
a failure — it means the lock is not *unqualified*, and the condition must be
evaluated against the tree before the ADR is cited again.

| ADR | Title | What it blocked (transcript evidence) | Trigger state | Disposition | Route |
|---|---|---|---|---|---|
| 001 | Kernel-Set Swap Deferred | Its own follow-up. The record says the swap re-evaluation is *"**mandatory** before P4.1"*; the router compiler shipped and the follow-up ADR was never written. | `none` | **RE-OPENED (candidate)** | council — mechanism; no reserved dimension is touched by re-running a swap evaluation |
| 011 | Domain-Pack Readiness | A plugin/pack proposal was *"parked behind ADR-011"* with no evaluation of whether its readiness gates had since been met. | `none` | **RE-OPENED (candidate)** | council — the gates are mechanism criteria and measurable from the tree |
| 035 | Model capability tiers | Asserted a 4th `frontier` tier "is rejected", in two places, after ADR-232 had reopened exactly that on ADR-035's own `review_trigger`. | `indeterminate` | **RE-AFFIRMED** — already reopened by ADR-232; the defect was the missing back-link, fixed in this change (`amended_by: ADR-232` + body banner) | none needed |
| 051 | Uncondensed source container relocation | A kernel fix that added a legacy-path fallback — *"exactly what ADR-051 forbids"*. The prohibition was correctly applied. | `indeterminate` | **STAY-KILLED** | — |
| 054 | Decay-triggered re-state, not per-turn injection | A per-turn doctrine cue, and separately an activation-measurement proposal, were both closed with *"ADR-054 rejected"*. | `none` | **RE-OPENED (candidate)** | council — `rejected` records a rejected proposal, so reopening means showing the premise moved; the per-turn carrier evidence gathered since (`session-canary`, the nudge concerns) is exactly such evidence |
| 127 | An enforcement claim must resolve | Cited when a proposed claim could not name its enforcing gate. That is the ADR working as designed. | `indeterminate` | **STAY-KILLED** | — |
| 133 | Subsystem freeze in unblock-list form | A WIP limit was struck as *"accounting theater for a solo maintainer"*. The reasoning is capacity-anchored and capacity has not changed. | `indeterminate` | **STAY-KILLED** | — |
| 208 | `dist/agent-src/` kept forever | An inbox analysis whose core ask was *"abolish tracked `dist/agent-src`"* was refused *"against ADR-208, accepted the day before"*. | `indeterminate` | **RE-OPENED (candidate)** | council — projection-tree shape is mechanism; a reopen must address ADR-208's own rationale, not merely re-assert the ask |
| 211 | Harvest freeze | *"ADR-211 forbids new capability-adoption roadmaps."* The owner's response: *"ADR-211 is bullshit … overturn the ADR and unblock everything it blocked."* Partially resolved since via its own amendment path and ADR-216. | `indeterminate` (amended) | **RE-OPENED (candidate)** | **owner** — the freeze's basis is *what the project is for* (external adoption as a goal), and ADR-216 states in terms that a council cannot adjudicate that |
| 216 | Restraint re-anchored to capacity | Named as the capacity cap that struck three of five components in one analysis. | `indeterminate` | **RE-AFFIRMED** — and classified in this change as `reopen_policy: owner`, `protected_dimensions: [purpose]`, which is the first ADR to carry the new fields | **owner** if ever reopened |
| 220 | Skill invocation attestation: check deferred | Cited as an active deferral blocking a related proposal. The deferral names its own resume condition. | `indeterminate` | **RE-OPENED (candidate)** | council — evaluate the stated resume condition against the tree; mechanism only |
| 227 | `paths:` scoping is saturated | Closed a proposal on measured saturation. The measurement is the load-bearing part and it is published. | `indeterminate` | **STAY-KILLED** | — |

**Tally:** 6 `RE-OPENED (candidate)` · 2 `RE-AFFIRMED` · 4 `STAY-KILLED`.
Of the six candidates, five route to the council and one (ADR-211) to the owner.

## What this table is not

It is not a decision. Every `RE-OPENED (candidate)` row is an *entry* into the
reopen path, and that path requires the reopen record from
[`adr-layout § The reopen record`](adr-layout-reopen-record): the original
rationale addressed rather than cited, what changed with tree evidence,
dependants touched, a rollback path, and a blast radius with its evidence. The
precedent-creates-no-authority clause applies to this table too — that six rows
here read `RE-OPENED (candidate)` is not itself an argument for reopening any
one of them.

**Two dispositions rest on transcript evidence rather than a fresh read of the
blocked proposal**, and are stated as such: ADR-011 and ADR-220. Their blocked
items are named in session prose, not in a tracked artefact, so the candidate
status says "this is worth a look", not "this was wrongly blocked".

<!-- Link targets are intentionally section anchors in docs/contracts/adr-layout.md;
     see § Reopen authority and § Reopen record there. -->

[adr-layout-reopen-authority]: ../contracts/adr-layout.md#reopen-authority
[adr-layout-reopen-record]: ../contracts/adr-layout.md#the-reopen-record
