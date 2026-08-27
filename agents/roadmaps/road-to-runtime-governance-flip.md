---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-27
relates:
  - slug: road-to-supervised-telemetry-collector
    relation: extends
    note: "the collector was this file's Phase 5; split out, it depends on Phase 1 and nothing here depends on it"
# relates: the telemetry collector was this file's Phase 5 until a deep council
# pass (2/2, 2026-08-27) required the split — the two have incompatible
# completion conditions, and folded together one roadmap owned two rollbacks.
# It is now a formally related DEPENDENT: it needs this file's Phase 1 ADR and
# nothing here needs it. Grepped every active, later and archived roadmap for
# `no-runtime`, `zero runtime`, `daemon` and `control plane` besides: the
# archived runtime-* family (road-to-runtime-security-hardening,
# road-to-portable-runtime-and-update-check, road-to-mcp-runtime-integrity) uses
# "runtime" for the CLI's own execution, not for a resident process, so none of
# them carries the doctrine this file repeals.
# STATUS IS DRAFT, DELIBERATELY. Both council seats held that an open blocker
# asking the maintainer to choose among three release strategies contradicts
# `status: ready`, and both prescribed `status: blocked`. That value does not
# exist here — `src/agent-src/templates/roadmaps.md:31` states the vocabulary is
# binary, ready or draft, and names "while waiting for upstream decisions" as
# exactly what draft is for. So draft is the local translation of the council's
# instruction, not a downgrade of it. Flipping to ready is one edit once the
# transition blocker is resolved.
estate_growth_exempt: "Charges -1 on the count half in this change (ready to draft) and 0 elsewhere. The original +1 stands justified on an owner decision that is now DURABLY recorded rather than quoted from a disposable path: agents/evidence/analysis/runtime-reversal-owner-decision.md carries it verbatim, plus the surface census and the estate accounting. Both council seats found the old provenance unreachable — the transcript is gitignored and in no clone — and they were right that a doctrine-level reversal cannot rest on it."
estate_offset_exempt: "No archive move is available in this change, and the consolidation offset is claimed HERE ONLY — the two sibling roadmaps state plainly that they have none. The council (2/2, 2026-08-27) caught an earlier draft citing the same avoided expansion in two files: one consolidation cannot independently offset two additions. The accounting the offset rests on was also unreachable and is now a table in the evidence artefact named above: 18 inbox files reduced to two roadmaps plus one stub, against a source set proposing five roadmaps plus a 21-phase master."
---
# Road to runtime governance — the doctrine the owner repealed is anchored in five places, and only one of them is the ADR the analysis named

> **Source:** `agents/tmp.old/uncle-bob-swarm/` (2026-08-27) — a two-session
> agent swarm that analysed this tree against an external process-integrity
> reference across four generations of roadmap, plus the transcript that
> produced them. Drafted against `f2ed85e`, which **was** `origin/main` at
> authoring time: zero commits of staleness window, so every claim below is
> either true at HEAD or was never true. `d55d1f10` merged mid-authoring and
> touched `docs/CLAIMS.md` and `docs/proof.md`; both anchors below were
> re-verified against it and both still resolve.

## The owner decision this executes

The reversal is not proposed here; it was directed by the owner. The verbatim
quote, its scope, and what it explicitly does **not** authorise are recorded
durably in
[`agents/evidence/analysis/runtime-reversal-owner-decision.md`](../evidence/analysis/runtime-reversal-owner-decision.md).
That artefact exists because both council seats found the earlier provenance
unreachable — the sentence was quoted from a gitignored, disposable inbox
archive, so neither the authority nor the estate exemption resting on it could
be checked by a reviewer.

Read in one line: the owner decided Zero Runtime is no longer the goal, that
anything asserting it is to be deprecated or removed, that the README is to be
adapted, and that runtime and daemons are a means of assuring quality.

**What it does not decide.** Supervision mechanism, platform scope, privilege
model, uniqueness namespace, installation, activation, upgrade, or what a
collector may store. Those live in
`road-to-supervised-telemetry-collector.md` as blockers, not here as steps.

What this roadmap adds on top of the decision is the **target set** — because
the source analysis got it materially wrong, and executing its Phase 0 as
written would have left the live doctrine standing.

## Goal

Every load-bearing artefact that currently forbids a resident process in core
either names the owner's reversal or is gone, and the public surfaces (README
headline, positioning, published comparison, claim ledger) state the **governed
policy**. No public surface asserts a supervision *property* — that claim
belongs to the dependent roadmap and only after its evidence exists. A reader
who greps `no runtime` afterwards finds historical records and one live
governance contract that permits supervised daemons under a stated contract,
never an active prohibition nobody repealed.

Static operation still works and a test proves it. The proof lives in the
dependent roadmap (its Phase 4.2), because it is the file that introduces the
process a regression could come from; naming it here as a goal without a test
anywhere was a gap a council seat correctly called aspirational.

## Atomic delivery groups

`execution: mode: phase-checkpoints` permits separate merges, so "in the same
change" as prose does not bind anything. These groups do. A council seat named
the failure the first draft allowed: Phase 2 retires the claim while Phase 3 is
blocked, leaving public text carrying a superseded claim marker and a comparison
row pointing at a retired ledger entry.

