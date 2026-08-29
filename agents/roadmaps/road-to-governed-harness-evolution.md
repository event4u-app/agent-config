---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Added as a draft proposal, not as active work. Archiving is impossible (nothing has run), parking in later/ would grow the later_roadmaps floor instead of the active one, and folding it into road-to-experience-loop-broadening is the open question E2 puts to the owner — pre-merging would decide it by authoring."
---
# Road to governed harness evolution

> **Source:** `agents/tmp.old/evolve/` — three session proposals plus the
> operator transcript. Every repo claim below was re-verified against this tree
> on 2026-08-26; the proposals were drafted against `1899f92b9`.
>
> **Corrected after a neutral review: the staleness window is not empty.** An
> earlier revision of this line said `1899f92b9` was "HEAD minus one commit", which
> was true when the verification started and false by the time this branch was
> pushed — the branch was rebased in between and the sentence was never
> re-measured. `git rev-list --count 1899f92b9..HEAD` reads **7**, of which three
> are upstream: `387dd3e68`, `82e47cefc` (#1676, four database-mastery roadmaps)
> and `9e8344a3f`. That matters here specifically: #1676 changed the very estate
> the E2 decision below reasons about, and reading a pre-rebase number is exactly
> how the first version of E2 got its figure wrong.
>
> **The consolidation those files produced was incomplete, and that is the first
> finding.** `road-to-governed-harness-evolution-master.md` names two parents it
> supersedes — `road-to-gated-self-evolution` v3 (128 lines) and
> `road-to-evidence-driven-harness-evolution` (1977 lines). It does **not** name
> `road-to-gated-harness-evolution-deep-v4.md` (1925 lines, Phases 0–10, kill
> register K1–K12), whose own header claims to supersede **both** of the parents
> the master did consolidate. So the deepest parent was skipped, and most of
> what looks "killed" in the master is in fact undiscussed. This roadmap folds
> that third parent back in.
>
> Items marked `corrected-from-reproduction` differ from the master because
> running or checking its step produced something else. Items marked
> `from-skipped-parent` come from deep-v4 and appear in no master — a claim to
> check, not a source: two such markers in this pair turned out to credit a
> declared parent instead. That parent is now citable, with its residual, in
> `agents/evidence/analysis/skipped-parent-lineage-2026-08-26.md`.

## Goal

An evolution laboratory exists that can generate candidate variants of a single
harness dimension, isolate them from the working tree, and evaluate them against
a frozen corpus — where the verdict comes from the paired-verdict mechanism the
tree already owns, and promotion into canonical `agent-config` remains a human
act. When this is finished, a candidate harness change can be shown to be better
or not better on pre-registered evidence; no candidate reaches canonical without
a named human decision; and the programme itself can be declared a success or a
failure against criteria written before the first run.

The load-bearing constraint: **most of what the source proposals wanted to build
already exists in this tree under other names.** This roadmap redirects to those
carriers and builds only the remainder.

## What already exists — verified, do not rebuild

| Wanted capability | Existing carrier | Verified on this tree |
|---|---|---|
| Candidate worktrees, isolated checkout, no writes to the original tree | `src/scripts/bench_ab_clone.ts` | `--variant` already carries three real variants (`with`, `without`, `with-rdp`) — its choice list is five, the other two being the aggregates `both` and `all` (`:289`, `:303`) — plus `--refresh`, `--print-shape-hash`, `target_shape_hash` (`:197`) |
| Leakage assertion / path-ownership sabotage fails closed | `src/scripts/bench_ab_integrity.ts` | present; byte-wise clone comparison |
| Paired verdict, direction over magnitude, `underpowered` is not a pass | `src/scripts/_lib/paired_verdict.ts` | `:25-26` four outcomes, `underpowered` "deliberately not a kind of pass"; `:54-65` the minimum discordant-trial floor is **derived** from the exact sign test, not chosen |
| Planted bad candidate rejected cheaply | `src/scripts/_lib/eval_publication.ts` | `PlantedItem` `:13`, `discriminationDeficit` `:31` |
| Evaluator hygiene, blinding, order-swap | `src/scripts/_lib/judge_hygiene.ts` | `:5-9` both orders; a flip resolves to `inconsistent` rather than to a winner |
| Deterministic lexical shortlist (no embeddings) | `src/scripts/_lib/lexical_index.ts` | `:9-15` the BM25 core ADR-061 already sanctions — pure Node stdlib, deterministic, in-memory per invocation |
| **Per-task delivery itself** | `src/scripts/_lib/lean_projection_mode.ts` | `:19` `LeanProjectionMode = 'eager-all' \| 'thin' \| 'delivery'`, `:21` default `eager-all`. **Three arms exist; `delivery` is simply not the shipped default.** |
| **One shared matcher across offline model and runtime** | `src/scripts/_lib/rule_injection.ts` | `:1-19` "THE single module both the offline model and the runtime concern read"; trigger semantics live in `_lib/router_match.ts`, "the single implementation for every surface", pinned by `tests/scripts/router_match_parity.test.ts` |
| Append-only evidence state precedent | `docs/contracts/audit-log-v1.md` | `:26` correction only via a new `type=supersede` line; `:85` the `type` enum |

**corrected-from-reproduction — the isolation work is smaller than the master
claimed.** The master described `bench_ab_clone` as living on a single "package
present / absent" axis needing an axis extension. It already carries a
`--variant` flag whose third real value (`with-rdp`) sits on a different axis
entirely. Adding a candidate variant is a new enum member on existing
multi-variant machinery.

## The parent disagreements — decide these, do not inherit a silent pick

The master resolved seven mechanism conflicts by adopting one parent's version
without recording that the other differed. Each is a real choice and each is
listed as a decision below rather than settled here.

| # | Mechanism | Parent A (evidence-driven) | Parent B (deep-v4, skipped) | Decision |
|---|---|---|---|---|
| 1 | Activation-ladder arity | 4 states: `eligible → selected → injected → consumed/adhered` | 6 states, splitting `projected/delivered` from `visible` | E4 |
| 2 | Minimality tie-break order | tokens → artifacts → scope → precedence | scope → precedence → tokens → artifacts → **simpler mechanism** (5th criterion) | E5 |
| 3 | Curator operation set | `ADD / MERGE / REVISE / SKIP` | `KEEP / ADD / MERGE / REPLACE / SPLIT / RETIRE / SKIP`, arguing by name that the 4-op set is "incomplete … because split and retire are first-class anti-sprawl actions" | E6 |
| 4 | When the sealed holdout opens | every cascade run (stage 8 of 9) | **killed** as every-iteration; three partitions, sealed set for promotion candidates only | E7 |
| 5 | State-taxonomy arity | 4 classes | 5 — adaptive split into experiment-adaptive and production-adaptive, the latter prohibited/default-off | E8 |
| 6 | Cascade stage set | 9 stages, no distinct activation or adherence stage | 12 stages, with activation/delivery and adherence as their own | E9 |
| 7 | Candidate arity | 9 mutation dimensions, no arity limit | **one primary dimension per candidate**, consolidation as a separate re-run | E10 |

Conflicts 1, 6 and 7 interact and should be decided together: Phase 1's exit
criterion asks for a content-vs-activation-vs-adherence classification that a
9-stage cascade with no adherence stage cannot produce, and a per-candidate
metric vector is uninterpretable if a candidate may change several dimensions at
once.

## Phase 0 — Constitution, reconciliation, budget, stop conditions

- [ ] **0.1 Write the inventory matrix as this phase's exit criterion.** A table
      of `planned capability → existing carrier in the tree → redirect / extend /
      build new (with the reason)`. Starting content is the table above. The
      phase does not close while a row reads "build new" without a stated reason
      no carrier fits.
      verify: `agents/evidence/analysis/` carries the matrix with an
      `<!-- evidence-type: analysis -->` first line, and every later phase names
      a row in it.
- [ ] **0.2 Reconcile the estate with an explicit disposition per overlapping
      plan.** `from-skipped-parent`: the skipped parent made this a P0 exit
      criterion with a five-verb disposition — `own here / fold into existing /
      depend on existing / supersede proposal / drop` — and the closing
      invariant "no duplicate execution owner". The master demoted the same
      question to an unanswered open item. The five-verb form is strictly
      stronger and covers roadmap-vs-roadmap ownership, which the capability
      matrix in 0.1 does not.
      verify: every roadmap this one overlaps carries one of the five verbs, and
      no capability has two execution owners.
- [ ] **0.3 Name the state classes without touching any claim.** Label
      authoritative / derived / evidence / adaptive state, citing
      `docs/contracts/audit-log-v1.md` as the already-sanctioned evidence-state
      precedent. Whether the adaptive class splits in two (E8) is decided here.
      Explicitly out of scope: the `no-runtime-daemon` public claim.
      verify: `grep -c 'claim:no-runtime-daemon' README.md` returns **0** and
      `docs/CLAIMS.md` shows no diff for that entry attributable to THIS
      roadmap.
      <!-- corrected 2026-08-27: the clause read "still returns 1", which was
      true when written and is now false. `road-to-runtime-governance-flip`
      Phase 2 retired the claim under ADR-249 — the ledger entry moved from
      `backed` to the new `withdrawn` status and the README marker was removed
      as part of that roadmap's delivery Group B. The clause's PURPOSE is
      unchanged and is the reason it is repaired rather than deleted: it is a
      no-collateral-damage guard asserting that step 0.3 does not touch the
      public claim while labelling state classes. It was keyed to a literal
      count, and a guard keyed to a count breaks the moment a different
      roadmap legitimately changes it. The count is now 0 and the guard reads
      against the post-retirement state. -->
- [ ] **0.4 Make the evaluator trust boundary detectable, not just declared.**
      `from-skipped-parent`, and this is the gap that mattered most: the master
      defines which fields are proposer-visible and which are evaluator-private
      and stops there. Add a per-field `visibility_class` on every observation, a
      log of every field disclosed to a proposer, and a run abort when holdout
      truth appears in proposer context.
      verify: a run in which a holdout value reaches proposer context exits
      non-zero, and the disclosure log names the field.
- [ ] **0.5 Pre-register the budget invariant.** Candidate count, trial
      repetitions and a spend ceiling per run, fixed before the run. Exceeding it
      aborts rather than truncates — a truncated run yields `underpowered`, which
      `paired_verdict` refuses to call a pass and which a reader mistakes for one.
      verify: a run configured past the ceiling exits non-zero before spending.
- [ ] **0.6 Pre-register stop conditions on epistemic invalidity, not only on
      spend.** `from-skipped-parent`: both parents carried eight or nine stop
      conditions; the master compressed them into the budget cap. A spend cap
      stops on cost, and most of those conditions stop on validity — holdout
      becomes underpowered · evaluator leakage detected · candidate diversity
      collapses to semantic duplicates · cross-component interference prevents
      credit assignment. Stopping with INDETERMINATE is a valid result, and an
      honest null is a success when it prevents unnecessary architecture.
      verify: each condition has a detector or is explicitly marked
      model-carried; a synthetic diversity collapse trips the stop.
- [ ] **0.7 Define programme success and failure before the first run.**
      `from-skipped-parent`: the master has no success-criteria section at all.
      It adopts the per-candidate metric vector and drops the per-programme
      metrics, so nothing defines when Phases 0–7 as a whole have succeeded.
      Carry the four families both parents named: harness-update quality ·
      harness benefit · system quality · **evolution efficiency** (cost per
      promoted improvement, trials per frontier improvement, share rejected at
      cheap cascade stages, proposer cost against solver benefit).
      verify: the criteria are committed before the first candidate run and are
      falsifiable in both directions.
- [~] **0.8 Merge authority resolved.** Deferred: owner decision, see
      Blockers. <!-- blocked-by: merge-authority -->

## Phase 1 — Observation and the activation ladder

- [ ] **1.1 Record the activation ladder, not a flat category.** Per E4, either
      the 4-state or the 6-state form; the recommendation is the 6-state one
      because Phase 6 measures delivery and `delivered ≠ visible` is exactly
      that axis. Add the precedence receipt naming why a step did not advance
      (lost to a higher-priority rule · host restriction · pack filter · missing
      projection · context budget · contradictory instruction). This replaces the
      master's flat `rule/skill/hook/router/host/model` attribution, which names
      a category and not a place.
      verify: a deliberately failing trigger eval is classifiable as *content*
      vs *activation* vs *adherence* from the recorded receipt alone.
- [ ] **1.2 A missing state stays unknown.** `from-skipped-parent`, one line
      and load-bearing: a state that was not observed must remain
      missing/unknown and is never silently converted to success. This is the
      ladder's soundness invariant; without it every downstream rate is inflated
      by exactly the capture gap.
      verify: a record with an unobserved rung reports `unknown` for it, and no
      aggregation folds `unknown` into a success denominator.
- [ ] **1.3 Extend an existing carrier, do not add a store.** The receipt is a
      field addition to `audit-log-v1` or `decision-trace-v1`, migrated by
      `type=supersede` lines as that contract already prescribes.
      verify: the contract's schema table carries the new field and the
      append-only migration note; no new path under `agents/runtime/state/`.
- [x] **1.4 Reconcile the two outcome vocabularies before extending either.**
      `corrected-from-reproduction`, and no proposal in either folder noticed:
      this tree holds **two** outcome enums — `audit-log-v1:77` has four values
      (`success · blocked · skipped · error`) and
      `src/scripts/_lib/outcome_envelope.ts:24-30` has six
      (`success · clean-no-op · blocked · approval-required · exhausted ·
      stagnated`). The sibling roadmap
      `road-to-experience-loop-broadening.md` owns the reconciliation; one of its
      source proposals planned to write `clean-no-op` into the audit stream,
      where that value does not exist, which is how the split was found. This
      step depends on that one; it does not duplicate it.
      **RE-SCOPED 2026-08-29 by AI council (2/2) — this step no longer performs
      the reconciliation and no longer carries its acceptance test.** The
      ownership matrix assigns outcome-vocabulary reconciliation to
      `road-to-experience-loop-broadening` **step 1.3**, on the criterion of
      **acceptance authority**: the vocabulary governs captured outcomes,
      subagent returns, delayed amendments and episode integrity, and this
      harness *consumes* those semantics rather than originating their
      lifecycle. The prose above already said the sibling owns it — but the old
      `verify:` was the OWNER's acceptance test ("one module exports the enum
      both readers import, and a lint rejects an inline duplicate"), so this
      step could have declared the mechanism complete. That is the duplicate
      completion claim the matrix prohibits, and it is why re-scoping was needed
      even though the sentence looked right.

      **It is a reference, and a reference must not become a hidden gate.**
      Completion of `experience-loop-broadening` 1.3 is neither an entry nor an
      exit criterion for this phase. Until it lands, this roadmap preserves its
      current vocabulary and any cross-vocabulary translation is an **explicit
      adapter** whose output carries provenance — the canonical snapshot or
      version it mapped from, the adapter version, and `canonical: false` — so
      exploratory work here can never later be mistaken for owner acceptance.
      The adapter's behaviour on unknown, unmapped and lossy translations is
      defined at the adapter, not assumed.
      verify: this step declares no reconciliation complete; the enum module and its
      anti-duplication lint are asserted by `experience-loop-broadening` 1.3 and not
      here, and any translation emitted by this roadmap carries `canonical: false`
      with its source version.

      **CLOSED 2026-08-29, and the accounting is per conjunct, because two of the
      three are satisfiable in different ways and the third is vacuous.**

      1. *"this step declares no reconciliation complete"* — **met.** The step
         performs nothing and claims nothing. The old owner-style `verify:` that
         could have declared the mechanism complete was already removed by the
         2026-08-29 re-scoping above; this closure does not restore it.
      2. *"the enum module and its anti-duplication lint are asserted by
         `experience-loop-broadening` 1.3 and not here"* — **met.** That step is
         now closed and its assertions exist:
         `src/scripts/_lib/outcome_vocabularies.ts` is the registry and
         `tests/contracts/outcome_vocabularies.test.ts` is the anti-duplicate
         check, both authored under 1.3, neither under this roadmap. Read
         precisely, this conjunct is a claim about **where the assertion lives**,
         not about whether it has merged — which is the reading the clause
         requires, because the paragraph above forbids sibling completion from
         becoming an entry or exit criterion here. Landing on the sibling's
         branch, not this one.
      3. *"any translation emitted by this roadmap carries `canonical: false`
         with its source version"* — **VACUOUS, and recorded as vacuous rather
         than as met.** This roadmap emits no cross-vocabulary translation
         today, so the conjunct quantifies over an empty set. A check would scan
         nothing and exit green, which is worse than no check: it would look
         like coverage. The obligation is therefore carried into the exit
         criteria of the first phase that actually emits a translation, where
         the set is non-empty and the provenance fields (source snapshot or
         version, adapter version, `canonical: false`) can be asserted against
         a real artefact.

      **What this closure buys, since the step builds nothing:** it discharges
      the E1 ownership matrix. Before this, both roadmaps carried a step for the
      same mechanism and either could have declared it complete — the duplicate
      completion claim the matrix prohibits. Now exactly one does, and this side
      records the dependency without gating on it. The corrected FACTS from the
      owner's side also land here: there are **three** vocabularies, not the two
      this step's prose names — the third is the work-engine STEP enum at
      `src/agent-src/templates/scripts/work_engine/delivery_state.ts:39`
      (`success · blocked · partial`) — and the four audit-log values are not
      documentation-only, since `LineOutcome` is declared in code and
      `envelopeOutcome` returns all four. The prose above is left as written
      because it is the record of what was believed when the step was authored;
      the correction is here rather than as a silent edit to it.

## Phase 2 — Trigger corpus: census first, coverage second

- [ ] **2.1 Run a census before naming a target.**
      `corrected-from-reproduction` **and** `from-skipped-parent`, and this
      reverses the master's phase title. The master titled its phase
      "Trigger corpus 94 → 299". The skipped parent explicitly **killed** that
      shape — "100 % trigger coverage as a vanity target … coverage must have
      discriminative fixtures; non-self-activating artifacts are treated
      explicitly" — and forbade reusing 94/99/299 without explaining what each
      counts. Reproduced on this tree: `ls src/skills/*/evals/triggers.json | wc
      -l` → **94**; `ls -1d src/skills/*/ | wc -l` → **299**;
      `find src -path "*/evals/*" -name "*.json" | wc -l` → **175** total
      specification files, of which 99 are `triggers.json` (94 skills plus 5
      under `src/domains/`). Separately the *gate* surface is
      `src/scripts/trigger_eval_grandfather.json`: its own note reads "Frozen
      2026-07-08 at 221 of 264 skills" and it currently holds **205** entries,
      so the shrink-only ratchet has already walked down 16. Partition 299 into
      routable and non-self-activating before choosing any denominator.
      verify: the census file names the exclusion criterion per non-routable
      skill, and the phase target cites a partitioned number, not 299.
- [ ] **2.2 Prioritise waves, do not sweep.** Order corpus work by defect
      evidence, not alphabetically.
      verify: the wave order is committed with a stated criterion per wave.
- [ ] **2.3 Author a four-class corpus, not two.** `from-skipped-parent`: the
      master's recipe is positives plus near-misses. Both parents required
      success exemplars, failures, near-misses **and** counterexamples, with
      selection seeing the full frozen corpus — the mechanism against
      survivorship bias in the corpus itself.
      verify: every corpus file carries all four classes, and a fixture proves
      selection reads the whole frozen set.
- [ ] **2.4 The grandfather list may only shrink.**
      verify: `./scripts-run src/scripts/check_trigger_eval_presence` green and
      the grandfather entry count strictly below 205.
- [ ] **2.5 Freeze the holdout partition here, before any proposer exists.** If
      the pipeline that later optimises against the corpus also grew it, the
      holdout is compromised before it is used.
      verify: the partition is content-hash pinned in a committed file whose
      hash predates the first Phase 5 commit.

## Phase 3 — Candidate isolation and lifecycle

- [ ] **3.1 Add a candidate variant to the existing variant enum.** A new member
      plus its surface definition; `bench_ab_integrity` keeps asserting
      byte-wise against it.
      verify: five candidates materialised and destroyed with no diff in the
      original tree; sabotaging a path ownership makes `bench_ab_integrity` exit
      non-zero.
- [ ] **3.2 One primary dimension per candidate.** `from-skipped-parent`, raised
      to doctrine level there and absent from the master. Reducing the mutation
      *alphabet* to three dimensions — which the master did — is not the same
      invariant as limiting a candidate's *arity*. If routing and body both
      change and the score moves, the credit is ambiguous and the Phase 4 metric
      vector cannot be read per candidate. Multi-dimension consolidation is a
      separate, later re-run, not a candidate.
      verify: the schema rejects a candidate touching two primary dimensions,
      and a consolidation run is a distinct record type.
- [ ] **3.3 Restrict the mutation alphabet to three dimensions.** `activation`,
      `routing`, `content`. Precedence, composition, verification, tool
      strategy, budget and scope are named and unimplemented until the three
      carry.
      verify: the schema rejects a mutation naming a fourth dimension.
- [ ] **3.4 A candidate lifecycle state enum, so "mutated" and "accepted" cannot
      be confused.** `from-skipped-parent`: both parents made this the
      structural guard, one tracing the defect to the reference implementation
      passing `mutated` in where `accepted` was expected. The master has no
      lifecycle states. Minimum set: proposed → diagnostic-evaluated →
      selection-evaluated → promotion-eligible → sealed-evaluated →
      promotion-proposed → promoted | rejected | retired.
      verify: no code path reads a candidate as accepted from the mere fact that
      it exists; a state transition skipping a stage is refused.
- [ ] **3.5 Ship a deterministic proposer first.** Fixed recipes for known
      defect classes, so the loop is validated without model quality as a
      confound.
      verify: the same input produces byte-identical candidates across two runs.
- [ ] **3.6 Give the operator a command surface.** `from-skipped-parent`: a
      verb set (`inspect`, `propose`, `run`, `compare`, `explain`, `promote`,
      `clean`) with no background loop. This is what makes "command-scoped, no
      daemon" enforced rather than asserted, and the master's Phase 3 exit
      criterion — "five candidates can be created and destroyed" — names no verb
      that would do it.
      verify: every phase's exit criterion is reachable through a named verb,
      and no verb starts a resident process.

## Phase 4 — Evaluation

- [ ] **4.1 Cascade cheap to expensive, abort on the first hard failure.** The
      stage set is E9; if the 12-stage form is chosen, activation/delivery and
      adherence are their own stages, which is what Phase 1's exit criterion
      requires.
      verify: a candidate failing the cheapest stage consumes no model call, and
      the stage list can produce the Phase 1 classification.
- [ ] **4.2 Report a metric vector, never a weighted total.** Include an
      `artifact-count delta` row — that is where the sprawl concern belongs,
      inside the gate where it can prevent something.
      verify: no code path computes a single scalar score.
- [ ] **4.3 Make the verdict hierarchy explicit.** `paired_verdict` per metric
      decides; `underpowered` is not a pass; a Pareto frontier may only order
      candidates that are already non-dominated and never promotes.
      verify: a fixture where the frontier prefers a candidate whose
      `paired_verdict` is `underpowered` produces no promotion.
- [ ] **4.4 Keep a pathology archive, not only a frontier.**
      `from-skipped-parent`, and it was that parent's headline contribution: a
      pure frontier loses the information about *why* a candidate exists, so
      archive the best intervention per `WHERE × WHY` failure cell over closed
      vocabularies. The master adopted the attack "search collapses into
      paraphrases" and dropped the mechanism proposed to prevent it, with no
      kill ID.
      verify: two candidates with equal vectors but different pathology cells
      are both retained, and a diversity-collapse stop (0.6) reads the archive.
- [ ] **4.5 Minimality breaks ties.** Order per E5, and include the fifth
      criterion the skipped parent added: simpler mechanism. Note that the two
      parents' orders invert, so identical candidates resolve differently
      depending on the choice — this is not a formatting detail.
      verify: two candidates with identical vectors resolve deterministically
      under the committed order.
- [ ] **4.6 Select regressions from the affected neighbourhood.**
      `from-skipped-parent`: use the code graph to choose which regressions to
      run for a given candidate. The master adopted the attack "local
      improvement, global regression" as a risk with no mechanism behind it.
      This is distinct from the killed curriculum generator — it selects
      existing regressions, it does not author tasks.
      verify: a candidate touching one surface runs the regressions its
      neighbourhood names, and a fixture proves a neighbour regression is caught.
- [ ] **4.7 Reuse the discrimination and hygiene machinery.**
      `eval_publication.PlantedItem` for plants, `judge_hygiene` for order-swap.
      Add the evaluator-promotion procedure the master omitted: an old and a new
      evaluator must cross-grade frozen candidate sets, and evaluator promotion
      itself requires discrimination plants.
      verify: a planted candidate the control arm also satisfies is reported as
      a discrimination deficit, not as a win; an evaluator change with no
      cross-grade is refused.

## Phase 5 — Body signal and the proposer roles

- [ ] **5.1 Measure the description-vs-body signal, honest null permitted.**
      `corrected-from-reproduction`: the master justified this by pointing at a
      proxy gap the tree documents as unquantified. That gap is real but it is a
      **different** gap. `src/scripts/description_route_check.ts:18-30`
      documents the *proxy-to-real-session* gap — "a green run here is evidence
      that the description signal did not regress. It is NEVER evidence that
      production routing works … until that measurement exists the gap is
      unquantified rather than small". Whether the skill *body* carries
      additional routing signal is a second, separately unmeasured question.
      Pre-register a threshold for the body question specifically; an honest null
      is a legitimate outcome. Carry proxy-to-real fidelity as its own metric —
      it bounds the validity of every routing conclusion in this roadmap.
      verify: the pre-registration lands before the first measurement commit and
      names both gaps separately.
- [ ] **5.2 Keep the live-floors park intact.** No live harness.
      `agents/roadmaps/later/road-to-routing-assurance-live-floors.md` exists on
      this tree — verified — and its council park (2/2) is not reopened here.
      verify: no step in this roadmap invokes a live routing harness.
- [ ] **5.3 Split the roles: analyzer, curator, proposer.**
      `from-skipped-parent`, which states the failure directly — do not collapse
      them into one unconstrained rewrite prompt. The master has one LLM
      proposer plus a one-shot compiler, so the curator role that owns lifecycle
      operations has no home. An optional judge model grades rubric questions
      only, under a frozen evaluator contract.
      verify: the three roles are separate prompts with separate input sets, and
      the judge cannot see outcome truth.
- [ ] **5.4 An LLM proposer must beat the deterministic one to survive.** On at
      least one pre-registered eval family, with an explicit hypothesis and a
      named falsifier per mutation. Otherwise the deterministic path stays.
      verify: the comparison is a `paired_verdict` run, not an argument.
- [ ] **5.5 Curator operation set per E6.** The skipped parent argues the 4-op
      set is insufficient because split and retire are first-class anti-sprawl
      actions; the 7-op set is the recommendation. Candidates only, never
      promotions. Run `src/scripts/_lib/shingle_similarity.ts` as a
      deterministic pre-stage before any model judgment.
      verify: a near-duplicate candidate is caught by the similarity stage with
      zero model calls.
- [ ] **5.6 Cheap proposer models first, and track evolution ROI.**
      `from-skipped-parent`, and this one is self-undercutting in the master:
      its own cross-critique faults both parents as cost-blind and answers with
      a hard budget cap, while dropping the only cost-*reduction* mechanism both
      parents proposed. Improvement per evolution dollar is a reported figure.
      verify: the ROI figure appears in every run report, and a cheaper model is
      tried before an expensive one on each defect class.

## Phase 6 — Delivery: measure the existing substrate first

- [ ] **6.1 Run the three-arm experiment on what already ships.**
      `corrected-from-reproduction`, and this is the strongest single finding of
      the analysis. The master's delivery phase builds a BM25 per-task subset.
      Verified on this tree:
      `src/scripts/_lib/lean_projection_mode.ts:19` already defines
      `LeanProjectionMode = 'eager-all' | 'thin' | 'delivery'` with `eager-all`
      as the default (`:21`) — the third arm exists and is simply not shipped.
      The skipped parent named exactly this as its major correction and killed
      "new delivery engine from scratch". Building the subset before measuring
      `eager-all` against `thin` against `delivery` is the parallel-rebuild
      failure this roadmap's own top risk names, committed inside the roadmap
      whose thesis it is.
      verify: the three arms are measured against one another before any new
      retrieval component is written.
- [ ] **6.2 Preserve one matcher.** `from-skipped-parent`, and the tree already
      enforces it: `src/scripts/_lib/rule_injection.ts:1-19` is "THE single
      module both the offline model and the runtime concern read", trigger
      semantics live in `_lib/router_match.ts` as "the single implementation for
      every surface", and `tests/scripts/router_match_parity.test.ts` pins it.
      An experiment whose offline pricing and runtime delivery use different
      matchers measures nothing.
      verify: the parity test stays green and no second matcher is introduced.
- [ ] **6.3 Only then consider a lexical shortlist, and only as a shortlist.**
      Over the existing BM25 core. No embeddings —
      `docs/contracts/no-runtime-boundary.md:40` classifies a vector/embedding
      index as a **contract violation**, not a preference: "a vector/embedding
      index fails — it enables query semantics absent from source, and stays
      Class C". The BM25 core passes the same test. The skipped parent proposed
      the shortlist and explicitly refused it as final truth.
      verify: the shortlist feeds a later stage and never decides alone.
- [ ] **6.4 Pre-register the loss ceiling, and measure set compatibility.**
      Recall-loss ceiling and token target fixed first; report precision,
      recall, false activation, context cost, benefit **conditional on**
      activation — and, `from-skipped-parent`, **set compatibility**: cases
      where two individually relevant skills are jointly wrong. The right
      question is which *set* to deliver together, not only which single
      artefact is closest. The corpus fixtures for it are authored in 2.3.
      verify: the ceiling is committed before the run, and the corpus contains
      at least one jointly-wrong pair.
- [ ] **6.5 Index the body only if 5.1 measured a signal.** Otherwise
      description-only.
      verify: the indexer's input set derives from the 5.1 verdict file.

## Phase 7 — Promotion bridge and the lifecycle after it

- [ ] **7.1 One evidence package per promotion, in the fuller form.** The master
      adopted a 9-field package; the skipped parent's has 14, and the five extra
      are exactly the fields that make 3.2, 4.4 and 7.3 auditable: pathology
      cell, candidate lineage, mutation dimension, selection results, sealed
      result, cost, scope.
      verify: a promotion attempt with any field absent is refused.
- [ ] **7.2 Route through the existing gate, not a second governance system.**
      Reuse the evidence-grading vocabulary already in the tree
      (`authority_basis`, `evidence.strength`, `reopen_policy`,
      `protected_dimensions`).
      verify: no new governance verb, no new approval path.
- [ ] **7.3 Promote by scope, with a transfer gate.** `from-skipped-parent`,
      raised to doctrine level in both parents and absent from the master's
      promotion path: a candidate carries a scope (episode → repo → stack →
      profile/pack → global) and moving up a level requires independent transfer
      evidence from a second solver or host configuration. Without it, every
      promotion goes straight to canonical and the anti-bloat doctrine has no
      teeth. This is not what the parked curriculum generator was.
      verify: a promotion with no scope field is refused, and a scope raise with
      one configuration's evidence is refused.
- [ ] **7.4 Reject semantic no-ops.** A no-op detector plus a minimum
      material-improvement threshold. The master kept the cooldown and lineage
      from the same attack and dropped both gates.
      **Marker corrected 2026-08-26:** this step carried
      `from-skipped-parent`, and it should not have. The clause is at
      `road-to-evidence-driven-harness-evolution.md:1200-1201` — a **declared**
      parent — and the skipped parent contains no no-op gate at all (its only
      paraphrase mention, `:1342` "Avoid five paraphrases", is about candidate
      diversity at generation time, which is a different mechanism). So the
      master dropped this having read it, not having missed it. That is the
      second misattributed marker found in this pair; see
      `agents/evidence/analysis/skipped-parent-lineage-2026-08-26.md`
      § Marker reliability.
      verify: a paraphrase-only candidate is refused before the cascade.
- [ ] **7.5 Roll out by canary, never silently.** `from-skipped-parent`: opt-in
      candidate bundles.
      verify: no promotion changes a shipped default without an opt-in stage.
- [ ] **7.6 A promoted artefact is not immortal.** `from-skipped-parent`, and
      it is the only anti-monotonic-growth mechanism *after* the gate — the
      `artifact-count delta` row guards the gate, the estate needs its own:
      post-promotion re-evaluation with `KEEP / REVISE / MERGE / SPLIT /
      RETIRE`. The master's promotion phase ends at the evidence package plus a
      cooldown, so nothing reopens a promoted artefact and the lifecycle is
      manual-only at exactly the point where growth accumulates.
      verify: a promoted artefact reaching its review trigger produces one of the
      five verdicts, and at least one `RETIRE` path is exercised in a fixture.
- [ ] **7.7 Best-known-state reference on regression.** Roll back to the
      recorded best-known state; lineage, not endless append.
      verify: an injected regression triggers the rollback path in a fixture.

## Blockers

> **REPAIRED 2026-08-29 — the entry below was invisible to every gate.** It was
> written `### merge-authority` without the literal `blocker:` prefix that
> `lint_roadmap_blockers.ts:40` requires
> (`/^###[ \t]+blocker:[ \t]*(.+?)[ \t]*$/gim`), so it never parsed:
> `agent-config gates --all --json` returned **zero** blockers for this file
> while a live maintainer-owned decision sat in it, and `check_estate_count`
> counted it as nothing. The same defect was found in the sibling roadmap
> `road-to-experience-loop-broadening` in the same run, where it hid two — which
> makes it a pattern in this inbox-harvest cohort rather than one slip.


### blocker: merge-authority

- **Status:** open — **SCOPED 2026-08-29, and it is divisible in the same shape
  as `b-adr-088` on `road-to-capability-native-execution`. Option (c) is taken
  and is council-decidable; options (a) and (b) are OWNER-RESERVED and were not
  taken.** AI council 2026-08-29, anthropic + openai, **2/2 convergent**.

  **Taken, council-decidable — the scoping half.** Phases 1–6 are declared legal
  while ADR-239 § Decision 3 remains open. They build measurement and isolation
  and promote nothing, so where merge authority lands does not touch them. Phase
  7 stays gated on this blocker.

  **Not taken, owner-reserved.** (a) **granting** preauthorized merge authority
  weakens a human-in-the-loop promotion guarantee — the shape
  `non-destructive-by-default` protects — and (b) refusing it settles an ADR §
  Decision that is recorded as open. Either is a resolution of ADR-239 itself,
  which a council may recommend and may not perform.

  **The condition that makes (c) real rather than a promise, and it is an
  addition to what the blocker proposed:** the non-promotion property of Phases
  1–6 must be **mechanically enforced**, not merely stated. A phase that
  promises to promote nothing while nothing prevents it from promoting is the
  same class of guarantee ADR-239 § Decision 3 is open about. Carried into Phase
  0's exit criteria rather than left here.

  **`Resolved when` (AMENDED 2026-08-29).** The original — *"ADR-239 § Decision 3
  no longer reads as an open question and its `review_trigger` no longer names
  the `merge-authority` blocker"* — is **unsatisfiable by option (c) and by any
  council**, because (c) leaves § Decision 3 open by construction. It bundled
  two things one authority cannot discharge, exactly as `b-adr-088` did. Split:
  the Phases 1–6 scope decision is **recorded above and needs nothing further**;
  this blocker now closes only when the **owner** settles ADR-239 § Decision 3 in
  either direction, at which point Phase 7 becomes enterable or is redesigned.
- **`revisit-if`:** ADR-239 § Decision 3 is settled, or a Phase 1–6 step is
  proposed that would promote anything — in which case the scoping decision above
  no longer covers it and this blocker binds earlier than Phase 7.
- **Owner:** maintainer
- **Blocks:** Phase 0 step 0.8, and by consequence every promotion step in
  Phase 7.
- **What to do:** pick exactly one — (a) resolve ADR-239 § Decision 3 by
  granting preauthorized merge authority with its scope written into that
  record, or (b) resolve it by refusing preauthorized merge authority, making
  "only humans promote" a property rather than an intention, or (c) declare
  Phases 1–6 legal while it is unresolved and gate only Phase 7 on it — the
  cheapest option and the one this roadmap is cut for. Read
  `docs/decisions/ADR-239-drain-command-surface-and-merge-authority.md:79-81`
  and its decision table at `:188`.
- **Resolved when:** ADR-239 § Decision 3 no longer reads as an open question
  and its `review_trigger` no longer names the `merge-authority` blocker as the
  reopen condition.
- **Recommendation:** (c). Phases 1–6 build measurement and isolation and
  promote nothing, so they are unaffected by where merge authority lands; (a)
  and (b) are owner-reserved and should not be forced by a plan that merely
  wants to start.
- **If you do nothing:** Phases 1–6 remain executable and Phase 7 cannot be
  entered, because the guardrail it rests on is documented in this tree as
  undecided. All three source proposals asserted that guardrail as a fact;
  verified 2026-08-26, it is not one.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Parallel rebuild of machinery that exists | implementation | A second isolation mechanism next to `bench_ab_clone`, a second verdict next to `paired_verdict`, a second delivery path next to `lean_projection_mode`, a second matcher next to `router_match`. Two truths about "better" and no test catches it, because neither is wrong on its own terms. The source proposals committed this four times, once inside the document whose thesis it was | The inventory matrix is 0.1's exit criterion; 0.2 adds the roadmap-ownership half; 6.1 measures the existing substrate before writing a new one; 6.2 keeps the parity test as the detector | Phase 0 — Constitution, reconciliation, budget, stop conditions |
| 2 | A consolidation that skips its deepest parent | implementation | Verified twice in this inbox: each folder's master named two parents and omitted the third, which itself claimed to supersede both named ones. The result reads as a decided plan while most of its content was never discussed | This roadmap folds the skipped parent back in and marks every such item `from-skipped-parent`; the sibling roadmap `road-to-consolidation-lineage-integrity.md` makes the check mechanical | Phase 0 — Constitution, reconciliation, budget, stop conditions |
| 3 | The corpus becomes the overfitting vehicle | implementation | If the pipeline that optimises against the trigger corpus also grew it, the holdout is compromised before the first candidate runs | Corpus work completes and the holdout is hash-frozen in 2.5, before any proposer exists in Phase 5; 2.3 adds counterexamples so selection cannot see only successes | Phase 2 — Trigger corpus: census first, coverage second |
| 4 | Coverage as a vanity target | product | "94 → 299" is a number that can be reached by authoring low-discriminative fixtures, which raises the metric and measures nothing. One parent killed this shape by name; the master adopted it as a phase title | 2.1 requires a partitioned census with a stated exclusion criterion before any denominator is chosen, and 2.3 requires discriminative classes | Phase 2 — Trigger corpus: census first, coverage second |
| 5 | Ambiguous credit from multi-dimension candidates | implementation | If a candidate changes routing and content together and the vector moves, no metric row can be attributed. The metric vector then looks informative and is not | 3.2 limits candidate arity to one primary dimension; consolidation is a separate record type | Phase 3 — Candidate isolation and lifecycle |
| 6 | Cost blindness turns a truncated run into a false pass | implementation | Cascade evaluation over candidates × task families × repeated trials is the dominant cost. Truncating to fit budget yields `underpowered`, which a reader treats as a pass | 0.5 aborts rather than truncates; 4.3 makes `underpowered` a non-pass in code; 5.6 reduces the cost instead of only capping it | Phase 0 — Constitution, reconciliation, budget, stop conditions |
| 7 | Stopping only on spend | implementation | Six of the parents' nine stop conditions detect epistemic invalidity, which a spend cap never sees. A run can complete inside budget and be worthless | 0.6 pre-registers the validity conditions with detectors, and names the ones that stay model-carried | Phase 0 — Constitution, reconciliation, budget, stop conditions |
| 8 | Monotonic estate growth after the gate | product | Every promotion adds; nothing reopens a promoted artefact. The gate-side `artifact-count delta` does not constrain the estate over time | 7.6 adds post-promotion re-evaluation with an exercised RETIRE path; 7.3 keeps most promotions below global scope | Phase 7 — Promotion bridge and the lifecycle after it |
| 9 | Search becomes the product | product | One parent warned against this and then listed a meta-evolver, a curriculum generator and a routing tree as phases. The surface doubles before a single trustworthy run exists | Those three are killed or parked below; this roadmap stops at Phase 7 and 6.1 takes the measurable core | Phase 6 — Delivery: measure the existing substrate first |
| 10 | A declared trust boundary with no detector | implementation | Naming proposer-visible and evaluator-private fields does not prevent holdout truth reaching a proposer; nothing observes the disclosure | 0.4 adds a per-field visibility class, a disclosure log, and a run abort | Phase 0 — Constitution, reconciliation, budget, stop conditions |

## Acceptance Criteria

- [ ] AC-1 — Every capability this roadmap builds has a row in the 0.1 inventory
      matrix stating why no existing carrier fits, and no step duplicates a
      carrier named in the "What already exists" table.
- [ ] AC-2 — Every overlapping plan in the estate carries one of the five
      dispositions from 0.2, and no capability has two execution owners.
- [ ] AC-3 — A candidate variant of one harness dimension can be materialised,
      evaluated and destroyed without any diff in the original tree, and a
      deliberate path-ownership sabotage exits non-zero.
- [ ] AC-4 — A candidate changing two primary dimensions is refused by the
      schema, and "mutated" is not readable as "accepted" anywhere in the data
      model.
- [ ] AC-5 — Promotion is decided by `paired_verdict` per metric with
      `underpowered` refused as a pass, and no code path computes a weighted
      total score.
- [ ] AC-6 — The holdout partition's content hash predates the first commit of
      any proposer capability, and a run leaking a holdout value into proposer
      context exits non-zero.
- [ ] AC-7 — The three existing delivery arms have been measured against one
      another before any new retrieval component exists, and
      `router_match_parity.test.ts` is still green.
- [ ] AC-8 — Programme success and failure criteria from 0.7 were committed
      before the first candidate run, and the run report carries an
      evolution-ROI figure.
- [ ] AC-9 — At least one promoted artefact has been through post-promotion
      re-evaluation and at least one RETIRE path has been exercised, so the
      lifecycle is shown to close in both directions.
- [ ] AC-10 — The `no-runtime-daemon` claim in `README.md` and its
      `docs/CLAIMS.md` entry are byte-identical to their pre-roadmap state.

## First cut — recommended start

One defect, one mutation dimension, existing machinery only. Target:
`code-intelligence` activation.

`src/skills/code-intelligence/SKILL.md` carries three literal triggers in its
description ("who calls", "where is this used", "call graph") — a narrow,
checkable activation surface — and **verified: it already has
`evals/triggers.json` with 10 queries**, so the cut is executable as written.

1. Generate 3–5 candidate descriptions deterministically (3.5), one dimension
   only (3.2), each entering the lifecycle enum at `proposed` (3.4).
2. Isolate via the candidate variant, assert with `bench_ab_integrity` (3.1).
3. Evaluate against the existing trigger corpus, verdict via `paired_verdict`,
   discrimination plant via `eval_publication` (4.3, 4.7).
4. No receipt, no LLM proposer, no frontier, no pathology archive.

**corrected-from-reproduction — this cut is not free.** A full
`description_route_check` run routes through a model backend behind a cache
layer (`src/scripts/description_route_check.ts:112-125`), so it is
spend-bearing. The budget invariant from 0.5 must exist before step 3 of this
cut, not after Phase 4. The master presented the cut as needing "no new
persistence, therefore none of the open contract questions" — true of
persistence, untrue of spend.

If this cut fails, the architecture is refuted before anything is built.

## Open maintainer decisions

- **E1 — Merge authority.** See Blockers. Verified open at `ADR-239:188`
  ("Preauthorized merge authority is granted or refused | owner | **open**").
- **E2 — Estate placement.** `corrected-from-reproduction`: the master framed
  this as an overlap with "two already leading proposals",
  `road-to-experience-loop-master` and `road-to-evidence-routed-skills-master`
  v2. Verified on this tree: the second name **appears nowhere in the
  repository** — not in `agents/roadmaps/` in any disposition and not in any
  tracked file. `grep -rl` over `*.md`, `*.ts` and `*.json` returned zero hits
  when the check was run; it now returns exactly one, this roadmap, because the
  name is written above. A reader re-running it should expect that single
  self-hit and nothing else. The first
  exists only as the sibling inbox proposal, now
  `road-to-experience-loop-broadening.md`. Also verified:
  `lint_roadmap_family_cap` **cannot** fire on either name —
  `src/scripts/lint_roadmap_family_cap.ts:41` sets
  `FAMILY_PREFIX = 'road-to-skill-ecosystem-'`, and it reports 0/2 slots used.
  The gate that does apply is `check_estate_count`.

  **Corrected after a neutral review, and the correction reverses this
  decision's force.** An earlier revision read "`active_roadmaps 3` against a
  floor of 7 — four slots of headroom". That was a pre-rebase reading; #1676
  landed four database-mastery roadmaps in the window named above. The gate now
  reports `active_roadmaps 7 (floor 7 at origin/main, +0)` — **at the floor, zero
  headroom.** These three roadmaps clear it only because `status: draft` excludes
  them from the counted set and each carries `estate_offset_exempt` for the
  file-based half. So the choice is not between two comfortable options: flipping
  any of them to `ready` without a disposal in the same change raises a floor at
  its ceiling, which makes folding the cheaper path on the estate axis rather
  than merely the tidier one. 0.2's five-verb disposition is where it gets
  answered, and it should be answered before any status flip.

  **RESOLVED 2026-08-29 — stay separate. E2 is the reciprocal of E1 on
  `road-to-experience-loop-broadening`, which this council resolved 2/2 to (b)
  earlier in the same run, and the transfer is council-decidable.**

  **Both of the paragraphs above are withdrawn as arguments.** First, the figure
  is **stale**: measured this run the gate reads `active_roadmaps 3 (floor 3 at
  origin/main)`, not 7 against 7. Second — and this part survives any
  re-measurement — *"at the floor, zero headroom"* is a **ratchet invariant**,
  not evidence. The floor **is** the base-ref measurement, so there is never
  incidental headroom at any value, and a property every value has cannot make
  folding "the cheaper path". E2 is therefore decided on the overlap alone.

  On the overlap, folding 47 + 58 steps couples two large outcomes and makes
  completion illegible; separation fails only where a shared mechanism cannot be
  independently completed, and none of the three named overlaps is of that kind.
  **A fold remains OWNER-RESERVED** — the archival that follows one is not
  reversible and changes the unit the estate ratchet counts.

  **The canonical ownership matrix.** E1 recorded the *rule* — one authoritative
  roadmap per shared mechanism — and did **not** assign the mechanisms, so the
  matrix was owed and unwritten. Both seats refused to infer it (*"sequence
  position is not an ownership criterion"*) and required a fresh deliberation,
  which was held. The criterion is **acceptance authority**: which roadmap may
  declare a mechanism complete so others may depend on it.

  | Overlap | Owner | What the non-owner does |
  |---|---|---|
  | Trigger corpus / trigger evals | **`road-to-governed-harness-evolution`** (this file, Phase 2) | `experience-loop-broadening` Phase 8 references the released corpus. Before release it may use a **non-canonical** labelled overlay for exploratory work only, and never claims trigger-corpus completion. |
  | Paired-verdict mechanism | **`road-to-governed-harness-evolution`** (this file, 4.3) | `experience-loop-broadening` 9.4 is pre-registration and evidence capture only. It does not build a partial mechanism and does not claim paired-verdict completion. |
  | Outcome-vocabulary reconciliation | **`road-to-experience-loop-broadening`** (step 1.3) | This roadmap's 1.4 is re-scoped to a non-blocking consumption reference with an explicit provenance-carrying adapter. See 1.4. |

  **A reference must not become a hidden gate.** Owner completion is neither an
  entry nor an exit criterion for the non-owner's phase; the non-owner continues
  in an explicitly non-canonical degraded mode, and every compatibility output
  carries provenance — source snapshot or version, adapter version, and
  `canonical: false` — so exploratory work cannot later be read as owner
  acceptance. This is the clause that keeps the matrix consistent with E1's own
  "may reference, may not block" rule, and it is why the matrix is recorded with
  degraded modes rather than with blocking dependencies.

  **`revisit-if`:** the outcome vocabulary becomes an independently governed
  cross-system taxonomy; trigger overlays begin changing canonical corpus
  semantics; a reconciliation finds the two vocabularies serve incompatible
  purposes and must stay separate with an explicit mapping rather than unify; or
  either roadmap's scope changes such that acceptance authority moves.
- **E3 — Budget ceiling** for 0.5 (candidates × trials × spend per run) and the
  sampling strategy for the 5.1 body variant.
- **E4 — Activation-ladder arity:** 4 states or 6? Recommendation: 6, because
  Phase 6 measures delivery and `delivered ≠ visible` is that axis. **Decide
  together with E9 — they are one question**, and the evidence for both is in
  `agents/evidence/analysis/evolution-kernel-decisions-brief-2026-08-26.md`.
- **E5 — Minimality tie-break order,** and whether the fifth criterion (simpler
  mechanism) is in. The two parents' orders invert, so this changes outcomes.
- **E6 — Curator operation set:** 4 ops or 7? Recommendation: 7 — split and
  retire are the anti-sprawl actions, and 7.6 depends on them existing. Brief:
  `agents/evidence/analysis/evolution-kernel-decisions-brief-2026-08-26.md` — it adds that `RETIRE` already has a carrier
  (`artifact-engagement-flow.md:32-33`) while `SPLIT` is the one genuinely new
  mechanism, so a 6-op middle exists.
- **E7 — Sealed-holdout cadence:** every cascade, or promotion candidates only?
  One parent killed every-iteration as an adaptive-overfitting risk; the other
  runs it every cascade. Brief: `agents/evidence/analysis/evolution-kernel-decisions-brief-2026-08-26.md` — and it
  reframes the question: there is **no** holdout machinery in this repository
  yet, so nothing is being preserved and the decision is greenfield.
- **E8 — State-taxonomy arity:** 4 classes or 5, splitting experiment-adaptive
  from production-adaptive with the latter prohibited by default? Brief:
  `agents/evidence/analysis/evolution-kernel-decisions-brief-2026-08-26.md` — which finds the proposed 5th class
  restates ADR-124's Class A/C boundary, and the prohibition it would add
  already exists.
- **E9 — Cascade stage set:** 9 stages or 12? If 9, Phase 1's exit criterion
  cannot be produced and must be rewritten. **One question with E4**; brief:
  `agents/evidence/analysis/evolution-kernel-decisions-brief-2026-08-26.md`.
- **E10 — Mutation dimensions:** do `activation/routing/content` stand alone, or
  does `verification` join immediately? Separate from 3.2, which is about arity.
- **E11 — Second opinion:** is the fixture holdout enough, or does a council
  blind round attach as an independent evaluator when Phase 4 blocks?
- **E12 — Receipt location:** field extension in `audit-log-v1` /
  `decision-trace-v1`, or a sidecar?
- **E13 — Control arm:** is the deterministic proposer kept permanently as a
  control even after an LLM proposer wins?
- **E14 — Reach of the inventory matrix:** this workstream only, or a general
  obligation for every roadmap? The source records the
  plan-what-already-exists failure at its third occurrence; this analysis makes
  it the fourth.

## Killed — do not reintroduce without new evidence

| ID | Rejected | Reason |
|---|---|---|
| K1 | The external reference as a dependency or runtime | Wrong layer (a Python benchmark laboratory). Shapes yes, code no. |
| K2 | Embedding / vector index for routing | **Contract violation**, not a preference: `docs/contracts/no-runtime-boundary.md:40` says verbatim that "a vector/embedding index fails — it enables query semantics absent from source, and stays Class C". That line names the code-graph cache as passing and says nothing about BM25; that the BM25 core also passes is this roadmap's own inference from `lexical_index.ts:9-15` (deterministic, in-memory, rebuilt per invocation), not a quotation. |
| K3 | Ungated autonomous self-evolution in canonical | Autonomy belongs in the laboratory, not at the authority boundary — and that argument stands on this tree alone: `ADR-239:188` records merge authority as open, so nothing here may promote autonomously regardless of what the literature says. The source proposals justified this kill with external findings that dense self-updates degrade; those were not checked here and are **not** load-bearing for the kill. |
| K4 | An episodic memory layer | ADR-094 removed Layer 2 and kept Layer 1; the intake JSONL plus its fold step is already that layer. `ADR-094:85` records revival as **gated** (≥2 funded consumer projects) — so this is a gated no with an unmet gate, and the gate is the thing to cite, not a prohibition. |
| K5 | A separate sprawl dashboard | Replaced by the minimality tie-break (4.5) and the `artifact-count delta` row (4.2) — inside the gate, where it prevents something. |
| K6 | Weighted total fitness score, or a frontier as promotion criterion | Two truths next to `paired_verdict`. |
| K7 | Superseding "no runtime" as an identity statement | `README.md:19` carries `<!-- claim:no-runtime-daemon -->`, bound in `docs/CLAIMS.md`. A governed public claim with its own procedure, and unnecessary: the contract already permits git-as-state, file I/O, single-shot subprocesses and deterministically rebuildable indexes, which is everything Phases 0–7 need. |
| K8 | Meta-evolver / evolving the evolver | Contradicts the parents' own warning, and there is no run history to feed it. |
| K9 | Curriculum generator and routing tree as phases | To `later/`. They double the surface before Phases 0–4 produce one trustworthy run. 6.1 takes the measurable core, from the existing substrate. |
| K10 | Copying benchmark numbers from external papers into this repo's docs | Unreproduced; the claims ledger governs. |
| K11 | A new delivery engine from scratch | The three arms already exist (`lean_projection_mode.ts:19`). Killed by the skipped parent and re-killed here on direct verification. |
| K12 | 100 % trigger coverage as a target | Reachable by authoring low-discriminative fixtures. Killed by the skipped parent; 2.1 replaces it with a partitioned census. |

## Unverified in this analysis — carried as unverified, not as fact

The parents' citations into the external reference repository could **not** be
checked here: that tree is not in this repository and this analysis ran offline
by its own bound. Every adopted mechanism above is justified by a defect or a
carrier verified in **this** tree and stands on that basis alone. No external
line number is load-bearing anywhere in this roadmap, and none should be added
without a fresh check. The same applies to the papers cited in the parents:
their numbers are unreproduced here and are not used to justify any step.
