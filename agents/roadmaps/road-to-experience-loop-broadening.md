---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Added as a draft proposal, not as active work. Archiving is impossible (nothing has run), parking in later/ would grow the later_roadmaps floor instead of the active one, and folding it into road-to-governed-harness-evolution is exactly the open question E1 puts to the owner — pre-merging would decide it by authoring."
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

## Phase 0 — Scope, classification, decisions

- [ ] **0.1 Write a classification note, not an ADR rewrite.** Every runtime
      component lacking an explicit ADR-124 class label gets one. No ADR is
      rewritten, because the taxonomy the parents wanted to author already
      exists.
      verify: every entry in the runtime registry carries a class label, and
      `git diff docs/decisions/` is empty for ADR-124.
- [ ] **0.2 Fix the boundaries in writing.** ADR-094 untouched (Layer 2 revival
      stays behind its own gate); the runtime-consumption question is carried
      only as the Phase 9 gate, never assumed either way.
      verify: no step below reads experience data at selection or routing time.
- [ ] **0.3 Adopt consumer-before-producer for every metric.**
      `from-skipped-parent`, and it is the rule this repository has already paid
      for not having: each metric declares its `consumer`, the `decision` it
      feeds, and what fails if it is missing. "A metric with no consumer is
      telemetry decoration and should not land." The tree's own worked example
      is the 0.27 % dispatch capture this roadmap cites in 1.1 — a collector
      whose consumer arrived after the data did.
      verify: a metric added without those three fields fails the lint.
- [x] **0.4 Settle estate placement.** See E1.

      **Closed 2026-08-29.** E1 resolved by AI council 2/2 to **(b) stay
      separate**, with every named overlap assigned a single canonical owner and
      duplicate completion claims prohibited. The estate argument that E1 leaned
      on was withdrawn — its number was stale *and* the property it appealed to
      is a ratchet invariant rather than evidence. A fold is recorded as
      owner-reserved and was not taken.

## Phase 1 — Broaden capture

- [ ] **1.1 Spike whether the dispatch event is as reliable as the skill
      event.** `docs/CLAIMS.md:328` records the measured reality verbatim:
      "0.27% telemetry capture (370 dispatches, 1 recorded line)". The skill
      event by contrast is 164/164. Pre-register the numbers before building:
      success is ≥ 95 % capture over ≥ 50 dispatches; below that the result is an
      honest null and the work rescales to skill events.
      verify: the pre-registration commit precedes the measurement commit, and
      the measured rate is reported whichever way it lands.
- [ ] **1.2 Add `skills_applied` to the audit line.**
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
- [ ] **1.4 Carry a privacy class on every captured event, and a redaction rule
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
      verify: the event type has no field able to hold a prompt, a file body or
      a path; a fixture attempting to write one fails to compile.
- [ ] **1.5 Everything default-off and local.** No dark-channel ratchet is
      touched.
      verify: with the feature off, zero telemetry file operations and zero
      network calls — the shape `telemetry_usage_hook.ts:21-29` already
      documents for itself.

## Phase 2 — Outcome integrity: anti-forgery at the subagent return

- [ ] **2.1 Dock onto the existing stub, do not open a parallel plan.**
      `agents/roadmaps/stubs/road-to-subagent-return-gate.md` exists on this
      tree — verified — and carries the council decision this phase extends.
      verify: the stub is the referenced parent and no second gate is authored.
- [ ] **2.2 Gate anti-forgery on the task's expected output contract, not on
      the diff alone.** `corrected-from-reproduction`, and this reverses the
      master. The master ships the unconditional form — claimed success × empty
      diff ⇒ never `success`. The skipped parent named exactly that form as the
      reference implementation's defect: "zero diff may be valid. Therefore
      'zero diff = failure' must **not** be global. The gate must use expected
      artifact contract." Analysis, review and read-only research dispatches are
      a large share of this repository's subagent traffic and legitimately
      produce no diff; the unconditional rule would mark them all as failures
      and poison the very aggregation Phase 4 depends on.
      verify: a read-only analysis dispatch returning no diff but satisfying its
      declared output contract resolves to `success`; a code dispatch claiming
      success with an empty diff does not.
