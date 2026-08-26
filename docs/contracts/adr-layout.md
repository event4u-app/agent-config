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
area: <area>          # per-area records only — see the note below
status: proposed | accepted | challenged | superseded | deprecated | rejected
date: YYYY-MM-DD
decision: <slug>
supersedes: — | ADR-MMM | ADR-MMM, ADR-NNN, …    # a list is legal; see below
superseded_by: — | ADR-MMM
amends: — | ADR-MMM                    # optional; this ADR amends that one
amended_by: — | ADR-MMM                # optional; reciprocal of `amends`
phase: <roadmap-stem> · <phase-id>     # optional but recommended
type: <free-form label>                # NOT an enum — see the note below
review_trigger: >-                     # required on an accepted record
  <the observable condition under which this decision is reopened>
  # `unclassified` is legal on a PRE-EXISTING record during the migration.
  # `terminal`, `none`, `never` and empty are rejected at every stage.
protected_dimensions: [...]            # optional — see § Reopen authority
reopen_policy: directional | owner | unclassified   # optional; absent → unclassified

provenance:                            # see § Provenance and evidence
  kind: human | agentic | mixed | unknown
  decision_makers: [...]
  human_directed: true | false | unknown
  agentic_mode: single | council | delegated   # optional, descriptive only
evidence:
  strength: E0 | E1 | E2 | E3 | E4
  discovery: complete | incomplete     # required when strength is E0
  basis: [...]                         # file:line | URL | CLAIMS id | benchmark id
authority_basis: evidence | owner_intent   # optional; absent → evidence
---
```

Supersession links cross surfaces: a per-area ADR may supersede a flat ADR and vice versa. The numeric prefix in `supersedes:` makes the target unambiguous (`ADR-007` = flat, `ADR-cost-0001` = per-area).

**Corrected 2026-08-21 — this block documented three things the corpus does not
do.** Found by the evidence sweep, and worth recording as a finding rather than
a silent edit, because it is ADR-013's own two-gate lesson turned on the ADR
layout itself: a contract nobody enforces drifts, and the drift is invisible
until someone reads both.

- **`area:` appeared in 0 of 178 flat records.** It was documented as required on
  both surfaces and is carried by neither. Now scoped to per-area records, where
  it is actually written.
- **`type:` was documented as `retrospective | prospective`; the corpus carries
  ten values**, `structural` 130 times against `retrospective` once. Nothing
  validates the field, so the enum was aspirational from the day it was written.
  It is recorded as free-form rather than pretending to a closed set — narrowing
  it to a real enum is a separate decision, and one that has to start from the
  ten values in use.
- **`supersedes:` takes a list**, which the single-value grammar denied: ADR-206
  supersedes sixteen records in one field. The reciprocity check below is
  list-aware for exactly this reason.

`status:` also gains `rejected`, which the validator has always accepted and
this block omitted.

A fourth omission, found in the same review and worth naming separately because
it is the most load-bearing: **`review_trigger` was absent from this block
entirely** while being required on every accepted record by § Reopen authority
and checked by `check_adr_frontmatter`. The field half of this amendment turns
on it, and the schema reference did not mention it. Now it does.

**Scope note on the bulk mandate.** The owner mandate above permits bulk
classification for `provenance` and `evidence` only, with `reopen_policy`
staying classify-on-desk. `review_trigger` falls in neither category and is made
universal by this amendment, so its scope is stated here rather than left to
inference: retrofitting a trigger is **not** a classification of authority or of
evidence — it records a falsifiable condition that either holds or does not, and
a wrong one is refuted by the world rather than argued about. It is therefore
in scope for a bulk pass on the same footing as the descriptive axes. What is
NOT in scope is *inventing* a condition a record does not support: the honest
value there is the transitional `unclassified`, and the sweep records the reason
rather than manufacturing compliance.

## Provenance and evidence

Two **descriptive** axes, added 2026-08-21. They record who decided and how
fact-based the decision is. They are read by
[`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md) and printed
by `adr_cite_check`, and they price the *burden* of a reopen record (below).

```
AN EVIDENCE GRADE IS A MEASUREMENT, NOT A PERMISSION.
IT PRICES REVIEW BURDEN AND PRIORITY. IT CONFERS NO AUTHORITY.
NO PARTY GAINS AUTHORITY FROM A GRADE IT PROPOSED OR BENEFITS FROM.
`reversible-internal` IS ITSELF AN AUTHORITY-BEARING CLASSIFICATION AND IS
NEVER SELF-ASSIGNED BY THE PARTY THAT WOULD ACT ON IT.
AN ADR'S HISTORICAL DECISION-MAKER DOES NOT DETERMINE ITS REOPEN VENUE.
```

The last line matters because the opposite reflex is easy: a record decided by
a council does not need a council to reopen it. Venue comes from the proposed
transition, the affected trust boundaries and the reserved dimensions — the
discriminator below — never from the historical decision-maker.

