---
complexity: structural
status: ready
estate_growth_exempt: "Promoted draft -> ready 2026-08-30. The merge-authority blocker was scoped by the AI council on 2026-08-29 to gate Phase 7 alone; Phases 1-6 are declared legal, so executable work exists today. The growth is a status flip, not a new file - the estate gains no roadmap it did not already carry, only one collect() now counts."
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Added as a draft proposal, not as active work. Archiving is impossible (nothing has run), parking in later/ would grow the later_roadmaps floor instead of the active one, and folding it into road-to-experience-loop-broadening is the open question E2 puts to the owner — pre-merging would decide it by authoring."
estate_growth_exempt: >
  Grows open_blockers 29 -> 30, and the growth is a CONSERVATIVE reading of a
  split council rather than new work. Steps 0.4 and 0.5 were closed earlier in
  the same run; put to the council as a reversal of a recorded disposition, the
  two seats split 1/1 — (b) closure stands with a call-site acceptance
  criterion, (d) reopen 0.4-0.5 until an end-to-end test proves the runner
  routes through the guards. A split is an escalation condition, not a verdict,
  so the side that risks UNDER-claiming was taken and `guard-call-site-integration`
  records both rationales verbatim so the owner can reverse it cheaply. The
  alternative to one blocker is two steps marked `[x]` on the more convenient
  half of a split, which is the over-claim this roadmap exists to prevent.
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

> **CARRIED CONDITION, placed here 2026-08-30 — the `merge-authority` council's
> own instruction, executed late.** When the AI council scoped `merge-authority`
> on 2026-08-29 (anthropic + openai, 2/2) it declared Phases 1–6 legal while
> ADR-239 § Decision 3 stays open, and attached one condition it called *"an
> addition to what the blocker proposed"*: **the non-promotion property of
> Phases 1–6 must be MECHANICALLY ENFORCED, not merely stated** — *"a phase that
> promises to promote nothing while nothing prevents it from promoting is the
> same class of guarantee ADR-239 § Decision 3 is open about."* It said the
> condition belonged in this phase's exit criteria. It was never written here;
> found on 2026-08-30 and carried now.
>
> **It is carried UNMET, and that is the honest state.** Nothing in this tree
> promotes anything: there is no promotion path, no candidate, and no merge
> verb — `grep -rln 'assertWithinBudget|discloseToProposer' src/ tests/` returns
> the guards, their tests and their config, and no caller. A gate written today
> to assert "no Phase 1–6 code promotes" would scan a population of zero and
> exit green, which is worse than no gate because it would look like the
> mechanical enforcement the council asked for. That is the vacuous-check
> refusal 1.4 and 2.3 both already made on this roadmap.
>
> **What discharges it, falsifiably.** The first commit that creates a promotion
> path — a verb, a state transition into `promoted`, or any write into `src/`
> derived from a candidate — owes the enforcement in the same change. Concretely:
> the 3.4 lifecycle enum's `promoted` transition and the 3.6 verb set are where
> the population stops being empty, so the check lands there and this note is
> what stops it being read as already-satisfied when it does.
>
> **This does not resolve `merge-authority` and does not touch it.** ADR-239 §
> Decision 3 — *"Preauthorized merge authority is granted or refused | owner |
> open"*, re-verified at `ADR-239:188` on 2026-08-30 — is owner-reserved in both
> directions, and no council verdict may perform it. Option (c) stands, Phase 7
> stays gated, 0.8 stays `[~]`.

- [x] **0.1 Write the inventory matrix as this phase's exit criterion.** A table
      of `planned capability → existing carrier in the tree → redirect / extend /
      build new (with the reason)`. Starting content is the table above. The
      phase does not close while a row reads "build new" without a stated reason
      no carrier fits.
      verify: `agents/evidence/analysis/` carries the matrix with an
      `<!-- evidence-type: analysis -->` first line, and every later phase names
      a row in it.

      **CLOSED 2026-08-30 on the first half; the second half is a STANDING
      obligation on Phases 1-7 and is recorded as such rather than claimed.**
      `agents/evidence/analysis/governed-harness-capability-inventory.md` carries
      twelve `redirect`/`extend` rows and three `build new` rows, each carrier
      opened at `origin/main` and cited by `file:line` rather than recalled.

      **The three `build new` rows each name what was SEARCHED**, because "no
      carrier fits" is a claim about absence and absence is the easiest thing to
      assert without looking: the candidate lifecycle enum (`ls src/scripts/ |
      grep -iE 'candidate|proposer|evolve'` returns one file, whose durable state
      is an integer mention count — a counter cannot express a state machine, and
      the enum lands on that existing record rather than in a new store), the
      operator command surface (no verb addresses candidates; deliberately left
      to 3.6, since a command surface with no lifecycle behind it is the
      speculative-infrastructure shape this estate has measured twice), and the
      metric vector (both existing modules produce per-item verdicts and neither
      assembles across metrics — and the new part is the *refusal to weight*,
      which is a report shape).

      **Two corrections the matrix makes to assumptions in this roadmap's own
      text, both from reading the files:** `lean_projection_mode.ts:19` already
      declares all three arms (`eager-all | thin | delivery`) with `eager-all`
      merely the shipped default, so 6.1 measures a substrate that exists rather
      than building one; and `bench_ab_clone.ts` carries `with-rdp` at `:141`,
      `:218` and `:220` on an axis distinct from `with`/`without`, so 3.1 is a
      new enum member rather than an axis extension.

      **The second half cannot be satisfied by any document written today** —
      *"every later phase names a row"* binds Phases 1-7 as they execute. It is
      live from here: the first later-phase step that cites no row is where it
      fails, and the matrix's own § What this matrix does NOT establish says so
      in the artefact rather than only here.
- [x] **0.2 Reconcile the estate with an explicit disposition per overlapping
      plan.** `from-skipped-parent`: the skipped parent made this a P0 exit
      criterion with a five-verb disposition — `own here / fold into existing /
      depend on existing / supersede proposal / drop` — and the closing
      invariant "no duplicate execution owner". The master demoted the same
      question to an unanswered open item. The five-verb form is strictly
      stronger and covers roadmap-vs-roadmap ownership, which the capability
      matrix in 0.1 does not.
      verify: every roadmap this one overlaps carries one of the five verbs, and
      no capability has two execution owners.

      **CLOSED 2026-08-30.** The seven-row disposition table is in
      `agents/evidence/analysis/governed-harness-capability-inventory.md`
      § Estate reconciliation — three active roadmaps, one parked, three
      superseded proposals, one verb each.

      **The two `drop` rows are MEASURED, because "no overlap" is the easiest
      claim to make without looking.** `grep -ciE 'trigger corpus|paired.?verdict|
      outcome vocabular|activation ladder|promotion bridge'` returns **0** over
      both `road-to-capability-native-execution` and
      `road-to-inbox-harvest-2026-08-e-council-topology-evidence`.

      **The one real overlap was already reconciled, and this step consumes that
      rather than re-deciding it.** `road-to-experience-loop-broadening`'s E1
      (AI council 2/2, 2026-08-29) assigns the three shared mechanisms: this
      roadmap owns the trigger corpus and the paired-verdict mechanism, the
      sibling owns outcome-vocabulary reconciliation — which is exactly why this
      roadmap's 1.4 already reads `[x]` as a non-blocking consumption reference.
      Re-deciding it here would create the second execution owner the invariant
      forbids.

      **`road-to-gated-harness-evolution-deep-v4` takes `supersede`, not
      `drop`**, and the distinction is Risk 2: it is the skipped parent the
      master never named, so dropping it is the consolidation defect rather than
      a tidy-up. Its content is folded back in and marked `from-skipped-parent`.
- [x] **0.3 Name the state classes without touching any claim.** Label
      authoritative / derived / evidence / adaptive state, citing
      `docs/contracts/audit-log-v1.md` as the already-sanctioned evidence-state
      precedent. Whether the adaptive class splits in two (E8) is decided here.
      Explicitly out of scope: the `no-runtime-daemon` public claim.
      verify: `grep -c 'claim:no-runtime-daemon' README.md` returns **0** and
      `docs/CLAIMS.md` shows no diff for that entry attributable to THIS
      roadmap.
      **CLOSED 2026-08-30, and E8 is decided: FIVE classes.**
      `agents/evidence/analysis/governed-harness-state-classes.md` labels
      authoritative / derived / evidence / **experiment-adaptive** /
      **production-adaptive**, the last defined as EMPTY and prohibited. AI
      council, anthropic + openai, both converging on option (c) over four
      classes and over a five-class split with a merely default-off member.

      **Four was rejected for a stated reason, not a preference:** it gives one
      name to state that is freely deletable and state that is governed, which
      openai's seat called the conflation every future producer and consumer
      would have to rediscover from prose. Both seats said independently that
      naming a prohibited class is not authorising it.

      **The council's condition is what makes (c) real, and it is carried
      verbatim into the artefact: EMPTY prohibits creating runtime DEPENDENCIES,
      not merely populating a labelled directory.** An empty folder with a
      consumer pointed at it is not an empty class. The falsifiable form:
      no state in this repository is production-adaptive on 2026-08-30, and a
      change that makes that false has populated the class whatever it names the
      file.

      **The three promotion transitions are named** — openai's seat refused the
      taxonomy without them, because *"may promote a candidate"* hides several
      architectures and only one preserves the boundary. A human-reviewed commit
      into `src/` is legal (the thing stops being adaptive at the commit); a
      deployment updating a runtime-readable pointer and a runtime consuming
      learned state are not. Phase 7 stays gated on `merge-authority`
      regardless — who may perform even the legal transition is ADR-239 §
      Decision 3.

      **The sequencing invariant is the part that binds:** every later step that
      introduces state or a consumer names its class, or a step can add a
      runtime-readable projection while calling it `derived`. Same shape as
      0.1's second half, and stated because a taxonomy that binds nothing is a
      glossary.

      **The guard is measured, not asserted:** `grep -c 'claim:no-runtime-daemon'
      README.md` returns **0**, and `git diff origin/main -- docs/CLAIMS.md` is
      empty. This step touched no claim.

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
> **ORDERING NOTE for 0.4-0.6, recorded 2026-08-30.** All three are
> pre-registration steps whose verify clauses name a RUN: *"a run in which a
> holdout value reaches proposer context exits non-zero"*, *"a run configured
> past the ceiling exits non-zero before spending"*, *"a synthetic diversity
> collapse trips the stop"*. No run harness exists — Phases 3-5 build it — so
> each of the three can be pre-registered now and **verified only once its
> detector has something to run against**. They are left open rather than closed
> on the written half, because closing a step on half its verify is how a
> detector that never got built reads as one that passed. 0.7 is closed instead:
> its verify asks for a committed, falsifiable document and nothing more, which
> is satisfiable today and is worth less every day it waits.

