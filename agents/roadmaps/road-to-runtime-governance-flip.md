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
estate_offset_exempt: "No archive move is available in this change. Sixteen source proposals across four generations are reduced to two roadmaps plus one stub, which is the offset that was available to make; the 21-phase consolidated master is referenced as a blueprint rather than landed."
---
# Road to runtime governance — the doctrine the owner repealed is anchored in five places, and only one of them is the ADR the analysis named

> **Source:** `agents/tmp.old/uncle-bob-swarm/` (2026-08-27) — a two-session
> agent swarm that analysed this tree against an external process-integrity
> reference across four generations of roadmap, plus the transcript that
> produced them. Drafted against `f2ed85e`, which **is** `origin/main` at
> authoring time: zero commits of staleness window, so every claim below is
> either true at HEAD or was never true.

## The owner decision this executes

The reversal is not proposed here. It was directed, in the owner's own words,
in the source transcript:

> "ich will dass AC umgebaut wird, da ich aktiv entschieden habe, Zero Runtime
> ist nicht mehr unser Ziel. Alles was das behauptet, in Frage stellt oder uns
> von verbesserungen abhält soll deprecated oder entfernt werden. Auch die
> Readme soll angepasst werden. Wir werden runtime und deamons haben."

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
      verify: the base-commit reading `git show HEAD:docs/decisions/ADR-124-embedded-engine-doctrine.md | grep -c "PROHIBITED in core"` is 1, and the new ADR's `supersedes` field names ADR-124 with a scope string.
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

## Phase 3 — Public positioning, including the comparison row that argues the other way

- [ ] **3.1 Rewrite the README headline and body claim.** `README.md:3` and
      `:17`. The differentiator that survives is checkability, not absence: the
      object moves from "no daemon" to "no *unsupervised* daemon".
      verify: `grep -c 'zero runtime daemon' README.md` returns 0.
- [ ] **3.2 Replace the positioning story rather than leaving a hole.**
      `docs/positioning-evidence.md:56`–`:74` records "zero runtime" as the
      load-bearing differentiator and argues explicitly that it is only credible
      *because* it is machine-checked. Rewriting it to the supervised-runtime
      story keeps that argument and changes its object.
      verify: `grep -c "zero runtime" docs/positioning-evidence.md` returns 0.
- [ ] **3.3 Retire the published comparison row.** `docs/comparison.yaml:31`
      publishes "No resident runtime — no background daemon, no state database or
      service" as `checkable: true`, and its `failure_mode` describes a daemon as
      the competitor's defect. This is the one surface where leaving the old text
      is not merely stale but a claim the repo will actively violate. Gated on
      the blocker below.
      verify: `grep -c "No resident runtime" docs/comparison.yaml` returns 0.
- [ ] **3.4 Correct the stale figures found while in the file.** The same
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
      output is a typed evidence artefact, not prose in this file.
      verify: `agents/evidence/analysis/no-runtime-surface-census.md` exists, opens with an `evidence-type: analysis` marker, and its bucket counts sum to the census total printed in its own header.
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
- [ ] **5.2 Prove the supervision property, not just the process.** A daemon
      whose termination, restart and crash behaviour is unobserved is exactly the
      "unsupervised" case Phase 3.1 promised the README does not ship. The
      collector lands with a kill-and-restart probe before it lands as a default.
      verify: a test asserts the collector's state survives SIGKILL and that a second instance refuses to start.
- [ ] **5.3 Re-measure the capture rate and publish the delta.** The point of
      the daemon is the number. A collector that ships without moving 0.27 % has
      not paid the debt it was justified by.
      verify: the recorded capture rate is measured after the collector runs and written into the claim ledger with its own marker.

## Blockers

### blocker: published-comparison-row-retirement

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 3 step 3.3 only. Every other step lands regardless; 3.1 and
  3.2 are internal-facing prose and the owner's decision already covers them.