- [ ] **2.3 Count empty cycles separately.** A double trigger must not read as
      two outcomes.
      verify: a synthetic double trigger produces one outcome and one empty-cycle
      increment.
- [ ] **2.4 State the reason in the contract, not only in the code.** Without
      this gate every later aggregation poisons its own data, because an
      unverified self-report is indistinguishable from a result.
      verify: the contract text carries the rationale and the failure it
      prevents.

## Phase 3 — Episode lifecycle and delayed amendment

- [ ] **3.1 Give an episode a lifecycle, because outcomes arrive late.**
      `from-skipped-parent`: rework and regressions arrive after a task is
      already terminal, so an episode needs `open → terminal → observed →
      amended`, with historical events never rewritten — an amendment is a new
      record. The master has no lifecycle and no amendment path, while its
      **single** pre-registered core metric is the repeated-failure rate. A
      repeat is precisely the signal that surfaces after the audit line is
      written, so without amendment the master's one metric cannot be computed
      correctly.
      verify: an amendment arriving after a terminal state produces a new record
      and leaves the original byte-identical; the repeated-failure rate reads the
      amended view.

## Phase 4 — Loop guards for drain and continuation

- [ ] **4.1 Detect more than two shapes.** The master carries two counters —
      consecutive empty cycles, and the same signal or roadmap in ≥ 3 of the
      last 8 runs. `from-skipped-parent` adds three the master dropped: the same
      failure *signature* recurring, the same tactic repeated after it was
      rejected, and the same asset activating repeatedly with no progress. The
      last two are the ones a counter over signals cannot see.
      verify: a synthetic run repeating a rejected tactic trips suppression even
      when the signal string differs.
- [ ] **4.2 No strategy presets.** Suppression escalates through the existing
      triage ladder.
      verify: a run of 8 with 3 repeats trips suppression exactly once, and a run
      of 8 with 2 repeats does not.

## Phase 5 — Activation versus adherence

- [ ] **5.1 Separate "was it loaded" from "was it followed".**
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
- [ ] **5.2 Prefer deterministic adherence evidence where a rule has an
      observable footprint.** `from-skipped-parent`'s example: test-first
      discipline is provable from the order of the first observed write to a test
      file versus a production file. Where no footprint exists, adherence stays
      `unknown` — never inferred.
      verify: at least one rule has a deterministic adherence detector, and the
      rest report `unknown` rather than a model's guess.

## Phase 6 — Evaluation: a per-asset report, read-only

- [ ] **6.1 Aggregate over the audit JSONL.** Per rule and per skill: win rate,
      streak, and the harmful / neutral / **unknown** shares. A missing signal
      counts as unknown, never as success.
      verify: an asset with no signal appears with unknown ≠ 0 and win rate
      undefined, not with a fabricated score.
- [ ] **6.2 Every derived figure states its basis.** `from-skipped-parent`, and
      both a parent and the master's own rationale depend on it: each number
      carries `basis: measured | estimated:<method> | inferred | unknown`. The
      master lists win-rate, streak and the share fields and has no basis field,
      so a measured cost and an estimated one render identically — the exact
      self-report failure Phase 2 exists to prevent, reintroduced one layer up.
      verify: a report line with an estimated component that does not name its
      method fails the lint.
- [ ] **6.3 Report only. No runtime consumption.** A human or CI reads it;
      nothing in selection or routing does. Crossing that line is the Phase 9
      gate, not an implementation detail.
      verify: no import of the report module from any routing or selection path.
