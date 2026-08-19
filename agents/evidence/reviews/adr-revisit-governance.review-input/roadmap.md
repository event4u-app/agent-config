<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: structural
execution:
  mode: autonomous
---

# Roadmap: ADR revisit governance — a recorded decision is challengeable, not permanent

> Turn "an ADR blocks this" from a full stop into a routed decision: the agent
> must evaluate an ADR before citing it as a blocker, the council decides
> mechanism reopenings, and only an owner-reserved transition reaches the user.

## Prerequisites

- [x] Read `AGENTS.md`, [`adr-layout`](../../docs/contracts/adr-layout.md), and
      [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md).
- [x] `agent-config council:status` reports CONFIGURED (the routing target this
      roadmap builds must have somewhere to route to).

## Context

The owner has demanded, in eleven distinct messages across seven sessions
between 2026-07-25 and 2026-08-19, that recorded decisions be challengeable —
escalating from *"we can overturn ADRs, nothing is fixed forever"* to *"old ADRs
are irrelevant to me"* to naming a specific ADR "bullshit" and demanding every
change it had blocked be unblocked retroactively.

The measured counter-evidence is not disobedience. In **zero** cases did the
agent refuse an explicit overturn instruction. In at least **13** assistant
passages a change was parked or refused citing a named ADR (11 distinct
numbers: 011, 035, 051, 054, 127, 133, 208, 211, 216, 220, 227). Two passages
quantify the effect in the agent's own words — *"60–80 % of every substantive
file is already built, already planned, or forbidden by a lock the file never
read"* and *"roughly two thirds of the recommendations … predominantly
prevented work"*. Both times the agent's lock report is timestamped **before**
the owner's override demand.

So the defect is **ordering**, not permission: the lock holds, the owner must
notice and retroactively void it, and the work resumes. Nothing in the tree
converts "this ADR blocks the change" into "is this ADR still true?".

### What the tree already has (this roadmap builds on it, never rebuilds it)

| # | Existing | Where |
|---|---|---|
| E1 | The doctrine is already anti-permanent — 26 decision-normative sites, **zero** files declaring a decision untouchable | tree-wide sweep |
| E2 | `review_trigger` — a mandatory ADR field holding a *condition*, never a cadence; 60 of 174 carry one | `src/scripts/check_adr_frontmatter.ts:49,95-143` |
| E3 | Council-first is doctrine, and "reopening a recorded decision" is already a listed council class | `src/skills/ai-council/SKILL.md:23-24,38-44` |
| E4 | A complete council-vs-user routing test — eight dispositions, one discriminator, fail-closed, recording duty — **but scoped to roadmaps** | `src/rules/roadmap-progress-sync.md:57-98` |
| E5 | The purpose/mechanism boundary, drawn in prose in one ADR | `docs/decisions/ADR-216-restraint-reanchored-to-capacity.md:47-48,314-317` |
| E6 | A bulk re-evaluation precedent: 44 rejects reclassified RE-OPENED / RE-AFFIRMED / STAY-KILLED under "no silent re-openings, no silent re-affirmations" | `docs/decisions/engine-reclassification-2026-07.md` |
| E7 | One working single-case reopen, on the ADR's own `review_trigger`, landed as an amendment | `docs/decisions/ADR-232-frontier-tier-reopened.md:23-26` |

### The measured gaps this roadmap closes

- **G1 — nothing ever asks whether a `review_trigger` has fired.** The gate
  checks presence and non-cadence form only; its workflow has no `schedule:`;
  nine cron workflows exist and none touches ADRs; zero hooks read the value.
  Canonical proof: `ADR-001:84-86` declares its follow-up decision
  *"**mandatory** before P4.1"*; the precondition shipped, the follow-up never
  happened, the ADR is still `accepted`, `superseded_by: —`.
- **G2 — amendment has no representation.** 18 ADRs carry amendment blocks in
  three unreconciled conventions; no frontmatter field, no index signal, no
  back-link. `ADR-035:39-41,:102` still states a 4th tier is rejected while
  ADR-232 reopened exactly that; ADR-035 contains zero references to it.