| Group | Must land together | Why it cannot be split |
|---|---|---|
| **A** | Phase 1 (ADR + both floors + non-reopenings) | A repeal naming one floor and merging without the other reads as complete and changes nothing. |
| **B** | Phase 2 (ledger edit + regenerated `docs/proof.md`) **and** the removal of the old absence claim from `README.md:17` | The claim marker and the text it marks are one statement. Splitting them publishes a surface marked with a superseded claim. |
| **C** | Phase 3 (all five steps) | All three public surfaces carry the same claim; landing one is the defect the transition blocker exists for. |
| **D** | Phase 4 (contract replacement + census closure) | The successor contract's class table is what the census classifies against. |

Group B is the one that changes the first draft's shape: the README absence-claim
removal moves out of Phase 3 and into Group B with the ledger, because once the
dependent roadmap's collector runs, "No resident runtime" is not stale — it is
false.

## What the analysis got wrong, verified

The source set names `ADR-088` as "der Beschluss-Anker" for the prohibition.
Reproduced at HEAD, that is **wrong in a way that matters**:

| Claim | Verdict | What is actually there |
|---|---|---|
| ADR-088 is the decision anchor | **never-true** | `ADR-088-no-external-runtime-federation.md:78` decides this suite does not *bridge to or drive other tools'* runtimes. It is about federation, not about owning a process. It also already carries `superseded_by: ADR-124`. |
| — | **the real anchor** | `ADR-124-embedded-engine-doctrine.md:13` — title reads "the service/daemon prohibition stands"; `:110` defines Class A (adoptable) and `:111` defines Class B (resident service / daemon) as "PROHIBITED in core", naming ADR-088/094 as *cited* authorities beneath it. |
| — | **a second live floor** | `ADR-109-subagent-v1-contract.md:28` — "the no-runtime identity floor (no daemon, no auto-write…)", `status: accepted`, `superseded_by: —`. |
| `docs/contracts/no-runtime-boundary.md` is the contract | **still-true** | Present, and its Prohibited table bans background processes, cross-session state stores and event loops. Its frontmatter also reads `keep-beta-until: 2026-08-17` — **expired ten days before this roadmap**, which is a finding of its own. |
| `no-runtime-daemon` claim at `CLAIMS.md:120` | **still-true** | `:120`/`:121`. `kind: qual`. |
| three `proof.md` lines | **diverged** | One row: `docs/proof.md:416`. |
| special case at `check_claims.ts:487` | **still-true** | `:487` is a comment recording how a `kind: qual` marker once licensed an unrelated figure. Not an exemption, but a real interaction the retirement must not break. |
| `comparison.yaml:31` | **still-true, path corrected** | `docs/comparison.yaml:31`, not `src/config/`. Line 31 is exactly the `claim: "No resident runtime …"` row, whose `failure_mode` argues *against* daemons as a competitive position. |
| README headline carries the thesis | **still-true** | `README.md:3` headline and `:17` body, the latter carrying the `no-runtime-daemon` claim marker. |
| `subagent-steering.md:107` prose invariant | **still-true** | Exact line: "A CONFIG PACKAGE RUNS NO DAEMON. THERE IS NO AUTOMATIC COHORT-DISABLE." |

Census, reproduced: **129 files** under `src/`, `docs/` and `README.md` match
`zero.runtime|no.runtime|no daemon|runtime daemon`. The first draft named only
the top three directories — `docs/decisions` (28), `src/scripts` (20),
`docs/contracts` (13) — and a council seat asked the right question: that is 61,
so where are the other 68? The full per-directory composition, summing to 129, is
a table in
[`runtime-reversal-owner-decision.md`](../evidence/analysis/runtime-reversal-owner-decision.md)
§ The census. It spreads across 37 further directories, most of them a single
skill or command using the phrase incidentally.

## Phase 0 — Bounded discovery, before anything public is rewritten

Both council seats rejected the first draft's ordering: it rewrote public
surfaces in Phase 3 and only then discovered what else blocks a resident process
in Phase 4. That is backwards — a contract designed before its constraints are
known is designed twice.

This phase is deliberately **bounded**, not the full census. One seat proposed a
mandatory complete 129-file classification before any correction; the other
argued that is unnecessarily large before fixing known-false public claims, and
that is the reading adopted here. Discovery finds the *load-bearing* set;
exhaustive closure stays in Phase 4.

- [x] **0.1 Enumerate every match mechanically and split by artefact class.**
      Not a judgement pass — a deterministic enumeration, so the population is
      known before anyone reasons about it.
      verify: **discharged.** `agents/evidence/analysis/no-runtime-discovery-2026-08-27.md`
      records the pinned expression verbatim, the base commit
      `830e31aa3ca7329b513b53328eadad4a92d471f7`, and the fresh counts:
      **129 files / 205 lines**, with the per-directory composition summing to 129.
      The count reproduces the figure the roadmap carried from a different day,
      so the population is stable rather than coincidental.