- [ ] **6.4 Wire the report to retirement, with a safety carve-out.**
      `from-skipped-parent` on both halves. The report's most obvious near-term
      consumer is the existing utilization-window retirement path — the ledger
      supplies the data, the rules stay the authority. And precisely there:
      pruning on low usage can delete a rare but important safety behaviour, so
      authority and safety assets are **excluded** from usage-based pruning. The
      master dropped both the wiring and the carve-out.
      verify: a low-usage safety-classified asset is not proposed for
      retirement, and a low-usage ordinary asset is.
- [ ] **6.5 Defer the SQLite index until latency is measured.** Allowed **only**
      as a rebuildable Class-A artefact under `agents/runtime/state/`; as the
      *source* of experience it is a contract violation.
      `docs/contracts/no-runtime-boundary.md:40` states the test verbatim: "if
      deleting the artifact changes *what* the tool can answer rather than only
      *how fast* it answers, it is a state store and prohibited".
      verify: deleting the index changes only runtime, and a rebuild reproduces
      it byte-for-byte from the JSONL.

## Phase 7 — Experience cards

- [ ] **7.1 Cards come only from the mining gate.** `extract_audit_patterns`
      count ≥ 2 over independent `work_id`s, outcome-differentiated — or from an
      explicit seed block. Never invented, never pre-seeded as families.
      verify: an attempt to author a card with no backing pattern is refused.
- [ ] **7.2 Field set, with a size budget.** Scope, trigger context, the
      strategy itself (compact), falsifier, confidence, contradictions,
      supersedes, expiry / review-by — plus an **epistemic type**
      (`observed | derived | inferred | hypothesized`), `from-skipped-parent`.
      The type is not decoration: only observed and derived statements may ever
      act as a hard filter, and inferred or hypothesized ones may at most
      influence ranking with reduced weight. That restriction is what makes the
      Phase 9 gate answerable in degrees instead of all-or-nothing.
      verify: a card missing a falsifier, an expiry or an epistemic type fails
      the lint.
- [ ] **7.3 Failures narrow, they never widen.** A failure adds an anti-pattern
      entry; it never extends the card's applicability scope.
      verify: a fixture where a failure attempts a scope widening is refused.
- [ ] **7.4 A card is not a rule.** Empirical, scoped and probabilistic versus
      normative. A duplicate lint runs against the existing rule and skill
      corpus, and promotion into authority happens only through
      `learning-to-rule-or-skill`.
      verify: a card whose text duplicates a live rule fails the lint.
- [ ] **7.5 Promote by scope, one level at a time, with transfer evidence.**
      `from-skipped-parent`: a card carries a scope on the ladder
      `session → repo → workspace → organization → global`, promotion moves one
      level at a time, and a raise beyond repo scope requires held-out or
      independent evidence rather than the same runs that produced it. The
      master gates promotion only on the human review skill, so a card mined
      from one repository's runs can become global on that repository's evidence
      alone.
      verify: a two-level raise is refused, and a raise past repo scope with only
      development-pool evidence is refused.
- [~] **7.6 Incremental card updates rather than rewrites.** Deferred: needs
      E8. `from-skipped-parent` promoted `ADD / UPDATE / REMOVE` delta-updates
      from optional to core, with a reflector/curator split whose boundary is
      "the model may interpret evidence; it may not rewrite the evidence". The
      master cites the source paper and carries neither the mechanism nor a
      decision about it.

## Phase 8 — Trigger-shift pairs, offline

- [ ] **8.1 Extend `triggers.json` backward-compatibly.** A `shift_of` field
      plus an axis set, producing an offline train-versus-shifted gap report in
      the `description_route_check` neighbourhood. The master lists three axes
      (wrapper, temporal, phrasing); `from-skipped-parent` adds host framing and
      context/tool availability, which are the two a purely textual shift cannot
      express. Pilot scope is a decision (E6).
      verify: existing `triggers.json` files parse unchanged, and the gap report
      is produced with zero live-harness calls.