### `provenance`

- `human` — a human explicitly selected or directed the decision.
- `agentic` — an agent or an AI council selected it without human selection. A
  council is deliberately **not** its own `kind`: epistemically it is agents,
  and a separate class would re-suggest that seats confer a different quality
  of authority. `agentic_mode` records the shape descriptively instead.
- `mixed` — human premise, agent mechanism.
- `unknown` — the migration default. Never infer `human` because the word
  "maintainer" appears in Consequences.

### `evidence.strength`

Claim-relative, never a count of sources. Three models citing three sources
yields E3 **because of the sources**.

| Grade | Meaning | Repo example |
|---|---|---|
| `E0` | Opinion — agent preference, council convergence, intuition | the 44 engine-shaped REJECTs (`engine-reclassification-2026-07.md`) |
| `E1` | One local observation — one incident, consumer, measurement, tree constraint | ADR-048's observed command counts (`ADR-048:30`) |
| `E2` | Repeated or comparative — reproducible comparison, multiple independent incidents, bounded A/B | ADR-229's duplicate work, measured twice (`ADR-229:52`) |
| `E3` | Strong empirical or authoritative practice — pre-registered benchmark, production data, established community standard, applicable vendor guidance | `claims:code-graph-retrieval-null`; "PSR-12 because it is the PHP-FIG standard" |
| `E4` | External constraint — protocol/API compatibility with real consumers, legal obligation, demonstrated security invariant | — |

Even E4 is not "forever": standards change, contracts are retired.

### `evidence.basis` must resolve in a clone

A basis ref is only evidence if the next reader can reach it. Two shapes fail
that test and both exist in the corpus today:

- a path under a **gitignored** tree (`agents/runtime/**`, `internal/reports/**`
  where untracked) — present on the author's disk, absent in every clone;
- a bare URL with no retrieval date, which cannot be distinguished from a page
  that has since changed.

The worked example is ADR-004, found in the 2026-08 sweep: its three named
measurement artifacts are gone even locally, while its council-response JSON is
still on disk — both under gitignored `agents/runtime/`. So the record's
*deliberation* survived and its *evidence* did not, which is the exact inversion
this whole axis exists to prevent. ADR-017 is the counter-case and shows the fix
is cheap: its migration data is tracked under `dist/`.

So: a basis ref points at a **tracked** path, a `docs/CLAIMS.md` claim id, a
benchmark id recorded in a tracked report, or a URL carrying its retrieval date.
A ref that resolves only on one machine is a citation, not a basis, and a grade
resting on one is `E0` with `discovery: incomplete` however confident its prose.

### `evidence.discovery` — required on E0

A bare E0 collapses five different states: evidence absent · evidence existed
but was never cited · cited somewhere non-standard · present elsewhere in the
tree and not found · external and never fetched. The last four are **discovery**
failures, not evidence failures, and a record graded weak because nobody looked
is the cheapest way to manufacture a reopenable lock.

So `discovery: incomplete` is the honest default and the only value permitted
until a defined evidence search has run and found nothing; `complete` asserts
absence and is a claim the author owns.

### `authority_basis`

`evidence` (default) or `owner_intent`. A human product decision does not fake
a grade — it records `strength: E0` with `authority_basis: owner_intent`, and
its authority comes from ownership of purpose rather than from pretend-empirics.

**Mutation policy**, because without one the field is an authorization bypass:
setting or changing `authority_basis` on an existing accepted ADR is itself an
ADR transition. Moving *away from* `owner_intent` takes the owner-reserved
path — it removes an owner's claim on the decision. Moving *to* `owner_intent`
is a strengthening and needs only the standard record. A census may **propose**
a value; it never writes one.

**This policy is review-carried, not validator-enforced, and the distinction
matters because this is the one field that touches authority.**
`check_adr_frontmatter` reads one file at a time and has no repository history
(`grep -E 'execSync|spawnSync'` over it returns nothing), so it can see that a
value IS `evidence` and cannot see that it WAS `owner_intent`. It validates the
value; it cannot validate the transition. An earlier draft of this amendment
implied the validator rejects an unrecorded move away from `owner_intent` — it
does not, and claiming so would have been the same over-claim of enforcement
this contract corrects elsewhere on this page.

What actually catches it: the field is in the diff, so the change is visible to
review, and the owner-reserved path is a human decision either way. A
deterministic check would need a two-ref diff — buildable, not built, and named
here so nobody relies on a gate that does not exist.

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

**Decided 2026-08-26 — `reopen_policy` stays OPTIONAL, and that is a decision
rather than drift** (`road-to-decision-conformance` 1.3). Measured that day: **6
of 202** records declare one. The remaining 196 resolve to `unclassified`, which
`decision-revisit-gate` already treats as *permitting* council investigation and
reversible experiments — so the backlog is governed by a documented default, not
ungoverned.