- [x] **0.2 Read only the classes that can refuse a resident process** — rules,
      contracts, schemas, gates, and accepted ADRs. Skills, commands, evidence
      records and archived roadmaps are out of scope for this phase by
      construction: a skill using the phrase incidentally cannot block anything.
      verify: **discharged.** The read set is exactly rules (2), contracts (13),
      schemas (3), gates (7) and accepted ADRs (24) = **49 of 129**, a 62 %
      reduction reported in the artefact next to the 129. The 80 out-of-scope
      files are counted and their exclusion basis stated (artefact class, not a
      reading); the four non-accepted ADRs among them are broken out separately.
- [x] **0.3 Name what a load-bearing blocker is, before classifying against it.**
      A council seat asked what distinguishes "load-bearing" from "incidental"
      and the first draft had no answer. The test: does the artefact, read
      literally by an agent or a gate, refuse an action this reversal permits? If
      yes it is active. If it merely describes the old state, it is historical.
      verify: **discharged, and the definition needed two more classes than the
      step anticipated.** Active / historical / incidental are defined in the
      artefact with the three worked examples the step asks for — `ADR-124:111`
      (active), `ADR-040:36` (historical), `config-presets.md:78` (incidental).
      The corpus forced two further classes rather than fitting the three:
      **derivative** (refuses nothing but reasons from a floor that is moving)
      and **not-reopened** (a real prohibition on a different subject —
      the agent-memory sunset — which this reversal does not touch). Collapsing
      not-reopened into active would have read as a general relaxation.
- [x] **0.4 Publish the discovery findings as a typed evidence artefact, and let
      them shape Phase 4.1's contract.** If discovery finds an active blocker
      nobody can remove, that is a Phase 4 input and possibly a new blocker —
      not a surprise during closure.
      verify: **first half discharged; the second half belongs to Phase 4.1 and is
      not claimed here.** The artefact exists, carries
      `<!-- evidence-type: analysis -->`, and `lint_evidence_artifacts` accepts it.
      **0.4's contingency did not fire:** no active blocker was found that nobody
      can remove — the active set is exactly three artefacts and all three are
      owned by phases this roadmap already has. Two findings that DO change Phase
      4.1's input are recorded: `no-runtime-boundary.md`'s literal scope is
      Mission-Mode rather than the suite (its own header says so, and `ADR-124:34`
      had already noticed), and its `keep-beta-until: 2026-08-17` expired ten days
      before this measurement.

## Phase 1 — Bind the decision against the right documents

- [x] **1.1 Write the supersede ADR against ADR-124, not ADR-088.** A new ADR
      records the owner's reversal and supersedes `ADR-124`'s § 4 Class-B row
      (`:111`) — the live prohibition — while stating that ADR-088's federation
      decision is *untouched*: not driving another tool's runtime and owning
      one's own supervised process are different questions, and the reversal
      only answers the second.
      verify: **discharged, and the step's own premise was corrected.** The
      base-commit reading returns 1. `ADR-249` carries
      `supersedes: ADR-124, ADR-109` with a `supersedes_scope` naming ADR-124 § 4
      Class-B (`:111`) and ADR-109 `:28` and nothing wider. ADR-124's remaining
      provisions were re-read at this base and confirmed authoritative in the
      ADR's § Decision 3: the Class-A adoption path (`:110`), the Class-C
      prohibition, the § 6 state-store test, and its own scoped supersession of
      ADR-088/094. **Correction:** this clause said partial supersession is "a
      convention in this tree, not a mechanism". Half true, and the half that is
      false mattered — `supersedes_scope` / `superseded_scope` are documented
      fields (`docs/contracts/adr-layout.md:59-60`), rendered back into the index
      by `regenerate_index.ts:205`, and were already carried by ADR-124 itself.
      What was missing was a VALIDATOR, which is 1.4. A council initially
      recommended amend-in-place on the false premise and reversed itself once the
      measurement was put to it.
- [x] **1.2 Amend the ADR-109 identity floor in the same change.** `:28`'s
      "no-runtime identity floor (no daemon, …)" is a second accepted floor with
      no `superseded_by`. Leaving it standing is the failure mode this phase
      exists to prevent — a repeal that names one document and misses the other
      reads as complete and changes nothing.
      verify: **discharged via the second branch, deliberately.** The phrase is
      left standing and now carries an explicit pointer to ADR-249 immediately
      below it, naming which clause moved ("no daemon") and which three did not
      (no auto-write, no in-process swarm, no dispatch we enforce). ADR-249's
      `supersedes` names **both** ADR-124 and ADR-109, and ADR-109 now carries the
      reciprocal `superseded_by: ADR-249` plus a `superseded_scope` — so
      `check_adr_frontmatter` no longer reports the link as one-sided, and
      `docs/decisions/INDEX.md:115` renders the scope in parentheses. Deleting the
      phrase would have satisfied the grep and produced exactly the untraceable
      amendment the clause warns about.
