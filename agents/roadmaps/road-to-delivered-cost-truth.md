---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-28
research_pin: "agent-config @ 905087463 (origin/main, 2026-08-28). Every gap below was re-measured at this pin by the /analyze:inbox verification pass; the two items the source round proposed that are already shipped were dropped rather than restated."
relates: []
# relates: grepped every active, later and archived roadmap for `cost`,
# `payload`, `delivery`, `doctor` and `provenance`. archive/road-to-cache-economy
# built the billable-input primitives this consumes and resolved C-1..C-5;
# archive/road-to-standing-payload-truth is closed. The public-claim rewrite is
# deliberately NOT claimed here — see the kill register.
estate_growth_exempt: "Charges +1 active. Warranted on a measurement, not an opinion: the budget ledger records the standing payload at 138,212 tokens against a design ceiling of 107,646 and a published milestone of 102,520 by 2026-11-10, with committed_reduction_mechanism recorded verbatim as NONE. No shipped surface tells a consumer what their configuration costs them per session, no report attributes that cost to the assets that produce it, and no probe answers whether the configuration takes effect on the host at all. A dated published miss with no instrument is the defect this roadmap owns."
estate_offset_exempt: "No archive move is available in this change: the /analyze:inbox run that authored this file consumed only gitignored inbox artefacts and archived no roadmap, so no disposed file can serve as its offset. Its sibling road-to-runtime-context-floors is an addition in the same change and cannot offset it."
---
# Road to delivered cost truth — a consumer can see what their configuration costs, and whether it does anything at all

> **Source:** `agents/tmp.old/context-economy/` — a two-session analysis round
> (2026-08-27) whose external inputs are recorded in the round's own intake
> note and named nowhere here, per `source-confidentiality`. Every claim below
> was re-verified at `905087463`; the source round's proposals that are already
> shipped in stricter form were dropped, not restated, and the drop list is in
> the Context section so a later reader can tell a rejection from an omission.

## Goal

Three answers a consumer of this suite cannot currently get, delivered by
Class-A commands that read what already exists: **what does my configuration
cost per session**, **which assets are producing that cost**, and **is any of
it taking effect on the host I am actually on**. Every number those answers
carry states its evidence basis, drawn from one vocabulary rather than from
four incompatible ones.

The point is not a smaller number. It is that the number, its attribution and
its basis become inspectable — so a reduction can be argued from evidence, and
a published miss becomes a fact with an owner rather than a silence.

## Context

### The measurement this exists for

All read from `src/config/preamble-payload-budget.json` at the pin:

| Field | Value |
|---|---|
| `status_2026_08_24.measured` | **138,212** tokens |
| `ci_delivery.design_ceiling` | 107,646 |
| `ci_delivery.grace_ceiling` / `grace_end_date` | 138,212 · **2026-11-10** (ratchets down only, never up) |
| Published milestone for the same date | 102,520 — `delta_from_target` **35,692** |
| Long-run destination | median 40,000 · p95 50,000 |
| `status_2026_08_24.committed_reduction_mechanism` | **`NONE`**, recorded verbatim, with the file's own note that its absence *is* the finding |

The grace ceiling expires into the design ceiling on 2026-11-10. On that date
either a reduction has landed or a published number is missed. Nothing in this
roadmap promises the reduction; what it builds is the instrument that makes the
cost attributable, which is the precondition for arguing any reduction at all.

### What the source round proposed that is already shipped

Dropped rather than carried, each verified at the pin. Recorded because a
proposal absent from a plan is otherwise indistinguishable from a proposal
nobody read:

| Proposal | Already in the tree |
|---|---|
| Reference-based subagent returns | `src/scripts/_lib/subagent_capsule.ts` — pointers first, per-array caps, transcript exclusion by construction, a pinned epistemic vocabulary. Stricter than the proposal. |
| Recoverable-lossy archiving with link-backs | `src/scripts/fold_intake.ts:13-16` — children never mutated, additive archive page with link-backs. |
| Repeated-read measurement | `src/scripts/hot_context_hook.ts` — per-leg re-read counts rendered as an advisory block. Only the **cost aggregation** survives, as step 1.2. |
| Docs↔surface drift gate | `src/scripts/lint_documented_commands.ts`, fail-closed, pinned by a PR-gating suite. |
| Cache coupling on model downgrade | `docs/contracts/ai-council-config.md:1213-1218` — a downgrade applies only when the model saving beats the forfeited cache reads. |
| `billable_input` discipline | `src/scripts/cache_realization_report.ts` — `input + cache_read + cache_creation`, Class A. |

### Why an effect probe is a separate thing from `doctor`

`src/cli/commands/doctorShell.ts:1-8` states its own scope: Node version,
package-root resolution, and whether the Bash dispatcher exists. That is an
**environment** probe. It cannot answer whether a bound hook actually fires on
this host, which is the question that decides whether any of the configuration
this suite ships is doing anything here — and the tree already documents four
distinct binding states across hosts, so the answer is genuinely per-host and
genuinely not inferable from the manifest.

