---
complexity: structural
status: ready
parent_roadmap: road-to-orchestration-scope-decision
---

# Road to orchestrator-first execution — make the gate clear, measure what already happened, then decide whether "orchestrate everything" survives contact with the numbers

> **Operator directive (2026-08-07):** the main session agent should be an
> orchestrator only — decompose, dispatch, verify, synthesise — and not carry
> out execution work itself. Open sub-question from the same directive:
> *"maybe subagents work without rules at all, with the main agent supervising
> that they keep to all of it?"*
>
> This roadmap does not treat that as settled or as refused. It splits it into
> the two independent questions it actually contains, notes that one of them is
> already answered by measurement and the other has never been measured at all,
> and sequences the work so the unanswered half becomes answerable at zero
> token cost before anything is built on top of it.

## Goal

Turn "the main agent orchestrates only" from a posture into a decidable
question, and decide it: make the activation gate actually clear on this host,
backfill the orchestration telemetry that 369 real dispatches already produced
but never recorded, run the pre-registered `orchestration-dispatch-net-win`
claim against it per dispatch-family, and ship the mandatory-delegation mode
**only** for the families where the numbers hold — recording an honest null and
keeping in-session execution for the rest.

## Context (measured this session — do not relitigate)

### The two questions the directive conflates

The council's sharpest finding: **rule-surface size and delegation routing are
orthogonal axes**, and the directive couples them.

- **Content axis — already answered, empirically.** Rule-free workers ship
  today. `.claude/agents/production-validator.md` carries *zero* rule content;
  governance reaches it as a generated **5-clause, ~1,100-char floor** derived
  from `KERNEL_RULE_IDS`, drift-gated, in the cache-stable prefix of all eight
  dispatch templates. The benchmark says small-and-selected beats large:
  `rules-kernel-dc` (30,698 chars) → **+0.458, p=0.0135**, while
  `rules-balanced` (98,825 chars) → **−0.042, p=0.81, null**. The rule-free
  `production-validator` returned the correct verdict on both fixtures at
  **~45k fewer tokens**. *Content selection beats size.* This half of the
  directive needs no new work — it is the shipped design.
- **Routing axis — never measured.** Whether *mandatory* delegation beats
  in-session execution has exactly **one** datapoint, and it is a loss:
  `token_delta: +1,087,078` (2026-07-28, `provenance: estimated`, n=1).

### The gate does not clear on this host

There is **no host registry file anywhere in the repo**. `subagent_spawn`
resolution is delegated to "the agent's own knowledge of the current host" —
an LLM-behavioural step with no deterministic backing. The normalizer safe-
defaults **all-false** (`src/scripts/_lib/host_capability.ts:26-37`, strict
`value === true` coercion), and this repo sets no `subagents.host_capabilities`
override. So `auto_dispatch.ts:64` returns
`inSession('host has no subagent_spawn primitive')` — on a host that
demonstrably has the primitive. `subagents.auto: "on"` is set and inert.

Consequence, and it is the reason the council called the directive's premise
trivially true today: *"irreducible core never delegates" is trivially true
because nothing delegates.*

### What `classifyTask` will and will not delegate

Even with the gate fixed, `classifyTask` (`src/scripts/_lib/auto_dispatch.ts`)
delegates only on an enumerated signal: `parallelizable: steps|files|
independent`, or `ordered_plan: true`, or `independent_slices >= 2`, above
`SIZE_FLOOR = 1`. **A single deep task never delegates** — it falls through to
`inSession('no enumerated delegable signal matched')`. "Orchestrator-only" is
therefore not a settings value over the current classifier; it requires a new
action class for the single-slice case. That is a semantic change, not a flip.

### The telemetry blocker is an instrumentation defect, not a usage defect

Two active roadmaps are blocked on *"≥20 orchestration lines in the current
month"*, with the stated remedy "use the agent on real delegable work". The
current month (`agents/runtime/state/audit/2026-08.jsonl`) holds **zero** lines;
the only file ever written holds one.

Measured this session against the host transcript corpus for this repo
(103 sessions, 2026-07-08 → 2026-08-07):

- **369 `Agent` tool invocations.** Real delegation has been happening
  continuously for a month.
- **1 `orchestration_record` line.** `orchestration_record` is model-carried
  and nobody runs it — capture rate ≈ **0.3%**.
