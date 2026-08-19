---
stability: stable
---

# ADR Layout — Per-area Directories

> Status: accepted · 2026-05-16 · Roadmap: an internal parity roadmap (local-only) Phase 4

## Scope

Two ADR surfaces coexist in this repo. **Both are canonical** — neither supersedes the other.

| Surface | Path | Use for |
|---|---|---|
| **Flat (legacy)** | `docs/decisions/ADR-NNN-<slug>.md` | Cross-cutting governance decisions: kernel composition, rule taxonomy, package-wide architecture. Numbering is global, sequential, gap-free. |
| **Per-area** | `docs/adrs/<area>/NNNN-<slug>.md` | Sub-area decisions whose blast radius is one plugin / one subsystem. Numbering is per-area, starts at `0001`, padded to 4 digits. |

Choice rule — does the decision constrain code **inside one area folder** (one runtime module, one contract group, one CLI surface)? → per-area. Does it constrain **the package's contract with consumers**? → flat. In doubt → per-area (cheaper to surface, easier to relocate).

## Per-area layout

```
docs/adrs/
  <area>/
    README.md          # one-paragraph area scope + table of all ADRs in this area
    0001-<slug>.md     # first ADR, retrospective or prospective
    0002-<slug>.md
    ...
```

`<area>` is a kebab-case stem matching one of:

- An entry in the canonical area inventory (see [`src/scripts/audit_adr_coverage.ts`](../../src/scripts/audit_adr_coverage.ts) `AREAS`).
- A new area added to that inventory in the same PR.

Reserved areas (bootstrap pass — step-11 Phase 4 Step 3):

| Area | Scope | Owner contract |
|---|---|---|
| `cost` | Budget ladder, hard-stop hook, cost reporting | [`cost-enforcement.md`](cost-enforcement.md) |
| `telegraph` | Telegraph-speak condensation, decondensation, reversibility | [`condensation-default-kill-criterion.md`](condensation-default-kill-criterion.md) |
| `schema` | Frontmatter schemas, v2 rigor, lint behaviour | [`schema-versioning.md`](schema-versioning.md) (when published) |
| `router` | `router.json` shape, tier semantics, dispatch precedence | [`rule-router.md`](rule-router.md) |
| `smoke` | Per-tier smoke contracts, baseline locks | [`smoke-contracts.md`](smoke-contracts.md) |

## Frontmatter

Identical across both surfaces:

```yaml
---
adr: NNN              # zero-padded; per-area uses 4-digit (0001), flat uses 3-digit (010)
area: <area> | flat   # 'flat' for docs/decisions/, otherwise the area slug
status: proposed | accepted | superseded | deprecated
date: YYYY-MM-DD
decision: <slug>
supersedes: — | ADR-<area>-NNNN | ADR-MMM
superseded_by: — | ADR-<area>-NNNN | ADR-MMM
amends: — | ADR-MMM                    # optional; this ADR amends that one
amended_by: — | ADR-MMM                # optional; reciprocal of `amends`
phase: <roadmap-stem> · <phase-id>     # optional but recommended
type: retrospective | prospective
protected_dimensions: [...]            # optional — see § Reopen authority
reopen_policy: directional | owner | unclassified   # optional; absent → unclassified
---
```

Supersession links cross surfaces: a per-area ADR may supersede a flat ADR and vice versa. The numeric prefix in `supersedes:` makes the target unambiguous (`ADR-007` = flat, `ADR-cost-0001` = per-area).

## Reopen authority

