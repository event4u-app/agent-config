---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Added as a draft proposal, not as active work. Archiving is impossible (nothing has run), parking in later/ would grow the later_roadmaps floor instead of the active one, and folding it into road-to-experience-loop-broadening is the open question E2 puts to the owner — pre-merging would decide it by authoring."
estate_growth_exempt: >
  DE-DUPLICATED 2026-08-31 (drain run 11). This key was declared TWICE in this
  frontmatter. YAML is last-wins, so the earlier declaration was silently dead
  and the ratchet never read it. Both rationales are preserved below; neither is
  strengthened, weakened, or newly claimed, and the change adds no growth of any
  kind (active_roadmaps, later_roadmaps, open_blockers, skill_count,
  skill_description_tokens and concern_count are all +0 in this diff).
  .
  FIRST RATIONALE, verbatim from the dead declaration: "Promoted draft -> ready
  2026-08-30. The merge-authority blocker was scoped by the AI council on
  2026-08-29 to gate Phase 7 alone; Phases 1-6 are declared legal, so executable
  work exists today. The growth is a status flip, not a new file - the estate
  gains no roadmap it did not already carry, only one collect() now counts."
  .
  SECOND RATIONALE, the one the ratchet has been reading:
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

> **CARRIED CONDITION — TRANSFERRED 2026-08-31 to
> `road-to-harness-promotion-bridge.md` § Carried blocking condition.** Placed
> here on 2026-08-30 as the `merge-authority` council's own instruction, it
> travels with Phase 7 on the 2026-08-31 verdict (2/2 convergent): its named
> discharge point is *the first commit that creates a promotion path*, and that
> commit now belongs to the receiver, so leaving the condition here would leave
> it with no reachable discharge point.
>
> It transferred **unmet and unweakened**, with its full origin text reproduced
> verbatim in the receiver's § Provenance. In the receiver it is encoded to
> BLOCK rather than to sit alongside: no step there may close while it is
> undischarged, independently of `blocker: merge-authority`. The obligation it
> states — that the non-promotion property be MECHANICALLY ENFORCED rather than
> merely stated, and that a check over a population of zero does not discharge
> it — is unchanged.

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
- [-] **0.8 Merge authority resolved.**
      **MERGED (outcome transferred to road-to-harness-promotion-bridge)** —
      carried there verbatim as step 0.8, still `[~]`, still deferred to the
      owner. `[-]` means TRANSFERRED, not cancelled and not satisfied: the
      merge-authority decision is as open as it was. The `blocked-by`
      annotation moved with the step, because `blocker: merge-authority` moved
      with it.

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

- [ ] <!-- roadmap-status: guarded-baseline -->
      **4.1 Cascade cheap to expensive, abort on the first hard failure.** The
      **GUARDED BASELINE 2026-08-31 — the deterministic prefix is built, wired
      and RED-proven; the box stays `[ ]` because the twelve-stage form is not.**

      ```yaml
      guarded_baseline:
        category: future-mechanism
        scope: src/scripts/_lib/evaluation_cascade.ts
        command: npx vitest run tests/scripts/evaluation_cascade.test.ts
        red_proof: sabotage run 2026-08-31 — 2 failed / 13 passed, then 1 failed / 14 passed
        sabotage_model: let the prefix assign `activation`; then unwire the cascade from the runner
        recheck_when: src/scripts/_lib/evaluation_receipt.ts
        discharged_ac: the deterministic prefix aborts on the first hard failure at zero model calls, and AC-3 and AC-5 close on its production caller
        pending_ac: the receipt-bearing stages and one settled twelve-stage enumeration
      ```

      **AI council 2026-08-31, and it resolved to a CONVERGENT Option B — but
      only after a tie-break that the tree answered, so the route is recorded
      rather than the conclusion alone.** anthropic/claude-sonnet-4-5 returned
      *"Conditional Option A"*, explicitly gated: *"Choose Option A IF AND ONLY
      IF verification confirms Phase 1 families are failure-mode buckets, not
      observation methods … If either verification fails: Option B."*
      openai/codex-default returned Option B outright. Both seats present, 2/2.
      **The condition was checked against the tree and it FAILS**, which makes
      this a convergence and not a split: Phase 1's step 1.1 verify clause reads
      *"a deliberately failing trigger eval is classifiable as content vs
      activation vs adherence **from the recorded receipt alone**"* — a receipt
      is an observation, so the families are observation-grounded and Option A's
      own precondition is false. Both seats therefore land on B.
      **The seat that lost the vote supplied the thing that mattered.** It was
      anthropic that noticed nobody had verified what the families actually are:
      *"Neither reviewer noticed we're guessing what Phase 1 families mean."*
      That objection is what made the decision checkable instead of a preference.

      **What Option B licensed, and what it refused.** Both seats agreed the
      deterministic prefix should be built now and both refused to let it close
      4.1. openai: *"That supports implementing the prefix — not declaring the
      full cascade complete."*

      **Built: `src/scripts/_lib/evaluation_cascade.ts`**, six stages, aborting
      on the first hard failure —
      `schema-validity → path-ownership → holdout-disclosure → budget →
      near-duplicate → metric-verdict`.
      **Every stage is free**, which is why these six are the ones that can ship
      without receipts, and it makes *"a candidate failing the cheapest stage
      consumes no model call"* structurally true rather than asserted:
      `model_calls` is a literal `0` on every path, not a counter, because there
      is no code path in the module that could increment one.
      **No stage is SOFT**, per the earlier round's convergent finding — every
      stage either passes or aborts, with no third warn outcome a caller could
      ignore.
      **The prefix may assign only `content` and `unknown`.**
      `PREFIX_ASSIGNABLE_FAMILIES` excludes `activation` and `adherence` by
      construction and a test pins it, because assigning either from a
      deterministic proxy is exactly the evidence-manufacturing openai named: *"a
      holdout leak is not evidence of an `activation` failure … that produces
      labels, but not trustworthy classifications."* No fifth family is invented.

      **Wired into the real runner** — `evolution_lab.ts` `verbRun`, which
      previously cloned and returned. It now re-reads each record from disk and
      runs the cascade over it, so stage 1 is a real gate at the call site
      rather than a formality over an already-parsed object, and it reports each
      candidate's outcome, family and `model_calls` on stdout. A run with no
      metric rows aborts at the verdict stage rather than passing silently,
      which is the honest outcome for a run that measured nothing.

      **A defect this work found in the tree, recorded rather than smoothed
      over.** An unowned mutation path does NOT reach a distinct path-ownership
      stage: `parseMutations` already calls `assertMutationPathsOwned`
      (`_lib/candidate_record.ts:434`), so it throws inside stage 1. Catching
      that as a schema failure would file a path-ownership violation under the
      wrong stage — and the failing stage is precisely what Phase 1's
      classification reads, so the mis-attribution would corrupt the
      classification rather than merely mislabel a message. The cascade now
      attributes it to stage 2 explicitly.
      **The consequence is that stage 2's own re-check is UNREACHABLE and
      therefore untested, and it is labelled as such in the code instead of
      being counted as defense in depth.** Measured: neutralising its abort left
      **15/15 green**. It is kept because it is free and fails closed if the
      parser ever stops enforcing ownership, but an unproven guard is written
      down as unproven.

      **Sensitivity was OBSERVED in three directions and the first probe found a
      real gap rather than confirming the tests.** (1) Neutralising the stage-2
      abort: **15/15 stayed green** — the finding above, and the reason stage 2
      now carries a label instead of a claim. (2) Letting the prefix assign
      `activation`: 2 failed / 13 passed, naming both the family-permission test
      and the holdout-classification test. (3) Unwiring the cascade from the
      runner: 1 failed / 14 passed on *"a run EVALUATES each candidate"*. Every
      probe restored to 15/15 and both files restored byte-identically.

      **A downstream break this work caused, and the design it forced.** Wiring
      the cascade initially made `run` exit non-zero whenever no metrics were
      supplied, which reddened the existing
      *"run materialises five candidates, compare passes, clean removes exactly
      them"* in `tests/scripts/evolution_lab.test.ts` (expected 0, got 3). The
      test was RIGHT and the change was wrong: materialising without measuring
      has not failed, and turning it into a failure would have changed a verb's
      contract to make a new stage look reachable. Fixed by giving the cascade a
      THIRD outcome — `incomplete` — which is neither a pass (there is no
      verdict, so nothing may read one) nor an abort (nothing failed). The run
      prints `metric-verdict NOT REACHED` and exits 0. Naming the state is what
      keeps "no metrics" from being silently benign; the alternative was to let
      an unmeasured candidate read as evaluated.

      **What is NOT built, stated so the closure cannot be read as more than it
      is.** The receipt-bearing stages — activation/delivery, adherence, and the
      statistical stages — are absent, because they need an independent,
      append-only receipt producer with version-bound attributable observations,
      and no such producer exists. One settled twelve-stage enumeration is also
      still missing: the prior round recorded that one seat asked twice and
      produced two materially different enumerations, which is why the arity was
      decided and the stage semantics were not. `recheck_when` above names the
      receipt module whose arrival reopens this step.
      stage set is E9; if the 12-stage form is chosen, activation/delivery and
      adherence are their own stages, which is what Phase 1's exit criterion
      requires.
      verify: a candidate failing the cheapest stage consumes no model call, and
      the stage list can produce the Phase 1 classification.
      **STAYS OPEN — AI council 2026-08-31 returned `REVISE`, not a greenlight,
      and the round was DEGRADED at 1/2.** E9 decided the *arity* (twelve) and
      enumerated the stages nowhere; this round asked for the enumeration and
      got one, with the verdict *"keep E9's twelve-stage arity, but do not treat
      the stage semantics as decided until the receipt trust boundary and
      evidence-cost contract are explicit."*
      **The degradation, recorded rather than implied.** The anthropic seat
      returned `exit_1` with an empty stderr, 0 tokens and ~87 s latency on
      **three** attempts at this question — the full two-decision form twice, and
      the split single-decision form once. The same seat answered the other four
      council questions of this run normally, so the failure is specific to this
      question's shape, not to quota or availability. Under the N=3 budget the
      run stopped retrying and took the single-seat answer, per the mandate to
      degrade to the best available seat and record it.
      **A second reason not to close on it, found by running it twice.** The two
      openai passes produced two MATERIALLY DIFFERENT twelve-stage enumerations —
      different names, different order, and a different placement of the
      statistical stage. One seat asked twice and answering differently is
      evidence that the design has not converged, which is what `REVISE` means
      here rather than a formality.
      **What the answers agree on, and it is the useful part.** No stage may be
      SOFT — a condition whose failure does not block "actually done" is a
      diagnostic attached to the receipt, not a cascade gate; `underpowered` is a
      hard non-pass meaning *collect evidence*, never *reject permanently*; and
      the first failed stage maps onto Phase 1's existing
      `content | activation | adherence | unknown` **without** inventing a fifth
      family. Buildable today against existing primitives: schema validity
      (`candidate_record.ts`), the holdout / budget / diversity guards
      (`harness_evolution_guards.ts`), the near-duplicate screen
      (`shingle_similarity.ts`), and the paired verdict (`paired_verdict.ts`).
      **What blocks the rest:** the ladder stages need an *independent,
      append-only receipt producer* with version-bound, attributable
      observations — which does not exist. A predicate being implementable is not
      evidence that trustworthy evidence for it can be produced.
      **Prerequisite before this step is attempted again:** the receipt contract
      (schema + producer version, immutable run and candidate identity,
      append-only evidence, explicit representation of missing or conflicting
      evidence). Without it stages 6-11 are unsafe, because the candidate, the
      evaluated agent and the mutable harness can all influence both the
      behaviour and its receipt.
- [x] **4.2 Report a metric vector, never a weighted total.** Include an
      `artifact-count delta` row — that is where the sprawl concern belongs,
      inside the gate where it can prevent something.
      verify: no code path computes a single scalar score.
      **DONE 2026-08-31.** The record type is
      `src/scripts/_lib/evaluation_vector.ts` — `MetricVector` (`:83-86`) has
      exactly two fields, `candidate_id` and `rows`, and no field that could
      hold a summary number. Rows come in two kinds (`:60-79`) because two
      different things are measured: a `PairedRow` carries a `PairedVerdict`
      from `_lib/paired_verdict.ts` and a `CountedRow` carries an integer delta
      with no trials behind it. Forcing the artifact delta through a paired
      verdict would invent trials; giving an outcome metric a bare number would
      let a caller assert a result without evidence — both shapes exist so
      neither lie is available.
      **The artifact-count row is inside the gate, not beside it.**
      `buildVector` (`:97`) REFUSES a vector that omits the
      `artifact-count-delta` row, and `promotionVerdict` (`:230`) blocks on a
      delta above its ceiling — default `0`, a STATED conservative default
      rather than a measured one, overridable by a caller that knows it is
      looking at a curator `ADD`. A test asserts the row can refuse a promotion
      the paired rows would have allowed.
      **The verify clause is a static scanner, proved SENSITIVE before it was
      trusted.** `findScalarCollapse`
      (`tests/scripts/evaluation_vector.test.ts:48`) bans `weighted` / `weight`,
      `*_score` summary names, a `score: number` field, `.reduce(`, and any
      signature taking a `MetricVector` and returning `number`. It runs over
      every `.ts` under `src/scripts` that mentions `MetricVector`, unioned with
      a named core set, and both halves assert non-emptiness — a scan over
      nothing exits green. Sensitivity was OBSERVED, not argued: a
      `weightedTotal(v: MetricVector): number` was added to the module, the
      scanner turned the suite red naming
      `src/scripts/_lib/evaluation_vector.ts: ["weighted", "vector-to-number"]`,
      and removing it restored 18/18 green. The comment stripper carries its own
      anti-vacuity assertion, because a stripper returning `''` would make the
      scan pass over nothing.