**The AI council SPLIT 1-1 on this, and the split is recorded rather than
averaged.** Both seats rejected the 196-file backfill outright. The disagreement
was narrower:

- One seat: **keep it optional**, because "required going forward" has no
  reliable enforcement signal — there is no `created_date` field, and an
  `ADR-NNN+` threshold is a magic number that breaks the moment a gap in the
  numbering is filled. Its `revisit-if`: authors are shown to misclassify
  authority, **or** a reliable created-after signal appears.
- The other seat: **required on ADRs introduced in the current diff**, with
  separate corpus and diff validation modes, on the argument that the estate's
  own goal says a decision should *"state its own reopening conditions"* and an
  explicit field makes an author confront the question.

**Optional was taken**, and the reason is the shape of the risk rather than a
preference between the arguments. The dissenting option requires building a new
diff-aware validation mode whose own proposer named its brittleness (a merge base
is not always available), to enforce a field whose absence is already
semantically correct. Taking it would ship a new failure class to remove a
default that works. Taking optional ships nothing and loses nothing that a later
change cannot add.

**The dissent's implementation path is preserved, not discarded:** enforce on
files added in the diff, two validation modes, and three fixtures — a newly
added ADR without the field fails, a legacy ADR without it passes, an invalid
explicit value fails. That is one implementable change away.

*Revisit-if:* the corpus survey shows records being cited as blockers whose
authority nobody classified when it mattered; or a `created_date` (or equivalent)
lands and makes "going forward" enforceable without a magic number; or the
explicit-field experiment is run and produces mostly ceremonial `unclassified`
entries, which would settle it the other way.

**No bulk classification of authority.** Classifying the estate's
`reopen_policy` up front is expensive, error-prone, and invites tendentious
self-classification. Classify an ADR's *authority* when it is reopened, cited
as a blocker, or otherwise on the desk.

**Amended 2026-08-21 — the descriptive axes are exempt under an owner
mandate.** Full clause as it now reads: *classify an ADR when reopened, cited
as a blocker, on the desk, or when executing an owner-mandated evidence
census. Bulk classification requires an explicit owner mandate naming the
census scope, and is permitted for the descriptive axes (`provenance`,
`evidence`) only — `reopen_policy` stays classify-on-desk.*

Two reasons, and the second is the load-bearing one.

The axes are different objects from `reopen_policy`: they are derivable from
the record's own citations and they default conservatively (`unknown`, `E0`,
`discovery: incomplete`) when nothing is cited, so a census that finds nothing
produces an honest low grade rather than a confident one. And a grade confers
no authority (§ Provenance and evidence), which is precisely what made the
original clause's fear apply to `reopen_policy` and not here.

The second reason is measured. Classify-on-desk has produced approximately
nothing: at `492873f09`, `reopen_policy` exists in **1 of 177** flat ADRs and
**0 of 7** per-area records. The decisive detail is that the 2026-08-19 reopen
sweep *was* the on-the-desk moment for twelve records and classified exactly
one — noting in its own words that ADR-216 "is the first ADR to carry the new
fields". Eleven of twelve left the desk unclassified in the very change that
created the mechanism. A mechanism that fires once per twelve opportunities is
not a policy, and the owner mandate (2026-08-21) is what this amendment
records rather than a unilateral widening.

**Every accepted ADR carries a `review_trigger` — staged, never terminal.**
`terminal`, `none`, an empty value and permanence phrasing are invalid at
every stage: "no trigger — terminal decision" is permanence with softer
wording, and ADR-208 is the standing proof that permanence and reopen
conditions do not cohere inside one document. The staging exists because 88 of
the 147 accepted records carry no trigger at all, so a same-day hard
requirement would make the tree invalid on the day the schema landed:

- a new or materially amended accepted ADR needs a substantive trigger now;
- an existing accepted record may carry `review_trigger: unclassified`;
- the exception count is monotonically decreasing;
- superseded and rejected records are historical and need no active trigger.

A trigger must be externally observable and falsifiable. Invalid: "when the
maintainer reconsiders" (a process, not a condition), "when this no longer
makes sense" (subjective), "never". Valid: a named standard withdrawn, a
platform constraint removed, a measured metric crossing a threshold, a stated
objective changing, a regulation amended, the owner explicitly reopening.

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

**Burden priced by evidence grade** (2026-08-21). The discriminator above and
the owner-reserved rows apply on top of this table, unchanged — the grade
changes how much a reopen must *do*, never who may do it.

