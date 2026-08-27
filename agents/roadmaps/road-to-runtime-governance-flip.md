---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-27
relates: []
# relates: grepped every active, later and archived roadmap for `no-runtime`,
# `zero runtime`, `daemon` and `control plane`. The archived runtime-* family
# (road-to-runtime-security-hardening, road-to-portable-runtime-and-update-check,
# road-to-mcp-runtime-integrity) uses "runtime" for the CLI's own execution, not
# for a resident process, so none of them carries the doctrine this file repeals.
# road-to-experience-loop-broadening:108 is the one live intersection and is
# folded rather than related — see Phase 5.
estate_growth_exempt: "Charges +1 on the count half. Warranted on an owner decision recorded verbatim, not on an opinion: the owner directed the reversal in the source transcript (agents/tmp.old/uncle-bob-swarm/chat.txt:130) and no existing roadmap carries a doctrine-repeal item. The alternative — folding a public-identity reversal into a feature roadmap — would bury the one change every downstream reader of README.md:3 needs to find."
estate_offset_exempt: "No archive move is available in this change, and the consolidation offset is claimed HERE ONLY — the sibling roadmap states plainly that it has none. The council (2/2, 2026-08-27) caught the first draft citing the same avoided expansion in both files: one consolidation cannot independently offset two additions. Sixteen source proposals across four generations are reduced to two roadmaps plus one stub; this file carries that offset because it is the one the owner directed, and the 21-phase consolidated master is referenced as a blueprint rather than landed."
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

The reversal is not proposed here. It was directed, in the owner's own words,
in the source transcript:

DE: "ich will dass AC umgebaut wird, da ich aktiv entschieden habe, Zero Runtime ist nicht mehr unser Ziel. Alles was das behauptet, in Frage stellt oder uns von verbesserungen abhält soll deprecated oder entfernt werden. Auch die Readme soll angepasst werden. Wir werden runtime und deamons haben. Das ist ein Ziel, um die Qualität zu gewährleisten."

EN: "I want AC rebuilt, because I have actively decided that Zero Runtime is no longer our goal. Anything that asserts it, questions that, or holds us back from improvements is to be deprecated or removed. The README is to be adapted as well. We will have runtime and daemons. That is a goal, in order to guarantee quality."

The German is the original, kept verbatim under the bilingual-anchor escape
because it is the authority record; the English is the working translation.
That sentence is the authority for every phase below. What this roadmap adds is
the **target set** — because the analysis got it materially wrong, and executing
its Phase 0 as written would have left the live doctrine standing.

## Goal

Every load-bearing artefact that currently forbids a resident process in core
either names the owner's reversal or is gone, and the public surfaces (README
headline, positioning, published comparison, claim ledger) state what is
actually true. A reader who greps `no runtime` afterwards finds historical
records and one live governance contract that permits supervised daemons — never
an active prohibition nobody repealed. Static operation still works; it is a
compatibility mode, not a veto.

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
`zero.runtime|no.runtime|no daemon|runtime daemon`, concentrated in
`docs/decisions` (28), `src/scripts` (20), `docs/contracts` (13). Most are
incidental phrasing. Separating the incidental from the load-bearing is Phase 4,
and it is deliberately *after* the public surfaces: the five artefacts above are
known, and a 129-file sweep must not gate the four that were verified by hand.

## Phase 1 — Bind the decision against the right documents

- [ ] **1.1 Write the supersede ADR against ADR-124, not ADR-088.** A new ADR
      records the owner's reversal and supersedes `ADR-124`'s § 4 Class-B row
      (`:111`) — the live prohibition — while stating that ADR-088's federation
      decision is *untouched*: not driving another tool's runtime and owning
      one's own supervised process are different questions, and the reversal
      only answers the second.
      verify: the base-commit reading `git show HEAD:docs/decisions/ADR-124-embedded-engine-doctrine.md | grep -c "PROHIBITED in core"` is 1; the new ADR's `supersedes` names ADR-124 with a `supersedes_scope` whose text identifies the § 4 Class-B row and nothing wider; and ADR-124's remaining provisions — the Class-A adoption path at `:110` above all — are re-read and confirmed still authoritative. A `supersedes` field that merely EXISTS is not the check: partial supersession is a convention in this tree, not a mechanism, so the scope must be read rather than asserted.
- [ ] **1.2 Amend the ADR-109 identity floor in the same change.** `:28`'s
      "no-runtime identity floor (no daemon, …)" is a second accepted floor with
      no `superseded_by`. Leaving it standing is the failure mode this phase
      exists to prevent — a repeal that names one document and misses the other
      reads as complete and changes nothing.
      verify: `grep -c "no-runtime identity floor" docs/decisions/ADR-109-subagent-v1-contract.md` returns 0, or the line carries an explicit pointer to the new ADR.