- **G3 — ADRs carry no class saying who owns the reopen.** `type:` holds
  `structural | prospective | retrospective | standing`. Consequence in both
  directions: `/optimize:project:161-168` routes *every* lock to the council
  regardless of kind, while nothing marks the ADRs a council must never reopen.
- **G4 — reach.** `decision-revisit-gate` triggers on five keywords and **none
  is "ADR"**; it routes to `decision-review`, which is `install.default: false`
  in a non-default pack; `docs/decisions/` is projected into no agent-visible
  tree, and the always-loaded root file carries 3 ADR links out of 181.
- **G5 — no command may supersede an ADR.** Three offer a path; all three end
  in a recommendation or a roadmap step. No gate *blocks* an ADR edit either —
  the brake is norm and reach, not enforcement.

### Council pass — 2026-08-19, 2 seats, 2 rounds

Artefact: `agents/runtime/council/responses/adr-revisit-governance.md`
(gitignored, local-only). Convergent findings, carried into the phases below:

1. **Cite-time evaluation is the first intervention** — both seats ranked
   `(b) check at citation` above `(c) machine-readable grammar`, `(a) scheduled
   sweep`, `(d) model-only`. Model-only is refuted by this suite's own measured
   Δ=0 on reminder injection.
2. **Legacy ADRs default to `unclassified`, never `owner`** — both seats,
   explicitly: a fail-closed `owner` default *"would encode the existing
   blockage into the new schema"*.
3. **Authority is a property of the proposed transition, not only of the
   document** — a security ADR may be *strengthened* by the council and only
   *weakened* by the owner. A static field alone over-classifies.
4. **User-only set** — purpose · **lowering** a recorded security/privacy/safety
   floor (not every security touch) · irreversible or destructive · spend above
   a delegated threshold (not all spend) · external legal/contractual/
   compatibility/public commitments · governance self-amendment · the council
   cannot decide (no quorum, unbounded blast radius, missing evidence).
5. **Council split is an escalation condition, not a class.**
6. **The named danger is precedent laundering through correlated self-review** —
   the proposer frames the evidence, two correlated seats ratify, the amendment
   becomes authoritative input for the next review. Safeguards in Phase 5.
