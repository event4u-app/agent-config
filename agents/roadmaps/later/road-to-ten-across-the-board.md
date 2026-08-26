---
complexity: structural
status: draft
estate_offset_exempt: "Landed by the /analyze:inbox run of 2026-08-24. The one-in-one-out half fires on every added agents/roadmaps/road-to-*.md whatever its status, and this run archived only status: draft roadmaps, which were never counted and so are unavailable as offsets. This file owns zero progress state and is the index the other two landed roadmaps and the parked deep-capabilities file are read through; it replaces no single roadmap and therefore has no natural one-out."
estate_growth_exempt: "later_roadmaps 65 -> 66, and active_roadmaps +0. The +1 is the PARKING ITSELF, not a side effect: this file moves from the top level into later/, and check_estate_count counts later_roadmaps with countIn(), a bare name filter that never reads status -- so a status: draft file is exempt from active_roadmaps and exempt from nothing in later/. The same asymmetry is recorded on road-to-ac-deep-capabilities.md, which was parked under it. No new roadmap was authored; the estate holds exactly the files it held, one of them relocated. The alternative shapes are both worse: archiving would claim a completion that did not happen (AC-1 through AC-4 are unevaluable, not met), and leaving it at the top level as status: draft keeps a known program-level limitation invisible to the dashboard, which is the specific defect an AI council 2/2 named when it chose this disposition. open_blockers +0: this change files none and closes none. Revisit-if: the authoritative rubric review is restored, at which point the file returns to the active estate and later_roadmaps drops back to 65."
execution:
  mode: phase-checkpoints
park: later
status_note: "parked — the completion predicate is unevaluable, not failed"
blocked_on: "the authoritative 32-category rubric review is absent from the tracked tree and its inbox copy is gone"
known_manifest_rows: 23
unknown_manifest_identities: 9
affected_acceptance_criteria: [AC-1, AC-2, AC-3, AC-4]
downstream_execution: unaffected
entry_condition: "The authoritative rubric review is restored at a tracked, stable path AND agents/evidence/ac-capability-scorecard.yaml can declare state: complete with authority naming that path — at which point check_score_contract stops refusing the redeclaration and AC-1 becomes evaluable for the first time. Nothing else resumes this file: no amount of downstream track progress closes a manifest the tree does not hold. <!-- ref-ignore -->"
pin: "fd42264a998e4ec66ba4fd397d9c37b801d045ba"
---
# Road to ten across the board (program roadmap, v2 council-merged)

> ## PARKED — and this does NOT suspend anything downstream
>
> **The referenced roadmaps and tracks (Waves 2-5, and every per-track file this
> index points at) continue independently. Their progress is not blocked by this
> file's parked state, and nothing here should be read as halting them.**
>
> This index is parked because its own completion predicate is **unevaluable**,
> not because it failed and not because the work stopped. AC-1 quantifies over
> *"every rubric category in the declared manifest"*, and **nine of the 32
> category identities are unknown** — not their scores, their identities. The
> authoritative external review that would supply them is not in the tracked
> tree and its inbox copy is gone. An acceptance criterion over a set the
> repository does not hold cannot be assessed, which is a different state from
> unmet, and the frontmatter above records it as such.
>
> Parked rather than transferred to a stub, by AI council 2026-08-26, 2/2
> convergent. A stub holds deferred *executable scope* behind a *feasibility*
> probe; this file holds sequencing and a score contract over work owned
> elsewhere, and its only reactivation event is an external restoration. One
> seat: *"stubbing it would duplicate topology while obscuring ownership."*
>
> **`status: draft` was replaced deliberately.** Draft hid this file from the
> dashboard entirely, which is worse than either being active or being visibly
> parked: a known program-level limitation was invisible rather than represented.
>
> **What landed before parking**, under the council's condition that only
> independently-complete work leaves an index: Step 3.3 (the router's runtime
> consumer measured, and three shipped artefacts corrected where they contradicted
> the tree) and AC-6 (recording a blocker that has read `Status: resolved` since
> 2026-08-24). **Step 1.2 did NOT land** — the release-placeholder guard is
> technically buildable but its promotion criterion requires a maintainer-named
> `one_in_one_out` offset, and re-promoting without one would repeat verbatim the
> act that got its last promotion reverted.

> **Source:** agents/tmp.old/road-to-10/road-to-ten-across-the-board.md

> Council synthesis 2026-08-23, pinned to
> `fd42264a998e4ec66ba4fd397d9c37b801d045ba`. v2 merged two independent
> analyses. **Landed 2026-08-24 against HEAD `0f7c26ee9` with seven items
> deleted as already-shipped** — see § Corrections applied at landing. Five of
> the eleven defects the draft inventoried were dead at landing; the deletions
> are recorded rather than silently dropped, because the draft's own sequencing
> argument rested on two of them.
>
> Inverted-harvest form: interventions are pulled in per confirmed defect,
> never pushed additively. This file owns **no progress state** — all state
> lives in the referenced per-track roadmaps and the score contract.