## Phase 1 — What does this configuration cost

- [ ] **1.1 `config-cost report`, Class A.** One command reading committed
      state and the local ledger: delivered payload for the session, the
      `billable_input` split into fresh input, cache read and cache creation,
      and the cache-read share. No socket, no daemon, no network — the same
      class `cache_realization_report` already occupies.
      verify: the command runs on a fixture ledger and prints all four figures; running it with no ledger prints a stated "no data" reason rather than zeros.
- [ ] **1.2 The honest net-negative line.** When the measured delivered payload
      exceeds what the active profile plausibly returns, the report says so in
      one sentence and names the cheaper profile — rather than reporting a
      large number neutrally and letting the reader assume it is the price of
      value.
      verify: a fixture whose payload exceeds the threshold renders the line naming a specific profile; a fixture below it renders no line at all.
- [ ] **1.3 Re-read cost joins the report.** The per-leg re-read counts
      `hot_context_hook` already emits are aggregated into a token figure in
      the same report, so a repeated read is priced rather than merely noticed.
      verify: a fixture leg with three re-reads of a known file renders a token figure derived from that file's measured size, not a constant.

## Phase 2 — Which assets produce it

- [ ] **2.1 Per-asset delivery ledger.** Body tokens × delivery frequency for
      every skill and rule that reaches standing context, ranked. The
      measurement is the exact tokenizer where it resolves and the character
      proxy where it does not, and the report says which it used — a proxy
      reading within its own error margin of a threshold is reported
      `unresolved`, never classified.
      verify: the ledger's top rows reconcile to within a stated margin of `check_preamble_payload_budget`'s three bucket totals, and every row names its measurement method.
- [ ] **2.2 Every gate names its own "no".** A gate that refuses growth reports
      which asset it refused and what it would have cost, so a refusal is
      legible as a saving rather than as an obstacle.
      verify: a fixture diff that trips the payload ratchet produces a message naming the asset and its token delta.
- [ ] **2.3 The end-of-task summary carries the delivered figure.** One line,
      tokens only. **No currency extrapolation** — the suite does not know the
      consumer's contract, and a fabricated cost is worse than none.
      verify: the summary renders tokens and the string test asserts no currency symbol or per-token rate appears in it.

## Phase 3 — Does any of it take effect here

- [ ] **3.1 `hooks:doctor` — a fixture event per bound slot.** For each slot
      the manifest binds on this host, dispatch a synthetic event and record
      whether the concern ran, whether its output reached the model, and
      whether a deny would have been honoured. The three are distinct and the
      tree already distinguishes them across hosts.
      verify: on a host binding `pre_tool_use`, the probe reports `ran` and a deny verdict; on a host that binds but discards, it reports `ran, output discarded` rather than a bare success.
- [ ] **3.2 One verdict line, four values.** `effective` · `partial` ·
      `inert` · `unknown`. `unknown` is a real answer and is never rendered as
      `effective`; `partial` names which slots are inert.
      verify: three fixture hosts produce three different verdicts, and the fixture with an unprobeable slot yields `unknown` with the slot named.

## Phase 4 — Every number states its basis

- [ ] **4.1 One evidence-basis vocabulary.** A contract enumerating
      `measured` · `estimated` · `inferred` · `provider-reported` ·
      `model-judged` · `unknown`, with one sentence each on what evidence the
      value rests on. The tree currently carries at least two incompatible
      partial vocabularies in unrelated modules; this reconciles them rather
      than adding a third.
      verify: `docs/contracts/evidence-basis.md` exists, and the existing users are migrated onto its values in the same change with their old literals removed.
- [ ] **4.2 The benchmark report states what produced it.** Host binary hash,
      harness commit and dirty flag, and a reproducibility statement become
      required fields in the benchmark report schema. A report that cannot
      supply one names it rather than omitting it.
      verify: `docs/contracts/benchmark-report-schema.md` lists the four as required, and a fixture report missing any one fails schema validation naming that field.
- [ ] **4.3 A parallel-form audit, not a refactor.** The tree carries several
      near-identical shapes for task contracts, artefact references and
      decision ledgers. This step **inventories** them with anchors and states
      for each whether it is a duplicate or a genuine variant. It changes no
      code.
      verify: the inventory exists, every entry carries a `file:line`, and each is labelled `duplicate` or `variant` with a one-line reason.

## Blockers

### blocker: what-the-net-negative-threshold-is

- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 1.2 only. The rest of Phase 1 lands under any answer.
- **What to do:** pick exactly one — (a) a fixed token threshold: simple and
  falsifiable, but any number chosen today is a guess and this repository
  treats an unmeasured threshold as a defect; (b) a ratio against the active
  profile's own declared payload: self-calibrating and needs no invented
  number, but says nothing when a profile declares no payload; (c) emit the
  four figures with no verdict line at all and let the reader judge: cannot be
  wrong, and gives up the one thing 1.2 exists for.
- **Resolved when:** the choice is recorded here and 1.2's fixtures assert it.
- **Recommendation:** (b). It avoids the invented-threshold failure this
  repository's own budget file is careful about, and its silent case is honest
  — a profile that declares no payload genuinely gives no basis for a verdict.