- [x] **4.3 Make the verdict hierarchy explicit.** `paired_verdict` per metric
      decides; `underpowered` is not a pass; a Pareto frontier may only order
      candidates that are already non-dominated and never promotes.
      verify: a fixture where the frontier prefers a candidate whose
      `paired_verdict` is `underpowered` produces no promotion.
      **DONE 2026-08-31, reusing `_lib/paired_verdict.ts` rather than deciding
      anything again** — Risk 1 on this roadmap is a second verdict beside that
      one, so `evaluation_vector.ts` imports the type and never recomputes a
      verdict. The hierarchy is `promotionVerdict`
      (`src/scripts/_lib/evaluation_vector.ts:230`), the ONLY promoter in the
      module: it refuses on a regression, on an `underpowered` row, on an
      artifact delta above the ceiling, on a vector with no paired row, and on a
      vector where every paired row concluded `no-change` — the last because
      `no-change` is a decided absence of improvement, not a clean sheet.
      **`underpowered` is incomparable, not merely non-passing.** `compareRow`
      (`:145`) ranks `pass > no-change > regression` and returns `0` against an
      `underpowered` row in either direction: it is an absent measurement, so it
      can neither win a row nor lose one. A test pins both directions.
      **The fixture the verify clause asks for is real rather than rigged**
      (`tests/scripts/evaluation_vector.test.ts:211-247`). `winner` beats
      `plodder` on `token-cost` (pass vs no-change) and is incomparable on
      `task-success`, so it genuinely DOMINATES and is the sole member of
      `paretoFrontier([winner, plodder])`. Its `task-success` verdict is
      `underpowered`, and filtering the frontier through `promotionVerdict`
      yields `[]`. The separation is structural: `paretoFrontier` (`:205`) is
      never consulted by `promotionVerdict`, so a frontier preference has no
      path by which to become a promotion.
- [x] **4.4 Keep a pathology archive, not only a frontier.**
      **DONE 2026-08-31.** `src/scripts/_lib/pathology_archive.ts`, 25 tests in
      `tests/scripts/pathology_archive.test.ts`, plus 2 in
      `harness_evolution_guards.test.ts` for the registration.

      **Objection 2 is settled — AI council 2026-08-31, and it was a SINGLE-SEAT
      DEGRADED round, recorded as such rather than as convergence.** Present:
      openai/codex-default. Absent: anthropic/claude-sonnet-4-5, `exit_1`, no
      output — the same seat-and-shape failure 4.1 already records for a long
      multi-decision question. Under the N=3 budget the run took the best
      available seat and did not retry.
      Verdict **2c revised**: of the three candidate rules, 2a needs a human
      gold standard and 2b needs a coverage metric, and neither exists, so
      recency is the only currently supportable deterministic rule. The seat's
      own caveat is carried into the code rather than dropped: *"recency says
      nothing about quality and may replace a genuinely better intervention with
      a regression"*, so history is append-only and every decision is stamped
      with `ranking_rule_version` — representatives are RECOMPUTED when a
      quality metric arrives, never lost.
      **The rule is TOTAL, which is what the objection actually demanded.**
      `replacesRetained` (`:186`) orders on
      `attempt_sequence DESC, candidate_id ASC, attempt_id ASC`. Ordering is by
      ingester-assigned sequence and **never** by timestamp — producer clocks
      collide and arrive out of order, which makes a timestamp rule non-total,
      and a tie-break that is declared but unreachable is the defect the seat
      named in the alternative. All three tie-break levels are exercised
      separately, and one test asserts a newer `observed_at` on a lower sequence
      does NOT win.
      **`WHERE` reuses the ladder** — `PATHOLOGY_WHERE` IS `LADDER_RUNGS`
      (`_lib/activation_ladder.ts:36-43`), asserted by identity so a parallel
      execution-stage taxonomy cannot drift into existence. `WHY` is a closed
      8-value REASON axis whose order is its precedence order, with
      `reason_unknown` last so it is a fallback and never a precedence winner. A
      test asserts no `WHY` value is a ladder rung or a `<rung>_failed`, which is
      the collapse-into-WHERE failure the seat rejected in the first draft.
      **Objection 3 is discharged by the cell shape.** Each cell carries
      frequency-bearing metadata from append-only attempt history —
      `attempt_count`, `classifiable_count`, `unclassifiable_count`,
      first/last observed sequence and time, the retained representative with
      its `retained_ranking_key` and `retained_ranking_rule`, and the
      schema/classification/ranking/cohort version quad. Ingest is **idempotent**
      by `attempt_id`, because without that a retry loop silently inflates the
      very frequency evidence the guard reads. Cells are keyed on the version
      quad as well as on `WHERE x WHY`, so attempts recorded under a different
      vocabulary are never summed with these.
      **The guard consumes a versioned query, never storage internals**, as the
      seat required: `dominanceWindow()` (`:239`) returns the version quad
      alongside its rows and `dominanceVerdict` takes that query, so a caller
      cannot hand it a raw array. It returns attempts rather than cells for the
      reason the seat gave — a last-N window is not reconstructible from
      aggregates.

      **Objection 4, and the premise turned out to be FALSE — checked rather
      than accepted.** The objection assumed the `0.6` in this step's verify
      line already meant textual similarity, and warned that reusing it would be
      *"a semantic change wearing a constant's clothes"*. **There is no such
      constant.** `diversityCollapsed`
      (`_lib/harness_evolution_guards.ts:215`) is a DISTINCT-COUNT check with
      `minDistinct = 2` and no ratio anywhere, and the only near-duplicate
      constant in the tree is `NEAR_DUPLICATE_THRESHOLD = 70`
      (`_lib/curator_ops.ts:106`) — an integer percentage on a different scale.
      So the collision the objection feared does not exist, and the number was
      free to be given its own meaning. It is nonetheless given a **separate**
      name rather than reused: `PATHOLOGY_DOMINANCE_THRESHOLD = 0.6`, with the
      denominator, window and floor the objection asked for —
      `PATHOLOGY_WINDOW_SIZE = 50` (latest N classifiable attempts) and
      `PATHOLOGY_MIN_CLASSIFIABLE_ATTEMPTS = 20`. All three are STATED policy
      defaults, not measured optima, and say so at the constant with a
      `Revisit-if`.
      **`warming-up` is a real state and explicitly NOT a pass.** Below the
      floor the guard refuses to return `ok`, so an empty archive cannot read as
      healthy — the same discipline `underpowered` gets in 4.3.

      **Wired, not an unwired library — which is the lesson AC-3 and AC-5 are
      still open on.** `STOP_CONDITIONS` gains `pathology-dominance`
      (`detector: 'dominanceVerdict'`), and a test resolves that detector name
      to a real exported function rather than trusting the string.
      **The arity of step 0.6's stop set therefore moves 4 -> 5, and it is
      recorded here instead of being bumped silently.** It is an ADDITION and
      never a replacement — a second test pins both `diversity-collapse` and
      `pathology-dominance` so neither can be dropped into the other — so it
      STRENGTHENS 0.6's set rather than relaxing anything 0.6 decided. The two
      catch different things: the older row asks whether this run's candidates
      are distinct, and cannot see a search that keeps producing textually
      different candidates which all fail the same way.

      **Sensitivity was OBSERVED in four directions, and the first probe found a
      REAL GAP in these tests rather than confirming them.** Deleting `a.why`
      from the cell key left **23/23 green** — the "both retained" case differs
      on both axes, so it could not tell a two-axis key from a one-axis one.
      Two axis-isolating tests were added in response; re-probed, dropping `why`
      reds *"the WHY axis is load-bearing"* and dropping `where` reds *"the
      WHERE axis is load-bearing"*, one failure each. Neutralising the
      `warming-up` floor reds *"below the minimum sample it reports warming-up,
      which is NOT a pass"*. Every probe restored to 25/25, and the module's
      byte-identical restore was confirmed with `git diff`.
      `from-skipped-parent`, and it was that parent's headline contribution: a
      pure frontier loses the information about *why* a candidate exists, so
      archive the best intervention per `WHERE × WHY` failure cell over closed
      vocabularies. The master adopted the attack "search collapses into
      paraphrases" and dropped the mechanism proposed to prevent it, with no
      kill ID.
      verify: two candidates with equal vectors but different pathology cells
      are both retained, and a diversity-collapse stop (0.6) reads the archive.
      **STAYS OPEN — AI council 2026-08-31, anthropic + openai, 2/2 present and
      2/2 on `REVISE` rather than on a greenlight.** Both seats produced a
      closed `WHERE x WHY` grid (one 6x6, one 7x6) and both refused to approve
      it, converging on the same two objections.
      **Objection 1, and it is a defect in the question rather than in the
      answer.** The brief grounded `WHERE` in "the six-rung ladder" and called
      the anchor obvious **without enumerating its six values**. Both seats
      called that methodologically backwards — one refused to treat its own
      `WHERE` names as more than conditional on confirmation against
      `src/scripts/_lib/activation_ladder.ts`, warning that a parallel
      execution-stage taxonomy must not be invented if the ladder already
      defines different semantics. The next attempt at this step MUST paste
      `LADDER_RUNGS` (`eligible → selected → projected → delivered → visible →
      adhered`, `activation_ladder.ts:36-43` — **anchor corrected 2026-08-31**;
      the line read `:35-42`, and the `export const LADDER_RUNGS` block actually
      spans `:36-43`, with `export type LadderRung` on `:44`).

      **OBJECTION 1 IS DISCHARGED BY THE TREE, verified 2026-08-31 — and 4.4
      stays OPEN on Objection 2 alone.** The enumeration both seats refused to
      treat as more than conditional is confirmed present and is exactly six
      values, read from `src/scripts/_lib/activation_ladder.ts:36-43`:
      `eligible`, `selected`, `projected`, `delivered`, `visible`, `adhered`.
      So the *"defect in the question"* is repairable at zero cost — the next
      attempt pastes the block above rather than re-deriving it — and the
      warning attached to it is satisfied in the direction the seat wanted: the
      ladder DOES define the semantics, so a parallel execution-stage taxonomy
      must NOT be invented, and `WHERE` reuses these six.

      **What this does and does not buy.** It removes one of the two objections
      that were holding 4.4, and it removes the cheaper one. Objection 2 — *what
      makes an intervention "best" within a cell* — is the architecturally prior
      decision, is untouched by this, and remains the reason 4.4 cannot be built:
      both seats ruled the archive cannot exist without a deterministic ranking,
      tie-break and replacement rule. The `0.6` diversity constant's missing
      denominator, observation window and minimum sample size are likewise
      untouched.
      **Objection 2 — the architecturally prior decision this step is missing.**
      *What makes an intervention "best" within a cell* is undefined, and both
      seats ruled the archive cannot be built until it is: without a
      deterministic ranking, tie-break and replacement rule, "archive the best
      intervention per cell" names no operation. Options one seat enumerated:
      lowest edit distance to a human gold standard (needs a gold standard),
      highest measured failure-class coverage (needs a coverage metric), or
      most-recent (trivial but deterministic). **Recorded here and not as a
      `## Blockers` entry on purpose:** it has a step, an owner and a decidable
      option set, so it is ordinary design work inside 4.4 rather than a
      condition with nowhere to live — the shape a blocker exists for.
      **Objection 3 — a best-per-cell archive cannot be the diversity signal.**
      Retaining one winner per cell erases whether attempts were distributed
      50/50 or 99.9/0.1: identical occupancy, radically different evidence of
      search collapse. Each cell must therefore carry frequency-bearing summary
      metadata from append-only attempt history (attempt count, classifiable
      count, first/last observation, schema and cohort version, best retained
      intervention and its ranking evidence), and the guard must consume a
      versioned archive query rather than storage internals.
      **On the `0.6` in this step's own verify line:** both seats warned it
      cannot be carried across unexamined. If it currently means textual
      similarity it is not a dominant-cell share, and reusing the number would
      be a semantic change wearing a constant's clothes. It needs an explicit
      denominator, observation window and minimum sample size, or a separately
      named dominance threshold.
- [x] **4.5 Minimality breaks ties.** Order per E5: the FOUR criteria
      `tokens → artifacts → scope → precedence`. The fifth criterion the skipped
      parent added — simpler mechanism — is **OUT**. E5's recorded reasoning is
      that by tie-break time both candidates have already survived selection
      evaluation and every hygiene check, so there is no outcome signal left to
      measure simplicity against, and admitting it converts a mechanical
      decision into a reviewer's taste vote. Note that the two parents' orders
      invert, so identical candidates resolve differently depending on the
      choice — this is not a formatting detail.
      **Amendment 2026-08-31 — transcription, not a decision.** This step
      previously read *"Order per E5, and include the fifth criterion the
      skipped parent added: simpler mechanism"*, which contradicted E5 in the
      same sentence that cited it: E5 (decided 2026-08-30, AI council, anthropic
      + openai, 2/2) records the four-criterion order **and** the fifth
      criterion's rejection. The step text predated the verdict and was not
      updated when it landed. Correcting it here transcribes the existing E5
      decision and creates no new one; **E5 is not reopened** and its
      `revisit-if` is untouched.
      verify: two candidates with identical vectors resolve deterministically
      under the committed order.
      **DONE 2026-08-31.** `src/scripts/_lib/minimality_tiebreak.ts`.
      `MINIMALITY_ORDER` (`:45`) is exactly `tokens -> artifacts -> scope ->
      precedence` and the test pins its ARITY as well as its contents — a test
      that only checked the four present criteria would stay green the day a
      fifth was added, which is the specific thing E5 ruled out. `SCOPE_ORDER`
      and `PRECEDENCE_ORDER` (`:53`, `:61`) rank narrowest and least-binding
      first, so all four criteria are integers read off candidate metadata and
      none is a judgment.
      **Determinism, and the order shown to be load-bearing.** `breakTie`
      (`:118`) walks the order and returns at the first difference; the fixture
      resolves identically across 20 runs and with the arguments swapped. The
      same fixture run under the INVERTED order flips the winner from `cheap` to
      `narrow` — evidence that the order is a decision and not a formatting
      detail, which is why it needed E5.
      **An all-four tie returns `winner: null` and escalates.** That is the
      honest answer and it is deterministic. `orderByMinimality` (`:155`) needs a
      total order to sort with and falls back to the candidate id; the header and
      a dedicated test record that this is a sort STABILISER, never a fifth
      criterion — it never appears in a `TieBreakResult`.
