---
complexity: lightweight
execution:
  mode: phase-checkpoints
---

# Road to context fidelity

> Rule survival across a compaction boundary and memory staleness become enforced system behaviour instead of user hygiene folklore.

## Goal

Raise the measured post-compaction obligation-compliance rate for trigger-loaded rules above its pre-registered baseline, and replace manual memory deletion with a verification-stamped eviction ladder — each behind a falsification spike that can close the phase instead of building it.

## Outcome

> **Closed 2026-08-20 by an autonomous drain run. Archived does not mean achieved.**
> This roadmap set out to fix two things and fixed one of them. The memory half
> shipped and is measurable in the tree; the compaction half was never measured and
> left the roadmap intact, in a stub, still unmeasured. **The dashboard reports this
> file at 100 % — 12 done, 12 cancelled, 0 open, 0 blockers — and that number is the
> reason this section exists.** `[-]` counts as resolved there, so a transfer and an
> abandonment are indistinguishable from a delivery on the progress surface. Read the
> table below instead of the percentage. (The dashboard also excludes Prerequisites
> and Acceptance Criteria from its denominator, so the one deliberately-open
> prerequisite and the two unmet acceptance criteria do not appear in it at all.)

Per phase, with the outcome state the disposition framework requires
([`drain-blocker-dispositions-a.md`](../evidence/council/drain-blocker-dispositions-a.md)):