- [x] **0.4 Make the evaluator trust boundary detectable, not just declared.**
      `from-skipped-parent`, and this is the gap that mattered most: the master
      defines which fields are proposer-visible and which are evaluator-private
      and stops there. Add a per-field `visibility_class` on every observation, a
      log of every field disclosed to a proposer, and a run abort when holdout
      truth appears in proposer context.
      verify: a run in which a holdout value reaches proposer context exits
      non-zero, and the disclosure log names the field.
      **RE-CLOSED 2026-08-30 on `blocker: guard-call-site-integration`'s own
      `Resolved when`.** The guard existed and had no production call site; it
      now has one — `discloseToProposer` at `evolution_lab.ts:337`, inside
      `discloseObservations` on the `propose` verb — and the acceptance test
      drives the **real CLI** and asserts a non-zero **process** exit, which is
      the distinction the (d) seat held a unit test cannot establish.
      `./scripts-run src/scripts/evolution_lab propose --observations leak.json`
      → **exit 4**, stderr `disclosure: REFUSED obs[0] field=holdoutScore
      class=holdout` then `evolution_lab: ABORTED on evaluator trust boundary
      (field: holdoutScore)`. The verify clause's second conjunct — *"the
      disclosure log names the field"* — is that `REFUSED … field=` line;
      `discloseToProposer` logs only what it RELEASED by design, so the refusal
      is recorded at the call site.
      **The gap this closed was live, not ceremonial:** `parseObservations`
      ignores unknown keys, so an observations file carrying `holdoutScore: 0.83`
      beside a subject flowed straight into proposer input with nothing looking
      at it. That is a holdout value reaching proposer context.
      **0.4's per-field `visibility_class` landed in its literal form** —
      `parseObservationDocument` (`:262`) accepts
      `{field_visibility:[{field, visibility_class}], observations:[…]}` — and an
      observations file may **not** re-classify a reserved field.
      `OBSERVATION_FIELD_VISIBILITY` (`:225`) declares the three
      proposer-visible fields and everything else **falls closed to `holdout`**
      via the guard's own default, so an undeclared field aborts identically to
      a declared one. All three classes are exercised rather than two: an
      `evaluator-private` field is **dropped, not aborted**, and does not appear
      in the log.
      **"Before any external call" is proven by ordering, not asserted.** The
      leaking observation's `subject` is a path that does not exist. If
      disclosure runs first the process exits 4 naming the field; if the
      proposer ran first it would exit 1 with an ENOENT-shaped message. The test
      asserts exit 4 **and** that stderr does not contain `ENOENT`, so the two
      orderings are distinguishable and the correct one is pinned. The `--out`
      directory is never created and stdout is empty.
      **`run` was deliberately NOT given a disclosure gate**, for the same
      reason this blocker exists: `run` consumes candidate *records*, whose
      fields are fully schema-constrained with no free-form field, so there is
      no proposer context for a holdout value to reach. A call site nothing
      could exercise is the coverage inflation the blocker was raised against.
      Decided from the code, and stated rather than quietly skipped.
- [x] **0.5 Pre-register the budget invariant.** Candidate count, trial
      repetitions and a spend ceiling per run, fixed before the run. Exceeding it
      aborts rather than truncates — a truncated run yields `underpowered`, which
      `paired_verdict` refuses to call a pass and which a reader mistakes for one.
      verify: a run configured past the ceiling exits non-zero before spending.
      **RE-CLOSED 2026-08-30, same blocker, same evidence standard.**
      `assertWithinBudget(plan, loadRunBudget())` now has two production call
      sites — `evolution_lab.ts:646` (`propose`) and `:729` (`run`) — reading
      the committed `src/config/harness-evolution-budget.json`.
      `./scripts-run src/scripts/evolution_lab run --records <dir with 6>` →
      **exit 4**: `ABORTED on the pre-registered budget (dimension: candidates)`
      · `planned candidates 6 exceeds the pre-registered ceiling 5` ·
      `ABORTING BEFORE THE RUN, not truncating it`. All three dimensions are
      exercised — candidates 6 > 5, trials 21 > 20, spend 501 > 500 — and
      `propose` with six observations aborts identically, which closes the
      evade-by-batching route.
      **The ordering observable is stronger than a clone probe and is the one
      that matters:** one of the six records is **not valid JSON**. If the
      budget check runs first the process exits 4 on `dimension: candidates`; if
      record loading ran first it would exit 1 on `not valid JSON`. The test
      asserts exit 4 **and** that stderr does not contain `not valid JSON` — so
      the abort provably precedes the first record even being *parsed*, two
      stages upstream of `clone_candidate`. `candidates` is derived from the
      record set rather than declared, precisely so a declared count cannot be
      used to truncate to fit.
      **A positive pole keeps the negatives honest:** exactly AT every ceiling
      (5 / 20 / 500) does **not** abort — it proceeds and dies at the next stage
      with exit 1 — so none of the above passes because the verb refuses
      everything.
      `loadRunBudget` (`:181`) is **fail-closed in every direction**: missing
      file, bad JSON, missing key, non-integer and negative all throw, with no
      fallback budget. A default would be a ceiling nobody pre-registered.
      **One caveat carried forward rather than buried:** `run` derives
      `candidates` from the record set — the truth — but takes trials and spend
      from flags defaulting to 1 and 0, because this verb runs no trials and
      makes no billable call. So those two dimensions are today enforced against
      *what a caller says it will spend*, not a metered figure. The guard call
      is in the right place; the number reaching it improves when Phase 4 adds a
      cascade that actually spends.
- [x] **0.6 Pre-register stop conditions on epistemic invalidity, not only on
      spend.** `from-skipped-parent`: both parents carried eight or nine stop
      conditions; the master compressed them into the budget cap. A spend cap
      stops on cost, and most of those conditions stop on validity — holdout
      becomes underpowered · evaluator leakage detected · candidate diversity
      collapses to semantic duplicates · cross-component interference prevents
      credit assignment. Stopping with INDETERMINATE is a valid result, and an
      honest null is a success when it prevents unnecessary architecture.
      verify: each condition has a detector or is explicitly marked
      model-carried; a synthetic diversity collapse trips the stop.
      <!-- CLOSED 2026-08-30. Both council seats agreed this clause names no
      run at all — it asks that each condition carry a detector or a marker and
      that a synthetic collapse trip the stop, and both are satisfied. It is the
      one of the three the split did NOT touch. -->
- [x] **0.7 Define programme success and failure before the first run.**
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

- [x] **1.1 Record the activation ladder, not a flat category.** Per E4, either
      the 4-state or the 6-state form; the recommendation is the 6-state one
      because Phase 6 measures delivery and `delivered ≠ visible` is exactly
      that axis. Add the precedence receipt naming why a step did not advance
      (lost to a higher-priority rule · host restriction · pack filter · missing
      projection · context budget · contradictory instruction). This replaces the
      master's flat `rule/skill/hook/router/host/model` attribution, which names
      a category and not a place.
      verify: a deliberately failing trigger eval is classifiable as *content*
      vs *activation* vs *adherence* from the recorded receipt alone.
- [x] **1.2 A missing state stays unknown.** `from-skipped-parent`, one line
      and load-bearing: a state that was not observed must remain
      missing/unknown and is never silently converted to success. This is the
      ladder's soundness invariant; without it every downstream rate is inflated
      by exactly the capture gap.
      verify: a record with an unobserved rung reports `unknown` for it, and no
      aggregation folds `unknown` into a success denominator.
- [x] **1.3 Extend an existing carrier, do not add a store.** The receipt is a
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

> **PHASE TARGET, set 2026-08-30 by the 2.1 census and stated here so no later
> step has to infer it: the denominator is 287, not 299.** Twelve skills are
> non-self-activating — their own `description` names a dispatcher that exists
> in this tree — so no prompt reaches them and a corpus for one raises a ratio
> without testing a routing decision. Coverage against the partitioned
> denominator was **91 / 287 = 31.7 %** when this phase opened and is
> **97 / 287 = 33.8 %** after 2.4. The census, its per-skill exclusion criterion
> and the wave order are in
> `agents/evidence/analysis/trigger-corpus-census-2026-08-30.md`.
>
> **No percentage target is set, deliberately.** K12 killed `100 % trigger
> coverage as a target` because a ratio is reachable by authoring
> low-discriminative fixtures. What replaces it is a queue with a criterion:
> wave 1 first, ordered by recorded confusion edges.

