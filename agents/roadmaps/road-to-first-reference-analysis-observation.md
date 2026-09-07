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

The 361-line figure independently corroborates the pin: the parent roadmap cited
"361 lines" for the pre-upgrade command when it was authored, against a tree it
verified at `93d63073e`.

## Phase 1 — Readiness, then the atomic pair

- [ ] **1.1 Pin the reference.** Name one small public repository and one
      commit, and record both. Small is a real criterion, not a preference: the
      upgraded arm's `--deep` tier and the shadow arm's 40-fetch ceiling must
      both complete without an extension request, or the arms are not comparable.
      verify: the reference and its commit are recorded in this roadmap, and a
      read-only fetch of that commit succeeds.
- [ ] **1.2 Freeze the counting rules before either arm is inspected.** What
      counts as an interop-probe finding at `file:line` precision, what counts
      as a bound-claim routing, and how a `consumer not locatable` probe is
      scored — the claim already fixes the last one as an honest result but not
      a positive.
      verify: the rules are written here and dated before the first arm runs;
      no rule is edited after either arm's output is read.
- [ ] **1.3 Harness-only validation.** Confirm invocation, capture and evidence
      isolation for both arms **without performing or inspecting the measured
      analysis** — the shadow command must be executable without adapting its
      substantive analysis instructions.
      verify: both arms produce an artefact directory under
      `agents/.harvest-local/` and `git status --porcelain` shows nothing new
      tracked; neither arm's analysis content has been read.
- [ ] **1.4 Run both arms as one observation.** Upgraded and shadow, identical
      reference snapshot and identical inputs.
      verify: two artefact sets exist under the gitignored area, the upgraded
      arm's iteration record shows three named-lens delta blocks and one
      repeated revision, and neither arm was abandoned part-way.
- [ ] **1.5 Write the outcome into `docs/CLAIMS.md`.** Pass → keep
      `status: unbacked`, record "observation 1/2 passed" with opaque
      provenance, leave `last_verified` empty. Fail → record the pre-registered
      null, set `last_verified` to the run date, and initiate the bound
      reversions of the interop-probe, convergence and `--deep` mechanisms.
      Invalid → leave the row unchanged and record the protocol failure outside
      the claim.
      verify: the claim row's state matches the branch of this step that
      actually fired, and `./scripts-run src/scripts/build_proof` is re-run.
- [ ] **1.6 Dispose of the parked stub.** Archive
      `agents/roadmaps/stubs/road-to-first-reference-analysis-run.md` and record
      that the fetch boundary was resolved by a **run-specific council
      authorization**, never structurally by Phases 3-4.
      verify: the stub is archived, the archive index is regenerated, and the
      disposal note names the run-specific authorization.

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
- [ ] AC-2 — The claim row at `docs/CLAIMS.md` states an outcome that matches
      what the run produced, with no rule edited after the data.
- [ ] AC-3 — The parked stub is disposed of, and its disposal note attributes
      the fetch boundary's resolution to a run-specific authorization rather
      than to Phases 3-4.