- [x] **1.3 State the non-reopenings explicitly in the ADR.** Runtime permitted
      is not agent-memory permitted (ADR-094 stands), not spawn-hardening relaxed
      (ADR-123 and `docs/spawn-site-policy.md` stand), and not a lethal-trifecta
      carve-out. Absent this paragraph the reversal reads as a general
      relaxation, which is the reading the safety floors cannot survive.
      verify: **discharged.** ADR-249 § Not reopened names ADR-094 and the
      2026-06-14 agent-memory / Layer-2 sunset, ADR-123 with
      `docs/spawn-site-policy.md`, and `lethal-trifecta-guard` — plus two the step
      did not ask for and the discovery pass showed were needed: ADR-109's
      auto-write clause and ADR-124 Class C. The discovery artefact lists nine
      further agent-memory lines across ADR-098/099/100/138 that are explicitly
      NOT superseded, so a later reader grepping "no daemon" and finding hits does
      not read the repeal as incomplete.
- [x] **1.4 Make the required section enforceable, or drop the word
      "required".** A council seat asked what happens if the ADR is written
      without 1.3's section, and the honest answer for the first draft was
      nothing. `check_adr_frontmatter.ts` already exists as the place a
      structural ADR requirement belongs.
      verify: **discharged via the first branch — the check exists and was seen
      red twice.** `check_scoped_supersession` in
      `src/scripts/check_adr_frontmatter.ts` enforces two invariants taken from
      `adr-layout`'s own text: a `supersedes_scope` with no refs is an error ("a
      scope with no refs is not a supersession"), and a scoped supersession must
      carry a `## Not reopened` section. Sabotage probes, both restored:
      renaming ADR-249's section to `## Scope notes` produced
      `❌ … must carry a \`## Not reopened\` section`; blanking its `supersedes` to
      `—` produced `❌ … \`supersedes_scope\` is set but \`supersedes\` names no ADR`.
      Six unit cases in `tests/scripts/check_adr_frontmatter.test.ts` (82 pass).
      **Staged, not retroactive:** `SCOPED_SUPERSESSION_SINCE = '2026-08-27'`
      mirrors the file's existing `REVIEW_TRIGGER_SINCE` pattern, so ADR-124
      (2026-07-23) and ADR-209 (2026-08-03) — which genuinely carry a scope with no
      remainder section — WARN rather than error. Without the staging the check
      reds two accepted records on the day it lands. **Known limit, recorded in the
      docstring:** it cannot require a scope wherever partial supersession was
      *intended*, because intent is not in the file.

## Phase 2 — Retire the claim through the ledger, never by deletion

- [x] **2.1 Move `no-runtime-daemon` to a superseded status in the ledger.** The
      repo's own lineage rule is that a withdrawn claim is recorded, not removed.
      `docs/CLAIMS.md:120` gets the status change. The successor claim is
      **policy-only and explicitly non-publishable** until the dependent
      roadmap's lifecycle evidence exists — a council seat found the first draft
      contradicting itself here, requiring "a successor claim about supervised
      runtime" in Phase 2 while Phase 3's split forbids publishing a supervision
      property. Policy-only resolves it: the ledger records that the doctrine
      changed, not that a property holds.
      verify: **discharged, and the status the step names had to be created.**
      `check_claims` exits 0 — `9 markered claim(s) bound · ledger 94 entries
      (58 backed, 29 unbacked inventory)`. The successor
      `resident-process-permitted-under-governance` appears at `docs/proof.md:425`
      with `status: unbacked`, and its text asserts a POLICY only: it names the
      four governance conditions and then states, in `non_inference`, that it
      licenses no supervision, lifecycle, isolation or reliability guarantee, and
      may not be markered in public prose while unbacked.
      **The step asked for "a superseded status" and no such status existed.**
      `docs/CLAIMS.md`'s enum was `backed | unbacked | resolved-null`, and
      `check_claims.ts:436` enforced `superseded_by` as resolved-null-only.
      Neither fit: `unbacked` means debt somebody should discharge, and
      `resolved-null` means a pre-registered threshold was missed. This claim was
      TRUE and was withdrawn by decision. An AI council (2026-08-27, 4/4 across
      two rounds) chose adding a fourth status over reusing either. So the ledger
      now carries **`withdrawn`**, defined narrowly — *a previously asserted claim
      retired by an explicit reversal decision, with no evidentiary failure* —
      with a **required `retired_by`** naming the decision, because a withdrawal
      nobody can trace to a record is an unexplained deletion wearing a status.
- [x] **2.2 Re-check the `kind: qual` interaction at `check_claims.ts:487`.**
      That comment records a real incident: a `qual` marker on a line let an
      unrelated number ride along. If the successor claim is quantitative, the
      README line it marks must be re-read against `is_quantified_claim`.
      verify: **discharged, and the interaction cannot recur here.** `check_claims`
      reports no `(unmarkered)` finding on `README.md`. The incident the comment
      records — a `kind: qual` marker letting an unrelated number ride along on
      the same line — is structurally unreachable for this retirement: the
      README's `claim:no-runtime-daemon` marker is **removed**, not re-pointed, so
      no line carries it to exempt anything. The successor is also `qual`, and it
      is `unbacked`, so it may not be markered in prose at all. The comment at
      `check_claims.ts` is left untouched: it records a real past incident and
      nothing about this change makes it stale.
