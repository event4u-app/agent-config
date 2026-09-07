<!-- evidence-type: analysis -->
# Council decision — may an autonomous lane spend a pre-registered observation slot?

**Round 1** · 2026-09-07 · anthropic/claude-sonnet-4-5, openai/codex-default · CLI subscription transport · quorum 2/2 concluded · billable 0 · $0.0000

Asked while closing `road-to-bounded-reference-harvest-loop` under the
maintainer's standing delegation of 2026-09-06/07. The roadmap's Phases 1-4 were
built and verified; its step 5.2 asks for one real end-to-end reference analysis,
and step 5.3 for the outcome to be written into the pre-registered claim
`reference-loop-upgrade-value` (`docs/CLAIMS.md`).

## Verdict — SPLIT, and what was landed

| Seat | Recommendation |
|---|---|
| A | **Defer** (option 2) — spending an irreversible observation slot before its value is clear violates pre-registration's purpose |
| B | **Conditionally execute** (option 1) — the council may authorize exactly one slot, but only after a frozen readiness protocol passes |

**Landed: the intersection neither seat calls unauthorized — do the readiness
work, defer the measured run.** A split is an escalation condition rather than a
verdict, and the authorizing seat states the deferral path itself ("if any
prerequisite fails, stop without running the measured analysis and defer"), so
deferral sits inside both seats' authorized sets while execute-now sits inside
only one. Same method as the run-19 `rdp-contract-beta-window` disposition.

## Unanimous, and therefore binding

1. **Step 5.3's premise is factually false.** Phase 3 resolved the
   raw-named-evidence trust boundary. The **outbound third-party fetch boundary
   is untouched** by Phases 3-4 — a fetch is still a fetch.
2. **The parked stub may not be disposed of** on the ground that Phases 3-4
   resolved its two boundaries, because one survives. When it is eventually
   disposed of, the record must attribute the fetch boundary's resolution to a
   **run-specific authorization**, never structurally to Phases 3-4.
3. **The claim row keeps `status: unbacked` and an empty `last_verified`** until
   a valid observation completes. A date on a partial observation reads as
   verification, and writing one would be the goalpost-moving the claim's own
   terms forbid.
4. **An upgraded-only run (option 3) is not an acceptable substitute** — it
   cannot answer the pre-registered comparison and must not consume a slot.
5. **Both arms are one atomic observation.** Neither alone consumes a slot; an
   invalid or incomplete run consumes none and is recorded outside the claim.
6. **One passing run cannot back the claim** — the bar reads "EACH of the next
   two", so a first pass leaves the row unbacked.
7. **The reopening trigger is observation-based, not calendar-based.** Seat A
   proposed "30 days remain in the 180-day window" as a fallback; both seats
   agreed a calendar trigger conflicts with the observation-based requirement,
   so it is recorded and **not** adopted.

## Readiness work discharged in the same change

The shadow arm is frozen and reproducible, which both seats made a prerequisite:

| Field | Value |
|---|---|
| Shadow base commit | `537e7c86e7646d50bf10d8b3e7ec8655239bceab` |
| Shadow blob id | `b2ea4fa61d4c8fa1ec737cad95699bd5d8be4a7f` |
| Shadow content sha256 | `6ea179291c79a96108d17faea27ecbbffed2f9a74d0d07236157d05bc68134ba` |
| Shadow size | 361 lines · 15466 bytes |

The 361-line figure independently corroborates the pin: the roadmap cited "361
lines" for the pre-upgrade command against a tree it verified at `93d63073e`.

## Facts established by reproduction before the question was put

- **Network is available** — a public API probe returned HTTP 200, so this was
  never a capability question.
- **The shadow arm requires reconstructing deleted text**, because Phases 1-3
  rewrote the command the claim's falsification criterion names.
- **Window cost is asymmetric** — expiry counts as the bar not cleared and
  reverts three mechanisms, so a low-fidelity run is worse than no run, since it
  cannot be withdrawn from a pre-registered measurement.

## Receiver

`agents/roadmaps/road-to-first-reference-analysis-observation.md` owns the run,
carries the frozen protocol and holds the observation-based trigger.

## Operational note, recorded because it cost two attempts

The council CLI produced **no responses and exited 0** when invoked as a
background command — quorum printed, `$0.0000`, no artefact, no error. The same
invocation in the foreground succeeded at once (quorum 2/2, artefact written,
quota 0→1 per seat). The discriminator was **backgrounding**, not the worktree,
which is worth separating from the recorded "a fresh worktree cannot run the
council" note: this worktree ran it fine.