- [x] **2.1 Run a census before naming a target.**
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

      **CLOSED 2026-08-30.**
      `agents/evidence/analysis/trigger-corpus-census-2026-08-30.md` § 2 carries
      the partition. Both conjuncts, separately:

      1. *"names the exclusion criterion per non-routable skill"* — **met.** The
         criterion is stated once, mechanically (`\b(?:[Dd]ispatched by|Called
         by)\b` over the `description:` line — the only field a host activation
         surface reads), and then applied to a table of **12** skills, each row
         carrying that skill's own declaring clause verbatim **and** the
         dispatcher's `file:line` in this tree. A criterion whose dispatcher
         could not be found would have been a claim, not an exclusion; all 12
         resolve.
      2. *"the phase target cites a partitioned number, not 299"* — **met.** The
         phase target above reads **287**.

      **All three of the roadmap's own figures reproduce exactly** — 94 corpus
      files, 299 skill directories, 205 allowlist entries — which is why the
      partition is stated as a correction to the denominator rather than to the
      counts.

      **The criterion errs in the direction that HURTS the number, and that is
      the load-bearing design choice.** Excluding a skill raises the coverage
      ratio, so a loose criterion is self-serving. This one excludes only skills
      that declare a dispatcher themselves, which leaves four plausibly
      non-routable skills — `judge-injection-defense`, `judge-synthesis`,
      `overbuild-review-lens`, `ui-apply-generic` — INSIDE the denominator
      because their descriptions read as task surfaces. Recorded in the census
      rather than quietly fixed.

      **The partition barely moves the ratio (31.4 % → 31.7 %), and that is
      reported rather than buried.** What it buys is not a better number, it is
      a denominator that cannot be gamed by authoring fixtures for skills no
      prompt reaches — the K12 / Risk-4 failure this phase exists to avoid.
- [x] **2.2 Prioritise waves, do not sweep.** Order corpus work by defect
      evidence, not alphabetically.
      verify: the wave order is committed with a stated criterion per wave.

      **CLOSED 2026-08-30**, same census file, § 3.

      **The defect evidence is deterministic and was already in the tree,
      unread.** When skill A's corpus holds a `trigger: false` case whose note
      names skill B as the correct destination, the corpus has RECORDED that A
      and B are confusable. If B carries no corpus, nothing tests that B does
      not over-trigger on A's vocabulary: the confusion is documented on one
      side and untested on the other. Measured at the start of this run:
      **170 edges naming 90 distinct skills, 42 of them with no corpus** — 63
      edges pointing at an untested destination.

      Three waves, one criterion each, and the partition is exhaustive
      (`100 + 34 + 156 + 9 = 299`) so "wave 2 is next" means something:
      wave 1 = routable · no corpus · named by ≥1 recorded edge, ordered by
      inbound count; wave 2 = routable · no corpus · **no** recorded edge;
      wave 3 = the 9 non-self-activating skills with no corpus, which are not
      corpus work at all and are named so they cannot be mistaken for a wave-2
      backlog.

      **Why this order.** Wave 2 is 4.6× wave 1 and carries no evidence that any
      of it is wrong; sweeping it first is exactly the vanity shape K12 killed.

      **Honest limit, recorded in the census: the signal is a floor, not a
      census of defects.** It sees only confusions somebody already wrote into a
      corpus, so a skill nobody authored a near-miss for scores zero — absence
      of evidence, not evidence of absence. The one signal that would measure
      real routing accuracy, `skill_trigger_eval`, routes through a model
      backend and is spend-bearing, so it stays out until 0.5's budget invariant
      is call-site proven.
- [x] **2.3 Author a four-class corpus, not two.** `from-skipped-parent`: the
      master's recipe is positives plus near-misses. Both parents required
      success exemplars, failures, near-misses **and** counterexamples, with
      selection seeing the full frozen corpus — the mechanism against
      survivorship bias in the corpus itself.
      ~~verify: every corpus file carries all four classes, and a fixture proves
      selection reads the whole frozen set.~~ **RE-SCOPED 2026-08-30 — the
      original verify is struck through rather than deleted, because the
      re-scope is the decision and a silently edited clause would hide it.**

      **RE-SCOPED by AI council 2026-08-30, anthropic + openai, 2/2 convergent
      on option (d): re-scope explicitly and record the rewrite; do NOT declare
      the original conjunction met.** Both seats stated independently that
      closing the original step "on its first conjunct" without a recorded
      rewrite would be illegitimate. This entry is that record.

      **What carried the verdict: `failure` is an ORTHOGONAL axis.** `exemplar`
      / `near-miss` / `counterexample` describe INTENDED routing; `failure`
      describes OBSERVED behaviour, and one case can be both — so a single
      mutually-exclusive class field cannot represent them and loses
      information by trying. Worse, a corpus file is a regression LOCK: a
      known-wrong case placed in one is red by construction, and a rule
      requiring one per file would reward deliberately broken routing. Both
      seats reached this independently; openai's seat added the falsifier —
      *"failure coverage should apply across the frozen evaluation set wherever
      genuine defects exist; otherwise the rule rewards deliberately broken
      routing and distorts quality metrics."*

      **Option (a), literal and retroactive, was rejected for a stated reason,
      not a preference:** it contradicts the gate's own
      `lint_skill_trigger_corpus.ts:20-26`, which says verbatim that the
      near-miss / unrelated-negative split *"is NOT machine-decidable and this
      gate does not pretend otherwise"* — and 152 of the 431 existing negatives
      carry no note to classify from, so retroactive classification would be
      invention. Option (c), a roadmap-local convention with no gate, was
      rejected as an invisible, unenforceable rule. Anthropic's seat proposed a
      `known-failures.json` with a "schema TBD Phase 4"; openai's seat rejected
      it in the same round as *"another vacuous mechanism"*, and that rejection
      is adopted — nothing is created for the failure axis here.

      **The re-scoped verify, in three parts:**

      1. **THREE semantic classes, declared, enforced.** Closed vocabulary
         `exemplar | near-miss | counterexample` on every case, with polarity
         part of the vocabulary (`exemplar` ⇒ `trigger: true`; the other two ⇒
         `trigger: false`), and all three present in the file.
         **MET** — `src/scripts/lint_skill_trigger_corpus.ts` now enforces it
         with five findings (`class-missing`, `class-vocab`, `class-polarity`,
         `class-coverage`, `class-shape`). **Four of the five are reachable
         from real data today; `class-shape` is a forward guard and cannot be**
         (completion review, 2026-08-30). It fires on a legacy-shaped corpus,
         and the only two legacy-shaped files in the tree are exactly the two
         grandfathered units, for which `judge` returns before the class rules
         run. It is exercised by synthetic fixtures in `--self-test`, so it is
         tested rather than untested — what it is not is currently live, and
         counting it as live coverage would be the inflated-coverage claim this
         very gate exists to prevent one level down. This does not contradict `:20-26`:
         nothing DETECTS the class, the author declares it and the gate checks
         the declaration — the mechanism the same file already uses for German
         at `:28-37`, for the same stated reason.
      2. **Forward-only, migrate-by-touch.** The rule binds on a file the diff
         adds or changes, the existing 94 are grandfathered by not being
         touched. **MET** — the `:39-46` language precedent, reused verbatim
         rather than reinvented, so no 94-entry suppression list is created.
         Both seats asked for named grandfathering; the touch rule is that,
         keyed on the pathname git reports.
      3. **The selection fixture is VACUOUS today, and is recorded as vacuous
         rather than as met.** *"a fixture proves selection reads the whole
         frozen set"* quantifies over a selection stage that does not exist —
         Phase 4 builds the cascade; there is no selection stage, no frozen-set
         reader and no candidate in this tree. A fixture written today would
         scan nothing and exit green, which is worse than no fixture because it
         would look like coverage. **The obligation is carried into Phase 4's
         exit criteria**, where the set is non-empty. This is the accounting
         step 1.4 already used on this roadmap for its own third conjunct, and
         both seats named it independently.

      **Proof the enforcement is reachable and both-directional:**
      `./scripts-run src/scripts/lint_skill_trigger_corpus --self-test` →
      15/15 cases, 10 rejecting. It includes BOTH polarity directions
      (`near-miss` on a positive, `exemplar` on a negative) and a pair proving
      the forward flag is what turns the rule on — an unclassified corpus is
      accepted untouched and rejected touched — so a rule that fired
      unconditionally would fail here rather than reach a reviewer.
      `tests/scripts/lint_skill_trigger_corpus.test.ts` pins the vocabulary at
      exactly three members with their polarities, so re-adding `failure` to
      this surface reds a test that names the decision.
- [x] **2.4 The grandfather list may only shrink.**
      verify: `./scripts-run src/scripts/check_trigger_eval_presence` green and
      the grandfather entry count strictly below 205.

      **CLOSED 2026-08-30. Both conjuncts measured:**
      `check_trigger_eval_presence` → `✅ 100/299 skills carry
      evals/triggers.json (199 grandfathered, shrink-only)`, exit 0; and
      `jq '.skills | length' src/scripts/trigger_eval_grandfather.json` → **199**,
      strictly below 205. `check_trigger_evals --today 2026-08-30` → `✅ 100
      trigger set(s) fresh + valid`, and `lint_skill_trigger_corpus` → 100 files
      hold the discipline.

      **The six were chosen by 2.2's wave order, not picked.** In inbound-edge
      order: `security-audit` (5 — the highest in the whole corpus),
      `threat-modeling` (3), `markitdown` (3), `prompt-engineering-patterns`
      (3), `logging-monitoring` (2), `incident-commander` (2).
      **CORRECTED 2026-08-30 after a completion review.** This step claimed
      that every new corpus uses its own recorded inbound edges as its
      near-miss cases, "which is what makes this a defect fix rather than a
      coverage bump". That holds for three of the six and not for the other
      three: in `threat-modeling`, `security-audit` and `markitdown` the
      near-misses are semantically adjacent skills that overlap the inbound
      set only partly — and in one case the inbound namer is absent from the
      near-misses entirely. Each of those three files now says so in its own
      `description`. The **selection** claim is unaffected and was verified
      independently: the six ARE the top six by inbound edge count at the base
      commit (5, 3, 3, 3, 2, 2). What is corrected is the justification, not
      the choice — half the batch is a defect fix and half is a coverage bump
      on a defect-ranked ordering, which is a weaker and true statement.

      All six carry the 2.3 classes (they are diff-added, so the forward-only
      rule binds on them — a claim that was itself only true where the base ref
      resolves, which the same review found and this branch fixed: an
      unresolvable base now REFUSES instead of silently skipping every
      forward-only rule), a
      German exemplar declaring `"language": "de"`, and at least one
      counterexample guarding over-triggering on unrelated input.

      **What this does NOT establish:** that the six route correctly. The
      corpora are expectations; measuring the router against them is
      `skill_trigger_eval`, which is spend-bearing and gated behind 0.5.