- [x] **2.3 Rebuild the proof surface, and check the regeneration is scoped and
      deterministic.** `docs/proof.md` is generated; the claim edit is incomplete
      until the build has run in the same change. A bare porcelain check is not
      the right instrument — a council seat noted it can red on unrelated
      pre-existing worktree changes and can pass without showing the generator
      is deterministic.
      verify: **discharged, two runs, byte-identical.** `build_proof` was run twice
      and `shasum docs/proof.md` returned the same digest both times:
      `5db42e3f1cf59b2ef36df7404c1d320c69fd0664`. The check is scoped to that one
      path, as the step requires — a whole-tree porcelain check would have reddened
      on the unrelated ledger and README edits in the same working tree and proved
      nothing about the generator. Both rows render correctly:
      `docs/proof.md:414` shows `no-runtime-daemon | qual | withdrawn` and `:425`
      shows `resident-process-permitted-under-governance | qual | unbacked`, so the
      new status reaches the published surface rather than only the ledger.

## Phase 3 — Public surfaces state the DECISION, never the unproven capability

The council (2/2, 2026-08-27) rejected the first draft of this phase, and the
reason is worth keeping in the file rather than fixing silently. The draft gated
only 3.3 on the blocker and called `README.md` and `docs/positioning-evidence.md`
"internal-facing prose". `README.md:3` is the most public surface this repository
has. All three carry the same present-tense claim, so all three carry the same
evidence dependency — and AC-1 as first written could have passed with every one
of them publishing a supervision property nothing had yet proven.

The fix is not resequencing alone. It is a distinction between two different
statements: **the policy changed** is true the moment the Phase 1 ADR lands, and
**no unsupervised daemon runs here** is a capability claim that is true only
after the dependent roadmap's lifecycle suite is green. This phase ships the
first, and the second is published by that roadmap — not here, which is part of
why the collector was split out.

**The distinction needs a wording rule, not just an intention.** A council seat
noted that readers do not reliably separate "the policy is X" from "X holds", and
that a poorly worded policy statement becomes a false capability claim on its
own. So Phase 3 prose is bound by one rule: **name the constraint the repository
adopted, never a state of the world.** "Resident processes are permitted only
under the supervision contract" states an adopted rule. "Runtime is permitted
under a supervision contract" is the same sentence read as if the contract
already governs something running — a second seat flagged exactly that phrasing
in the first draft. Where the two readings are hard to separate, say the contract
is *being established*.

- [ ] **3.1 Rewrite the README headline and body to the policy, not the
      property.** `README.md:3` and `:17`. The old text asserts an absence
      (`zero runtime daemon`); the replacement states the governed position —
      runtime is permitted under a supervision contract — and says nothing yet
      about what has been measured.
      verify: `grep -c 'zero runtime daemon' README.md` returns 0, AND `grep -ci 'no unsupervised' README.md` returns 0 until Phase 6 lands.
- [ ] **3.2 Replace the positioning story rather than leaving a hole.**
      `docs/positioning-evidence.md:56`–`:74` records "zero runtime" as the
      load-bearing differentiator and argues explicitly that it is only credible
      *because* it is machine-checked. That argument survives intact; its object
      becomes the supervision contract, stated as the policy this repo adopted.
      verify: `grep -c "zero runtime" docs/positioning-evidence.md` returns 0, AND the replacement paragraph contains no present-tense supervision guarantee.
- [ ] **3.3 Retire the published comparison row, and do not replace it yet.**
      `docs/comparison.yaml:31` publishes "No resident runtime — no background
      daemon, no state database or service" as `checkable: true`, and its
      `failure_mode` describes a daemon as the competitor's defect. A published
      `checkable: true` row is precisely the surface that must not carry an
      unproven claim, so the row is **removed** here and a successor row is
      written by the dependent roadmap or not at all. The default is
      deterministic rather than a later judgement: **no row is published unless
      the lifecycle suite fully supports the template it would use** — a council
      seat objected that the first draft's "decide later" left the outcome open,
      and it was right that the defect was the missing default, not the timing.
      verify: `grep -c "No resident runtime" docs/comparison.yaml` returns 0, AND `docs/comparison.yaml` gains no row mentioning supervision in this phase.
- [ ] **3.4 Add the atomicity check as a gate, and define what counts as
      evidence.** A check that finds a present-tense supervision claim on any
      public surface while the lifecycle evidence does not exist must fail. "Can
      only pass once the suite is green" is not an implementation — a council seat
      noted a file-presence check can masquerade as evidence. The check
      establishes four things: the named suite exists, it ran on **this**
      revision, it exercised real processes, and its result was not empty or
      skipped.
      verify: the check reds on a deliberately seeded README line asserting supervision; it also reds when handed an emptied suite and when handed a result from a different revision. Three seeded negatives, all three observed — a check never seen red has unknown sensitivity.