- Each `Agent` tool result carries **`resolvedModel`, `totalTokens`,
  `totalDurationMs`, `totalToolUseCount`, and a full `usage` breakdown** —
  i.e. the orchestrated-side cost is *already measured*, per dispatch, 369
  times over, on disk.

The blocker's remedy ("use the agent more") has been satisfied 369 times and
produced nothing, because it addressed the wrong layer. The gate is reachable
**retrospectively, deterministically, at zero token cost**.

### Honest limit on what the backfill can prove

`totalTokens` measures the **orchestrated** side. The counterfactual — what the
same task would have cost in-session — is *not* on disk and is not measured by
anything. So the backfill yields a measured cost-of-delegation and a *stated-
method* baseline, never a fully measured `token_delta`. The existing schema
already carries this distinction (`token_delta_provenance: measured |
estimated`); Phase 1 must not launder one into the other. This is the same
discipline that made the single 2026-07-28 line explicitly not count.

### Constraints that bind this work

- **ADR-133 freeze** — no new large subsystem while any unblock condition is
  open. Wiring the already-written, already-tested, zero-caller `_lib`
  functions and adding a hook concern that appends to an existing audit stream
  is **consolidation of existing surfaces**, explicitly allowed. Both council
  members concurred. Building a dispatcher runtime would not be.
- **The L0 lookup rung is a hard floor above any force mode.** Live evidence
  (2026-07-28): four `general-purpose` workers burned **~1.21M tokens** on four
  lookup tasks a deterministic primitive answers for <1k each. Mandatory
  delegation without L0 in front of it reproduces exactly that. L0 is never
  subordinated to the posture.
- **Nothing deterministic inspects a return.** `SubagentStop` appears nowhere
  in the tree and is absent from the claude native-event alias table
  (`src/scripts/hook_manifest.yaml`). `validateResponse` exists and is unwired.
  Only three gates are `fail_closed` and reach a worker at all
  (`block-no-verify`, `block-unauthorized-git`, `block-kernel-rule-writes`);
  caller-agnosticism is a tested property. The Hard Floor
  `non-destructive-by-default` itself declares `enforced_by: none`.
- **A measured composition hole.** Spike S0.2: 2 of 2 gated outcomes were
  reachable by composing individually-allowed steps. Published still-open:
  `mv` / `chmod` / `rm` against `.git/hooks/*`. This is precisely the
  "orchestrator delegates to rule-free workers" failure shape, and mandatory
  delegation multiplies its exposure.
- **ADR-118** keeps the demotion path a manual human edit. Nothing here
  automates a default flip in either direction.

## Council convergence (2026-08-07, anthropic/claude-sonnet-4-5 + openai/gpt-4o)

Two runs. The first (deep, 3 rounds) is **not** counted as convergence — the
Anthropic member hit the 290 s `--max-time` ceiling and returned zero bytes,
leaving a single-voice result whose text referenced peers that had not
responded. Re-run at standard depth, 2 rounds, both members present, $0.065.

**Converged:**

1. The directive conflates two orthogonal axes. The content axis (rule-free
   workers) is closed by measurement; the routing axis (mandatory delegation)
   is open with n=1 and that datapoint is a loss. Deciding them together is a
   planning error.
2. The host-capability gate must be fixed first — it is a precondition for any
   evidence at all, and both members flagged its omission from round 1.
3. The stopping rule is pre-registered **before** any building, not after the
   numbers land.
4. Wiring the `_lib` functions and adding a `SubagentStop` concern is
   consolidation under ADR-133, not a new subsystem.
5. The supervision actually missing is **not** "did the subagent obey the
   rules" — the three fail-closed gates are caller-agnostic and already cover
   that. It is **"should this have been delegated at all"**, which is a
   *classification* question, not a verification question.
6. Falsifiability belongs **per dispatch-family**, not aggregate. The
   pre-registered claim treats eight templates as one hypothesis while the
   benchmark shows role-specific lift.
7. Read-only slices: the ~1,100-char floor is the right level. Mutating slices:
   floor plus two projected gates (~1,700 chars total).

**Diverged, recorded rather than smoothed:**

- **claude-sonnet-4-5** — run the diagnostic *before* any wiring: mechanising
  return-path verification "adds zero bytes of evidence about whether task
  decomposition actually reduces cost", and wiring first means "mechanising a
  loss-making decision path".
- **gpt-4o** — mechanise deterministic validation *before* widening delegation
  at all; relying on model-carried supervision in an operator-scoped mode
  "underestimates the risks".