- [ ] **1.3 State the non-reopenings explicitly in the ADR.** Runtime permitted
      is not agent-memory permitted (ADR-094 stands), not spawn-hardening relaxed
      (ADR-123 and `docs/spawn-site-policy.md` stand), and not a lethal-trifecta
      carve-out. Absent this paragraph the reversal reads as a general
      relaxation, which is the reading the safety floors cannot survive.
      verify: the ADR contains a "Not reopened" section naming ADR-094, ADR-123 and `lethal-trifecta-guard`.

## Phase 2 — Retire the claim through the ledger, never by deletion

- [ ] **2.1 Move `no-runtime-daemon` to a superseded status in the ledger.** The
      repo's own lineage rule is that a withdrawn claim is recorded, not removed.
      `docs/CLAIMS.md:120` gets the status change and a successor claim about
      *supervised* runtime; `docs/proof.md:416` follows.
      verify: `./scripts-run src/scripts/check_claims` exits 0 and the successor claim id appears in `docs/proof.md`.
- [ ] **2.2 Re-check the `kind: qual` interaction at `check_claims.ts:487`.**
      That comment records a real incident: a `qual` marker on a line let an
      unrelated number ride along. If the successor claim is quantitative, the
      README line it marks must be re-read against `is_quantified_claim`.
      verify: `./scripts-run src/scripts/check_claims` reports no `(unmarkered)` finding on `README.md`.
- [ ] **2.3 Rebuild the proof surface.** `docs/proof.md` is generated; the claim
      edit is incomplete until the build has run in the same change.
      verify: `./scripts-run src/scripts/build_proof` leaves `docs/proof.md` clean in the porcelain status output.

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
after Phase 5.2. This phase ships the first. The second is Phase 6.

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
      written in Phase 6 or not at all. Gated on the blocker below.
      verify: `grep -c "No resident runtime" docs/comparison.yaml` returns 0, AND `docs/comparison.yaml` gains no row mentioning supervision in this phase.
- [ ] **3.4 Add the atomicity check as a gate, not as a promise.** A grep that
      finds a present-tense supervision claim on any public surface while the
      Phase 5.2 evidence does not exist should fail. Without it this phase's
      discipline lives only in the prose above.
      verify: the check exists, and it reds on a deliberately seeded README line asserting supervision — a check never seen red has unknown sensitivity.
- [ ] **3.5 Correct the stale figures found while in the file.** The same
      positioning file states "261 skills, 93 rules"; the measured count is 299
      (`find src/skills -name SKILL.md | wc -l`). Fixing a number in a paragraph
      being rewritten anyway is in scope; a sweep of every stale figure elsewhere
      is not.
      verify: `grep -c "261 skills" docs/positioning-evidence.md` returns 0.

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
- [ ] **4.3 Rewrite the prose invariants the census marks active.**
      `subagent-steering.md:107` is the known instance and is a projected
      context file, so the source edit is under `src/` and the projection is
      regenerated, never hand-edited.
      verify: `task sync` then `task generate-tools` leave `dist/` and `.augment/` clean in the porcelain status output after the source edit.

## Phase 5 — The first supervised daemon pays the oldest measurement debt

- [ ] **5.1 Build the telemetry collector as the first Class-B process.** The
      active roadmap `road-to-experience-loop-broadening.md:108` already names
      "a collector" as the missing writer behind the 0.27 % dispatch-capture
      figure (370 dispatches, 1 recorded line). That roadmap could not build one
      while ADR-124 § 4 stood. It can now, and this is the fold: the item stays
      in that file, this step only records that Phase 1 unblocks it.
      verify: `grep -c "0.27" agents/roadmaps/road-to-experience-loop-broadening.md` is greater than 0 and that file gains a pointer to the new ADR.
- [ ] **5.2 Write the telemetry data contract before the collector writes
      anything.** A resident process persisting dispatch information is a new
      data surface, and this repository's existing discipline is
      PII-exclusion-by-construction: the event type carries no field capable of
      holding a prompt, a file body, a path or an identifier. Retention,
      filesystem permissions, opt-in default and deletion semantics are stated
      before the first write, not audited after it. Phase 1.3's lethal-trifecta
      non-reopening is not a substitute for this — it says a floor was not
      relaxed, which is a different statement from what this daemon may store.
      verify: the event type has no free-form field, and a test asserts that a record carrying a prompt-shaped string is rejected at the type boundary rather than scrubbed.