- **If you do nothing:** the report prints a large number with no
  interpretation, which is the state that produced a 35,692-token gap nobody
  acted on.

### blocker: how-far-the-effect-probe-may-reach

- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 3.1 only. 3.2's verdict shape is decided either way.
- **What to do:** pick exactly one — (a) dispatch synthetic events through the
  real hook path: the only way to observe "ran, output discarded", and it
  executes concerns whose side effects are not all provably absent;
  (b) static probe of the manifest plus the host registry: side-effect free,
  and it cannot distinguish `bound` from `effective`, which is the entire
  question; (c) synthetic dispatch restricted to concerns that declare
  themselves side-effect free, with the rest reported `unknown`.
- **Resolved when:** the choice is recorded and 3.1's fixtures assert the
  reachable set.
- **Recommendation:** (c). It buys the real signal where it is safe to take
  and degrades to the honest answer everywhere else, rather than trading the
  whole probe for the parts that are awkward.
- **If you do nothing:** 3.1 degrades to (b) and reports what the manifest
  already says, which no consumer needed a command for.

## Acceptance Criteria

- [ ] AC-1 — A consumer running one Class-A command sees delivered payload,
      the three-way `billable_input` split and the cache-read share for their
      session, or a stated reason why the data is unavailable — never zeros
      standing in for absence.
- [ ] AC-2 — The per-asset ledger reconciles to within a stated margin of the
      payload gate's bucket totals, and every row names whether it was
      measured with the exact tokenizer or the character proxy.
- [ ] AC-3 — A payload-ratchet refusal names the asset and its token delta, so
      the refusal reads as a quantified saving.
- [ ] AC-4 — The effect probe returns one of four verdicts on any supported
      host, `unknown` is never rendered as `effective`, and `partial` names the
      inert slots.
- [ ] AC-5 — `docs/contracts/evidence-basis.md` exists and the previously
      divergent literals are gone from their modules, verified by their
      absence rather than by the contract's presence.
- [ ] AC-6 — A benchmark report missing host binary hash, harness commit,
      dirty flag or reproducibility statement fails schema validation naming
      the field.
- [ ] AC-7 — No surface built here prints a currency figure or a per-token
      rate.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-28 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The report becomes the reduction | product | Building an instrument feels like progress on the 35,692-token gap while the gap is untouched, and the published milestone still misses on 2026-11-10. | The Goal states plainly that no reduction is promised here, and the Context section carries `committed_reduction_mechanism: NONE` verbatim so the gap stays visible beside the instrument rather than behind it. | Goal |
| 2 | Per-asset attribution is wrong and trusted anyway | implementation | A ledger that mis-attributes tokens sends a reduction effort at the wrong assets, and a ranked list is exactly the artefact people act on without re-deriving. | 2.1's verify requires reconciliation against the payload gate's own bucket totals within a stated margin, and every row names its measurement method so a proxy reading is never mistaken for an exact one. | Phase 2 — Which assets produce it |
| 3 | The effect probe executes something it should not | implementation | Dispatching synthetic events through the real hook path runs concerns whose side effects are not all provably absent. | The `how-far-the-effect-probe-may-reach` blocker scopes the first cut to self-declared side-effect-free concerns and reports the rest `unknown`. | Phase 3 — Does any of it take effect here |
| 4 | A fourth evidence vocabulary is added instead of three being reconciled | implementation | Writing a new contract is cheaper than migrating existing callers, and the usual outcome is one more partial vocabulary beside the ones it was meant to replace. | 4.1's verify is the **absence** of the old literals in the same change, not the presence of the new contract. | Phase 4 — Every number states its basis |
| 5 | The parallel-form audit turns into a refactor | product | An inventory that names duplicates invites consolidating them, which is a large behavioural change riding on a documentation step. | 4.3 states it changes no code and its verify asks only for labelled anchors; any consolidation is a separate decision with its own file. | Phase 4 — Every number states its basis |

## What this roadmap will NOT build

- **The public-claim rewrite.** The suite's published no-runtime and
  zero-overhead wording is owned by `road-to-runtime-governance-flip` Phase 3
  and by an in-flight number-truth roadmap on another branch. Claiming it here
  would put two changes on one surface. This roadmap supplies the number that
  rewrite will cite; it does not touch the sentence.
- **A reduction mechanism.** Nothing here shrinks the payload. Naming a
  mechanism this roadmap has not measured would recreate exactly the
  `committed_reduction_mechanism: NONE` situation it exists to make visible.
- **A currency figure.** The suite does not know a consumer's contract, and a
  cost extrapolated from a rate it invented is worse than no number.
- **The fail→fix learning correlator.** A real gap — the existing pattern
  extractor is frequency-based, not correction-based — but it is a learning
  surface, not a cost surface, and it belongs beside the experience loop rather
  than here.
- **A consolidation refactor.** 4.3 inventories parallel forms. Merging them is
  a separate change with its own blast radius.