- **What to do:** pick exactly one — (a) delete the row, accepting that the
  published comparison loses a differentiator and gains nothing in the same
  release; (b) rewrite it as a supervision claim ("no unsupervised resident
  process; lifecycle, termination and restart are machine-checked"), which keeps
  a row but makes it a claim the repo must then actually prove with Phase 5.2;
  or (c) keep the row and scope it to the *consumer install* rather than the
  maintainer tree, which is defensible only if the daemon genuinely never ships
  to consumers.
- **Resolved when:** the choice is recorded in the Phase 1 ADR, and for (b) the
  proving test named in 5.2 exists before the row is published.
- **Recommendation:** (b). The positioning file's own argument is that the
  differentiator is checkability rather than absence, so a checkable supervision
  claim keeps the argument intact where (a) concedes it. (c) is a trap: the
  telemetry collector in 5.1 exists to measure consumer dispatches, so scoping
  the claim to consumers is a promise the first daemon breaks.
- **If you do nothing:** the repo publishes a `checkable: true` comparison row
  asserting it has no resident runtime while shipping one. That is a false
  public claim, which is the one failure class this repository's whole claim
  ledger exists to prevent — so "nothing" is not a neutral outcome here.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-27 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The repeal names one document and misses the other | implementation | ADR-124 § 4 and ADR-109's identity floor are independent accepted floors. Superseding only the one the source analysis named leaves a live prohibition, and the change reads as complete. | 1.1 and 1.2 are separate steps with separate greps, and 4.2's census is the backstop that finds a third floor if one exists. | Phase 1 — Bind the decision against the right documents |
| 2 | A safety floor is relaxed as collateral | implementation | "Runtime is allowed" is one grep away from "persistence is allowed", which reopens ADR-094 agent-memory, and one more from relaxing spawn hardening. | 1.3 makes the non-reopenings a required ADR section, and the census in 4.2 classifies by what the artefact refuses, so an agent-memory prohibition is never in the active-blocker bucket. | Phase 1 — Bind the decision against the right documents |
| 3 | A published claim goes false before its replacement is provable | product | 3.3 retires a `checkable: true` row; 5.2 builds the evidence for its replacement. Landed in that order, the repo briefly publishes a supervision claim it cannot prove. | The blocker gates 3.3 on the ADR decision, and option (b) explicitly requires 5.2's test to exist before the row is published. | Phase 3 — Public positioning, including the comparison row that argues the other way |
| 4 | The 129-file census becomes the roadmap | implementation | A semantic sweep over 129 files with three-way classification is larger than the five hand-verified artefacts it supports, and can absorb the whole effort. | The census is Phase 4, after the public surfaces, and its output is a typed evidence artefact with counted buckets rather than an open-ended edit list. | Phase 4 — Contract replacement and the census over everything else |
| 5 | The first daemon ships without the number that justified it | product | 5.1 is buildable and satisfying; 5.3 is the part that pays the debt. A collector that runs and never re-measures 0.27 % converts a measurement debt into a maintenance cost. | 5.3 is a separate step whose verify is the recorded rate in the claim ledger, so the phase cannot close on a running process alone. | Phase 5 — The first supervised daemon pays the oldest measurement debt |

## Acceptance Criteria

- [ ] AC-1 — `grep -rniI 'zero.runtime|no runtime daemon' README.md docs/positioning-evidence.md docs/comparison.yaml` returns zero matches, and each of those three files instead states the supervised-runtime position.
- [ ] AC-2 — No accepted ADR in `docs/decisions/` prohibits a resident process in core without naming the superseding record: `ADR-124:111` and `ADR-109:28` both resolve to the Phase 1 ADR.
- [ ] AC-3 — `docs/contracts/no-runtime-boundary.md` is no longer a live authority, its successor contract classifies resident processes by lifecycle and supervision, and `check_references` exits 0.
- [ ] AC-4 — The claim `no-runtime-daemon` is present in the ledger with a superseded status and a named successor; `check_claims` and `build_proof` are both green in the same commit.
- [ ] AC-5 — `agents/evidence/analysis/no-runtime-surface-census.md` classifies every one of the census hits into historical, incidental or active-blocker, and the active-blocker bucket is empty at close.
- [ ] AC-6 — One supervised process runs, survives a kill-and-restart probe, and the dispatch-capture rate has been re-measured and written to the ledger — the figure moved, or the roadmap records why it did not.