**How this roadmap resolves the divergence.** Phase 1 creates *no new
delegation volume* — it reads logs that already exist. It therefore satisfies
sonnet's diagnostic-first ordering without contradicting gpt-4o, whose concern
binds on *added* volume. Mechanisation (gpt-4o's demand) is made a hard
precondition of Phase 4, which is the first phase that raises delegation
volume. Neither member is overruled.

**Superseded by evidence they did not have.** Sonnet proposed a *hypothetical*
cost model — reconstructing what delegation would have cost — because it
assumed no measured subagent cost existed. It does: 369 dispatches carry
`totalTokens` on disk. Phase 1 uses the measurement instead of the model.

**Flagged as a category error, not adopted here.** Sonnet argued ADR-117's
"bounded downside" framing was wrong (orchestration overhead is itself a harm)
and called it "a sunk cost to write off". Re-opening an accepted ADR is a
maintainer decision, not a roadmap step; it is recorded here and left to the
gate in Phase 2, which can reach the same conclusion on evidence.

## Phase 0 — Make the gate clear, and pre-register the stopping rule

- [x] Add a `subagents.host_capabilities` override for this host in the
      project-local settings, declaring the primitives the host actually has.
      Record which fields are set `true` and the observation each rests on —
      the manifest has no registry to appeal to, so the override *is* the
      evidence. Confirm afterwards that the classifier no longer short-circuits
      on `host has no subagent_spawn primitive`.
      <!-- done 2026-08-07: override written to the gitignored project-local
      `.agent-settings.yml` (not in this PR by construction). Set true only
      where observed this session: `subagent_spawn` (three Agent dispatches
      returned results) and `parallel_spawn` (they ran concurrently from one
      tool-call block). `status_polling` + `separate_quota_pool` left false —
      not observed for subagents; under-claiming is the safe direction under an
      all-false default. VERIFIED against the real libs: manifest resolves
      {subagent_spawn:true, parallel_spawn:true, …}; classifyTask now returns
      dispatch/do-in-parallel on a files-fanout and dispatch/do-in-steps on an
      ordered plan, where both previously returned `host has no subagent_spawn
      primitive`. The single-slice case still returns in-session ("no
      enumerated delegable signal matched") — confirming Phase 3's premise that
      orchestrator-only is a classifier change, not a settings flip. -->


- [x] Write the stopping rule into `docs/CLAIMS.md` against the existing
      `orchestration-dispatch-net-win` entry, **before** any measurement is
      read. It must be falsifiable and per-family, and must name both
      directions: what result confirms the family, and what result drops it.
      Reuse `check_quality_regression.ts` thresholds for "held quality" so a
      token win that degrades output cannot pass.
      <!-- done 2026-08-07: landed as the SIBLING entry
      `orchestration-observed-dispatch-cost`, not as an edit to the existing
      one. Rationale: `orchestration-dispatch-net-win` is pre-registered
      against a PROSPECTIVE two-arm corpus run over orch-02/orch-03; the
      backfill measures the RETROSPECTIVE population of dispatches that
      already happened. Editing a pre-registered entry to cover a different
      population is the goalpost-move that entry exists to forbid, so the
      original is left byte-untouched and the two are cross-referenced.
      Per-family (4 families), thresholds PROVE ≥15% / DROP median>0 /
      INDETERMINATE between, held quality via check_quality_regression.ts.
      `check_claims` green: 50 entries, 8 unbacked inventory. -->
- [x] Record the negative case explicitly: if the honest outcome is
      "orchestration costs more", the pre-registered consequence is a renewed
      null plus demotion of the orchestration surface from the public value
      proposition — not a re-scoped claim invented after the fact.
      <!-- done 2026-08-07: falsification criterion (4) of the same entry, which
      also pre-registers cancelling Phases 3–4 as `[-]` on that outcome. The
      negative direction carries the same force as the positive by
      construction, and criterion (3) makes INDETERMINATE explicitly not a
      pass — closing the "between the thresholds, call it a win" escape. -->



**Exit:** the classifier reaches its delegable-signal rules on this host; a
per-family, two-directional stopping rule is committed to CLAIMS before any
number is read.
**Rollback:** remove the override (returns to the all-false safe default);
delete the CLAIMS line.

## Phase 1 — Backfill the telemetry that 369 dispatches already produced

- [x] Build a deterministic extractor over the host transcript corpus for this
      repo that emits one `orchestration_record`-shaped line per historical
      `Agent` dispatch, sourcing `resolvedModel` → tier, `totalTokens` →
      orchestrated cost, `totalDurationMs` → `wall_clock_ms`, and
      `totalToolUseCount`. Read-only against the corpus; it must never mutate a
      transcript.
      <!-- done 2026-08-07: `src/scripts/orchestration_backfill.ts`. Ran over
      103 sessions, 0 unparseable lines, 370 dispatches paired. CORRECTION TO
      THE ROADMAP'S OWN PREMISE, found by running it: only SYNCHRONOUS
      dispatches carry cost. 326 of 370 are async launch acknowledgements
      (`isAsync: true`, `status: async_launched`) whose completion never writes
      cost back into the parent transcript. Measured-cost population is
      therefore **39, not 370** — a cost-coverage ratio of 0.105. The script
      reports both counts; emitting 370 lines of which 331 carry a null cost
      would have inflated n against a gate that counts lines. -->
- [x] Classify each extracted dispatch into a **dispatch-family** (read-only
      fan-out, ordered steps, competitive, verdict/judge) from the recorded
      prompt shape, and carry the family on the line. Per-family is the unit
      the stopping rule is written against; an aggregate backfill cannot
      resolve it.
      <!-- done 2026-08-07: `classifyFamily()` matches on observable fields
      only and returns `unclassified` when no enumerated signal fires — the
      same discipline `classifyTask` applies, and the reason the split stays
      meaningful. Measured split: read-only-fanout n=15 (median 113,245 tok),
      verdict-judge n=20 (median 164,018 tok), ordered-steps n=1
      (UNDERPOWERED), unclassified n=3 (UNDERPOWERED), competitive n=0 —
      the competitive family is ABSENT from a month of production, which is
      itself a finding about which dispatch modes are real here. -->
- [x] Set `token_delta_provenance` honestly per line: the orchestrated side is
      `measured`; any baseline comparison is `estimated` with its method named
      on the line. Do not emit a `measured` `token_delta` the corpus cannot
      support.
      <!-- done 2026-08-07: each line carries `cost_provenance: measured|absent`
      and NO `token_delta` at all. The extractor refuses to compute one: the
      in-session counterfactual is not on disk, so any delta would be a
      synthesised number wearing a measured stamp — precisely what claim
      criterion (2) forbids. The refusal is stated in the emitted
      `baseline_note` so a downstream reader cannot mistake its absence for an
      oversight. Artifacts: `internal/bench/orchestration/backfill-2026-08-07.jsonl`
      (39 measured lines) + `.summary.json`. -->


- [x] Report the capture-rate finding as its own datapoint: 369 dispatches
      against 1 recorded line means the model-carried emit step is the binding
      constraint on this instrument, and the ≥20-line blocker on both parent
      roadmaps was never a usage problem.
      <!-- done 2026-08-07: `internal/bench/orchestration/backfill-2026-08-07.md`.
      Exact figure is 370 paired dispatches (the roadmap's 369 was a grep
      count; the parser's is authoritative) against 1 recorded line = 0.27%
      capture. A model-carried emit step firing 0.27% of the time does not
      reach 20 lines by being asked to try harder — this is the measured
      argument for Phase 4's SubagentStop move. SECOND FINDING, not in the
      plan: 27 of 39 metric-bearing dispatches resolved to an Opus tier and
      only 1 to Haiku, so `downshift` — the mechanism the operator's own cost
      thesis rests on — was NOT operating during the window. `resolveSubagentRouting`
      has zero production callers; tier selection was model-carried and it
      selected UP. -->


- [x] Re-check both blocked roadmaps' blockers against the backfilled log and
      record whether each is now resolvable, deferring the actual resolution to
      their own files rather than editing them from here.
      <!-- done 2026-08-07, re-checked live against both files; NEITHER edited
      from here. `road-to-orchestration-scope-decision` / `real-orchestration-usage`:
      resolvable IN SUBSTANCE — 39 measured dispatch lines exist against a
      ≥20 bar. Not resolvable BY THE LETTER: the blocker names
      `agents/runtime/state/audit/YYYY-MM.jsonl` "for the current month", and
      these lines span 2026-07-08→08-07. Writing them into `2026-08.jsonl`
      would misdate July dispatches into August and contaminate a sample the
      `origin: lean-init-2026` precedent deliberately segregates — so they were
      written to `internal/bench/orchestration/` instead. Accepting backfilled
      historical lines in place of current-month lines is a maintainer call on
      that roadmap, not mine to make from here.
      `road-to-subagent-value-realization-followup` / `telemetry-sample-size`:
      PARTIALLY resolvable — the sample-size half is met, but its Phase 1
      Step 2 asks for a TWO-ARM run (`agent-settings.orchestrated.yml` vs
      `agent-settings.baseline.yml`) and the corpus contains only the
      orchestrated arm. Its Phase 2 `gateVerdict()` needs a baseline the
      transcripts do not hold. That half stays genuinely open. -->



**Exit:** a backfilled audit log carrying per-family, provenance-honest lines
from real historical dispatches, in a quantity that clears the ≥20 gate by a
wide margin; the capture-rate defect recorded as a finding.
**Rollback:** delete the backfilled lines; the extractor is read-only, so the
corpus is untouched either way.

## Phase 2 — Gate the claim per family: prove or drop

- [x] Feed the backfilled telemetry through `gateVerdict()` /
      `resolveShippedDefault()`, **per dispatch-family**, against the stopping
      rule written in Phase 0.
      <!-- done 2026-08-07: ran the real gate per family under both defensible
      baseline methods (A overhead-bound, B context-displacement). EVERY family
      flips fail↔pass between them, and `resolveShippedDefault` flips ask↔on
      with it. `gateVerdict` takes exactly two inputs and BOTH are unmeasurable
      from this corpus: `net_win` needs a counterfactual that is not on disk,
      and `quality_held` needs paired outputs a single-arm corpus cannot
      supply. The gate was not passed or failed — it could not be run on real
      inputs, which is itself the finding. -->
- [x] For each family, record the outcome as one of exactly two states —
      proven for that family, or an honest null for that family. No middle
      state, no family left ambiguous, no threshold adjusted after the fact.
      <!-- done 2026-08-07: all four families INDETERMINATE per criterion (2)
      (verdict flips on baseline method) → none proven. verdict-judge n=20 and
      read-only-fanout n=15 were reportable and still could not be resolved;
      ordered-steps n=1 and unclassified n=3 were UNDERPOWERED and were not
      merged to reach n. `competitive` n=0 — absent from a month of
      production. No threshold was touched after the numbers landed. -->
- [x] Where a family proves out, mark the CLAIMS entry `backed` **scoped to
      that family** with a resolving pointer. Where it does not, record the
      renewed null.
      <!-- done 2026-08-07: no family proved out, so nothing was marked
      `backed`. `orchestration-observed-dispatch-cost` → `resolved-null`,
      pointer `internal/bench/orchestration/backfill-2026-08-07-verdict.md#honest null`.
      `check_claims` green: 50 entries, unbacked inventory 8 → 7. The sibling
      `orchestration-dispatch-net-win` is left byte-untouched — it binds a
      different (prospective, two-arm) population and this run says nothing
      about it. -->
- [x] If **no** family proves out: stop here. Record the null, leave
      `subagents.auto` where the maintainer decides via ADR-117's retained
      manual demotion path, and do not proceed to Phase 3. A roadmap that
      cannot fail is not a plan.
      <!-- done 2026-08-07: FIRED. The run stops here by its own pre-registered
      rule. `subagents.auto` left exactly as the maintainer set it ("on") —
      ADR-118 keeps demotion a manual human edit and nothing here automates it.
      The public-value-proposition demotion named in criterion (4) is NOT
      executed from this roadmap: `road-to-orchestration-scope-decision`
      Phase 3 already owns that action, and reaching into another roadmap's
      phase is the scope creep this file was written against. Condition
      recorded, edit deferred there — same boundary Phase 1 Step 5 held. -->



**Exit:** every dispatch-family resolved to proven-or-null against a rule
written before the numbers were read.
**Rollback:** none — measurement and recording only.

## Phase 3 — Only for proven families: the orchestrator-first mode

- [-] Define the **irreducible core** the orchestrator never delegates, as a
      negative boundary in the subagent-boundary contract: safety and
      Hard-Floor verdicts, parsing what the user actually asked for,
      verification of returns, synthesis of the answer, and the conversation
      with the user. Without this, "orchestrate everything" degrades into a
      relay with nobody accountable.
      <!-- cancelled 2026-08-07 by the Phase-2 stopping rule, pre-registered in `orchestration-observed-dispatch-cost` criterion (4) BEFORE any number was read: no dispatch-family proved out, so the orchestrator-first mode is not built on this evidence. Not abandoned — re-openable the moment a baseline arm exists (`road-to-subagent-value-realization-followup` Phase 1 Step 2). -->

- [-] Extend the classifier with the single-slice case that the enumerated
      signals currently drop to in-session, scoped to proven families only.
      This is the semantic change the directive actually requires; it is not a
      settings value over today's classifier.
      <!-- cancelled 2026-08-07 by the Phase-2 stopping rule, pre-registered in `orchestration-observed-dispatch-cost` criterion (4) BEFORE any number was read: no dispatch-family proved out, so the orchestrator-first mode is not built on this evidence. Not abandoned — re-openable the moment a baseline arm exists (`road-to-subagent-value-realization-followup` Phase 1 Step 2). -->

- [-] Keep the L0 lookup rung strictly in front of the new action class — a
      lookup-shaped task routes to a deterministic primitive and never spawns,
      regardless of posture. Cite the ~1.21M-token evidence in the code path so
      a later reader cannot mistake it for an optimisation.
      <!-- cancelled 2026-08-07 by the Phase-2 stopping rule, pre-registered in `orchestration-observed-dispatch-cost` criterion (4) BEFORE any number was read: no dispatch-family proved out, so the orchestrator-first mode is not built on this evidence. Not abandoned — re-openable the moment a baseline arm exists (`road-to-subagent-value-realization-followup` Phase 1 Step 2). -->

- [-] Add the operator-scoped mode itself (a `force`-shaped value, session-
      scoped like every other `subagents.*` key), defaulting off, with the
      shipped default untouched. The maintainer opts in; the package does not.
      <!-- cancelled 2026-08-07 by the Phase-2 stopping rule, pre-registered in `orchestration-observed-dispatch-cost` criterion (4) BEFORE any number was read: no dispatch-family proved out, so the orchestrator-first mode is not built on this evidence. Not abandoned — re-openable the moment a baseline arm exists (`road-to-subagent-value-realization-followup` Phase 1 Step 2). -->

- [-] Leave read-only slices on the ~1,100-char floor unchanged — the content
      axis is closed and re-opening it would spend tokens against a measured
      null.
      <!-- cancelled 2026-08-07 by the Phase-2 stopping rule, pre-registered in `orchestration-observed-dispatch-cost` criterion (4) BEFORE any number was read: no dispatch-family proved out, so the orchestrator-first mode is not built on this evidence. Not abandoned — re-openable the moment a baseline arm exists (`road-to-subagent-value-realization-followup` Phase 1 Step 2). -->


**Exit:** mandatory delegation available as an opt-in operator mode, bounded to
families that proved out, with the irreducible core written down and L0 in
front of it.
**Rollback:** the mode is off by default and session-scoped; unsetting it
restores the current behaviour with no migration.

## Phase 4 — Mechanise supervision before volume rises

Precondition: Phase 3 landed. This phase is gpt-4o's condition, and it binds
before the mode is used in anger rather than before it is written.

- [-] Wire `validateResponse` into the return path so a malformed or
      out-of-contract envelope is rejected deterministically instead of being
      adopted on the orchestrator's judgement.
      <!-- cancelled 2026-08-07 by the Phase-2 stopping rule, pre-registered in `orchestration-observed-dispatch-cost` criterion (4) BEFORE any number was read: no dispatch-family proved out, so the orchestrator-first mode is not built on this evidence. Not abandoned — re-openable the moment a baseline arm exists (`road-to-subagent-value-realization-followup` Phase 1 Step 2). -->

- [-] Add a `SubagentStop` concern: the event is absent from the claude native-
      event alias table and from the dispatcher, so this is a vocabulary entry
      plus a concern that appends to the existing audit stream — consolidation,
      per the council's ADR-133 reading.
      <!-- cancelled 2026-08-07 by the Phase-2 stopping rule, pre-registered in `orchestration-observed-dispatch-cost` criterion (4) BEFORE any number was read: no dispatch-family proved out, so the orchestrator-first mode is not built on this evidence. Not abandoned — re-openable the moment a baseline arm exists (`road-to-subagent-value-realization-followup` Phase 1 Step 2). -->

- [-] Emit the `orchestration_record` line from that concern rather than from
      model-carried prose. Phase 1's capture-rate finding is the argument: the
      model-carried emit step captured 0.3% of real dispatches over a month.
      <!-- cancelled 2026-08-07 by the Phase-2 stopping rule, pre-registered in `orchestration-observed-dispatch-cost` criterion (4) BEFORE any number was read: no dispatch-family proved out, so the orchestrator-first mode is not built on this evidence. Not abandoned — re-openable the moment a baseline arm exists (`road-to-subagent-value-realization-followup` Phase 1 Step 2). -->

- [-] Close the published composition hole (`mv` / `chmod` / `rm` against
      `.git/hooks/*`) before mandatory delegation multiplies the number of
      actors that can reach it. Verify against the S0.2 shape — a gate that
      judges the shape of one action and not its effect is the defect being
      fixed.
      <!-- cancelled 2026-08-07 by the Phase-2 stopping rule, pre-registered in `orchestration-observed-dispatch-cost` criterion (4) BEFORE any number was read: no dispatch-family proved out, so the orchestrator-first mode is not built on this evidence. Not abandoned — re-openable the moment a baseline arm exists (`road-to-subagent-value-realization-followup` Phase 1 Step 2). -->

- [-] Give mutating slices the floor plus the two projected gates (~1,700 chars
      total), leaving read-only slices on the floor alone. Per-slice, not
      global.
      <!-- cancelled 2026-08-07 by the Phase-2 stopping rule, pre-registered in `orchestration-observed-dispatch-cost` criterion (4) BEFORE any number was read: no dispatch-family proved out, so the orchestrator-first mode is not built on this evidence. Not abandoned — re-openable the moment a baseline arm exists (`road-to-subagent-value-realization-followup` Phase 1 Step 2). -->


**Exit:** returns are validated deterministically, telemetry emits without
model cooperation, and the known composition hole is closed.
**Rollback:** each item is independently revertible; the mode from Phase 3
stays off until this phase is complete.

## Acceptance criteria

- [x] The activation gate clears on this host, and the override that makes it
      clear names the evidence behind each field it sets.
      <!-- met: host_capabilities override written, each true field naming the
      observation it rests on; classifyTask verified to dispatch where it
      previously short-circuited. -->
- [x] A per-family, two-directional stopping rule exists in CLAIMS **before**
      any backfilled number is read, and is not edited afterwards.
      <!-- met: `orchestration-observed-dispatch-cost` pre-registered before the
      extractor existed, and NOT edited after the numbers landed — only its
      resolution appended. The sibling it could have been folded into was left
      byte-untouched. -->
- [x] Telemetry provenance is honest per line: the orchestrated side measured,
      any baseline estimated with its method named. No estimated value is
      reported as measured.
      <!-- met: `cost_provenance: measured|absent` per line and NO token_delta
      emitted at all; the extractor's refusal to synthesise one is stated in the
      payload so its absence cannot read as an oversight. -->
- [x] Every dispatch-family resolves to proven or null. "No family proved out"
      is an accepted, pre-registered outcome that stops the roadmap at Phase 2.
      <!-- met, and it is the criterion that fired: all four families
      INDETERMINATE, none proven, roadmap stopped at Phase 2 by its own rule. -->
- [-] Mandatory delegation, if it ships at all, ships opt-in, session-scoped,
      bounded to proven families, with L0 in front of it and the irreducible
      core written down.
      <!-- moot: nothing shipped. The criterion is conditional ("if it ships at
      all") and the condition did not arise — Phase 3 was cancelled by the
      pre-registered stopping rule. Recorded as cancelled, not as met. -->
- [-] Deterministic return validation and the composition-hole closure land
      before the mode is used at volume, not after.
      <!-- moot: no mode exists to use at volume, so the ordering this criterion
      protects has nothing to order. The composition hole stays open and stays
      published — cancelling this criterion does not close it, and Phase 4's
      cancellation note records it as re-openable. -->
- [x] The rule-surface question is not re-opened for read-only slices — it is
      closed by measurement, and spending tokens against a measured null is the
      failure this criterion prevents.

## Blockers

None open. Phase 1 removes the dependency that blocks both parent roadmaps
rather than inheriting it: the ≥20-line gate is reachable from data already on
disk, without waiting for future usage.

      <!-- met: the ~1,100-char floor was not touched. The content axis stayed
      closed for the whole run; every step spent went to the routing axis, which
      was the one actually open. -->