---
complexity: structural
status: ready
estate_offset_exempt: >-
  No offset available that this change may honestly take. The estate's other
  13 active roadmaps belong to other sessions; archiving or parking one to buy
  a slot would be a terminal disposition of another session's work, which the
  ratchet's own 67 -> 69 entry names as the incentive it must never create.
  The nearest adjacent roadmap, archive/road-to-adr-revisit-governance.md, is
  already archived — and Invariants Proof 3 records that it closed its ADR-001
  step without producing the follow-up, which is part of why this roadmap
  exists rather than being an amendment to it.
execution:
  mode: phase-checkpoints
---

# Road to evidence-based ADR governance — provenance, E0–E4 evidence grades, full-corpus re-adjudication

> **Source:** Owner instruction, 2026-08-21 (`agents/tmp.old/refactor-adrs.txt`):
> ADRs must be fact-based (community best practice, measurements, tests — never
> council/agent gut feeling alone); mark origin human vs agentic; grade how
> easily each decision may be overturned; question ALL of them; identify
> autonomy blockers for consumer projects and ac. Merged from two independent
> analyses (Claude + GPT, 2026-08-21) across four review rounds, then ruled on
> by a two-seat council. Every load-bearing repo claim re-verified against the
> tree at `492873f09`. External grounding: MADR 4.x confidence/evidence
> metadata (adr.github.io/madr), Azure Well-Architected ADR guidance ("record
> the confidence level of the decision"), AWS prescriptive ADR guidance
> (two-way-door speed vs one-way-door analysis), GRADE's separation of
> evidence certainty from recommendation strength, Thoughtworks EA playbook
> (governance should enable autonomy, not centralize decisions).
>
> **Reconciliation note (recorded so it is not re-litigated):** one analysis
> proposed a static `change_resistance: R0–R3` per document. Rejected —
> `adr-layout § Reopen authority` already decided, council-convergent
> 2026-08-19: *"The routing unit is the transition, never the document …
> a static per-document label cannot express that."*
>
> **Rounds 2–4** resolved: provenance shape (`human | agentic | mixed |
> unknown`, not a `council` class), claim-relative evidence grades instead of
> an evidence-class count, the council-first residue, the blocking Phase 0,
> the per-area frontmatter gap, and four census corrections. Their findings
> survive below as Invariants proofs and as Phase 1.5.
>
> **Round 5 — two-seat council, convergent, and it vetoes the previous core.**
> Both seats named the same self-contradiction: v4 claimed "evidence grade
> prices the reopen burden; it never changes reopen authority" while also
> ruling "agentic + E0/E1 + reversible-internal ⇒ agent may supersede
> directly". Those cannot both hold — if E2→E1 changes whether an agent may
> supersede, the grade **is** an authorization input, and calling the result
> "provisional" changes neither the trust boundary nor the blast radius. The
> architecture is therefore re-cut (§ Architecture): evidence grade affects
> **prioritization and required review material only**; any authority
> consequence is a separate, later, default-off decision gated on a shadow
> trial. Also adopted from round 5: the authority-integrity invariant,
> staged `review_trigger: unclassified` migration, an `authority_basis`
> mutation policy, structured-observation blocking cost, an
> externally-adjudicated gold sample (agreement is not accuracy), a defined
> rollback unit, and the disposition `INSUFFICIENT-EVIDENCE-TO-CLASSIFY`.
>
> **Status.** `ready`: Phase 0A is discharged by the source instruction and
> Phases 1–6 are executable now. The two owner-reserved items — Phase 0B and
> Phase 7 — are `[~]` with named blockers, so the roadmap does not close until
> the owner rules on them.

## Goal

ADR authority derives from current evidence, reversibility, external
commitments, and explicit owner intent — never from the mere existence of an
accepted file, and never from agents agreeing with each other.

Concretely, when this is finished: every accepted ADR carries machine-readable
`provenance` and `evidence` (E0–E4) plus a substantive `review_trigger`; the
full corpus (184 records) has one recorded challenge disposition each, with no
silent re-openings and no silent re-affirmations; every confirmed autonomy
blocker is reopened, amended, or re-affirmed with its blocking cost stated as
sourced observations; permanence language and council-consensus-as-evidence
are linted out of new records; the grade influences **review burden and
prioritization only**, with any coupling to authority decided separately in
Phase 7 on measured evidence and shipped default-off behind a kill switch.

## Architecture — the load-bearing separation

```
EVIDENCE GRADE IS A DESCRIPTIVE MEASUREMENT. IT PRICES REVIEW BURDEN AND
PRIORITY. IT CONFERS NO AUTHORITY UNTIL PHASE 7 SAYS SO, ON MEASURED
EVIDENCE, DEFAULT-OFF, BEHIND A KILL SWITCH.
```

Three layers, deliberately decoupled so a failure in one does not silently
become a failure in the next:

| Layer | Ships in | Can it change who may act? |
|---|---|---|
| **Metadata** — `provenance`, `evidence`, `authority_basis`, `review_trigger` | Phases 1–3 | No |
| **Surfacing** — census, `adr:effective`, cite-time output, sweep artifact | Phases 2–4 | No |
| **Authority** — grade-derived reopen routing | Phase 7 only, default-off | Yes, once enabled |

The previous draft fused all three. That fusion is what both council seats
refused, and the repo has the receipt: the 44 engine-shaped REJECTs were
*correlated agreement* treated as evidence, and only measurement disposed of
the feature. A design that lets an agent assign a grade and then draw
authority from it reproduces that failure with better metadata.

## Invariants

```
COUNCIL CONSENSUS IS NOT EVIDENCE. AGENT CONSENSUS IS NOT EVIDENCE.
AN ADR FILE IS NOT EVIDENCE.
N MODELS AGREEING DOES NOT RAISE evidence.strength — SOURCES AND
MEASUREMENTS DO.

NO PARTY GAINS AUTHORITY FROM A GRADE IT PROPOSED OR BENEFITS FROM.
`reversible-internal` IS ITSELF AN AUTHORITY-BEARING CLASSIFICATION AND IS
NEVER SELF-ASSIGNED BY THE PARTY THAT WOULD ACT ON IT.

AN ADR'S HISTORICAL DECISION-MAKER DOES NOT DETERMINE ITS REOPEN VENUE.
VENUE IS DETERMINED BY THE PROPOSED TRANSITION, THE AFFECTED TRUST
BOUNDARIES, THE RESERVED DIMENSIONS, AND — ONLY ONCE PHASE 7 ENABLES IT —
AN INDEPENDENTLY VALIDATED EVIDENCE ASSESSMENT.

A LOW-EVIDENCE ADR MAY RECORD A DECISION.
IT MAY NOT ESTABLISH THAT ALTERNATIVES REMAIN INVALID BY ITS EXISTENCE ALONE.

A HUMAN PRODUCT DECISION MAY BE AUTHORITATIVE WITHOUT BEING AN
EMPIRICAL FACT. RECORD IT AS owner_intent — NEVER FAKE EVIDENCE FOR IT.

EVERY ADR MAY BE QUESTIONED. NOT EVERY ADR MAY BE AUTONOMOUSLY OVERTURNED.
QUESTIONING ALL OF THEM DOES NOT REQUIRE CLASSIFYING ALL OF THEM —
`INSUFFICIENT-EVIDENCE-TO-CLASSIFY` IS AN HONEST DISPOSITION.
```

**Proof 1 — consensus is not evidence.** 44 engine-shaped REJECT records
accumulated 2026-06-01 → 2026-07-22 under an over-broad council-carried
interpretation (`engine-reclassification-2026-07.md` header); the first engine
actually built and measured returned an honest null — recall 0.365 vs
disciplined grep 0.797, pre-registered and hash-bound (`docs/CLAIMS.md`
`code-graph-retrieval-null`). Measurement disposed of the feature; council
agreement had carried the rejects. **Hypothesis → experiment → measurement →
decision**, not agent → council → convergence → law. Round 5 sharpened what
this proves: the failure was *correlated agreement*, so a council cannot serve
as the independent validator of a grade either.

**Proof 2 — classify-on-desk produces approximately nothing.** Verified at
`492873f09`: `reopen_policy` exists in exactly **1 of 177** flat ADRs and
**0 of 7** per-area records (`grep -rln '^reopen_policy:' docs/decisions/
docs/adrs/` → ADR-216 only); `protected_dimensions` likewise. The decisive
detail: the 2026-08-19 sweep *was* the classify-on-desk moment for twelve
records — and classified exactly one, noting in its own words that ADR-216
"is the first ADR to carry the new fields". Eleven of twelve left the desk
unclassified in the very change that created the mechanism.

**Proof 3 — prose lifecycle enforcement is satisfied by its weakest honest
reading.** The archived predecessor roadmap checked its step "Resolve ADR-001
specifically" as `[x]`
(`agents/roadmaps/archive/road-to-adr-revisit-governance.md:320`) — and the
checkbox is honest, because that step's own text operationalized "resolve" as
"give it a disposition in the sweep table", which happened. The sweep row it
produced states in its own words that "the follow-up ADR was never written",
and ADR-001 remains `accepted`, `superseded_by: —` today. A candidate row
without a dated follow-up is a parking spot. Enforcement must be mechanical
(3.4), never prose.

## Prerequisites

- `docs/contracts/adr-layout.md` — reopen authority, the reopen record,
  `reopen_policy`/`protected_dimensions`, and the `No bulk classification`
  clause at `:153`. This roadmap amends it; governance self-amendment is
  owner-reserved (its own row 6), which is what Phase 0A settles.
- `docs/decisions/adr-reopen-sweep-2026-08.md`,
  `docs/decisions/engine-reclassification-2026-07.md` — the two sweep
  precedents whose shape Phase 3 follows.
- ADR-237 — capability-before-role doctrine; Phase 4 applies its test to the
  corpus.
- Tooling touched: `src/scripts/check_adr_frontmatter.ts`,
  `src/scripts/adr_cite_check.ts`, `src/scripts/adr/regenerate_index.ts`,
  `src/scripts/audit_adr_coverage.ts`, `src/scripts/lint_provenance_vocabulary.ts`,
  `src/skills/adr-create/`, `src/skills/decision-record/`,
  `src/skills/decision-review/`, `src/rules/decision-revisit-gate.md`.
- **Three independent frontmatter parsers exist** and must not become four:
  `check_adr_frontmatter.ts:155`, `adr_cite_check.ts:182`,
  `adr/regenerate_index.ts:110` (the last regex-based, no fold support).
  Phase 2.0 extracts one shared reader first.
- **`adr_cite_check` has no CI gate** — no workflow invokes it; only a test
  imports it. Every "enforced at cite time" claim in this roadmap is therefore
  model-carried until 2.3 wires it, and is stated that way rather than
  implied.
- `agents/roadmaps/road-to-user-out-of-the-loop.md` — verified: it cites
  **zero** ADRs as blockers (its only ADR reference, ADR-115 at `:120`, is a
  factual note; its two `## Blockers` name a kernel soak window and a defaults
  sheet). The v4 blocker-lane row built on it was a phantom and is deleted.

## Phase 0A — Governance ratification (discharged by the owner instruction)

Amending `adr-layout`'s `No bulk classification` clause is governance
self-amendment — owner-reserved by that contract's own row 6. It is
**discharged by the source instruction rather than re-asked**, because the
owner directed exactly this change in the owner's own words:

DE (verbatim owner instruction, quoted because the mandate is what it
discharges) · EN (translation follows):

> "Vielleicht können wir auch ein ADR-Level einführen, dass Agent ADR's (oder <!-- md-language-check: ignore -->
> auch human) mit einem Level kennzeichnet, wie leicht es gekippt werden <!-- md-language-check: ignore -->
> kann" · "Adrs Kennzeichen ob human oder agentic" · "Ich will, dass wir ALLE <!-- md-language-check: ignore -->
> hinterfragen." <!-- md-language-check: ignore -->