- [x] **2.5 Freeze the holdout partition here, before any proposer exists.** If
      the pipeline that later optimises against the corpus also grew it, the
      holdout is compromised before it is used.
      verify: the partition is content-hash pinned in a committed file whose
      hash predates the first Phase 5 commit.

      **CLOSED 2026-08-30.**
      `agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md` pins all
      **100** corpus files by `sha256`, 18 holdout / 82 train, under one
      set hash `7e091dfc0b1e44aa81268dd69a4d0ab07d1ee1316d6b3120d7ccec62f9aa5da8`.

      **The ordering half of the verify is a property of the history, not a
      claim in the file:** it is committed in Phase 2 and Phase 5 has no commits,
      so "predates the first Phase 5 commit" is checkable with `git log` rather
      than asserted.

      **The partition rule is deterministic and name-derived** —
      `holdout iff sha256(<skill-dir-name>).digest()[0] < 51` — so the file is a
      WITNESS, not the authority: anyone can recompute the split from the skill
      names alone, and if the two ever disagree the rule wins and the
      disagreement is the finding. A partition somebody could have *chosen* is
      one somebody could have chosen to flatter a candidate, which is Risk 3
      exactly. The set hash covers content as well as membership, so editing any
      frozen file changes it. The file carries a shell reproduce command that
      was run and reproduces the pinned hash byte-for-byte.

      **Three honest limits, in the artefact:** nothing seals the holdout
      MECHANICALLY today — no code reads the file, and the enforcing check
      belongs with the proposer in Phase 5; 100 of 287 routable skills carry a
      corpus at all, so a paired verdict over an 18-file holdout will be
      underpowered for most questions, which `paired_verdict` refuses to call a
      pass; and the freeze covers the files that exist, not the ones wave 2 will
      add — the set hash makes that visible rather than silent.

## Phase 3 — Candidate isolation and lifecycle

- [x] **3.1 Add a candidate variant to the existing variant enum.** A new member
      plus its surface definition; `bench_ab_integrity` keeps asserting
      byte-wise against it.
      verify: five candidates materialised and destroyed with no diff in the
      original tree; sabotaging a path ownership makes `bench_ab_integrity` exit
      non-zero.
      **DONE 2026-08-30, and the § What already exists note was right — this was
      an enum member on existing machinery, not new isolation.** `Variant`
      (`bench_ab_clone.ts:402`), accepted at `_checkVariant:470`, plus a
      `--candidate-record` flag. `clone_candidate` (`:325`) materialises at
      `clones/candidate-<id>`; `apply_candidate_mutations` (`:296`);
      `load_candidate_record` (`:360`) validates **before** any bytes are copied.
      The `all` aggregate is deliberately NOT extended (`:517`) — a candidate
      needs a record to know its dimension, so there is no blind aggregate that
      could produce one.
      `bench_ab_integrity` keeps asserting byte-wise: `discover_candidate_clones`
      (`:179`) finds candidate roots **by directory prefix** rather than from a
      passed list, so a candidate cannot escape the sweep by not being named, and
      `compare_indexes` (`:151`) compares each against the **`without`**
      baseline — not `with`, which would let a candidate inherit an unnoticed
      `with` violation.
      **Both polarities, and the sabotage was seen red.**
      `tests/scripts/bench_ab_candidate.test.ts` VERIFY 1 builds five clones,
      lands mutations, destroys them, then asserts `git status --porcelain` over
      the four surface paths and a byte snapshot are identical to the pre-run
      values. VERIFY 2 runs three phases in one test: five clean candidates →
      exit 0 (each named in `--verbose`, so a check that scanned nothing could
      not pass it); one file written outside the surface → **exit 1**, naming
      only the guilty candidate; that file removed → exit 0 again. **The third
      phase is the load-bearing one** — without it the red could have been the
      setup rather than the guard.
- [x] **3.2 One primary dimension per candidate.** `from-skipped-parent`, raised
      to doctrine level there and absent from the master. Reducing the mutation
      *alphabet* to three dimensions — which the master did — is not the same
      invariant as limiting a candidate's *arity*. If routing and body both
      change and the score moves, the credit is ambiguous and the Phase 4 metric
      vector cannot be read per candidate. Multi-dimension consolidation is a
      separate, later re-run, not a candidate.
      verify: the schema rejects a candidate touching two primary dimensions,
      and a consolidation run is a distinct record type.
      **DONE 2026-08-30 — the arity lives in the TYPE, not only in a
      validator.** `CandidateRecord.dimension` is a scalar
      (`src/scripts/_lib/candidate_record.ts`), so a two-dimension candidate is
      not expressible rather than merely refused. `parseCandidateRecord` (`:455`)
      then closes the three ways round it: a `dimensions` key rejected **by
      name**, `dimension` supplied as an array rejected **even with one member**
      (the invariant is about what the field CAN hold), and no cross-parsing
      between the two record types. `ConsolidationRecord` +
      `parseConsolidationRecord` (`:500`) is the distinct type and requires ≥ 2
      **distinct** dimensions and ≥ 2 source candidates, so it cannot be used as
      an escape hatch for a one-dimension candidate — `['routing','routing']` is
      refused, and that case is tested.
- [x] **3.3 Restrict the mutation alphabet to three dimensions.** `activation`,
      `routing`, `content`. Precedence, composition, verification, tool
      strategy, budget and scope are named and unimplemented until the three
      carry.
      verify: the schema rejects a mutation naming a fourth dimension.
      **DONE 2026-08-30, and E10 SPLIT rather than converging — recorded as a
      split, not dressed as a verdict.** AI council 2026-08-30, anthropic
      (claude-sonnet-4-5) + openai (gpt-4o), **1/1**: anthropic for FOUR
      dimensions, adding `verification` now on an irreversibility argument —
      *"mutation dimensions are metadata on candidate records; adding
      verification later means all prior candidates are permanently
      unclassifiable under the new dimension"* — openai for THREE, adding it only
      on demonstrated need. Per this repository's escalation handling a split is
      not a licence to pick the convenient half, so the **conservative side was
      taken: three**, which is what this step already specified. The verify
      clause therefore stands unchanged rather than being re-scoped to fit an
      answer.
      `MUTATION_DIMENSIONS` (`candidate_record.ts:71`) is exactly `activation |
      routing | content`. The six named-and-unimplemented dimensions are
      **absent**, not present-and-disabled. The negative test probes
      `verification` specifically — the fourth the losing seat argued for — plus
      `precedence`, `composition`, `tool-strategy`, `budget`, `scope` and `''`,
      and the clone boundary rejects them with **no clone directory created**.
      **The losing seat's concern is satisfied as a design constraint rather
      than waved off**, which is what a split obliges: `CANDIDATE_RECORD_VERSION`
      (`:58`) is stamped on every record, and the unknown-dimension refusal lives
      in the **validator** (`parseCandidateRecord`) and never in the **reader**
      (`readCandidateRecord:576`), which returns such a record with the dimension
      **flagged, not thrown**. So adding a fourth dimension later is an additive
      change and historical records never become unclassifiable — the exact
      information loss the anthropic seat named. Both directions are tested:
      *"the READER survives an unknown dimension"* and *"the VALIDATOR still
      refuses that same record"*.