- [ ] **5.3 Prove supervision as observable lifecycle, not as persistence.**
      The first draft's verify asserted that state survives SIGKILL and that a
      second instance refuses to start. The council (2/2) named that correctly:
      those are *persistence* and *exclusivity*. Neither is supervision, and the
      word in the README is supervision.
      verify: a test suite demonstrates all five — death is detected by the supervisor, restart happens within a stated bound, a stale owner record is fenced on restart, graceful shutdown leaves no orphan, and exactly one collector is live after each transition.
- [ ] **5.4 Define success before measuring, then measure.** The daemon exists
      to move the 0.27 % capture figure. The threshold is written down *before*
      the collector runs, so the outcome can disappoint rather than be
      reinterpreted.
      verify: a target rate is recorded before 5.1 closes, and the measured rate afterwards is written into the claim ledger with its own marker.
- [ ] **5.5 Act on a miss instead of explaining it.** If the measured rate is
      below the 5.4 target, the collector stays default-off and the shortfall
      becomes its own decision record. "The figure moved" is not a result: 0.27 %
      to 0.28 % is a move and pays nothing.
      verify: either the target is met and the collector's default is flipped on, or the collector is default-off and a decision record names what was measured and what it costs to close.

## Phase 6 — Only now may a public surface claim the property

- [ ] **6.1 State the supervision guarantee on the public surfaces, once the
      evidence exists.** Phase 3 changed those surfaces to describe the policy.
      This is where they may describe the capability — after 5.2's data contract
      and 5.3's lifecycle suite, and not before.
      verify: the Phase 3.4 atomicity check passes with the supervision claim present, which it can only do once 5.3's suite is green.
- [ ] **6.2 Decide whether the comparison row comes back at all.** Phase 3.3
      removed it without a successor on purpose. A new `checkable: true` row is
      only honest if 5.3's suite is the thing that checks it; if the suite covers
      less than the row would claim, the right answer is no row.
      verify: either `docs/comparison.yaml` carries a supervision row whose `our_evidence` points at the 5.3 suite, or this step is closed `[-]` with the reason that the suite does not support a published claim.

## Blockers

### blocker: public-claim-transition-shape

- **Status:** open
- **Owner:** maintainer
- **Blocks:** all of Phase 3 (3.1 README, 3.2 positioning, 3.3 comparison) and
  all of Phase 6. Phases 1, 2, 4 and 5 land regardless. The first draft of this
  blocker gated 3.3 alone and described README as internal-facing prose; the
  council (2/2, 2026-08-27) rejected that, correctly — all three surfaces carry
  the same claim and therefore the same evidence dependency.
- **What to do:** pick exactly one — (a) the two-statement split this roadmap
  now implements, where Phase 3 publishes the *policy* and Phase 6 publishes the
  *property* after 5.3, accepting one release in which the public text says what
  changed and claims nothing measured; (b) hold all of Phase 3 until 5.3 is
  green and land the whole transition in one delivery, which is atomic but keeps
  a superseded claim published for the length of the runtime build; or (c) keep
  a present-tense claim in Phase 3 and accept a window in which it is
  unverified, which is what the first draft did by accident.
- **Resolved when:** the choice is recorded in the Phase 1 ADR, and the 3.4
  atomicity check has been seen red on a seeded violation.
- **Recommendation:** (a). It is the only option under which no public surface
  ever asserts an unproven property: "runtime is permitted under a supervision
  contract" is true at ADR-merge time and needs no measurement. (b) is defensible
  but leaves `docs/comparison.yaml:31` publishing a claim the repo has already
  decided against, which is a different false statement rather than fewer. (c) is
  not on the table — it is the defect.
- **If you do nothing:** Phase 3 is blocked, so the repo keeps publishing the old
  no-daemon claim while its own ADR says otherwise. That is stale rather than
  false, which is why this blocker can hold without being urgent — and it is
  strictly better than the first draft's outcome, which was a *new* false claim.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-27 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The repeal names one document and misses the other | implementation | ADR-124 § 4 and ADR-109's identity floor are independent accepted floors. Superseding only the one the source analysis named leaves a live prohibition, and the change reads as complete. | 1.1 and 1.2 are separate steps with separate greps, and 4.2's census is the backstop that finds a third floor if one exists. | Phase 1 — Bind the decision against the right documents |
