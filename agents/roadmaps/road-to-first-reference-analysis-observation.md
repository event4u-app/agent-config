---
complexity: lightweight
status: draft
parent_roadmap: road-to-bounded-reference-harvest-loop
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Receiver for two steps carried out of road-to-bounded-reference-harvest-loop, which is archived in the same change — the active count is unchanged by the pair."
---
# Road to the first reference-analysis observation

> **Source:** carried out of
> [`road-to-bounded-reference-harvest-loop`](road-to-bounded-reference-harvest-loop.md)
> steps 5.2 and 5.3 on 2026-09-07, by AI-council decision on a split verdict.
> Council record: `agents/evidence/council/bounded-harvest-observation-slot.md`
> (2 seats, anthropic + openai, subscription transport, $0.0000).

## Goal

Spend exactly one of the two remaining observation slots of the pre-registered
claim `reference-loop-upgrade-value` (`docs/CLAIMS.md:487`) on a valid,
atomic upgraded-plus-shadow analysis pair, and write the outcome into the claim
row honestly. Done when: both arms have run against one pinned reference at one
pinned revision under the frozen protocol below, and the claim row records
either "observation 1/2 passed" or the pre-registered null with its bound
reversions — with no goalpost moved after the data.

## Why this is carried rather than done

The parent roadmap built the scaffolding (Phases 1-4: one analysis engine, a
bounded three-lens loop, opaque local-only artefacts, deterministic discovery
and a harvester). It did **not** clear the trust boundary the run needs.