- [x] **3.4 A candidate lifecycle state enum, so "mutated" and "accepted" cannot
      be confused.** `from-skipped-parent`: both parents made this the
      structural guard, one tracing the defect to the reference implementation
      passing `mutated` in where `accepted` was expected. The master has no
      lifecycle states. Minimum set: proposed → diagnostic-evaluated →
      selection-evaluated → promotion-eligible → sealed-evaluated →
      promotion-proposed → promoted | rejected | retired.
      verify: no code path reads a candidate as accepted from the mere fact that
      it exists; a state transition skipping a stage is refused.
      **DONE 2026-08-30.** `LIFECYCLE_SPINE` (`candidate_record.ts:87`) +
      `LIFECYCLE_STATES` (`:97`); `ACCEPTED_STATE` (`:112`) and `isAccepted`
      (`:122`) are the **single** acceptance site, so there is one place to read
      rather than a predicate repeated per caller. `requireLifecycle` (`:386`)
      **refuses an absent state rather than defaulting it** — a default would
      reintroduce exactly the reference-implementation defect this step cites,
      where `mutated` arrived where `accepted` was expected.
      `assertTransition` (`:196`) allows one forward spine step, any → `rejected`
      and `promoted` → `retired`; it refuses skips, backwards moves,
      self-transitions and any move out of a terminal state.
      **The negative tests are exhaustive rather than exemplary**, which matters
      for a spine: *"a transition skipping a stage is refused"* iterates **every**
      skip of size ≥ 2 across the spine, not one example, and *"existence is not
      acceptance"* asserts `isAccepted` is false for all eight non-promoted
      states including `sealed-evaluated` and `promotion-proposed`.
      **Phase 0's carried non-promotion condition — the transition half only, and
      the other half is NOT claimed.** `→ promoted` additionally requires a
      **named** human approver (`assertHumanApproval:237`); blank or
      whitespace-only is refused, and an approver does not buy a stage skip (the
      two guards are independent and tested as such). What holds is narrower than
      the condition: no code path can move a candidate into `promoted` without a
      name **on any surface that calls this function**. The verb half is 3.6.
      A gate asserting *"no Phase 1–6 code promotes"* was deliberately **not**
      written: there is still no promotion verb, so it would scan a population of
      zero and exit green — which this roadmap itself calls worse than no gate.
      **One implementation change was made because of the sensitivity
      discipline, and it is worth recording:** `apply_candidate_mutations`'
      resolved-path check originally called `die()` (`process.exit`), which no
      unit test can exercise without killing the runner. It now throws
      `PathOwnershipError` and `main` converts it back to exit 1 — an untestable
      branch is worse than a testable one.
      **Every guard in Phase 3 was seen RED.** Twelve guards were neutralised in
      source one at a time, the suite re-run, and the source restored from a
      scratchpad copy (never `git checkout`, per this repository's recorded
      probe discipline): the `dimensions`-key rejection, the array-dimension
      rejection, the alphabet check, the stage-skip check, the promotion approver
      gate, lifecycle-defaulted-not-refused, `isAccepted` widened past
      `promoted`, the path-traversal check, the reader made to throw on an
      unknown dimension, integrity ceasing to enumerate candidates, candidate
      failures dropped from the exit code, the candidate prefix drifting between
      the two scripts, and the resolved-path escape check. All went red; all
      restored byte-clean. A guard never seen red has unknown sensitivity.
- [x] **3.5 Ship a deterministic proposer first.** Fixed recipes for known
      defect classes, so the loop is validated without model quality as a
      confound.
      verify: the same input produces byte-identical candidates across two runs.
      **DONE 2026-08-30.** `src/scripts/_lib/candidate_proposer.ts`.
      `DEFECT_CLASSES` (`:69`) is three fixed classes, one per mutation
      dimension — `over-broad-activation` → activation,
      `unrouted-obligation` → routing, `unbacked-enforcement-claim` → content —
      so the alphabet 3.3 fixed is what bounds the proposer rather than a second
      list that could drift from it. `RECIPES` (`:166`) are **total** (defined on
      every string, `''` included) and **idempotent**, both asserted over eight
      inputs. `proposeCandidates` (`:361`) emits every record at
      `lifecycle: 'proposed'` with no way to ask for another state — the
      lifecycle enum is not bypassable from the producing side. `candidateId`
      (`:322`) is a sha256 over class + subject + mutation bytes: no clock, no
      counter, no randomness.
      **The determinism claim is proved three independent ways, not asserted.**
      (1) the same list twice yields identical joined bytes; (2) the same list
      **permuted** — reversed and rotated — yields identical bytes, which is the
      reading that matters, since a proposer that merely preserved input order
      would pass (1) and fail (2); (3) through the CLI into two directories,
      `diff -r` exit 0 and both files at sha256
      `4d5bffadd0ea782051911478d7137b4379835c329943b90146b66e7b60fb16de`. Read
      order is deterministic too, because read order decides whose error message
      surfaces first.
      **A guard was DELETED because it could not be seen red**, and that is the
      right disposal rather than a gap: `proposeCandidates` also sorted its
      OUTPUT by id, and neutralising that sort changed nothing observable — the
      input sort already fixed the order. A guard whose red cannot be produced is
      indistinguishable from one that does not work, so ordering now happens
      exactly once, on the input.
      **Seven proposer guards seen red** (P1a, P1b, P2–P7 in the sensitivity
      sweep), including a `Date.now()` planted in the proposer, which the
      determinism scanner caught.
- [x] **3.6 Give the operator a command surface.** `from-skipped-parent`: a
      verb set (`inspect`, `propose`, `run`, `compare`, `explain`, `promote`,
      `clean`) with no background loop. This is what makes "command-scoped, no
      daemon" enforced rather than asserted, and the master's Phase 3 exit
      criterion — "five candidates can be created and destroyed" — names no verb
      that would do it.
      verify: every phase's exit criterion is reachable through a named verb,
      and no verb starts a resident process.
      **DONE 2026-08-30 — with the first half of the verify clause SCOPED, and
      the scope is recorded rather than quietly satisfied.** `VERBS`
      (`src/scripts/evolution_lab.ts:92`) is exactly the seven the step names.
      `main` (`:591`) is a pure `argv → number`; the only `process.exit` is the
      CLI entry, and `run` / `compare` reach `bench_ab_clone` and
      `bench_ab_integrity` by **direct function call**, so nothing can outlive
      the process. One-line change to `bench_ab_clone.ts:66` — `const CLONES`
      became `export const CLONES` — so the `clean` verb discovers candidate
      clones without a fourth copy of that path join.
      **Second conjunct — "no verb starts a resident process" — is ENFORCED, in
      two independent ways.** Static: a scanner over the module's own bytes for
      `setInterval` / `setTimeout` / `setImmediate` / `child_process` /
      `spawn(` / `fork(` / `watch(` / `while (true)` / `for (;;)` / `.unref(` /
      `detached:`. Dynamic: every verb is spawned under a hard timeout asserting
      `signal === null` — a verb leaving a resident child holding stdio would
      keep the pipe open and come back killed, so a timeout is a **positive
      detection** rather than a flake. Both strippers carry an anti-vacuity
      assertion, because a stripper returning `''` would make the scan pass over
      nothing.
      **First conjunct — "every phase's exit criterion is reachable through a
      named verb" — is half met and half unmeetable TODAY, and is recorded as
      such.** Phases 4–7 do not exist in this tree, so no verb can reach an exit
      criterion they do not have, and Phase 7 is separately blocked on
      `merge-authority`. Phases 1–2's criteria (the frozen corpus, the holdout)
      belong to other carriers and are not verb-shaped. `EXIT_CRITERION_COVERAGE`
      (`:132`) therefore covers **Phase 3 only** and says so in its own output.
      **What makes this a scope rather than a hole is the forcing function:** a
      test asserts every key in that map starts with `3.`, so a later phase
      landing without a verb fails a test instead of silently inheriting the
      claim. Without that test this step would be claiming something about
      phases nobody has written, which is the shape 0.1 declined for the command
      surface.
      **`promote` REFUSES, and the refusal is not the only thing stopping it.**
      `EXIT_REFUSED = 3` (`:120`): the verb routes the intended transition
      through `assertTransition(record.lifecycle, 'promoted')` **with no approval
      argument**, prints that gate's message plus the `merge-authority` blocker
      text, and returns 3. There is no `--approver` flag (it exits 2 as an
      unrecognised argument), and a scanner asserts the module contains no
      `approver:` / `approvedAt:` / `HumanApproval` expression — so **deleting
      the refusal would still not produce a promotion**. The negative test drives
      it from **every** spine state, which catches the specific failure of a
      promote that refuses on the spine guard from `proposed` and would succeed
      from `promotion-proposed`.
      **Ten lab guards seen red** (L1–L9 plus the coverage-map row), each
      neutralised in source and restored from a scratchpad copy.
      **Scope note carried forward:** `evolution_lab` is a standalone script in
      the `bench_ab_*` family, invoked as
      `./scripts-run src/scripts/evolution_lab <verb>`, **not** an
      `agent-config` verb. Registering it in the CLI registry touches the
      budget-sync surface and several others and is a separate decision, not
      smuggled in here.

## Phase 4 — Evaluation

> **CARRIED EXIT CRITERION, placed here 2026-08-30 by the 2.3 re-scope so it
> cannot be dropped in transit.** Step 2.3's second conjunct — *"a fixture
> proves selection reads the whole frozen set"* — was recorded as **vacuous**
> rather than met, because no selection stage exists to run a fixture against
> and a fixture that scans nothing exits green while looking like coverage.
> **This phase does not close until that fixture exists and passes** against the
> selection stage 4.1 builds, over the 100-file set frozen in
> `agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md`. The failing
> shape it must catch: a selection stage that reads only the train partition, or
> only the cases carrying `class: exemplar`, and reports a verdict as if it had
> seen the corpus. AI council 2026-08-30, anthropic + openai, 2/2 — both seats
> required the deferral be recorded at a phase with an owner rather than left as
> an unassigned acceptance criterion, which is Risk 11 on this roadmap.
>
> **The `failure` axis lands here too, and deliberately as nothing yet.** The
> same council moved observed-failure tracking off the corpus surface (it is
> orthogonal to intent, and a known-wrong case in a regression lock is red by
> construction) and rejected creating a `known-failures.json` with a "schema TBD"
> as a vacuous mechanism. So: when this phase's cascade can produce an OBSERVED
> outcome per case, expected-vs-observed is recorded against stable case ids at
> that point — not before, and not as an empty file that looks like a carrier.

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

### blocker: guard-call-site-integration