7. **Do NOT build a full machine-readable trigger grammar as a prerequisite**
   (anthropic's explicit "would not make"); `indeterminate` must be a
   first-class trigger result rather than being forced to a boolean.

Divergence, and how it is resolved here: one seat proposed a two-axis matrix
(constraint class × blast radius), the other a directional test on the
transition. Phase 3 adopts the directional test as the **discriminator** and
keeps blast radius as a **recorded field** on the reopen record — which is what
both seats actually asked for, under two names.

## Phase 1: Reach — make the anti-permanence law fire on the word that blocks

Nothing downstream matters if the rule never loads. G4 is upstream of every
other gap.

- [x] **Step 1:** Add the missing triggers to
      `src/rules/decision-revisit-gate.md` frontmatter — `keyword: "adr-"`,
      `keyword: "adrs"`, `keyword: "superseded"`, `keyword: "review_trigger"`,
      `phrase: "the adr"`. Keep the five existing keywords. **`adr-` and not a
      bare `adr`:** matching is plain lower-cased substring containment, so a
      bare `adr` fires on `adresse`, `quadrat`, `cadre` — the exact false
      positive the transcript scan hit. `adr-` matches every `ADR-NNN` citation,
      which is the shape a lock is actually cited in.
      <!-- verify: grep -c 'keyword: "adr-"' src/rules/decision-revisit-gate.md -->
- [x] **Step 2:** Fix the dangling route named in the rule's See-also: the
      "escalation litmus" heading it cites does not exist in
      `src/skills/decision-record/SKILL.md`. Repointed to **§ 4 Lock the choice
      + consequences**, which carries the `Revisit-if:` obligation. Sibling
      search on the exact wrong construct (a pointer asserting a heading that
      does not exist): `grep -rn "escalation litmus" src/ docs/` → **2 sites**,
      1 was this one, 1 (`docs/contracts/settings-classes.md:454`) claims no
      heading and is correct as written. `check_references` cannot catch this
      class — it validates links, and the link resolved; the heading claim is
      prose, so the verify below is the grep that actually decides it.
      <!-- verify: grep -c "Lock the choice" src/rules/decision-revisit-gate.md -->
- [x] **Step 3:** Close the pack-reach hole. `decision-revisit-gate` is
      `packs: [meta]` (always-on) but routed to `decision-review`
      (`install.default: false`, pack `analysis-workbench`). **Chosen: the
      second branch** — `routes_to` now names `skill:ai-council` and
      `skill:decision-record` (both `packs: [meta]`, always-on), the five steps
      are carried compactly in the rule body, and `decision-review` stays as
      optional depth. Not the install-flip, because forcing a backward-audit
      skill into every consumer install to satisfy one route is a larger
      change than the defect. Linter: 12 → 11 unreachable-route findings, this
      rule no longer among them.
      <!-- verify: npx tsx src/scripts/lint_rule_skill_pack_reach.ts -->
- [x] **Step 4:** Rewrite the rule's routing sentence so the default
      re-evaluation venue is the **council**, not the user — matching
      `ai-council/SKILL.md:23-24` ("goes to the council first, not to the user
      first") and the owner's instruction. The user is reached only via the
      Phase 3 owner-reserved set. Three lines added to the Iron Law (nothing
      removed — `preservation-guard`): council-first, the user always for the
      reserved set, and never cite an unevaluated lock. Rule size 62 → 110
      lines, under the 200-line ceiling.
      <!-- verify: npx tsx src/scripts/validate_frontmatter.ts -->

**Exit criteria:** `check_references` exits 0; the four new keywords are present;
`lint_rule_skill_pack_reach` exits 0.
**Rollback:** revert `src/rules/decision-revisit-gate.md` and any skill
frontmatter touched; no other surface changes in this phase.

## Phase 2: The cite-time precondition — an ADR may not gate work unevaluated

The council's first-change recommendation, from both seats.

- [x] **Step 1:** Write `src/scripts/adr_cite_check.ts`. Input: one or more ADR
      references (`ADR-211`, a path, or a bare number). Output (human + `--json`):
      resolved file · `status` · `review_trigger` verbatim ·
      trigger state `not-fired | fired | indeterminate` · `supersedes` /
      `superseded_by` · amendment blocks found · later ADRs that name it.
      **`indeterminate` is a first-class result** (council finding 7) — a
      semantic condition the tool cannot evaluate resolves to `indeterminate`,
      never to `not-fired`.
      <!-- verify: npx tsx src/scripts/adr_cite_check.ts ADR-001 --json -->
- [x] **Step 2:** Resolve the four secondary ADR surfaces the tool must read —
      `docs/adrs/<area>/` (7), `docs/contracts/adr-*.md` (15),
      `agents/settings/contexts/adr-*.md` (6) — or state in the tool's header
      which it deliberately does not cover and why. A tool that silently sees
      one of six surfaces reports false "not found".
      <!-- verify: npx vitest run tests/scripts/adr_cite_check.test.ts -->
- [x] **Step 3:** Write `tests/scripts/adr_cite_check.test.ts` covering: a
      fired trigger (ADR-001 — its precondition demonstrably shipped), an
      unmet trigger, a semantic trigger → `indeterminate`, a superseded ADR, an
      amended ADR, and an unknown number.
      <!-- verify: npx vitest run tests/scripts/adr_cite_check.test.ts -->
- [x] **Step 4:** Bind the obligation in `decision-revisit-gate`: **no ADR may
      be presented as a reason not to do something until `adr_cite_check` has
      run on it and its result is stated.** A `fired` or `indeterminate` result
      may not be reported as an unqualified lock — it opens the Phase 3 route.
      State honestly that this obligation is model-carried outside the tool
      (`enforced_by: none`), matching the tree's honesty convention.
- [x] **Step 5:** Add the check to `/analyze:decision` and
      `/optimize:project` as the first action whenever a lock is hit, replacing
      the current "report the lock" step.

**Exit criteria:** the tool exits 0 on a known ADR and non-zero on an unknown
one; its test file passes; the rule and both commands name it.
**Rollback:** delete the script + test, revert the rule and the two command
files. No frontmatter or ADR content is touched in this phase.

## Phase 3: Directional authority — who decides is a property of the transition

- [x] **Step 1:** Add to `docs/contracts/adr-layout.md` a normative section
      **"Reopen authority"** carrying: the discriminator — *does the proposed
      transition weaken an owner-reserved invariant, or create an undelegated
      external, irreversible, or destructive commitment?* — and the
      owner-reserved set exactly as the council converged it (context § 4),
      with council-split named as an **escalation condition**, not a class.
- [x] **Step 2:** Extend the ADR frontmatter contract with two optional fields:
      `protected_dimensions:` (list ∈ `purpose | security_floor | privacy_floor
      | external_commitment | governance | none`) and
      `reopen_policy: directional | owner | unclassified`. **A missing field
      resolves to `unclassified`, never `owner`** (council finding 2).
      `unclassified` means: the council may investigate, draft, and run
      reversible experiments; execution of a transition that touches a reserved
      dimension needs the owner.
      <!-- verify: npx tsx src/scripts/check_adr_frontmatter.ts -->
- [x] **Step 3:** Teach `check_adr_frontmatter.ts` the two new fields —
      validate the enums when present, never require them, and never fail an
      existing ADR for their absence.
      <!-- verify: npx vitest run tests/scripts/check_adr_frontmatter.test.ts -->
- [x] **Step 4:** Classify only the ADRs where classification is free of
      judgment: the 24 `superseded` and 2 `rejected` (they gate nothing —
      `reopen_policy: unclassified` is correct and needs no write), and the
      ADRs whose own text already declares a purpose reservation. Everything
      else stays absent → `unclassified`. **Do not bulk-classify 146 ADRs** —
      both seats warned that a mass classification is expensive, error-prone,
      and recreates the blockage under a new name.
- [x] **Step 5:** Record the owner-reserved set in
      `src/rules/decision-revisit-gate.md` as a compact table so the routing
      decision is available without loading the contract.

**Exit criteria:** `check_adr_frontmatter` exits 0 across the corpus with the
new fields optional; the contract section exists and the rule's table matches
it (same rows, same order).
**Rollback:** revert the contract section, the two frontmatter keys, and the
validator change; classified ADRs lose only two optional keys.

## Phase 4: Amendment representation — make a reopened decision visible

- [x] **Step 1:** Pick ONE amendment convention and record it in
      `docs/contracts/adr-layout.md` (three exist today: `## Amendment N
      (date)`, `## Amendment — date · topic`, `**Amended <date> —`). Do not
      rewrite the 18 existing bodies in this roadmap — declare the convention
      and require it going forward.
- [x] **Step 2:** Add `amends:` / `amended_by:` frontmatter keys, mirroring the
      existing `supersedes:` / `superseded_by:` pair, and validate them in
      `check_adr_frontmatter.ts` — including the bidirectional check the
      supersession pair is missing.
      <!-- verify: npx vitest run tests/scripts/check_adr_frontmatter.test.ts -->
- [x] **Step 3:** Backfill the one case the analysis proved live and wrong:
      ADR-035 still asserts a rejection ADR-232 reopened, with zero back-link.
      Add `amended_by: ADR-232` to ADR-035 and the reciprocal `amends: ADR-035`
      to ADR-232, plus a one-line body banner on ADR-035 pointing at it.
      <!-- verify: grep -c 'amended_by: ADR-232' docs/decisions/ADR-035-*.md -->
- [x] **Step 4:** Teach `src/scripts/adr/regenerate_index.ts` to read
      `superseded_by` and `amended_by` and render them — the index today writes
      `| # | Title | Status | Date | Supersedes |` and a dead ADR shows
      `superseded | — `, so the reader learns it is dead but not by what.
      <!-- verify: npx vitest run tests/scripts/adr_regenerate_index.test.ts -->
- [x] **Step 5:** Fix the two defects in `src/skills/adr-create/SKILL.md` the
      analysis found: its `execution.command` calls `regenerate_index` without
      `--dir`, so it targets the non-existent `docs/adr/` and returns 2; and it
      cites `scripts/audit_adr_coverage.py`, a path and extension that do not
      exist (`src/scripts/…​.ts`).
      <!-- verify: npx tsx src/scripts/adr/regenerate_index.ts --dir docs/decisions --check -->

**Exit criteria:** index renders the two new columns; ADR-035 ↔ ADR-232 link in
both directions; the skill's declared command exits 0.
**Rollback:** revert the renderer, the two frontmatter keys, and the ADR-035 /
ADR-232 edits. The index is regenerated output — no history is lost.

## Phase 5: Safeguards against precedent laundering

Both seats named the same failure independently. It is not "less stability" —
it is: the proposer frames the evidence, two correlated seats ratify, the
amendment becomes authoritative input for the next review, and the original
constraint erodes with its evidence.

- [x] **Step 1:** Add to the Phase-3 contract section a **reopen record**
      schema, required on every council-decided reopen: the original rationale
      **addressed** (not merely cited) · what changed since · dependants and
      external commitments touched · rollback path · blast radius
      (`narrow | wide | irreversible`) with the evidence for that call.
- [x] **Step 2:** Write the two clauses the council asked for, verbatim in
      intent: **"precedent creates no authority"** — that a similar ADR was
      reopened is never evidence that this one should be — and **the
      reaffirmation duty** — one seat must argue the strongest case FOR keeping
      the decision, citing its original rationale.
- [x] **Step 3:** Add the proportionality carve-out both seats demanded: a
      bounded, reversible, narrow transition takes the light path (record +
      council); `wide` or `irreversible` adds owner notification. Without this
      the ceremony costs more than asking the owner and the mechanism dies of
      its own weight.
- [x] **Step 4:** Wire the reopen record into
      `src/skills/decision-review/SKILL.md` step 5, which today says "log the
      outcome with scope + revisit-if" and has no schema.

**Exit criteria:** the schema exists in the contract, is referenced from the
skill, and the two clauses are present verbatim in the rule.
**Rollback:** revert the contract section and the skill step; no code changes.

## Phase 6: The backlog — go through what the locks blocked

The owner's explicit instruction: *"overturn the ADR and then go through
everything it blocked. Now, and in the past, and unblock it."* This phase
produces the disposition table, not the downstream work.

- [x] **Step 1:** Run `adr_cite_check` over the 11 ADRs the transcripts show
      blocking work — 011, 035, 051, 054, 127, 133, 208, 211, 216, 220, 227 —
      and record status, trigger state, amendments, and successors for each.
      <!-- verify: npx tsx src/scripts/adr_cite_check.ts ADR-011 ADR-035 ADR-051 ADR-054 ADR-127 ADR-133 ADR-208 ADR-211 ADR-216 ADR-220 ADR-227 --json -->
- [x] **Step 2:** Write `docs/decisions/adr-reopen-sweep-2026-08.md` following
      the E6 precedent exactly: one row per ADR, columns
      `adr | what it blocked | trigger state | disposition | route`, three
      dispositions only — `RE-OPENED (candidate)` / `RE-AFFIRMED` /
      `STAY-KILLED` — under the same Iron Law: no silent re-openings, no silent
      re-affirmations.
- [x] **Step 3:** Resolve ADR-001 specifically. It declares a follow-up
      decision *mandatory* before a milestone that has shipped; it is the
      canonical G1 proof and it is still `accepted`. Give it a disposition in
      the sweep table with its evidence.
- [x] **Step 4:** For every `RE-OPENED (candidate)` row, name the route — a
      council reopen under Phase 3, or an owner decision with the reserved
      dimension named. Do not execute the reopens in this roadmap; a candidate
      list whose routes are named is the deliverable.
- [x] **Step 5:** Fix the two dead gates the analysis found, since the sweep
      depends on them being real: `audit_adr_coverage --check` hangs only off
      `task ci`, which no workflow calls (while `adr-layout.md:83` claims it
      "fails under `task ci`"), and `regenerate_index` is called by nothing
      automated. Either wire them into an existing workflow or correct the
      contract's claim — not both, and say which.
      <!-- verify: npx tsx src/scripts/audit_adr_coverage.ts --check -->

**Exit criteria:** the sweep file exists with 11+1 rows, every row carries a
disposition and a route, and no row is blank.
**Rollback:** delete the sweep file; it is additive and referenced by nothing
until the follow-up work starts.

## Acceptance Criteria

- [x] `decision-revisit-gate` fires on the word "ADR" and routes to a skill a
      pack-legal install actually receives.
- [x] `adr_cite_check` resolves status, trigger state, amendments, and
      successors for any ADR in the primary corpus, with `indeterminate` as a
      first-class result, and its tests pass.
- [x] `docs/contracts/adr-layout.md` carries the reopen-authority
      discriminator, the owner-reserved set, and the reopen-record schema.
- [x] A missing `reopen_policy` resolves to `unclassified`; no ADR is failed by
      a validator for lacking the new fields.
- [x] ADR-035 and ADR-232 link in both directions; the index renders
      `Superseded by` and `Amended by`.
- [x] `docs/decisions/adr-reopen-sweep-2026-08.md` gives all 11 named lock ADRs
      plus ADR-001 a disposition and a route.
- [x] `npx tsx src/scripts/check_adr_frontmatter.ts` and
      `npx tsx src/scripts/check_references.ts` both exit 0.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-19 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Precedent laundering | product | Council reopens a narrow mechanism ADR, then cites that reopen as grounds for a wider one, until an owner-reserved decision falls to a two-seat correlated review. Named independently by both council seats. | "Precedent creates no authority" clause + reaffirmation duty + reopen record naming dependants and rollback; owner notification on `wide`/`irreversible`. | Phase 5: Safeguards against precedent laundering |
| 2 | The classification recreates the blockage | product | If `unclassified` behaves as `owner`, 146 ADRs become "drafts pending owner approval" — the same stall under a new name. | `unclassified` explicitly permits council investigation, drafting, and reversible experiments; only a reserved-dimension transition needs the owner. | Phase 3 Step 2 |
| 3 | `adr_cite_check` reports false "not found" | implementation | Six ADR surfaces exist; a tool reading one reports a real lock as unknown, which reads as "no constraint" and is worse than the current stall. | Step 2 forces either coverage or an explicit written non-coverage statement; test covers an unknown number. | Phase 2 Step 2 |
| 4 | Trigger evaluation asserts certainty it does not have | implementation | Most `review_trigger` values are semantic. Forcing them to a boolean converts uncertainty into permission (`not-fired` → lock holds wrongly) or into false unblocking. | `indeterminate` is a first-class result and routes to review rather than to either boolean. | Phase 2 Step 1 |
| 5 | The obligation is model-carried and decays | implementation | The cite-time precondition has no deterministic enforcement; this suite has measured Δ=0 from reminder injection before. | Ship the tool (deterministic where it runs), state `enforced_by: none` honestly, and wire it into the two commands that hit locks — a command step is a stronger carrier than a rule sentence. | Phase 2 Step 4, Phase 2 Step 5 |
| 6 | Scope creep into the 174-ADR corpus | implementation | Phases 3 and 4 could turn into a corpus-wide rewrite of 146 accepted ADRs. | Phase 3 Step 4 and Phase 4 Step 1 both explicitly forbid bulk rewriting; only ADR-035/232 are edited. | Phase 3 Step 4 |
| 7 | A wrong sweep disposition unblocks something that should stay blocked | product | `RE-OPENED (candidate)` on a lock that was correct wastes work and may reintroduce a rejected design. | The sweep produces candidates and routes only — no reopen is executed in this roadmap; `STAY-KILLED` is a first-class outcome under the E6 Iron Law. | Phase 6 Step 4 |

## Notes

- **Scope boundary.** This roadmap builds the mechanism and produces the
  candidate list. It does **not** execute the reopens, and it does not rewrite
  the 146 accepted ADRs. Downstream reopen work spawns from the Phase 6 table.
- **What the council told us NOT to build**, recorded so a later pass does not
  reintroduce it: a full machine-readable `review_trigger` grammar as a
  prerequisite (most triggers are semantic; cite-time evaluation is
  grammar-agnostic), and a bare `reopen_authority` field defaulting legacy ADRs
  to `owner`.
- **One meta-finding is deliberately deferred**, not dropped: one seat asked
  whether 174 binding ADRs is governable at all, and proposed splitting the
  corpus into ~20–30 binding decisions plus a non-binding decision log. That is
  a purpose decision about what the project's governance *is* — owner-reserved
  by the very rule this roadmap writes — so it is surfaced here rather than
  decided.