## Goal

Every rubric category **in the declared manifest** of
`agents/evidence/ac-capability-scorecard.yaml` reaches `ten`, `measured-null`, or
`max-boundary` under the six-dimension definition frozen in
`road-to-score-contract.md` — with no existing 10
regressed, no aggregate averaging, and no mechanism shipped only to satisfy a
rubric row. The v1 "doctrine caps" are withdrawn: a pre-registered **measured
no-build null is itself a terminal 10-eligible state**, which protects the same
constraints (no daemon, no graph monolith) without freezing a judgement as a
ceiling.

**"32 categories" is a reported figure, not a manifest this tree holds.** The
external review is not in the tracked tree and its inbox copy is gone. **23**
categories with baseline scores are recoverable — from § Category → closing path
below, which is the recovery source the scorecard names — and **nine identities
are unknown**, not merely their scores. The scorecard therefore declares
`state: incomplete` with `authority: unavailable-external-review`, and
`check_score_contract` **refuses** a redeclaration to `complete` while that
holds. So every "all 32" dependency in this file reads *all rows in the declared
manifest*; closing the manifest needs the authoritative review re-supplied, which
is a maintainer action and not a step here. AI council 2026-08-24, 2/2 convergent
— both seats also corrected the arithmetic the executing run first got wrong
(32 − 23 = 9, not 7) and refused to add `runtime simplicity` / `host portability`
as rows, since nothing establishes they were rubric categories.

## Non-negotiable invariants (merged)

Runtime simplicity, host portability, evidence honesty, reproducibility, and
governance-complexity control are hard non-regression floors. The user remains
the sole merge authority. Production claims need production windows — fixtures
never satisfy adoption, production, or outcome dimensions. Judgement stays out
of gates. Every irreversible transition is guarded before the effect. New
persistent state names ownership, schema versioning, retention, and deletion.

## Context — defect inventory, re-measured at landing (HEAD `0f7c26ee9`)

Ids are kept stable so the corrections table below can cite them; a struck id
is not renumbered.

| # | Defect | Provenance |
|---|--------|------------|
| D1 | Publication guard absent; `DERIVED_MARKER` can still publish; blocker removed (`release.ts` **2,024** lines; `release_publication.ts` 720; `release_env.ts` **298**); promotion stub exists. `check_release_highlights.ts:210` warns, it does not block | `agents/roadmaps/archive/road-to-release-publication-integrity.md`; `stubs/road-to-release-placeholder-guard.md`; `src/scripts/check_release_highlights.ts:210` |
| D2 | Envelope return **0.00 % ok**, `no_message = 0` — the falsification point is registered and the rate is already read; what is open is the DROP-vs-unresolved contradiction, not the registration | `docs/CLAIMS.md:728-730`; `src/scripts/report_envelope_rate.ts` |
| D3 | Attribution unmeasurable at the claim layer: `orchestration-dispatch-net-win` still `unbacked` (`docs/CLAIMS.md:266-269`); the finalizer record itself exists only as a stub | `docs/CLAIMS.md:266-269`; `stubs/road-to-task-completion-observability.md` |
| D4 | `check_standing_rule_delivery` RED: **120,961 vs 110,000**. The preamble half of the original D4 is struck (below) | gate run at landing; `src/config/preamble-payload-budget.json:23` |
| D5 | Pack conformance **3/6** fixture-proven, 3 CI-contract-only | `archive/road-to-org-pack-fitness.md:275,552` |
| D6 | Dispatcher **43 ms fixed cost** dominates; concern-split falsified (≤3 ms of 1,186 ms); composite series **n = 0**, `observe_only` | `archive/road-to-per-turn-hook-economy-carry.md:342-352,233-251` |
| D7 | MCP fingerprint store (`src/scripts/mcp_tool_fingerprint.ts`, 241 lines) built, unbound — blocked on D6's population | source at landing; D6 provenance |
| ~~D8~~ | **STRUCK — premise false.** The draft called `dist/router.json` a passive artifact with one consumer. It has 20+ (`compile_router`, `rule_trigger_eval`, `model_rule_injection`, `check_rule_projection_integrity`, `project_thin_rules`, `router_telemetry`, `trigger_coverage`, `lint_trigger_precision`, `prepack_router_targets.mjs`, …). Its real size is **38,555 B**, not 38,111. The open question is narrower: no *runtime* consumer | grep at landing |
| D9 | Estate shape at landing: **3 active** roadmaps, 61 `later/`, 71 `stubs/`. The draft's 19-active figure and its execute-list are struck (below) | `agents/roadmaps/` at landing |
| D10 | Requirements traceability **shipped minimal, reconciliation missing**: contract fields + listing gate + ratchet landed (`check_requirements_trace.ts`); no completion-time REQ resolution | `archive/road-to-requirements-traceability-minimal.md` steps 0.1–1.3 `[x]`, step 2.1 `[-]` |
| D11 | No score contract: nothing in the tree records per-category claims, evidence classes, or status | verified absent at landing |