| Phase | Outcome state | What actually happened |
|---|---|---|
| **Prerequisites** | `satisfied` (3 of 4) + one recurring | Three reads done. Prerequisite 4 is a per-phase recurring trigger and stays `[ ]` permanently by design; its third re-verification ran at `239d3bf1c` before this run touched anything. |
| **Phase 0 — falsification spikes** | `transferred` (cf01) + `satisfied` (cf02, cf03, pre-registration) | Three of four steps closed with real numbers. cf01 moved out: it needs a live host session, a manual compaction, and a capture directory that does not exist. Exit criterion recorded **unmet**. |
| **Phase 1 — compaction-boundary reinjection** | `transferred` (all six steps) | Nothing built, nothing rejected on merit, no ADR written. The whole phase moved to the stub because its build-or-close decision reads a number cf01 was to produce. Its honest-null kill criterion travelled with it unspent. |
| **Phase 2 — memory eviction** | `satisfied`, with one claim `narrowed` | The half that worked. Stamps, consolidation pass, eviction ladder, budget cap, contradiction precedence and ADR-234 all shipped; 22 entries actually moved through demotion (107 → 85 curated), and `check_memory` went from 0 staleness findings to 13 on an otherwise unchanged store. The sweep's ranking claim was built, measured at 0.00x lift and **withdrawn** — a published null inside a satisfied phase. |
| **Phase 3 — skill-top position lint** | `narrowed` | Step withdrawn on 2026-08-17 (the gate already existed; a duplicate was built and reverted). Residual corpus question decided 2026-08-20 as `leave-unscanned`: `src/skills` is explicitly outside `check_iron_law_prominence`'s coverage, recorded both in the step and on the gate's own `gate-coverage.yml` entry. The original exit criterion is **withdrawn**, not met — it presupposed the extension that was declined. |
| **Phase 4 — worker context management** | `abandoned` (step 1) + `satisfied`-as-null (step 2) | Executed, not transferred — attempting it is what showed it is not repository work. Step 1 abandoned: the repo constructs no worker request body (workers come from the host's `Agent`/`Task` primitive), the provider surface it *can* reach is tool-less single-shot where the parameter is inert, and no producer is nameable. Step 2 closed on an existing published honest null. **No capability shipped from this phase.** |

**Blockers.** Two of the three entries were open and are now resolved —
`compaction-census-session` as **B / transferred**, `prominence-gate-skills-corpus`
as **D / narrowed** (`leave-unscanned`). The third, `memory-sweep-instrument`, was
already resolved before this run and appears in no 2026-08-20 council batch; it was
re-checked against the tree and confirmed, deliberately **not** re-dispositioned.

**What a reader should not conclude.** That post-compaction rule loss is disproven —
it is unmeasured, and the pre-registered 90 % honest-null threshold still carries no
baseline. That Phase 1's design was wrong — it was never evaluated. That worker
context management is worthless — its measurement is `resolved-null`, meaning
unmeasurable on this corpus, never disproven. That the skills tree is
prominence-clean — 13 findings exist and nobody is looking at them, on purpose, with
the reason written down.

**One residue worth naming, because it is this roadmap's own defect recurring.**
All 85 curated entries still carry the uniform `last_validated: 2026-07-09`. Phase 2
repaired the *window* (per-store 30/90/90) and added the *anchor*
(`verified_at_commit`), which is what made the instrument able to fire at all — but
no entry has yet had its stamp refreshed by a real verification. That is Risk 7's
treadmill in its first observable form: a follow-on for the store's owner, not a new
defect, and not something this run may claim it closed.

## Prerequisites

- [x] Read `src/rules/context-hygiene.md` and `src/scripts/hot_context_hook.ts`
- [x] Read `src/scripts/hook_manifest.yaml` § `session_start` and § `pre_compact`
- [x] Read `src/scripts/learning_sidecar.ts` — the decay mechanics that already exist for intake
- [ ] Re-verify the Context table against branch HEAD before executing a phase — **RECURRING, one flip per phase, deliberately left open.** Done for this run at `9beeb0662` (see the Context table). It was briefly marked `[x]`; R2 finding 7 caught that, because this is a per-phase obligation and it is Acceptance Criterion 5's only tracked trigger. Spending the checkbox once would have let Phases 1, 2 and 4 run against a table this roadmap has already watched go stale twice — 373 commits, then 110, with one row wrong on half its claim the second time. **Third re-verification done 2026-08-20 at `239d3bf1c`** before the drain run touched anything; two rows turned out to be overtaken by this roadmap's own Phase 2 (see the Context table). **The box stays `[ ]` on purpose and will never be `[x]`:** it is a recurring per-phase trigger with no terminal state, so flipping it would assert a permanent discharge of an obligation that recurs. AC5 is marked met instead, because AC5 is scoped to phases that actually ran and every one of them was preceded by a re-verification.

## Context

Source: an external analysis session over this repository, 2026-08-13, pinned at `8a043ec`. That pin is 373 commits behind the branch base, so every claim was re-verified at `6d18f5bb2`. One load-bearing claim did not survive, and the plan below is adjusted for it rather than carried unchanged.

**Re-verified a second time at `9beeb0662` (2026-08-17), per Prerequisite 4.** The `6d18f5bb2` pin was 110 commits behind by then. Two rows carried line numbers that had moved and one row was wrong on half its claim; the table below records the current reading, and the corrections are the reason Phase 2's scope narrows again. Line numbers are restated rather than removed because the claim they support is a negative one — the absence of a concern in a chain — and a reader has to be able to open the chain to see the absence.

**Two observed failure modes.** Rules stop being followed as a session grows; after compaction the agent behaves as though trigger-loaded rules never existed. Separately, learned memory goes stale, and the working fix a second user reports is deleting it by hand — a human substitute for a missing eviction policy.

**Re-verified at `9beeb0662` (2026-08-17). Line numbers in the Evidence column are the ones that resolve at that commit; the `6d18f5bb2` readings are kept in the Status column only where they changed.**

**Re-verified a THIRD time at `239d3bf1c` (2026-08-20), per Prerequisite 4, before
this drain run touched anything.** The `9beeb0662` pin was behind by then. Result:
all four negative claims (rows 2, 3, 4) still hold and rows 1 and 2 carry line
numbers that have moved again — `pre_compact` is now `hook_manifest.yaml:921` (was
cited `:746`) and the seven `session_start` chains are at `:892,899,943,977,992,1011,1028`
(was `:717,724,768,802,817,836,853`); `hot_context_hook.ts:394` is unchanged.
`reinject` is still zero hits across `src/scripts/` and `src/rules/`, and
`context_management` is still zero hits across `src/`.

**Two rows are now overtaken by this roadmap's OWN Phase 2 work, and that is worth
stating rather than silently re-stamping.** Row 5's supporting evidence included
"zero `quarantine` hits in the memory scripts" — false since Phase 2 step 3 shipped
`memory_eviction.ts`, which is where the quarantine ladder now lives. Row 6 said
"the staleness instrument cannot fire"; it fires. At `239d3bf1c` the curated store
holds **85** entries (was 107 — 22 moved through demotion on the ladder's first
run), every one carries `verified_at_commit`, `review_after_days` is per store
(13 × 30, 72 × 90) rather than a uniform 365, and `check_memory` reports **13**
staleness findings where it reported 0. The uniform `last_validated: 2026-07-09`
bulk-stamp date is unchanged on all 85 — so the *window* was repaired and the
*stamp refresh* has not yet happened for real. That residue is Risk 7's treadmill
in its first observable form, and it is a Phase 2 follow-on, not a new defect.

**Nothing in this re-verification changes a scope decision for the phases this run
touched.** Rows 1–4 are the Phase 0/1 evidence and they are unchanged, so the
compaction half is transferred on the same footing it was blocked on. Rows 5–6 are
Phase 2 evidence and Phase 2 is closed.

| Claim as drafted | Status now | Evidence |
|---|---|---|
| `pre_compact` binds only the language pin | **overtaken** — it now binds `[language-mirror, hot-context]`, and the hot-context cache is written at the compaction boundary so the restore reflects the state immediately before it | `hook_manifest.yaml:746` (was cited as `:701`); the write set is `stop` / `session_end` / `pre_compact` at `hot_context_hook.ts:394` |
| The `session_start` chain contains no rule-index concern | still true — no `reinject`- or rule-index-shaped concern in any of the seven platform chains | `hook_manifest.yaml:717,724,768,802,817,836,853` (was cited as `:672,679,723`) |
| No `reinject` concern exists anywhere | still true — zero hits across `src/scripts/` and `src/rules/` | negative grep, 2026-08-17 |
| No API-level context management for spawned workers | still true — zero hits for `context_management` across `src/` | negative grep, 2026-08-17 |
| Learned memory carries no staleness enforcement | **wrong on the stamp half, and the correction narrows Phase 2 again.** `last_validated` and `review_after_days` are *required keys* on every curated entry, `check_memory` emits `stale:` findings plus a critical-stale SLA guard, and `memory_report` publishes a staleness rate. `learning_sidecar.ts` does implement half-life decay, a ≥2-origin promotion threshold, and a dead-end ledger — and it never mutates the curated store, which is a deliberate council condition, not an omission. What is genuinely missing is narrower: **the commit anchor in the stamp**, and **the quarantine→delete ladder** | `check_memory.ts:60-68` (REQUIRED_KEYS), `:378-397` (stale + critical-stale), `memory_report.ts`; zero `quarantine` hits in the memory scripts; `learning_sidecar.ts:20-23` |
| — *(new, found by this re-verification)* | **The staleness instrument cannot fire.** All 107 curated entries carry the *same* `last_validated: 2026-07-09` and the *same* `review_after_days: 365`. The 0.0 % staleness rate is therefore the arithmetic of one bulk stamping event, not the result of 107 verifications, and the earliest date on which any entry can read as stale is 2027-07-09 | `agents/memory/*.yml`, uniform across all three stores; `memory_report` → `staleness-rate=0.0% (0/107)` |

**Consequence for scope.** The working-memory half of the compaction problem has been hardened independently; the rule-index half has not. Phase 2 reuses the existing decay mechanics as its reference rather than inventing decay a second time, and narrows to what is genuinely missing: verification stamps and eviction on the curated store.

**Second consequence, from the 2026-08-17 re-verification.** The stamp exists and is required; the *anchor* does not. So Phase 2 step 1 narrows from "add a stamp" to "add the commit to the stamp and refresh it on a real check", and Phase 2 step 4 closes as already-shipped. More consequentially, Phase 2's own kill criterion reads a number the instrument cannot currently produce: a stale ratio below 10 % is supposed to shrink this phase to stamps only, and the measured ratio is 0.0 % — but that 0.0 % is a uniform bulk stamp with a 365-day window, so it measures stamping rather than truth. **The kill criterion is therefore not fired on it.** Firing it would be the already-satisfied-test failure this repository has recorded before: a gate that passes because it cannot fail.

**External evidence, mapped to the defects rather than added to them.** Degradation with growing input length is documented across frontier models and begins well before a window fills. Positional attention flips with fill level: the familiar start-and-end advantage holds only below roughly half-full, above which recency dominates — which makes per-turn injection at the end of context the structurally strongest carrier and the session-start block the weakest position in a long session. What survives a compaction on the primary host is contested: vendor-adjacent documentation and a field-reported issue disagree about whether disk-loaded instruction files are reliably re-injected, which is exactly why Phase 0 measures instead of picking a side. Two community hook patterns demonstrate the reinject shape as prior art, and their shared consensus is an index of at most twenty lines carrying pointers rather than payloads. On the memory side, field advice runs as far as disabling host auto-memory entirely because stale entries make an agent trust memory instead of looking things up, while the host's own idle-time consolidation performs prune, merge, and refresh — precedent that consolidation belongs in the system, not in the user's habits.

## Phase 0 — Falsification spikes

- [-] Run a compaction-survival census: in an instrumented session, place three probes before a manual compaction — a session-canary-bound obligation, a completion-gate reminder, and one trigger-loaded rule with a detectable obligation. Measure per probe whether it is still followed, present only as paraphrase, or gone. Repeat across at least five sessions and stamp the host version. **TRANSFERRED 2026-08-20 (disposition B, outcome `transferred`) to [`stubs/road-to-compaction-survival-census.md`](stubs/road-to-compaction-survival-census.md) — needs a live instrumented host session, a manual compaction, and a session-state capture directory that does not exist; all three probe arms measured failing today. Blocker `compaction-census-session` resolved as transferred.** <!-- verify: test -f agents/evidence/eval-findings/context-fidelity-cf01.md --> <!-- ref-ignore -->
- [x] Run a memory staleness census: walk the curated memory store and check each entry against the live tree, producing a table of still-true, stale, and unverifiable with age where datable. **Result: 107 entries walked — 73 still-true, 23 stale, 11 unverifiable = 21.5 % stale against the tree, while the shipped instrument reports 0.0 % against age.** <!-- verify: test -f agents/evidence/eval-findings/context-fidelity-cf02.md -->
- [x] Count compaction events per long session. **Source corrected 2026-08-17, and the correction is what made this step executable.** As drafted it read the session-start source field out of `agents/runtime/.agent-chat-history` and piggybacked on the first spike — but that file is gitignored runtime state present only where a session has actually run, so from any worktree it is absent and the count comes back zero, which is the opposite of the truth. `session_eol_report` already derives the same number from the host-global `compact_boundary` records, needs no instrumented session, and therefore decouples this step from the first spike entirely. <!-- verify: test -f agents/evidence/eval-findings/context-fidelity-cf03.md -->
- [x] Pre-register both measurements as claims with their honest-null thresholds: a baseline compliance at or above 90 % for all three probe classes closes Phase 1 unbuilt; a stale ratio below 10 % shrinks Phase 2 to stamps only. **Landed as `context-fidelity-compaction-compliance` (a genuine pre-registration — cf01 has not run) and `context-fidelity-memory-staleness` (the threshold predates the data, the ledger row does not, and the entry says so).** <!-- verify: ./scripts-run src/scripts/check_claims -->

**Exit criteria — NOT met, and the phase closes without meeting them (2026-08-20).** cf02 and cf03 exist with numbers and a host stamp, and both claims are registered — but `context-fidelity-compaction-compliance` carries **no baseline** and never will from a repository, because cf01 is transferred. Outcome state: `transferred` for the compaction census, `satisfied` for the memory census. This is the honest reading: three of four steps closed, the fourth moved out, and the exit criterion left unmet rather than reworded to fit what shipped.

**Status 2026-08-17 — 3 of 4 closed, and the phase does NOT exit.** cf02 and cf03
exist with numbers and a host stamp; both claims are registered. cf01 is the one
still open, and it is open on a human ACTION rather than on effort: it needs an
instrumented live session with a manual compaction, repeated across five
sessions. cf03 sharpened that blocker rather than clearing it — **zero manual
compactions exist in 473 recorded sessions**, so cf01's method measures a path no
observed session has taken and its result will need that caveat attached.
Consequently the `context-fidelity-compaction-compliance` claim carries no
baseline yet and Phase 1 stays correctly unstarted.

**Status 2026-08-20 — cf01 transferred, phase closed unmet.** The 2026-08-17
reading above stands unchanged and is what the transfer rests on: cf01 is open on a
human ACTION, not on effort. Re-measured today at `239d3bf1c`, the picture is if
anything harder — `session_eol_report` now reads **19 compaction events across 591
sessions, `auto:19`, zero manual**, where cf03 read 29 across 473 on 2026-08-17.
More sessions, fewer events: the transcript store is not append-only over this
window, so no trend may be read from the pair, and the only fact that survives both
readings is that every recorded event is automatic and none is manual. The capture
side is still `UNOBSERVED` ("no session-eol state directory"), so a Phase 1 delta
remains uncomputable. All three of the stub's probe arms are therefore measured
failing, which is what makes the transfer a real gate rather than a formality.

**Rollback:** spikes are scratch work; nothing ships from this phase.

## Phase 1 — Compaction-boundary rule reinjection

- [-] Add a `reinject-index` concern bound on `session_start` and gated on the compact and resume sources, reusing the gating pattern the hot-context concern already proves works. **TRANSFERRED 2026-08-20 (disposition B, outcome `transferred`) — moved with all of Phase 1 to [`stubs/road-to-compaction-survival-census.md`](stubs/road-to-compaction-survival-census.md); the build-or-close decision reads cf01 and cf01 is not measurable from a repository.** <!-- verify: ./scripts-run src/scripts/lint_hook_manifest -->
- [-] Generate the index at build time from rule frontmatter — tier plus a new optional reinject flag — rather than maintaining it by hand: a hand-maintained index is the staleness defect wearing a new hat. Cap it at twenty lines of pointers, never rule bodies; refilling the window with bulk material re-spends exactly the tokens the compaction reclaimed. **TRANSFERRED 2026-08-20 (disposition B, outcome `transferred`) — moved with all of Phase 1 to [`stubs/road-to-compaction-survival-census.md`](stubs/road-to-compaction-survival-census.md); the build-or-close decision reads cf01 and cf01 is not measurable from a repository.** <!-- verify: ./scripts-run src/scripts/check_references -->
- [-] Spotlight the injected block as data-plus-directive, consistent with the framing the hot-context concern already uses. **TRANSFERRED 2026-08-20 (disposition B, outcome `transferred`) — moved with all of Phase 1 to [`stubs/road-to-compaction-survival-census.md`](stubs/road-to-compaction-survival-census.md); the build-or-close decision reads cf01 and cf01 is not measurable from a repository.** <!-- verify: grep -q spotlight src/scripts/reinject_index_hook.ts -->
- [-] Bind the concern on the primary host only, and report the other platforms as open gaps rather than as covered — the same honesty posture the session-canary rule states for its own uncovered hosts. **TRANSFERRED 2026-08-20 (disposition B, outcome `transferred`) — moved with all of Phase 1 to [`stubs/road-to-compaction-survival-census.md`](stubs/road-to-compaction-survival-census.md); the build-or-close decision reads cf01 and cf01 is not measurable from a repository.** <!-- verify: ./scripts-run src/scripts/check_enforcement_coverage -->
- [-] Re-run the Phase 0 census with the concern live and record the delta against the baseline. No delta after five sessions reverts the concern and publishes the null. **TRANSFERRED 2026-08-20 (disposition B, outcome `transferred`) — the most directly gated step of the six: it reads cf01's baseline, and `context-fidelity-compaction-compliance` carries none. Moved to [`stubs/road-to-compaction-survival-census.md`](stubs/road-to-compaction-survival-census.md).** <!-- verify: ./scripts-run src/scripts/check_claims -->
- [-] Record the decision as an ADR: rule survival across compaction is a suite responsibility carried on the compaction-sourced session start, index-form only, budget-capped. Rejected alternatives: full-payload reinjection (token regression), per-turn reinjection (the cost shape the session-canary rule already refuses), and relying on host re-injection alone (contested, which is why the census exists). **TRANSFERRED 2026-08-20 (disposition B, outcome `transferred`) — moved with all of Phase 1 to [`stubs/road-to-compaction-survival-census.md`](stubs/road-to-compaction-survival-census.md); the build-or-close decision reads cf01 and cf01 is not measurable from a repository.** No ADR is written: there is no decision yet to record, and an ADR asserting the design without the census behind it would be the unverified-premise-as-fact failure Phase 3 was reverted for. <!-- verify: ./scripts-run src/scripts/adr/regenerate_index -->

**Exit criteria — NOT met; the phase is transferred whole (2026-08-20).** The concern is not bound, no census re-run exists, and no ADR is indexed. Nothing was built and nothing was rejected on merit: all six steps moved to [`stubs/road-to-compaction-survival-census.md`](stubs/road-to-compaction-survival-census.md) under disposition B. Outcome state: `transferred`. Phase 1's kill criterion travels with them unchanged — no measured delta over five sessions removes the concern and publishes the null — so the honest-null path is preserved rather than spent.

**Rollback:** remove the concern from the manifest; the build-time index generation is inert without it.

**Kill criteria:** no measured delta over five sessions removes the concern and publishes the null.

## Phase 2 — Memory eviction on the curated store

- [x] Add a last-verified stamp per entry in the curated memory files — an ISO date plus the commit it was verified against — written on create and refreshed only when a check confirms the entry against the live tree. **Narrowed 2026-08-17:** the ISO date half already ships and is a required key (`check_memory.ts` REQUIRED_KEYS), so what remains is the **commit anchor** and the refresh-on-check semantics. The anchor is the load-bearing half: without it a date cannot be tied to a tree state, which is precisely why the current 0.0 % staleness rate is unfalsifiable. **Closed 2026-08-19.** All 107 entries carry `verified_at_commit: 9beeb0662` (the tree cf02 walked), `semantic_verdict`, and `semantic_verdict_at`; `review_after_days` is now per store (30/90/90) derived from cf02's measured decay ratio. The proof that it repaired the artefact is the instrument's own output on an otherwise unchanged store: `check_memory` reported **0** staleness findings before and **13** after. The blocker's sweep half shipped as `report_memory_pointers` and its ranking claim was measured and withdrawn — see step 3. <!-- verify: ./scripts-run src/scripts/check_memory -->
- [x] Add the consolidation pass as a deterministic carrier reusing the existing condense, contradiction, and similarity tooling: what is new is the policy, not the machinery. Reference the existing intake decay implementation for its half-life and promotion semantics rather than reimplementing decay. **Closed 2026-08-19 as `memory_consolidation.ts`, with one citation in this step corrected rather than followed.** The similarity half is exactly as written — `_lib/text_similarity`, shared thresholds, no new machinery, only a store-wide entry point the per-proposal checkers do not have. The *condense* citation is a mis-reference: `condense_memory.ts` rewrites AGENTS.md-style instruction files to telegraph grammar and has nothing to do with this store, so it was not reused and the `verify:` probe below only proves it exists. Result on the real store: **0 candidates** at the shared bands, and provably not a check that cannot fire — at `--threshold 0.2` it surfaces 56, topped by a genuine cross-type pair (`pr-gate-roadmap-archival` ↔ `council-roadmap-pr-gate`, 0.34). <!-- verify: ./scripts-run src/scripts/memory_consolidation --help -->
- [x] Add the eviction ladder: an entry not re-verified within the first threshold demotes to the quarantine directory where it stays inspectable; a further threshold without re-confirmation deletes it. Both thresholds come from the Phase 0 census, not from a guess. **Closed 2026-08-19 as `memory_eviction.ts`** — quarantine at two windows past due, delete at three while quarantined, quarantine living OUTSIDE the memory root (`agents/memory-quarantine/`) so `check_memory` does not read it as a memory type. The thresholds are the per-store windows derived from cf02's decay ratio, and the derivation is published with its own limitation: cf02 measures rates, not times, and its batch finding makes a linear day count the right shape for a ratio and the wrong shape for a deadline. **The blocker's sweep question was resolved by the council (unanimous Option 2, 2026-08-19) and then partly falsified by measurement** — see `agents/evidence/eval-findings/context-fidelity-cf04.md`: pointer liveness ranks staleness at 0.00x lift (0.75x with anchor drift), so the ladder reads recorded human verdicts and age, and never the pointer report. Exit criterion met: 22 entries actually moved through demotion on the first run, 107 curated entries → 85. <!-- verify: ./scripts-run src/scripts/memory_eviction --help -->
- [x] Cap the memory index injected at session start, enforced by the carrier refusing to inject beyond budget rather than by prose. **Closed 2026-08-17 as already-shipped, not built here.** `session_memory_index.ts:28` declares `SESSION_INDEX_ROW_CAP = 30` and it is the default argument of `session_index_rows()`, `build_session_index_block()`, and `session_index_cost()` — the cap is in the carrier, rows are `id · title · ~tokens` pointers, and bodies are never injected. Recorded rather than silently dropped: an executor who trusted the drafted Context table would have rebuilt this. <!-- verify: grep -q SESSION_INDEX_ROW_CAP src/scripts/session_memory_index.ts -->
- [x] Make contradiction outrank retention: an entry failing the contradiction check against the live tree demotes immediately regardless of age. **Closed 2026-08-19, with the signal's SOURCE settled by measurement rather than assumed.** As drafted the step reads as though a mechanical "contradiction check against the live tree" exists to fail; it does not, and cf04 measured why one is not in prospect — entry bodies are free prose, and the closest mechanical proxy ranks below random. So the field is `semantic_verdict`, a recorded HUMAN reading, and a `stale` verdict quarantines immediately at any age (`memory_eviction.ts` `classify`, pinned by test). `unverifiable` entries are surfaced on age but never quarantined on it: the tree can never discharge the reason. The `verify:` probe still points at the per-proposal contradiction detector, which is a sibling mechanism and not this one. <!-- verify: ./scripts-run src/scripts/check_memory_contradiction -->
- [x] Record the decision as an ADR: learned memory carries verification stamps, unverified entries decay through a quarantine ladder, and injection is budget-capped. Rejected alternatives: manual deletion (the unenforced status quo), disabling learned memory outright (discards the value the consolidation tooling was built for), and age-only expiry (age is a proxy; contradiction against the tree is the actual signal). **Closed 2026-08-19 as ADR-234**, which carries a fifth rejected alternative this step did not anticipate: auto-demoting on the pointer report, rejected twice over — by the council in advance and by cf04's measurement afterwards. Note the flag: the regenerator defaults to `docs/adr/`, so the index rebuild for this repo is `--dir docs/decisions`. <!-- verify: ./scripts-run src/scripts/adr/regenerate_index --dir docs/decisions -->

**Exit criteria:** every curated entry carries a stamp, the ladder runs on a real store, and one entry has actually moved through demotion.

**Rollback:** stamps are additive metadata; removing the ladder leaves them harmless.

**Kill criteria:** a stale ratio below 10 % in Phase 0 shrinks this phase to stamps only, with the ladder unbuilt and the null published.

## Phase 3 — Skill-top position lint

- [-] Add a check in the existing lint family asserting that load-bearing obligation blocks sit near the start of each skill file, because post-compaction skill re-injection truncates by keeping the file start. Re-verify the truncation cap against current host documentation at build time — it is a host fact, not a tree fact. Warn level first; escalation to blocking only after one release of data. **SKIPPED 2026-08-17 — the check already exists. `check_iron_law_prominence` is registered, has a coverage floor, is BLOCKING, and pointed at `src/skills` finds 13 violations with actionable diagnoses. What is missing is not a mechanism but a corpus: it runs with `argv: ["--quiet"]` and no path, so its corpus is `src/rules/*.md` and the skills tree is unscanned. Recorded as the `prominence-gate-skills-corpus` blocker, because extending an enforced blocking gate by 13 findings at once is a maintainer decision.** **Narrowed 2026-08-20 — `src/skills` is OUT OF SCOPE for this gate and this roadmap; see the decision comment below and the `prominence-gate-skills-corpus` blocker.** <!-- verify: grep -q check_iron_law_prominence src/config/gate-coverage.yml -->
<!--
decision 2026-08-20: prominence-gate-skills-corpus resolved as D — narrowed, value
`leave-unscanned`. Council record: agents/evidence/council/drain-blocker-dispositions-a.md
(anthropic + openai, quorum 2/2, one framework round + one disposition round).

The reasoning, not just the verdict:

1. The gate has no warn level. Its flags are `--format`, `--quiet` and positional
   paths only, so "extend at warn level first" — the step's own escalation
   discipline — is not expressible without ADDING a warning mode to an enforced
   blocking gate. That is a new failure mode introduced to service a corpus
   question, and the corpus question has no evidence behind it: nothing measured
   that obligation prominence in `src/skills` costs anything. Adding a mode to a
   gate in order to lower the severity of findings nobody has shown to matter is
   the wrong direction of work.
2. Extending the corpus reopens a semantic conflict that was already reverted
   once. `lint_skill_top_position` was built, tested with 35 tests, closed as
   passing, and then reverted on the R2 review precisely because two gates would
   have defined one construct incompatibly — the new gate pinned `### Iron Law 1`
   as VALID, which is the heading downgrade `preservation-guard` forbids and the
   existing gate encodes as `deep_iron_law`. Re-verified 2026-08-20: of the 13
   findings, 11 are `buried_iron_law` and 2 are `deep_iron_law`, so the disputed
   class is still live in the corpus. `leave-unscanned` preserves both
   `deep_iron_law` and `preservation-guard` behaviour untouched, which is the one
   outcome that cannot re-open the conflict.
3. The step's stated premise is unverified and was the third reason for the
   original revert. "Post-compaction skill re-injection truncates by keeping the
   file start" — the tree's one measured truncation fact is ENTRY-level, a
   granularity intra-file ordering cannot help. Scanning a larger corpus on an
   unverified premise buys enforcement, not correctness.

What this decision does NOT claim: that the 13 findings are wrong, or that the
skills tree is prominence-clean. It claims only that this roadmap is not the
vehicle for that corpus, and that the gate's coverage boundary is now written
down instead of being an accident of an argv line. A future maintainer who wants
the skills corpus scanned starts from the two-step ratchet in the blocker's
Recommendation — reported-and-baselined first, then drained — and from a measured
reason to want it.
-->

**Exit criteria (narrowed 2026-08-20):** the gate's coverage boundary is written down — `check_iron_law_prominence` scans `src/rules/*.md` (119 files at `239d3bf1c`) and **`src/skills` is explicitly outside this gate's coverage**. The original criterion, "the check runs across the skill set and reports a count without failing the build", is **not met and is withdrawn**: it presupposed the corpus extension the `leave-unscanned` decision declines. Outcome state: `narrowed`.

**Status 2026-08-17 — the step is withdrawn, and the withdrawal is the finding.**
A `lint_skill_top_position` gate WAS built, registered, tested (35 tests) and
closed as passing, and then reverted on the R2 review. Three reasons, in
descending order:

1. **The obligation already ships.** The gate's own docblock asserted "nothing
   checked it", which was false.
2. **Two gates would have defined one construct incompatibly.** The new one
   accepted any heading level including numbered `Iron Law N` and measured a line
   offset; the existing one accepts H2 only, treats H3 as the violation itself,
   and measures position among the first two H2 headings. The new gate's test
   explicitly pinned `### Iron Law 1` as VALID — the shape `preservation-guard`
   forbids. Two of its three findings were H3-only Iron Laws, so the two gates
   disagreed on the same text.
3. **Its premise was unverified and asserted as fact in five tracked surfaces.**
   "Truncation keeps the file start" — the tree's one measured truncation fact is
   ENTRY-level, a granularity intra-file ordering cannot help, and this
   roadmap's own Context paragraph argues the opposite for attention.

Worth recording plainly: this is the same defect the roadmap exists to fix,
committed by its own executor ninety minutes after closing Phase 2 step 4 as
already-shipped. The Prerequisite-4 re-verification checked the Context table and
not the step's own premise, and the solution-size ladder's reuse-in-repo rung was
skipped. The exit criterion is therefore **not** met by this branch — it is met
for `src/rules/` by the existing gate, and unmet for `src/skills/` pending the
corpus decision.

**Rollback:** none needed — nothing shipped.

## Phase 4 — Context management for spawned workers

- [-] Enable the provider's context-management parameters for suite-spawned workers and evaluate the summary-replacement control alongside them. This operates below the existing worker-recycling checkpoints, at the API layer, and does not touch the standing decision against external runtime federation — it is a feature of the provider already in use, not a new runtime. **ABANDONED 2026-08-20 (disposition E) — the step's premise is false, and executing it as written would ship a gate that cannot fail. See the decision comment below.** <!-- verify: grep -rq context_management src/scripts/ -->
<!--
decision 2026-08-20: Phase 4 step 1 → E, ABANDONED. Not blocker-held, so this was
executed rather than transferred: the work was attempted, and attempting it is what
established that it is not repository work. Framework: agents/evidence/council/drain-blocker-dispositions-a.md
§ "A fifth disposition E — ABANDON exists, for work that is a declared Non-goal or
depends on a capability nobody is building."

Three findings, each verified at 239d3bf1c:

1. THE PREMISE IS FALSE. The step says this "operates ... at the API layer", which
   presupposes that this repository constructs the request that spawns a worker.
   It does not. Workers are spawned by the HOST's own `Agent` / `Task` tool; this
   repository's only relation to a spawn is observing it afterwards —
   `src/scripts/hooks/orchestration_record_hook.ts:86` declares
   `DISPATCH_TOOL_NAMES = new Set(['Agent', 'Task'])` and `hook_manifest.yaml`
   binds `tools: [Agent, Task]` on a post-tool slot. There is no request body to
   add a parameter to. `docs/contracts/subagent-boundary.md:57-60` states the
   boundary directly: "whether a subagent spawned by a host primitive outside
   these templates inherits any of it ... is a host property this package does
   not control and does not test."
2. THE REACHABLE PROVIDER SURFACE CANNOT USE THE PARAMETER. Real provider calls
   do exist here — `src/scripts/ai_council/clients.ts:545` posts to
   `api.anthropic.com/v1/messages`, and `_lib/trigger_routers.ts`,
   `second_brain_run.ts` and `rdp_gate_classify.ts` do likewise. Every one is a
   single-shot, TOOL-LESS call; the CLI transport passes `--tools` with the
   disable-all value deliberately. Context management prunes accumulated
   tool-result history, so on a request that carries no tools it has nothing to
   operate on. The surface the repo can reach is the surface where the feature is
   inert, and the surface where it would help is the one the repo cannot reach.
3. NO COMMITTED PRODUCER. Closing this as `B — transferred` was considered and
   rejected. A B disposition requires a NAMED re-entry producer, and the only
   producer here is "a host vendor exposing a context-management parameter on its
   Agent/Task primitive" — which names nobody and has no commitment behind it.
   That is exactly the "landed for its own reason" shape the framework's own
   dissent section refuses, and the ground on which measurement-a and
   measurement-b were abandoned rather than stubbed. A stub with no producer is a
   parking lot that reports as progress.

WHY THIS COULD NOT BE CLOSED GREEN. The `verify:` probe is
`grep -rq context_management src/scripts/`, and it is satisfiable by writing the
literal string anywhere under `src/scripts/` — for instance onto a council request
body, where finding 2 says it would do nothing. That would turn the probe green
while shipping no capability: a gate that passes because it cannot fail, which is
the precise failure this roadmap's own § Context refuses to commit when it declines
to fire Phase 2's kill criterion on an unfalsifiable 0.0 %. Probe re-run at
239d3bf1c: exit 1, zero hits — the honest state.

REOPEN CONDITION. A host `Agent`/`Task` primitive that exposes a context-management
parameter to its caller, OR a repo-constructed worker loop that carries tools. The
existing precedent for recording an unavailable host capability without pretending
it is coming is `_lib/host_capability.ts`'s `worker_respawn`, false on every host
and set true only once OBSERVED. Nothing here needs a new mechanism.
-->
- [-] Measure tokens per completed worker task with and without, over the same task set, and adopt only on a measured improvement. Otherwise publish the null. **CLOSED 2026-08-20 (disposition C) — the instrument ran, answered, and the null is already published. See the decision comment below.** <!-- verify: ./scripts-run src/scripts/check_claims -->
<!--
decision 2026-08-20: Phase 4 step 2 → C, the null is TERMINAL. Framework:
agents/evidence/council/drain-blocker-dispositions-a.md § "Measured null is not
the same as cannot-measure. No instrument → B/E; instrument ran and answered zero
→ C; instrument broken → B." This is the middle case, and the difference from step
1 above matters: step 1 has no instrument, this one has an instrument that ran.

WHAT THE INSTRUMENT ANSWERED. `docs/CLAIMS.md:266-272`, claim
`orchestration-observed-dispatch-cost` — pre-registered 2026-08-07 BEFORE the
extractor was built, asking this step's question on the observed production
dispatch corpus, and RESOLVED the same day to `status: resolved-null` with the
verdict artefact at `internal/bench/orchestration/backfill-2026-08-07-verdict.md`.
Its own words: "HONEST NULL, no family proves out: `gateVerdict()`'s two inputs are
both unmeasurable from this corpus — `net_win` needs a counterfactual that is not on
disk ... and `quality_held` needs paired outputs the single-arm corpus does not
hold."

That is exactly this step's two arms. "With and without ... over the same task set"
IS the counterfactual that is not on disk, and "adopt only on a measured
improvement" IS the paired-quality input the single-arm corpus does not hold.
Re-deriving it here would ask the same question by the same means and get the same
answer at the cost of a second measurement.

WHY THE ARM CANNOT BE FILLED, mechanically rather than as an inference. The
emitting layer refuses to invent the number:
`src/scripts/hooks/orchestration_record_hook.ts:32-36` — "`token_delta` has no
honest value at this layer ... It is therefore always written as `0` with
`token_delta_provenance: estimated`" — and `:233-234` hard-codes exactly that. A
test pins it. So every row the corpus can ever contain carries a constant zero by
construction, and `contexts/execution/subagent-routing.md` records the consequence
over 327 records: the intersection of the fields a reduction would need is empty.

THE PROBE IS NON-DISCRIMINATING, AND SAYING SO IS THE POINT. The step's
`verify:` is `./scripts-run src/scripts/check_claims`, which at 239d3bf1c exits 0
already: "8 markered claim(s) bound · ledger 70 entries". It validates ledger
structure, not that a worker-token measurement happened — so this step could have
been flipped `[x]` on a green probe without measuring anything. It is closed `[-]`
on the published null instead, which is the honest state and the weaker-looking one.

NOT CLAIMED: that delegation does not save tokens. The claim is `resolved-null` —
unmeasurable on this corpus — never disproven. The reopen condition is the one the
tree already names: the first orchestration line carrying `dispatch_tokens`,
`session_tier` and `tier_chosen` together, which is a second-arm problem and not
this roadmap's.
-->

**Exit criteria — met, in the weaker of the two available ways (2026-08-20).** "A recorded measurement exists either way" is satisfied by the recorded null: `orchestration-observed-dispatch-cost` (`docs/CLAIMS.md:266-272`, `status: resolved-null`, verdict at `internal/bench/orchestration/backfill-2026-08-07-verdict.md`). Step 1 is separately `abandoned` and step 2 `satisfied-as-null`, so the phase ships no capability. Outcome state: `abandoned` for the enablement, `satisfied` for the measurement obligation.

**Rollback:** the parameters are per-request and removable without migration.

## Blockers

**Why this section exists at all, added 2026-08-17.** This roadmap shipped with
**zero** structured blockers while five of its steps were gated on a human
action, so the dashboard published a blocker count of 0 and the backlog screen
read it as takeable. That is a measured recurring failure in this repository —
seven roadmaps currently publish 0 blockers with open steps — and the fix is to
declare the gate rather than to leave it in prose. Nothing about the plan changed;
what changed is that the gate is now countable.

### blocker: compaction-census-session

- **Status:** resolved — council 2026-08-20, disposition **B — transferred** ([`drain-blocker-dispositions-a.md`](../evidence/council/drain-blocker-dispositions-a.md); anthropic + openai, quorum 2/2, one framework round plus one disposition round). Rationale as recorded: "The experiment requires live host behavior, manual compaction, and an external session-state directory; repository work cannot manufacture those observations." **Outcome state: `transferred`, not `satisfied`** — the compaction-survival question is still unmeasured and this roadmap does not claim otherwise. Destination stub: [`stubs/road-to-compaction-survival-census.md`](stubs/road-to-compaction-survival-census.md), carrying the three-point integrity check — the original resolution criterion verbatim, the complete dependent set (Phase 0 cf01 plus all six Phase 1 steps, none of which survives cf01's absence), and a named re-entry producer (the context-fidelity maintainer running an instrumented host session) with a detection probe whose three arms were all measured **failing** on 2026-08-20.
- **Owner:** user
- **Class:** 3 — human-only
- **Blocks:** nothing further in this roadmap — the blocked work left with it. It blocked Phase 0 (cf01 compaction-survival census) and transitively all of Phase 1, whose build-or-close decision reads cf01's number; both are now `[-]` transferred and both exit criteria are recorded **unmet** rather than reworded.
- **Question:** cf01 needs an instrumented live session with a manual compaction, repeated across five sessions — and cf03 has since shown that no manual compaction has ever been recorded here. Do you run the five manual sessions anyway, or should cf01 be re-specified against the automatic path that actually occurs?
- **Recommendation:** Establish manual detectability first, then decide. **Corrected on R2 finding 6** — the earlier recommendation here said "re-specify cf01 against the automatic path" because "a manual-compaction census measures a path production never takes", and that overstated what cf03 can support. cf03 recorded 29 events across 473 sessions, all 29 tagged `auto` and none manual — but the detector is pinned to one OBSERVED auto event (`src/scripts/_lib/session_eol.ts:11-19`) and nothing establishes that a manual compaction writes a `compact_boundary` record at all. Zero manual is absence of a RECORD. So the cheap first move is a single manual compaction in one instrumented session to see whether it leaves a trace: if it does, cf01 runs as written; if it does not, cf01's null would be uninterpretable and the automatic path is the only measurable one. The automatic path needs no special session — probes placed in a session that is going to cross 1M tokens, which about half the recorded sessions do (239 of 473 end above 400k).
- **If you do nothing:** Phase 1 stays unstarted, which is the correct state rather than a stall — it is exactly what a pre-registered honest-null threshold is for. Phase 2 is unaffected: its own gate now reads cf02, which is done. Phase 3 is withdrawn on its own grounds and does not wait on this. The plan degrades to its memory half, and the memory half is the one with a measured defect behind it.
- **What to do:**
  1. Run ONE manual compaction in an instrumented session and check whether `session_eol_report` counts it. This is the precondition and it is cheap — it decides whether cf01 is measurable at all, and without it a cf01 null is uninterpretable.
  2. If a manual compaction IS detectable: run the five sessions with the three probes placed before each compaction, and stamp the host version per observation. Compaction survival is a host fact that changes without notice.
  3. If it is NOT detectable: re-specify cf01 against the automatic path, and reword the five-session repetition — it was there to average manual variance.
  4. Either way, note that the capture side is currently UNOBSERVED (`session_eol_report` reports no session-eol state directory), so a Phase 1 delta cannot be computed until that directory exists.
- **Answer:** NOT COVERED by option (a) — 2026-08-20, disposition **transferred**. The
  rendered default (establish manual detectability first, then decide) is maximally
  conservative and is accepted as the ORDERING; the experiment it orders needs live host
  behaviour, a manual compaction and an external session-state directory, which
  repository automation cannot manufacture — Rule 3 in
  [drain-blocker-dispositions-a](../evidence/council/drain-blocker-dispositions-a.md)
  assigns that `B`. Batch A carries the three-point check verbatim: original criterion
  (the `context-fidelity-cf01.md` finding with a per-probe-class number and host stamp,
  or a recorded closed-unmeasured decision), Phase 0 cf01 plus the dependent Phase 1
  steps moved, re-entry producer the context-fidelity maintainer on an instrumented host
  session.
- **Resolved when:** a `context-fidelity-cf01.md` finding exists under `agents/evidence/eval-findings/` carrying a per-probe-class number and a host stamp, or the user records that the compaction-survival question is closed unmeasured and Phase 1 is cancelled. (The filename is deliberately not written as a full path here: `check_references` resolves a path in prose and the file does not exist yet, so a link would be a broken reference by construction. The step's own `verify:` probe holds the full path, which is where it belongs.) **Carried verbatim into the stub 2026-08-20 as its resolution criterion — this blocker is resolved as `transferred`, which is a change of custody and NOT a discharge of the criterion.** Neither branch of the "or" has occurred: nobody ran the sessions and nobody recorded the question closed.

### blocker: memory-sweep-instrument

- **Status:** resolved — council 2026-08-19 (anthropic + openai, two rounds, blind peer review, unanimous **Option 2**: sweep in scope, narrowed from semantic truth to pointer liveness, demotion never driven by its output). Built, then **measured against cf02's ground truth and its ranking half falsified** — 0.00x lift on dead citations, 0.75x with anchor drift, both below the 20.6 % base rate (`agents/evidence/eval-findings/context-fidelity-cf04.md`). What shipped is the reproducible half: `report_memory_pointers` reports citation integrity and anchor coverage and asserts nothing about truth. The thresholds in step 3 are therefore calibrated on cf02's hand reading exactly as this blocker's do-nothing branch described — not because the sweep was skipped, but because it was built and did not earn the calibration.
- **Owner:** maintainer
- **Class:** 2 — consent-once
- **Blocks:** nothing further. It blocked the backing of `context-fidelity-memory-staleness` and Phase 2 step 3's thresholds; both are discharged — the claim is now backed by cf02 plus cf04, and the thresholds shipped.
- **Question:** cf02's 21.5 % came from a hand walk of 107 entries by three observers, because no store-wide contradiction sweep exists. Is building that sweep in scope for Phase 2, or does the ladder ship on the hand reading?
- **Recommendation:** Build the sweep as part of Phase 2 step 1, not as a separate phase. The commit anchor and the sweep are the same work seen from two sides: the anchor is what lets a sweep decide whether an entry was verified against *this* tree, and without it any automated reading repeats the 0.0 % artefact in a new form. Shipping the ladder on a hand reading would make the thresholds unre-derivable by the next maintainer, which is the property that made this census necessary in the first place.
- **If you do nothing:** the ladder can still be built — 21.5 % clears the 10 % threshold on both denominators, so the decision it gates is already made. What stays missing is the ability to re-measure, so the thresholds in Phase 2 step 3 would be set once from a number nobody can reproduce, and drift in either direction would be invisible.
- **What to do:**
  1. Decide whether the sweep is Phase 2 step 1's scope or a new step.
  2. If in scope, note that `check_memory_contradiction` is a per-proposal checker (`--type --key --body`) and is the wrong shape to extend — the sweep needs to iterate the store, which is a different entry point.
  3. Record whether inter-rater agreement on the hand walk needs measuring before the ladder ships, or whether the 2:1 margin over the threshold makes that unnecessary.
- **Resolved when:** the maintainer records the sweep as in-scope for a named step, or records that the ladder ships on cf02's hand reading with the reproducibility limitation accepted. **Confirmed still discharged 2026-08-20, and deliberately NOT re-dispositioned.** This blocker was already `resolved` before the drain run and does **not** appear in the 2026-08-20 council batch under either name, so no new disposition applies to it; forcing one onto an already-closed entry would manufacture a decision. Its four load-bearing claims were re-checked at `239d3bf1c` instead, and all four hold: `agents/evidence/eval-findings/context-fidelity-cf04.md` exists and carries the 0.00x / 0.75x lift against the 20.6 % base rate; `src/scripts/report_memory_pointers.ts` exists; and `src/scripts/memory_eviction.ts` references pointer output in exactly three places — two comments at `:22-23` and one report string at `:358` ("Driven by recorded human verdicts and age. Never by pointer output.") — i.e. no code path reads it, which is the council precaution and Risk 6's mitigation holding in the tree rather than only in prose. Outcome state: `narrowed` (sweep built, ranking claim withdrawn on measurement).

### blocker: prominence-gate-skills-corpus

- **Status:** resolved — council 2026-08-20, disposition **D — narrowed**, value **`leave-unscanned`** ([`drain-blocker-dispositions-a.md`](../evidence/council/drain-blocker-dispositions-a.md); anthropic + openai, quorum 2/2). Rationale as recorded: "Extending the gate would introduce a new warning mode and reopen the reverted semantic conflict without evidence that the extra surface is needed." **Outcome state: `narrowed`.** The decision is applied in two places rather than only asserted here: Phase 3's step carries the reasoning as a `decision 2026-08-20:` comment, and `src/config/gate-coverage.yml` now records the corpus boundary on the gate's own entry — so the next maintainer finds it where they look, not only in a roadmap. Existing `deep_iron_law` and `preservation-guard` behaviour is untouched, which is the one outcome that cannot re-open the reverted conflict.
- **Owner:** maintainer
- **Class:** 2 — consent-once
- **Blocks:** nothing. It blocked Phase 3 (the withdrawn skill-top position step; this was the residual gap that survived the withdrawal). Phase 3 is now narrowed: its exit criterion is withdrawn as presupposing the corpus extension that was declined, and the gate's coverage boundary is written down instead.
- **Question:** `check_iron_law_prominence` is enforced and blocking but scans `src/rules/*.md` only — its CI argv is `["--quiet"]` with no path. Pointed at `src/skills` it reports 13 violations nobody currently sees. Extend its corpus, or leave the skills tree unscanned?
- **Recommendation:** Extend it, but not by simply adding the path to the existing invocation — that lands 13 blocking findings in one change, which is the gate-that-arrives-as-N-instant-blockers shape this repository has refused before. The two-step version is cheap: first add a skills run whose findings are reported and baselined (the ratchet pattern this tree already uses for `ci-parity:local-only` and `lint_roadmap_blockers:decidability`), then drain. Note that 10 of the 13 are one repeated shape — an Iron Law H2 sitting behind `When to use` and `Goal` — so a single ordering convention clears most of them.
- **If you do nothing:** the skills tree stays unscanned for obligation prominence, which is the status quo and costs nothing new. What it does cost is the next executor of this phase: the step reads as unbuilt, so the next attempt is likely to rebuild what this branch already reverted. That is why the blocker exists rather than a re-opened step.
- **What to do:**
  1. Decide extend-with-baseline versus leave-unscanned. If extending, the change is `./scripts-run src/scripts/check_iron_law_prominence --quiet src/skills` plus a baseline entry in `src/config/gate-violation-baselines.json` and a `min_scanned` floor in `src/config/gate-coverage.yml`.
  2. If extending, decide whether skills are warn-level or blocking-with-baseline. The gate has no warn flag today (`--format`, `--quiet`, positional paths only), so warn-level means adding one.
  3. Reconcile the two definitions before either lands: `preservation-guard` forbids Iron Law heading downgrades, and the gate already encodes that as `deep_iron_law`. Any new positional check must not contradict it — that contradiction is what got the first attempt reverted.
- **Resolved when:** the maintainer records extend-with-baseline (with the baseline landed) or leave-unscanned, and Phase 3's step text is updated to match so the next executor does not rebuild the reverted gate. **Discharged 2026-08-20 on the `leave-unscanned` branch:** the value is recorded, no baseline was needed because nothing was extended, and Phase 3's step text plus the gate's own config entry now both say `src/skills` is out of scope. Re-measured the same day so the decision rests on current numbers rather than the 2026-08-17 reading: 13 findings, **11 `buried_iron_law` and 2 `deep_iron_law`** — the earlier note said "10 of the 13 are one repeated shape", so the split has drifted by one and the disputed `deep_iron_law` class is still live in the corpus, which is the class the reverted gate contradicted.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-20 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Reinjection re-spends the tokens compaction reclaimed | implementation | An index that grows into payloads turns a fix into a regression. | Twenty-line pointer cap generated at build time, one injection per compaction event rather than per turn, and a measured token delta in the census re-run. **2026-08-20: unrealised and TRAVELLED — nothing was built, so the risk moved to the stub with Phase 1 and its mitigation is untested.** | Phase 1 |
| 2 | Eviction deletes a still-valid memory entry | product | An entry that is true but simply not re-verified decays out and the knowledge is lost. | Demotion moves to an inspectable quarantine before deletion; contradiction against the tree, not age alone, drives immediate demotion; thresholds come from the census. | Phase 2 |
| 3 | Host mechanics drift underneath the plan | implementation | Compaction survival rules, re-injection caps, and session-source semantics are host facts that change without notice. | Every census result is stamped with the host version; the skill-top cap is re-verified at build time rather than hardcoded from a document read once. **2026-08-20: HALF THE MITIGATION IS GONE and the risk is confirmed live.** The skill-top-cap arm is void — Phase 3 is withdrawn, so no build-time re-verification of a host cap exists or will. The stamping arm holds and earned its place: `session_eol_report` read 29 events / 473 sessions on 2026-08-17 and 19 / 591 today, a non-monotone pair that is only interpretable *because* both readings were stamped. | Phase 0, Phase 3 |
| 4 | The baseline shows no defect to fix | product | Post-compaction compliance turns out to be high and Phase 1 was built on folklore. | The honest-null threshold is pre-registered before the census runs; at or above 90 % across all three probe classes, Phase 1 is not built and the null is published with the host version recorded. **2026-08-20: the mitigation WORKED, in its cheapest form — the threshold was pre-registered, the census never ran, and Phase 1 was therefore not built on folklore. The risk is neither realised nor retired: `context-fidelity-compaction-compliance` carries no baseline, so whether the defect exists is still unknown. It travelled to the stub unspent.** | Phase 0 |
| 5 | A new obligation surface grows the estate | product | Fixing context loss by adding rules is self-defeating. | The plan adds one concern, one frontmatter flag, policy on existing machinery, and one lint — zero new rules is the intent, and a rule turning out to be necessary is a finding to surface rather than absorb. **2026-08-20: NOT realised, and the count came in under budget rather than on it.** Zero rules, and also zero concerns, zero frontmatter flags and zero new lints: the concern and flag went to the stub with Phase 1, the lint was reverted in Phase 3, and Phase 2 shipped three scripts plus one ADR on existing machinery. The estate grew by one stub and one gate-config note. | Phase 1, Phase 2, Phase 3 |
| 6 | A shipped instrument keeps a claim its measurement retired | implementation | `report_memory_pointers` was built as a staleness ranker and measured at 0.00x lift. An instrument that stays in the tree under its original framing gets cited later for the thing it cannot do — the same 0.0 %-that-means-nothing failure one layer up. | The name, the header, the help text and the report's own first line all state the null; cf04 carries the numbers and the reproduction; and the ladder reads none of its output. If the claim creeps back, it has to survive a test that pins why each narrowing exists. | Phase 2 |
| 7 | Re-verification becomes a treadmill nobody walks | product | The 30-day window on `historical-patterns` is short, and a deadline nobody meets is a uniform 365-day window wearing a smaller number. Entries would then decay into quarantine on age rather than on a reading. | The window is derived and republishable rather than chosen, so it is falsifiable by the next census; ADR-234's review trigger names exactly this; and quarantine is reversible, so the cost of the treadmill failing is a demotion to appeal rather than a deletion to regret. | Phase 2 |

**Re-read 2026-08-20, not restamped.** The date on the marker moved because four
of the seven rows needed a real reading, not because a gate asked. Rows 1, 3, 4 and
5 are anchored under phases whose state changed in this run, and the register would
otherwise have described a plan that no longer exists — row 3's skill-top-cap
mitigation in particular is now VOID rather than pending, which a restamp would have
carried forward as live. Rows 2, 6 and 7 are Phase 2's and were re-checked against
the tree rather than assumed: row 2's quarantine-before-deletion holds
(`memory_eviction.ts`, quarantine outside the memory root); row 6's holds and was
verified line by line — pointer output is referenced in exactly three places in
`memory_eviction.ts`, two comments and one report string, and no code path reads it;
row 7 is the one that **has now been observed rather than anticipated**, in the
uniform `last_validated: 2026-07-09` still carried by all 85 entries. Row 7 keeps
its `product` type and its mitigation, and is the register's only live open risk.

## Acceptance Criteria

- [-] Both Phase 0 censuses exist as written findings with numbers and a recorded host version. **NOT met — half met, and recorded as unmet rather than reworded (2026-08-20).** cf02 (memory staleness, 21.5 % against the tree) and cf03 (compaction events per session) exist with numbers and a host stamp. A `context-fidelity-cf01.md` finding does not exist under `agents/evidence/eval-findings/` and is `transferred`; the step's own `verify:` probe fails today. Outcome state: `transferred`.
- [-] Either the reinject concern is bound with a measured positive delta, or the null is published and the concern is absent. **NEITHER branch met, and the distinction matters (2026-08-20).** The concern is absent — but no null was published, because publishing one would assert a measurement that never happened. The disjunction was written assuming the census would run; with cf01 transferred, both arms are unreachable from a repository. `context-fidelity-compaction-compliance` stays registered with no baseline, which is the honest state. Outcome state: `transferred`.
- [x] Either the curated store carries verification stamps with a working ladder, or the stale-ratio null is published and only stamps ship. **Met on the first branch (2026-08-19):** all 107 entries carry `verified_at_commit` + `semantic_verdict`, the ladder ran on the real store and moved 22 entries through demotion, and a null was published anyway — cf04, on the sweep's ranking claim rather than on the stale ratio.
- [x] No new rule was added by this roadmap, or the one that was is named explicitly with its justification. **Met:** Phase 2 added no rule. Three scripts, one ADR, one guideline section, one evidence artefact — the obligation lives in the ladder, not in prose an agent has to remember.
- [x] Every claim in the Context table is re-verified against the executing branch head before its phase runs. **Met (2026-08-20).** Every phase that actually ran was preceded by a re-verification: Phase 2 at `9beeb0662`, and this run's Phase 3 narrowing and Phase 4 closure at `239d3bf1c` — where two rows turned out to be overtaken by this roadmap's own Phase 2 and are now corrected in the table. Phases 0 (cf01) and 1 did not run and so had no trigger to satisfy. Note the deliberate asymmetry with Prerequisite 4, which stays `[ ]`: this criterion is scoped to phases that ran and can therefore be met, while the prerequisite is a recurring per-phase obligation with no terminal state and would be false as `[x]`.

## Provenance

- Source: an external analysis session over this repository, 2026-08-13, pinned at `8a043ec`, re-verified at `6d18f5bb2` when this file was written, and re-verified again at `9beeb0662` on 2026-08-17 under Prerequisite 4. The Context table records which claims survived each re-verification and which did not.
- External evidence is summarized without naming the individual community repositories that demonstrate the reinject pattern; the raw session material with its links stays local and untracked at `agents/tmp.old/road-to-context-fidelity.txt`.
- Council: not convened.