- [ ] **3.5 Correct the stale figure only if the rewritten argument uses it.**
      `docs/positioning-evidence.md` states "261 skills, 93 rules"; the measured
      count is 299 (`find src/skills -name SKILL.md | wc -l`). The first draft
      justified fixing it with "while in the file", and a council seat rejected
      that as a non-boundary — correctly, since a doctrine transition has enough
      unrelated failure modes. The test is narrower: the figure sits in the
      subline that carries the differentiator argument 3.2 rewrites, so if the
      rewritten paragraph still cites a corpus size, the number is part of this
      change. If the rewrite drops the figure, this step closes `[-]` and the
      stale number elsewhere becomes its own maintenance item.
      verify: either `grep -c "261 skills" docs/positioning-evidence.md` returns 0 with the rewritten paragraph citing a measured figure, or the step is `[-]` and a separate item exists.

## Phase 4 — Contract replacement and the census over everything else

- [ ] **4.1 Replace `no-runtime-boundary.md` with a governance contract.** Its
      Allowed table stays almost verbatim — codegen, file I/O, one-shot shell,
      git-as-state are all still right. Its Prohibited table becomes a *class*
      table: which processes may be resident, under whose supervision, with what
      lifecycle and what termination guarantee. The expired
      `keep-beta-until: 2026-08-17` is resolved in the same change rather than
      carried into a new file.
      verify: `docs/contracts/no-runtime-boundary.md` is absent or a pointer stub, the successor contract exists, and `./scripts-run src/scripts/check_references` exits 0.
- [ ] **4.2 Run the semantic census over the remaining 129 files and classify
      every hit.** Three buckets only: *historical* (an evidence record or
      archived roadmap — untouched), *incidental* (the phrase means something
      else — untouched), *active blocker* (a live rule, contract, schema or gate
      that would refuse a supervised process — rewritten or superseded). The
      output is a typed evidence artefact, not prose in this file. The **129** in
      this step's title is a reading at authoring time, not a target: Phases 1–3
      rewrite some of the matching wording, so the census regenerates the count
      at execution time and records the pinned expression and the base commit it
      was first read against.
      verify: `agents/evidence/analysis/no-runtime-surface-census.md` exists, opens with an `evidence-type: analysis` marker, records the grep expression verbatim plus the base commit, and its bucket counts sum to the count the census re-ran — never to 129.
- [ ] **4.2b Make the classification auditable rather than mechanical.** One
      council seat wanted every classification mechanically enforced; the other
      answered that semantic classification of an ADR passage genuinely requires
      judgement and that the control should make judgement **auditable**, not
      pretend it can be removed. That is the reading adopted. The requirements:
      deterministic enumeration of all matches, the explicit classification rule
      from Phase 0.3, a reason and an authority status on every non-blocker
      entry, and zero unreviewed entries.
      verify: every `historical` and `incidental` entry carries a one-line reason and an authority status; the unreviewed count is 0; and a second reader has approved the non-blocker classifications — so an active blocker cannot be retired by relabelling it alone.
- [ ] **4.3 Rewrite the prose invariants the census marks active.**
      `subagent-steering.md:107` is the known instance and is a projected
      context file, so the source edit is under `src/` and the projection is
      regenerated, never hand-edited.
      verify: after the source edit, capture the projected paths, run `task sync` then `task generate-tools` TWICE, and assert a scoped diff on those paths only — byte-identical across both runs and matching the committed tree. Not a whole-tree porcelain check: that reds on unrelated worktree state and passes without showing the generators are deterministic.

## Blockers

### blocker: public-claim-transition-shape

- **Status:** open
- **Owner:** maintainer
- **Blocks:** all of Phase 3, and `status: ready` for this file. Phases 0, 1, 2
  and 4 land regardless — with the one exception encoded in delivery Group B,
  which pulls the README absence-claim removal forward out of Phase 3. The first
  draft gated 3.3 alone and called README internal-facing prose; the council
  (2/2, 2026-08-27) rejected that, correctly.
- **What to do:** pick exactly one — (a) the two-statement split this roadmap
  now implements, where Phase 3 publishes the *policy* and the dependent roadmap
  publishes the *property*, accepting one release in which the public text says
  what changed and claims nothing measured; (b) hold all of Phase 3 until the
  dependent roadmap's lifecycle suite is green and land the whole transition in
  one delivery, atomic but leaving a superseded claim published for the length of
  the runtime build; or (c) keep a present-tense claim in Phase 3 and accept an
  unverified window, which is what the first draft did by accident.
- **Resolved when:** the choice is recorded in the Phase 1 ADR, the 3.4 check has
  been seen red on all three seeded negatives, and this file's status is flipped
  to `ready` in the same change.
- **Recommendation:** (a). It is the only option under which no public surface
  ever asserts an unproven property, and the wording rule in Phase 3 is what
  makes it survivable — a council seat was right that a carelessly phrased policy
  statement becomes a capability claim, so (a) depends on that rule rather than
  on good intentions. (b) leaves `docs/comparison.yaml:31` publishing a claim the
  repo has already decided against, which is a different false statement rather
  than fewer. (c) is not on the table — it is the defect.