- **Status:** resolved 2026-08-30 — **satisfied on its own `Resolved when`,
  both halves, and the conservative side turned out to be reachable in the same
  run that took it.** The split is left recorded below rather than rewritten:
  it was a real disagreement and the record of it is what made the acceptance
  test the (d) seat's shape rather than the (b) seat's.
  The `Resolved when` asked for an end-to-end test driving the real runner to a
  non-zero **process** exit on (a) a holdout value reaching proposer context
  and (b) a plan past the pre-registered ceiling, both before any external call,
  with 0.4 and 0.5 re-closed citing it. All of that is now true:
  `tests/scripts/harness_evolution_guard_call_sites.test.ts` spawns
  `./scripts-run src/scripts/evolution_lab` and asserts `status === 4` on each,
  and both steps are `[x]` above with the evidence at the step.
  **The blocker's own measurement, re-run.**
  `grep -rln 'assertWithinBudget|discloseToProposer' src/ tests/` returned three
  paths and **zero production call sites** when this blocker was written. It now
  returns four, the fourth being `src/scripts/evolution_lab.ts` — a runner.
  The acceptance test does **not** appear in that grep, deliberately: it never
  calls a guard directly, only the CLI, which is exactly what the (d) seat
  asked for.
  **The two neutralisations that settle the split.** G4 and G5 in the
  sensitivity sweep remove *only* the throw→process-exit conversion, leaving the
  guard call in place. The test still goes red — which is the property the (d)
  seat said a unit test observing a thrown exception cannot establish, and the
  reason "pending integration" was the right disposition rather than
  over-caution. Ten new call-site guards, 10/10 seen red.
  **Superseded status line, kept for the record:** open — **the council SPLIT on
  this, and the conservative side was
  taken.** AI council 2026-08-30, anthropic + openai, **1/1 for (b) and 1/1 for
  (d)** — not convergent, which `roadmap-progress-sync` classes as an escalation
  condition rather than a verdict.
- **Owner:** council — the disposition is a DEFERRAL that keeps both criteria
  alive and unweakened, which the preservation test routes to the council. The
  substance of the split is recorded below so the owner can reverse it cheaply.
- **Class:** 3
- **Blocks:** steps 0.4 and 0.5 only. 0.6 is closed and untouched by the split.
- **What the two seats agreed on** — this half is not in dispute and is acted on
  in full: the guards work, their unit tests prove the behaviour their verify
  clauses name, and **the gap is real** — nothing in Phase 0 forces a future
  runner to call `assertWithinBudget` or `discloseToProposer`. Both seats asked
  for a call-site acceptance criterion; **AC-8 below is it.**
  (**Renumbered to AC-11 on 2026-08-30** — it collided with a pre-existing AC-8
  about programme success criteria, so this sentence pointed at two different
  criteria. The original wording is kept above rather than rewritten, and this
  parenthesis is the repointing; see AC-11 for the record.)
- **Where they split.** (b): the clauses are BEHAVIOURAL, a test that invokes
  the guard and observes the throw is a run of it, and reopening holds Phase 0
  hostage to a later artefact. (d): the clauses say *"a run"* that *"exits
  non-zero"*, and a unit test observing a thrown exception does not prove an
  executable runner routes through the guard or converts that throw into a
  non-zero PROCESS exit; *"the invariant must exist before the runner"*
  establishes implementation order, not permission to mark integration
  verification complete.
- **What to do:** take the conservative side, which is what happened here —
  0.4 and 0.5 are `[~]`, not `[x]`, and not `[ ]` either: the guards and their
  16 tests are completed prerequisites, recorded as such, and what is pending is
  integration. Re-close each after an end-to-end test proves the real runner
  routes every relevant path through the guard and exits non-zero before any
  spend or disclosure. Nothing is rebuilt.
- **Recommendation:** the conservative side, taken, and the reason is
  asymmetry rather than agreement with (d): under-claiming a closed step costs a
  checkbox, while over-claiming one is exactly the failure the prior run named —
  *"a detector that never got built reads as one that passed"* — with "never got
  built" replaced by "never got called". A split council is not a licence to
  pick the more convenient half.
- **If you do nothing:** 0.4 and 0.5 stay deferred and Phase 0 stays at 5 of 8.
  Nothing downstream is blocked by that: the roadmap's own § First cut needs the
  budget invariant to EXIST before its step 3, and it does — the config is
  committed and the guard is callable. What is pending is proof that it is
  called.
- **Resolved when:** an end-to-end test drives the real runner and observes a
  non-zero process exit on (a) a holdout value reaching proposer context and
  (b) a plan configured past the pre-registered ceiling, both before any
  external call — and the two steps are re-closed citing it.
- **MEASURED 2026-08-30, and it makes the ordering a fact rather than an
  expectation.** `grep -rln 'assertWithinBudget|discloseToProposer' src/ tests/`
  returns exactly three paths: `src/scripts/_lib/harness_evolution_guards.ts`
  (the guards themselves), `tests/scripts/harness_evolution_guards.test.ts`
  (their unit tests) and `src/config/harness-evolution-budget.json` (the
  pre-registered budget they read). **Zero production call sites.** There is no
  runner in this tree to route through them.

  Recorded, not re-argued: this is the (d) seat's position turning out to be
  measurable rather than merely arguable, and it does NOT reopen the split. The
  disposition is unchanged and the conservative side stands. What changes is
  that "pending integration" now has a number behind it, so a later reader does
  not have to re-derive whether the gap is real.

  **The consequence for sequencing, stated so nobody waits on the wrong thing:**
  this blocker is not resolvable by any amount of Phase 0 or Phase 2 work. The
  first artefact that could satisfy it is the deterministic proposer of **3.5**
  and the operator verb set of **3.6** — the first things in this roadmap that
  are a runner. Attempting to satisfy it earlier would mean building a runner
  outside the phase that owns one, which is the speculative-infrastructure shape
  0.1 already declined for the command surface.


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

  **FOUND UNCARRIED 2026-08-30, and carried now.** The sentence above said the
  condition was carried into Phase 0's exit criteria. It was not: a tree-wide
  grep for `mechanically enforced` / `non-promotion` over this roadmap returned
  only these lines, inside this blocker. The condition existed exactly where the
  paragraph said it should not be left.

  This is the **third instance in this cohort of the same defect shape** — a
  criterion with no phase, no step and no owner, which Risk 11 names for AC-8
  and which the `Resolved when` twin above records for `b-adr-088`. It is
  recorded as a pattern rather than a slip because that is now three.

  The condition is carried as a Phase 0 exit-criterion note (see the
  **CARRIED CONDITION** block at the head of Phase 0), which is where the
  council put it. It is carried **unmet**, with the reason it cannot be
  discharged today stated there rather than being quietly satisfied by a check
  that would scan nothing.

  **The `Resolved when` field below was AMENDED 2026-08-29, and the amendment
  now lives inside the field's value rather than in a heading above it.** The
  original — *"ADR-239 § Decision 3 no longer reads as an open question and its
  `review_trigger` no longer names the `merge-authority` blocker"* — is
  **unsatisfiable by option (c) and by any council**, because (c) leaves §
  Decision 3 open by construction. It bundled two things one authority cannot
  discharge, exactly as `b-adr-088` did.

  **Why the fix is a field edit and not a paragraph, 2026-08-30.** The 2026-08-29
  amendment was written as prose here and left the original `- **Resolved
  when:**` field standing three fields below, still stating the unsatisfiable
  condition — two contradictory closure conditions on one blocker, with
  `lint_roadmap_blockers` green throughout. This is the **same defect, in a
  second roadmap**: `road-to-capability-native-execution`'s
  `b-adr-088-external-runtime-federation` carried an identical stale twin, found
  and fixed on 2026-08-29, and its own note predicted the recurrence by naming
  the mechanism. The gate matches a literal label
  (`/^-[ \t]*\*\*Resolved when:\*\*/im`, `src/scripts/lint_roadmap_blockers.ts:52`),
  so a heading that says *"Resolved when (AMENDED …)"* satisfies nothing and the
  contradictory line was the only thing keeping the blocker legal.

  **Searched rather than assumed:** a tree-wide grep for `Resolved when` outside
  the literal `- **Resolved when:**` field across `agents/roadmaps/**` returns
  these two blockers and no third. Both are now fixed the same way — rename the
  amended field to the literal label first, delete the stale one second, because
  the other order turns the gate red in between.
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
- **Resolved when:** *(AMENDED 2026-08-29 — the marker sits inside the value on
  purpose; see the note above this field.)* the Phases 1–6 scope decision is
  recorded above and needs nothing further. This blocker closes when the
  **owner** settles ADR-239 § Decision 3 in either direction, at which point
  Phase 7 becomes enterable or is redesigned.
- **Recommendation:** (c). Phases 1–6 build measurement and isolation and
  promote nothing, so they are unaffected by where merge authority lands; (a)
  and (b) are owner-reserved and should not be forced by a plan that merely
  wants to start.
- **If you do nothing:** Phases 1–6 remain executable and Phase 7 cannot be
  entered, because the guardrail it rests on is documented in this tree as
  undecided. All three source proposals asserted that guardrail as a fact;
  verified 2026-08-26, it is not one.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-31 | reviewer: claude/host -->

