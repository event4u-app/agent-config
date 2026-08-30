---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Added as a draft proposal. UPDATED 2026-08-30: Phase 0 has now run, so the original clause 'nothing has run' is false and is corrected rather than left standing — see § Why Phase 0 shipped under status: draft in the body for why the status did not change with it. Archiving is still impossible (39 of 43 steps are open), parking in later/ would grow the later_roadmaps floor instead of the active one, and folding it into road-to-governed-harness-evolution is exactly the open question E1 puts to the owner — pre-merging would decide it by authoring."
---
# Road to experience loop broadening

> **Source:** `agents/tmp.old/evolver/` — three session proposals plus the
> operator transcript. Every repo claim below was re-verified against this tree
> on 2026-08-26; the proposals were drafted against `1899f92b9`.
>
> **Corrected after a neutral review: the staleness window is not empty.** An
> earlier revision said `1899f92b9` was "HEAD minus one commit" — true when the
> verification started, false by the time this branch was pushed, because the
> branch was rebased in between and the sentence was never re-measured.
> `git rev-list --count 1899f92b9..HEAD` reads **7**, of which three are
> upstream: `387dd3e68`, `82e47cefc` (#1676) and `9e8344a3f`. None of them touch
> the contracts or scripts this roadmap cites — those were re-checked against the
> post-rebase tree — but #1676 changed the estate that E1 reasons about, and the
> first version of E1 carried the pre-rebase number.
>
> **The consolidation those files produced was incomplete, and that is the first
> finding.** `road-to-experience-loop-master.md` declares
> `consolidates: [road-to-outcome-informed-assets, road-to-evidence-gated-self-evolving-agent-config]`
> — two files. (That key is quoted verbatim; the arithmetic sentence below is
> translated from the German original at `road-to-experience-loop-master.md:243`,
> so it is a rendering rather than a quotation.) The folder holds a third,
> `road-to-outcome-grounded-harness-evolution.md` (2728 lines, 25 phases, 20
> acceptance criteria, its own kill register), whose frontmatter declares it
> supersedes **both** of the two the master consolidated. The master's own
> arithmetic gives it away: "17 DI phases + 8 OIA phases compressed to M0–M8"
> does not include the third parent's 25. So the deepest parent was skipped, and
> most of what looks settled in the master was never discussed. This roadmap
> folds it back in.
>
> Items marked `corrected-from-reproduction` differ from the master because
> checking its step produced something else. Items marked `from-skipped-parent`
> come from that third file and appear in no master — a claim to check, not a
> source: two such markers in this pair turned out to credit a declared parent
> instead. That third file is now citable, with its residual, in
> `agents/evidence/analysis/skipped-parent-lineage-2026-08-26.md`.

## Goal

The learning loop this repository already runs is broadened until it can answer
*which guidance was loaded, whether it was followed, and whether the outcome was
real* — and until a repeated failure pattern can become a reviewed candidate for
authority rather than a line nobody reads again. When this is finished a
per-asset effectiveness report exists that a human or CI reads; every recorded
success is backed by a non-empty change *against that task's expected output
contract*; every derived figure states whether it was measured or estimated; and
the one question that would let runtime *consume* that experience is a named
owner decision rather than a silent default.

The correction that reshaped this plan, and it applies to all three source
proposals: **the loop is not missing.** It is narrow. Nothing here builds a
learning loop; every phase widens the one in the tree.

## What already exists — verified, do not rebuild

| Claimed gap | What is actually there | Verified on this tree |
|---|---|---|
| "No persistent learning loop" | `docs/contracts/audit-log-v1.md` — append-only JSONL per `/work` phase carrying `outcome`, `rules_applied`, `confidence_band`, `risk_class`; corrections only as a new `type=supersede` line | `:44` the example line, `:77` the outcome enum, `:85` the `type` enum, `:114` the supersede rule |
| "No pattern mining" | `src/scripts/extract_audit_patterns.ts` — mints patterns across **independent** `work_id` values behind a `--min-count` floor, exit 2 below it | `:7-8` flags and exit codes, `:14` "across INDEPENDENT runs — distinct `work_id` values" |
| "No promotion gate" | `src/skills/learning-to-rule-or-skill/SKILL.md` | the contract's consumer row `:26` names a human review gate but attributes it to `extract_audit_patterns`; the skill itself is named at `:11` and `:147-148` ("Skill that consumes promoted patterns") — corrected after a neutral review |
| "No runtime taxonomy; the ADRs contradict the code" | ADR-124 already classifies: Class A embedded/per-invocation, Class B resident with its own escalation path, Class C state stores prohibited | `ADR-124:110` Class A incl. the termination clause, `:153` the Class-B escalation, `:170-177` Class C plus the state-store test |
| "Experience needs a new home" | ADR-094 removed Layer 2 (the companion package) and **kept** Layer 1 (file-first `agents/memory/` plus intake JSONL) | `ADR-094:25` Layer 1, `:44` remove Layer 2, `:51` keep Layer 1 |
| "Deterministic capture is impossible" | `src/scripts/hooks/telemetry_usage_hook.ts` — `post_tool_use` with `tool_name === "Skill"` present in **164 of 164** real invocations across 14,171 records | `:15-19` verbatim |

**corrected-from-reproduction — ADR-094 is a *gated* no, not an absolute one,
and the gate is the thing to cite.** The master called Layer 2 revival a "Hard
No". `ADR-094:85` records the alternative as "Revive Layer 2 later. Gated:
requires ≥2 funded consumer projects with a …". The gate is unmet, so the
practical answer is the same — but a plan that says "forbidden" invites a
re-litigation that a plan saying "gated, gate unmet, here is the gate" does not.

## A hazard the parents created for each other

`from-skipped-parent`, and it is worth one line because acting on it wrong is
silent: the two same-lineage parents both use an `A/B/C/D` runtime-class
taxonomy, **with B and C swapped**. One has B = resident local runtime and
C = derived persistence; the other has B = derived local persistence and
C = resident runtime. Neither matches ADR-124, where Class C is the class that
is *prohibited*. So a cross-citation between those two documents silently
inverts "the thing to build" and "the thing that is banned". Every class letter
in this roadmap refers to **ADR-124 only**, and any future citation into those
parents must restate the letter's meaning rather than carry it.

## Why Phase 0 shipped under `status: draft`

Steps 0.1–0.3 landed real artifacts — `docs/contracts/runtime-component-classes.md`,
the two boundaries, `src/config/metric-registry.yml` and the gate that enforces it.
A roadmap that ships code while calling itself a draft is a contradiction, and a
neutral review named it. It is recorded here rather than resolved by flipping the
field, because the flip has a cost this run is specifically trying not to pay.

`check_estate_count` measures `active_roadmaps 2` against a floor of 2 —
**zero headroom**, and `status: draft` is exactly what keeps this file out of the
counted set. Promoting it needs a disposal in the same change or an
`estate_growth_exempt` claim, i.e. growing the active estate during a run whose
purpose is to shrink it. The reasoning is not new: it is written out above under
E1, where an AI council (anthropic + openai, 2/2) resolved the sibling question
on 2026-08-29.

So the state is deliberate and bounded rather than an oversight:

- **What the draft status does NOT excuse.** Every artifact Phase 0 shipped is
  live, gated and verified like any other. Nothing here is provisional because
  the frontmatter says draft.
- **Promotion condition.** The first change that either disposes of an active
  roadmap or is willing to carry an `estate_growth_exempt` claim for this file
  flips `status` to `ready` in the same commit. Whichever comes first.
- **What would falsify this note.** A reading of `check_estate_count` showing
  `active_roadmaps` below its floor — headroom exists, and the reason above has
  expired.

## Phase 0 — Scope, classification, decisions

- [x] **0.1 Write a classification note, not an ADR rewrite.** Every runtime
      component lacking an explicit ADR-124 class label gets one. No ADR is
      rewritten, because the taxonomy the parents wanted to author already
      exists.
      verify: DONE — `docs/contracts/runtime-component-classes.md` labels every runtime component against ADR-124, and `git diff docs/decisions/` is empty (no ADR is touched by this change).

      **What "the runtime registry" turned out to be, because the step's own
      wording points at the wrong file.** There is a `runtime_registry.ts` in
      this tree and it is NOT this: it records how a SKILL declares execution
      (`manual` / `assisted` / `automated`, plus a handler), which is a
      different axis from ADR-124's process lifecycle — a skill with
      `handler: shell` still runs inside a Class-A invocation. No inventory of
      runtime COMPONENTS with class labels existed, which is why the step reads
      as if one did. The note says this in its own § What is NOT in this table,
      because the two registries sound alike and a reader who conflates them
      looks for class labels in the wrong file.

      **The inventory is eleven rows, each naming the file that DECIDES its
      class** rather than asserting it: the hook dispatcher and its 47 concerns,
      the work engine, the code-graph engine, the gate population, `ui:audit`,
      `ui:render` and the council CLI as Class A; the UI/settings server and the
      MCP server as Class B; and the supervised collector as the Class-B row
      ADR-249 exists for. Two claims were checked rather than written from
      memory: `ls src/scripts/hooks/*.ts` is 47, and a grep for
      `createServer|.listen(|setInterval` across all 47 returns nothing.

      **The collector row names no file, and that is deliberate.** It is not in
      this tree — `road-to-supervised-telemetry-collector` builds it — and a
      cross-branch citation would be a broken reference. Omitting the row would
      have been worse: the table would read as if ADR-249 reversed a prohibition
      for nothing.

      **The two hazards the note is really for.** ADR-124's Class-B reversal is
      SCOPED (`supersedes_scope` names ADR-124 `:111` and ADR-109 `:28`), so
      "Class B is allowed now" is the misreading to prevent; and this roadmap's
      own § A hazard the parents created records that the two source proposals
      swap B and C, so a letter carried across from either silently exchanges
      "the thing to build" for "the thing that is banned". Both are restated at
      the point of use.

      **Honest limit, stated in the note:** it is a labelling, not a gate.
      Nothing refuses a new runtime component that arrives without a row, and a
      script that guessed at what counts as a component would be worse than the
      review obligation it replaced.
- [x] **0.2 Fix the boundaries in writing.** ADR-094 untouched (Layer 2 revival
      stays behind its own gate); the runtime-consumption question is carried
      only as the Phase 9 gate, never assumed either way.
      verify: DONE — audited, not asserted. Of this roadmap's 37 numbered steps exactly two mention runtime consumption: `6.3`, which FORBIDS it (*"Report only. No runtime consumption … nothing in selection or routing does"*), and `9.6`, which is the deferred owner decision. No step reads experience data at selection or routing time.

      **Both boundaries are now in writing**, in
      `docs/contracts/runtime-component-classes.md` § The two boundaries, rather
      than held as an intention by whoever last read the roadmap.

      **ADR-094 is untouched — `git diff docs/decisions/` is empty for this
      change** — and the boundary is restated in the form the roadmap's own
      `corrected-from-reproduction` note demands: Layer 2 revival is **gated**,
      not forbidden (*"requires ≥2 funded consumer projects"*), the gate is
      unmet, and citing the gate is what stops a re-litigation that citing a
      prohibition invites.

      **The runtime-consumption question is carried as the Phase 9 gate and
      assumed in neither direction.** The reason it is a boundary rather than a
      preference is written out: reading experience at runtime means deleting it
      changes what the system does, which is ADR-124's state-store test for
      Class C. So an accidental yes would reclassify the component, not merely
      widen a feature.
- [x] **0.3 Adopt consumer-before-producer for every metric.**
      `from-skipped-parent`, and it is the rule this repository has already paid
      for not having: each metric declares its `consumer`, the `decision` it
      feeds, and what fails if it is missing. "A metric with no consumer is
      telemetry decoration and should not land." The tree's own worked example
      is the 0.27 % dispatch capture this roadmap cites in 1.1 — a collector
      whose consumer arrived after the data did.
      verify: DONE — `./scripts-run src/scripts/lint_metric_consumers --self-test` reports `7/7 case(s) behaved (6 rejecting, floor 7)`, and three of those six rejections are exactly one missing field apiece.

      **The registry is `src/config/metric-registry.yml`, seeded with the seven
      metrics this package actually produces** — the attribution-shape block
      count, the `skip_paths` estate, the per-gate `scanned:` count, the
      unhardened-gate population, the registered non-adopter count, the
      always-rule budget, and council quorum. Each names its producer, so the
      other three fields are checkable against something.

      **The third field is the one that does the work, and the reason is worth
      keeping.** `consumer` and `decision` are both answerable for a metric
      nobody needs — "the report reads it", "it informs the roadmap" — and that
      is precisely the number this step exists to catch. `absent` is
      falsifiable: if the honest answer is *nothing fails*, the entry cannot be
      written. The roadmap's own worked example is the 0.27 % dispatch capture
      figure, a number that existed for months before anyone could say what
      decision it fed.

      **The lint refuses three shapes, not one.** Missing or empty; BOILERPLATE
      (`TBD`, `unknown`, `see above` — placeholders that pass a length check and
      answer nothing); and shorter than 20 characters. An empty registry is also
      refused, because a gate that scans nothing exits green and this gate's
      subject is numbers that exist without a purpose.

      **Honest limit, in the gate's own docstring rather than only here: it
      checks SHAPE, not truth.** It makes the OMISSION impossible; it cannot
      tell a real consumer from a plausible sentence, because that is a review
      judgement and no parser has it. Claiming otherwise would make the gate
      look stronger than the thing it replaced.

      Wired rather than orphaned: `task lint-metric-consumers`, in the `ci`
      aggregate, with a `gate-coverage.yml` row carrying `min_scanned: 5` — a
      floor rather than `> 0`, because the failure shape here is a truncated or
      renamed registry where one surviving entry would still pass.
- [x] **0.4 Settle estate placement.** See E1.

      **Closed 2026-08-29.** E1 resolved by AI council 2/2 to **(b) stay
      separate**, with every named overlap assigned a single canonical owner and
      duplicate completion claims prohibited. The estate argument that E1 leaned
      on was withdrawn — its number was stale *and* the property it appealed to
      is a ratchet invariant rather than evidence. A fold is recorded as
      owner-reserved and was not taken.

## Phase 1 — Broaden capture

- [x] **1.1 Spike whether the dispatch event is as reliable as the skill
      event.** **DONE 2026-08-30 — MEASURED NULL at 85.7 %, bar not moved.**
      905 of 1,056 dispatches recorded, against a pre-registered bar of >= 95 %
      over >= 50 dispatches. n is 21x the underpowered floor, so this is a
      reading and not an absence of one, and the pre-registered consequence
      applies as written: **the work rescales to skill events**, and no
      dispatch-event-based mechanism is authored on this evidence. The rate rose
      by a factor of ~317 from the 0.27 % prior once `orchestration-record`
      stopped being model-carried — large, and still short of the bar, which is
      what fixing the bar first buys. Full working, including the
      `CLAUDE_PROJECT_DIR`-in-a-worktree denominator effect that first returned
      an impossible 187 %:
      `agents/evidence/analysis/dispatch-event-capture-2026-08-30.md`; ledger
      entry `claim: dispatch-event-capture-reliability`, `status: resolved-null`.
      **Citation corrected while executing:** this step cited
      `docs/CLAIMS.md:328`, which is `claim: 120 governed rules`. The verbatim
      string below is at `docs/CLAIMS.md:370`, inside
      `claim: orchestration-observed-dispatch-cost`.
      `docs/CLAIMS.md:370` records the measured reality verbatim:
      "0.27% telemetry capture (370 dispatches, 1 recorded line)". The skill
      event by contrast is 164/164. Pre-register the numbers before building:
      success is ≥ 95 % capture over ≥ 50 dispatches; below that the result is an
      honest null and the work rescales to skill events.
      verify: the pre-registration commit precedes the measurement commit, and
      the measured rate is reported whichever way it lands.
- [x] **1.2 Add `skills_applied` to the audit line.** **DONE 2026-08-30.**
      The field is optional and bounded to <= 32, mirroring `rules_applied`, and
      **absent is not `[]`**: an omitted key means *not recorded*, `[]` means
      *recorded, none applied*. That split is the load-bearing part — every
      existing producer omits the field, so defaulting it to `[]` would have
      asserted a negative signal for every caller with nothing to say, and a
      per-asset report could then never tell no-signal from no-skills. The
      second writer (`src/scripts/_lib/review_skipped_record.ts`) therefore
      omits it on purpose, with the reason written at the emission site: it
      observes a review that did not happen and has no skill observation in
      either direction. **`schema_version` stays 1 and no supersede lines were
      needed** — the field is additive under the contract's own forward-compat
      rule, which is a correction to this step's original migration plan.
      **The verify line's "real emission" bar is met by a real emission:**
      `tests/fixtures/audit-log/skills-applied-real-emission.jsonl` is the
      literal output of `src/scripts/orchestration_record` writing to a temp
      audit dir, not a hand-written object, and a test asserts the field
      survives that CLI path. **Sensitivity checked rather than assumed:**
      making the emission unconditional (`absent -> []`) turns the
      absent-vs-empty test red, and restoring it turns it green, so the test is
      known to be able to fail.
      `corrected-from-reproduction`: verified — `audit-log-v1` carries
      `rules_applied` (`:82`, bounded to ≤ 32) and carries **no** skills field at
      all. Migrate by `type=supersede` lines, exactly as that contract already
      prescribes for corrections.
      verify: a fixture proves real emission of the new field from a live phase.
      A "collector exists" proxy is not evidence — the tree's own 0-of-89
      finding (`telemetry_usage_hook.ts:11`) is what that mistake costs.
- [x] **1.3 Reconcile the two outcome vocabularies before extending either.**
      `corrected-from-reproduction`, and no proposal in either folder noticed:
      this tree holds **two** outcome enums. `audit-log-v1:77` has four values
      (`success · blocked · skipped · error`);
      `src/scripts/_lib/outcome_envelope.ts:24-30` has six
      (`success · clean-no-op · blocked · approval-required · exhausted ·
      stagnated`). One of this roadmap's source proposals planned
      to write `clean-no-op` into the audit stream, where that value does not
      exist — which is how the split was found. Phase 2 below deliberately does
      **not** write it: which outcome an empty-but-contract-satisfying return
      resolves to is E3, and E3 cannot be answered before this step. Corrected
      after a neutral review caught the earlier wording attributing that plan to
      Phase 2 itself. This step owns the reconciliation; the sibling roadmap
      `road-to-governed-harness-evolution.md` names the same defect and defers to
      this one.
      verify (**AMENDED 2026-08-29 by AI council, and the amendment was owed**):
      the original clause prescribed UNIFICATION — "one module is the single
      definition" of one vocabulary — and the council's verdict is (b), keep the
      vocabularies separate. Closing the step against the unamended clause would
      have been the silent-green defect this roadmap's own Phase 0 warns about,
      so the clause is replaced with openai's wording, quoted verbatim from the
      round-2 response: *"One authoritative module defines the phase, step, and
      run outcome vocabularies and every permitted cross-domain mapping. Code
      imports its applicable definition; the audit-log contract is lint-checked
      against the phase definition; lint rejects inline duplicates."*

      **CLOSED 2026-08-29.** Evidence, all at this branch's HEAD:

      - The authoritative module is `src/scripts/_lib/outcome_vocabularies.ts` —
        `PHASE_OUTCOMES` (4), `STEP_OUTCOMES` (3), `RUN_TERMINAL_STATES` (6),
        `CROSS_DOMAIN_MAPPINGS` (1 row), plus two guards.
      - Code imports its applicable definition:
        `src/scripts/_lib/orchestration_record.ts:45` now reads
        `export type LineOutcome = PhaseOutcome;` and
        `src/scripts/_lib/outcome_envelope.ts:34` reads
        `export type TerminalState = RunTerminalState;`. Both keep their old
        names because other modules and a pinned test import them.
      - The contract binding is a check, not an import:
        `tests/contracts/outcome_vocabularies.test.ts` — 9 tests, all green.
        Its sensitivity is proven, not assumed: dropping one value from the
        contract's `outcome` row turned it red, and it was restored.
      - The anti-duplicate check found a real duplicate on its first run —
        `TERMINAL_STATES` in `src/scripts/_lib/runtime_journal.ts:312`, a second
        literal list of the six run states. It is now
        `export const TERMINAL_STATES = RUN_TERMINAL_STATES;` and the two
        type-level assertions that guarded the duplicate are gone with it.

      **Three defects found while executing this step, all fixed here, none of
      which the step predicted:**

      1. **This step's own premise was wrong in both halves.** There are
         **three** vocabularies, not two — the third is the work-engine STEP
         enum at
         `src/agent-src/templates/scripts/work_engine/delivery_state.ts:39`
         (`success · blocked · partial`). And the audit-log 4-value set is not
         documentation-only: `LineOutcome` was declared in code at
         `orchestration_record.ts:45` all along, `envelopeOutcome` at `:195`
         returns all four, and `review_skipped_record.ts:89` writes
         `outcome: 'skipped'` onto a real line. An earlier reading of this tree
         concluded `skipped` and `error` "exist nowhere in code" because it
         grepped for enum MEMBER ASSIGNMENTS (`SKIPPED: 'skipped'`) and these
         are string-literal union members. That correction is recorded in the
         new module's header so it cannot be made a third time.
      2. **`docs/contracts/audit-log-v1.md:77` carried a false mirror claim** —
         *"Mirrors `Outcome` from `work_engine.directives`"* — false twice: no
         such module path exists, and work_engine's real `Outcome` carries
         `partial` and neither `skipped` nor `error`. It has pointed at the
         wrong enum since the contract was created (`032a244a3`, PR #183). Now
         points at `PHASE_OUTCOMES` and its check.
      3. **The same contract named an enforcer that does not exist.** Its
         privacy floor claimed enforcement by
         tests/contracts/test_audit_log_redaction.py — absent from this tree.
         Replaced with what is actually true: privacy holds by CONSTRUCTION on
         the two validated builder paths, is unscanned, and a third producer
         would not be caught. Step 1.4 owns closing that; the contract no longer
         claims otherwise.
      4. **The only consumer validated nothing.**
         `src/scripts/extract_audit_patterns.ts` typed `outcome` as bare
         `string`, so a typo became its own pattern silently. It now classifies
         against `isPhaseOutcome` and reports off-vocabulary values on stderr.
         Grouping is deliberately UNCHANGED — that file mirrors a retired Python
         CLI byte-for-byte and dropping a record would break pinned stdout — so
         what changed is that an off-vocabulary value is observable rather than
         silent.

      **Council record.** AI council 2026-08-29, anthropic + openai, 2 rounds,
      $0.00 (both seats subscription-authed), quorum 2/2 present after the run.
      The seats SPLIT on the verdict — anthropic leaned (c) unify phase+step,
      openai (b) map-don't-unify — and named the **same discriminator**: trace
      the producers before choosing. That trace is what settled it, and it
      settled it against a preference: three distinct subjects (phase / step /
      run), all three produced today, and one cross-domain mapping already in
      the tree. A superset would admit states that are nonsense for their
      subject — a step ending `approval-required`, a run ending `partial`. Both
      seats independently confirmed no OWNER-RESERVED boundary is crossed.
      Dissent preserved: anthropic's (c) remains live if producer analysis ever
      shows phase and step share identical terminal semantics with a lossless
      mapping — carried as the module's own `revisit-if`.
- [x] **1.4 Carry a privacy class on every captured event, and a redaction rule
      for anything free-form.** `from-skipped-parent`, and this is the gap with
      the sharpest consequence. The master has **no** privacy, redaction or
      purge content at all, while its card phase writes mined experience into
      `agents/memory/` — verified **tracked**, five files under
      `git ls-files agents/memory`. Persistent experience can retain source
      excerpts, secrets, user messages and customer data. Structured references
      by default; raw snippets off, or bounded and secret-scanned; a privacy
      class as a mandatory event field. This is the shape
      `domain-safety-pii` § Surface 2 already prescribes for logs: make the
      event type incapable of holding free-form content rather than scrubbing it
      afterwards.
      **DONE 2026-08-30 — two mechanisms, not one restated twice.** (a) A
      COMPILE-TIME guard: both producers' input types now carry
      `Assert<[NoFreeForm<T>] extends [never] ? false : true>`, so adding
      `prompt`, `body`, `file_path`, `stdout`, `reason`, `payload` or any other
      `FREE_FORM_KEYS` member to `RecordInput` or `ReviewSkippedInput` is a
      build error. (b) A MANDATORY `privacy_class` field
      (`src/scripts/_lib/privacy_class.ts`, one module per 9.1's rule), so a
      consumer reads what a line carries instead of re-deriving it from the
      producer's source. The guard without the declaration leaves every reader
      inferring; the declaration without the guard is a label with nothing
      behind it.
      **Both directions are checked, which is the half that is easy to omit.** A
      `@ts-expect-error` negative fixture asserts the guard still REJECTS, so a
      `NoFreeForm` broken into an identity type fails the build rather than
      passing everything. All four probes were run by sabotage, not inspection:
      a free-form key produces `error TS2344` on each producer, a non-free-form
      fixture field makes the directive unused and fails too, and restoring
      returns the tree to zero errors.
      **A real trap found while executing, and recorded because it makes gates
      vacuous:** `tsc -p tsconfig.json` does **not** reach `src/scripts/**` —
      that config covers `src/cli`, `src/server`, `src/shared`, `src/install`
      only, and `src/scripts/**` is reached solely by `tsconfig.scripts.json`.
      The first sensitivity probe run under the wrong command reported the
      sabotage as clean. The command that checks this floor is `npm run
      typecheck`, which runs both.
      **Residual, stated rather than implied:** the guard binds the two shipped
      producers by name. A third producer added outside that shape is still
      caught by nothing. `docs/contracts/audit-log-v1.md`'s enforcement
      paragraph — which named a test file that exists in no tree — is corrected
      to say exactly this.
      verify: the event type has no field able to hold a prompt, a file body or
      a path; a fixture attempting to write one fails to compile.
- [x] **1.5 Everything default-off and local.** No dark-channel ratchet is
      touched.
      **DONE 2026-08-30.** The existing suite asserted the log file does not
      exist, which is an assertion about the OUTCOME. The verify line asks for
      something stricter: *operations*, not output. A concern that created a
      directory, or wrote and then deleted, or reached the network and wrote
      nothing, would pass the outcome check and violate the contract. The new
      cases therefore compare a full recursive snapshot of the consumer root —
      path, size and mtime — before and after, on all four not-fully-opted-in
      shapes, plus a `globalThis.fetch` spy asserted at zero calls.
      **`vi.spyOn(fs, ...)` cannot express this** and the attempt is recorded
      rather than quietly replaced: `node:fs` exports are non-configurable under
      ESM, so spying `appendFileSync` throws `TypeError: Cannot redefine
      property`. The snapshot is strictly WIDER than the spy would have been —
      it also catches a directory creation and a write-then-delete that a spy on
      one function misses. The settings read stays allowed, deliberately: the
      concern reads `.agent-settings.yml` to learn it is off, its docstring says
      so, and reads leave the snapshot unchanged.
      **A POSITIVE CONTROL ships with it.** Four assertions of ABSENCE are the
      shape most easily satisfied by a broken instrument — a snapshot function
      that always returned the same list would pass every one. So the same
      helper runs against a fully opted-in install and the snapshot must change.
      **Citation corrected while executing:** the block cited as
      `telemetry_usage_hook.ts:21-29` is at `:22-33`.
      verify: with the feature off, zero telemetry file operations and zero
      network calls — the shape `telemetry_usage_hook.ts:22-33` already
      documents for itself.

## Phase 2 — Outcome integrity: anti-forgery at the subagent return

- [x] **2.1 Dock onto the existing stub, do not open a parallel plan.** **DONE
      2026-08-30, and the docking required settling a real conflict rather than
      adding a cross-reference.** The stub's own section "Why it is not being
      built" argues AGAINST building the gate, and its four preconditions are
      all unmet — so docking onto it needed an answer to whether its parking
      binds this phase.
      **AI council 2026-08-30, anthropic + openai, 2/2 convergent: it does
      not — different mechanism.** The stub parks a gate that BLOCKS parent
      completion on `subagent_stop`. Phase 2 changes how a telemetry record is
      LABELLED after the fact; nothing is blocked, refused, retried or delayed.
      The four preconditions are properties of a gate that ACTS — an `ok` path
      to fall back from, a recovery producer, demonstrated recovery — and none
      is meaningful for a value written into a JSONL line.
      **The council attached a switch-back condition, recorded at the stub so a
      future reader can check rather than re-argue:** the parking binds this
      change the moment the label is consumed, directly or transitively and
      without a separate discretionary decision, to block, retry, refuse,
      release or delay work. Audited against this tree 2026-08-30 — the
      condition is NOT met: `envelopeOutcome` has zero callers outside its own
      module, the only reader of `outcome` is `extract_audit_patterns.ts`
      (read-only, stdout, sole non-zero exit is argument validation), and that
      script is in no Taskfile, no `gate-coverage.yml` entry and no workflow.
      **No second gate is authored**, verified by grep: the only other estate
      mention is `stubs/road-to-task-completion-observability.md:117`, which
      DEFERS to this stub rather than authoring anything.
      `agents/roadmaps/stubs/road-to-subagent-return-gate.md` exists on this
      tree — verified — and carries the council decision this phase extends.
      verify: the stub is the referenced parent and no second gate is authored.
- [x] **2.2 Gate anti-forgery on the task's expected output contract, not on
      the diff alone.** `corrected-from-reproduction`, and this reverses the
      master. The master ships the unconditional form — claimed success × empty
      diff ⇒ never `success`. The skipped parent named exactly that form as the
      reference implementation's defect: "zero diff may be valid. Therefore
      'zero diff = failure' must **not** be global. The gate must use expected
      artifact contract." Analysis, review and read-only research dispatches are
      a large share of this repository's subagent traffic and legitimately
      produce no diff; the unconditional rule would mark them all as failures
      and poison the very aggregation Phase 4 depends on.
      **DONE 2026-08-30.** `envelopeOutcome` now reads an `expected_output`
      discriminator (`code-change | analysis | review | unknown`) plus a
      MEASURED `diff_lines`, and fires only when all three hold: the dispatch
      declared a code change, claimed success, and the diff was measured at
      zero. **An unmeasured diff never becomes a failure** — treating "not
      measured" as zero manufactures the same forgery with the opposite sign.
      **The council's two conditions were met before shipping, not asserted.**
      (a) Consumer audit: `envelopeOutcome` has zero callers outside its module,
      the only reader of `outcome` is `extract_audit_patterns.ts` (read-only,
      stdout, sole non-zero exit is argument validation), wired into no
      Taskfile, gate or workflow — so the label enters no automated control
      path. (b) A cutover marker: lines carry `outcome_semantics: 2`, an absent
      field means the pre-2026-08-30 unconditional semantics, and
      `CROSS_DOMAIN_MAPPINGS` records the version at the crossing. This exists
      because of an asymmetry both seats raised: an enforcement gate rolls back,
      a labelling change over an append-only log does not.
      verify: a read-only analysis dispatch returning no diff but satisfying its
      declared output contract resolves to `success`; a code dispatch claiming
      success with an empty diff does not.
- [x] **2.3 Count empty cycles separately.** A double trigger must not read as
      two outcomes.
      **DONE 2026-08-30** — `src/scripts/_lib/empty_cycles.ts`, pure and
      host-free so the arithmetic is testable without a host payload. A
      duplicate produces NO second outcome and DOES increment a counter that is
      reported as its own quantity, never folded into a rate: a duplicate is not
      an outcome, and it is also not nothing, because a rising count is what an
      idle loop looks like from outside.
      **Both conjuncts are required and neither is sufficient** — same key AND
      inside the window. Key alone would erase a genuine repeat of the same work
      an hour later; window alone would collapse unrelated events under any
      fan-out. **A duplicate does not advance `last`**, so three fires in one
      window are one outcome and two empty cycles rather than a third fire
      drifting out of the window and reappearing as an outcome that never
      happened.
      verify: a synthetic double trigger produces one outcome and one empty-cycle
      increment.
- [x] **2.4 State the reason in the contract, not only in the code.** Without
      this gate every later aggregation poisons its own data, because an
      unverified self-report is indistinguishable from a result.
      **DONE 2026-08-30** — `subagent-response-contract.md` § "Why success is
      gated, and not accepted" carries both halves the verify asks for. The
      RATIONALE: a return claiming success with no change against its own
      declared output contract is evidence of a claim, not of a result. The
      FAILURE IT PREVENTS: every downstream aggregation reads the recorded
      outcome, so a forged `success` becomes signal — the report then recommends
      keeping an asset that never worked and retiring one that did, and nothing
      downstream can detect it, because by then the forgery is indistinguishable
      from the thing it imitates. That is why the check belongs where the record
      is written rather than where it is read.
      verify: the contract text carries the rationale and the failure it
      prevents.

## Phase 3 — Episode lifecycle and delayed amendment

- [x] **3.1 Give an episode a lifecycle, because outcomes arrive late.**
      `from-skipped-parent`: rework and regressions arrive after a task is
      already terminal, so an episode needs `open → terminal → observed →
      amended`, with historical events never rewritten — an amendment is a new
      record. The master has no lifecycle and no amendment path, while its
      **single** pre-registered core metric is the repeated-failure rate. A
      repeat is precisely the signal that surfaces after the audit line is
      written, so without amendment the master's one metric cannot be computed
      correctly.
      **DONE 2026-08-30, on the carrier this step does not name.**
      `src/scripts/_lib/runtime_journal.ts` already had three of the four rungs
      — `open` (`opened_at`/`opened_by`), `terminal` (`terminal_state`), and
      `observed` (the `consumption` column, stored and unfilled). Only
      `amended` was missing, so nothing new was built: an `amends_seq` column
      was added, `JOURNAL_SCHEMA_VERSION` bumped to 3 (a mismatch discards and
      rebuilds — the store is gitignored and rebuildable by design), and
      `reconstructEpisode` taught to fold.
      **Byte-identical is asserted on the STORED ROW**, compared before and
      after as raw SQLite output rather than as a reconstructed object — the
      append-only guarantee is about the row, not about a projection of it. The
      reconstruction still returns every original row unfiltered; what folding
      changes is which rows are *effective*.
      **The one-line defect the fold fixes:** `closing` was
      `events.find(e => e.terminal_state !== null)` — the FIRST terminal state.
      With amendments that returns the superseded verdict forever while the
      amendment sits in the table unread. It is now the LAST effective one.
      **The second conjunct needed a metric that did not exist**, so
      `src/scripts/_lib/repeated_failure.ts` computes it — and reads the amended
      view **by construction, not by documentation**: its input type is
      `EpisodeReconstruction` and it has no overload taking raw
      `JournalEvent[]`, so a caller cannot compute the rate over unamended rows
      because there is nothing to pass. The test pins the gap the amendment path
      exists for: the same two episodes read 0/2 unamended and 1/2 amended.
      **Sensitivity checked by sabotage:** restoring `find` turns both amendment
      tests red; restoring the fold turns them green.
      verify: an amendment arriving after a terminal state produces a new record
      and leaves the original byte-identical; the repeated-failure rate reads the
      amended view.

## Phase 4 — Loop guards for drain and continuation

- [x] **4.1 Detect more than two shapes.** The master carries two counters —
      consecutive empty cycles, and the same signal or roadmap in ≥ 3 of the
      last 8 runs. `from-skipped-parent` adds three the master dropped: the same
      failure *signature* recurring, the same tactic repeated after it was
      rejected, and the same asset activating repeatedly with no progress. The
      last two are the ones a counter over signals cannot see.
      **DONE 2026-08-30** — `rejectedTacticRepeat` in
      `src/scripts/_lib/loop_guards.ts`, beside `stallSignal` rather than in the
      1,500-line hook, because that file is over the source-size budget and this
      one exists for exactly this.
      **Correction to this step's premise, found while executing:** it says "the
      master carries two counters". This TREE carries **one** — `stallSignal`,
      a numeric detector over open-step counts. None of the five shapes the step
      discusses was implemented. The premise described the source proposal, not
      the tree.
      **Why a second detector rather than a tuning of the first:** `stallSignal`
      keys on a NUMBER and cannot see the failure this catches — an agent
      retrying the same rejected approach while the count moves and the wording
      changes every time. So the new detector keys on an IDENTITY, and is given
      no text field at all rather than being trusted to ignore one, which is the
      only way "even when the signal string differs" is actually achievable.
      **Only REJECTED attempts count.** A tactic tried three times and accepted
      twice is not a loop, it is a tactic that works; counting every attempt
      would fire on productive repetition, which is the false positive that gets
      a guard switched off.
      verify: a synthetic run repeating a rejected tactic trips suppression even
      when the signal string differs.
- [x] **4.2 No strategy presets.** Suppression escalates through the existing
      triage ladder.
      **DONE 2026-08-30.** `SUPPRESSION_WINDOW = 8` and `SUPPRESSION_REPEATS = 3`
      are named constants beside the detector — **not** a settings block. A
      configurable strategy preset is the shape K5 kills by name: presets
      multiply the states a reader must reason about while the underlying
      question ("is this run going in circles?") has one answer. Two numbers
      with a stated meaning are auditable; a tuning surface is not.
      **No parallel escalation was built**, which is the other half of "no
      presets": the detector returns a signal and nothing else, so escalation
      remains the existing triage ladder's job rather than a second ladder
      living next to it.
      verify: a run of 8 with 3 repeats trips suppression exactly once, and a run
      of 8 with 2 repeats does not.

## Phase 5 — Activation versus adherence

- [x] **5.1 Separate "was it loaded" from "was it followed".** **DONE
      2026-08-30** — `src/scripts/_lib/activation_states.ts`. Three rungs
      (`available`, `activated`, `followed`) are observed independently and each
      is `true`, `false`, or `null` for *not observed*. `null` is not a
      pessimistic `false`: an unobserved rung is a statement about the
      instrument, so `classify` returns `unknown` the moment any rung it needs
      is unobserved.
      **The subtlety that made this a function rather than a lookup table:** an
      IRRELEVANT rung is not an UNKNOWN rung. Once `available` is observed
      `false`, the other two are meaningless rather than unobserved — an absent
      asset cannot have been activated — so an unobserved `followed` must not
      drag that case to `unknown` and hide a fact the instrument did establish.
      Same one rung down. `countsTowardWinRate` is exported so a report cannot
      quietly pick a different denominator per column.
      `from-skipped-parent`, and the master has no `adherence` token anywhere,
      which makes its per-asset win rate uninterpretable. The five states are
      `not available / available-not-activated / activated-not-followed /
      activated-followed / unknown`. The reason, in the parent's own worked
      case: skill content may be excellent, the router may never activate it,
      and changing the skill would improve nothing. A low success rate without
      this split leads to the wrong fix by construction.
      verify: a failing case is classifiable into one of the five states, and a
      case with an unobserved rung reports `unknown` rather than a success or a
      failure.
- [x] **5.2 Prefer deterministic adherence evidence where a rule has an
      observable footprint.** `from-skipped-parent`'s example: test-first
      discipline is provable from the order of the first observed write to a test
      file versus a production file. Where no footprint exists, adherence stays
      `unknown` — never inferred.
      **DONE 2026-08-30** — `src/scripts/_lib/adherence_detectors.ts`. One real
      detector: the test-first clause of `think-before-action`
      (`dist/agent-src/rules/think-before-action.md:43`), decided from write
      ORDER — first write to a test path versus first write to a production
      path. Every unregistered rule returns `unknown`, which is 118 of this
      tree's 119 rules and is the point: the honest report says so instead of
      filling the column with inference.
      **A detector answers for ONE CLAUSE, not for a rule** — rules here carry
      many, and a registration that claimed the rule would overclaim by
      construction, so the registry key is the pair and each entry cites where
      its clause is written.
      **A one-sided observation is `unknown` in BOTH directions**, and the
      production-only case is the one worth stating: calling it a violation is
      tempting and would be a guess, because the test may exist from an earlier
      task and the clause's own "when behavior can be defined" qualifier may
      exclude the change. The module carries no content field at all, so a
      detector cannot become a second path for file bodies to travel.
      verify: at least one rule has a deterministic adherence detector, and the
      rest report `unknown` rather than a model's guess.

## Phase 6 — Evaluation: a per-asset report, read-only

- [x] **6.1 Aggregate over the audit JSONL.** Per rule and per skill: win rate,
      streak, and the harmful / neutral / **unknown** shares. A missing signal
      counts as unknown, never as success.
      **DONE 2026-08-30** — `src/scripts/_lib/experience_report.ts`.
      **`win_rate` is `null`, never `0`, when nothing classifiable was seen**,
      and the distinction is the one a reader acts on: zero is a measurement
      meaning *it never worked*; null means *we do not know*. A reader seeing
      `0.0` acts, a reader seeing `—` asks.
      **`unknown` never enters the denominator either.** A rate over "everything
      we saw" answers a different question from a rate over "everything we could
      classify", and only the second is about the asset.
      **Absent `skills_applied` invents nothing.** A line omitting the field
      recorded nothing about skills, so it produces no skill row — it is not
      evidence that no skill was applied, and may not become an `unknown`
      against a skill nobody named. This is where 1.2's absent-vs-empty split
      stops being philosophical.
      verify: an asset with no signal appears with unknown ≠ 0 and win rate
      undefined, not with a fabricated score.
- [x] **6.2 Every derived figure states its basis.** `from-skipped-parent`, and
      both a parent and the master's own rationale depend on it: each number
      carries `basis: measured | estimated:<method> | inferred | unknown`. The
      master lists win-rate, streak and the share fields and has no basis field,
      so a measured cost and an estimated one render identically — the exact
      self-report failure Phase 2 exists to prevent, reintroduced one layer up.
      **DONE 2026-08-30** — `BasisTag` in `src/scripts/_lib/evidence_basis.ts`.
      `estimated` on its own is a CATEGORY, not a basis: two figures both marked
      `estimated` can differ by an order of magnitude in how much they should be
      trusted — one derived by arithmetic from measured inputs, one from a
      response-length heuristic — and a report rendering them identically has
      told the reader nothing actionable. So the type REJECTS a bare
      `estimated`, and rejects `estimated:` with an empty method too, since that
      is the same omission wearing a colon. Every other basis is
      self-describing and takes no suffix.
      **Enforced by the type rather than by a lint**, which is stronger than the
      step asked for: a lint scans what it is pointed at, while a figure typed
      `BasisTag` cannot carry a method-less `estimated` at all.
      verify: a report line with an estimated component that does not name its
      method fails the lint.
- [x] **6.3 Report only. No runtime consumption.** A human or CI reads it;
      nothing in selection or routing does. Crossing that line is the Phase 9
      gate, not an implementation detail.
      **DONE 2026-08-30.** The twelve routing and selection paths are enumerated
      EXPLICITLY rather than globbed, and a companion assertion proves each one
      exists — a glob that silently matched nothing would pass forever, and a
      rename must turn this red rather than quietly emptying the sweep.
      verify: no import of the report module from any routing or selection path.
- [x] **6.4 Wire the report to retirement, with a safety carve-out.**
      `from-skipped-parent` on both halves. The report's most obvious near-term
      consumer is the existing utilization-window retirement path — the ledger
      supplies the data, the rules stay the authority. And precisely there:
      pruning on low usage can delete a rare but important safety behaviour, so
      authority and safety assets are **excluded** from usage-based pruning. The
      master dropped both the wiring and the carve-out.
      **DONE 2026-08-30, and executing it found a live hole in the carve-out.**
      `read_exempt`'s predicate was `id.endsWith('-safety-floor')`, which
      exempted **4 of this tree's 9 safety rules**. The five it missed —
      `domain-safety-disclaimer`, `domain-safety-pii`,
      `domain-safety-retention`, `runtime-safety`, `tool-safety` — are none of
      them kernel, so every one was REAP-eligible on low usage. A usage-based
      retirement proposal for `domain-safety-pii` or `tool-safety` is precisely
      the outcome this carve-out exists to prevent, and **low usage is exactly
      what a working safety floor looks like**: it fires rarely, and rarely is
      not the same as never needed.
      Widened to match `safety` as a hyphen-delimited token, which covers all
      nine and — verified against the 119 projected rules — matches nothing
      else. The direction is the conservative one: it can only REMOVE
      retirement proposals, never add one. A third assertion pins the exemption
      set at exactly those nine, so the predicate cannot silently become a
      blanket that disables retirement entirely.
      verify: a low-usage safety-classified asset is not proposed for
      retirement, and a low-usage ordinary asset is.
- [x] **6.5 Defer the SQLite index until latency is measured.** Allowed **only**
      as a rebuildable Class-A artefact under `agents/runtime/state/`; as the
      *source* of experience it is a contract violation.
      **DONE 2026-08-30 — the deferral holds and is now CHECKABLE rather than
      asserted.** No index exists and none was built; 6.1's report reads the
      JSONL directly. Ticking this on the deferral alone would have been a green
      with nothing behind it, since the verify below is a conditional guard on a
      build that has not happened — so a test asserts the absence instead: the
      report module opens no database, and no index artefact is committed. If
      someone builds one, that test goes red and the verify below becomes the
      thing they must satisfy, which is exactly when it should start applying.
      **Citation corrected while executing, and it mattered.**
      `docs/contracts/no-runtime-boundary.md` is `stability: superseded` and its
      line 40 carries different text entirely. The state-store test lives at
      **`docs/contracts/resident-process-governance.md:78-82`**, verbatim: "if
      deleting the artifact changes *what* the tool can answer rather than only
      *how fast* it answers, it is a state store and prohibited. A code-graph
      cache passes; a vector index fails."
      verify: deleting the index changes only runtime, and a rebuild reproduces
      it byte-for-byte from the JSONL.

## Phase 7 — Experience cards

- [x] **7.1 Cards come only from the mining gate.** `extract_audit_patterns`
      count ≥ 2 over independent `work_id`s, outcome-differentiated — or from an
      explicit seed block. Never invented, never pre-seeded as families.
      **DONE 2026-08-30. Where cards live was a real decision, taken by AI
      council (anthropic + openai, 2/2 convergent): `agents/knowledge/`, as a
      STRICT TAGGED UNION on a required `kind: external | experience` — never
      one schema with conditional fields.** The council's reason is the design:
      making the external variant's checks optional would hide two contracts in
      one nominal schema, the union-of-what-producers-send failure this repo
      refuses elsewhere. They are variant invariants instead — in full for
      `external`, not part of `experience` at all. AC-1's "no second store" is
      honoured without pretending the two card kinds are one thing.
      **The reusable boundary the council left behind**, recorded at the store
      so the next proposal is measured rather than re-argued: *a new store is
      justified only when its records cannot share the existing carrier's
      identity, discovery path and consumer lifecycle — not merely because they
      have different provenance or validation rules.*
      Admission: a `pattern_ref` from the mining gate (count ≥ 2 across
      independent `work_id`s) or an explicit `seed_ref`. A whitespace-only ref
      is not a ref — the cheapest way to fake admission is a present-but-empty
      field.
      verify: an attempt to author a card with no backing pattern is refused.
- [x] **7.2 Field set, with a size budget.** Scope, trigger context, the
      strategy itself (compact), falsifier, confidence, contradictions,
      supersedes, expiry / review-by — plus an **epistemic type**
      (`observed | derived | inferred | hypothesized`), `from-skipped-parent`.
      The type is not decoration: only observed and derived statements may ever
      act as a hard filter, and inferred or hypothesized ones may at most
      influence ranking with reduced weight. That restriction is what makes the
      Phase 9 gate answerable in degrees instead of all-or-nothing.
      **DONE 2026-08-30.** The falsifier and the expiry are what make a card a
      CLAIM rather than an opinion: without a falsifier it can never be retired
      on evidence, only on taste; without an expiry an empirical claim outlives
      the conditions that produced it and nobody notices, because nothing ever
      asks.
      **The epistemic split is load-bearing, not descriptive.** `observed` and
      `derived` are FACTUAL; `inferred` and `hypothesized` are GENERATIVE. Only
      the factual pair may hard-filter, enforced by an exported predicate rather
      than by prose — letting a hypothesis filter is how a guess becomes a rule
      without anyone deciding it should.
      verify: a card missing a falsifier, an expiry or an epistemic type fails
      the lint.
- [x] **7.3 Failures narrow, they never widen.** A failure adds an anti-pattern
      entry; it never extends the card's applicability scope.
      **DONE 2026-08-30.** The temptation this refuses is specific: a card fails
      in a neighbouring context, and the natural-sounding repair is "so the card
      is really about the broader case". That turns every piece of disconfirming
      evidence into an expansion, which is the exact inverse of what evidence is
      for. `applyFailure` throws on a widening and otherwise appends an
      anti-pattern and changes nothing else.
      verify: a fixture where a failure attempts a scope widening is refused.
- [x] **7.4 A card is not a rule.** Empirical, scoped and probabilistic versus
      normative. A duplicate lint runs against the existing rule and skill
      corpus, and promotion into authority happens only through
      `learning-to-rule-or-skill`.
      **DONE 2026-08-30**, reusing `text_similarity.ts` rather than authoring a
      second similarity function. A card restating a live rule adds no knowledge
      and creates a second place the same instruction can drift. The threshold
      is a named constant the tests and the checker share, so it is one number a
      reviewer can argue with rather than a literal buried in a comparison.
      verify: a card whose text duplicates a live rule fails the lint.
- [x] **7.5 Promote by scope, one level at a time, with transfer evidence.**
      `from-skipped-parent`: a card carries a scope on the ladder
      `session → repo → workspace → organization → global`, promotion moves one
      level at a time, and a raise beyond repo scope requires held-out or
      independent evidence rather than the same runs that produced it. The
      master gates promotion only on the human review skill, so a card mined
      from one repository's runs can become global on that repository's evidence
      alone.
      **DONE 2026-08-30.** Two refusals, answering the two ways a card gets
      over-promoted. A two-level raise skips the rung where the card would have
      been checked against a wider population. And **past `repo`, the runs that
      minted a card cannot also show it transfers** — that is the same data
      answering its own question — so the evidence pool must be held-out or
      independent. Development-pool evidence stays fine up to `repo`, because
      that is where the card produced it.
      verify: a two-level raise is refused, and a raise past repo scope with only
      development-pool evidence is refused.
- [~] **7.6 Incremental card updates rather than rewrites.** Deferred: needs
      E8. `from-skipped-parent` promoted `ADD / UPDATE / REMOVE` delta-updates
      from optional to core, with a reflector/curator split whose boundary is
      "the model may interpret evidence; it may not rewrite the evidence". The
      master cites the source paper and carries neither the mechanism nor a
      decision about it.

## Phase 8 — Trigger-shift pairs, offline

- [x] **8.1 Extend `triggers.json` backward-compatibly.** A `shift_of` field
      plus an axis set, producing an offline train-versus-shifted gap report in
      the `description_route_check` neighbourhood. The master lists three axes
      (wrapper, temporal, phrasing); `from-skipped-parent` adds host framing and
      context/tool availability, which are the two a purely textual shift cannot
      express. Pilot scope is a decision (E6).
      **DONE 2026-08-30** — `src/scripts/_lib/trigger_shift.ts`, five axes
      including the two from the skipped parent that a purely textual shift
      cannot express.
      **The backward-compatibility claim is STRUCTURAL, not a promise.** All six
      readers of `triggers.json` key-pick, and no JSON Schema governs the file —
      `evals.schema.json` says so in its own `$comment` — so an unknown key
      cannot break a parse. The test asserts it anyway, through the production
      reader and across the whole 94-file corpus, because "cannot break" is the
      kind of claim that is cheap to make and cheap to check.
      **Pilot: `code-intelligence`** — the roadmap's own § First cut names it as
      already carrying `evals/triggers.json`, so E6 is followed rather than
      decided. Two twins, `wrapper` and `temporal`.
      **The gap report deliberately does not count a pair whose BASE already
      fails.** That says the corpus row is wrong or the description never
      worked; it says nothing about generalisation, which is the only thing this
      measures.
      **A dangling twin is REPORTED, never dropped** — swallowing one makes the
      corpus quietly smaller while the report still looks complete.
      verify: existing `triggers.json` files parse unchanged, and the gap report
      is produced with zero live-harness calls.
- [x] **8.2 The live-floors park stays parked.**
      `agents/roadmaps/later/road-to-routing-assurance-live-floors.md` exists on
      this tree and its council decision (2/2, evaluator independence) is not
      reopened here.
      **DONE 2026-08-30, and asserted more strongly than "does not call one".**
      The gap report takes the router as a caller-supplied PREDICATE, so there
      is no harness reference to follow: a future author cannot reach a live
      backend without changing the module's imports, which is a visible act in a
      diff. A test pins both — no import of `description_route_check` or
      `cross_model_smoke`, and no `cached-live`, `fetch(` or URL literal.
      verify: no step in this roadmap invokes a live routing harness.

## Phase 9 — Canonical enums, effect, and the consumption door

- [x] **9.1 One shared module per enum family** that appears in both
      `src/scripts/` and a template or prompt, plus a lint against inline
      duplicates. Phase 1.3's outcome-vocabulary split is the worked example and
      the first customer.
      **DONE 2026-08-30, and it found two live duplicates the old check could
      not see.** Three holes were closed, each of which let the check pass while
      covering nothing:
      (1) `VOCAB_SETS` omitted **`step`** — the one family with a sanctioned
      template twin, i.e. exactly the family 9.1 is about.
      (2) The walk started at `src/scripts` only, so **templates and prompts —
      the surface this step names** — were never scanned. Scanning only the side
      that cannot drift is not a check.
      (3) The suite asserted the offender list was empty and nothing else, so a
      detector broken into one that finds nothing would have passed forever. The
      detector is now extracted and tested in BOTH directions: it must FIRE on a
      planted duplicate of every covered vocabulary, and must NOT fire on a
      partial reference. A sweep that scanned nothing also fails now.
      **The two duplicates found:**
      `templates/scripts/work_engine/directives/backend/verify.ts` and
      `.../mixed/stitch.ts` each re-declared `['success', 'blocked', 'partial']`
      inline — the third and fourth copies of the step vocabulary. Both now
      derive from `Object.values(Outcome)` against `delivery_state.ts`, which is
      the template tree's declaration (templates may not import from
      `src/scripts/`, so the registry mirrors it rather than the reverse).
      verify: the lint fails on a reintroduced inline duplicate of any covered
      enum.
- [x] **9.2 State what this is part of, without inventing a parent.**
      `corrected-from-reproduction`: the master called this "the mechanical core
      of `road-to-canonical-wording-and-propagation`" and an attachment point
      for "the open script-twin decision from PR #1636". Verified on this tree:
      **no plan by that name exists.** `grep -rl` over `*.md`, `*.ts` and
      `*.json` returned zero hits when the check was run, and now returns exactly
      one — this roadmap, because the name is written here; a reader re-running it
      should expect that single self-hit and nothing else.

      It is not active, not
      parked, not a stub, not archived. The PR reference was **not checked**: that is an external system
      and this analysis ran offline by its own bound, so it is unverified rather
      than false. Either author the parent or drop the framing; do not cite a
      plan that does not exist.
      **Re-measured 2026-08-30 while executing this step, and that sentence was
      already stale.** The grep now returns **two** — this roadmap, and the
      review-input copy under `agents/evidence/reviews/`, created after the
      original was written. Both are self-hits: the name exists in this tree
      only because this step writes it down. The conclusion is unchanged and
      stronger for having been re-checked — **no plan by that name exists**, in
      any disposition.
      **This is the step's own failure mode, caught on itself.** A count written
      into prose goes false the moment the tree moves, and 9.2 is precisely the
      step about not citing what a grep cannot find. A reader re-running it
      should expect those two self-hits and nothing else.
      **The other stale citation this step is responsible for was corrected
      under 6.5**: `docs/contracts/no-runtime-boundary.md:40` is `stability:
      superseded` and its line 40 carries different text; the state-store test
      lives at `docs/contracts/resident-process-governance.md:78-82`.
      verify: the roadmap text cites only artefacts a `grep` in this tree finds.
- [x] **9.3 Show that the loop can make the estate smaller.**
      `from-skipped-parent`, an acceptance criterion in both parents and absent
      from the master: self-evolution must be able to *remove*. Prefer modify,
      merge, delete and crystallize over add. In a repository governed by an
      estate ratchet and a one-in-one-out gate, a learning loop that can only
      add is a growth engine.
      **DONE 2026-08-30, and the loop found the defect rather than a reviewer.**
      Mining the real audit stream — `extract_audit_patterns --min-count 2` over
      935 lines — mints exactly ONE pattern:
      `implement:success:delegation-policy`, **count 914**. A regularity that
      strong in a field that varied would be remarkable; in a field that does
      not vary it is arithmetic. Both shipped producers write the literal
      `['delegation-policy']`.
      **The prose that was deleted:** `audit-log-v1`'s `rules_applied` row read
      "Stable rule ids whose Iron Law fired this phase" — an OBSERVATION — which
      is false for every line either producer has ever written. A consumer
      following it computes a 100 % win rate for one rule and `undefined` for
      the other 118, and that reads as a finding.
      **Deleted, not softened**, and replaced by
      `src/scripts/_lib/audit_field_provenance.ts`: a sentence cannot stop a
      consumer aggregating over a constant, and a function they must call can. A
      test asserts the producers still write that literal, so the helper goes
      stale LOUDLY — a stale "this is a constant" would be exactly as misleading
      as the prose it replaced, in the other direction.
      The card is in the store with its `pattern_ref`, and the test proves it
      **admissible under the Phase 7 contract** via `checkCard` rather than by
      grepping for the word "falsifier" — a string match would pass on a card
      that merely mentions the field.
      verify: at least one repeated card has resulted in a removal — a
      deterministic query or helper replacing a prose instruction, with the
      prose deleted in the same change.
- [x] **9.4 One pre-registered paired question.** Not a metric catalogue.
      Exactly one core metric: the repeated-failure rate out of
      `extract_audit_patterns` (patterns whose outcome ≠ success across
      independent `work_id`s), read from the amended view per Phase 3. The
      verdict is a vector — quality held × cost × repeated failures — and a
      failed arm yields inconclusive, never a fabricated score. Both directions
      are written into the claims ledger before the data lands.
      **DONE 2026-08-30, and the commit ORDER is the artefact.** The verify line
      is a commit-ordering assertion, so `agents/evidence/experience-loop-prereg.md`,
      the `repeated-failure-rate` registry entry and the `status: unbacked`
      ledger claim all land in this commit — before any run exists. Nothing in
      them was written with a number in hand.
      **The negative carries the same force as the positive**, which is the
      clause that actually costs something: no movement, a rise, or an
      unmeasurable arm means the loop is not built out further on this evidence,
      the result is filed `resolved-null`, and **no re-scoped claim is invented
      afterwards** — "it helped in a different way than we measured" is
      precisely the move this pre-registration makes unavailable.
      **UNDERPOWERED is neither a pass nor a null**, mirroring `paired_verdict`:
      below the power floor the run settles nothing and may be cited for neither
      direction.
      **Efficacy must be measured externally.** A loop scored on whether it
      agrees with its own experience report validates itself, so no component of
      the verdict may be sourced from the report's output — the constraint the
      council attached to the runtime-consumption blocker, carried here rather
      than left there.
      verify: the negative consequence is committed before the measurement run.
- [x] **9.5 Freeze the experiment set.** `from-skipped-parent`: evaluator,
      corpus, task definition, baseline and protected fixtures are frozen for
      the duration of a comparison.
      **DONE 2026-08-30** — `src/scripts/_lib/experiment_freeze.ts`.
      **`assertUnchanged` THROWS rather than returning a verdict**, and that is
      the design decision rather than an implementation detail: a verdict is a
      value a caller mid-run can log and step past, and a caller mid-run has
      every incentive to — the run is already expensive and the drift usually
      looks small. An abort is the only shape that cannot be quietly absorbed,
      and "aborts rather than continuing" is what the step asks for in those
      words.
      **All five are covered by construction**: the test table asserts its own
      mutation set equals the frozen-element list, so a sixth element cannot be
      added to the type and silently go untested while the suite still reads as
      exhaustive.
      **A reordered fixture list is NOT drift.** Order is a property of how a
      caller enumerated a directory, not of the experiment, and a freeze that
      fired there would be switched off the first time it fired spuriously —
      which is how guards die.
      verify: a mid-run change to any of the five aborts the comparison rather
      than continuing it.
- [~] **9.6 The Class-C question, as an owner decision.** Deferred: may
      selection or routing consume experience at runtime? Reading it at runtime
      means deleting it changes *what* the system does, which the state-store
      test classifies Class C. Without an owner yes it stays a report. 7.2's
      epistemic type is what makes a partial yes expressible.
      <!-- blocked-by: runtime-consumption-of-experience -->

## Blockers

> **REPAIRED 2026-08-29 — both entries below were invisible to every gate and to
> the dashboard.** They were written as `### <slug>` without the literal
> `blocker:` prefix. `lint_roadmap_blockers.ts:40` matches
> `/^###[ \t]+blocker:[ \t]*(.+?)[ \t]*$/gim`, so neither entry parsed:
> `agent-config gates --all --json` returned **zero** blockers for this file
> while two live, maintainer-owned decisions sat in it, and `check_estate_count`
> counted neither. A roadmap advertising no blockers while carrying two is a
> silent miscount in the tracking layer, not a formatting nit — the gate is the
> only thing that surfaces these to anyone not reading the file.


### blocker: runtime-consumption-of-experience

- **Status:** resolved 2026-08-29 — **(c), defer until 9.4 has a measured
  effect; (a) and (d) are OWNER-RESERVED and this council did not take them.**
  AI council 2026-08-29, anthropic + openai, **2/2 convergent**, first review
  these blockers have ever had (they were invisible to every gate until the same
  change — see the § Blockers note).

  Both seats reached (c) by the same route: the question is *cheap to answer
  once 9.4 has a number and expensive to answer now*, and nothing in Phases 0–8
  depends on it. Both seats also volunteered, unprompted in openai's case, that
  **(a) and (d) require owner sign-off** because both cross
  `docs/contracts/no-runtime-boundary.md:40`, a recorded architectural boundary
  — a council may recommend crossing it and may not authorise it.

  anthropic added the point neither round-one critique had made: **(d) is not a
  weaker (a) but a different shape.** 7.2's epistemic split — observed and
  derived statements may filter, inferred and hypothesized ones may not — is
  load-bearing rather than arbitrary, because observed/derived are factual and
  inferred/hypothesized are generative. That makes (d) the natural next decision
  point after 9.4, not a fallback if (a) is refused.

  openai added the constraint that decides whether 9.4's number is worth
  anything: **runtime evidence must measure external efficacy, not agreement
  with the experience report.** A loop scored on whether it agrees with its own
  output validates itself. Carried into 9.4 rather than left here.
- **`revisit-if`:** step 9.4 demonstrates a reproducible efficacy gain measured
  externally, AND a proposal exists naming an observed/derived-only filter with
  rollback criteria. At that point (d) goes to the owner, not to a council.
- **Owner:** maintainer
- **Blocks:** Phase 9 step 9.6 only. Phases 0–8 and steps 9.1–9.5 are
  unaffected by design — this roadmap is cut so that a "no" leaves them fully
  valuable.
- **What to do:** pick exactly one — (a) grant runtime consumption, which
  requires a Class-C escalation under
  `docs/decisions/ADR-124-embedded-engine-doctrine.md:153` and an amendment to
  the state-store test in `docs/contracts/no-runtime-boundary.md:40`, or (b)
  refuse it, and the per-asset report stays a report a human and CI read, or (c)
  defer until 9.4 has produced a measured effect, so the decision is taken
  against evidence instead of against an intention, or (d) grant a **partial**
  yes bounded by 7.2's epistemic type — observed and derived statements may
  filter, inferred and hypothesized ones may not.
- **Resolved when:** the answer is recorded in ADR-124 or in the no-runtime
  boundary contract, either as a granted escalation with its scope or as a
  refusal with its reason.
- **Recommendation:** (c), then reconsider (d). The question is cheap to answer
  once 9.4 has a number and expensive to answer now, and nothing in Phases 0–8
  depends on it.
- **If you do nothing:** everything except 9.6 remains executable, and the
  effectiveness report exists without being consumed. That is a real outcome,
  not a stalled one — evidence, integrity and hygiene all land.

### blocker: experience-retention-policy

- **Status:** resolved 2026-08-29 — **(c), measure growth first; the retention
  STRUCTURE is council-decidable, the privacy-sensitive PARAMETERS are
  owner-reserved.** AI council 2026-08-29, anthropic + openai, **2/2 convergent
  on (c)** against the file's own recommendation of (a).

  The file recommended (a) — append-only with an explicit rotation rule — on the
  `docs/CLAIMS.md:691` precedent. Both seats refused (a) **now**, on a coupling
  the file itself states and neither round-one critique had followed through:
  this blocker and step 1.4 (a privacy class on every captured event) are *"the
  same decision seen from two sides"*. anthropic put the consequence plainly —
  approving (a) before 1.4 exists risks *"a commitment we must walk back"* the
  moment 1.4 identifies an event class that is unsafe to retain. Privacy
  classification precedes a retention commitment, not the reverse.

  openai refused the obvious version of (c) as well, and the correction is kept
  because it is the useful half: **a fixed one-month window is an arbitrary
  duration, not an evidence threshold.** Sampling continues until growth
  variability and the minimum viable retention window can be estimated, which
  may be shorter or longer than a month.

  **The refinement that changes what the rule must say:** retention must be
  expressed in **eligible observations as well as time or storage**. A 30-day
  policy still cannot support a ≥ 20-run claim if fewer than 20 privacy-safe,
  qualifying runs occur in 30 days — which is the `CLAIMS.md:691` failure in a
  new costume, and the reason (b) is not merely worse but actively misleading
  when stated in days alone.
- **`revisit-if`:** growth data exists sufficient to estimate variability, events
  carry privacy classifications from 1.4, and a bounded window can be stated in
  both eligible observations and time. The window VALUES then go to the owner;
  the append-only-versus-rolling structure does not.
- **Owner:** maintainer
- **Blocks:** Phase 6 step 6.1 at the point where the report is expected to
  clear a pre-registered floor; Phase 9 step 9.4's power claim.
- **What to do:** pick exactly one — (a) declare the ledger append-only with an
  explicit rotation rule and state the rule, (b) declare a rolling buffer and
  accept that any pre-registered floor above the retained window is structurally
  unreachable, stating so at the claim rather than at the roadmap, or (c)
  measure the growth rate first and decide after one month of real data.
- **Resolved when:** the retention rule is written into
  `docs/contracts/audit-log-v1.md` and the corresponding claim states its
  reachability.
- **Recommendation:** (a). This repository has already paid for the alternative:
  `docs/CLAIMS.md:691` records a pre-registered ≥ 20-run floor that is
  "**structurally unreachable with this instrument at default retention**",
  because the timing source is a rolling buffer at `DEFAULT_MAX_SESSIONS = 5` —
  "Waiting therefore does not fill this window; it rotates it." The same entry
  names the two exits: a source that is not a rolling buffer, or an explicit
  retention change **with its own privacy review**, which is why this blocker
  and step 1.4 are the same decision seen from two sides.
- **If you do nothing:** the report is built and its floor may be unreachable,
  and nobody finds out until a verdict is expected and cannot be given. That is
  the exact failure mode already recorded once in this tree, and a parent raised
  it as an open decision that the master then did not carry.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Rebuilding the loop instead of widening it | implementation | All three source proposals independently concluded that no learning loop existed. It does. A parallel loop produces two histories of the same work and no test catches it | The "What already exists" table is verified with file:line citations and every phase is phrased as a widening of a named carrier | Phase 1 — Broaden capture |
| 2 | Persistent experience retains what it must not | product | Mined experience lands in `agents/memory/`, a **tracked** path (verified: five files). Source excerpts, secrets, user text and customer data can ride along, and once committed a leak is not undone by a later edit | 1.4 makes the event type structurally incapable of holding free-form content, with a mandatory privacy class — the shape `domain-safety-pii` § Surface 2 prescribes | Phase 1 — Broaden capture |
| 3 | Anti-forgery marks legitimate work as failure | implementation | The unconditional "empty diff ⇒ not success" rule fails every read-only analysis and review dispatch. Those are a large share of this repository's subagent traffic, so the aggregation is poisoned in the direction that looks like rigour | 2.2 gates on the task's expected output contract instead of on the diff alone | Phase 2 — Outcome integrity: anti-forgery at the subagent return |
| 4 | Measuring self-report as if it were outcome | implementation | An aggregation built before the anti-forgery gate cannot separate a claimed success from a real one afterwards | Phase 2 lands before Phase 6; 6.1 counts a missing signal as unknown; 6.2 makes an estimated figure visibly estimated | Phase 2 — Outcome integrity: anti-forgery at the subagent return |
| 5 | A win rate that cannot be acted on | implementation | Without the activation-versus-adherence split, a low rate points at the asset's content when the real cause may be that the router never activated it. The wrong fix follows deterministically | Phase 5 adds the five-state split, with `unknown` where no evidence exists | Phase 5 — Activation versus adherence |
| 6 | The one core metric cannot be computed | implementation | Repeats and regressions arrive after the audit line is terminal. Without an amendment path the repeated-failure rate systematically under-reports | Phase 3 adds the episode lifecycle with append-only amendment | Phase 3 — Episode lifecycle and delayed amendment |
| 7 | Schema extension against a value that does not exist | implementation | A source proposal planned to write `clean-no-op` into a stream whose enum has four values and does not include it. Such a write looks successful while the consumer silently does not read it — live for any later step that resolves an outcome before the vocabulary is settled | 1.3 reconciles the two enums before either is extended; 9.1 makes reintroduction lintable | Phase 1 — Broaden capture |
| 8 | A rolling buffer makes a pre-registered floor unreachable | implementation | Already recorded once in this tree at `docs/CLAIMS.md:691`. A ledger whose retention rotates cannot back a floor above its window, and the discovery comes at verdict time | The `experience-retention-policy` blocker decides it before the report is relied on | Phase 6 — Evaluation: a per-asset report, read-only |
| 9 | The unknown share is treated as noise | product | A report whose unknown share is large reads as weak data and gets ignored, when the unknown share *is* the measurement of the capture gap and the most actionable number on the page | 6.1 reports unknown as a first-class share, never folded into neutral | Phase 6 — Evaluation: a per-asset report, read-only |
| 10 | Cards accumulate faster than they are reviewed | product | A card store growing without expiry becomes a second undocumented authority surface competing with rules, and a global-scope card mined from one repository's runs generalises on no evidence | 7.2 makes expiry, falsifier and epistemic type mandatory; 7.4 routes promotion through the human gate; 7.5 adds the scope ladder and transfer requirement; 9.3 requires a removal | Phase 7 — Experience cards |
| 11 | Retirement deletes a rare safety behaviour | product | Usage-based pruning is the report's most natural consumer, and a safety rule that fires rarely looks exactly like a dead one | 6.4 excludes authority and safety assets from usage-based pruning | Phase 6 — Evaluation: a per-asset report, read-only |

## Acceptance Criteria

- [x] AC-1 — Every phase names an existing carrier it widens, and no phase
      introduces a second store, second loop, or second promotion path.
- [x] AC-2 — No recorded `success` in the audit stream is backed by an empty
      change *against that task's declared output contract*, and a read-only
      analysis dispatch that satisfies its contract is not marked a failure.
- [x] AC-3 — The captured event type has no field capable of holding a prompt, a
      file body, or a path, and every event carries a privacy class.
- [x] AC-4 — The per-asset report distinguishes helpful, neutral, harmful and
      unknown, reports unknown as its own share, and states a basis on every
      derived figure.
- [x] AC-5 — A failing case is classifiable into one of the five
      activation/adherence states, and `unknown` is used wherever no evidence
      exists rather than a model's inference.
- [x] AC-6 — One outcome vocabulary is authoritative, or the mapping between the
      two is a committed module both readers import.

      **MET 2026-08-29 via the second disjunct, and the first is refused on
      evidence.** `src/scripts/_lib/outcome_vocabularies.ts` is the committed
      module, and both readers import it —
      `orchestration_record.ts` for `PhaseOutcome`, `outcome_envelope.ts` for
      `RunTerminalState`; `runtime_journal.ts` imports its value list too. The
      first disjunct is not taken because the producer trace under step 1.3
      showed three vocabularies with three different subjects, so declaring one
      authoritative would make the other two wrong rather than derived.

      **Stated precisely, because the AC's wording invites an over-claim:** what
      the module holds is the three vocabularies plus a REGISTRY of the crossings
      (`CROSS_DOMAIN_MAPPINGS`, one row). The mapping FUNCTION itself
      (`envelopeOutcome`) stays at its call site in `orchestration_record.ts`,
      where the translation actually happens; the module records that it exists
      and `tests/contracts/outcome_vocabularies.test.ts` asserts the named
      function resolves in the named file. Moving the function would relocate
      logic away from its only caller for no gain. So: both readers import the
      committed module — the AC as written — and the one real translation is
      registered and checked rather than relocated.
- [x] AC-7 — Nothing in any selection or routing path imports the experience
      report, until and unless the Phase 9 blocker is resolved with a yes.
- [x] AC-8 — The retention rule is written into the contract, and every claim
      resting on the ledger states whether its floor is reachable at that
      retention.
- [ ] AC-9 — At least one repeated-failure pattern has produced a reviewed card,
      and at least one card has been either promoted through
      `learning-to-rule-or-skill` or expired — so the lifecycle closes in both
      directions rather than only accumulating.
- [x] AC-10 — At least one removal has landed that the loop itself motivated:
      prose replaced by a deterministic query or helper, with the prose deleted
      in the same change.

## First cut — recommended start

Phase 1.2 plus Phase 1.3, together, on one real phase of `/work`.

Adding `skills_applied` is the smallest change that turns the existing loop from
rule-only into rule-and-skill, and it cannot be done correctly without settling
the enum split first — which makes the pair a genuine vertical slice: a schema
decision, a contract edit, a supersede migration, and a fixture proving real
emission. It touches no new persistence and no external system, so none of the
open contract questions gate it.

`from-skipped-parent` adds the reason to insist on a real slice this early:
that parent placed a mandatory end-to-end learning proof at the middle of its
programme rather than the end, with the framing question "are we building
self-evolution or just telemetry?" A master that ends at a report plus one owner
question is exactly the shape that question is aimed at. If the fixture cannot
prove real emission from a live phase, the capture premise of every later phase
is refuted, cheaply.

## Open maintainer decisions

- **E1 — Estate placement.** `corrected-from-reproduction`: the master raised
  this as a family-cap risk. Verified —
  `src/scripts/lint_roadmap_family_cap.ts:41` sets
  `FAMILY_PREFIX = 'road-to-skill-ecosystem-'` and counts only top-level active
  roadmaps, so that gate **cannot** fire on this name or the sibling's; it
  reports 0/2 slots used. The gate that does apply is `check_estate_count`.

  **Corrected after a neutral review, and it reverses this decision's force.** An
  earlier revision read "`active_roadmaps 3` against a floor of 7 — four slots of
  headroom". That was a pre-rebase reading; #1676 landed four roadmaps in the
  window named above. The gate now reports
  `active_roadmaps 7 (floor 7 at origin/main, +0)` — **at the floor, zero
  headroom.** These three clear it only because `status: draft` excludes them from
  the counted set and each carries `estate_offset_exempt` for the file-based half.
  So flipping any of them to `ready` without a disposal in the same change raises
  a floor already at its ceiling. The question is whether this roadmap and
  `road-to-governed-harness-evolution.md` stay separate or fold into one — they
  overlap on trigger evals, on the paired-verdict mechanism and on step 1.3.

  **RESOLVED 2026-08-29 — (b): stay separate, with every overlap assigned to
  exactly one canonical owner.** AI council, anthropic + openai, **2/2
  convergent**.

  **The estate argument is withdrawn, twice over.** First, the number above is
  **stale**: measured this run the gate reports `active_roadmaps 3 (floor 3 at
  origin/main)`, not 7 against 7. Second — and this is the part that matters,
  because it survives any future re-measurement — openai identified that the
  figure *"supplies no argument either way: because the floor is defined from the
  base reference, 'zero headroom' is a ratchet invariant, not evidence favouring
  a fold."* The sentence "folding is now the cheaper answer" was reasoning from a
  property every value of that metric has. E1 is therefore decided on the
  **overlap alone**, which is what it should always have been decided on.

  On the overlap, both seats read folding as the more expensive answer, not the
  tidier one: 47 + 58 steps in one file couples two large outcomes and makes
  completion illegible, and openai named the test that decides it — separation
  fails only if a shared mechanism *"cannot be independently completed"*. Nothing
  in the named overlaps is of that kind.

  **What (b) requires, and it is more than "stay separate".** Each shared
  mechanism — trigger evals, the paired-verdict mechanism, step 1.3's outcome
  vocabularies — gets **one authoritative roadmap**; the other may reference it
  and may **not** block on it, and duplicate completion claims are prohibited.
  anthropic named the failure this prevents, which neither round-one critique
  had: without it, both roadmaps can declare "trigger eval" blocked and neither
  owns resolving it. The assigned roadmap owns acceptance.

  **A fold is OWNER-RESERVED.** Both seats, unprompted, on the load-bearing
  question: the fold itself may be reversible, but the archival that follows is
  not, and it permanently changes the unit the estate ratchet counts. A council
  may recommend a fold; it may not manufacture that approval.

  **The canonical ownership matrix — ADDED 2026-08-29, and it was OWED.** The
  resolution above stated the *rule* (one authoritative roadmap per shared
  mechanism) and never assigned the mechanisms, so E1 recorded an obligation and
  did not discharge it. That gap was caught when the sibling roadmap's E2 asked
  whether this verdict transfers: both seats ruled it transfers **only by
  copying the exact matrix**, refused to infer the assignments — *"sequence
  position is not an ownership criterion"* — and required a fresh deliberation.
  It was held, 2/2 convergent. The criterion is **acceptance authority**: which
  roadmap may declare a mechanism complete so others may depend on it.

  | Overlap | Owner | What the non-owner does |
  |---|---|---|
  | Trigger corpus / trigger evals | `road-to-governed-harness-evolution` (its Phase 2) | **This roadmap's Phase 8** references the released corpus. Before release it may use a **non-canonical** labelled overlay for exploratory work only, and never claims trigger-corpus completion. |
  | Paired-verdict mechanism | `road-to-governed-harness-evolution` (its 4.3) | **This roadmap's 9.4** is pre-registration and evidence capture only. It does not build a partial mechanism and does not claim paired-verdict completion. |
  | Outcome-vocabulary reconciliation | **This roadmap, step 1.3** | The sibling's 1.4 is re-scoped to a non-blocking consumption reference with a provenance-carrying adapter. |

  On the third row the criterion decides against the intuition: the vocabulary
  materially shapes harness evaluation, which makes the harness look like its
  natural owner — but it governs captured outcomes, subagent returns, delayed
  amendments and episode integrity, and the harness *consumes* those semantics
  rather than originating their lifecycle.

  **A reference must not become a hidden gate.** Owner completion is neither an
  entry nor an exit criterion for the non-owner's phase; the non-owner continues
  in an explicitly non-canonical degraded mode, and every compatibility output
  carries provenance — source snapshot or version, adapter version, and
  `canonical: false` — so exploratory work can never later be read as owner
  acceptance. This clause is what keeps the matrix consistent with the "may
  reference, may not block" rule above rather than quietly reintroducing
  blocking dependencies under another name.

  **`revisit-if`:** further overlap emerges beyond the three named, or either
  roadmap can no longer state an independent completion condition, or cross-
  roadmap sequencing repeatedly blocks delivery, or the outcome vocabulary
  becomes an independently governed cross-system taxonomy, or a reconciliation
  finds the two vocabularies serve incompatible purposes and must stay separate
  with an explicit mapping rather than unify.
- **E2 — audit-log v2:** confirm the schema-bump procedure — supersede lines, or
  a new file generation?

  **RESOLVED 2026-08-29 — (a) additive field, no version bump.** AI council,
  anthropic + openai, **2/2 convergent**, and both seats called the roadmap's
  own wording a misreading. Step 1.2 says *"Migrate by `type=supersede` lines,
  exactly as that contract already prescribes for corrections"*. The contract's
  supersede clause (`docs/contracts/audit-log-v1.md:114`) governs **corrections**
  to a line that is wrong; adding a field makes no existing line wrong. The
  clause that governs an addition is the forward-compat rule at `:96` —
  *"Unknown trailing fields are forward-compat extensions; readers MUST NOT
  raise on them."* So `skills_applied` lands as an optional bounded trailing
  field, `schema_version` stays `1`, and no supersede lines are emitted.
  Restating historical entries would also **fabricate historical skill data**,
  which is the sharper reason.

  **The distinction that has to ship with it:** absence means *unknown / not
  recorded*; an empty array means *recorded, and none applied*. Collapsing the
  two would retroactively assign information to lines that never captured it —
  which is what turns an extension into a semantic migration.

  **`revisit-if`:** the field becomes mandatory, it changes another field's
  meaning, or readers cannot distinguish absent from empty. Any of those is a
  case for `schema_version: 2`, never for automatic historical supersedes.
- **E3 — Does `clean-no-op` count as its own outcome in the report?
  (Recommendation: yes.)**

  **RESOLVED 2026-08-29 — yes, as a tracked subtype of `neutral`, not a fourth
  top-level impact category.** AI council, anthropic + openai, **2/2
  convergent**. Two dimensions, kept apart: `outcome: clean-no-op` and
  `impact: neutral`. The neutral total is reported with a separate
  `clean-no-op` count, and empty-cycle / double-trigger metrics (step 2.3) stay
  separate from impact classification.

  **The attribution rule the council added, which the roadmap did not ask for
  and needs:** `clean-no-op` is a RUN terminal state while Phase 6 reports **per
  asset**. A run-level no-op must not be copied onto every asset that was merely
  loaded — each asset needs evidence it was actually evaluated. Without that,
  one no-op run makes every loaded asset look meaningfully consulted, which is
  the inverse of what the report is for.

  **`revisit-if`:** the helpfulness metric is redefined to measure assurance
  value and evidence shows verified no-op evaluations deliver it. Then the
  outcome distinction stays and only its impact mapping is reconsidered.
- **E4 — Card location** under `agents/memory/<type>/`, the per-card size
  budget, and — given risk 2 — whether cards belong in a tracked path at all.
- **E5 — SQLite index:** only at a measured JSONL latency limit, or not at all.
- **E6 — Phase 8 pilot scope** (proposal: 10 of the 94 eval-bearing skills, one
  shift pair per positive query) and which of the five shift axes are in.
- **E7 — The Phase 9 question** (placeholder: does showing the per-asset report
  in the review context reduce the repeated-failure rate?).
- **E8 — Incremental card updates (7.6):** adopt `ADD / UPDATE / REMOVE` deltas
  with a reflector/curator split, or keep full rewrites? One parent moved this
  from optional to core; the master cites the source and carries neither.
- **E9 — Terminology:** one canonical word for the card object, then propagate
  it. Phase 9's discipline applies reflexively to this decision.
- **E10 — Host scope.** The master scopes capture to Claude Code, the one host
  with a measured 164/164. The skipped parent required at least three materially
  different hosts (`road-to-outcome-grounded-harness-evolution.md:1662`,
  `:2500`). The capability matrix with
  `required / optional / unavailable / inferred` per field and the rule "never
  manufacture parity" is **not** from the skipped parent — it sits in one of the
  two declared parents
  (`road-to-evidence-gated-self-evolving-agent-config.md:1365-1373`), so the
  master dropped it having read it, which is a different failure from never
  having seen it. Corrected after a neutral review caught the marker on the wrong
  side. One host is defensible; the parity rule should be adopted either way.
- **E11 — Owner-reserved actions.** `from-skipped-parent` lists relaxing an
  evaluator threshold as owner-reserved. Confirm that, or name what else is.

## Killed — do not reintroduce without new evidence

| ID | Rejected | Reason |
|---|---|---|
| K1 | A new `src/` asset family, and pre-seeded strategy families | Additive push with no verified defect behind it; the card form in Phase 7 covers the empirical core and only ever arises from the mining gate. |
| K2 | Hub / network / credit / reputation-index / team-sharing / interop adapters | Stands on this tree: ADR-088 and ADR-216 (internal scope, adoption is not a goal) already settle it, and no defect verified here asks for any of it. The source proposals additionally cited an independent measurement reporting ~2 % asset reuse and >84 % of released assets bypassing validation; that figure was **not** checked here and is not load-bearing — recorded because it points the same way, not because it decides. |
| K3 | The ADR-reopen package | The runtime taxonomy exists (ADR-124 Class A/B/C); ADR-094 is owner-decided with revival behind an unmet gate. The single legitimate door is the Phase 9 blocker. |
| K4 | SQLite as the *source* of experience | Class C by the state-store test, quoted verbatim in 6.5. Admissible only as a rebuildable index. |
| K5 | An evaluator-mesh framework, personality/mutation objects, strategy presets, session-spawn directives, auto-issue-filing | No verified defect behind any of them, and several rest on mechanics that could not be inspected. Adopted from that cluster: exactly one rule — a missing signal is `unknown`, never `success`. |
| K6 | A resident runtime or daemon in this roadmap | ADR-124 § 5 is the named door and no defect here asks for it. |
| K7 | A metric catalogue without pre-registration | Exactly one core metric, per 9.4, and 0.3 requires a consumer for any metric at all. |
| K8 | The code graph as the foundation of episode linking, before re-measurement | `docs/CLAIMS.md:447` records mean recall 0.365 versus grep 0.797 with `code_graph.enabled` default false. **corrected-from-reproduction, and this makes the kill stronger than the master stated:** that claim now carries a 2026-08-26 scope correction saying the figures were measured on 2026-07-28 "against a build predating the extractor repair of 2026-08-22, so they describe a build that no longer exists". The null is stale by construction, not merely unreplaced — the honest position is *unknown*, in both directions. The re-run obligation sits in `agents/roadmaps/stubs/road-to-code-graph-benchmark-rerun.md`, which exists on this tree and is blocked on corpus inputs this machine does not hold. |
| K9 | An experience graph as a product surface | One parent specified twenty node types and twelve edge types; the other refused it for v1 and kept edges only where a query needs them. Append-only events plus a derived index first. |
| K10 | A global win score, popularity ranking, or publication reward | Effectiveness profiles with a denominator, a scope and an unknown share instead — the anti-Goodhart line both parents drew and the master kept. |

## Unverified in this analysis — carried as unverified, not as fact

The parents' mechanism citations into the external reference repository (signal
handling, the shift evaluator, the shared enum module, the solidify-learning
asymmetry) could **not** be checked here: that tree is not in this repository and
this analysis ran offline by its own bound. The *shapes* adopted in Phases 2, 4,
7.3 and 9.1 are justified by defects verified in **this** tree and stand on that
basis alone. No external line number is load-bearing anywhere above, and none
should be added without a fresh check. The same applies to the papers cited in
the parents and to the PR reference in 9.2.