- **Decision recorded (2026-08-27), closure still pending 3.4:** **(a)**, the
  two-statement split, confirmed by an AI council over the alternatives. The
  choice is written into the Phase 1 ADR as required — `ADR-249` § *The
  public-surface transition this record authorises* — together with the
  **mechanical wording rule** the council supplied when asked for one an
  autonomous run could apply without judgement: a maintained public surface may
  state the adopted policy, that runtime work is pending, and currently-backed
  runtime-neutral capabilities; it may not assert runtime absence, assert an
  unverified runtime property, or present a policy adjective such as "governed"
  as an established property of an implemented runtime.
  The council also found this blocker's ordering invariant (Group B) **necessary
  but not sufficient**: removing a public claim does not stop an OLDER revision
  from activating a process. The stronger form — no resident process may execute
  from any revision that has not already retired the claim — is now governance
  condition 4 in ADR-249, so the obligation survives whichever roadmap builds
  first.
  **The blocker stays open** because two of its three `Resolved when` clauses are
  Phase 3 work: the 3.4 check has not been seen red on three seeded negatives, and
  this file's `status` is still `draft`. Recording the choice does not close it.
- **If you do nothing:** Phase 3 is blocked, so the repo keeps publishing the old
  no-daemon claim while its own ADR says otherwise. **That is stale only until
  the dependent roadmap's collector runs** — a council seat corrected the first
  draft here, and the correction matters: a running daemon makes "No resident
  runtime" factually false, not merely out of date. Hence the invariant in
  Group B: the old absence claim must already be gone before any resident process
  executes, whichever option is chosen.

### blocker: partial-supersession-semantics

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 1 steps 1.1 and 1.2. Phase 0 lands regardless, and its
  discovery output is a useful input to whichever answer wins.
- **What to do:** pick exactly one — (a) establish section-level supersession as
  a schema field and a validated convention before 1.1 writes the ADR, which is
  the only option where a reader of ADR-124 afterwards can tell which parts still
  bind, and which costs a contract change to `check_adr_frontmatter`; (b)
  **amend** ADR-124 in place instead of superseding it, replacing the Class-B row
  and leaving the document authoritative — cheaper and it keeps one document as
  the doctrine, but amendment-in-place has its own reachability problem, since a
  reader who cited the old row finds no record it moved; or (c) supersede ADR-124
  whole and re-state its still-live Class-A adoption path in the new ADR, which
  needs no new mechanism and duplicates a provision that is load-bearing
  elsewhere.
- **Resolved when:** the answer is recorded, and for (a) the schema field exists
  and its validator has been seen reject a scope-less partial supersession.
- **Recommendation:** (b). Both council seats independently flagged that the
  roadmap assumed a mechanism the repository does not have — a plain
  `supersedes: ADR-124` may read as whole-document supersession however the prose
  intends it. (b) is the smallest change that removes the ambiguity entirely,
  because there is no supersession to misread. (c) duplicates the Class-A row,
  which is exactly the kind of second copy that later drifts; (a) is the most
  correct and is a contract change this reversal does not need to pay for.
- **If you do nothing:** 1.1 cannot be written honestly. Its own verify now
  demands that the scope text be read and that ADR-124's remaining provisions be
  confirmed authoritative — neither is answerable while the mechanism is
  undefined, so the phase stops rather than shipping an ADR whose reach nobody
  can state.
- **Resolution (2026-08-27):** **(a′)** — use the mechanism that already
  exists. The blocker's own premise, and the recommendation of **(b)** that rested
  on it, were **measured false**: `supersedes_scope` / `superseded_scope` are
  documented sibling fields (`docs/contracts/adr-layout.md:59-60`, convention at
  `:105-117`), are rendered back into the index by `regenerate_index.ts:205`
  → `supersessionCell`, and were **already carried by ADR-124 itself**
  (`supersedes_scope: engine-adoption interpretation only`). What was genuinely
  missing was a validator, not a schema field — so option (a)'s stated cost, "a
  contract change to `check_adr_frontmatter`", was an overestimate of the wrong
  thing. An AI council put to the measurement reversed its own earlier
  recommendation, unanimously across four positions, and added the reason (b) is
  worse than it looks: ADR-124 is itself a reversal ADR whose Class-B row is the
  provision being reversed again, so amending in place would make one document
  assert two opposite positions across its own history with no record of the
  transition.
  Both halves of the `Resolved when` are met. The answer is recorded (here and in
  ADR-249 § Decision 2), and the validator has been **seen reject** a scope-less
  partial supersession — see 1.4's verify for both sabotage probes and their
  restoration.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-27 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The repeal names one document and misses the other | implementation | ADR-124 § 4 and ADR-109's identity floor are independent accepted floors. Superseding only the one the source analysis named leaves a live prohibition, and the change reads as complete. | 1.1 and 1.2 are separate steps with separate checks, 1.2 additionally requires the new ADR to name BOTH, and Phase 0's bounded discovery is the backstop that finds a third floor before any public surface is touched. | Phase 1 — Bind the decision against the right documents |