| Grade × provenance | Reopen record burden |
|---|---|
| `E0`/`E1` · agentic | Lightweight: what changed in one paragraph, the old rationale noted, the rollback path. A snapshot does not earn a trial. |
| `E0`/`E1` · human | Neither a silent obey nor a silent overturn: surface it — "your decision under conditions A/B; C has changed; re-evaluate?" |
| `E2` | The standard record, items 1–5 above. |
| `E3`/`E4` | The standard record **plus** engaging the original evidence in kind: answer a measurement with a measurement or its demonstrated invalidation; answer a standard with the standard's change or a recorded deviation rationale. |
| `authority_basis: owner_intent` | Binding until the owner changes it. The agent may always surface accumulated cost — "this now causes X/Y/Z; still binding; recommend re-evaluation" — as sourced observations, never as a scalar score. |

A **low-evidence record may state a decision; it does not establish that the
alternatives remain invalid.** "We chose B because we had to choose" is a
legitimate and publishable record. Three months later it is not grounds for
"A is forbidden, the ADR says B". `adr_cite_check` prints that distinction at
cite time (`authority_effect: disabled-shadow-mode`) rather than the record
being demoted out of `accepted`.

And what a grade does **not** buy: no row above lets a grade authorize an
action. Whether an independently validated grade may ever reduce the
*authorization* burden is a separate, owner-reserved question, deliberately
not answered here — see the `authority-coupling-decision` blocker in
`road-to-evidence-based-adr-governance`.

## Amendments

Amendment is the most common form a reopen actually takes — an ADR is rarely
replaced wholesale, it is corrected in place with its history kept. 18 ADRs in
this tree carry an amendment block, in **three** unreconciled conventions
(`## Amendment N (date)`, `## Amendment — date · topic`, `**Amended <date> —`),
none of them signalled in frontmatter or in the index. The measurable cost was
ADR-035: it asserted a rejection in two places that ADR-232 had reopened, with
no reference back, so the stale half was the half a reader found first.

**Corrected 2026-08-21 — this paragraph was itself the stale half.** ADR-035
now carries `amended_by: ADR-232` (`:8`), a body banner (`:38-41`) and reopen
markers on **both** assertion sites; the 2026-08-19 sweep records the fix. The
present-tense claim above therefore described the contract's own memory rather
than the tree, which is exactly the failure mode it was written to name — and
it is why an effective-state projection is worth building: a linear read of a
long document surfaces whichever half comes first, and that applies to
contracts as readily as to ADRs. ADR-020 is the live fixture instead: its
2026-07-13 amendment deleted the committed bridge marker and dropped the
`bridge:` back-pointer (`:147`, `:155`) while `:194` still narrates that marker
as a live failure mode.

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

## The conformance loop — what runs it, and what it may block on

Decided 2026-08-26 (`road-to-decision-conformance` 2.4). AI council 2/2 on the
mechanism, after both seats rejected a `stop`-slot hook.

**The survey is `agent-config` → `adr_cite_check --all`.** One row per decision
record: status, successor, `review_trigger` state, `reopen_policy`, and whether
the record is cited anywhere outside `docs/decisions/`. It **reports only** — it
decides nothing and gates nothing.

**Measured on 2026-08-26**, as the baseline any ratchet would start from:

| reading | value |
|---|---|
| decision records surveyed | 202 |
| accepted | 160 |
| records carrying a `review_trigger` | 73 |
| … `fired` / `not-fired` / `indeterminate` | **0 / 0 / 73** |
| accepted records cited outside `docs/decisions/` | 137 of 160 |
| uncited fraction | **14.4 %** |
| declaring `reopen_policy` | 6 |

**`fired` and `not-fired` are both zero, and that is the honest reading rather
than a gap in the tool.** Every `review_trigger` in the corpus is a semantic
condition — prose a human evaluates. A tool that reported `fired` on any of them
would be guessing. The three counts still sum to the carrying count, which is the
invariant that matters: nothing is silently outside the denominator.

**What a gate may block on**, per the council, and deliberately not "the
report is red":

1. tool or parsing failure — the survey could not be produced;
2. an invalid successor state (a dangling or one-sided supersession);
3. a **newly introduced** `indeterminate` trigger;
4. a **worsening** uncited fraction against a checked-in baseline.

**Why a ratchet and not a target.** A target invites ceremonial citations —
someone adds an `ADR-NNN` mention to move a number, and the number stops
measuring discoverability. A ratchet against a recorded baseline only ever asks
"did this change make it worse", which no ceremonial citation improves.

**Both seats rejected a `stop`-slot hook**, and the reason is this repository's
own measured finding: a warn-only surface with no consumer decays. One seat put
the catch-22 plainly — *"if nobody runs it, it never proves its value, so it
never gets run."*

**Honest status: the ratchet is DECIDED, not BUILT.** The survey exists and its
baseline is recorded above. Wiring it as a gate needs a `gate-coverage.yml` row,
a `reportScanned` call and a `--self-test`, which is its own change with its own
review. Saying "a CI ratchet runs the loop" today would describe a gate that does
not exist.

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