EN: "Perhaps we can also introduce an ADR level that marks agent ADRs (or human
ones) with a level for how easily they can be overturned" · "Mark ADRs as human
or agentic" · "I want us to question ALL of them."

What that discharges, precisely: introducing the two descriptive axes, and
permitting a bulk census under an owner mandate. What it does **not**
discharge is anything in Phase 0B, or the Phase 7 authority question.

- [x] **0A.1 Amend the `No bulk classification` clause and record the mandate.**
      Replacement wording: *"Classify an ADR when reopened, cited as a
      blocker, on the desk, or when executing an owner-mandated evidence
      census. Bulk classification requires an explicit owner mandate naming
      the census scope, and is permitted for the descriptive axes
      (`provenance`, `evidence`) only — `reopen_policy` stays
      classify-on-desk."* The amendment cites Proof 2 as its evidence and
      quotes the instruction above as its mandate.
      verify: `adr-layout.md` amendment merged per its own Amendment
      convention, naming both the mandate quote and Proof 2's grep output.

## Phase 0B — Autonomy owner batch (gates only its own rows) `[~]`

Hard-Floor transitions. The source instruction authorized an ADR-governance
change; it did **not** authorize widening agent write authority, so these are
not discharged with it and no delegation lifts them
(`non-destructive-by-default`). Batched into one sitting when the owner wants
it — the owner asked to be asked, not dripped on. **Nothing in Phases 1–3, 5,
or 6 waits on 0B**; only blocker-lane rows 1, 2 and 6 do.

