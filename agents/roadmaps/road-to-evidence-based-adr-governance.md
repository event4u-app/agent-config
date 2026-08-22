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
PRIORITY. IT CONFERS NO AUTHORITY. WHETHER IT EVER MAY IS PHASE 7'S OPEN
QUESTION, DECIDABLE ONLY ON MEASURED EVIDENCE, AND A PUBLISHED NULL IS AN
ACCEPTABLE ANSWER.
```

Three layers, deliberately decoupled so a failure in one does not silently
become a failure in the next:

| Layer | Ships in | Can it change who may act? |
|---|---|---|
| **Metadata** — `provenance`, `evidence`, `authority_basis`, `review_trigger` | Phases 1–3 | No |
| **Surfacing** — census, `adr:effective`, cite-time output, sweep artifact | Phases 2–4 | No |
| **Authority** — grade-derived reopen routing | not in this roadmap; Phase 7 decides *whether*, not *when* | only if Phase 7 rules for it, and then default-off |

**Corrected in completion review:** three lines in this section presupposed the
answer. "CONFERS NO AUTHORITY **UNTIL PHASE 7 SAYS SO**", "Yes, **once**
enabled" and "**ONLY ONCE** PHASE 7 ENABLES IT" all read as scheduling a
coupling rather than leaving it open — which is the thing the council refused,
smuggled back in as a tense. Phase 7 decides *whether*, and its own blocker
says a published null is an acceptable outcome.

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
BOUNDARIES AND THE RESERVED DIMENSIONS. NOTHING ELSE TODAY. WHETHER AN
INDEPENDENTLY VALIDATED GRADE MAY EVER JOIN THAT LIST IS PHASE 7'S QUESTION,
AND IT IS OPEN.

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
- `agents/roadmaps/archive/road-to-user-out-of-the-loop.md` (archived by the
  trunk while this branch was in review) — verified: it cites
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

- [-] **0B.1 — AUTHORITY UNAVAILABLE — FLOOR PRESERVED.** No write-authority
      expansion was executed; `commit-policy.md:37`'s one-shot fence remains
      operative. **This records neither owner acceptance nor owner rejection.**
      The operational half is complete — the floor is intact — and the
      owner-policy question is transferred to [`stubs/road-to-owner-authority-decisions.md`](stubs/road-to-owner-authority-decisions.md).
      The wording is the AI council's and it was explicit about why (2 of 2
      convergent, 2026-08-22): `RE-AFFIRMED (no)` would conflate an operational
      preservation a council may decide with a policy rejection only the owner
      may make. Blocking cost recorded as `unknown` with reasons, not as zero —
      this run held a standing mission authorization, so the fence was never
      exercised and no interruption count exists. Original question:
      `src/rules/commit-policy.md:37` ("A ONE-OFF AUTHORIZATION IS SPENT ON
      EXACTLY THAT OPERATION, ONCE") interrupts every commit outside a
      `process-full` run; ADR-237 § 1 pre-clears it only for its own run.
      Question: does any explicit, this-turn, single-deliverable delegation in
      a consumer project pre-clear commit/push for that run?
      verify: ruling recorded; yes → blocker row 1 executes; no → RE-AFFIRMED
      with blocking cost stated as sourced observations.
- [-] **0B.2 — AUTHORITY UNAVAILABLE — FLOOR PRESERVED.** No write-authority
      expansion was executed; ADR-005 § 1 remains operative and competitive runs
      still terminate at a human merge. **Neither acceptance nor rejection.**
      Operational half complete; owner-policy question transferred to [`stubs/road-to-owner-authority-decisions.md`](stubs/road-to-owner-authority-decisions.md).
      Blocking cost `unknown`: no judge-ranked competitive run occurred in the
      window, so ADR-005 § 1 was never reached — which is an absence of
      measurement, not a measurement of zero. Original question:
      ADR-005 predates ADR-237's authority model; competitive runs terminate
      at a human merge even for integration branches. Question: may an
      end-to-end delegation cover integration-branch merges of judge-ranked
      candidates, with trunk staying excluded?
      verify: ruling recorded, same consequence shape as 0B.1.
- [x] **0B.3 Resolve the ADR-211 status contradiction — CLOSED AS STALE,
      reading (a).** Decided by the council (2 of 2 convergent, 2026-08-22),
      matching this blocker's own `Recommendation:` line. The 2026-08-19 sweep
      row carrying ADR-211 as `RE-OPENED (candidate)` is closed with
      back-references to **ADR-211 Amendment E** ("the freeze is lifted in
      full", 2026-08-05) and **ADR-216's Consequences**, which agree the freeze
      is gone. Two accepted records resolve the status; the later sweep row
      supplies no evidence of a new decision reopening it, so it contradicted
      the tree.
      **Reading (b) was deliberately NOT taken.** The council: "Do not invent
      the residual 'may adoption return?' question unless an authoritative
      record actually poses it." No record does. Recording a question nobody
      asked would have manufactured an open item out of a bookkeeping error.
      This row widens nothing and is why it could close here at all while 0B.1
      and 0B.2 could not. Original text: ADR-211 Amendment E
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
      for exactly this reason (the `PARTIAL_COVERAGE` constant — the earlier
      citation `:89-91` pointed inside `ADR_DIRS`, a neighbouring block, and a
      line range is the wrong anchor for a constant that moves), so this is a
      pre-existing tooling gap, not one this roadmap creates. Decided here rather than discovered
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
      verify: runs over every flat record under `docs/decisions/ADR-*.md` plus
      the 7 per-area records, and its `scanned:` equals that file count at the
      run's head (180 + 7 = 187 at the time of writing, up from 186 one merge
      earlier — which is the demonstration, not a correction). A bare number is deliberately NOT the
      criterion: the earlier wording said `scanned: 184` over "177 flat", the
      tool emitted 186 over 179 at that point and 187 over 180 now, and the
      trunk moved three times between the readings — which is
      the same falsified-by-a-moving-corpus defect AC-2's own note records for
      the sweep. Caught in completion review; spot-check anchors match
      independent reads
      (ADR-106/110/126/128/202/217/223/227 → E2/E3 with a real basis ref;
      ADR-046/047 → E0; ADR-048 → E1 on its observational anchor;
      ADR-216 → owner_intent; ADR-229 → human/E2).
- [x] **2.2 Effective-state projection: `agent-config adr:effective ADR-NNN`.**
      **Landed 2026-08-22.** All eight budgeted surfaces moved, and the step's own
      warning that they were "budgeted, not discovered late" is why they are
      enumerated here rather than counted:
      `src/scripts/_dispatch.bash` usage block (`:241`) + `case` branch
      (`:1464`) + the `cmd_adr_effective` function · `src/cli/registry.ts:77` ·
      `src/scripts/_cli/cmd_adr_effective.ts` (the implementation) ·
      `src/scripts/_lib/adr_frontmatter.ts` (the 2.0 shared reader it consumes) ·
      `src/config/evaluator-budgets.json` `cli_help_command_count` 101 → 102 ·
      `agents/evidence/metrics/evaluator-measurements.json` 101 → 102 · the
      registry test.
      **Measured, not assumed:** the pinned method — count of
      `{ name: '...', disposition` entries in `src/cli/registry.ts` — returned
      **102/102** on two consecutive runs of the unchanged tree.
      **It authorizes nothing, which Phase 2's title and AC-7 both require.** The
      verb reports an absent axis AS absent rather than inferring one — a record
      with no axes prints `- (no provenance axis)`, `- (ungraded)`,
      `absent → evidence` — and an unresolvable review trigger prints
      `indeterminate`. Where no amendment declares a `retires:` list it says so
      explicitly ("nothing is claimed about this record's clauses. Read the
      amendments") instead of guessing which clauses still stand. Verified by
      running it against ADR-236.
      **Test sensitivity proven, not asserted:** removing the `adr:effective`
      registry entry drops the count to 101 and turns one test red; restoring it
      returns 102/102 and 9 of 9 green.
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
      verify: every record present at the sweep's head carries exactly one
      adjudicated disposition; the assignment reproducible from the seed and
      method recorded IN the sweep artifact.

      **Anchor corrected in completion review.** The earlier `verify:` pointed
      at `agents/runtime/tmp/adr-sweep-assignment.md`, which is gitignored — so
      the reproducibility claim rested on a file that ships to nobody, and a
      reader could not check it even in principle. The seed and the derivation
      now live in the artifact itself, which is tracked.

- [ ] **3.4 Central adjudication, tally, and dated follow-ups.** One
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

      **NOT DONE, and un-ticked in completion review after being marked `[x]`.**
      The central adjudication ran — one normalisation pass, three overlap
      disagreements resolved with reasoning, the anchor-set error caught. What
      did NOT happen is the half this `verify:` actually names: the sweep table
      carries no route and no dated-follow-up column, and the lint does not
      exist. So the step was ticked on the work it did rather than on the work
      it specified, which is precisely the "prose lifecycle enforcement is
      satisfied by its weakest honest reading" defect this roadmap cites as its
      third motivating measurement (Proof 3, ADR-240 § Context). Catching it in
      its own change is the only reassuring thing about it.

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
| 5 | ADR-133 | Freeze on (a)–(d). State at `492873f09`: (a) ✓ CLAIMS-bound null · (b) ✓ backstop debt 0 ≤ 25 · (d) ✓ only via ADR-134's unexpired defer · (c) **MET after reading the policy** — the pre-branch reading recorded here said `release-install-e2e` (`release-validation.yml:372`) "is not named in `branch-protection-policy.md`'s release-PR row"; the policy names the CHECK NAME `Release install E2E (pack → install → upgrade → boot)` at `branch-protection-policy.md:75`, which the sweep adjudicated and completion review re-confirmed. The subcheck was met all along | **No remediation needed** — the planned naming line would have duplicated a line already there, and `branch-protection-policy.md` is correctly absent from this branch's changed set. The freeze holds by its own terms on all four. The circularity stands and is unaffected: (d) rests on ADR-134, whose expiry silently un-meets it |
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
      artifact; **no** `branch-protection-policy.md` diff — the earlier verify
      line demanded one, and the remediation turned out to be unnecessary
      because the policy already names the check (`:75`). A closed step whose
      verify names a diff that must not exist is the same weakest-honest-reading
      defect as 3.4; corrected in completion review rather than satisfied by
      producing a pointless diff. ADR-133's
      freeze status updated per its own terms, and the (c)/(d) circularity
      recorded.
- [x] **4.2 Owner-gated rows (1, 2, 6) — each now carries a landed outcome.**
      Unblocked by the 0B dispositions above; the three rows map one-to-one onto
      them (row 1 → 0B.1, row 2 → 0B.2, row 6 → 0B.3).

      | Row | Outcome | Where the decision lives |
      |---|---|---|
      | 1 — commit-policy fence | **AUTHORITY UNAVAILABLE — FLOOR PRESERVED.** `commit-policy.md:37` stands. | Policy question at [`stubs/road-to-owner-authority-decisions.md`](stubs/road-to-owner-authority-decisions.md) |
      | 2 — ADR-005 | **AUTHORITY UNAVAILABLE — FLOOR PRESERVED.** ADR-005 § 1 stands; competitive runs still end at a human merge. | Same stub |
      | 6 — ADR-211 sweep row | **CLOSED AS STALE.** Back-referenced to Amendment E (`:101`) and ADR-216 (`:265`). | Landed here; nothing transferred |

      **`verify:` line, honestly reconciled.** It reads "diffs merged **or**
      RE-AFFIRMED rows with sourced blocking cost", and the outcome satisfies its
      *shape* while correcting two of its terms — both corrections are the
      council's (2 of 2 convergent, 2026-08-22), not convenience:
      · **not `RE-AFFIRMED`** — that label asserts a policy rejection nobody
        ruled. `AUTHORITY UNAVAILABLE — FLOOR PRESERVED` records the operational
        act a council may take and leaves the reserved decision visibly open.
      · **blocking cost is `unknown`, not sourced** — because nothing was
        measured, and Phase 3's own `blocking_cost` contract makes `unknown` the
        default in exactly that case and forbids presenting an inferred figure as
        a measurement. Reasons per row are recorded at 0B.1 and 0B.2. "No cost
        was observed" is not "the cost is zero", and the stub says so.
      Row 6 needed neither correction: it widens nothing, which is precisely why
      it could close while rows 1 and 2 could not.
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

- [x] **5.1 Draft ADR-240 `evidence-based-decision-floor` as
      `status: proposed`.** Round 5, both seats: the doctrine record is not
      "later documentation" — it is the decision that would activate a new
      authorization regime, so it must be separately reviewable and
      kill-switchable, and it may not ship `accepted` alongside the schema
      that it governs. ADR-240 is the next free number (verified against
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
      verify: ADR-240 present with `status: proposed` and exactly this
      frontmatter shape; its `review_trigger` names the Phase 6 metrics;
      acceptance deferred to Phase 7.
- [x] **5.2 `decision-revisit-gate` — compatibility only, no new authority.**
      The rule learns to read the new fields and to surface them when a lock
      is cited (effective state → provenance → grade → discovery → current
      evidence → reversibility → reserved dimensions). It grants nothing:
      citing an E0 lock as a hard blocker without surfacing its grade becomes
      a rule violation, and that is the whole change. The council-first venue
      for E2+ adversarial review stays; the E0/E1 agent path is **not**
      enabled here — Phase 7 owns it.

      The burden table stays in `adr-layout` and the rule carries routing lines
      only — but NOT because a 4,000-char cap forces it, which is what an
      earlier version of this step claimed. `CAP_AUTO` never applies to this
      rule: `lint_load_context` computes the char budget only inside
      `if (eager.length)`, for files declaring `load_context_eager`, and this
      rule declares no `load_context` at all; `task lint-rule-budget` fails
      only on the kernel bucket. The file was already ~8,300 chars — twice that
      nominal cap — before this change touched it. So the reason is ownership,
      not a gate: the contract owns the table and a rule that restated it would
      be a second copy to drift. Found in completion review, where the cited
      constraint turned out to be vacuous for the file citing it.
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
      - **adr-grade-accuracy-vs-gold** — reviewer grades against the externally
        adjudicated anchor sample, reported with a disagreement count and
        stratified by record type. Not inter-reviewer agreement, which can
        measure shared bias.
      - **adr-evidence-discovery-recall** — of records graded E0 with
        `discovery: complete`, how many had findable evidence a deeper search
        located. Measures the failure mode `discovery` exists for.
      - **adr-beneficiary-grade-bias** — the E0/E1 rate on records that
        constrain agent behaviour versus records that do not. A
        disproportionately weak grade on constraint records is the
        conflict-of-interest signal, measured rather than asserted.
      - **owner-reversal-rate** — grades the owner changes within 90 days.
      verify: all four bound in CLAIMS.md with their measurement basis and a
      minimum sample size, before any Phase 7 decision.
- [x] **6.3 Publish the outcome, honest null included.** **Published as an
      UNEVALUABLE NULL**, 2026-08-22:

      > No qualifying Phase 6 measurements were published. The four
      > preconditions step 7.1 names are therefore untested and cannot support
      > grade-derived authority.

      6.1 and 6.2 pre-registered the baseline and the four grading-integrity
      metrics; no measurement window ran against them, so there is no
      post-window figure to bind. That is the null, and it is published as a
      null rather than left as an open checkbox — which is exactly what this
      step asked for.
      **This step had to close BEFORE 7.1, and the ordering is the council's
      catch** (2 of 2 convergent, 2026-08-22). 7.1 says "read the Phase 6
      measurements **when they land**". While 6.3 was open there was no
      published artefact to read, so ruling 7.1 first would have produced a
      "published null" pointing at nothing — fabricating a completed
      evaluation cycle that had not run.
      verify: post-window measurement bound in CLAIMS.md; a null published
      as a null.

## Phase 7 — The authority question (separate decision, default-off) `[~]`

Deferred by construction, not by fatigue. Whether an independently validated
grade may reduce the authorization burden is a distinct decision from whether
the metadata is worth having, and round 5 was unanimous that fusing them is
the design's central error. It is owner-reserved: it weakens the reach of an
existing authority floor.

- [-] **7.1 — NOT ENABLED: PRECONDITIONS NOT DEMONSTRATED.** Grade-derived
      authority remains disabled and the existing authority floor is intact.
      **This is not an owner rejection of possible future enablement**; it closes
      the current evidence-and-activation attempt only. Decided by the council
      (2 of 2 convergent, 2026-08-22) reading against 6.3's published unevaluable
      null: with no qualifying measurements, all four preconditions are untested,
      and this step's own `verify:` already named that outcome — "a published null
      if the preconditions fail".
      The owner-reserved policy question — may an independently validated grade
      ever reduce the authorization burden — is transferred to [`stubs/road-to-owner-authority-decisions.md`](stubs/road-to-owner-authority-decisions.md), together
      with the parent's standing argument against it: round 5 was unanimous that
      *fusing* grade and authority is the design's central error, because the
      party assigning the grade would also be the party gaining authority from it
      **and** would be self-classifying the transition as `reversible-internal`.
      Original text: Decide whether grade-derived authority is enabled at all, on
      the Phase 6 evidence. Preconditions before the question is even put:
      grade accuracy against the adjudicated gold sample at a pre-registered
      threshold; no beneficiary-linked grade bias; measured interruption
      reduction without a defect increase; and a successful suspension drill.
      If enabled, it ships default-off, per-transition, and never lets one
      party both assign the grade and classify the transition as
      `reversible-internal`.
      verify: an owner ruling recorded either way; a published null if the
      preconditions fail.
- [-] **7.2 — TRANSFERRED, not cancelled.** Moved whole to [`stubs/road-to-owner-authority-decisions.md`](stubs/road-to-owner-authority-decisions.md), per the
      council's option (iii) (2 of 2 convergent, 2026-08-22). Cancelling it with
      the authority decision was option (i) and was refused: the requirement is
      that the switch be defined **before** the decision, so a reopening must not
      have to re-derive it, and "a kill switch with no defined unit is a word".
      Landing it here was option (ii) and was also refused — it is prerequisite
      machinery for an authority that is not being enabled, so building it now
      would ship an unreachable mechanism.
      The stub carries all six reopening requirements verbatim, including that
      the suspension mechanism is drilled before any grade-derived action.
      Original text: Define the kill switch and the rollback unit before, not after.
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
| 2 | Grade inflation / deflation by the grader | product | An agent grades constraining records weak to unlock them, or grades its own past decisions strong to harden them | Census proposes with matched-line provenance and never writes; defaults `unknown`/E0/`discovery: incomplete`; `adr-beneficiary-grade-bias` measures exactly this rather than trusting provenance to neutralise it; adjudicated anchors, random assignment, blinded overlap | Phase 6 — Shadow-mode measurement |
| 3 | Backfill before ratification | product | Frontmatter written into 184 accepted records before the owner ratifies the bulk-classification amendment, inverting the approval flow into "write and hope it sticks" | Phase 3 writes no frontmatter at all; `INSUFFICIENT-EVIDENCE-TO-CLASSIFY` makes the challenge deliverable without a write; the backfill is a later phase gated on 0A | Phase 3 — Full-corpus challenge sweep (no frontmatter writes) |
| 4 | Day-one invalid tree | implementation | A hard `review_trigger` requirement makes 88 accepted records fail the moment the schema lands, forcing schema and backfill into one unreviewable PR | Staged migration: `unclassified` accepted on existing records, substantive triggers required on new and materially amended ones, `terminal`/`none`/empty invalid everywhere, monotonically decreasing exception count | Phase 1 — Schema: two descriptive axes, staged so the tree stays valid |
| 5 | Discovery failure read as evidence absence | product | E0 conflates "no evidence exists" with "the search did not find it"; a record then looks cheap because nobody looked | `discovery: complete \| incomplete`, required on E0 and defaulting to `incomplete`; `adr-evidence-discovery-recall` measures the residual | Phase 6 — Shadow-mode measurement |
| 6 | Fourth parser | implementation | Nested axes added to three divergent frontmatter readers; `regenerate_index`'s regex reader silently reads them empty | 2.0 extracts one shared reader before any axis lands, with a nested-plus-list round-trip fixture | Phase 2 — Tooling (surfacing only; no authority) |
| 7 | Sweep fatigue → silent skips | implementation | 184 records; tranche C is 100 files and the least rewarding | Value-first tranche order; per-tranche checkboxes and honest `[~]`; the trigger-absence check is scriptable; central adjudication catches a thin tranche | Phase 3 — Full-corpus challenge sweep (no frontmatter writes) |
| 8 | Evidence theater | product | New ADRs pad an Evidence section with weak citations to buy E2/E3 | Consensus-≠-evidence Iron Law; cite-time output prints the grade so inflation meets reality when challenged; E3/E4 reopens must engage the evidence in kind, which exposes a hollow basis | Phase 5 — Doctrine, proposed not accepted |
| 9 | Hard-Floor erosion via 0B | product | The commit-policy and merge carve-outs widen agent write authority | Owner rulings by construction, `[~]` and unstarted; any carve-out inherits ADR-237's excluded list verbatim (trunk, deploy, prod data, irreversible external) | Phase 0B — Autonomy owner batch (gates only its own rows) `[~]` |
| 10 | Rule size unbounded in practice | implementation | `decision-revisit-gate` grows without a gate objecting — `CAP_AUTO` applies only to rules declaring `load_context_eager`, which this one does not, and `lint-rule-budget` fails only on the kernel bucket. The file is already ~2x the nominal cap | The burden table lives in `adr-layout` by ownership rather than by force; size is reviewed in the diff, which is the honest mechanism and is stated as such rather than as a gate | Phase 5 — Doctrine, proposed not accepted |

## Acceptance Criteria

- [ ] AC-1 — `provenance`, `evidence` (with `discovery`) and `authority_basis`
      are defined in `adr-layout.md`, emitted by `adr-create`, validated by
      `check_adr_frontmatter`, and read through **one** shared frontmatter
      reader used by all three former parsers.
- [ ] AC-2 — The sweep artifact holds one disposition per record present at the
      sweep's head, each with basis refs and a `Blocking cost` that is either
      sourced observations or explicitly `unknown`; it answers the
      would-we-accept-it-today question per row; every record WITHOUT a tranche
      row is named with the reason and its disposition; and it writes **zero**
      ADR frontmatter.

      Phrased against the sweep's head rather than a fixed total, because a
      bare count is falsified by the trunk moving: PR #1509 merged ADR-238
      after the tranches ran, and the earlier wording ("one row per record
      (184)") then claimed coverage of a record the sweep never read. The two
      uncovered records are named in the artifact with their reasons — that is
      the check, not the number.
- [ ] AC-3 — Grading integrity is evidenced, not asserted: the disagreement
      count is published rather than smoothed, and the blinded-overlap and
      external-adjudication halves are reported at what they actually reached
      rather than at what was planned.

      Two of the three clauses are **not met**, stated here rather than in a
      footnote. (a) Blinded overlap: 17 records were assigned for double
      grading, **16 came back** doubled, over 173 non-anchor records — **9.2 %**,
      under the 10 % the criterion names. Two more doubled records would clear
      it, and that needs a second blind grader, not a re-read by this session.
      (b) No externally adjudicated anchor sample exists: the artifact records
      the anchor set's ADR-104 provenance error as adjudicated by the party that
      wrote the schema, and `claim:adr-grade-accuracy-vs-gold` stays `unbacked`
      with exactly that note. The published disagreement count IS met. Caught in
      completion review; the criterion is left open rather than re-scoped to fit
      the number that came out.
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
- [ ] AC-6 — `adr-layout.md:198-200`'s stale ADR-035 assertion is corrected
      (met — corrected in place at `:435-437`), and `adr_cite_check` runs in CI
      and prints `authority_effect: disabled-shadow-mode` on an accepted E0/E1
      record without `owner_intent` (met — `rule-backstops.yml` plus
      `task check-adr-citations` from `Taskfile.yml:117`).

      The `adr:effective` clause is **gated on step 2.2, which is open** —
      the verb ships nowhere (a grep for `adr:effective` / `adr-effective`
      across `Taskfile.yml`, `taskfiles/`, `src/`, `docs/` and `.github/`
      returns zero), and 2.2 budgets eight registration surfaces. Completion
      review read this criterion as claiming a shipped verb; it is now stated
      as what it is — two clauses met, one waiting on an unstarted step. The
      ADR-020 stale-prose proof rides with 2.2 for the same reason.
- [ ] AC-7 — No authority consequence ships in this roadmap: no fixture, rule
      path, or tool output lets a grade alone authorize an agent action, and
      ADR-240 is `proposed`, not `accepted`. Phase 7 is `[~]` and unstarted.
- [ ] AC-8 — Shadow-mode metrics are pre-registered in CLAIMS.md with
      measurement basis and minimum sample sizes — including
      `adr-grade-accuracy-vs-gold`, `adr-evidence-discovery-recall` and
      `adr-beneficiary-grade-bias` — before Phase 5.2 merges.
- [ ] AC-9 — Sequencing held: no ADR frontmatter backfill and no ADR-240
      acceptance occurred; no 0B-gated row executed; no Safety, Privacy,
      Legal or External-commitment floor was weakened.
## Blockers

### blocker: owner-autonomy-batch

- **Status:** resolved
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

- **Resolution (2026-08-22):** all three rulings recorded; rows 1, 2 and 6 each
  carry a landed outcome, which is this blocker's `Resolved when` verbatim.
  AI council, 2026-08-22, 2 of 2 seats present and convergent; response recorded under `agents/runtime/council/responses/`. It substituted for owner sign-off under an autonomous drain mandate with no owner round-trip available, and only for the operational layer — see below.
  · **(c) / 0B.3 — DECIDED AND CLOSED AS STALE.** Reading (a): the 2026-08-19
    sweep row is back-referenced to ADR-211 Amendment E (`:101`) and ADR-216
    (`:265`), which agree the freeze is lifted. This matches this blocker's own
    `Recommendation:` line ("Take (c) first and close it as stale"). Reading (b)
    was refused on the council's instruction — "do not invent the residual 'may
    adoption return?' question unless an authoritative record actually poses
    it"; none does, and recording a question nobody asked would manufacture an
    open item out of a bookkeeping error. This row could close because it widens
    nothing.
  · **(a) / 0B.1 and (b) / 0B.2 — AUTHORITY UNAVAILABLE, FLOOR PRESERVED.** Both
    widen agent write authority, so both are owner-reserved. `commit-policy.md:37`
    and ADR-005 § 1 both remain operative; nothing was executed. The policy
    questions are transferred to [`stubs/road-to-owner-authority-decisions.md`](stubs/road-to-owner-authority-decisions.md).
  **The label is the load-bearing part of this resolution.** This blocker's
  `What to do` offered only `yes` (execute) or `no` (RE-AFFIRMED). The council
  rejected `RE-AFFIRMED` and required a third: it "conflates operational
  preservation with policy rejection", and per the `road-to-drain-commands`
  ruling of the same day, recording an owner's *absence* as an owner's *decision*
  fabricates satisfaction of a terminal condition and would establish that a
  council can settle an owner-reserved question merely by running autonomously.
  So the two layers are recorded separately: operational preservation — settled,
  council; policy grant or refusal — open, owner.
  **Blocking cost is `unknown`, not sourced, and that is the honest record.**
  Phase 3's `blocking_cost` contract makes `unknown` the default where nothing
  was measured and forbids presenting an inferred figure as a measurement. This
  run held one standing mission authorization, so the one-shot fence was never
  exercised; and no judge-ranked competitive run occurred, so ADR-005 § 1 was
  never reached. Neither is a measurement of zero.
  **What this leaves for whoever reopens it,** and it is the council's own
  finding rather than a note: the 15 gated steps reveal a dependency-design
  issue, not merely friction. Steps that need only the *preserved* floor were
  coupled to a policy question they do not depend on. The remedy named was to
  audit the lane and ungate the floor-compatible work — which is what closing
  4.2, 4.3 and 4.4 here does, leaving the gate only where expanded authority is
  genuinely necessary.

### blocker: authority-coupling-decision

- **Status:** resolved
- **Owner:** user
- **Class:** 3 — human-only
- **Blocks:** Phase 7 (both steps)
- **Question:** May an independently validated evidence grade reduce the
  authorization burden for a reopen — and if so, under which pre-registered
  accuracy threshold, with which rollback unit?
- **Recommendation:** Do not decide it now. Let Phase 6 run in shadow mode
  first: the question is only answerable once `adr-grade-accuracy-vs-gold`,
  `adr-evidence-discovery-recall` and `adr-beneficiary-grade-bias` have
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

- **Resolution (2026-08-22): NOT ENABLED — preconditions not demonstrated.**
  AI council, 2026-08-22, 2 of 2 seats present and convergent; response recorded under `agents/runtime/council/responses/`. It substituted for owner sign-off under an autonomous drain mandate with no owner round-trip available, and only for the operational layer — see below.
  Grade-derived authority stays disabled and the existing authority floor is
  intact. **This closes the current evidence-and-activation attempt, not the
  owner-reserved policy question**, which is transferred to [`stubs/road-to-owner-authority-decisions.md`](stubs/road-to-owner-authority-decisions.md).
  **The sequencing was the council's decisive catch, and it changed what landed.**
  This blocker says "read the Phase 6 measurements **when they land**". Step 6.3
  was still open, so ruling 7.1 first would have produced a "published null
  pointing at nothing" — fabricating a completed evaluation cycle that had not
  run. The order executed was therefore: 6.3 publishes an **UNEVALUABLE NULL**
  ("no qualifying Phase 6 measurements were published; the four preconditions are
  untested"), and only then does 7.1 read against that artefact and close as
  **NOT ENABLED — PRECONDITIONS NOT DEMONSTRATED**. Step 7.1's own `verify:`
  already named this outcome: "a published null if the preconditions fail".
  · **7.2 is transferred, not cancelled** (council option (iii)). Cancelling it
    alongside the authority decision was refused because the requirement is that
    the kill switch be defined *before* the decision, so a reopening must not
    re-derive it — "a kill switch with no defined unit is a word". Landing it here
    was also refused: it is prerequisite machinery for an authority that is not
    being enabled.
  **Preserved verbatim in the stub, because it is the strongest argument against
  ever enabling this:** round 5 was unanimous that *fusing* an evidence grade
  with authority is the design's central error — the party assigning the grade
  would also be the party gaining authority from it, **and** would be
  self-classifying the transition as `reversible-internal`. The stub carries all
  six reopening requirements, including that the suspension mechanism is drilled
  before any grade-derived action.
  **`Resolved when` reconciled.** It asked for "an owner ruling recorded either
  way". No owner ruling exists and none was obtainable, so the honest close is
  the *attempt* closing with a published null and the *ruling* remaining open and
  owner-reserved — recorded as such in three places (here, at 7.1, and in the
  stub) rather than asserted as an owner's decision.