> **Re-reviewed 2026-08-31 after Phase 0 closed 8/8 and Phase 3 closed 6/6.** (The marker keeps `v1` — that field is the marker SCHEMA version, which the linter pins, not a review counter; the review generation is the `reviewed:` date.)
> Four rows changed state and one row is new. The register is not merely
> re-dated: rows 5, 6 and 10 name mitigations that were *planned* when v1 was
> written and are now *implemented and exercised*, row 11's risk has resolved
> outright, and row 12 records a residual the guard wiring surfaced. Rows 1–4,
> 7–9 are unchanged and still live — every one of them fires in a phase that
> has not started.

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Parallel rebuild of machinery that exists | implementation | A second isolation mechanism next to `bench_ab_clone`, a second verdict next to `paired_verdict`, a second delivery path next to `lean_projection_mode`, a second matcher next to `router_match`. Two truths about "better" and no test catches it, because neither is wrong on its own terms. The source proposals committed this four times, once inside the document whose thesis it was | The inventory matrix is 0.1's exit criterion; 0.2 adds the roadmap-ownership half; 6.1 measures the existing substrate before writing a new one; 6.2 keeps the parity test as the detector | Phase 0 — Constitution, reconciliation, budget, stop conditions |
| 2 | A consolidation that skips its deepest parent | implementation | Verified twice in this inbox: each folder's master named two parents and omitted the third, which itself claimed to supersede both named ones. The result reads as a decided plan while most of its content was never discussed | This roadmap folds the skipped parent back in and marks every such item `from-skipped-parent`; the sibling roadmap `road-to-consolidation-lineage-integrity.md` makes the check mechanical | Phase 0 — Constitution, reconciliation, budget, stop conditions |
| 3 | The corpus becomes the overfitting vehicle | implementation | If the pipeline that optimises against the trigger corpus also grew it, the holdout is compromised before the first candidate runs | Corpus work completes and the holdout is hash-frozen in 2.5, before any proposer exists in Phase 5; 2.3 adds counterexamples so selection cannot see only successes | Phase 2 — Trigger corpus: census first, coverage second |
| 4 | Coverage as a vanity target | product | "94 → 299" is a number that can be reached by authoring low-discriminative fixtures, which raises the metric and measures nothing. One parent killed this shape by name; the master adopted it as a phase title | 2.1 requires a partitioned census with a stated exclusion criterion before any denominator is chosen, and 2.3 requires discriminative classes | Phase 2 — Trigger corpus: census first, coverage second |
| 5 | Ambiguous credit from multi-dimension candidates | implementation | If a candidate changes routing and content together and the vector moves, no metric row can be attributed. The metric vector then looks informative and is not | **MITIGATED 2026-08-30 — the arity is in the TYPE, not in a check.** `CandidateRecord.dimension` is a scalar, so a two-dimension candidate is not expressible; the validator additionally refuses a `dimensions` key by name and an array even with one member, and `ConsolidationRecord` needs two *distinct* dimensions so it is not an escape hatch. What remains is that no metric vector exists yet to be attributed — that arrives with Phase 4 | Phase 3 — Candidate isolation and lifecycle |
| 6 | Cost blindness turns a truncated run into a false pass | implementation | Cascade evaluation over candidates × task families × repeated trials is the dominant cost. Truncating to fit budget yields `underpowered`, which a reader treats as a pass | **PARTLY MITIGATED 2026-08-30.** 0.5 now aborts rather than truncates *at a real call site*, proven by a non-zero process exit from the CLI and by an ordering observable showing the abort precedes record parsing. 4.3 (`underpowered` a non-pass in code) and 5.6 (reduce the cost rather than cap it) are unbuilt, so the risk is reduced, not closed | Phase 0 — Constitution, reconciliation, budget, stop conditions |
| 7 | Stopping only on spend | implementation | Six of the parents' nine stop conditions detect epistemic invalidity, which a spend cap never sees. A run can complete inside budget and be worthless | 0.6 pre-registers the validity conditions with detectors, and names the ones that stay model-carried | Phase 0 — Constitution, reconciliation, budget, stop conditions |
| 8 | Monotonic estate growth after the gate | product | Every promotion adds; nothing reopens a promoted artefact. The gate-side `artifact-count delta` does not constrain the estate over time | 7.6 adds post-promotion re-evaluation with an exercised RETIRE path; 7.3 keeps most promotions below global scope | Phase 7 — Promotion bridge and the lifecycle after it |
| 9 | Search becomes the product | product | One parent warned against this and then listed a meta-evolver, a curriculum generator and a routing tree as phases. The surface doubles before a single trustworthy run exists | Those three are killed or parked below; this roadmap stops at Phase 7 and 6.1 takes the measurable core | Phase 6 — Delivery: measure the existing substrate first |
| 10 | A declared trust boundary with no detector | implementation | Naming proposer-visible and evaluator-private fields does not prevent holdout truth reaching a proposer; nothing observes the disclosure | **MITIGATED 2026-08-30, and the gap it named was live rather than theoretical:** `parseObservations` ignored unknown keys, so a `holdoutScore` beside a subject flowed into proposer input with nothing looking at it. 0.4's per-field visibility class, disclosure log and run abort now exist AND are called — undeclared fields fall closed to `holdout`, and the abort is observed as a non-zero process exit before the proposer reads the subject | Phase 0 — Constitution, reconciliation, budget, stop conditions |
| 11 | **RESOLVED 2026-08-30** — the call-site criterion (renumbered AC-8 → AC-11, since it collided with a pre-existing AC-8) landed on Phase 3 and was met there rather than quietly dropped. The deferral did the work the row credited it with: 0.4 and 0.5 stayed `[~]` until an end-to-end test drove the real CLI to a non-zero process exit on both halves. Kept in the register rather than deleted, because the mechanism it describes — a deferral as the enforcement, not the AC's wording — is the reusable part. *Original row:* AC-8 lands on a phase that does not exist yet, and is quietly dropped when it does | product | The call-site criterion both council seats asked for is an acceptance criterion with no phase, no step and no owner. The runner arrives in Phase 3 or later, written by whoever picks that phase up, and an AC nobody is assigned to is an AC that gets read as already-satisfied by the unit tests that closed 0.6 | The `guard-call-site-integration` blocker holds 0.4 and 0.5 at `[~]` until AC-8 is met, so the phase cannot report closed while the criterion is outstanding — the deferral is the enforcement, not the AC's wording. Both council rationales are recorded verbatim at the blocker so a later reader meets the argument rather than the conclusion | Phase 0 — Constitution, reconciliation, budget, stop conditions |
| 12 | The spend ceiling is enforced against a declaration, not a measurement | implementation | **NEW 2026-08-31, surfaced by the guard wiring itself.** `run` derives `candidates` from the record set — the truth — but takes `trials` and `spend` from flags defaulting to 1 and 0, because this verb runs no trials and makes no billable call. That is honest today and becomes a hole the moment something spends: a caller that under-declares passes a ceiling it is about to exceed, and `assertWithinBudget` will have approved it. The failure mode is precisely risk 6's — a run that looks budgeted and is not | The call site is in the right place, which is what makes this cheap to fix: when Phase 4 adds a cascade that spends, it must pass a derived estimate rather than a flag default. Recorded here rather than left in a commit message, because the person wiring Phase 4 is not the person who wrote this note | Phase 4 — Evaluation |

## Acceptance Criteria

- [x] AC-11 — The runner routes every governed action through the Phase-0 guards,
      proven end-to-end rather than by inspection: a holdout value reaching
      proposer context and a plan configured past the pre-registered ceiling each
      terminate the process non-zero **before any external call**. Added
      2026-08-30 at the request of BOTH council seats, which agreed on this even
      where they split on whether 0.4/0.5 may close without it — a guard nothing
      calls has no coverage, and Phase 0 alone cannot force a later phase to
      call it.
      **RENUMBERED 2026-08-30, from AC-8 to AC-11 — it collided with the
      pre-existing AC-8 below.** Both criteria carried the number 8 and neither
      referenced the other, so `blocker: guard-call-site-integration`'s
      *"AC-8 below is it"* pointed ambiguously at two different criteria — one
      about guard call sites, one about programme success criteria and the
      evolution-ROI figure. The blocker text is left as written rather than
      silently repointed; **it means this criterion**, which is the one added on
      its own request and in the same change. Renumbering rather than merging
      because the two test unrelated things.
      **Met 2026-08-30, and met in the shape both seats asked for.**
      `tests/scripts/harness_evolution_guard_call_sites.test.ts` spawns the real
      CLI and asserts a non-zero **process** exit on each half: exit 4 on a
      holdout field reaching proposer context, exit 4 on a plan past the
      pre-registered ceiling. *"Before any external call"* is proven by an
      **ordering observable** rather than asserted — a nonexistent subject path
      and a deliberately malformed record make the two possible orderings
      produce distinguishable exits, and the test pins the correct one by
      asserting on the ABSENCE of `ENOENT` / `not valid JSON` in stderr. A
      positive pole (exactly at every ceiling does NOT abort) keeps the
      negatives from passing because the verb refuses everything.

- [ ] AC-1 — Every capability this roadmap builds has a row in the 0.1 inventory
      matrix stating why no existing carrier fits, and no step duplicates a
      carrier named in the "What already exists" table.
- [ ] AC-2 — Every overlapping plan in the estate carries one of the five
      dispositions from 0.2, and no capability has two execution owners.
- [ ] AC-3 — A candidate variant of one harness dimension can be materialised,
      evaluated and destroyed without any diff in the original tree, and a
      deliberate path-ownership sabotage exits non-zero.
      **Two of its three verbs are met, and it stays OPEN on the third rather
      than being read generously.** *Materialised* and *destroyed* with no diff
      in the original tree: 3.1, five candidates, asserted by `git status
      --porcelain` over the four surface paths plus a byte snapshot. *Sabotage
      exits non-zero*: 3.1's three-phase test — clean passes, sabotage reds
      naming only the guilty candidate, un-sabotage passes again. **`evaluated`
      is not met**: no evaluation stage exists until Phase 4, so nothing has
      evaluated a candidate. Closing this now would be the generous reading the
      roadmap's own § blocker text warns about — *"a detector that never got
      built reads as one that passed"*.