- [x] **4.6 Select regressions from the affected neighbourhood.**
      `from-skipped-parent`: use the code graph to choose which regressions to
      run for a given candidate. The master adopted the attack "local
      improvement, global regression" as a risk with no mechanism behind it.
      This is distinct from the killed curriculum generator — it selects
      existing regressions, it does not author tasks.
      verify: a candidate touching one surface runs the regressions its
      neighbourhood names, and a fixture proves a neighbour regression is caught.
      **DONE 2026-08-31, and the graph is NOT the one the step names — stated
      rather than hidden.** `src/scripts/_lib/regression_neighbourhood.ts`.
      This tree carries two graph surfaces and only one resolves:
      `agent-config code-graph detect` answers `no code-graph source detected`,
      because `hooks.code_graph.enabled` ships `false`
      (`src/config/agent-settings.template.yml:1373-1374`), so the native
      engine has no index to select against. `src/scripts/discovery_graph.ts`
      does answer — 785 nodes and 1672 edges on this checkout — so the
      neighbourhood is built on its `affected` BFS. The substitution changes
      what a neighbour IS: artefact relations (`supersedes`, `routes_to`,
      `references_adr`, pack and workspace membership) rather than symbol
      relations. For rule / skill / guideline candidates that is the surface
      carrying the coupling a rewrite breaks; for a `.ts` symbol candidate it is
      the weaker one, and the module says so by REFUSING rather than by
      degrading.
      **The verify clause's first half.** `selectRegressions` (`:172`) walks
      `DEFAULT_NEIGHBOURHOOD_DEPTH = 2` (`:125`, a STATED default with a
      `revisit-if`, not a measured optimum) out from each touched surface and
      selects every registry entry whose guards intersect the result. A
      candidate touching one rule selects the regression guarding the skill it
      `routes_to`, with `reason: 'neighbour'` recorded so the selection is
      explainable from the diff.
      **The fixture, and it is falsifiable rather than decorative**
      (`tests/scripts/regression_neighbourhood.test.ts:111-139`). The candidate
      edits a rule and breaks the skill it routes to; only the NEIGHBOUR
      regression fails. `catchReport` (`:249`) is fed the FULL registry's
      outcomes, so a failure the selection never ran lands in `missed` instead
      of `caught` — which is what makes narrowing observable. The sibling case
      at `:131` pins the other polarity: the same outcomes under a diff-scoped
      selection yield `caught: []` and `missed: ['reg-neighbour']`.
      **Sensitivity was OBSERVED, not argued.** The expansion in the MODULE was
      broken (`affected(graph, t, depth)` to `affected(graph, t, 0)`) and the
      suite went red 5/13, the load-bearing failure being *"catches the
      neighbour breakage, and misses nothing"* with
      `AssertionError: expected [] to deeply equal [ 'reg-neighbour' ]`.
      Restoring the line returned 13/13.
      **An unknown neighbourhood refuses, it does not read as a clean sheet**
      (`selectionVerdict`, `:210`; test `:141`). A touched surface absent from
      the graph would otherwise select zero regressions and report success,
      which is the "local improvement, global regression" hole arriving through
      the selector instead of around it. There is no option flag that relaxes
      it. The refusal was exercised against the real graph, not only the
      fixture: a probe naming a non-existent rule path refused, and the same
      probe with a real path returned `verdict: null` and a neighbour-reason
      selection.
      **K9 is honoured structurally.** This selects; it never authors. No code
      path constructs a `RegressionSpec`, every selected entry is the caller's
      registry object BY REFERENCE, and the test asserts object identity
      (`:160`) rather than an id match — an id match would also pass for a
      synthesized spec carrying a copied id. `authored: 0` is a literal type
      (`:113`).
- [x] **4.7 Reuse the discrimination and hygiene machinery.**
      `eval_publication.PlantedItem` for plants, `judge_hygiene` for order-swap.
      Add the evaluator-promotion procedure the master omitted: an old and a new
      evaluator must cross-grade frozen candidate sets, and evaluator promotion
      itself requires discrimination plants.
      verify: a planted candidate the control arm also satisfies is reported as
      a discrimination deficit, not as a win; an evaluator change with no
      cross-grade is refused.
      **DONE 2026-08-31, and nothing was reimplemented.**
      `src/scripts/_lib/evaluator_promotion.ts` imports
      `eval_publication.discriminationDeficit` / `PlantedItem` and
      `judge_hygiene.auditAssertions`; what it adds is the one thing neither had
      — the REFUSAL that makes an evaluator swap a gated event.
      **First conjunct.** `reportPlants` (`:81`) puts any plant the control arm
      also satisfied into `discrimination_deficits` and never into `wins`, even
      when the treatment satisfied it too. It also STRIPS the declared
      `requires_artifact_behaviour` flag from such a plant before handing the set
      to `discriminationDeficit`, so declared intent cannot rescue an observed
      failure: the test shows the declared set passing the upstream pre-run check
      while the observed set does not.
      **Second conjunct.** `assertEvaluatorPromotable` (`:171`) throws
      `EvaluatorPromotionRefused` on a null cross-grade, a cross-grade over a
      different frozen set, a cross-grade between the wrong pair of evaluators,
      either arm having skipped part of the frozen set, an undeclared order-swap,
      an always-pass assertion (via `judge_hygiene`), no plants at all, plants
      that cannot discriminate, and a plant the control also satisfied. It is
      fail-closed by construction — a one-argument signature with no option
      object, asserted by the test, so bypassing it means deleting the call,
      which a diff shows, rather than passing a flag, which it does not. One
      accepting case exists so a procedure that started refusing everything would
      not pass either.
      **Honest boundary on the order-swap.** `judge_hygiene`'s header records
      that blinding and the order-swap are met upstream by
      `check_quality_regression.evaluatePair`. This module does not re-observe
      that; it requires the cross-grade to DECLARE it (`order_swapped`) and
      refuses when it is false. Asserted by the caller, checked here — stated
      rather than implied.

## Phase 5 — Body signal and the proposer roles