**On D4 — CORRECTION 2026-08-24, the strike is WITHDRAWN.** An earlier version of
this section struck D4's preamble half as fixed, on the reasoning that
`preamble-payload-budget.json` records `baseline_tokens: 102520`, "below the
107,646 ceiling the draft cited". **That comparison is invalid.** 107,646 *is*
102,520 x 1.05 — the ceiling is derived from the baseline, so comparing the two
can never fail. The figure that decides the gate is the **measured** one.

Run at 2026-08-24 on this branch:

```
  measured total    138212 tok (baseline 102520, +35692; ceiling 107646)
❌  per-spawn preamble payload grew past the ratchet: 138212 > 107646 tok.
```

**So D4 has two red halves, not one.** The preamble residual is **+30,566 over
the ceiling**, and the reviewer's "136k" is not stale-low but stale-**high**:
`stubs/standing-rule-delivery-observability.md:20` measured 137,708 -> 136,348 on
2026-08-23, and it reads 138,212 today — the diet's -1,360 has been more than
eaten back.

The strike was made by this run's own predecessor and is recorded rather than
quietly reverted, because the file already carried the instruction that would have
caught it, two lines below the strike: *run the gate rather than trust either
number in this table*. The instruction was written and not followed.

The standing-delivery half is red too and has **grown**: 120,857 in the draft,
120,961 at landing, **123,176** measured live on a two-layer checkout. Blocker
`b-standing-delivery-red` asked whether that is a real payload defect or an
ADR-236 layer-overlap artifact of one machine — **it is answerable now and the
answer is "real"**: the two-layer run prints no `overlap` line, and that line is
emitted only when `overlap_rules > 0` (`check_standing_rule_delivery.ts:307`), so
the two layers are cleanly disjoint.

Both halves are now owned by `road-to-standing-payload-truth.md`, which also
carries why neither gate stops a PR.

**On D3's struck framing.** The draft opened D3 with "0.27 % capture
(1/370 dispatches)". That is the **pre-backfill, model-carried** figure, and
`docs/CLAIMS.md:276` states in the pre-registration itself that it "may not be
cited for either direction". The mechanical replacement,
`src/scripts/hooks/orchestration_record_hook.ts`, landed 2026-08-09 in
`36e24c936` — **before this draft's own pin of 2026-08-23**. Consequence, and
it is the reason this is recorded rather than quietly edited: the synthesis
memo's C5 sequencing correction ("repair capture first, or Wave 1 inherits
n≈0") rests on an already-repaired defect. The sequencing argument does not
survive; what survives is the narrower D3 above.

## Category → closing path (deduped against the live tree)