The council was asked whether an autonomous lane may execute the run now, and
**split**: one seat recommended deferral, one authorized exactly one slot
subject to a readiness protocol. A split is an escalation condition, not a
verdict, so the disposition adopted is the intersection neither seat calls
unauthorized — **do the readiness work, defer the measured run**. The seat that
authorized execution states the deferral path itself ("if any prerequisite
fails, stop without running the measured analysis and defer"), so deferral sits
inside both seats' authorized sets while execute-now sits inside only one.

Unanimous across both seats, and therefore binding here:

1. The parent's step 5.3 premise is **false as written**. Phase 3 resolved the
   raw-named-evidence trust boundary; the **outbound third-party fetch boundary
   is untouched** by Phases 3 and 4. A fetch is still a fetch.
2. `agents/roadmaps/stubs/road-to-first-reference-analysis-run.md` may **not**
   be disposed of on the ground that Phases 3-4 resolved its two boundaries,
   because one survives. It stays, cross-referenced to this roadmap.
3. Until a valid run completes, the claim row keeps `status: unbacked` and an
   **empty** `last_verified`. Dating a partial observation would read as
   verification.
4. An upgraded-only run is **not** an acceptable substitute — it cannot answer
   the pre-registered comparison and must not consume a slot.
5. Both arms are **one atomic observation**. Neither arm alone consumes a slot;
   an invalid or incomplete run consumes none and is recorded outside the claim.

## Exactly what is carried here

Seven checkboxes from the parent, and nothing else. Each is carried because its
own `verify:` names an **observation of a run**, not a state of the tree — the
contract text every one of them describes is written, shipped and pinned by
`tests/scripts/analyze_repo_limits.test.ts`.

| Parent item | What is already done there | What this roadmap owes |
|---|---|---|
| step 2.2 | § 2a pins the revision once; `--deep` defaults under the loop; the read-ceiling line is required | a run's iteration record showing one revision repeated on every pass |
| step 2.3 | § 5b's three lenses, the per-loop delta block, the never-omit-a-zero rule | a run with three loops writing three delta blocks |
| step 5.2 | the readiness protocol below | the atomic upgraded-plus-shadow pair |
| step 5.3 | the boundary finding, recorded | the claim-row write and the stub disposal |
| AC-3 | contract + skeleton + never-omit rule | what a run leaves behind |
| AC-4 | `check_no_external_sources` green; the filename rule mechanically enforced | the `git status --porcelain` check after a full run |
| AC-8 | — (deliberately unwritten, see point 3 above) | the claim row and the stub |

Steps 1.4 (the pair), 1.3 (the `git status` check) and 1.5-1.6 (the claim row
and the stub) are where each lands.

## Frozen protocol — established 2026-09-07, before any arm runs

The shadow arm is pinned and reproducible. Recorded here so that a later run
cannot silently substitute a different text:

| Field | Value |
|---|---|
| Shadow base commit | `537e7c86e7646d50bf10d8b3e7ec8655239bceab` |
| Shadow blob id | `b2ea4fa61d4c8fa1ec737cad95699bd5d8be4a7f` |
| Shadow content sha256 | `6ea179291c79a96108d17faea27ecbbffed2f9a74d0d07236157d05bc68134ba` |
| Shadow size | 361 lines · 15466 bytes |
| Shadow path at that commit | `src/domains/analysis-workbench/analyze/reference-repo/command.md` <!-- ref-ignore --> (the pre-rename path; it exists at that commit and deliberately not at HEAD) |

Recover it with:

```bash
git show 537e7c86e7646d50bf10d8b3e7ec8655239bceab:src/domains/analysis-workbench/analyze/reference-repo/command.md
```

**Pin verified 2026-09-07, offline.** All four fields reproduce in a checkout of
this branch, so reopening-trigger condition 1 below is satisfied and needs no
network: `git rev-parse` on that path at that commit returns blob
`b2ea4fa61d4c8fa1ec737cad95699bd5d8be4a7f`, and the extracted text measures 361
lines / 15466 bytes with sha256
`6ea179291c79a96108d17faea27ecbbffed2f9a74d0d07236157d05bc68134ba`. Condition 1
is therefore the only one of the three that is currently observable; 2 and 3
both require the outbound fetch.

The 361-line figure independently corroborates the pin: the parent roadmap cited
"361 lines" for the pre-upgrade command when it was authored, against a tree it
verified at `93d63073e`.

## Frozen counting rules — established 2026-09-07, before either arm runs

Written while **no arm has been invoked and no arm output exists**, so nothing
here was tuned to data. They resolve the three scoring questions step 1.2 names,
and one defect found while resolving them. The bar itself is untouched: it stays
verbatim as `docs/CLAIMS.md:488` states it, and these rules only decide how an
arm's output is read against that bar.

### R1 — an interop-probe finding at `file:line` precision

Counts as **one positive** only when a single row of the § 3b table
(`src/domains/analysis-workbench/analyze/repo/command.md:220`) carries all four
of:

1. a named consumable artifact on the reference side (index, graph, manifest,
   lockfile, generated config) — not a capability described in prose;
2. **our** consumer named as `path:line`, in this repository, resolving at the
   analysis commit. `src/scripts/foo.ts` without a line is not `file:line`;
   "our validator" is explicitly ruled out at `:216`;
3. a `discovered?` and a `validates?` verdict, both filled;
4. either the exact failing axes, or the probe's own error text if it crashed —
   `:222` makes "incompatible" without the axes a non-finding and a crash a
   result rather than an empty row.

A row missing any of the four is scored **zero**, not partial. Two rows about
the same artifact and the same consumer are one positive; the bar counts
findings, not table lines.

### R2 — a bound-claim routing

Counts as **one positive** when an ADOPT/ADAPT row (a) extracts a concrete
surface identifier — file path, config key, schema field, settings key — (b)
cites the id of a `docs/CLAIMS.md` entry it collides with, and (c) states one of
the two dispositions the § 5 bound-claim gate allows at `:260-262`: it routes through that
claim's own reopen or amendment clause and says so, or it is reclassified
REJECT. A row that cites a claim id and states neither disposition is zero.

**A shared topic word is not a collision** (`:262`). The match is on the
identifier, so a row mentioning "skills" does not collide with every claim whose
prose contains the word.

**Defect found while freezing this rule, and repaired in the same change.** The
gate used to say: match the identifier against "the `consequence` field of every
`docs/CLAIMS.md` entry". **The ledger has no `consequence` field.** Its entry
schema is fixed at `docs/CLAIMS.md:56-66` — `claim`, `kind`, `evidence`,
`status`, `last_verified`, `retired_by`, `superseded_by`, `non_inference`,
`retires_phrasings` — and `grep -c '^- consequence:' docs/CLAIMS.md` returned 0.
Followed literally, a bound-claim routing could never be produced and the bar at
`docs/CLAIMS.md:488` would fail for a reason having nothing to do with the
mechanism's value: a probe looking for a field that does not exist finds nothing
and reports no collision, on every row, forever.

The repair names the fields that do exist — `claim` and `non_inference`, which
is where surface identifiers actually appear in this ledger — at
`src/domains/analysis-workbench/analyze/repo/command.md:255-260`.

**Why repairing it now is not goalpost-moving, stated because the objection is
fair.** The upgraded arm is HEAD's command text, so editing that text does move
the artifact under measurement. There is exactly one window in which that is
safe and this is it: **no arm has run**, so no data exists for the edit to have
been fitted to, and the pre-registered bar at `docs/CLAIMS.md:488` is untouched
— still `>= 1` interop-probe finding and `>= 1` bound-claim routing on each of
two analyses. The unsafe windows are between the two arms and after either arm's
output is read; both stay forbidden. If the ordering is ever disputed, the
commit that carries this repair carries the roadmap edit that records it, and
neither predates the other.

### R3 — `consumer not locatable`

Scored as an **honest result and not a positive**, which is the claim's own
falsification criterion 2 at `docs/CLAIMS.md:490` and is restated here only so a
later reader does not have to re-derive it. A probe that records it is not a
skip and must appear in the table (`:217-218`); it simply contributes zero to
the bar. An arm whose every probe records `consumer not locatable` has produced
a valid run and zero interop-probe findings — which fails the bar rather than
invalidating the observation.

### What these rules deliberately do not do

They fix no threshold, because the claim already fixes it: `>= 1` of each, on
**both** analyses. They say nothing about the shadow arm's scoring — the shadow
command has no interop probe and no bound-claim gate, so its count is zero by
construction and the comparison is a document diff (criterion 1 at `:490`), not
two scores. And they are frozen: an edit to any of R1-R3 after either arm's
output is read voids the observation under step 1.2's own verify.

### What this freezing produced besides the rules

- **One defect in shipped command text, found and fixed:** the bound-claim gate
  pointed at a `consequence` field the claims ledger has never had. See R2 for
  the repair and for why the pre-arm window is the only safe one to land it in.
  Sibling search, per the defect-pattern discipline, with the count reported
  rather than implied: `grep -rn consequence src/domains/ src/skills/` returns
  **37 lines across 24 files** at this commit, and **0** of them instruct a
  match against a named `docs/CLAIMS.md` field — the two `src/domains/` hits are
  `analyze/roadmap-repos/command.md:103` ("accepted consequence") and
  `FIRST_WIN.md:39` (a memory-record field list), and the rest are ordinary
  prose. One instance, not a population.

## Phase 1 — Readiness, then the atomic pair

- [ ] **1.1 Pin the reference.** Name one small public repository and one
      commit, and record both. Small is a real criterion, not a preference: the
      upgraded arm's `--deep` tier and the shadow arm's 40-fetch ceiling must
      both complete without an extension request, or the arms are not comparable.
      verify: the reference and its commit are recorded in this roadmap, and a
      read-only fetch of that commit succeeds.
      BLOCKED 2026-09-07 — the verify requires an outbound third-party fetch,
      which is the boundary this roadmap's own § Why this is carried, point 1,
      records as untouched by the parent's Phases 3 and 4: "A fetch is still a
      fetch." Step 1.6 names what would clear it — a **run-specific council
      authorization** — and no such authorization exists. An autonomous lane
      cannot grant itself one. Closes when that authorization is recorded.
- [x] **1.2 Freeze the counting rules before either arm is inspected.** What
      counts as an interop-probe finding at `file:line` precision, what counts
      as a bound-claim routing, and how a `consumer not locatable` probe is
      scored — the claim already fixes the last one as an honest result but not
      a positive.
      verify: the rules are written here and dated before the first arm runs;
      no rule is edited after either arm's output is read.
      Done 2026-09-07 — the three rules are frozen in
      § Frozen counting rules below, written **before either arm has run**:
      no artefact directory exists under `agents/.harvest-local/` for this
      observation, step 1.1 has not pinned a reference, and step 1.4 is
      unstarted. This is the readiness half of the disposition both council
      seats authorize, and it moves no goalpost: the bar itself stays exactly
      as `docs/CLAIMS.md:488` states it.
- [ ] **1.3 Harness-only validation.** Confirm invocation, capture and evidence
      isolation for both arms **without performing or inspecting the measured
      analysis** — the shadow command must be executable without adapting its
      substantive analysis instructions.
      verify: both arms produce an artefact directory under
      `agents/.harvest-local/` and `git status --porcelain` shows nothing new
      tracked; neither arm's analysis content has been read.
      BLOCKED 2026-09-07 — same boundary as 1.1. Both arms are analyses of a
      third-party reference; invoking either harness end-to-end performs the
      fetch. The half that needs no network **was** run and is recorded in
      § Frozen protocol: the shadow pin reproduces on all four of its fields.
      Closes with 1.1.
- [ ] **1.4 Run both arms as one observation.** Upgraded and shadow, identical
      reference snapshot and identical inputs.
      verify: two artefact sets exist under the gitignored area, the upgraded
      arm's iteration record shows three named-lens delta blocks and one
      repeated revision, and neither arm was abandoned part-way.
      BLOCKED 2026-09-07 — depends on 1.1 and 1.3, and consumes one of only two
      pre-registered observation slots. Risk 1 below is the reason not to force
      it: an invalid pair cannot be withdrawn from a pre-registered measurement.
      Closes when 1.1 and 1.3 close.
- [ ] **1.5 Write the outcome into `docs/CLAIMS.md`.** Pass → keep
      `status: unbacked`, record "observation 1/2 passed" with opaque
      provenance, leave `last_verified` empty. Fail → record the pre-registered
      null, set `last_verified` to the run date, and initiate the bound
      reversions of the interop-probe, convergence and `--deep` mechanisms.
      Invalid → leave the row unchanged and record the protocol failure outside
      the claim.
      verify: the claim row's state matches the branch of this step that
      actually fired, and `./scripts-run src/scripts/build_proof` is re-run.
      BLOCKED 2026-09-07 — no branch has fired, because 1.4 has not run. Point 3
      of § Why this is carried is binding and is honoured by leaving this
      untouched: the row keeps `status: unbacked` and an EMPTY `last_verified`
      (`docs/CLAIMS.md:491-492`), because dating a partial observation would read as
      verification. Closes with 1.4.
- [ ] **1.6 Dispose of the parked stub.** Archive
      `agents/roadmaps/stubs/road-to-first-reference-analysis-run.md` and record
      that the fetch boundary was resolved by a **run-specific council
      authorization**, never structurally by Phases 3-4.
      verify: the stub is archived, the archive index is regenerated, and the
      disposal note names the run-specific authorization.
      BLOCKED 2026-09-07 — the disposal note must name a run-specific
      authorization that does not exist, and point 2 of § Why this is carried
      forbids disposing of the stub on the ground that Phases 3-4 resolved its
      boundaries, because one survives. Archiving it now would be exactly the
      forbidden disposal wearing a different reason. Closes with 1.1.

## Reopening trigger — observation-based, not calendar-based

This roadmap is `status: draft` and is worked when **all** of the following are
observable, per the authorizing seat:

1. The shadow SHA and content hash above still resolve and reproduce.
2. A specific reference commit satisfies the small-public-reference criterion of
   step 1.1.
3. The harness-only validation of step 1.3 confirms equivalent inputs and
   isolated capture for both arms.

The deferring seat added a fourth condition and it is recorded rather than
adopted: it proposed "30 days remain in the 180-day window" as a fallback. Both
seats agreed a calendar trigger conflicts with the observation-based
requirement, so it is **not** a trigger here. The window is a fact about the
claim, stated in `docs/CLAIMS.md`, and it is the maintainer's to act on.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-07 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A slot is spent on an invalid pair | product | A flawed shadow reconstruction or non-identical inputs produce a false data point that cannot be withdrawn from a pre-registered measurement, forcing a null and its bound reversions | Steps 1.1-1.3 are prerequisites, and an invalid run consumes no slot by the council's unanimous rule | Phase 1 — Readiness, then the atomic pair |
| 2 | The window expires unspent | product | The 180-day bound treats expiry as the bar not cleared, reverting three mechanisms | The protocol is frozen now, so the remaining work is execution rather than preparation | Phase 1 — Readiness, then the atomic pair |
| 3 | The shadow text drifts | implementation | A later run substitutes a different pre-upgrade text and the comparison silently answers a different question | The commit, blob id and content hash are pinned above and are checkable in one command | Phase 1 — Readiness, then the atomic pair |

## Acceptance Criteria

- [ ] AC-1 — One atomic upgraded-plus-shadow pair has run against one pinned
      reference at one pinned revision, or the roadmap records why it did not.
      OPEN 2026-09-07, second limb partially discharged: no pair has run, and
      the reason is recorded under 1.1 and 1.3 — the outbound third-party fetch
      boundary is untouched and needs a run-specific council authorization that
      does not exist. Left unticked rather than ticked on the "or" limb, because
      the tick would read as the observation being settled when the slot is
      still unspent.
- [ ] AC-2 — The claim row at `docs/CLAIMS.md` states an outcome that matches
      what the run produced, with no rule edited after the data.
      OPEN 2026-09-07. The run produced nothing, so the matching state is the
      untouched row — `status: unbacked`, `last_verified` empty
      (`docs/CLAIMS.md:491-492`), which is what point 3 of § Why this is carried
      requires. The second limb is now checkable rather than aspirational: the
      counting rules were frozen and dated before any arm ran, so a later edit
      to them is detectable.
- [ ] AC-3 — The parked stub is disposed of, and its disposal note attributes
      the fetch boundary's resolution to a run-specific authorization rather
      than to Phases 3-4.
      OPEN 2026-09-07 — see 1.6. The stub stays, which is the outcome point 2 of
      § Why this is carried mandates while the fetch boundary survives.