A recorded decision is a decision under past conditions, not a permanent law
([`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md)). This
section says who may reopen one, and it is deliberately not a property of the
ADR alone.

### The discriminator

```
DOES THE PROPOSED TRANSITION WEAKEN AN OWNER-RESERVED INVARIANT, OR CREATE AN
UNDELEGATED EXTERNAL, IRREVERSIBLE, OR DESTRUCTIVE COMMITMENT?
NO, AND REVERSIBLE INSIDE THE AUTHORISED ENVELOPE → THE COUNCIL DECIDES.
YES, OR NOT ESTABLISHABLE FROM TREE EVIDENCE → THE OWNER DECIDES.
```

**The routing unit is the transition, never the document.** `current decision →
proposed decision → affected reserved invariants`. The same security ADR may be
*strengthened* by the council, refactored equivalently by the council, and
*weakened* only by the owner — a static per-document label cannot express that,
which is why one is not enough on its own (council 2026-08-19, both seats
convergent).

Two questions it deliberately does **not** collapse into one: *what interests
does this ADR protect* (recorded once, on the ADR) and *what does this specific
amendment do to them* (recorded per reopen, § Reopen record).

Rejected wording, recorded so it is not re-proposed: *"does this keep safety and
purpose intact?"*. Both seats refused it — "safety" is undefined unless tied to
a recorded floor, "purpose intact" can be narratively satisfied while
compatibility or cost changes materially, and it ignores **direction**.

### The owner-reserved set

Reaching the owner is mandatory when the transition does any of:

| # | Reserved | Not reserved (council-decidable) |
|---|---|---|
| 1 | Changes the project's purpose or an owner-declared non-negotiable outcome | Any mechanism choice serving that purpose |
| 2 | **Lowers or removes** a recorded security, privacy, safety, or data-handling floor | Strengthening a floor, or substituting an implementation above the same floor |
| 3 | Is irreversible or materially destructive | Reversible within the authorised envelope |
| 4 | Commits spend or continuing liability **above a delegated threshold** | Budgeted, threshold-bounded spend |
| 5 | Creates, removes, or weakens a legal, regulatory, contractual, licensing, compatibility, or public commitment | Internal-only commitments |
| 6 | Changes reopening authority, quorum, escalation, or the definition of this set (**governance self-amendment**) | Anything the governance rules already permit |
| 7 | Cannot be bounded from available evidence | Bounded, with the evidence cited |

Rows 2 and 4 are narrowed on purpose. "Touches security" and "involves spend"
were both proposed and both rejected as over-broad: they route a routine
hardening or a budgeted call to the owner, which is the blockage this section
exists to remove.

**Council split, abstention, or missing quorum is an escalation *condition*, not
a class.** An otherwise council-decidable transition escalates when the council
cannot reach a decision; it does not become owner-reserved for every future
proposal. `agent-config council:status` decides availability — never a project
file ([`council-availability`](../../src/rules/council-availability.md)).

### The two frontmatter fields

```yaml
protected_dimensions:            # optional; list, any of:
  - purpose | security_floor | privacy_floor | external_commitment | governance | none
reopen_policy: directional | owner | unclassified   # optional; absent → unclassified
```

- `directional` — the discriminator above decides per transition.
- `owner` — a shortcut for a decision whose every transition is reserved
  (purpose statements, the governance rules themselves). Use it sparingly: an
  ADR marked `owner` blocks even a strengthening or consequence-neutral
  amendment, which is the frozen-over-classification failure mode.
- `unclassified` — **the default, and it is not `owner`.** The council may
  investigate, draft a reopen proposal, and run reversible experiments; owner
  approval is required only when the proposed transition may weaken a reserved
  interest or cannot be bounded.

**Why absent resolves to `unclassified` and not fail-closed to `owner`.** Both
council seats rejected the fail-closed default in the same words: it *"would
encode the existing blockage into the new schema"*. With 146 accepted ADRs, an
`owner` default renames "blocked on the owner" to "drafts pending owner
approval" and changes nothing. The residual risk is governance debt — an ADR
that stays `unclassified` forever — and it is accepted here rather than traded
for a certain re-blockage.

**No bulk classification.** Classifying 146 decisions up front is expensive,
error-prone, and invites tendentious self-classification. Classify an ADR when
it is reopened, cited as a blocker, or otherwise on the desk.

### The reopen record

Every council-decided reopen records, at the decision:

1. The **original rationale addressed** — not cited, addressed. A reopen that
   only advocates the replacement has not met the decision it is replacing.
2. What changed since, with tree evidence.
3. Dependants and external commitments touched.
4. The rollback path.
5. **Blast radius** — `narrow | wide | irreversible` — and the evidence for that
   call: files touched, downstream dependants, compatibility impact, rollback
   cost. Never "a similar ADR was called narrow".

```
PRECEDENT CREATES NO AUTHORITY.
THAT A SIMILAR DECISION WAS REOPENED IS NEVER EVIDENCE THAT THIS ONE MAY BE.
EVERY REOPEN IS DECIDED ON ITS OWN MERITS AGAINST THE DISCRIMINATOR.
ONE SEAT MUST ARGUE THE STRONGEST CASE FOR KEEPING THE DECISION.
```

Both clauses answer the failure both council seats named independently —
**precedent laundering through correlated self-review**: the proposer frames the
evidence, two correlated seats ratify, the amendment becomes authoritative input
for the next review, and the original constraint erodes along with the evidence
that supported it. Backlinks preserve traceability; they do not supply
independent challenge, which is what the reaffirmation duty is for.

**Proportional, or it dies of its own weight.** A `narrow`, reversible,
bounded transition takes the light path — reopen record plus council. `wide` or
`irreversible` adds owner notification (notification, not approval, unless a
reserved row fires). Identical ceremony for a typo-level amendment and an
architectural shift costs more than asking the owner, which would reintroduce
the interrupt this section removes.

## Amendments

Amendment is the most common form a reopen actually takes — an ADR is rarely
replaced wholesale, it is corrected in place with its history kept. 18 ADRs in
this tree carry an amendment block, in **three** unreconciled conventions
(`## Amendment N (date)`, `## Amendment — date · topic`, `**Amended <date> —`),
none of them signalled in frontmatter or in the index. The measurable cost:
ADR-035 asserts a rejection in two places that ADR-232 reopened, and ADR-035
contains no reference to ADR-232 — the amendment link is one-sided, so the stale
half is the half a reader finds first.

**The convention, going forward:**

```markdown
## Amendment N (YYYY-MM-DD) — <one-line topic>
```

Plus the reciprocal frontmatter pair, which is what makes the link
bidirectional and therefore findable from the stale side:

```yaml
# on the amended ADR
amended_by: ADR-232
# on the amending ADR
amends: ADR-035
```

The 18 existing bodies are **not** rewritten to the new heading — a corpus-wide
reformat teaches nobody anything and risks the amendment text itself. The
convention binds new amendments; `adr_cite_check` reads all three so the
transition period is not a blind spot.

An ADR whose top half still asserts what its own amendment reversed is a live
defect, not merely untidy prose. Where the reversal is total the amendment
belongs above the reversed text, or the frontmatter link plus a one-line body
banner does the job.

## Per-area README contract

Every `<area>/` directory carries a `README.md` with:

1. One-paragraph area scope (≤ 4 sentences).
2. Single contract pointer — the `docs/contracts/<X>.md` this area implements (or "no published contract" if pre-Phase 5).
3. Numbered table of ADRs in the area: `| # | Title | Status | Date | Supersedes |`. Generated by `./scripts-run src/scripts/audit_adr_coverage --regen-area-readme <area>`.

## Coverage gate

`./scripts-run src/scripts/audit_adr_coverage --check` (also wired to `task lint-adr-coverage`):

- Warns when a `docs/contracts/<X>.md` exists without a matching `docs/adrs/<X>/0001-*.md`.
- Hard-fails on number gaps within an area (e.g. `0001`, `0003` without `0002`).
- Hard-fails on missing `README.md` in any non-empty area directory.
- Warns on dangling `supersedes:` or `superseded_by:` references.

Default mode is **warn** at the consumer surface; **fail** in this package's CI — the `ADR coverage gate` step of `rule-backstops.yml`, alongside `ADR frontmatter + review_trigger` and `ADR index freshness`. Rationale: a new contract dropped without an ADR is a documentation gap, not a bug. Consumer projects opt in by adding the task to their own pipeline.

**Corrected 2026-08-19.** This line used to read "**fail** under `task ci`", and no workflow invokes `task ci` — the gate was reachable from a taskfile nobody ran, so the sentence described enforcement that did not happen. Same for `regenerate_index`, which was called by nothing automated at all, leaving `INDEX.md` staleness ungated. Both are wired into `rule-backstops.yml` now; both exited 0 on the tree at the time of wiring, so the change costs nothing today and catches the next drift.

## Numbering & gaps

- Per-area: 4-digit, gap-free, starts at `0001`. Re-use of numbers is a hard failure in the index regenerator.
- Flat: 3-digit, gap-free, starts at `001`. Existing ADRs in `docs/decisions/` set the precedent.
- A deleted ADR is **never** removed from history — supersede it. The lint surfaces broken supersession chains.

## Relationship to `adr-create` skill

[`adr-create`](../../.agent-src.uncondensed/skills/adr-create/SKILL.md) accepts an optional `<area>` argument (added in step-11 Phase 4 Step 4):

- No `<area>` → flat surface, `docs/decisions/`.
- `<area>` matches inventory → per-area surface, `docs/adrs/<area>/`.
- `<area>` does **not** match inventory → skill refuses with a hint to update the inventory first.

The skill's template, numbering logic, and validation hooks are identical for both surfaces; only the target directory and number padding differ.

## References

- [`docs/adrs/cost/0001-hard-stop-hook.md`](../adrs/cost/0001-hard-stop-hook.md) — first per-area ADR (bootstrap).
- [`docs/decisions/INDEX.md`](../decisions/INDEX.md) — flat surface index.
- [`src/scripts/audit_adr_coverage.ts`](../../src/scripts/audit_adr_coverage.ts) — coverage gate.
- [`src/scripts/adr/regenerate_index.ts`](../../src/scripts/adr/regenerate_index.ts) — index regenerator (works on both surfaces; pass `--dir`).
- an internal parity roadmap (local-only) Phase 4 — origin.