| 2 | A safety floor is relaxed as collateral | implementation | "Runtime is allowed" is one grep away from "persistence is allowed", which reopens ADR-094 agent-memory, and one more from relaxing spawn hardening. | 1.3 makes the non-reopenings a required ADR section, and the census in 4.2 classifies by what the artefact refuses, so an agent-memory prohibition is never in the active-blocker bucket. | Phase 1 — Bind the decision against the right documents |
| 3 | A public surface asserts a supervision property nothing has proven | product | This is the defect the council found in the first draft, not a hypothetical: three surfaces carried one present-tense claim and the blocker gated one of them. | The policy/property split — Phase 3 publishes what changed, Phase 6 publishes what was measured — plus the 3.4 atomicity check, which AC-2 requires to have been seen red. | Phase 3 — Public surfaces state the DECISION, never the unproven capability |
| 4 | The 129-file census becomes the roadmap, or checksums stale data | implementation | A three-way sweep over ~129 files is larger than the five hand-verified artefacts it supports. Worse, earlier phases rewrite some of the matching wording, so a hardcoded 129 verifies against a number that no longer describes the tree. | The census is Phase 4, after the public surfaces; its verify pins the expression and base commit and re-runs the count at execution rather than asserting 129. | Phase 4 — Contract replacement and the census over everything else |
| 5 | The daemon ships and the number it was justified by never moves | product | 5.1 is buildable and satisfying; the measurement is the part that pays the debt. The first draft let the phase close on "the figure moved, or record why it did not", which 0.27 % to 0.28 % satisfies. | 5.4 records the target before the collector runs and 5.5 makes a miss an action — default-off plus a decision record — rather than an explanation. | Phase 5 — The first supervised daemon pays the oldest measurement debt |
| 6 | The telemetry collector becomes a new data surface nobody scoped | product | A resident process persisting consumer dispatch information is the first thing in this tree that stores data across invocations. Retention, permissions and opt-in are easy to add after the first write and expensive to retrofit. | 5.2 is the contract, ordered before any write, and AC-7 requires the event type to have no free-form field at all — exclusion by construction rather than a scrubber that can fail. | Phase 5 — The first supervised daemon pays the oldest measurement debt |

## Acceptance Criteria

- [ ] AC-1 — `grep -rniIE 'zero.runtime|no runtime daemon' README.md docs/positioning-evidence.md docs/comparison.yaml` returns zero matches, and each of those three files states the governed *policy*. No present-tense supervision guarantee appears on any public surface until AC-7 holds.
      **The `-E` is the fix, not a detail.** The first draft omitted it, and in a basic regex `|` is a literal pipe — so the pattern matched nothing and the criterion would have passed with the forbidden text still in place. Proved on a one-line fixture before writing this: without `-E`, count 0 and exit 1; with `-E`, count 1. A criterion that cannot fail is not a criterion, which is the failure class this repository names as gates-that-scan-nothing-exit-green. Every other grep-shaped verify in this file was re-read for the same defect.
- [ ] AC-2 — The Phase 3.4 atomicity check exists, has been **seen red** on a seeded public-surface supervision claim, and is green at close.
- [ ] AC-3 — No accepted ADR in `docs/decisions/` prohibits a resident process in core without naming the superseding record: `ADR-124:111` and `ADR-109:28` both resolve to the Phase 1 ADR, and ADR-124's provisions outside that row are still authoritative — asserted by reading the file, not by the `supersedes` field alone.
- [ ] AC-4 — `docs/contracts/no-runtime-boundary.md` is no longer a live authority, its successor contract classifies resident processes by lifecycle and supervision, and `check_references` exits 0.
- [ ] AC-5 — The claim `no-runtime-daemon` is present in the ledger with a superseded status and a named successor; `check_claims` and `build_proof` are both green in the same commit.
- [ ] AC-6 — `agents/evidence/analysis/no-runtime-surface-census.md` records its pinned expression and base commit, re-ran the count at execution time, classifies every hit, and carries a one-line reason on every `historical` and `incidental` entry — so an active blocker cannot be retired by relabelling it. The `active-blocker` bucket is empty at close.
- [ ] AC-7 — The telemetry event type has no free-form field and rejects a prompt-shaped record at the type boundary; retention, permissions, opt-in default and deletion semantics are stated in the contract before the first write.
- [ ] AC-8 — All five lifecycle properties are demonstrated by a test suite: death detected, restart within the stated bound, stale owner fenced, graceful shutdown without orphan, exactly one collector live after each transition.
- [ ] AC-9 — A target capture rate was recorded before the collector ran, the measured rate is in the ledger, and the outcome is acted on rather than explained: target met and the default flipped on, or default-off with a decision record naming the shortfall.