- [~] **0B.1 Rule on the commit-policy fence vs the delegation shape.**
      `src/rules/commit-policy.md:37` ("A ONE-OFF AUTHORIZATION IS SPENT ON
      EXACTLY THAT OPERATION, ONCE") interrupts every commit outside a
      `process-full` run; ADR-237 § 1 pre-clears it only for its own run.
      Question: does any explicit, this-turn, single-deliverable delegation in
      a consumer project pre-clear commit/push for that run?
      verify: ruling recorded; yes → blocker row 1 executes; no → RE-AFFIRMED
      with blocking cost stated as sourced observations.
- [~] **0B.2 Rule on ADR-005 § 1 (no auto-merge of ranked candidates).**
      ADR-005 predates ADR-237's authority model; competitive runs terminate
      at a human merge even for integration branches. Question: may an
      end-to-end delegation cover integration-branch merges of judge-ranked
      candidates, with trunk staying excluded?
      verify: ruling recorded, same consequence shape as 0B.1.
- [~] **0B.3 Resolve the ADR-211 status contradiction.** ADR-211 Amendment E
      ("the freeze is lifted in full", 2026-08-05) and ADR-216's Consequences
      agree the freeze is gone; the 2026-08-19 sweep still carries ADR-211 as
      `RE-OPENED (candidate)`, owner-routed, "Partially resolved". Two
      readings: (a) the sweep row is stale — close it with a back-reference;
      (b) a residual purpose question (may adoption ever return as a goal?)
      is genuinely open — then record *that* question as its own line,
      detached from the lifted freeze.
      verify: sweep row closed or replaced; ADR-211 history appended.

## Phase 1 — Schema: two descriptive axes, staged so the tree stays valid

- [x] **1.1 Add `provenance` to the shared frontmatter (`adr-layout.md`
      § Frontmatter, `:46-68`).**

      ```yaml
      provenance:
        kind: human | agentic | mixed | unknown
        decision_makers: [...]        # e.g. [owner] / [claude-sonnet-4-5, gpt-4o]
        human_directed: true | false | unknown
        agentic_mode: single | council | delegated   # optional, descriptive only
      ```

      `human` = a human explicitly selected or directed the decision.
      `agentic` = agent or council selected without human selection — a
      council is deliberately **not** its own provenance kind: epistemically
      it is agents, and a separate class would re-suggest that seats confer a
      different quality of authority. `agentic_mode` records the shape
      descriptively without creating that class. `mixed` = human premise +
      agent mechanism. `unknown` = the migration default; never infer `human`
      because "maintainer" appears in Consequences.
      verify: schema merged; `check_adr_frontmatter` accepts a fixture per
      kind, rejects an unknown value, and rejects a missing `kind` on a
      *newly added* accepted ADR only.
- [x] **1.2 Add `evidence` + `authority_basis`, with a discovery qualifier.**

      ```yaml
      evidence:
        strength: E0 | E1 | E2 | E3 | E4
        discovery: complete | incomplete     # required when strength is E0
        basis: [<typed refs: file:line | URL | CLAIMS id | benchmark id>]
      authority_basis: evidence | owner_intent   # default: evidence
      ```

      - **E0 opinion** — agent preference, council convergence, intuition.
        Repo example: the 44 engine rejects.
      - **E1 local observation** — one incident, one consumer, one
        measurement, one tree constraint.
      - **E2 repeated / comparative** — reproducible comparison, multiple
        independent incidents, bounded A/B. Repo example: ADR-229 (duplicate
        work measured twice — PR #1277/#1280 and #1280/#1281, ADR-229:52).
      - **E3 strong empirical / authoritative practice** — pre-registered
        benchmark, production data, established community standard, vendor
        guidance whose rationale applies. The PSR-12 case: "we use PSR-12
        because it is the PHP-FIG community standard" cites an external
        standard → E3; adding a repo-local measurement keeps it E3 with a
        better basis, because grade is claim-relative and not a source count.
        Repo example: `code-graph-retrieval-null` (CLAIMS.md, hash-bound).
      - **E4 external constraint / invariant** — protocol or API
        compatibility with real consumers, legal obligation, a demonstrated
        security invariant. Even E4 is not "forever" — standards change.

      **`discovery` is the round-5 fix for a collapsed distinction.** A bare
      E0 conflates five different states: evidence absent · evidence existed
      but was never cited · cited in a non-standard place · present elsewhere
      in the repo and not found · external and never fetched. The last four
      are discovery failures, not evidence failures. `discovery: incomplete`
      is the honest default until a defined evidence search has run and found
      nothing; only `complete` asserts absence.

      A human purpose decision does not fake a grade: `strength: E0` +
      `authority_basis: owner_intent`. **Fixture correction:** ADR-216 is the
      only record in the tree carrying the reopen fields at all; ADR-108 is
      owner-shaped in prose only (`:16` "maintainer decision") and carries
      none — so it is a conversion target, not a fixture, and a
      frontmatter-keyed sweep would miss it. `owner_intent` is a new token:
      `grep -rn owner_intent docs/ src/` returns zero today.

      **`authority_basis` mutation policy** (round 5 — without it the field is
      an authorization bypass, since an agent could reclassify a disputed
      decision as `owner_intent`, or out of it): setting or changing
      `authority_basis` on an existing accepted ADR is itself an ADR
      transition and takes the owner-reserved path when it moves *away from*
      `owner_intent`. Moving *to* `owner_intent` is a strengthening and needs
      only the standard record. A census may **propose** the value; it never
      writes it.
      verify: schema merged; `check_adr_frontmatter` rejects an E0 record
      without `discovery`, and rejects an `authority_basis` change away from
      `owner_intent` that carries no owner record.
- [x] **1.3 Require a substantive `review_trigger` — staged, not day-one
      fatal.** 88 of the 147 accepted records carry no trigger at all
      (`492873f09`), so an immediate hard requirement would make the tree
      invalid on the day the schema lands, and would force S and B into one
      PR. Round 5's staging:

      - a new or materially amended accepted ADR needs a substantive trigger
        immediately;
      - existing accepted records may carry the transitional
        `review_trigger: unclassified`;
      - `terminal`, `none`, an empty value, and permanence phrasing are
        **invalid at every stage** — "no trigger — terminal decision" is
        permanence with softer wording, and ADR-208 is the standing proof
        that permanence and reopen conditions do not cohere in one document;
      - the exception count is monotonically decreasing, with an
        owner-approved deadline;
      - superseded and rejected records are historical and need no active
        trigger.

      A trigger must be externally observable and falsifiable. Invalid:
      "when the maintainer reconsiders" (a process, not a condition), "when
      this no longer makes sense" (subjective), "never". Valid: a named
      standard withdrawn, a platform constraint removed, a measured metric
      crossing a threshold, a stated objective changing, a regulation
      amended, the owner explicitly reopening.
      verify: lint accepts `unclassified` on an existing record, rejects it
      on a newly added one, rejects `terminal`/`none`/empty everywhere; the
      exception count is emitted as a number the ratchet can hold.
- [x] **1.4 Permanence-language lint — extend, do not add a script.**
      `forever`, `permanently`, `never revisit`, `never reconsider`, `settled
      forever` are forbidden in new mechanism ADRs; allowed only when scoped
      to a genuine external invariant *and* accompanied by the condition
      under which that invariant stops applying. The host is
      `src/scripts/lint_provenance_vocabulary.ts`, whose own header names it
      "the single place to widen `SCAN_ROOTS`" — a new gate script would cost
      seven wiring surfaces (`scanned:` line, `gate-coverage.yml` row,
      `gate_ledger`, `assertScanned`, `ci-local-parity.yml`, a workflow step,
      a Taskfile task) for the same coverage.

      Canonical fixture ADR-208: title "kept forever", Decision `:52` "KEEP —
      permanently", own frontmatter `:10-11` carrying reopen conditions.
      Four further live hits verified at `492873f09`, each needing a
      disposition rather than a blanket rewrite: ADR-108 `:12`/`:24` and
      ADR-107 `:37` ("open-source forever" — an owner purpose statement, so
      `authority_basis: owner_intent` is the correct rewrite, not deletion),
      ADR-122 `:77`, ADR-124 `:229`.
      verify: lint fires on an ADR-208-shaped fixture and stays silent on an
      externally-scoped invariant with its stop-condition; the five live hits
      are listed in the Phase 3 artifact with a disposition each.
- [x] **1.5 Convert the 7 per-area records to YAML frontmatter.** Per-area
      ADRs (`docs/adrs/<area>/NNNN-*.md`) carry no YAML frontmatter at all —
      metadata lives in a blockquote line (`> Area: … · Status: accepted ·
      Date: …`). `adr_cite_check` already declares them `PARTIAL_COVERAGE`
      for exactly this reason (`:89-91`), so this is a pre-existing tooling
      gap, not one this roadmap creates. Decided here rather than discovered
      mid-backfill:
      (a) **convert to YAML frontmatter** (chosen): one metadata format for
      the estate; the census, `adr:effective` and `check_adr_frontmatter` all
      need machine-readable fields, and a second meta-format forks every
      parser forever. Touched surface: `audit_adr_coverage.ts`
      (`--regen-area-readme` plus its blockquote reader) and the area README
      tables it regenerates; the blockquote line may stay as a
      human-readable duplicate for one transition release.
      (b) extend the blockquote grammar — no churn now, permanent
      dual-parser cost later. Rejected unless (a) uncovers a consumer of the
      blockquote format outside `audit_adr_coverage.ts`.
      verify: all 7 per-area records parse through the same reader as flat
      ADRs; `--regen-area-readme` output byte-identical in its existing
      columns; coverage audit green.

## Phase 2 — Tooling (surfacing only; no authority)

- [x] **2.0 Extract one shared ADR frontmatter reader into
      `src/scripts/_lib/`.** Three parsers exist and diverge:
      `check_adr_frontmatter.ts:155`, `adr_cite_check.ts:182` (the only one
      handling a bare `>-` fold marker), `adr/regenerate_index.ts:110`
      (regex, scalar-only). `provenance` and `evidence` are nested with
      lists, so every axis added without this step is paid for three times,
      and `regenerate_index` would silently read them as empty.
      verify: all three call sites use the shared reader; a nested-plus-list
      fixture round-trips identically through each; existing tests green.
- [x] **2.1 `src/scripts/adr/evidence_census.ts` — proposal-only pre-grader.**
      Scans each record for markers (CLAIMS.md links, benchmark ids,
      pre-registration refs, dated measured numbers, external-standard
      citations, council-disposition lines, "owner decision") and emits a
      *proposed* provenance + grade per record with the matched lines as
      provenance, plus `discovery: incomplete` wherever it has not run a
      defined search. Output is a review artifact, never a write — an agent
      grading its own homework unreviewed is the failure the original
      bulk-classification clause feared, and round 5's structural objection
      is the same failure one layer up. Defaults: provenance `unknown`,
      strength `E0`, `discovery: incomplete`.
      verify: runs over all 177 flat + 7 per-area records and emits
      `scanned: 184`; spot-check anchors match independent reads
      (ADR-106/110/126/128/202/217/223/227 → E2/E3 with a real basis ref;
      ADR-046/047 → E0; ADR-048 → E1 on its observational anchor;
      ADR-216 → owner_intent; ADR-229 → human/E2).
- [ ] **2.2 Effective-state projection: `agent-config adr:effective ADR-NNN`.**
      Emits status, effective decision, superseded clauses, active
      amendments, provenance, evidence, review trigger and trigger state — so
      an agent never reconstructs current truth from linear prose. Registering
      the verb touches eight surfaces (`_dispatch.bash` usage block +
      `cmd_` fn + case branch, `src/cli/registry.ts`,
      `src/config/evaluator-budgets.json` 101→102,
      `agents/evidence/metrics/evaluator-measurements.json`, the
      implementation, and the registry test) — budgeted, not discovered late.

      **Fixture correction (round 3/4 finding).** ADR-020 stays the primary
      fixture: its 2026-07-13 amendment deleted the committed bridge marker
      and dropped the `bridge:` back-pointer (`:147`, `:155`) while `:194`
      still narrates that marker as a live failure mode. ADR-035 is **no
      longer** a fixture — it now carries `amended_by: ADR-232` (`:8`), a body
      banner (`:38-41`) and reopen markers on both assertion sites. The stale
      half moved into the contract: `adr-layout.md:198-200` still asserts in
      the present tense that "ADR-035 contains no reference to ADR-232". That
      line is a defect this roadmap fixes, not evidence it can cite.
      verify: `adr:effective ADR-020` reports the marker clauses as
      superseded; `adr-layout.md:198-200` corrected in the same change; CI
      fixture red on a planted current-vs-amendment contradiction.
- [x] **2.3 Cite-time surfacing — shadow mode, and wired.** `adr_cite_check`
      prints provenance kind, grade, discovery state and authority basis, and
      for an accepted agentic E0/E1 record emits:

      ```text
      ADR-XYZ · provenance: agentic · evidence: E1 (discovery: incomplete)
      authority_effect: disabled-shadow-mode
      This record documents the prior choice. It does not by itself
      establish that alternatives remain invalid.
      ```

      `authority_effect: disabled-shadow-mode` is round 5's wording and the
      choice is deliberate: v4's `authority: provisional` would activate a
      semantic through presentation before Phase 7 has decided it exists.

      The gate itself is the honest half: **no workflow runs
      `adr_cite_check` today**. This step wires it into
      `rule-backstops.yml` next to the three existing ADR gates, with a
      `gate-coverage.yml` row, a `scanned:` line, `gate_ledger` adoption,
      `assertScanned`, and a `ci-local-parity.yml` declaration — otherwise
      "enforced at cite time" stays a claim.
      verify: check output on an accepted agentic E0 record shows the block;
      the new workflow step runs it; `check_gate_coverage` green on its row.
- [ ] **2.4 Index and README columns.** `regenerate_index.ts` gains
      `Provenance` and `Evidence` columns (`HEAD` `:34-36`, `row()`
      `:189-198`); `audit_adr_coverage.ts` `render_area_readme()` `:239`
      follows for the per-area tables. Both are byte-compared by
      `--check` gates, so the regenerated `docs/decisions/INDEX.md` and area
      READMEs ship in the same commit.
      verify: `regenerate_index --check` and `audit_adr_coverage --check`
      both green after the regen commit.
- [x] **2.5 ADR admission gate — fewer ADRs.** `decision-record` and
      `adr-create` classify before creating: architecturally significant?
      hard or costly to reverse, or broadly constraining? consumer / API /
      security / structural impact? Otherwise → decision note, config,
      measurement record, experiment, roadmap. Explicit non-ADR list:
      temporary numeric thresholds, benchmark values, model mappings,
      one-off release sequencing, reversible local implementation detail.
      Reference case (blocker row 11): ADR-002 encodes 25k→26k and a 4.0k
      override ceiling (`:55`, `:63`), ADR-114 then needed another override
      and records that 7 of 9 kernel rules already carry them (`:74`) — the
      *principle* (a kernel budget exists, is measured, is capped) is the
      ADR; the numbers belong in a versioned budget contract with a
      regression gate.
      verify: golden test — a reversible threshold change does not route to
      `adr-create`.

## Phase 3 — Full-corpus challenge sweep (no frontmatter writes)

All 184 records, artifact `docs/decisions/adr-evidence-sweep-2026-08.md`, same
Iron Law as its two precedents: no silent re-openings, no silent
re-affirmations. Per-record question: *"If this ADR did not exist today, would
today's facts justify accepting it exactly as written?"* — `accepted` never
wins by default, no record is overturned merely for being agentic, and none is
preserved merely because the corpus is large.

**This phase writes no ADR frontmatter.** Round 5, both seats: `adr-layout:141`
permits investigation, proposals and reversible experiments; it does not
override `:153`. The sweep is the *challenge*, which the owner asked for and
which needs no classification write — `INSUFFICIENT-EVIDENCE-TO-CLASSIFY` is a
first-class disposition, and questioning all of them does not require
classifying all of them.

Census columns: `| ADR | Provenance | Evidence | Discovery | Authority basis |
Reversibility | Current? | Blocks | Blocking cost | Disposition |`.
Dispositions: `KEEP` · `KEEP-BUT-DOWNGRADE` · `AMEND` ·
`SUPERSEDE (candidate)` · `MERGE-INTO-POLICY` · `CONVERT-TO-MEASUREMENT` ·
`REVIEW-NOW` · `HISTORICAL-ONLY` · `INSUFFICIENT-EVIDENCE-TO-CLASSIFY`.

`Blocking cost` is **structured sourced observations, never a scalar**
(round 5, both seats — interruptions, tokens, blocked items and unavailable
capabilities are not commensurable, and one ordinal collapses distinct
failure modes into a number that cannot guide action):

```yaml
blocking_cost:
  observations:
    - metric: interruptions | context_tokens | blocked_items | capability_unavailable
      value: <number or id>
      window: YYYY-MM-DD/YYYY-MM-DD
      basis: [session-id | transcript | log-range | roadmap-id]
  unknowns: [<dimension not measured>]
```

`unknown` is the default where nothing was measured. An inferred figure is
never presented as a measurement, and a blocking cost may trigger
reconsideration but never establishes that the decision is wrong.

Per-record protocol, twelve questions in order, the row's basis refs pointing
at the answers: (1) effective decision today; (2) who actually decided;
(3) load-bearing claims; (4) which are facts, assumptions, preferences;
(5) current evidence per fact; (6) is that evidence still valid; (7) which
alternative was excluded and why; (8) what it blocks today; (9) is that
blocking still proportional; (10) would ac accept this decision again on
today's facts; (11) disposition; (12) if blocking, the minimum sufficient
authority for the change.

- [x] **3.0 Calibration before grading.** A shared anchor set of 12–15
      records graded by every reviewer before it grades its tranche; random
      assignment rather than grouping similar ADRs under one reviewer; a
      blinded overlap of ≥10 % of each tranche graded twice without either
      seeing the other. **Agreement is not accuracy** — round 5's sharpest
      correction, and the 44-REJECT case is precisely correlated agreement
      failing — so the anchor set is externally adjudicated and disagreement
      is reported with its own count rather than smoothed away.
      verify: anchor grades recorded per reviewer; overlap sample ≥10 % with
      a published disagreement count; adjudicated gold grades named
      separately from reviewer grades.
- [x] **3.1 Sweep all 185 records under randomised assignment.** Coverage
      landed: 13 records adjudicated as the anchor set, then 165 further flat
      records and 7 per-area records across eight reviewers, with 189 rows in
      `docs/decisions/adr-evidence-sweep-2026-08.md`.

      **The partition changed, and the substitution is recorded rather than
      ticked over.** An earlier draft of this phase specified three tranches by
      era — ADR-200–237, ADR-100–138, ADR-001–099. That grouping was inherited
      before Phase 3.0's controls existed, and the two contradict each other:
      grouping similar records under one reviewer is exactly what makes
      tranche-local drift invisible from inside a tranche, which is why 3.0
      requires random assignment. Random assignment won, the era tranches were
      dropped, and the assignment is reproducible from a fixed seed.

      What the era framing was FOR is preserved rather than lost: it wanted the
      newest records first (their triggers are mechanically evaluable) and the
      council-era block covered deliberately (ADR-104 carries 46 `council`
      occurrences). Both are satisfied — every ADR-200+ record and every
      ADR-100–138 record has a row, and ADR-104 is in the anchor set. What is
      NOT preserved is a per-era progress signal, which is the cost of the
      control and is stated rather than implied.
      verify: 185 records, each with exactly one adjudicated disposition; the
      assignment reproducible from `agents/runtime/tmp/adr-sweep-assignment.md`
      (seed 20260821); zero records without a row.

- [x] **3.4 Central adjudication, tally, and dated follow-ups.** One
      normalization pass across all 184 rows after the tranches — required
      because cross-record citations must cohere ("X is E3 because it rests
      on Y's E4 claim" needs both grades adjudicated together) and because
      tranche-local drift is invisible from inside a tranche. Every
      `REVIEW-NOW` / `SUPERSEDE (candidate)` row is routed per the
      discriminator **and** carries a dated follow-up: a linked roadmap step,
      an ADR draft, or an explicit dated defer with an expiry on the ADR-134
      pattern, where a lapse is a compliance finding rather than a silent
      extension. This is the mechanical answer to Proof 3.
      verify: tally section; zero candidate rows without both a route and a
      dated follow-up; a lint over sweep artifacts red on a dateless
      candidate row.

## Phase 4 — Autonomy-blocker lane

Tree-verified at `492873f09`. **No row carries a pre-selected venue.** Round 5,
both seats: a venue chosen because the record was historically council-made is
exactly the residue the Iron Law forbids — route from the proposed transition,
the trust boundaries and the reserved dimensions, and (only once Phase 7
enables it) an independently validated grade. Rows below therefore state the
*mechanism* and the *finding*, not a court.

| # | ADR / artifact | Blocking mechanism (verified) | Shape of the transition |
|---|---|---|---|
| 1 | commit-policy fence | `commit-policy.md:37` one-shot rule interrupts every commit outside `process-full`; contradicts ADR-237 § 1's delegation shape | Hard-Floor reach → 0B.1 |
| 2 | ADR-005 | No auto-merge, judge ranks only (`:48`); authority model predates ADR-237 | Destructive potential → 0B.2 |
| 3 | ADR-137 | `:73` "Setting the sunset date is a maintainer act, not an agent act" — a role-based gate, the class ADR-237 § 2 outlaws | Internal, reversible; capability-vs-role question |
| 4 | ADR-118 | § 2 rows 1, 2 and 8 read "Manual by decision" / "Never automated" / "Not automated" with judgment rationales ("demotion needs qualitative judgment", "selection bias both ways", "low marginal information"); the capacity anchor is valid (ADR-216) but no row cites a measurement | Internal; per-row re-grade |
| 5 | ADR-133 | Freeze on (a)–(d). State at `492873f09`: (a) ✓ CLAIMS-bound null · (b) ✓ backstop debt 0 ≤ 25 · (d) ✓ only via ADR-134's unexpired defer · **(c) fails one subcheck**: `release-install-e2e` exists (`release-validation.yml:372`) but is not named in `branch-protection-policy.md`'s release-PR row, as (c) requires | **Mechanical remediation, not a reopen** — add the naming line, confirm one release-shaped pass; the freeze then lifts by its own terms. Note the circularity: (d) rests on ADR-134, whose expiry silently un-meets it |
| 6 | ADR-211 (sweep row) | Freeze lifted 2026-08-05 (Amendment E `:101`, ADR-216 `:265`); the 2026-08-19 sweep still carries it owner-open | Status contradiction → 0B.3 |
| 7 | ADR-134 | Dated defer, expiry **2026-09-15** — unexpired (~25 days), so nothing has lapsed (`:11-14`) | Calendar watch; its early trigger ("both defer conditions clear before expiry") is the one condition to monitor |
| 8 | ADR-046/047/048 | Command-doctrine trio constrains every new command. 046 and 047 carry **zero** evidence markers across 93 and 94 lines; 048 carries a two-vendor council attribution plus observed command counts (`:30`, `:32`) — the trio is **2/3** evidence-free, not 3/3 | Internal; expect `KEEP-BUT-DOWNGRADE` for 046/047, E1 for 048 on its observational anchor |
| 9 | ADR-088 | Category boundary — "It is a **content suite** … This is a **category** boundary" (`:76-85`), federation a separate ADR precondition (`:93-105`) | Purpose-adjacent → classify `protected_dimensions: [purpose]`; RE-AFFIRM expected |
| 10 | ADR-020 | Global-only consumer scope | RE-AFFIRM expected (measured double-copy defect); its stale-prose defect is fixed by 2.2 |
| 11 | ADR-002 + ADR-114 | Literal caps as architecture law (`ADR-002:55`, `:63`); 7 of 9 kernel rules already overrides (`ADR-114:74`) | `MERGE-INTO-POLICY` — principle stays an ADR, numbers move to a versioned budget contract with a regression gate |
| 12 | ADR-208 | "KEEP — permanently" (`:52`) plus its own reopen conditions (`:10-11`); council-converged, with no grounds for "forever" | Amend the permanence wording per 1.4; disposition on the merits |
| 13 | ADR-107, ADR-108, ADR-122, ADR-124 | The four further live permanence hits (1.4). ADR-107/108's "open-source forever" is an owner purpose statement | `authority_basis: owner_intent` rewrite for the purpose statements; merits disposition for 122/124 |

The v4 row 13 — "any blocker cited by `road-to-user-out-of-the-loop`" — is
**deleted**: that roadmap cites zero ADRs as blockers (verified). Any
census-discovered record forcing human interaction for a repo-local reversible
action joins the lane under the ADR-237 test.

- [x] **4.1 Mechanical rows first (5, 7).** Row 5 is a two-step remediation
      (the policy-doc naming line, then one confirmed release-shaped pass);
      row 7 is a calendar watch to 2026-09-15 with its early trigger
      monitored.
      verify: (a)–(d) states re-confirmed with command output in the sweep
      artifact; the `branch-protection-policy.md` diff merged; ADR-133's
      freeze status updated per its own terms, and the (c)/(d) circularity
      recorded.
- [~] **4.2 Owner-gated rows (1, 2, 6) — blocked on 0B.**
      verify: diffs merged or RE-AFFIRMED rows with sourced blocking cost.
- [ ] **4.3 Internal rows (3, 4, 8, 12, 13) — routed from the transition.**
      Each row's venue is derived at execution time from its own transition
      and reserved dimensions, never from who decided it originally. An
      independent reviewer is selected where the transition affects a trust
      boundary; independence means independent **evidence selection**, not
      merely a different model — round 5, seat 2: a different tier fed the
      same curated evidence and the same rubric is not independent.
      verify: per-row route with the deriving reason stated; reopen records
      at the burden 1.2 prices; one reviewer argues the strongest case for
      KEEPING the decision — on every row, at every grade. `adr-layout:347`
      states that duty unconditionally ("ONE SEAT MUST ARGUE THE STRONGEST CASE
      FOR KEEPING THE DECISION"), and an earlier draft of this step qualified it
      with "on E2+ rows". That qualifier was a leak in this roadmap's own
      central claim, caught in neutral review: it let a grade decide whether a
      MANDATORY REVIEW ROLE is dropped, which is the forbidden shape — a grade
      deciding what may be skipped. Removed rather than fenced, because the duty
      is cheapest exactly where the grade is lowest.
- [ ] **4.4 Structural rows (9, 10, 11).**
      verify: classifications landed; the ADR-002/114 numeric-policy
      migration carries its own PR.

## Phase 5 — Doctrine, proposed not accepted

- [x] **5.1 Draft ADR-239 `evidence-based-decision-floor` as
      `status: proposed`.** Round 5, both seats: the doctrine record is not
      "later documentation" — it is the decision that would activate a new
      authorization regime, so it must be separately reviewable and
      kill-switchable, and it may not ship `accepted` alongside the schema
      that it governs. ADR-239 is the next free number (verified against
      `origin/main` and all 10 open PRs).

      It canonicalizes: the two descriptive axes; the layer separation from
      § Architecture; the authority-integrity invariant; provisional
      (non-)authority for accepted-low records; the Iron Laws (a council may
      discover options, challenge assumptions, review evidence, identify
      missing evidence and recommend — it may not raise `evidence.strength`
      by agreeing, establish purpose, or establish an empirical claim
      without measurement; three models citing three sources yields E3
      *because of the sources*); honest-E0 as publishable; the
      permanence-language rule; the admission gate.

      Self-falsifying frontmatter, so a record fixing
      ADRs-becoming-law does not itself become law:

      ```yaml
      status: proposed
      provenance: {kind: mixed, decision_makers: [owner, agentic-review], human_directed: true}
      evidence:
        strength: E3
        discovery: complete
        basis: [azure-waf-adr-confidence, grade-axis-separation,
                engine-reclassification-2026-07, claims:code-graph-retrieval-null]
      authority_basis: evidence
      reopen_policy: directional
      protected_dimensions: [governance]
      review_trigger: >-
        Reopen when measured ADR-caused interruptions do not materially
        decline against the Phase 6 baseline, when evidence grading produces
        material misclassification against the adjudicated gold sample, or
        when a run is wrongly blocked or wrongly authorized because of this
        model.
      ```

      E3 by triangulation — an authoritative external recommendation, a
      transferable method, and ac's own measured defects — not by counting
      sources.
      verify: ADR-239 present with `status: proposed` and exactly this
      frontmatter shape; its `review_trigger` names the Phase 6 metrics;
      acceptance deferred to Phase 7.
- [ ] **5.2 `decision-revisit-gate` — compatibility only, no new authority.**
      The rule learns to read the new fields and to surface them when a lock
      is cited (effective state → provenance → grade → discovery → current
      evidence → reversibility → reserved dimensions). It grants nothing:
      citing an E0 lock as a hard blocker without surfacing its grade becomes
      a rule violation, and that is the whole change. The council-first venue
      for E2+ adversarial review stays; the E0/E1 agent path is **not**
      enabled here — Phase 7 owns it. The rule is tier-2b `auto` with a
      4,000-char cap (`CAP_AUTO`, `lint_load_context.ts:71`) and currently
      166 lines, so the burden table stays in `adr-layout` and the rule
      carries routing lines only.
      verify: `lint-rule-budget` green; trigger-eval fixtures — grade
      surfaced at cite time · E3 respected · `owner_intent` surfaced, not
      overruled · floor-weakening still owner-routed · council agreement does
      not raise a grade · **no fixture in which a grade alone authorizes an
      agent action**.

## Phase 6 — Shadow-mode measurement

The metrics run **before** any authority consequence exists, which is what
makes Phase 7 a decision rather than a hope. Pre-registered in
`docs/CLAIMS.md` per its entry schema (`:31-40`).

- [x] **6.1 Pre-register the baseline.** ADR-caused user interruptions per 20
      roadmap runs; work items parked solely by an ADR; ADRs cited without
      fresh validation; time from a fired review trigger to disposition; ADRs
      created per release; proposed ADRs redirected to notes/config/evidence.
      verify: baseline entries bound in CLAIMS.md before 5.2 merges.
- [x] **6.2 Pre-register the grading-integrity metrics.** Round 5's controls,
      because these are what Phase 7 must actually decide on:
      - **grade-accuracy-vs-gold** — reviewer grades against the externally
        adjudicated anchor sample, reported with a disagreement count and
        stratified by record type. Not inter-reviewer agreement, which can
        measure shared bias.
      - **evidence-discovery-recall** — of records graded E0 with
        `discovery: complete`, how many had findable evidence a deeper search
        located. Measures the failure mode `discovery` exists for.
      - **beneficiary-linked-grade-bias** — the E0/E1 rate on records that
        constrain agent behaviour versus records that do not. A
        disproportionately weak grade on constraint records is the
        conflict-of-interest signal, measured rather than asserted.
      - **owner-reversal-rate** — grades the owner changes within 90 days.
      verify: all four bound in CLAIMS.md with their measurement basis and a
      minimum sample size, before any Phase 7 decision.
- [ ] **6.3 Publish the outcome, honest null included.**
      verify: post-window measurement bound in CLAIMS.md; a null published
      as a null.

## Phase 7 — The authority question (separate decision, default-off) `[~]`

Deferred by construction, not by fatigue. Whether an independently validated
grade may reduce the authorization burden is a distinct decision from whether
the metadata is worth having, and round 5 was unanimous that fusing them is
the design's central error. It is owner-reserved: it weakens the reach of an
existing authority floor.

- [~] **7.1 Decide whether grade-derived authority is enabled at all**, on
      the Phase 6 evidence. Preconditions before the question is even put:
      grade accuracy against the adjudicated gold sample at a pre-registered
      threshold; no beneficiary-linked grade bias; measured interruption
      reduction without a defect increase; and a successful suspension drill.
      If enabled, it ships default-off, per-transition, and never lets one
      party both assign the grade and classify the transition as
      `reversible-internal`.
      verify: an owner ruling recorded either way; a published null if the
      preconditions fail.
- [~] **7.2 Define the kill switch and the rollback unit before, not after.**
      A kill switch with no defined unit is a word. Suspension must: stop new
      grade-derived actions; route transitions through the prior authority
      rules; halt authoritative backfill writes; preserve every grade and the
      audit history; treat already-superseded records individually rather
      than blind-reverting; and require a **named** owner to re-enable.
      Triggers: a reserved dimension changed without owner authorization · an
      authority-expanding grade materially reversed · evidence-basis
      integrity failure · measured beneficiary-linked downward bias · defects
      or owner reversals past the pre-registered baseline · no interruption
      reduction after the minimum sample · a failed disable drill.
      verify: the rollback unit is one of four named options chosen and
      recorded; the drill is run and passes before 7.1 is decided.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-21 | reviewer: claude/host + 2-seat council -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Self-authorizing grade | product | The party that assigns a grade draws authority from it — and assigns `reversible-internal` too, authorizing itself on two of its own judgments. Both council seats named this as the design's central defect; the 44-REJECT record is the repo's proof that correlated agreement passes for evidence | The layer separation in § Architecture: metadata and surfacing ship without any authority consequence; Phase 7 is a separate owner decision, default-off, gated on measured accuracy against an adjudicated gold sample and a passed suspension drill; the authority-integrity invariant is stated in the contract and pinned by a 5.2 fixture asserting no grade alone authorizes an action | Phase 7 — The authority question (separate decision, default-off) `[~]` |
| 2 | Grade inflation / deflation by the grader | product | An agent grades constraining records weak to unlock them, or grades its own past decisions strong to harden them | Census proposes with matched-line provenance and never writes; defaults `unknown`/E0/`discovery: incomplete`; `beneficiary-linked-grade-bias` measures exactly this rather than trusting provenance to neutralise it; adjudicated anchors, random assignment, blinded overlap | Phase 6 — Shadow-mode measurement |
| 3 | Backfill before ratification | product | Frontmatter written into 184 accepted records before the owner ratifies the bulk-classification amendment, inverting the approval flow into "write and hope it sticks" | Phase 3 writes no frontmatter at all; `INSUFFICIENT-EVIDENCE-TO-CLASSIFY` makes the challenge deliverable without a write; the backfill is a later phase gated on 0A | Phase 3 — Full-corpus challenge sweep (no frontmatter writes) |
| 4 | Day-one invalid tree | implementation | A hard `review_trigger` requirement makes 88 accepted records fail the moment the schema lands, forcing schema and backfill into one unreviewable PR | Staged migration: `unclassified` accepted on existing records, substantive triggers required on new and materially amended ones, `terminal`/`none`/empty invalid everywhere, monotonically decreasing exception count | Phase 1 — Schema: two descriptive axes, staged so the tree stays valid |
| 5 | Discovery failure read as evidence absence | product | E0 conflates "no evidence exists" with "the search did not find it"; a record then looks cheap because nobody looked | `discovery: complete \| incomplete`, required on E0 and defaulting to `incomplete`; `evidence-discovery-recall` measures the residual | Phase 6 — Shadow-mode measurement |
| 6 | Fourth parser | implementation | Nested axes added to three divergent frontmatter readers; `regenerate_index`'s regex reader silently reads them empty | 2.0 extracts one shared reader before any axis lands, with a nested-plus-list round-trip fixture | Phase 2 — Tooling (surfacing only; no authority) |
| 7 | Sweep fatigue → silent skips | implementation | 184 records; tranche C is 100 files and the least rewarding | Value-first tranche order; per-tranche checkboxes and honest `[~]`; the trigger-absence check is scriptable; central adjudication catches a thin tranche | Phase 3 — Full-corpus challenge sweep (no frontmatter writes) |
| 8 | Evidence theater | product | New ADRs pad an Evidence section with weak citations to buy E2/E3 | Consensus-≠-evidence Iron Law; cite-time output prints the grade so inflation meets reality when challenged; E3/E4 reopens must engage the evidence in kind, which exposes a hollow basis | Phase 5 — Doctrine, proposed not accepted |
| 9 | Hard-Floor erosion via 0B | product | The commit-policy and merge carve-outs widen agent write authority | Owner rulings by construction, `[~]` and unstarted; any carve-out inherits ADR-237's excluded list verbatim (trunk, deploy, prod data, irreversible external) | Phase 0B — Autonomy owner batch (gates only its own rows) `[~]` |
| 10 | Rule budget breach | implementation | `decision-revisit-gate` outgrows its 4,000-char `CAP_AUTO` | The burden table lives in `adr-layout`; the rule carries routing lines only; `lint-rule-budget` gates | Phase 5 — Doctrine, proposed not accepted |

## Acceptance Criteria

- [ ] AC-1 — `provenance`, `evidence` (with `discovery`) and `authority_basis`
      are defined in `adr-layout.md`, emitted by `adr-create`, validated by
      `check_adr_frontmatter`, and read through **one** shared frontmatter
      reader used by all three former parsers.
- [ ] AC-2 — The sweep artifact holds one disposition row per record (184),
      each with basis refs and a `Blocking cost` that is either sourced
      observations or explicitly `unknown`; it answers the
      would-we-accept-it-today question per row; and it writes **zero** ADR
      frontmatter.
- [ ] AC-3 — Grading integrity is evidenced, not asserted: an externally
      adjudicated anchor sample exists, ≥10 % blinded overlap was graded
      twice, and the disagreement count is published rather than smoothed.
- [ ] AC-4 — Every blocker-lane row has a landed outcome or a named owner
      gate: rows 3, 4, 8, 9, 10, 11, 12, 13 disposed with the venue derived
      from the transition (never from the historical decision-maker); row 5's
      mechanical remediation landed with its (c)/(d) circularity recorded;
      row 7 on calendar watch; rows 1, 2, 6 `[~]` on 0B. ADR-001's fired
      trigger has a dated follow-up.
- [ ] AC-5 — A newly added accepted ADR cannot pass CI without an Evidence
      section, a substantive `review_trigger`, and no unscoped permanence
      language; an existing record may carry `review_trigger: unclassified`;
      `terminal`/`none`/empty are rejected everywhere; a reversible
      calibration change does not route to `adr-create`.
- [ ] AC-6 — `adr:effective` ships and ADR-020 proves a superseded clause
      cannot be read as current; `adr-layout.md:198-200`'s stale ADR-035
      assertion is corrected; `adr_cite_check` runs in CI and prints
      `authority_effect: disabled-shadow-mode` on an accepted agentic E0/E1
      record.
- [ ] AC-7 — No authority consequence ships in this roadmap: no fixture, rule
      path, or tool output lets a grade alone authorize an agent action, and
      ADR-239 is `proposed`, not `accepted`. Phase 7 is `[~]` and unstarted.
- [ ] AC-8 — Shadow-mode metrics are pre-registered in CLAIMS.md with
      measurement basis and minimum sample sizes — including
      `grade-accuracy-vs-gold`, `evidence-discovery-recall` and
      `beneficiary-linked-grade-bias` — before Phase 5.2 merges.
- [ ] AC-9 — Sequencing held: no ADR frontmatter backfill and no ADR-239
      acceptance occurred; no 0B-gated row executed; no Safety, Privacy,
      Legal or External-commitment floor was weakened.
## Blockers

### blocker: owner-autonomy-batch

- **Status:** open
- **Owner:** user
- **Class:** 3 — human-only
- **Blocks:** Phase 0B (all three rows), Phase 4 step 4.2 (blocker-lane rows 1, 2, 6)
- **Question:** Three Hard-Floor rulings the source instruction did not
  authorize. (a) Does any explicit, this-turn, single-deliverable delegation
  pre-clear commit/push for that run, or does `commit-policy.md:37`'s one-shot
  fence stand? (b) May an end-to-end delegation cover integration-branch
  merges of judge-ranked candidates, with trunk excluded, or does ADR-005 § 1
  stand? (c) Is the ADR-211 sweep row stale (close it) or is a residual
  purpose question genuinely open (record it separately)?
- **Recommendation:** Take (c) first and close it as stale — Amendment E and
  ADR-216 both say the freeze is lifted, so the sweep row contradicts the tree
  and costs nothing to correct. Hold (a) and (b): both widen agent write
  authority, and this roadmap's own Phase 7 argues that authority changes
  belong behind measurement rather than alongside a schema change.
- **If you do nothing:** Phases 1–3, 5 and 6 run in full and blocker-lane rows
  3, 4, 5, 7–13 all dispose normally. Rows 1, 2 and 6 stay `[~]`, so three of
  thirteen lane rows and AC-4's owner-gate clause remain open. Nothing else
  stalls.
- **What to do:** Answer (a), (b), (c) in one sitting. Each `yes` executes its
  lane row with the carve-out inheriting ADR-237's excluded list verbatim
  (trunk, deploy, prod data, irreversible external); each `no` lands a
  RE-AFFIRMED row whose blocking cost is recorded as sourced observations per
  Phase 3's `blocking_cost` shape.
- **Resolved when:** all three rulings are recorded in the sweep artifact and
  blocker-lane rows 1, 2 and 6 each carry a landed outcome.

### blocker: authority-coupling-decision

- **Status:** open
- **Owner:** user
- **Class:** 3 — human-only
- **Blocks:** Phase 7 (both steps)
- **Question:** May an independently validated evidence grade reduce the
  authorization burden for a reopen — and if so, under which pre-registered
  accuracy threshold, with which rollback unit?
- **Recommendation:** Do not decide it now. Let Phase 6 run in shadow mode
  first: the question is only answerable once `grade-accuracy-vs-gold`,
  `evidence-discovery-recall` and `beneficiary-linked-grade-bias` have
  numbers, and a suspension drill has passed. A published null is an
  acceptable answer.
- **If you do nothing:** Everything in Phases 0A–6 still lands. The estate
  gains provenance, evidence grades, substantive review triggers, a full
  184-record challenge disposition and cite-time surfacing — all of it
  descriptive. What stays absent is any autonomous reopen path derived from a
  grade, which is exactly the state the council ruled the safe default.
- **What to do:** Read the Phase 6 measurements when they land, then rule
  once: enabled default-off with a named re-enabler and a chosen rollback
  unit, or not enabled with the null published.
- **Resolved when:** an owner ruling is recorded either way, and — if enabled
  — the rollback unit is one of the four named options and the suspension
  drill has passed before the first grade-derived action.