| 2 | A safety floor is relaxed as collateral | implementation | "Runtime is allowed" is one grep away from "persistence is allowed", which reopens ADR-094 agent-memory, and one more from relaxing spawn hardening. | 1.3 makes the non-reopenings a required ADR section and 1.4 makes that requirement enforceable or withdraws the word; Phase 0.3's rule classifies by what an artefact REFUSES, so an agent-memory prohibition is never in the active-blocker bucket. | Phase 1 — Bind the decision against the right documents |
| 3 | A public surface asserts a supervision property nothing has proven | product | This is the defect the council found in the first draft, not a hypothetical: three surfaces carried one present-tense claim and the blocker gated one of them. Wording is the residual risk — a policy sentence read as a capability claim is the same failure with better intentions. | The policy/property split, the Phase 3 wording rule (name the adopted constraint, never a state of the world), and the 3.4 check with three seeded negatives AC-2 requires to have been observed. | Phase 3 — Public surfaces state the DECISION, never the unproven capability |
| 4 | The old absence claim is still published when the first daemon runs | product | Between the repeal and the public rewrite, "No resident runtime" is merely stale. The moment the dependent roadmap's collector executes it is false, and the transition blocker's own first draft said "stale rather than false" without that bound. | Delivery Group B pulls the README absence-claim removal forward out of Phase 3 and binds it to the ledger edit, with the invariant stated in the blocker: the old claim is gone before any resident process executes, whichever transition option wins. | Atomic delivery groups |
| 5 | The census absorbs the roadmap, or checksums stale data | implementation | A three-way sweep over 129 files is larger than the artefacts it supports, and earlier phases rewrite some of the matching wording — so a hardcoded 129 verifies against a number that no longer describes the tree. | Phase 0 is bounded discovery over the five artefact classes that can refuse, not the full corpus; Phase 4's closure census re-runs the pinned expression rather than asserting 129, and 4.2b makes the judgement auditable instead of pretending it is mechanical. | Phase 0 — Bounded discovery, before anything public is rewritten |
| 6 | Partial supersession is assumed to work and does not | implementation | The roadmap asks for an ADR that supersedes one row of ADR-124. Both council seats found no evidence the repository supports section-level supersession; a plain `supersedes` field may read as whole-document. A reader afterwards cannot tell which provisions bind. | The `partial-supersession-semantics` blocker gates 1.1 and 1.2 on choosing a mechanism, and 1.1's verify requires the scope text to be READ and ADR-124's remaining provisions confirmed, rather than a field's presence asserted. | Phase 1 — Bind the decision against the right documents |

## Acceptance Criteria

Nine criteria, all governance. The daemon's ten live in
`road-to-supervised-telemetry-collector.md` — the first draft had them here,
which is how one roadmap came to own two rollbacks.

- [ ] AC-1 — `grep -rniIE 'zero.runtime|no runtime daemon' README.md docs/positioning-evidence.md docs/comparison.yaml` returns zero matches, and each of those three files states the governed *policy* under the Phase 3 wording rule. No present-tense supervision guarantee appears on any public surface, full stop — publishing one is the dependent roadmap's business and only after its evidence exists.
      **The `-E` is the fix, not a detail.** The first draft omitted it, and in a basic regex `|` is a literal pipe — so the pattern matched nothing and the criterion would have passed with the forbidden text still in place. Proved on a one-line fixture before writing this: without `-E`, count 0 and exit 1; with `-E`, count 1. A criterion that cannot fail is not a criterion, which is the failure class this repository names as gates-that-scan-nothing-exit-green. Every other grep-shaped verify in this file was re-read for the same defect; they are single-pattern and clean.
- [ ] AC-2 — The Phase 3.4 check exists and has been **seen red** three times on seeded negatives: a public-surface supervision claim, an emptied lifecycle suite, and a suite result from a foreign revision. Green at close.
- [ ] AC-3 — No accepted ADR in `docs/decisions/` prohibits a resident process in core without naming the superseding record. `ADR-124:111` and `ADR-109:28` both resolve to the Phase 1 ADR, whose `supersedes` names both. Whether ADR-124's other provisions survive is answered by the mechanism the `partial-supersession-semantics` blocker chose — and the answer is recorded, not assumed.
- [ ] AC-4 — Phase 0's discovery artefact exists with an `evidence-type: analysis` marker, states the load-bearing definition from 0.3 with its three worked examples, and Phase 4.1's contract cites it.
- [ ] AC-5 — `docs/contracts/no-runtime-boundary.md` is no longer a live authority, its successor contract classifies resident processes by lifecycle and supervision, the expired `keep-beta-until` is resolved rather than carried forward, and `check_references` exits 0.
- [ ] AC-6 — The claim `no-runtime-daemon` carries a superseded status and a named successor whose own text contains no supervision guarantee; `check_claims` is green and `docs/proof.md` is byte-identical across two consecutive regenerations.
- [ ] AC-7 — `agents/evidence/analysis/no-runtime-surface-census.md` records its pinned expression and base commit, re-ran the count at execution time, and every `historical` and `incidental` entry carries a reason plus an authority status with zero unreviewed entries and a second reader's approval. The `active-blocker` bucket is empty at close.
- [ ] AC-8 — The four delivery groups landed as groups. Checked by reading the merge history: no commit range contains a Group member without its siblings.
- [ ] AC-9 — Both blockers carry a `resolved` status naming the chosen option, and this file's `status` is `ready` — the flip is what records that the release decision was actually taken rather than deferred.