| Category (score) | Scorecard row id | Closing path | Track |
|---|---|---|---|
| Return-contract adoption (7.5) | `return-contract-adoption` | Finalizer v2 Phases 0–2 (envelope-DROP adjudication → producer repair → multi-machine window) | W1 |
| Outcome attribution (8.0) | `outcome-attribution` | Finalizer v2 Phases 3–4 | W1 |
| Requirements traceability (8.5) | `requirements-traceability` | Extend shipped minimal mechanic with completion reconciliation — rides the finalizer record (D10); **no parallel ledger** | W1 |
| Release integrity (9.2) | `release-integrity` | Promote placeholder-guard stub; guard all 8 transitions incl. `--resume`; no historical-section scan (D1) | W1 |
| Return delivery (9.5) | `return-delivery` | `return_state` machine in finalizer record, ≥99 % known-state | W1 |
| Review independence (8.8) | `review-independence` | Council B's negative controls only (same-context reviewer, disallowed family, leaked rationale, no-provider refusal) — the roadmap the draft wanted executed is archived at 0 open | W2 |
| Pack conformance (9.5) / Negative controls (9.8) | `pack-conformance` · `negative-controls` | Classify every gate fixture-valid / contract-only / judgement; twin every fixture-valid one; contract-only rows carry written justification (D5) | W2 |
| Host semantic conformance (9.6) | `host-semantic-conformance` | Differential scenario suite over host projections: compare decisions/refusals/contracts, not text; machine-readable per-host exceptions | W2 |
| Target readiness (9.4) | `target-readiness` | Real-repo corpus on maintainer-selected heterogeneous targets; classifier authority stays blocked until the pre-registered human-corpus condition passes (its own reopening rule, preserved) | W2 |
| Council (9.5) | `council` | Outcome calibration vs single-model control from finalizer episodes; "correctly used, not frequently used". The council-evidence-integrity roadmap is archived at 0 open | W2→W3 |
| Context efficiency (8.3) | `context-efficiency` | Resolve blocker `b-standing-delivery-red` (D4 remaining half) + deep-cap accounting fields | W1 + W3 |
| Skill routing (9.2) | `skill-routing` | Frozen routing corpus (precision/recall/conflict/unnecessary-activation) + the narrowed router question: one measured *runtime* consumer default-off, or an honest-null recording that the build-time consumer set is the whole story | W3 |
| Hook/runtime economy (8.8) | `hook-runtime-economy` | Dispatcher-floor profile (spawn, bundle init, config, registry, serialization); one bounded experiment; pre-registered minimum gain; composite series n ≥ 30 as by-product; **no** concern-split revisit (D6) | W3 |
| Long-horizon execution (9.2) | `long-horizon-execution` | Finalizer + deep-cap B3 resume-from-records | W1→W4 |
| Security (9.6) | `security` | Irreversible-boundary audit (tool/MCP/network/package/publication): controls verified pre-effect or honestly labeled detection-only; fingerprint `pre_tool_use` binding gated on D6 population (D7) | W2→W3 |
| Bounded orchestration / Subagent lifecycle (9.7) | `bounded-orchestration-subagent-lifecycle` | Adversarial suite: fan-out limits, recursion, retries, timeouts, parent crash, cancellation race, duplicate return | W2 |
| Code intel (6.5) / Persistent runtime (6) / Persistent learning (6) | `code-intel` · `persistent-runtime` · `persistent-learning` | `later/road-to-ac-deep-capabilities.md` — contract + adapters + pre-registered experiment; **null routes are terminal 10-eligible** | W4 |
| Activation observability (9.7), Context discipline (9.7), Governance complexity (9.8) | `activation-observability` · `context-discipline` · `governance-complexity` | Fall out of W1 finalizer and the per-track estate offsets; no dedicated mechanism | — |

## Wave 0 — Score contract

- [x] **Step 0.1:** Adopt `road-to-score-contract.md`; seed the recoverable
      rows from the recovery source as historical baseline (D11). **Was "all 32
      rows from the external review"** — the review is not in the tree; see the
      note under § Goal.
      verify (discharged 2026-08-24): `./scripts-run src/scripts/check_score_contract`
      exits 0 (`scanned: 23`) and **six** negative-control twins are red-capable,
      each on exactly one finding code —
      `tests/fixtures/score-contract/twins/`, asserted in
      `tests/scripts/check_score_contract.test.ts`. The four the step named, plus
      `e-false-completeness` and `f-max-boundary-no-constraint`.

      **A row's `status` is not writable from this file.** A wave step appends
      evidence URIs to a row; the gate then accepts or refuses the resulting
      combination. That is what stops a closed checkbox from awarding a `ten`,
      and `check_score_contract.test.ts` asserts no roadmap step writes a
      `status:` value.

## Wave 1 — Truth spine (execute-first)

- [ ] **Step 1.2:** Promote and implement the release placeholder guard (D1).
      verify: one reject test per resumable irreversible transition; sabotage
      arm proves the test can go red; historical 14.7.0 markers do not block;
      `release.ts` size ratchet holds at 2,024 lines.