- [x] **5.1 Measure the description-vs-body signal, honest null permitted.**
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
      **DONE 2026-08-31 — the answer is `harmful`, which is neither the hoped-for
      signal nor the permitted null, and it is the reason the bar was two-sided.**
      Pre-registration `agents/evidence/analysis/routing-signal-preregistration-2026-08-31.md`,
      commit **`fe8749458`**. Measurement
      `src/scripts/measure_routing_signal.ts` + `src/scripts/_lib/routing_corpus.ts`,
      commit **`a86bd899c`**. `git merge-base --is-ancestor fe8749458 a86bd899c`
      is the ordering clause, checked in the history rather than asserted: the
      prereg commit adds no measurement module and runs nothing.
      **Both gaps are named separately, and only one was answerable here.** Gap A
      (proxy-to-real-session fidelity) is the one
      `src/scripts/description_route_check.ts:18-30` documents; quantifying it
      needs real sessions, and step 5.2 parks the live harness for this whole
      roadmap. So it is carried as its OWN required field —
      `proxy_to_real_fidelity: {value: null, status:
      "unmeasured-by-construction", reason: <the 5.2 park>}` — in the verdict
      record, so a consumer cannot take the conclusion without its bound. Gap B
      (does the body carry signal the description does not) is the one measured.
      **The numbers, over 82 train corpora / 775 cases / 299-skill catalogue,
      holdout untouched** (`agents/evidence/analysis/routing-body-signal-verdict.json`,
      written by `--write`): recall@5 64.60 % → 70.28 % (**+5.68 pp**, bar +5.0),
      false activation@5 13.66 % → 20.88 % (**+7.22 pp**, guard +2.0), McNemar
      exact p = 0.0371 over 102 discordant positives.
      **The primary bar was CLEARED and the verdict is still not `signal`.** A
      one-sided pre-registration would have shipped this. The guard fires because
      the pre-registered order is power → guard → primary
      (`src/scripts/measure_routing_signal.ts:175-189`), and
      `tests/scripts/routing_signal_measurement.test.ts:142-151` pins that exact
      combination. **SENSITIVITY, three sabotages, each red then green:**
      (a) removing the holdout skip in `loadTrainCases` — 4 red, restored 17
      green; (b) moving the primary check ahead of the guard in the verdict
      function — 2 red (verdict becomes `signal`), restored 17 green;
      (c) editing the committed verdict file to `signal` with a fabricated
      fidelity value — 2 red, restored 17 green.
      **An unpredicted finding, from the run rather than from the argument.** The
      prereg predicted the guard would break, on the arithmetic that
      `overlap` divides by the TASK`s term count so body tokens can only raise a
      score. It did — but 40 positives were also **lost**, because monotone
      scores do not imply monotone ranks: a positive inside the top-5 is pushed
      out when its competitors gain more. The body arm reorders rather than
      merely widens.
      **Two corrections recorded, not smoothed over**
      (`agents/evidence/analysis/routing-body-signal-result-2026-08-31.md`): the
      first loader understood only the modern `queries[]` shape and dropped the
      two grandfathered legacy-shaped corpora SILENTLY, reporting 80 where the
      partition says 82 — fixed by reading both shapes, verdict unchanged in
      both directions (80 corpora: +5.57 / +7.41, `harmful`); and a doc comment
      ended early at the `*/` inside a `src/skills/<slug>/SKILL.md` glob, which
      `tsc --noEmit` accepted and the runtime transform did not.
      **What it does NOT establish:** that the body is useless to a reader, that
      the result transfers to a length-normalised scorer, or anything about the
      sealed holdout, which stays unspent.
- [x] **5.2 Keep the live-floors park intact.** No live harness.
      `agents/roadmaps/later/road-to-routing-assurance-live-floors.md` exists on
      this tree — verified — and its council park (2/2) is not reopened here.
      verify: no step in this roadmap invokes a live routing harness.
      **DONE 2026-08-31 — a scan that PASSES, in two halves.**
      `tests/scripts/governed_harness_no_live_harness.test.ts`. Half A parses
      this roadmap's step bullets and applies the live-harness pattern set
      (the live backend class, the cached-live backend name, a route-checker
      invocation, a live-backend command flag, a model endpoint, a council run, a
      model client — the literals live in the test) to the code spans that carry
      a COMMAND shape. Half B applies the
      same set to every `.ts` under `src/` whose header declares it as belonging
      to this roadmap — the half that keeps working after the roadmap closes.
      Both halves assert non-emptiness first, because a gate that scans nothing
      exits green.
      **Citation is not invocation, and the scan knows the difference.** Step 5.1
      cites `src/scripts/description_route_check.ts:18-30` by name, in a code
      span, because that header is the documented statement of the
      proxy-to-real-session gap. A scanner reading a file citation as an
      invocation would fire on the step that exists to describe the limitation,
      so `commandSpans` narrows to spans with a runner prefix or a flag, and both
      polarities are pinned in the test: a planted step whose command span names
      the route checker with a live backend flag is caught with three findings,
      and the 5.1-shaped citation is silent. The probe string itself lives in the
      test rather than here — writing it into a step would make this roadmap's
      own evidence block trip its own scan, which is what happened on the first
      attempt and is the gate working rather than a false positive.
      **The park itself is asserted intact** — the file exists under `later/`,
      carries `status: later`, and its 2/2 council record is present. It is not
      reopened here: nothing in this change touches it.
- [x] **5.3 Split the roles: analyzer, curator, proposer.**
      `from-skipped-parent`, which states the failure directly — do not collapse
      them into one unconstrained rewrite prompt. The master has one LLM
      proposer plus a one-shot compiler, so the curator role that owns lifecycle
      operations has no home. An optional judge model grades rubric questions
      only, under a frozen evaluator contract.
      verify: the three roles are separate prompts with separate input sets, and
      the judge cannot see outcome truth.
      **DONE 2026-08-31.** `src/scripts/_lib/role_split.ts`, reusing
      `_lib/curator_ops.ts` for the op vocabulary, `_lib/evaluator_promotion.ts`
      for the contract gate and `_lib/judge_hygiene.ts` for the advisory rubric
      shape — nothing here decides anything those three already decided.
      **First conjunct — separate prompts, separate input sets, enforced at the
      boundary.** `ROLE_INPUTS` (`:94`) declares each role's admissible input
      kinds and `buildPrompt` (`:136`) REFUSES an input outside that set. The
      separation is the one the step names: the analyzer never sees
      `corpus-inventory` so it cannot pick an artifact, the curator never sees
      `authoring-contract` so it cannot write one, the proposer never sees
      `trigger-census` so it cannot relitigate the decision. The sets are
      deliberately NOT disjoint — all three see `defect-observation`, because a
      curator choosing `RETIRE` without the motivating evidence is guessing —
      but no role receives the union, and a test pins each set as a strict
      subset. The collapse this step exists to prevent is tested directly: a
      supplier handing one bag of every input kind to all three roles is
      refused (`tests/scripts/role_split.test.ts:111`), which is how three roles
      actually become one unconstrained rewrite prompt — not by a decision, but
      by the input set widening one field at a time.
      **Second conjunct — the judge cannot see outcome truth, structurally, in
      three layers that fail independently.** (1) `JudgeInput` (`:175`) has
      three fields — a contract id, rubric question ids, artifact text — and no
      field capable of holding a verdict, an arm label, a metric, a winner or a
      ground-truth label. A scanner reads the DECLARED interface block and
      matches an outcome-field vocabulary; it is proved to FIRE on a synthetic
      interface carrying `paired_verdict` and `winning_arm` before it is trusted
      to be silent on the real one, and the field extractor carries its own
      anti-vacuity assertion because an extractor returning nothing would also
      "pass" (test `:175-197`). (2) Types vanish at runtime, so
      `buildJudgePrompt` (`:266`) refuses any key outside `JUDGE_INPUT_KEYS`
      (`:166`) — exercised with an object cast through `as JudgeInput` carrying
      `paired_verdict: 'treatment-won'`, which the type system cannot see and
      the refusal does (test `:199`). A test also pins the allowlist against the
      declared fields, so there is no third list to drift. (3) The prompt is
      asserted to be a PURE FUNCTION of the three allowlisted values by exact
      string equality (test `:218`) — a builder interpolating an outcome from
      anywhere at all, not merely from its own argument, breaks that equality,
      which layers 1 and 2 would both miss.
      **Rubric questions only, and the answers cannot name an arm.**
      `assertRubricOnly` (`:233`) throws on a question asking which arm won,
      which candidate was better, or what the ground truth was — because such a
      question makes the judge a second verdict beside `paired_verdict`, which
      is Risk 1 on this roadmap. `JUDGE_GRADES` (`:182`) is
      `yes / no / not-assessable`: a closed vocabulary with no value that names
      an arm. The `judge_hygiene` shape classification rides along as ADVISORY
      and gates nothing, exactly as that module states it must.
      **The frozen evaluator contract is the existing one, not a second gate.**
      The contract id travels on the prompt, `assertJudgeContractFrozen`
      (`:292`) refuses a mismatch, and `promoteJudgeContract` (`:309`) is the
      only way forward — it delegates to step 4.7's `assertEvaluatorPromotable`,
      so a judge-contract change inherits the cross-grade and
      discrimination-plant requirements rather than getting a weaker gate of its
      own. A test shows a null cross-grade refusing the judge-contract promotion.
      **The judge stays optional**, as the step says: `buildSplitPipeline`
      (`:330`) returns `judge: null` when none is configured, and the three role
      prompts are produced regardless.
- [ ] <!-- roadmap-status: guarded-baseline -->
      **5.4 An LLM proposer must beat the deterministic one to survive.** On at
      **GUARDED BASELINE 2026-08-31 — the comparison cannot be run because there
      is no second arm, and the fallback clause is now ENFORCED instead of
      merely written.**

      ```yaml
      guarded_baseline:
        category: absence-assertion
        scope: src/scripts/_lib/candidate_proposer.ts
        command: npx vitest run tests/scripts/proposer_survival_bar.test.ts
        red_proof: sabotage run 2026-08-31 — 1 failed / 3 passed, restored 4/4
        sabotage_model: added a fetch to an API host inside the proposer module
        recheck_when: src/scripts/_lib/llm_candidate_proposer.ts
        discharged_ac: the deterministic path is pinned as the only proposer, so it cannot be displaced silently
        pending_ac: the paired-verdict comparison itself, which needs a second arm
      ```

      **Why it cannot be run, stated as a fact about the tree rather than as
      effort.** `_lib/candidate_proposer.ts` is the only proposer and is
      deterministic by construction — its own header says *"Fixed recipes for
      known defect classes, so the loop is validated without model quality as a
      confound"* and *"NOT claimed: that these three recipes improve
      anything"*. Phase 5 ships no live model harness, which step 5.2 pins with
      its own scan. A `paired_verdict` run needs two arms and one of them does
      not exist. Running it against nothing and publishing the result would be
      the *"argument, not a run"* this step's verify clause forbids.

      **What the guard does buy.** The step's fallback — *"Otherwise the
      deterministic path stays"* — was a sentence anyone could contradict by
      adding a proposer. `tests/scripts/proposer_survival_bar.test.ts` now
      asserts no model is in the proposer loop: no transport import, no
      subprocess spawn, no API host, no key env var, across the proposer and its
      dependency. So the day an LLM proposer lands it cannot become the default
      without turning this red first, which is what makes "otherwise"
      enforceable. `recheck_when` names the module whose arrival reopens the step.

      **A false positive found by running it, and removed rather than
      suppressed.** The construct list initially carried the bare vendor names
      `anthropic` and `openai`, and the clean tree reported **2 hits** — both in
      `_lib/candidate_record.ts`, and neither a client: they sit inside an
      error-message STRING naming which council seats decided something
      (*"2026-08-29, anthropic + openai, 2/2"*). Stripping comments does not
      remove a string literal and should not; the detector was simply wrong. A
      vendor's name in prose is evidence about the writing, not about the code,
      so the names were dropped and only constructs that cannot appear
      innocently were kept. Suppressing the two files instead would have blinded
      the scan to the exact modules it exists to watch.
      **Sensitivity OBSERVED after the narrowing, not before:** adding a `fetch`
      to an API host inside the proposer reds *"no model is in the proposer
      loop"* (1 failed / 3 passed); byte-identical restore returns 4/4. Both
      anti-vacuity assertions — a non-empty scanned set and a stripper that does
      not empty its input — ship with it, so a scan over nothing cannot pass.
      least one pre-registered eval family, with an explicit hypothesis and a
      named falsifier per mutation. Otherwise the deterministic path stays.
      verify: the comparison is a `paired_verdict` run, not an argument.
- [x] **5.5 Curator operation set per E6.** The skipped parent argues the 4-op
      set is insufficient because split and retire are first-class anti-sprawl
      actions; the 7-op set is the recommendation. Candidates only, never
      promotions. Run `src/scripts/_lib/shingle_similarity.ts` as a
      deterministic pre-stage before any model judgment.
      verify: a near-duplicate candidate is caught by the similarity stage with
      zero model calls.
      **DONE 2026-08-31.** `src/scripts/_lib/curator_ops.ts`. `CURATOR_OPS`
      (`:48`) is E6's seven — `KEEP / ADD / MERGE / REPLACE / SPLIT / RETIRE /
      SKIP` — and the test pins the arity as well as the membership. `OP_ARITY`
      (`:76`) encodes the algebra argument that carried E6: `MERGE` is n->1
      (at least two targets, one product) and `SPLIT` is 1->n (one target, at
      least two products), which is exactly what `RETIRE + 2x ADD` cannot
      express.
      **Candidates only, carried by the type.** Every screened proposal carries
      `lifecycle: 'candidate'` as a LITERAL type (`:130`), so there is no value a
      curator can construct that names another lifecycle. Phase 7 remains gated
      on the OPEN `merge-authority` blocker and nothing here promotes.
      **Zero model calls, established three ways rather than asserted.**
      (1) A static scan of the module AND its one dependency
      (`_lib/shingle_similarity.ts`) for `fetch(`, `node:http(s)`, `node:net`,
      `child_process`, model endpoints, model clients, API-key reads and `await`
      — proved to FIRE on six synthetic sources first, silent on a plain one.
      (2) A dynamic run with `fetch`, `XMLHttpRequest` and `WebSocket` replaced
      by throwing stubs, which still returns the correct screen. (3) The result's
      `model_calls` is the literal type `0`, and `screenNearDuplicates` (`:145`)
      is synchronous — a synchronous function cannot await a call, so the
      property follows from the signature rather than from the body's good
      behaviour. The import list is asserted to be exactly
      `['./shingle_similarity.js']`.
      **The near-duplicate case is a re-skin, which is the shape the primitive
      exists for** — the same prose with the framework and vendor nouns swapped
      scores at or above the 70 % containment threshold and is rejected against
      the entry it duplicates, while unrelated prose is admitted. The threshold
      is a STATED default at the conservative end of `lint_originality`'s range,
      not a measured optimum; `revisit-if` a screening run rejects a proposal a
      curator then re-adds by hand, or admits one a human calls a duplicate.
- [ ] <!-- roadmap-status: guarded-baseline --> **5.6 Cheap proposer models first, and track evolution ROI.**
      `from-skipped-parent`, and this one is self-undercutting in the master:
      its own cross-critique faults both parents as cost-blind and answers with
      a hard budget cap, while dropping the only cost-*reduction* mechanism both
      parents proposed. Improvement per evolution dollar is a reported figure.
      verify: the ROI figure appears in every run report, and a cheaper model is
      tried before an expensive one on each defect class.
      ```yaml
      guarded_baseline:
        category: future-mechanism
        scope: src/scripts/_lib/evolution_roi.ts (assertCheapestFirst, LADDER, nextTier)
        command: npx vitest run tests/scripts/_lib/evolution_roi.test.ts
        red_proof: sabotage run 2026-08-31 — cheapest-first comparison neutralised, 3 of 28 tests RED, 28/28 GREEN after restore
        sabotage_model: replaced the guard condition `if (cheapest !== null && a.tier !== cheapest)` at src/scripts/_lib/evolution_roi.ts:217 with `if (false)`, so an escalation past an untried cheaper rung stops being refused
        recheck_when: src/scripts/_lib/ladder_attempt_recorder.ts recordLadderAttempt
        discharged_ac: the ROI half is met with a live subject — every completed run of the `run` verb emits a report and buildRunReport REFUSES one without the figure
        pending_ac: "a cheaper model is tried before an expensive one" under a real attempt sequence — nothing in this tree makes a metered proposer call, so the ordering is policed over a population of zero
      ```
      **PARTLY DONE 2026-08-31, and the split is per verify-clause conjunct
      rather than per convenience.** `src/scripts/_lib/evolution_roi.ts`.
      **The ROI conjunct is CLOSED, with a production caller.** `buildRunReport`
      (`src/scripts/_lib/evolution_roi.ts:363`) REFUSES a report whose ROI
      figure is absent or carries an unknown kind — the same shape
      `_lib/evaluation_vector.ts:103`'s `buildVector` uses to refuse a vector
      that omits its artifact-count row, and refused at RUNTIME because the
      caller who drops the row is a JSON parse or an `as` cast the compiler
      cannot see (proved with a `delete` past the type,
      `tests/scripts/_lib/evolution_roi.test.ts:140`). The caller is real, not a
      unit test: `verbRun` builds the report on the ONE path a run completes on
      (`src/scripts/evolution_lab.ts:865`) and writes it to stdout
      (`:878`), and evaluation evidence is parsed BEFORE the first clone
      (`:761`) so a malformed vector aborts before the run spends anything.
      Reproduce with
      `./scripts-run src/scripts/evolution_lab run --record REC.json --vector VEC.json --estimated-spend-cents 250`.
      **ANCHOR REPAIR 2026-08-31 (drain run 12) — five line numbers, no claim
      touched.** The four anchors into `src/scripts/evolution_lab.ts` and
      `tests/scripts/evolution_lab.test.ts` in this step, plus one in AC-8, were
      written before three later commits moved them — `a4c884fa0` (merge
      origin/main), `32203ec34` (two type errors the merge introduced) and
      `dae43b1e8` (two unused imports). Repaired by reading the file: the report
      is built at `:865` (was `:779`), written to stdout at `:878` (was `:800`),
      the vector parse loop opens at `:761` (was `:745`) with
      `parseMetricVectorJson` called at `:764` (was `:428`), and the end-to-end
      ROI assertion is `tests/scripts/evolution_lab.test.ts:524` (was `:409`).
      **Every underlying claim reproduces and none is weakened** — the
      parsed-before-cloned ordering in particular still holds by construction,
      the parse loop closing at `:768` and the first `clone_candidate` at
      `:784`, and the source carries that same sentence as a comment at `:756`.
      This is the *"a number written before a rebase goes false silently"*
      failure this file repairs rather than rewrites.

      **The figure is a union, not a number, because a ratio is not always
      defined.** `ratio` at positive spend with something evaluated,
      `no-spend` at zero spend, `unmeasured` when no candidate carried an
      evaluation (`:302`). Neither `Infinity` nor `NaN` can reach a report, and
      both are pinned. `unmeasured` is the honest state of this programme today
      and reads as a finding: `run` clones and nothing in Phase 5 evaluates,
      because 5.2 keeps the live-floors park intact.
      **Measured end-to-end on the real CLI, not only in the builder's unit
      test.** `tests/scripts/evolution_lab.test.ts:524` spawns the process over
      five real clones and asserts exactly ONE `run-report: roi:` line on its
      stdout reading `unmeasured`; a second invocation supplying a vector with
      one `pass` row at 250 cents prints `0.400 improved rows per dollar`. The
      vector goes through `parseMetricVectorJson` (`:764`), which calls
      `buildVector` and therefore INHERITS the artifact-count refusal rather
      than re-implementing it — verified against the live CLI, which rejects a
      vector missing that row before any clone is made.
      **Sensitivity proved on both halves, separately.** Deleting the report
      emission from `verbRun` turns the e2e assertion RED (`expected [] to have
      a length of 1`), 25/26 → restored 26/26; neutralising the ROI refusal in
      `buildRunReport` turns the negative-polarity case RED, 27/28 → restored
      28/28.
      **The cheapest-first conjunct has NO LIVE SUBJECT, and that is why this
      step is `guarded-baseline` and not `[x]`.** Policing "a cheaper model is
      tried before an expensive one" needs an attempt sequence, and no step in
      this roadmap invokes a live routing harness — 5.2, held by
      `tests/scripts/governed_harness_no_live_harness.test.ts` (9/9 on this
      branch, and its half B now scans `evolution_roi.ts` too, since that module
      names this roadmap). So what shipped is an ordering POLICY plus a guard
      proved to fire: `LADDER` (`:101`) is cheapest-first per defect class,
      `assertLadderWellFormed` (`:132`) refuses a ladder that skips a rung —
      which would try an expensive tier before a cheaper one by construction —
      and `assertCheapestFirst` (`:191`) refuses an out-of-order attempt
      sequence. Both are exercised in both polarities.
      **Three defect classes carry an EMPTY ladder, which is the strongest cost
      reduction available rather than an omission.** `policy_blocked`,
      `dependency_unavailable` and `human_rejected` license NO metered attempt
      at all: a candidate a policy refused, one that could not find its
      dependency, or one a human turned down is not made acceptable by a larger
      model. `nextTier` returns `null` there and the report prints
      `next: spend nothing`; a metered attempt against such a class is refused
      outright. The classes are REUSED from `_lib/pathology_archive.ts:65`'s
      closed `PATHOLOGY_WHY` vocabulary — a second defect taxonomy beside it
      would be the drift 4.4 exists to prevent — and a test pins the ladder's
      key set against it so a vocabulary addition cannot leave a class
      unpriced.
      **Tiers are vendor-neutral (`lite < medium < high`, `:86`) on purpose.**
      Naming a model would tie a cost policy to a price list that changes
      without this file, and would put a vendor name into a module this
      roadmap's own live-harness scan reads.
      **What this does NOT establish.** That the ladder's per-class assignments
      are the right ones. They are a stated policy with a written reason each,
      not a measurement — nothing has been run cheap-first and then expensive to
      compare. `revisit-if`: a run records a defect class where the cheap rung
      never resolves anything, or one where an empty ladder blocked a fix a
      model would have made.

## Phase 6 — Delivery: measure the existing substrate first

- [x] **6.1 Run the three-arm experiment on what already ships.**
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
      **DONE 2026-08-31, and the delivery half is what was missing.**
      `agents/evidence/analysis/governed-harness-three-arm-delivery.md` measures
      all three arms over `tests/eval/routing-matrix` — 305 positives, 194
      near-misses — with one matcher and zero model calls. Reproduce with
      `./scripts-run src/scripts/model_rule_injection --three-arm`.
      Delivery of the labelled body: `eager-all` 1.000 (305/305) at 120,743
      standing tokens and a false-context rate of 1.000 (194/194 near-miss
      bodies also standing); `thin` 0.000 (0/305) at 18,223; `delivery` 0.990
      (302/305) at the same 18,223 plus a mean 2,026 injected tokens per prompt,
      with zero near-miss deliveries. The three losses are named rather than
      summarised: two matcher misses and one cap drop, each with its prompt.
      **The price grid was NOT the experiment, which is why this step stayed
      open.** `model_rule_injection.ts:454-462` already priced the same three
      shapes; a price grid reports what a shape COSTS and never what it
      DELIVERS. `src/scripts/_lib/delivery_arm_experiment.ts` adds the delivery
      half and reads its cost figures from `standingCorpora`, the same function
      the grid reads, so the two halves cannot disagree.
      **No new retrieval component was written**, which is the ordering half of
      the verify: 6.3 has not started, the module imports `matchTierRules` and
      `selectForInjection` from `_lib/rule_injection.ts` and nothing else that
      answers "which rules fire on this prompt?", and `router_match_parity`
      (5/5) plus `single_matcher_preserved` (8/8) are green on this branch.
      **Sensitivity proved on two independent handles, because a measurement
      never seen move has unknown sensitivity.** Squeezing the byte cap moves
      `delivery` monotonically — 0.770 at 1 B, 0.774 at 2,000 B, 0.990 at the
      shipped 20,480 B, 0.993 at 200,000 B, where it meets the matcher's own
      recall ceiling and the cap stops binding — while `eager-all` and `thin`
      do NOT move, which is the other half of the proof. Stripping one rule's
      triggers in an in-memory router moves that rule's positives out of the
      injected set and into the thin standing set, so `thin` rises off 0 while
      `eager-all` holds. Both are pinned in
      `tests/scripts/_lib/delivery_arm_experiment.test.ts` (11/11).
      **What it does not measure, and no spend closes it.** Whether a session
      that RECEIVES a body behaves like one that HAD it standing is not an
      expense declined here — ADR-202 records that instrument CLOSED, kappa
      0.472 against a registered 0.800 floor, no third attempt licensed. The
      artefact says so in its own § What this does NOT measure.
- [x] **6.2 Preserve one matcher.** `from-skipped-parent`, and the tree already
      enforces it: `src/scripts/_lib/rule_injection.ts:1-19` is "THE single
      module both the offline model and the runtime concern read", trigger
      semantics live in `_lib/router_match.ts` as "the single implementation for
      every surface", and `tests/scripts/router_match_parity.test.ts` pins it.
      An experiment whose offline pricing and runtime delivery use different
      matchers measures nothing.
      verify: the parity test stays green and no second matcher is introduced.
      **DONE 2026-08-31, and the second conjunct was UNCOVERED until now.**
      `tests/scripts/router_match_parity.test.ts` passes 5/5, which pins the
      matcher's BEHAVIOUR against the reference. Nothing asserted that a SECOND
      implementation had not appeared beside it, and the parity test would have
      stayed green on the day one did — a rival matcher in another file changes
      none of `router_match.ts`'s outputs.
      `tests/scripts/single_matcher_preserved.test.ts` is that second conjunct:
      it scans every `.ts` under `src/` for DECLARATIONS (not imports, not calls)
      of the three trigger-semantic symbols `trigger_matches`, `match_prompt`,
      `keyword_matches_anchored`, and asserts `_lib/router_match.ts` is the only
      file carrying them. It also asserts `_lib/rule_injection.ts` imports from
      it rather than owning one.
      **`_fnmatch` is deliberately NOT in the banned set**, and the exclusion is
      load-bearing rather than lenient: it is a generic glob helper declared
      privately in six unrelated files on this tree (`memory_lookup`,
      `cross_repo_retrieve`, `bench_ab_clone`, `check_release_pr_shape`,
      `check_no_external_sources`, and the templated `memory_lookup`), none of
      which answers "which rules fire on this prompt?". Banning it would make the
      gate red on arrival for six pre-existing files, and a gate that is red on
      arrival is deleted within the week.
      **Sensitivity is proved against real syntax, not only against strings.**
      Besides the three synthetic declaration shapes and the import / call /
      re-export negative cases, one case lifts the exclusion and asserts the
      detector DOES find all three declarations inside `router_match.ts` itself —
      a scanner tested only on hand-written strings can be silently wrong about
      the syntax it has to read.
- [x] **6.3 Only then consider a lexical shortlist, and only as a shortlist.**
      Over the existing BM25 core. No embeddings —
      `docs/contracts/no-runtime-boundary.md:40` classifies a vector/embedding
      index as a **contract violation**, not a preference: "a vector/embedding
      index fails — it enables query semantics absent from source, and stays
      Class C". The BM25 core passes the same test. The skipped parent proposed
      the shortlist and explicitly refused it as final truth.
      verify: the shortlist feeds a later stage and never decides alone.
      **DONE 2026-08-31.** `src/scripts/_lib/lexical_shortlist.ts`, over
      `_lib/lexical_index.ts` — the hand-rolled BM25 core that already ships.
      **THE CITATION IN THIS STEP HAD MOVED, and the constraint had not.**
      `docs/contracts/no-runtime-boundary.md` was superseded on 2026-08-27 by
      ADR-249 and is now a pointer stub whose line 40 reads
      *"Its literal scope was Mission-Mode"* — not the classification quoted
      above. The substance survived the move verbatim and is cited from its live
      home instead: `docs/contracts/resident-process-governance.md:82`,
      *"A code-graph cache passes; a vector index fails"*, under the P3
      state-store test, with the P4 row at `:76` separately prohibiting any
      index build requiring network or model calls. The step's quoted text is
      left standing above rather than rewritten, because it is what the step
      was written against; this note is the correction.
      **The ordering dependency in "only then" is satisfied and was checked
      rather than assumed.** 6.1 is `[x]` with
      `agents/evidence/analysis/governed-harness-three-arm-delivery.md` present,
      and 6.2 is `[x]` with `single_matcher_preserved.test.ts` 8/8 — so the
      three arms were measured before this retrieval component was written,
      which is exactly what 6.1's own verify clause reserved.
      **AC-7's ordering claim SURVIVES this step, and its wording is now
      historical.** That criterion reads *"measured against one another before
      any new retrieval component exists"* — a temporal claim, and 6.1's
      measurement was committed before this component, so it holds. Its audit
      note's phrase *"6.3 has not started"* described the tree on 2026-08-31
      before this commit and is left standing as the record of that moment; it
      is not a live condition and nothing here reopens AC-7.
      **First conjunct — it feeds a later stage, MEASURED, not asserted.** The
      later stage is the per-prompt byte cap in `selectForInjection`, which now
      takes an optional fourth argument
      (`src/scripts/_lib/rule_injection.ts:224`) used as a TIE-BREAK. Wired
      through `ArmExperimentInput.shortlist`
      (`src/scripts/_lib/delivery_arm_experiment.ts:108`) to a real CLI flag,
      `model_rule_injection --three-arm --shortlist`
      (`src/scripts/model_rule_injection.ts:834`, flag at `:895`) — this is not
      an unwired library. Run over `tests/eval/routing-matrix` on this commit:
      OFF gives `delivery` 0.990 (302/305), 1 cap-drop, mean 2,026 injected
      tokens; ON gives 0.984 (300/305), 3 cap-drops, mean 2,016. The shortlist
      demonstrably changes what the cap does, which is the falsifiable form of
      "feeds a later stage" — a shortlist nothing downstream reacts to would
      have produced two identical tables.
      **It currently makes delivery slightly WORSE, and that is reported rather
      than tuned away.** −2 positives at the same corpus and cap. 6.3's verify
      clause is about the shortlist's ROLE, not its win, and the pre-registered
      loss ceiling that would adjudicate the trade-off is step 6.4, which is
      `[ ]`. So the flag ships default-OFF: the 6.1 baseline reproduces
      byte-for-byte without it (1.000 / 0.000 / 0.990 at 120,743 / 18,223 /
      18,223, mean 2,026 p90 4,144), and a test pins that the absent argument is
      the pre-6.3 behaviour.
      **Second conjunct — never decides alone, closed in BOTH directions by
      construction.** A shortlist decides alone by ADDITION (delivering what the
      matcher never fired on) or by SUBTRACTION (removing a matcher hit, which
      is a decision dressed as a filter). `orderByShortlist` (`:155`) takes the
      matcher's output as its input domain and returns a PERMUTATION of it;
      `assertPermutation` (`:171`) refuses any result whose id multiset differs
      in either direction, counting multiplicity. At the cap, the same holds
      independently: a shortlisted id absent from `matches` is never consulted,
      and an unshortlisted match sorts at `Infinity` — behind the shortlisted
      ones and still competing for the cap, never removed. The near-miss false
      context stays 0/194 with the shortlist ON, which is the empirical form of
      "added nothing".
      **Subordination is a comparator key ORDER, and both implementations of it
      are pinned.** `score desc → shortlist rank → router order`. The matcher's
      verdict is read first and the shortlist only breaks its ties. The order
      exists twice — in `orderByShortlist` and in the cap walk — so both are
      tested, because a second implementation of one comparator is a thing that
      drifts.
      **Sensitivity proved by two sabotages, and the second one found a real
      hole in the first test set.** (A) Turning `orderByShortlist` into
      `filter(shortlisted).sort(rank)` — the shape a shortlist naturally
      degrades into — turned 5 of 23 cases RED with the message *"the shortlist
      changed the matcher`s set instead of ordering it — dropped r-b … decides
      by subtraction"*; restored 23/23.
      (B) Making the cap walk filter to the shortlist AND rank it above the
      matcher score passed all 23 — because every case then shortlisted EVERY
      match, so a membership filter changed nothing. Two cases were added under
      the still-sabotaged tree and observed RED
      (`tests/scripts/_lib/lexical_shortlist.test.ts:182` and `:193`,
      *"expected ['command-suggestion-policy'] to deeply equal ['architecture',
      …(5)]"*), then the sabotage was restored and the file is 25/25. The gap is
      recorded rather than quietly patched: a sabotage that passes is the test
      set's finding about itself.
      **No embeddings, established by a scan proved to fire first.** Six banned
      construct classes — embedding call, embedding identifier, vector store,
      cosine similarity, network, child process — are matched against
      `lexical_shortlist.ts` AND `lexical_index.ts`, after being shown to FIRE
      on six synthetic sources and to stay silent on plain BM25 arithmetic. The
      scanned byte count is asserted, because a scan over nothing exits green.
      The module's import list is pinned to exactly
      `['./lexical_index.js', './rule_injection.js']`. The banned literals live
      in the test rather than in the module for a mechanical reason: a scanner
      whose banned strings sit in the file it scans matches its own declaration
      and can never pass.
      **No second matcher.** This module answers "which text is lexically
      closest", never "which rules fire on this prompt" — that stays
      `_lib/router_match.ts`. `router_match_parity` (5/5),
      `single_matcher_preserved` (8/8), `delivery_arm_experiment` (11/11),
      `model_rule_injection` (13/13) and `rule_inject_hook` (16/16) are green on
      this branch.
- [x] **6.4 Pre-register the loss ceiling, and measure set compatibility.**
      Recall-loss ceiling and token target fixed first; report precision,
      recall, false activation, context cost, benefit **conditional on**
      activation — and, `from-skipped-parent`, **set compatibility**: cases
      where two individually relevant skills are jointly wrong. The right
      question is which *set* to deliver together, not only which single
      artefact is closest. The corpus fixtures for it are authored in 2.3.
      verify: the ceiling is committed before the run, and the corpus contains
      at least one jointly-wrong pair.
      **DONE 2026-08-31. Ceiling BREACHED and reported as breached; 7 jointly-wrong
      pairs found in the corpus and 0 of them delivered together.**
      Pre-registration `agents/evidence/analysis/delivery-set-preregistration-2026-08-31.md`,
      commit **`fe8749458`** — recall-loss ceiling 20.0 pp, token target 500,
      k = 5, and the jointly-wrong definition, all fixed in a commit that adds no
      measurement module. Measurement `src/scripts/measure_delivery_sets.ts`,
      commit **`b7aafbb3b`**; `git merge-base --is-ancestor fe8749458 b7aafbb3b`
      is the first half of the verify, checked in the history rather than asserted.
      **The metric set, over 82 train corpora / 764 distinct prompts / 299-skill
      catalogue, holdout untouched** (`agents/evidence/analysis/delivery-set-measurement-2026-08-31.json`):
      precision@5 82.51 % over 303 adjudicated deliveries · recall@5 64.60 % ·
      recall loss **35.40 pp against a 20.0 pp ceiling — BREACHED** · false
      activation@5 13.66 % · context cost 235.6 tokens/prompt against a 500 target
      — MET · benefit unconditional 64.60 % · benefit conditional on activation
      82.51 %. Curve: @1 44.70 · @3 57.11 · @5 64.60 · @10 73.64 · @20 80.62 %, so
      the ceiling clears at no k ≤ 20 and the cost target is not what is failing.
      A breach is a finding; **no narrowed delivery is promoted from this run**.
      **The verify`s second half — 7 jointly-wrong pairs in the corpus**, over 10
      shared prompts: `{experiment-loop, verify-repair-loop}` twice,
      `{analysis-skill-router, forensics-report}`, the three pairs among
      `{agent-security-review, ai-code-blindspots, security-audit}` on one prompt,
      and `{evaluate-llm-feature, prompt-engineering-patterns}`. **0 are delivered
      together at any k ≤ 20** (`src/scripts/measure_delivery_sets.ts:205-222`).
      **THE PRE-REGISTRATION WAS WRONG AND IS CORRECTED BY REPORTING BOTH, NOT BY
      REWRITING IT.** Its definition added "both members delivered in the top-k",
      turning the corpus property this verify names into a delivery property whose
      count is 0. Both ship: `jointly_wrong_pairs_in_corpus` = 7 and
      `jointly_wrong_pairs_delivered_at_k` = 0, each pair carrying the smallest k
      at which it would be jointly delivered. The count is a LOWER bound — a pair
      is observable only where two corpora adjudicate the same prompt.
      **The finding that bounds every number above: 78.80 % of prompts have their
      top-5 cut decided by the ALPHABETICAL TIE-BREAK** —
      `score(rank 5) === score(rank 6)`
      (`src/scripts/measure_delivery_sets.ts:165-171`). So
      0-delivered-pairs is not evidence of discrimination; at the boundary the
      scorer does not rank at all and the alphabet happened not to co-select any
      of the seven. Same "recalls but does not rank" pathology
      `src/scripts/measure_lexical_ranking.ts:10-16` names for the memory store,
      observed on the skill catalogue for the first time.
      **SENSITIVITY, two sabotages, each red then green**
      (`tests/scripts/delivery_set_compatibility.test.ts`): (a) dropping the
      `!c.expect` polarity filter so any shared skill forms a pair — 3 red
      including the DENIAL case, restored 11 green; (b) loosening the ceiling
      constant 20.0 → 40.0 to turn the reported breach into a pass — 3 red,
      restored 11 green.
      **A second pre-registration defect, recorded:** `precision_at_k` and
      `benefit_conditional_on_activation` were defined separately and are one
      computation. Both are reported at the same value rather than one being
      dropped; the pair that genuinely differs is unconditional 64.60 % against
      conditional 82.51 %, and the 17.9 pp gap IS the delivery failure.
- [x] **6.5 Index the body only if 5.1 measured a signal.** Otherwise
      description-only.
      verify: the indexer's input set derives from the 5.1 verdict file.
      **DONE 2026-08-31 — description-only, and the mechanism DERIVES it rather
      than knowing it.** `src/scripts/_lib/routing_index_input.ts`.
      `resolveIndexInput` opens
      `agents/evidence/analysis/routing-body-signal-verdict.json`, reads
      `body_signal.verdict`, and returns `['name','description','body']` on the
      literal token `signal` (`:87`) and `['name','description']` on anything
      else. It carries no opinion about the body — the outcome today is
      description-only because 5.1 measured `harmful`, not because a literal
      says so.
      **The consumer is real, not a demo.** `measure_delivery_sets`
      (`src/scripts/measure_delivery_sets.ts:133`) used to hardcode the
      `description` arm; it now resolves it, and publishes
      `index_input.{fields, verdict, reason}` in its record, so the derivation
      is observable in `agents/evidence/analysis/delivery-set-measurement-2026-08-31.json`
      rather than merely asserted here.
      **THE SABOTAGE THE STEP ASKS FOR — the verdict file was flipped and the
      input set followed, downstream numbers included.** Verdict → `signal`:
      input `name + description + body`, precision@5 82.51 → 77.05 %, recall@5
      64.60 → 70.28 %, adjudicated deliveries 303 → 353. Verdict deleted: back to
      `name + description`, reason *"no readable 5.1 verdict … fail-closed"*.
      Verdict `signal` with `proxy_to_real_fidelity` stripped: still
      `name + description`, reason *"carries no proxy_to_real_fidelity bound —
      refused"*. The tree was restored and re-measured to the committed figures
      after each.
      **FAIL-CLOSED ONLY NARROWS.** Missing file, unparseable JSON, unknown
      token, and a provenance-stripped record all resolve to description-only
      (`:73`). A stale or edited record can never widen what is indexed, and the
      measured price of widening on a `harmful` verdict is +7.22 pp of false
      activation. The bound gate is deliberate: 5.1 ships
      `proxy_to_real_fidelity` inside the verdict so a consumer cannot take the
      conclusion without it, and a record that lost it is refused rather than
      half-trusted.
      **SENSITIVITY, two sabotages, each red then green**
      (`tests/scripts/routing_index_input.test.ts`, 8 tests): (a) hardcoding the
      resolver to description-only — which is TODAY`S CORRECT ANSWER and still
      reds the `signal`-widens case, 1 red, restored 8 green; (b) removing the
      fidelity-bound gate — 1 red on the stripped-record case, restored 8 green.
      No test writes the tracked verdict file; every fixture lives in a temp
      directory.

## Phase 7 — Promotion bridge and the lifecycle after it

> **TRANSFERRED 2026-08-31 to `road-to-harness-promotion-bridge.md`, on a
> recorded AI-council verdict — 2/2 convergent, anthropic/claude-sonnet-4-5 +
> openai/codex-default, Option 3: split at the phase boundary into a new ACTIVE
> roadmap.** Both seats rejected `agents/roadmaps/later/` by name, because
> `later/` is excluded from the dashboard and from `/roadmap:process-*` and
> therefore does not preserve active-estate membership.
>
> **`[-]` here means TRANSFERRED. It does NOT mean cancelled, dropped, or
> satisfied.** Every step below is still open, still unmet, and still owned —
> by the receiver, which is ACTIVE and visible to every estate mechanism. The
> steps, their prose and their `verify:` lines moved verbatim; nothing was
> weakened in the move. Every reference to Phase 7, 7.3 or 7.6 elsewhere in
> this file — the Risk Register's row 8, the open-decisions section — resolves
> through this pointer.

- [-] **7.1 One evidence package per promotion, in the fuller form.**
      **MERGED (outcome transferred to road-to-harness-promotion-bridge)** —
      step 7.1 there, verbatim.
- [-] **7.2 Route through the existing gate, not a second governance system.**
      **MERGED (outcome transferred to road-to-harness-promotion-bridge)** —
      step 7.2 there, verbatim.
- [-] **7.3 Promote by scope, with a transfer gate.**
      **MERGED (outcome transferred to road-to-harness-promotion-bridge)** —
      step 7.3 there, verbatim.
- [-] **7.4 Reject semantic no-ops.**
      **MERGED (outcome transferred to road-to-harness-promotion-bridge)** —
      step 7.4 there, verbatim, including its 2026-08-26 marker correction.
- [-] **7.5 Roll out by canary, never silently.**
      **MERGED (outcome transferred to road-to-harness-promotion-bridge)** —
      step 7.5 there, verbatim.
- [-] **7.6 A promoted artefact is not immortal.**
      **MERGED (outcome transferred to road-to-harness-promotion-bridge)** —
      step 7.6 there, verbatim. It is what closes AC-9, which transferred with
      it.
- [-] **7.7 Best-known-state reference on regression.**
      **MERGED (outcome transferred to road-to-harness-promotion-bridge)** —
      step 7.7 there, verbatim.

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
- **What to do:** *(STALE AS WRITTEN, and kept rather than rewritten — see the
  correction at the end of this field. The `Status:` field above supersedes it.)*
  take the conservative side, which is what happened here —
  0.4 and 0.5 are `[~]`, not `[x]`, and not `[ ]` either: the guards and their
  16 tests are completed prerequisites, recorded as such, and what is pending is
  integration. Re-close each after an end-to-end test proves the real runner
  routes every relevant path through the guard and exits non-zero before any
  spend or disclosure. Nothing is rebuilt.
  **CORRECTED 2026-08-31 (drain run 11) — a factual repair, nothing reopened.**
  The instruction above was carried out and this field was never updated: the
  end-to-end test it asks for exists
  (`tests/scripts/harness_evolution_guard_call_sites.test.ts`), and 0.4 and 0.5
  are `[x]` at `:276` and `:324`, both marked RE-CLOSED 2026-08-30. **This file
  contains ZERO `[~]` markers**, so the sentence describes a state the tree does
  not hold and a later reader following it would look for markers that are not
  there. The blocker itself is `resolved`; this correction changes no marker, no
  status and no criterion.
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


### merge-authority — MOVED

> **MOVED WHOLE 2026-08-31 to `road-to-harness-promotion-bridge.md` § Blockers,
> where it is the roadmap's single gate.** Transferred verbatim, including its
> 2026-08-29 council scoping, its 2026-08-30 field-shape repair and its
> `Resolved when` amendment. It is NOT resolved and NOT withdrawn: ADR-239
> § Decision 3 is as open as it was, and it is owner-reserved in both
> directions.
>
> **This heading OMITS the literal `blocker:` prefix, and the omission is
> deliberate — read the repaired entry two headings above before assuming it is
> the same defect.** `lint_roadmap_blockers` recognises an entry only by
> `### blocker: <id>`, so a heading without the prefix declares nothing. That is
> exactly what is wanted here and the opposite of what was wanted on 2026-08-29:
> there, a real entry had lost its prefix and was invisible to the gate, which
> was a defect; here the entry has genuinely MOVED, and keeping the prefix would
> declare `merge-authority` in two files at once — two live owners for one
> blocker, which the council's atomic-transfer requirement forbids and which the
> gate confirmed by counting `open_blockers` 31 → 32 when this stub first carried
> the prefix. The stub is kept, prefix-less, so the many references to
> `merge-authority` elsewhere in this file land somewhere that names where the
> entry went.

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
| 6 | Cost blindness turns a truncated run into a false pass | implementation | Cascade evaluation over candidates × task families × repeated trials is the dominant cost. Truncating to fit budget yields `underpowered`, which a reader treats as a pass | **PARTLY MITIGATED 2026-08-30.** 0.5 now aborts rather than truncates *at a real call site*, proven by a non-zero process exit from the CLI and by an ordering observable showing the abort precedes record parsing. 4.3 (`underpowered` a non-pass in code) and 5.6 (reduce the cost rather than cap it) are unbuilt, so the risk is reduced, not closed. **CORRECTED 2026-08-31 (drain run 11):** the "unbuilt" half is stale in both names. 4.3 is `[x]`, and 5.6 is closed on its ROI conjunct with a production caller (`buildRunReport` refuses a report whose ROI figure is absent) while staying `guarded-baseline` on its cheapest-first conjunct, which has no live subject because nothing in the tree makes a metered proposer call. **The risk itself is NOT closed by this correction** — it moves from "two mitigations unbuilt" to "one built, one half-built, and the residual is risk 12 below: the ceiling is still enforced against a declared spend rather than a measured one" | Phase 0 — Constitution, reconciliation, budget, stop conditions |
| 7 | Stopping only on spend | implementation | Six of the parents' nine stop conditions detect epistemic invalidity, which a spend cap never sees. A run can complete inside budget and be worthless | 0.6 pre-registers the validity conditions with detectors, and names the ones that stay model-carried | Phase 0 — Constitution, reconciliation, budget, stop conditions |
| 8 | Monotonic estate growth after the gate | product | Every promotion adds; nothing reopens a promoted artefact. The gate-side `artifact-count delta` does not constrain the estate over time | 7.6 adds post-promotion re-evaluation with an exercised RETIRE path; 7.3 keeps most promotions below global scope. **RELOCATED 2026-08-31 (drain run 11):** both named mitigations TRANSFERRED out of this file to `road-to-harness-promotion-bridge.md` (steps 7.6 and 7.3 there), so this risk is now mitigated in the receiver and not here. The risk is not closed and not re-owned — the receiver is ACTIVE and blocked on its owner-reserved `merge-authority` gate, which means this row describes a mitigation that cannot currently be exercised anywhere | Phase 7 — Promotion bridge and the lifecycle after it |
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

- [x] AC-1 — Every capability this roadmap builds has a row in the 0.1 inventory
      matrix stating why no existing carrier fits, and no step duplicates a
      carrier named in the "What already exists" table.
      **MET 2026-08-31, and it was NOT met when this audit started — that is
      the point of the criterion and it earned its place.** The branch that
      closed 4.2, 4.3, 4.5, 4.6, 4.7, 5.2, 5.3, 5.5 and 6.2 shipped six modules
      under `src/scripts/_lib/`, and three of them built a capability the matrix
      had no row for at all: `minimality_tiebreak.ts` (4.5),
      `evaluator_promotion.ts` (4.7) and `role_split.ts` (5.3). The audit added
      them as `build new` rows 4-6, each naming the command that was run rather
      than asserting absence, plus main-matrix rows 13-14 for the two
      capabilities that do have carriers — `discovery_graph.ts` for 4.6 and
      `shingle_similarity.ts` for 5.5. The sixth, `evaluation_vector.ts` (4.2),
      was already covered by the existing metric-vector row.
      **The second conjunct is measured, not assumed.** No step reimplements
      one of the nine carriers in the "What already exists" table:
      `evaluation_vector.ts:56` takes `paired_verdict` by `import type` and
      never recomputes a verdict, `evaluator_promotion.ts:49-50` imports
      `eval_publication` and `judge_hygiene`, `evolution_lab.ts:766` calls
      `bench_ab_integrity`'s main directly rather than restating it, and
      `tests/scripts/single_matcher_preserved.test.ts` (8/8 green) asserts
      `router_match.ts` is still the only file declaring the three
      trigger-semantic symbols. ~~`lexical_index` and `lean_projection_mode` have
      no consumer at all yet, because 6.1 and 6.3 have not started.~~
      **CORRECTED 2026-08-31 — that sentence was FALSE, and the criterion still
      holds.** Measured by grep over `src/` at this commit: `lexical_index` has
      **eight** code consumers — `_lib/catalog_score.ts`,
      `ai_council/recouncil_guard.ts`, `code_graph/query.ts`,
      `lint_knowledge_scale.ts`, `lint_store_boundary.ts`,
      `measure_lexical_ranking.ts`, `memory_lookup.ts`,
      `model_rule_injection.ts` — plus `src/config/memory-twin-verdicts.yml`;
      and `lean_projection_mode` has **five** — `_lib/activation_ladder.ts`,
      `_lib/delivery_arm_experiment.ts`, `_lib/hook_settings.ts`,
      `condense.ts`, `hooks/rule_inject_hook.ts` — plus
      `src/config/gate-violation-baselines.json`.

      **What the sentence should have said**, and this is why AC-1 stays `[x]`
      rather than re-opening: neither module has a consumer **built by this
      roadmap**. Both are pre-existing carriers with pre-existing consumers, and
      that is exactly what the 0.1 inventory row for each records — a carrier
      that already exists is the reason no step may duplicate it. The false
      version inverted the evidence: it read as *"these are unused, so nothing
      duplicates them"*, when the true statement is *"these are in active use,
      so a step that rebuilt them would be duplicating a live carrier"*. The
      correction strengthens the criterion's own second conjunct instead of
      weakening it.

      **Why it is struck through rather than deleted.** A later reader checking
      AC-1 against the tree would otherwise find the grep disagreeing with the
      criterion and have no way to tell a corrected claim from an unnoticed one.
      **Scope of the closure, stated so it is not read as permanent.** This is
      measured over the capabilities built to 2026-08-31. 0.1's second half is a
      standing obligation on Phases 1-7, so the first later step that builds
      without a row re-opens this criterion.
- [x] AC-2 — Every overlapping plan in the estate carries one of the five
      dispositions from 0.2, and no capability has two execution owners.
      **CHECKED 2026-08-31 and NOT re-opened — recorded so the candidate is not
      re-derived.** `road-to-harness-promotion-bridge.md` entered the active
      estate on 2026-08-31, i.e. after the sweep this criterion rests on, and it
      carries no row in the 0.2 disposition table. That looks like the
      re-opening the scope caveat below anticipates, and it is not one: AC-2's
      subject is *overlapping* plans and *capabilities with two execution
      owners*. The sibling is a **split-out child**, not a competitor — every
      item it owns is marked `[-] MERGED` here with the receiving step named,
      the `relates:` block links it from both ends, and this file references it
      thirteen times as the transfer target. So there is exactly one execution
      owner per capability, which is the property AC-2 tests. A row in 0.2 would
      document a relationship that is already documented in a stronger form.
      **MET 2026-08-31 by a full-estate sweep, which is stronger evidence than
      the spot checks 0.2 recorded.** The 0.2 overlap grep was run over every
      file in `agents/roadmaps/` and `agents/roadmaps/later/`. Exactly two
      return a non-zero count: this roadmap (34) and
      `road-to-inbox-harvest-2026-08-e-council-topology-evidence` (1). Every
      other plan in the estate returns 0 and is therefore not an overlapping
      plan at all. The single hit is incidental — the phrase *parse-outcome
      vocabulary* at that file's `:582`, about a typed union for council parse
      results, not the outcome-vocabulary reconciliation the table assigns — and
      that file already carries a `drop` verb. So every overlapping plan carries
      one of the five dispositions.
      **The second conjunct is measured against what this branch actually
      built.** None of the six new capabilities appears in another plan:
      grepping the active and `later/` sets for `curator`, `minimality`,
      `evaluator promotion`, `metric vector`, `regression neighbourhood` and
      `role split` returns this roadmap plus one incidental
      *reflector/curator split* in `later/road-to-experience-loop-owner-decisions`,
      which is parked and is the experience loop's reflector, not this one's
      curator.
      **Three State values in the 0.2 table went stale and were left as
      measured rather than quietly rewritten**, with the re-measurement recorded
      beside the table instead: `road-to-experience-loop-broadening` is now
      archived, `road-to-capability-native-execution` is now in `later/`, and
      `road-to-turnaround-followups` has entered the active set — it measures 0,
      so it needs no row. Same scope caveat as AC-1: the estate moves, and a new
      overlapping plan re-opens this.
- [x] AC-3 — A candidate variant of one harness dimension can be materialised,
      evaluated and destroyed without any diff in the original tree, and a
      deliberate path-ownership sabotage exits non-zero.
      **CLOSED 2026-08-31 — the third verb is met, by the wiring the audit below
      predicted would close it.** That audit is preserved rather than deleted,
      because it is the record of what was missing.
      *Evaluated* is now a real production path: `evolution_lab`'s `run` verb
      routes every candidate through `_lib/evaluation_cascade.ts`'s six-stage
      deterministic prefix, so the modules the audit called "an UNWIRED library"
      have a caller. *Materialised* and *destroyed* were already met by 3.1 and
      are re-asserted end-to-end here rather than inherited: a test spawns the
      real CLI, runs `run` with metrics, confirms a clone directory appeared,
      runs `clean --yes`, and asserts `git status --porcelain` is
      byte-identical before and after and that the clone is gone.
      *Sabotage exits non-zero* is unchanged from 3.1.
      **Asserted through the real CLI, never in-process** — the same discipline
      `harness_evolution_guard_call_sites.test.ts` adopted for the identical
      reason: a unit test observing a function's return is not evidence that a
      runner routes through it. Proved sensitive: unwiring the cascade from
      `verbRun` reds *"a run EVALUATES each candidate and says so on stdout"*.
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
      **Re-audited 2026-08-31 and still OPEN on `evaluated`, now for a sharper
      reason than "no evaluation stage exists".** Phase 4 has since shipped the
      evaluation machinery — `evaluation_vector.ts`, `minimality_tiebreak.ts`,
      `evaluator_promotion.ts`, `regression_neighbourhood.ts` — and every one of
      them is an UNWIRED library: `grep -rn` over `src/` for those module names
      returns no reference outside the modules themselves, so there is no
      production caller. `evolution_lab`'s seven verbs contain no evaluation
      path either — `compare` (`:761`) calls `bench_ab_integrity`'s main and
      `promote` (`:858`) refuses unconditionally. A candidate can therefore
      still be materialised and destroyed but not evaluated. This is the
      standard `blocker: guard-call-site-integration` already settled in the
      other direction — a guard nothing calls has no coverage, and neither does
      an evaluator. What closes it is 4.1's cascade wiring these modules into
      `run`.
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
- [x] AC-5 — Promotion is decided by `paired_verdict` per metric with
      `underpowered` refused as a pass, and no code path computes a weighted
      total score.
      **CLOSED 2026-08-31 — the first conjunct now has the caller it lacked, so
      the conjunction holds.** The audit below is preserved: it named exactly
      what was missing and predicted exactly what would close it.
      `promotionVerdict` (`_lib/evaluation_vector.ts:230`) is called by the
      cascade's stage 6, which `evolution_lab`'s `run` verb executes for every
      candidate. So a promotion in this tree IS decided by the paired verdict,
      where before *"no promotion is decided at all"*.
      **`underpowered` is still refused as a pass on the production path, not
      only in the module's own tests** — a CLI run whose only paired row carries
      `underpowered` reaches the verdict and reports a refusal.
      **The second conjunct is unchanged, and so is its honest scope caveat**:
      `findScalarCollapse` is a named-construct static scan over a bounded
      population, not a semantic proof that no arithmetic anywhere reduces a set
      of metrics to one number. Closing this criterion does not upgrade that
      evidence class.
      **Audited 2026-08-31: the second conjunct is met, the first is not, and
      the criterion stays open on the conjunction.**
      Second conjunct — met, with its evidence class named rather than
      overstated. `findScalarCollapse`
      (`tests/scripts/evaluation_vector.test.ts:48`) is green over every `.ts`
      under `src/scripts` that mentions `MetricVector`, unioned with a named
      core set, and it is proved to fire on seven collapsing shapes before it is
      trusted to be silent; `MetricVector` (`evaluation_vector.ts:83-86`) has no
      field that could hold a summary number. That is a **named-construct static
      scan over a bounded population**, not a semantic proof that no arithmetic
      anywhere reduces a set of metrics to one number.
      First conjunct — NOT met. `promotionVerdict`
      (`evaluation_vector.ts:230`) does decide per metric and does refuse an
      `underpowered` row as a pass, reproduced at 18/18 green — but it has **no
      caller**. `evolution_lab`'s `promote` verb (`:858`) refuses
      unconditionally without ever consulting it, so no promotion in this tree
      is decided by `paired_verdict`, because no promotion is decided at all.
      Closing on the scanner alone would be closing on the met half of a
      conjunction. What closes it is a caller: 4.1's cascade, or `promote`
      consulting the verdict before it refuses.
- [x] AC-6 — The holdout partition's content hash predates the first commit of
      any proposer capability, and a run leaking a holdout value into proposer
      context exits non-zero.
      **CLOSED 2026-08-31 — the first conjunct's re-pin was PERFORMED, and a
      guard now stands where the audit found none.** The audit below predicted
      exactly this closure and is preserved rather than deleted, because it is
      the record of what was falsified and why.
      **The re-pin.** `agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md`
      now publishes `SET-SHA256 0667fbd9…` in place of the stale `7e091dfc…`,
      and the three per-file rows the freeze commit had pinned at pre-edit
      bytes — `threat-modeling` `0cc498c5…` → `6bdb1d3b…`, `markitdown`
      `ccaac56a…` → `663ee4c4…`, `security-audit` `8005676c…` → `27ccbdcd…`.
      **Verified rather than asserted: 100 of 100 per-file rows and the set hash
      now reproduce** from the artefact's own documented recipe on this tree, and
      `git diff 34318f7f..HEAD` over the three paths is empty, so the re-pin
      names the frozen bytes and not some later state.
      **The ordering half was re-verified, not assumed to survive the re-pin.**
      `git merge-base --is-ancestor 34318f7f ac2501313` returns true —
      `34318f7f5` (2026-08-30 22:11:43) precedes `ac2501313`
      (2026-08-31 00:44:37), which added `_lib/candidate_proposer.ts` and
      `evolution_lab`'s `propose` verb. The near-miss was re-checked:
      `_lib/harness_evolution_guards.ts` (2026-08-30 17:55:29) names "proposer"
      but is the guard that REFUSES disclosure to one.
      **What makes this durable rather than a one-off fix**, and it is the part
      the audit could not have supplied: a stale pin is invisible to anyone who
      re-runs the recipe and compares it to nothing.
      `tests/scripts/trigger_corpus_holdout_pin.test.ts` recomputes the recipe
      from the tree and asserts every published row AND the set hash reproduce,
      with an anti-vacuity assertion so a scan over an empty corpus cannot pass.
      **Proved SENSITIVE in both directions before it was trusted.** Appending
      one byte to `src/skills/markitdown/evals/triggers.json` turned it red on
      *"the published SET-SHA256 reproduces"* and *"every per-file row
      reproduces"* (2 failed / 3 passed); restoring the byte returned 5/5.
      Independently, falsifying the artefact's own `SET-SHA256` line turned it
      red on one assertion (1 failed / 4 passed) and restoring returned 5/5. So
      it fires on a corpus edit and on a pin edit, which are the two ways this
      claim can go stale.
      **Second conjunct unchanged and still met** —
      `tests/scripts/harness_evolution_guard_call_sites.test.ts` 15/15, a holdout
      value reaching proposer context exits 4 before any external call.
      **Audited 2026-08-31: the second conjunct is met, the first is
      FALSIFIED — by reproduction, not by doubt.**
      Second conjunct — met.
      `tests/scripts/harness_evolution_guard_call_sites.test.ts` is 15/15 green
      and drives the real CLI: a holdout value reaching proposer context exits 4
      before any external call. That is AC-11's evidence and it holds here.
      First conjunct — the pinned `SET-SHA256 7e091dfc...` in
      `agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md` does
      **not reproduce**. Running that file's own documented recipe on this
      checkout yields `0667fbd9...`; two near-variants (dropping the partition
      column, tab separators) yield two further hashes and neither is the pin.
      The corpus is not the cause: the file set is identical to the freeze
      commit `34318f7f` (100 files, `git ls-tree` diff empty) and every file's
      bytes are unchanged since it. The cause is that `34318f7f` — the commit
      that RECORDED the freeze — also edited three of the files it was freezing.
      `markitdown`, `security-audit` and `threat-modeling` carry their pre-edit
      hashes in the per-file table; 97 of 100 rows reproduce exactly, those
      three do not, and the set hash inherits it. The pin was stale on arrival,
      so there is no verifiable content hash whose age can be asserted.
      **The ordering half is intact and is not what fails.** `34318f7f`
      (2026-08-30 22:11:43) is a topological ancestor of `ac2501313`
      (2026-08-31 00:44:37), which added the first proposer capability —
      `_lib/candidate_proposer.ts` and `evolution_lab`'s `propose` verb — and
      `git merge-base --is-ancestor` confirms it. The earlier
      `_lib/harness_evolution_guards.ts` (2026-08-30 17:55:29) names "proposer"
      but is the guard that REFUSES disclosure to one, not a proposer
      capability; it was checked precisely because it is the near-miss.
      **What closes it, recorded rather than performed** — re-pinning a frozen
      corpus is an owner-visible correction, not the missing-row class this
      audit was scoped to: re-pin those three per-file hashes and the
      `SET-SHA256` to the frozen bytes, which are still recoverable because they
      have not moved since `34318f7f`, and state the correction in the artefact.
      The ordering claim survives that re-pin, because the bytes have not moved
      since a commit that precedes the first proposer commit.
- [x] AC-7 — The three existing delivery arms have been measured against one
      another before any new retrieval component exists, and
      `router_match_parity.test.ts` is still green.
      **CLOSED 2026-08-31: both conjuncts now met, and the first was closed by
      6.1 exactly as the audit below predicted.**
      `agents/evidence/analysis/governed-harness-three-arm-delivery.md` measures
      `eager-all` 1.000 (305/305) at 120,743 standing tokens, `thin` 0.000
      (0/305) at 18,223, and `delivery` 0.990 (302/305) at 18,223 + 2,026
      injected tokens per prompt, over one corpus with one matcher and zero
      model calls — reproduce with `model_rule_injection --three-arm`. The
      "before any new retrieval component exists" half is now satisfied by
      ORDERING rather than vacuously: the measurement exists and 6.3 has not
      started. `router_match_parity.test.ts` is 5/5 and
      `single_matcher_preserved.test.ts` 8/8 on this branch.
      The audit that predicted this is preserved below rather than deleted,
      because it is the record of what was missing and why the nearest existing
      artefact did not close it.
      **Audited 2026-08-31: second conjunct met, first not met.**
      `tests/scripts/router_match_parity.test.ts` is 5/5 green, and 6.2 added
      `single_matcher_preserved.test.ts` (8/8) beside it. The first conjunct is
      step 6.1, which is `[ ]`: no measurement of `eager-all` against `thin`
      against `delivery` exists. The nearest thing on the tree was checked and
      is not it — the price grid at `src/scripts/model_rule_injection.ts:455-462`
      MODELS projected session cost for the three shapes for a different,
      archived roadmap, and a cost model is not the three-arm experiment 6.1
      names. The "before any new retrieval component exists" half is satisfied
      only vacuously, since 6.3 has not started. What closes it is 6.1.
- [ ] AC-8 — Programme success and failure criteria from 0.7 were committed
      before the first candidate run, and the run report carries an
      evolution-ROI figure.
      **RE-AUDITED 2026-08-31 after 5.6 landed: still OPEN, and the reason
      moved rather than went away.**
      *First conjunct, unchanged:*
      `agents/evidence/analysis/governed-harness-success-criteria.md` was
      committed at `172b87c6` (2026-08-30 10:32:57) and no candidate run has
      happened at all, so the criteria precede it — a real but currently
      vacuous satisfaction, and still worth naming as such.
      *Second conjunct, half-closed.* 5.6 built the missing subject: a run
      report now exists, `buildRunReport`
      (`src/scripts/_lib/evolution_roi.ts:363`) REFUSES one without the ROI
      figure, and `evolution_lab`'s `run` verb emits it on the one path a run
      completes on (`src/scripts/evolution_lab.ts:865`). Any report this
      programme produces from here on carries the figure structurally rather
      than by an author remembering to add it. That is the SHAPE half.
      **What is still missing is the run, and it is not reachable in this
      roadmap.** A `run` invocation today clones candidate trees and evaluates
      nothing — its honest ROI kind is `unmeasured`, which is the report telling
      the truth. A *candidate run* in this programme's sense evaluates
      candidates against an eval corpus over repeated trials, which needs a
      metered backend, which step 5.2 forbids: no step in this roadmap invokes
      a live routing harness, and
      `tests/scripts/governed_harness_no_live_harness.test.ts` holds it.
      **A fixture is not the first candidate run, and none of the artefacts
      5.6 shipped is offered as one.** The end-to-end case at
      `tests/scripts/evolution_lab.test.ts:524` drives the real CLI over five
      real clones and asserts the report reaches stdout; it proves the report
      is emitted, and it evaluates no candidate. Reading it as the run would be
      exactly the substitution this criterion exists to catch.
      **What closes it:** a first candidate run under a metered backend, which
      belongs to whichever roadmap lifts the live-harness park — not to this
      one. Until then AC-8 is `[ ]` with its shape half done and its subject
      half absent.
- [-] AC-9 — At least one promoted artefact has been through post-promotion
      re-evaluation and at least one RETIRE path has been exercised, so the
      lifecycle is shown to close in both directions.
      **MERGED (outcome transferred to road-to-harness-promotion-bridge)** —
      carried there verbatim, with its 2026-08-31 audit note intact. `[-]`
      means TRANSFERRED, never met and never dropped: the criterion is open in
      the receiver, where 7.6 is what closes it, after `merge-authority`.
- [-] AC-10a — **SUPERSEDED by ADR-249 2026-08-31.** Original criterion,
      verbatim: *"The `no-runtime-daemon` claim in `README.md` and its
      `docs/CLAIMS.md` entry are byte-identical to their pre-roadmap state."*
      Byte-identity is **impossible**, and not because of anything this roadmap
      did: a different roadmap deliberately retired the claim by governance
      decision. `[-]` records that the criterion was superseded, never met and
      never dropped; its safety purpose is carried forward unweakened as AC-10b
      below.
- [x] AC-10b — **This roadmap introduces no unsupervised background process
      (class P2), and does not touch the claim or retirement surfaces.**
      Carries AC-10a's purpose — *"this roadmap did not quietly acquire a runtime
      daemon"* — re-keyed onto a boundary that still exists.

      **CLOSED 2026-08-31, read at completion rather than mid-flight.** The
      earlier note on AC-10a deliberately refused to close this on a partial
      branch, because a tripwire read before the work is finished has not been
      read. This is the reading taken once the roadmap reached its terminal
      state.
      **Surfaces untouched.** `git diff --name-only origin/main..HEAD --
      README.md docs/CLAIMS.md` is empty, so neither the claim surface nor its
      retirement record moved on this branch.
      **No process of any class introduced.** The branch adds 13 files and
      2,691 lines under `src/`, and a scan of the added lines for
      `setInterval`, `setTimeout(`, `while (true)`, `daemon`, `.unref(`,
      `spawn(`, `fork(`, `listen(` and `createServer` returns **nothing**. So
      the question of whether a new process would be a supervised P1 or an
      unsupervised P2 does not arise: there is no process.
      **What this criterion does and does not certify.** It is a scan over the
      lines this branch ADDED, which is the population the criterion is about —
      *this* roadmap's contribution. It certifies nothing about processes the
      tree already carried; `src/scripts/collector_daemon.ts` predates this work
      and is governed by ADR-249, not by this row.
      **AI council 2026-08-31, verdict D (split), and it is a SINGLE-SEAT
      DEGRADED round — recorded as such, never as convergence.** Present:
      openai/codex-default. Absent: anthropic/claude-sonnet-4-5, `exit_1` with
      no output. That is the same seat-and-shape failure step 4.1 already
      records for a long multi-decision question, so it is a known mode rather
      than a new one; under the N=3 budget the run took the best available seat
      and did not retry.
      **Why the split rather than a re-key.** Option A — re-key to *"no diff
      attributable to THIS roadmap"* and close on a two-file documentation diff —
      was put to the seat and REFUTED: *"Option A's suggested `git diff --stat`
      over two documentation files proves only that those files were untouched.
      A daemon could be introduced entirely in source or deployment config."*
      The tripwire would have been closed by a check that cannot see the thing
      it guards.
      **Why the criterion had to move at all.** `docs/contracts/no-runtime-boundary.md:25`
      records that the absolute prohibition AC-10a guarded no longer exists:
      background processes are **governed**, not banned — a supervised process is
      class **P1** and permitted under four conditions, an unsupervised one is
      class **P2** and stays prohibited. `src/scripts/collector_daemon.ts` is in
      the tree today. So a criterion phrased as *"the no-daemon claim is
      byte-identical"* now guards a claim the suite has withdrawn on purpose, and
      re-keying it to the same wording would re-assert a floor ADR-249 lowered by
      decision. AC-10b is deliberately phrased against **P2**, the half that
      survived.
      **Reading at this commit, and it is explicitly NOT a closure.** The branch
      diff against `origin/main` is three files — one evidence artefact, this
      roadmap, and one test — with zero changes under `src/` and no process of
      any class introduced; the same diff restricted to `README.md` and
      `docs/CLAIMS.md` is empty. AC-10b stays `[ ]` because a tripwire read
      before the roadmap is finished has not been read: later commits on this
      branch can still falsify it, and the reading that closes it is the one
      taken at completion.
      **SUPERSEDED 2026-08-31 (drain run 11) — this paragraph is a preserved
      PRE-CLOSURE audit round and its `[ ]` is no longer the state.** The
      completion reading it names as the one that closes the criterion was
      subsequently taken and is recorded at the head of this item ("CLOSED
      2026-08-31, read at completion rather than mid-flight"), and the marker on
      this criterion is `[x]`. The paragraph is kept because this file preserves
      superseded audits rather than deleting them; it is annotated so a reader
      does not take its `[ ]` for the live marker.
      **Attribution, re-checked rather than carried.** The removing commit is
      `68463a1e` (2026-08-28), *"roadmap: complete runtime-governance-flip
      (ADR-249 ...)"*. Step 0.3 already recorded that retirement and repaired its
      own count-keyed guard against it; AC-10 was the survivor of that same edit.
      **Audited 2026-08-31: FALSIFIED as written — and not by this roadmap.**
      The pre-roadmap state is `9e8344a3`, the parent of `15447f47` which added
      this file on 2026-08-26. At `9e8344a3` the README's line 19 carried the
      `no-runtime-daemon` claim marker; it carries no such marker today. The
      `docs/CLAIMS.md` entry moved from `status: backed` to `status: withdrawn`
      and gained four fields (`retires_phrasings`, `retired_by`,
      `superseded_by`, `non_inference`). Neither is byte-identical, so the
      criterion is false as written.
      **Attribution was checked, not assumed.** `git log -S` names the removing
      commit as `68463a1e` (2026-08-28), *"roadmap: complete
      runtime-governance-flip (ADR-249 ...)"* — a different roadmap retiring the
      claim by decision. This branch touches neither file, per
      `git diff --stat origin/main..HEAD`. Step 0.3 already recorded the same
      retirement and repaired its own count-keyed guard against it; AC-10 was
      not repaired in the same pass and is the survivor of that edit.
      **It stays `[ ]` rather than being re-keyed.** Rewriting it to "no diff
      attributable to THIS roadmap" would close it by redefinition, which is the
      generous reading AC-3 above warns against, and the re-key is an owner
      decision rather than an audit one. What closes it is that amendment,
      recorded.
      **SUPERSEDED 2026-08-31 (drain run 11), and it is worth being precise
      about which criterion each sentence is about.** The `[ ]` in this
      paragraph belongs to **AC-10a**, whose re-key it refuses to perform on
      audit authority; AC-10a is `[-] SUPERSEDED by ADR-249` and was never met
      and never dropped. The amendment this paragraph names as the closing
      condition arrived as ADR-249, and its safety purpose was carried forward
      unweakened onto **AC-10b**, which is the `[x]` criterion this item now
      holds. Annotated rather than deleted, for the same reason as the
      paragraph above.

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