- [x] AC-4 — A candidate changing two primary dimensions is refused by the
      schema, and "mutated" is not readable as "accepted" anywhere in the data
      model.
      **Met 2026-08-30 by 3.2 and 3.4, both halves.** First half: the arity is
      in the TYPE — `CandidateRecord.dimension` is a scalar, so a two-dimension
      candidate is not expressible, and `parseCandidateRecord` additionally
      refuses a `dimensions` key by name, an array `dimension` even with one
      member, and cross-parsing with `ConsolidationRecord` (which itself needs
      ≥ 2 **distinct** dimensions, so it is not an escape hatch). Second half:
      `isAccepted` (`candidate_record.ts:122`) is the single acceptance site and
      reads only `ACCEPTED_STATE`; `requireLifecycle` refuses an absent state
      rather than defaulting it; and `mutated` is an unrecognised lifecycle
      value that is refused outright — the test *"an unrecognised lifecycle
      value is refused"* names it explicitly, because `mutated` arriving where
      `accepted` was expected is the reference-implementation defect 3.4 cites.
      *"Existence is not acceptance"* asserts `isAccepted` false for all eight
      non-promoted states.
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
- **E4 — Activation-ladder arity: DECIDED 2026-08-30, option B — SIX rungs,
  twelve stages.** AI council, anthropic + openai, **2/2**. The argument that
  carried it was not "more is better": option A requires EDITING Phase 1's exit
  criterion in order to fit, and the distinction it drops is the one Phase 6's
  delivery experiment exists to measure. Two independent roadmaps needing the
  same distinction (`road-to-experience-loop-broadening` Phase 5 needs five
  activation/adherence states) was the strongest evidence available, and the
  cost asymmetry points the same way — an under-populated rung can be collapsed
  later, a distinction never recorded cannot be added to historical data.
  One seat attached a CONDITION and `src/scripts/_lib/activation_ladder.ts`
  § `LADDER` is it: every rung maps to a receipt field and an observable
  predicate, with an explicit `unknown`, asserted by
  `tests/scripts/activation_ladder.test.ts`. Both seats rejected option (c) —
  the coupling is definitional, not contingent: a 9-stage cascade has no
  adherence stage.
  **`revisit-if`:** any rung or stage lacks a distinct observable predicate, or
  stays `unknown` across representative Phase 1 evaluations — in which case
  keep the six rungs and reconsider the nine-stage cascade independently.
  Brief: `agents/evidence/analysis/evolution-kernel-decisions-brief-2026-08-26.md`.
- **E5 — Minimality tie-break order: DECIDED 2026-08-30, option A — the FOUR
  criteria `tokens → artifacts → scope → precedence`, and the fifth criterion is
  OUT.** AI council, anthropic (claude-sonnet-4-5) + openai (gpt-4o), **2/2**.
  The argument that carried it is about *when* the tie-break runs, not about
  which values matter: by the time two candidates are tied they have both
  already survived selection evaluation and every hygiene check, so the
  blast-radius constraint option B leads with is **already satisfied** and cost
  is what is left to decide. "Simpler mechanism" was rejected as unquantifiable
  at that point — one seat put it directly: the candidates have passed all
  functional checks, so there is no outcome signal left to measure simplicity
  against, and admitting it converts a mechanical decision into a reviewer's
  taste vote. The four surviving criteria are all countable from candidate
  metadata (token count, artifact count, scope enum, precedence rank), which is
  what makes the order reproducible.
  **`revisit-if`:** a promoted candidate chosen by cost-first ordering causes an
  incident that scope-first ordering would have prevented, **and** that incident
  was not detectable by the outcome metrics which declared the two equivalent —
  the conjunction matters, because the second half means the metrics were
  incomplete rather than the ordering wrong.
  Original framing, kept: the two parents' orders invert, so this changes
  outcomes. Spent in Phase 4.5.
- **E6 — Curator operation set: DECIDED 2026-08-30, option B — SEVEN ops**,
  `KEEP / ADD / MERGE / REPLACE / SPLIT / RETIRE / SKIP`. AI council, anthropic +
  openai, **2/2**. The contradiction argument carried it and is not a preference:
  step 7.6 is already adopted in this same roadmap and specifies the verdict set
  `KEEP / REVISE / MERGE / SPLIT / RETIRE`, so a 4-op curator would produce
  verdicts it cannot execute.
  **The 6-op middle — deferring `SPLIT` — is explicitly REJECTED**, and the
  brief's own recommendation is overruled on this point. One seat called it *"an
  unstable equilibrium"*: it still contradicts 7.6's verdict set, so it buys
  nothing the 4-op answer does not also cost. The same seat added the algebra
  argument the brief did not have — `MERGE` is n→1 and `SPLIT` is 1→n, and
  without it an overgrown rule becoming two must be expressed as
  `RETIRE + 2×ADD`, which loses the semantic link and makes the operation's
  intent unreadable in the audit log.
  `SPLIT` remains the one genuinely new mechanism and its cost stays visible;
  `RETIRE` lands on the existing surface the brief identified.
  **`revisit-if`:** 7.6 is revised to drop `SPLIT` from its verdict set, or
  `SPLIT` is never invoked in twelve months and no curator reports its absence
  blocking a refactoring.
  Original framing, kept: 4 ops or 7? Recommendation was: 7 — split and
  retire are the anti-sprawl actions, and 7.6 depends on them existing. Brief:
  `agents/evidence/analysis/evolution-kernel-decisions-brief-2026-08-26.md` — it adds that `RETIRE` already has a carrier
  (`artifact-engagement-flow.md:32-33`) while `SPLIT` is the one genuinely new
  mechanism, so a 6-op middle exists.
- **E7 — Sealed-holdout cadence: DECIDED 2026-08-30, option B — promotion
  candidates ONLY.** AI council, anthropic + openai, **2/2**. The gating
  condition is free: 3.4's lifecycle enum already carries `promotion-eligible`,
  so option B costs a state read rather than new machinery. The decisive
  argument is that option A cannot buy anything with what it spends —
  `_lib/paired_verdict.ts:54-65`'s discordant-trial floor means only a powered
  verdict can conclude, so a cascade that reads the holdout before promotion
  eligibility spends unbiased signal on runs that could not have concluded
  anyway. Consulting it every iteration converts a held-back validator into part
  of the optimisation loop, which is the adaptive-overfitting risk one parent
  killed the option by name for. One seat put the trade plainly: option A's
  "simpler control flow" trades code simplicity for statistical validity.
  **`revisit-if`** — refined by the council over the brief's looser version,
  because "fewer than 5 % reach sealed evaluation" measures the wrong thing:
  reopen when **holdout verdicts would have CHANGED the promotion decision in
  fewer than 5 % of promotion-eligible cases**, which is the condition under
  which the sealed partition adds no marginal signal over selection evaluation.
  Original framing, kept: every cascade, or promotion candidates only?
  One parent killed every-iteration as an adaptive-overfitting risk; the other
  runs it every cascade. Brief: `agents/evidence/analysis/evolution-kernel-decisions-brief-2026-08-26.md` — and it
  reframes the question: there is **no** holdout machinery in this repository
  yet, so nothing is being preserved and the decision is greenfield.
- **E8 — State-taxonomy arity: DECIDED 2026-08-30, FOUR classes plus an explicit
  pointer to the existing Class A / Class C boundary.** AI council, anthropic +
  openai, **2/2**. The brief's redundancy finding held — the proposed fifth class
  restates a boundary an ADR already records, and the prohibition it would add
  already exists — and one seat named the principle underneath it, which is the
  part worth carrying forward: **taxonomies classify; validations enforce.** The
  fifth class attempts enforcement work (prohibiting production-adaptive
  behaviour) inside a classification system. The correct shape keeps the taxonomy
  describing *what an artefact does* and leaves a validation layer to reference
  the ADR for *where it may do it* — which also makes the prohibition's reason
  explicit rather than hiding it inside an enum variant's name.
  **`revisit-if`:** a Class C artefact is allowed production-adaptive behaviour
  and the existing ADR-level boundary check fails to prevent it — i.e. the
  boundary turns out to need taxonomy-level encoding because it is not enforced
  where it lives now.
  Original framing, kept: 4 classes or 5, splitting experiment-adaptive
  from production-adaptive with the latter prohibited by default? Brief:
  `agents/evidence/analysis/evolution-kernel-decisions-brief-2026-08-26.md` — which finds the proposed 5th class
  restates ADR-124's Class A/C boundary, and the prohibition it would add
  already exists.
- **E9 — Cascade stage set: DECIDED with E4, option B — twelve stages.** Same
  council round, 2/2. Phase 4 builds them; nothing in Phase 1 depends on the
  stage count, so the verdict is recorded here and spent there. Its half of the
  `revisit-if` is the live one: if a stage turns out to lack a distinct
  observable predicate, the six-rung ladder stays and the cascade is
  reconsidered on its own. Original framing, kept: 9 stages or 12? If 9,
  Phase 1's exit criterion cannot be produced and must be rewritten. Brief:
  `agents/evidence/analysis/evolution-kernel-decisions-brief-2026-08-26.md`.
- **E10 — Mutation dimensions: SPLIT 2026-08-30, conservative side taken —
  THREE.** AI council, anthropic + openai, **1/1, not convergent**, which
  `roadmap-progress-sync` classes as an escalation condition rather than a
  verdict. anthropic: four, adding `verification` now, on an irreversibility
  argument — dimensions are metadata on candidate records, so adding one later
  makes every prior candidate unclassifiable under it, and the seat reframed the
  question as *"not premature optimization — avoid irreversible information
  loss"*. openai: three, adding `verification` only on demonstrated need.
  **Three was taken because a split is not a licence to pick the more convenient
  half**, and here three is also what 3.3 already specified, so its verify clause
  stands unchanged rather than being re-scoped to fit an answer.
  **The losing seat's concern is discharged as a design constraint, not
  dismissed** — see 3.3 for the mechanism: the record is versioned, and the
  unknown-dimension refusal lives in the validator while the reader flags rather
  than throws, so adding a fourth dimension later is additive and historical
  records stay readable. That was the whole substance of the irreversibility
  argument, and it is satisfied without widening the alphabet.
  **`revisit-if`:** after 100 candidates, fewer than 3 carry `verification` as a
  primary dimension **and** no curator reports verification changes being
  mislabelled as `content` to fit the available vocabulary — the conjunction is
  the point, since mislabelling is how a missing dimension hides.
  Original framing, kept: do `activation/routing/content` stand alone, or
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
