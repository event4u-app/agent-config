---
adr: 279
status: accepted
date: 2026-10-06
decision: no-spend-bound-by-default
supersedes: ADR-230, ADR-237
supersedes_scope: >-
  ADR-230's § Decision table row 3 ("Billable member with no ceiling (both `0`,
  i.e. both disabled) | Ask, as before") and the second bullet of its
  § Alternatives considered, which rejected removing that ask ("'Standing
  authorization' has to be a bound the user actually set, not the absence of
  one"); and the fixed figure `USD 25` in ADR-237 § 3, which becomes "whatever
  ceiling was configured, and none when none was". Nothing else in either
  record. ADR-230's first two table rows, its removal of the duplicate
  per-run confirmation where a ceiling exists, and its `on_overrun`
  consequence stay authoritative; ADR-237's end-to-end grant, its excluded
  list, its blocker taxonomy and its honest-enforcement clause are untouched,
  and § 3's cumulative, pre-authorised, marginal-cost-of-a-subscription-is-zero
  shape survives with the constant replaced by a reference.
superseded_by: —
phase: road-to-a-spend-bound-only-where-one-was-set · Phase 1
type: structural
reopen_policy: owner
protected_dimensions: governance
provenance:
  kind: human
  decision_makers: [owner]
  human_directed: true
evidence:
  strength: E2
  basis:
    - docs/decisions/ADR-230-council-spend-bound-is-a-ceiling.md
    - docs/decisions/ADR-237-end-to-end-execution-authority.md
    - docs/decisions/ADR-268-mission-scoped-authority-persistence-and-ratified-self-amendment.md
    - docs/contracts/cost-enforcement.md
    - docs/contracts/ai-council-config.md
    - src/scripts/ai_council/spend_gate.ts
    - src/agent-src/scripts/gate_budget.ts
    - src/config/agent-settings.template.yml
review_trigger: >-
  A ceiling the package itself defines is found to still apply with nothing
  configured, OR a control kept under § What stays is found to bound money
  rather than plan quota, fan-out or authorisation, OR the owner moves a line
  between the two lists. Discovering that an unbounded run cost more than
  expected does NOT reopen it — that is the directive working as stated, and
  the remedy is to set a ceiling.
---

# ADR-279 — A spend bound applies only where one was set

## Status

Accepted 2026-10-06. Owner-directed, and accepted on the owner's own answer
rather than on any agent's reading of it.

It was drafted `proposed` and held there until the owner answered the blocker
`spend-directive-reading-confirmed` in
`agents/roadmaps/archive/road-to-a-spend-bound-only-where-one-was-set.md`. The answer
was **(a) — accept the record as drafted**, with the three superseded clauses
above and the list under § What stays, by name unchanged; it is recorded as D9
in that roadmap's `## Decisions` table, dated 2026-10-06. The alternative on
offer, (b), was to accept it with one or more lines moved between the two
lists — the paid-gate caps, the unattended budget, the between-round
confirmation, the fast-path cap and the per-day call guards were named as the
candidates. None was moved.

No agent decided this. The owner chose between two drafted readings of their
own directive, and the only agent work left after that answer was landing the
record and the changes it authorises.

## Context

The directive, given on 2026-10-05 during an external comparison round against
an autonomous-runtime tree whose spend tracker ships hourly and daily caps as
constants, in the owner's words: **by default no spend limit is wanted; it is
fine for limits to be settable as an option.**

One layer of this package already behaves that way and several do not.

`cost.budgets.daily`, `weekly` and `monthly` ship `0` with
`enforcement: advisory`, and the contract says "If no budget is configured at
all → exits `0` (fail-open). Never blocks unbudgeted work"
(`docs/contracts/cost-enforcement.md:67-68`). That is the directive, already
implemented.

Against it:

- The council budget bounds in three independent layers — a loader default of
  500,000 input tokens, 200,000 output tokens, 50 calls and USD 20 per
  invocation; a command fallback of 50,000, 20,000 and 10 calls; and the same
  three as constructor defaults. A debate refuses to start above USD 5.
- `0` is documented as disabling a token cap and the call cap
  (`docs/contracts/ai-council-config.md:84-86`) and does not: `_breach`
  compares the token totals with no zero guard while the two USD comparisons
  beside it carry one.
- A paid gate needs **two** caps present before it will run at all; absent
  caps render the entry instead of running it.
- A roadmap run carries the constant `USD 25` in a command and two contexts.
- Three presets print daily, weekly and monthly USD figures, and two
  `mcp.*_max_usd` figures, that no reader compares spend against.
- The spend ledger is appended **only while a daily limit is set**, so the
  measurement the directive keeps depends on the bound the directive removes.
- The one optional hard stop the tree defines cannot fire: the cost preflight
  resolves its budget script relative to the working directory, reads the
  resulting empty output as "no budget configured", and exits 0 on a fixture
  whose recorded exit is 1.

Two of those are recorded decisions pointing the other way, and this record
names them rather than working around them. ADR-230 decided that a billable
member with every cap disabled must still be asked, and explicitly rejected
removing that ask. ADR-237 § 3 fixed the per-run ceiling at USD 25.

A third, later owner record points the same way as the directive and
superseded neither: ADR-268 § 0 lists "Requiring a confirmation for an
operation outside" the typed vocabulary as a break of the declared outcome
(`:120`), and § 8 says of a ceiling that would be crossed that the run "pauses
and reports … It does not ask" (`:241-246`). Council spend is not one of the
eleven typed ops.

## Decision

**No USD or token ceiling that this package defines applies unless a person
set it.** Every such ceiling remains settable, by the value its own contract
documents, and behaves as that contract describes once set.

Three consequences follow, and they are the whole decision:

1. **Estimating and recording spend never depend on a ceiling.** The estimate
   is computed and shown whether or not a bound exists; the ledger is appended
   for every billable response whether or not a daily limit is set. A bound
   decides only whether the recorded total is *compared* against something.

2. **A configured ceiling that would be crossed pauses the run and reports**,
   in the shape ADR-268 § 8 already states for the council. It does not ask.
   Where no ceiling is configured, there is nothing to cross and nothing to
   report.

3. **The absence of a bound is not a reason to ask.** This is the clause that
   supersedes ADR-230's third row. The reasoning there was sound on its own
   terms — asking was the only remaining control once every cap was disabled —
   and the directive answers it at a level that reasoning could not reach: the
   owner does not want the control. An ask that exists because nothing else
   does is still a default spend bound, expressed as friction instead of a
   number.

### What this supersedes, clause by clause

| Record | Clause | Replaced by |
|---|---|---|
| ADR-230 | § Decision, table row 3: "Billable member with no ceiling (both `0`, i.e. both disabled) \| Ask, as before" | No ceiling set, no ask. The estimate is shown as information and the run proceeds — the same treatment row 1 already gives a non-billable run. |
| ADR-230 | § Alternatives considered, bullet 2: "Remove the gate outright. Rejected: a billable member with no ceiling has nothing bounding it. 'Standing authorization' has to be a bound the user actually set, not the absence of one." | The directive is the standing authorisation, and it is a bound the owner actually set — at zero, deliberately, for the whole package. |
| ADR-237 | § 3, the constant `USD 25` in all five of its lines | The configured `cost.budgets` windows, and none where none is configured. § 3's shape is otherwise unchanged: cumulative, pre-authorised, an indeterminate cost estimated conservatively and asked nothing about, a service-enforced impossibility authorised, and a subscription's marginal cost not counted. |
| *(not an ADR)* | The recorded disposition of 2026-08-20 that two paid-gate caps must both exist before a class-1 gate runs — option (a), two seats convergent (`agents/roadmaps/archive/road-to-gate-autonomy.md:490-494`) | Absent caps mean no bound, not a refusal. The caps stay as options, and each bounds alone. `--confirm` is untouched: it is the authorisation, and the caps only ever bounded its size. |

The first three are scoped supersessions and are listed in
`supersedes_scope`. The fourth is a roadmap disposition with no ADR number, so
it is named here in prose and nowhere in the frontmatter.

### What stays, by name

These are not ceilings on money, and the directive does not reach them. The
list is exhaustive for this record's purposes; a control not on it and not
superseded above is unaffected because this record does not mention it.

- **A provider's own refusal** — a quota, rate or billing error still stops the
  step and is surfaced.
- **The per-day call guards** for subscription seats and for the team
  transport. They are sized against a plan quota, not against price, and a
  subscription call has no marginal cost. A `0` in the team transport is
  documented as a block and is not touched.
- **`max_calls` per invocation and the debate round limits**, which bound
  fan-out.
- **The confirmation a class-1 paid gate asks for**, and its two caps as
  options.
- **The debate's between-round confirmation.**
- **The budget an unattended run must be given** — "an absent budget disables
  unattended runs rather than permitting unbounded ones"
  (`src/scripts/_lib/unattended_guard.ts:221-228`). Nobody is present to see
  the estimate, so the estimate is not a control there.
- **The USD cap of the low-impact fast path**, which must be above zero and is
  written as a hard stop that escalates.
- **`api_on_quota: false`, worker token budgets and `subagents.downshift`.**
- **`cost.enforcement: hard-stop`** for a person who configures it and runs the
  preflight.
- **Business spend** — `payment` stays a typed op with its own grant. Nothing
  in this record touches money paid to anyone but a model provider for the
  agent's own tooling.

## Not reopened

The supersession above is scoped, and these live clauses of the two named
records are **not** reopened by it:

- **ADR-230 rows 1 and 2.** A run with no billable member still does not ask,
  and a run with a ceiling still does not ask — this record extends that
  silence to the third row rather than disturbing the first two. Its
  `on_overrun` consequence is also live: where a user sets a cap, a breach
  still hands the decision back per member.
- **ADR-237 everything but § 3's constant.** The end-to-end grant, the
  enumerated excluded list, the `Class: 3` blocker taxonomy, § 3's own
  cumulative-and-pre-authorised shape, and the honest-enforcement clause
  ("Nothing mechanical checks any of this") all stand. This record does not
  add a mechanical check and does not claim one; it removes a constant that
  described a bound nobody configured.
- **ADR-268 in full.** Nothing here supersedes it; § 8's pause-and-report is
  adopted as the behaviour of a configured ceiling, and § 0's prohibition on
  requiring a confirmation outside the typed vocabulary is the reasoning this
  record follows rather than amends.

## Evidence

| Claim | Basis |
|---|---|
| The general cost layer already ships unbounded and fail-open | `src/config/agent-settings.template.yml:263-287` (`daily`/`weekly`/`monthly` at `0`, `enforcement: advisory`); `docs/contracts/cost-enforcement.md:67-68` |
| The council budget bounds in three independent default layers | `src/scripts/ai_council/config.ts:1674-1677`; `src/scripts/council_cli.ts:2563-2565`, `:3079-3081`; `src/scripts/ai_council/spend_gate.ts:38-40` |
| A debate refuses above USD 5 in two places | `src/scripts/ai_council/config.ts:1023`; `src/scripts/council_cli.ts:2130` |
| `0` is documented as disabling a cap and does not disable a token cap | `docs/contracts/ai-council-config.md:84-86` against `src/scripts/ai_council/spend_gate.ts:104-108`, whose two USD comparisons at `:110` and `:113` do carry the guard. Probed at `df377ca64`: a budget with every cap at zero returns `tokens` for a ten-token estimate |
| A paid gate refuses without both caps | `src/agent-src/scripts/gate_budget.ts:241-249`, `:105-109`; the reader at `:114-123` returns nothing unless both are numeric |
| The two paid-gate figures are a recorded disposition, not an ADR | `agents/roadmaps/archive/road-to-gate-autonomy.md:490-494` |
| The run figure is prose in three files and no key | `src/domains/product-basic/roadmap/process-full/command.md:503`, `:506-507`, `:509`; `src/agent-src/contexts/execution/roadmap-execution-contract.md:218`; `roadmap-process-loop.md:337`, `:1007` |
| The ledger depends on a bound | `src/scripts/ai_council/orchestrator.ts:807`; `src/scripts/ai_council/config.ts:294-295` ("disabling it also disables the spend ledger") |
| The optional hard stop cannot fire | `src/scripts/cost/preflight.mjs:19` spawns `scripts/cost/budget.mjs` relative to the working directory; the script lives under `src/scripts/`. The repository's own over-budget fixture records `expected_exit: 1` and the preflight exits 0 |
| ADR-268 points the same way and superseded neither record | `docs/decisions/ADR-268-*.md:120`, `:241-246` |
| The owner's reading is (a), as drafted | Blocker `spend-directive-reading-confirmed`, answered 2026-10-06; recorded as D9 in the roadmap's `## Decisions` table |

Strength `E2`: every claim above resolves to a file and line in this tree, and
the zero-cap behaviour was probed rather than read. The directive itself is
owner intent and carries no strength beyond being the owner's.

## Alternatives considered

- **Keep the ask and raise the default ceiling.** Rejected: the directive
  names the absence of a limit, not its size. A larger constant is still a
  constant nobody chose.
- **Add a `cost.budgets.run` key for the run figure.** Rejected: it would have
  no code reader, and keys that were "configured, documented, surfaced and
  inert" were deleted for exactly that reason
  (`docs/contracts/settings-classes.md:440-449`).
- **Comment the paid-gate keys out of the template.** Rejected: the
  settings-class lint reads a missing leaf as a stale row. The keys stay and
  default to `null`.
- **Fold this into the parked billing-cliff roadmap.** Rejected: that file
  waits on its own entry condition and measures a provider's behaviour, while
  this record removes bounds the package itself defines.
- **Budget tiers, a downgrade ladder or a resource ledger beyond tokens and
  USD.** Rejected: budget routing was retired on 2026-08-16 with nothing
  implemented, and none of network bytes, subprocess seconds or retries has a
  reader.

## References

- `agents/roadmaps/archive/road-to-a-spend-bound-only-where-one-was-set.md` — the
  roadmap that carries this record and the twenty steps that implement it.
- `docs/decisions/ADR-230-council-spend-bound-is-a-ceiling.md` — partially
  superseded; see `supersedes_scope`.
- `docs/decisions/ADR-237-end-to-end-execution-authority.md` — partially
  superseded; see `supersedes_scope`.
- `docs/decisions/ADR-268-mission-scoped-authority-persistence-and-ratified-self-amendment.md`
  — § 0 and § 8, adopted and not amended.
- `docs/contracts/cost-enforcement.md` — the layer that already behaved this
  way.
- `docs/contracts/ai-council-config.md` — the `0`-disables contract that § 2.1
  of the roadmap makes true.