- [ ] **Step 1.3:** Adopt finalizer v2 (D2, D3, D10): envelope-DROP
      adjudication → producer repair → multi-machine ingestion →
      `episode_final` with `return_state` + REQ reconciliation.
      verify: the finalizer roadmap's AC set is citable, and blocker
      `b-envelope-drop-vs-unresolved` in that file reads `Status: resolved`
      before its Phase 2 runs.

      **First conjunct SATISFIED 2026-08-25**, and the step stays open because
      the rest of it is a different roadmap's work.
      `b-envelope-drop-vs-unresolved` now reads `Status: resolved` — and the
      resolution is worth citing here because it changes what "before its Phase 2
      runs" means: the band's population line requires `>=200 **non-local**
      stops`, every measured stop is machine-local, so the eligible population is
      zero and the band never triggered. Neither pre-registered contract was
      weakened.

      **What that leaves is `b-machine-local-denominator`**, promoted to the
      actual gate in the same change. Multi-machine ingestion is now the
      precondition for everything downstream of it — which the finalizer's own
      Step 2.3 already said, against a phase numbering that put 2.2 first. So the
      chain this step tracks is: multi-machine ingestion → producer repair →
      `episode_final`, and its head is a capability an autonomous run does not
      have (council 2/2: CI does not qualify as the second machine by replaying a
      ledger or running fixtures).
- [x] **Step 1.5:** Resolve blocker `b-standing-delivery-red` (D4 remaining
      half) — decide whether 120,961/110,000 is a real payload defect or a
      local ADR-236 layer-overlap artifact, and record which.
      verify: **the question is answered — REAL payload defect, not an overlap
      artifact — and the verify line's second branch presupposes the other
      answer.**

      The gate distinguishes the two causes itself, so no clean-checkout run was
      needed: a two-layer run prints **no `overlap` line**, and that line is
      emitted only when `overlap_rules > 0`
      (`check_standing_rule_delivery.ts:307`). The layers are cleanly disjoint,
      so the total is body length rather than duplication.

      **Re-measured 2026-08-25: `120,023 tok / 110,000 cap (109.1 %)`** —
      global 104 files / 111,193 tok, project 13 files / 8,830 tok. Note the
      direction: 120,857 in the draft → 120,961 at landing → 123,176 at the
      blocker's resolution → **120,023 today**. It came DOWN 3,153 as merged rule
      edits landed. Still 9.1 % over.

      **The verify line offers two branches and the outcome fits neither.** It
      says the gate exits 0, *or* "a recorded finding names **the overlap** and
      the gate's scope is amended". There is no overlap — that IS the finding —
      so there is no scope to amend. The clause was written assuming the overlap
      answer; recorded rather than quietly satisfied, because a reader checking
      this step against its own verify line would otherwise conclude it was not
      met. (The same shape appeared at `road-to-episode-finalizer` Step 0.1 this
      week: a verify line that pre-supposes one of the two possible answers.)

      **The reduction is not this index's work and is owned elsewhere**, per the
      blocker's own step 3: `archive/road-to-standing-payload-truth.md` carries
      the figure and its re-derivation, and
      `stubs/standing-rule-delivery-observability.md` carries the observability
      half. This step's job was to decide **which cause**, and that is decided.

## Wave 2 — Independence, conformance, adversarial proof

- [ ] **Step 2.1:** Gate classification + twins to every fixture-valid gate
      (D5 pattern, repo-wide).
      verify: every gate in `gate-coverage.yml` carries one of the three
      classifications; every fixture-valid one has a twin that turns exactly
      it red.
- [ ] **Step 2.2:** Host semantic differential suite.
      verify: the suite compares decisions/refusals/contracts, not rendered
      text; per-host exceptions are machine-readable, not prose.
- [ ] **Step 2.3:** Target-readiness real-repo corpus (classifier authority
      stays blocked per its own pre-registered condition).
      verify: the corpus targets are maintainer-selected and heterogeneous;
      the authority condition is unchanged by this step.
- [ ] **Step 2.4:** Orchestration adversarial suite.
      verify: one arm each for fan-out limit, recursion, retry, timeout,
      parent crash, cancellation race, duplicate return; each arm proven red
      by sabotage.
- [ ] **Step 2.5:** Security irreversible-boundary audit + review-independence
      negative controls.
      verify: every irreversible boundary is either guarded pre-effect or
      labelled detection-only in writing; the four independence controls each
      turn a check red.

## Wave 3 — Economy and routing (measurement-gated)

- [ ] **Step 3.1:** Dispatcher-floor profile + one bounded experiment (D6);
      composite series n ≥ 30 as a by-product.
      verify: the profile attributes the 43 ms across named components; the
      experiment's minimum gain was registered before the run.
- [ ] **Step 3.2:** Fingerprint binding decision, gated on 3.1 (D7).
      verify: the decision cites 3.1's population; an unbound outcome is
      recorded as a decision, not left as silence.
- [x] **Step 3.3:** Routing corpus + the **narrowed** router question: does
      `dist/router.json` have any *runtime* consumer, or is its 20+ consumer
      set entirely build-time?
      verify: the consumer inventory is enumerated from grep, not asserted;
      the outcome is one measured runtime consumer default-off, or an
      honest-null recording build-time-only — passive-with-implicit-promise is
      the only losing state.

      **DONE — the narrowed question is answered in the direction the step did
      not expect, and that is where its value turned out to be.**

      **A runtime consumer EXISTS.** `src/scripts/hooks/rule_inject_hook.ts:61,196`
      calls `loadRouter`, which reads `dist/router.json` at
      `src/scripts/_lib/rule_injection.ts:76-79`. The `rule-inject` concern is
      bound on **three** slots — `user_prompt_submit`, `pre_tool_use` and
      `pre_compact` (`hook_manifest.yaml:1067,1068,1086`). A literal grep for
      `router.json` does not find it: the hook never spells the filename, which
      is why the earlier "zero consumers under `src/scripts/hooks/`" measurement
      read clean.

      **It is default-off, and off means zero bytes.** The concern returns before
      reading the router unless `lean_projection.mode: delivery` is set, and the
      shipped default is `eager-all` (`_lib/lean_projection_mode.ts:21`, with
      anything unrecognised normalising to it). So the step's first permitted
      outcome — *"one measured runtime consumer default-off"* — holds on the
      mechanism half and **not** on "measured": the concern's own header records
      that its budget row is *"registered against the per-prompt cap rather than
      a measured emission: there is no measured emission to register yet."*
      Built, bound, default-off, **unmeasured**.

      **The deliverable is the contradiction, and it runs OPPOSITE to the one the
      step guarded against.** The step protects against a passive router carrying
      an implicit promise. What the tree held was **four artefacts asserting no
      runtime consumer exists**, written before one was built and never updated:

      | Artefact | The assertion | Disposition |
      |---|---|---|
      | `docs/contracts/rule-router.md:32-35` | *"zero under `src/scripts/hooks/` — no hook slot loads it, and no slot injects trigger-matched rule bodies"* | **corrected** |
      | `docs/contracts/rule-router.md:271` | *"Read this first: nothing loads `dist/router.json` at runtime."* | **corrected** — now carries the "under every shipped default" qualifier |
      | `src/scripts/check_rule_projection_integrity.ts:6-13` | a live GATE citing the above as its own rationale | **corrected** |
      | `agents/evidence/analysis/rule-payload-per-host-2026-08-10.md:66` | *"no host consumes `dist/router.json` at runtime"* | **left as written** |

      The evidence file is deliberately not rewritten. Per
      `docs/contracts/evidence-artifact-types.md`, an `analysis` *"asserts what
      was true when it was written and is never re-bound"* — it was true on
      2026-08-10, and editing it would destroy the record rather than correct it.

      The gate is the sharpest of the four: a live gate's stated reason rested on
      a premise the tree refutes. **Its conclusion survives** — with the concern
      default-off, projection IS still the only reach mechanism on a shipped
      default — but the stronger claim that no such mechanism exists does not,
      and the docblock now says so rather than being quietly reworded.

      verify, met: the consumer inventory is enumerated from grep (33 build-time
      source readers, 32 test files, 2 CI path filters, **1** runtime), not
      asserted; the outcome recorded is a runtime consumer that is default-off,
      with "unmeasured" stated rather than glossed.

      **Landed under the council's condition for taking anything out of this
      index:** it is independently valuable. Three shipped artefacts stopped
      contradicting the tree, and that stands whatever happens to the program.

- [ ] **Step 3.4:** Context accounting fields (`standing_tokens`,
      `load_frequency`, `activation_count`, `retrieval_count`, `miss_count`,
      `outcome_linked_use`, `last_reviewed`).
      verify: `outcome_linked_use` resolves against finalizer records; a field
      that cannot be populated is recorded as a host null, not defaulted to 0.

## Wave 4 — Deep capabilities behind contracts

- [ ] **Step 4.1:** `later/road-to-ac-deep-capabilities.md` activates on its
      entry condition. Order inside: code-intel contract → durable runtime →
      optional swarm experiment → learning store → guarded promotion. Every
      null is terminal.
      verify: all three conjuncts of that file's `entry_condition` are
      independently checkable and each reads true before any workstream opens.

## Wave 5 — Frozen proof window (stub until W2 exists)

- [ ] **Step 5.1:** Park as a stub now — freezing feature work today would
      block the queue. Entry condition: Waves 0–2 complete. Then:
      representative corpus across hosts, backends, stacks, risk classes,
      horizons, failure injections, council/no-council and
      code-intel/text-only controls; per-category evidence published;
      the verifier — not prose — flips rows to `ten`.
      verify: final acceptance is all rows `ten`, `measured-null`, or
      `max-boundary`; no former 10 regressed; measured nulls preserved
      verbatim; default local install still needs no external service.

## Blockers

### blocker: b-standing-delivery-red
- **Status:** resolved
- **Resolution (2026-08-24, `/analyze:inbox`):** step 2 answered — **the overage
  is real, not an ADR-236 overlap artifact**, and the gate distinguishes the two
  causes itself so no clean-checkout run was needed. A two-layer run prints
  **no `overlap` line**, and that line is emitted only when `overlap_rules > 0`
  (`check_standing_rule_delivery.ts:307`), so the two layers are cleanly disjoint.
  The figure has also **grown**: 120,857 in the draft, 120,961 at landing,
  **123,176** measured live. Per step 3's own instruction the overage is therefore
  a payload defect and belongs in a reduction roadmap rather than in this index —
  it is now owned by `road-to-standing-payload-truth.md` (phase 1.4 and AC-6),
  together with the second red gate this index wrongly struck (see § On D4)
- **Owner:** council
- **Blocks:** Wave 1 Step 1.5, and the Context-efficiency row of the
  category table.
- **What to do:**
  1. Run `./scripts-run src/scripts/check_standing_rule_delivery` and record
     the current figure (120,961 vs 110,000 at landing).
  2. Determine whether the overage is real standing payload or an artifact of
     ADR-236 layer overlap on a local install — the archived diet roadmap
     declared this gate out of scope for exactly that reason, which is why
     draining the diet did not turn it green.
  3. If overlap: amend the gate's scope in the same change that records the
     finding. If real: the overage is a payload defect and belongs in a
     reduction roadmap, not in this index.
- **Recommendation:** Measure first on a clean checkout with no global rule
  install, since a global install is the known way this figure inflates
  locally. A clean-checkout reading is the only one that distinguishes the two
  causes.
- **If you do nothing:** The Context-efficiency row cannot close in either
  direction — it is neither a proven defect nor a cleared gate, and the
  scorecard has no legal status for "we did not look".
- **Resolved when:** Either the gate exits 0, or a recorded finding names the
  ADR-236 overlap as the cause and the gate's scope is amended in the same
  change.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The index re-accumulates dead defects | product | Five of eleven inventoried defects were dead within a day of the pin. An index whose Context is a snapshot decays faster than the work it points at, and a stale defect row reads as a live obligation. | Every defect row carries its provenance path; struck ids stay struck with the reason inline rather than being renumbered away, so a reader can see the decay rather than inherit it. | Context — defect inventory, re-measured at landing (HEAD `0f7c26ee9`) |
| 2 | Program file becomes a god-roadmap / merge hotspot | implementation | A file that indexes every track is touched by every track. | Owns zero progress state; each wave step points at a track roadmap or a scorecard row rather than holding state. | Wave 0 — Score contract |
| 3 | Score pressure reopens null-closed rows | product | A row closed as `measured-null` or `max-boundary` is reopened because a later reviewer dislikes the number, not because new evidence arrived. | The score contract records the pre-registered criterion alongside the null; reopening requires a new claim, not a new opinion. | Goal |
| 4 | A struck defect is re-added by the next synthesis | product | The next external review re-derives D8's passive-router premise from the same grep the draft used, because nothing in the tree records why it was struck. | The struck D8 row states the 20+ consumer set and the corrected byte count inline; Step 3.3 carries the narrowed question so the surviving part is not lost with the false part. | Context — defect inventory, re-measured at landing (HEAD `0f7c26ee9`) |
| 5 | Estate growth from this synthesis | implementation | Three roadmaps added to a 3-active estate is a doubling, and the offsets this run could use were all `status: draft` and therefore never counted. | `estate_offset_exempt` states the unavailability rather than dodging it; Wave 5 parks as a stub rather than as a fourth file; the deep-capabilities file is parked in `later/`. | Wave 5 — Frozen proof window (stub until W2 exists) |
| 6 | Sequencing rests on a repaired defect | implementation | The draft's C5 correction ordered Wave 1 behind a capture repair that had already shipped 14 days before the pin. Acting on it would have deferred the whole spine for nothing. | The struck-D3 note records the mechanical replacement and its commit; Step 1.3 sequences on the envelope adjudication instead, which is genuinely open. | Context — defect inventory, re-measured at landing (HEAD `0f7c26ee9`) |

## Acceptance Criteria

- [ ] AC-1 — Every rubric category **in the declared manifest** has a scorecard
      row reading `ten`, `measured-null`, or `max-boundary`, each with its
      evidence classes resolvable. **Cannot read "every rubric category" while
      nine identities are unknown** — an AC over a set the tree does not hold is
      unsatisfiable rather than strict. Closing the manifest is a prerequisite,
      recorded under § Goal.
- [ ] AC-2 — No category previously at 10 (runtime simplicity, portability,
      security, governance complexity, context discipline) has regressed;
      proven by the non-regression evidence class, not by assertion.
- [ ] AC-3 — No mechanism landed under this program exists solely to satisfy a
      rubric row; every one has a named consumer or a recorded null.
- [ ] AC-4 — Every measured null is preserved verbatim with its
      pre-registered criterion; none was rewritten after its number was read.
- [ ] AC-5 — A default local install still requires no external service.
- [x] AC-6 — Blocker `b-standing-delivery-red` reads `Status: resolved`.

      **Met, and it was met before this run touched the file** — line 302, since
      2026-08-24. Ticking it records an observed fact; leaving it unticked was
      stale bookkeeping rather than caution. AI council 2026-08-26, 2/2, was
      explicit that recording a satisfied AC is not the same act as claiming
      program progress, and that the parked-state marker is what prevents the
      second reading.

## Corrections applied at landing (2026-08-24)

| What | Was | Now | Why |
|---|---|---|---|
| Wave 1.1 | "Drain `road-to-standing-payload-diet` (D4)" as an executable step | Deleted | `agents/roadmaps/archive/road-to-standing-payload-diet.md` is archived at 18 done / 0 open. Already shipped. |
| Wave 1.4 | "Drain `road-to-review-independence` and `road-to-council-evidence-integrity` (D9) in parallel" | Deleted; the surviving negative-control work folded into Step 2.5 | Both are archived at 0 open. Already shipped. |
| D2 wording | "next-gate parked on ≥95 %/≥500 with **no intermediate falsification point**" | The falsification point is registered; D2 narrowed to the DROP-vs-unresolved contradiction | `claim:subagent-valid-envelope-rate` was registered 2026-08-22 in `docs/CLAIMS.md:728-730`, threshold "greater than zero and rising" — deliberately not a percentage, for the reason the claim states. Already shipped. |
| D3 framing | "retrospective sibling HONEST NULL at **0.27 % capture (1/370 dispatches)**" as the live capture rate | Struck; D3 narrowed to the unbacked claim plus the stub-only finalizer | 0.27 % is the pre-backfill, model-carried figure, and `docs/CLAIMS.md:276` says it "may not be cited for either direction". The mechanical replacement `src/scripts/hooks/orchestration_record_hook.ts` landed 2026-08-09 (`36e24c936`), BEFORE this draft's own pin. **Consequence:** the synthesis memo's C5 sequencing correction ("repair capture first or Wave 1 inherits n≈0") rests on an already-repaired defect and does not survive. |
| D8 | "Router passive: `dist/router.json` (38,111 B) consumed only by `complexity_report.ts:300,307`" | Struck entirely; premise false | `dist/router.json` has 20+ consumers — `compile_router`, `rule_trigger_eval`, `model_rule_injection`, `check_rule_projection_integrity`, `project_thin_rules`, `router_telemetry`, `trigger_coverage`, `lint_trigger_precision`, `prepack_router_targets.mjs`, and more. Not one. |
| Wave 3.3 | "Router corpus + D8 decision" — no consumer | Re-scoped to "no *runtime* consumer", with the enumerated build-time set named | The surviving question is narrower than the struck premise and would have been lost with it. |
| D9 | "19 active roadmaps (13 `ready` / 6 `draft`), 61 `later/`" plus an execute-list | Rewritten: **3 active**, 61 `later/`, 71 `stubs/` at landing; every `**Execute** X (ready)` cell in the category table removed | Six of the roadmaps the draft planned to execute are archived at 0 open. Measured at landing, not at the pin. **Brief mismatch, stated plainly:** the landing brief said 2 active / 61 later / 69 stubs; `ls` at landing counts 3 / 61 / 71. The measured figures are used. |
| D4 preamble half | "**135,436 vs 107,646** tok" red | Struck | `src/config/preamble-payload-budget.json:23` records `baseline_tokens: 102520`, below the 107,646 ceiling the draft cited. Honesty note kept inline: that file's own registration note records a measured total ~23k above the baseline, so run the gate rather than trust either number. |
| D4 standing half | "120,857 vs 110,000 (109.9 %); repair roadmap `ready`, unexecuted" | Kept, figure corrected to **120,961 vs 110,000**; blocker `b-standing-delivery-red` added | The repair roadmap is archived, and it declared this gate **out of scope** for an ADR-236 layer-overlap reason — which is why draining it did not close the gate. Whether the overage is real or a local overlap artifact is undetermined. |
| `release.ts` line count | 2,029 | **2,024** | `wc -l` at landing. |
| `release_env.ts` line count | 238 | **298** | `wc -l` at landing. |
| `router.json` size | 38,111 B | **38,555 B** | `wc -c` at landing. |
| D1 provenance | Publication-guard blocker cited without the warn-vs-block distinction | `check_release_highlights.ts:210` named explicitly as warn-only | The distinction is the defect: a warning is not a guard. |
| Goal terminal states | "`ten` or `measured-null`" | "`ten`, `measured-null`, or `max-boundary`" | Follows the six-value status enum landed in `road-to-score-contract.md` Phase 0.1. |
| Risk table shape | `## Risks`, two columns | `## Risk Register`, six-column house grammar with the `risk-review` marker | `src/scripts/lint_plan_risk_register.ts:212`; `Risk type` admits only `product` or `implementation` (`:288-293`). |
| Missing house sections | No `## Blockers`, no `## Acceptance Criteria`, no Source line; waves carried `verify:` on some steps only | All present; every step is a single `- [ ]` carrying its own `verify:` line (the draft packed 2.1–2.5 and 3.1–3.4 into one checkbox each) | House roadmap contract. |
| Frontmatter | No `estate_offset_exempt` | Added, with the offset-unavailability reason stated | Every added roadmap in this run carries the exemption. |