- [ ] **8.2 The live-floors park stays parked.**
      `agents/roadmaps/later/road-to-routing-assurance-live-floors.md` exists on
      this tree and its council decision (2/2, evaluator independence) is not
      reopened here.
      verify: no step in this roadmap invokes a live routing harness.

## Phase 9 — Canonical enums, effect, and the consumption door

- [ ] **9.1 One shared module per enum family** that appears in both
      `src/scripts/` and a template or prompt, plus a lint against inline
      duplicates. Phase 1.3's outcome-vocabulary split is the worked example and
      the first customer.
      verify: the lint fails on a reintroduced inline duplicate of any covered
      enum.
- [ ] **9.2 State what this is part of, without inventing a parent.**
      `corrected-from-reproduction`: the master called this "the mechanical core
      of `road-to-canonical-wording-and-propagation`" and an attachment point
      for "the open script-twin decision from PR #1636". Verified on this tree:
      **no plan by that name exists.** `grep -rl` over `*.md`, `*.ts` and
      `*.json` returned zero hits when the check was run, and now returns exactly
      one — this roadmap, because the name is written here; a reader re-running it
      should expect that single self-hit and nothing else. It is not active, not
      parked, not a stub, not archived. The PR reference was **not checked**: that is an external system
      and this analysis ran offline by its own bound, so it is unverified rather
      than false. Either author the parent or drop the framing; do not cite a
      plan that does not exist.
      verify: the roadmap text cites only artefacts a `grep` in this tree finds.
- [ ] **9.3 Show that the loop can make the estate smaller.**
      `from-skipped-parent`, an acceptance criterion in both parents and absent
      from the master: self-evolution must be able to *remove*. Prefer modify,
      merge, delete and crystallize over add. In a repository governed by an
      estate ratchet and a one-in-one-out gate, a learning loop that can only
      add is a growth engine.
      verify: at least one repeated card has resulted in a removal — a
      deterministic query or helper replacing a prose instruction, with the
      prose deleted in the same change.
- [ ] **9.4 One pre-registered paired question.** Not a metric catalogue.
      Exactly one core metric: the repeated-failure rate out of
      `extract_audit_patterns` (patterns whose outcome ≠ success across
      independent `work_id`s), read from the amended view per Phase 3. The
      verdict is a vector — quality held × cost × repeated failures — and a
      failed arm yields inconclusive, never a fabricated score. Both directions
      are written into the claims ledger before the data lands.
      verify: the negative consequence is committed before the measurement run.
- [ ] **9.5 Freeze the experiment set.** `from-skipped-parent`: evaluator,
      corpus, task definition, baseline and protected fixtures are frozen for
      the duration of a comparison.
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

- [ ] AC-1 — Every phase names an existing carrier it widens, and no phase
      introduces a second store, second loop, or second promotion path.
- [ ] AC-2 — No recorded `success` in the audit stream is backed by an empty
      change *against that task's declared output contract*, and a read-only
      analysis dispatch that satisfies its contract is not marked a failure.
- [ ] AC-3 — The captured event type has no field capable of holding a prompt, a
      file body, or a path, and every event carries a privacy class.
- [ ] AC-4 — The per-asset report distinguishes helpful, neutral, harmful and
      unknown, reports unknown as its own share, and states a basis on every
      derived figure.
- [ ] AC-5 — A failing case is classifiable into one of the five
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
- [ ] AC-7 — Nothing in any selection or routing path imports the experience
      report, until and unless the Phase 9 blocker is resolved with a yes.
- [ ] AC-8 — The retention rule is written into the contract, and every claim
      resting on the ledger states whether its floor is reachable at that
      retention.
- [ ] AC-9 — At least one repeated-failure pattern has produced a reviewed card,
      and at least one card has been either promoted through
      `learning-to-rule-or-skill` or expired — so the lifecycle closes in both
      directions rather than only accumulating.
- [ ] AC-10 — At least one removal has landed that the loop itself motivated:
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
