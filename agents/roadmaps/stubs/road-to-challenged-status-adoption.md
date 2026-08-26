---
complexity: lightweight
review_by: 2026-09-25
---

# Stub: road to adopting the `challenged` ADR status on the runtime-premise records

> **Stub — not active work.** A **drain-run transfer**, created 2026-08-26 when
> [`road-to-decision-conformance`](../archive/road-to-decision-conformance.md)
> was drained. Its step 3.1 would flip ten accepted ADRs to `challenged`, and an
> AI council (2/2) named **three preconditions** before any flip. This run
> satisfied one. Framework of record:
> [`drain-blocker-dispositions-b.md`](../../evidence/council/drain-blocker-dispositions-b.md).
> Outcome state on the parent: **transferred**.
>
> **Transferred, not completed. No ADR status was changed.**

## The criterion, verbatim from the parent

> **3.1 Set the runtime-doctrine ADRs to `challenged`, naming the trigger and
> naming no successor.**
> `verify:` the affected ADRs read `challenged`, each names the condition that
> would resolve it, and **none names a successor ADR or a preferred variant.**

## What this run DID satisfy

**1.2 landed.** `challenged` exists in `ALLOWED_STATUS`
(`src/scripts/check_adr_frontmatter.ts`) and in the contract enum
(`docs/contracts/adr-layout.md`), and `adr_cite_check` reports it distinctly from
`accepted` and from `superseded`, with a verdict that says the decision **still
binds**:

> `LIVE, CHALLENGED — the decision is under active question and STILL BINDS. A
> challenge is not a successor: nothing has replaced this record.`

Before that it was a **hard blocker**: flipping to a status the validator
rejected would have failed CI. One council seat caught it before the routing
question was even reached.

**3.0 landed.** The enumeration is at
`agents/evidence/analysis/runtime-premise-adr-classification-2026-08-26.md`: 21
records, 10 `premise-load-bearing`, 11 `premise-incidental`, 0 unclear.

## The two preconditions still open

### 1. Audit every status consumer

`challenged` must be proven to behave **as accepted** wherever accepted decisions
are *selected* — not merely accepted by the validator. No such audit exists.

**Why it is not a formality.** 3.0 found ten records whose decision **collapses
or weakens if the premise lifts**. A consumer that treats "status is not
`accepted`" as "not binding" would silently release all ten. The failure would be
invisible: nothing errors, a lock just stops being cited.

What the audit must cover, at minimum — every reader of `status`:
`adr_cite_check` (done), `check_adr_frontmatter` (done), `audit_adr_coverage.ts`,
`adr:effective`, the ADR index generator, and any rule or skill that selects
"accepted decisions".

**Fixtures the council named:** a `challenged` ADR remains binding; is included
wherever accepted decisions are selected; names no successor; suspends nothing.

### 2. Per-ADR evidence that the premise is actually under question

One seat, verbatim: **"classification alone is insufficient."**

3.0 marks ten records load-bearing. That is a statement about *how the record is
argued*, not about whether the premise is a live question **today**. A flip needs
the second, per record.

Two of the ten make this concrete:

- **ADR-088** — `superseded_scope: engine-adoption interpretation only`. Its
  no-runtime **coordinator** boundary is still live; only the engine-adoption
  reading was replaced. A flip must say which half it challenges.
- **ADR-098** — `superseded_scope: Decision-10 only`. Its load-bearing premise
  clause sits in the reasoning behind **the one Decision that is already
  superseded**. Flipping it on the premise would be re-deciding a dead clause.

## The routing question — UNRESOLVED, deliberately

**Is setting an accepted ADR to `challenged` council-decidable, or
owner-reserved?**

The argument for council-decidable: `challenged` explicitly moves no floor and
changes no authority. It records that a question is live. On that reading it is
not the governance self-amendment `decision-revisit-gate` reserves to the owner.

The argument for owner-reserved, and it is the one that prevailed here: the
asymmetric-risk argument. One seat — *"if you're wrong, you can't un-cross"* —
and the instruction to err toward the owner when genuinely unsure.

**The run was unsure, and 3.0 sharpened rather than settled it.** So the question
is recorded unresolved rather than answered by the party that would gain from
answering it. That asymmetry is the reason: an agent deciding that an agent may
flip decision-record statuses is self-granting.

Note also that the parent's own **3.1b routes the retirement of the four
no-runtime claim surfaces to the OWNER** — so the author saw a boundary in this
neighbourhood, which is evidence about intent even though `challenged` is a
narrower act than retirement.

## Probe — three readings, all cheap

- **Producer:** the **maintainer**, for the routing question; an agent may do the
  consumer audit and the per-record evidence under a council disposition once the
  routing is settled.
- **Probe:**
  1. Does a decision record state whether flipping an accepted ADR to
     `challenged` is council-decidable or owner-reserved?
  2. Does a status-consumer audit exist, with the four fixtures above?
  3. For each candidate record, is there evidence the premise is a live question
     *today* — not merely load-bearing in the argument?
- **Measured on this tree, 2026-08-26 (transfer-date baseline):** (1) **no** —
  no record addresses it; (2) **no** — `adr_cite_check` and
  `check_adr_frontmatter` handle `challenged` correctly, every other consumer is
  unaudited; (3) **no** — 3.0 supplies the classification and explicitly not the
  liveness.

## Closing in the other direction — the honest-null path

A recorded decision that **`challenged` will not be applied to this population**
closes this stub completely. The status still earns its place: it exists in the
enum, `adr_cite_check` reports it, and it is available for a record whose premise
someone actively challenges with evidence. Adopting the status and never using it
here is a legitimate outcome, not a failure.

## Seed content on promotion

- Settle the routing question **first**. Everything else is wasted if the answer
  is owner-reserved and an agent did the work.
- Do the consumer audit **before** any flip, with all four fixtures. A flip that
  silently releases ten load-bearing locks is worse than no flip.
- Then, per record, supply the liveness evidence. Ten marks are not ten
  challenges.
- Start with the eight records that carry **no** partial supersession. ADR-088
  and ADR-098 need their scope question answered first, and ADR-098's may be
  moot — its premise clause is inside an already-superseded Decision.
- ADR-224 is `proposed`, not `accepted`. It is not in this population's shape at
  all: a change there is a maintainer *acceptance*, and its own Status section
  says it *"changes no runtime behaviour by itself"*.
