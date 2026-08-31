<!-- evidence-type: analysis -->

# Governed harness evolution — capability inventory matrix

`road-to-governed-harness-evolution` step 0.1, which is that phase's exit
criterion: *"a table of planned capability → existing carrier in the tree →
redirect / extend / build new (with the reason). The phase does not close while
a row reads 'build new' without a stated reason no carrier fits."*

**Measured at `origin/main` on 2026-08-30.** Every carrier below was opened and
its line cited; nothing here is recalled. A row whose carrier could not be found
says so rather than guessing.

**Why this matrix is the exit criterion and not a formality.** Risk 1 in the
roadmap's own register is *"parallel rebuild of machinery that exists — a second
isolation mechanism next to `bench_ab_clone`, a second verdict next to
`paired_verdict`, a second delivery path next to `lean_projection_mode`, a
second matcher next to `router_match`. Two truths about 'better' and no test
catches it, because neither is wrong on its own terms."* The register records
that the source proposals committed exactly that four times, once inside the
document whose thesis it was. A matrix is the cheapest thing that makes the
fourth instance visible before it is written.

## The matrix

| # | Planned capability | Phase | Existing carrier | Verdict | Reason |
|---|---|---|---|---|---|
| 1 | Isolated candidate checkout, no writes to the original tree | 3.1 | `src/scripts/bench_ab_clone.ts` | **extend** | Already multi-variant: `variant === 'with-rdp'` at `:141`, `:218`, `:220` sits on a different axis from `with`/`without`, so a candidate variant is a new enum member on existing machinery, not a second isolation mechanism. |
| 2 | Leakage assertion / path-ownership sabotage fails closed | 3.1 | `src/scripts/bench_ab_integrity.ts` (283 lines) | **redirect** | Byte-wise clone comparison already present. Nothing in this roadmap needs a second integrity path; the candidate variant inherits it by construction. |
| 3 | Paired verdict where `underpowered` is not a pass | 4.3 | `src/scripts/_lib/paired_verdict.ts` | **redirect** | `:25-26` declares the four outcomes with the comment *"`underpowered` is deliberately not a kind of pass"*, and `:210` excludes it from the pass-rate denominator. 4.3's requirement is this module's existing contract. |
| 4 | Planted bad candidate rejected cheaply | 4.7 | `src/scripts/_lib/eval_publication.ts` | **redirect** | `PlantedItem` at `:13`, `discriminationDeficit` at `:31`. |
| 5 | Evaluator hygiene: blinding and order-swap | 4.7 | `src/scripts/_lib/judge_hygiene.ts` | **redirect** | `:5-9` runs both orders and resolves a flip to `inconsistent` rather than to a winner, with `inconsistent` as its own bucket rather than a tie in a denominator. |
| 6 | Deterministic lexical shortlist, no embeddings | 6.3 | `src/scripts/_lib/lexical_index.ts` | **redirect** | The BM25 core ADR-061 sanctions — pure Node stdlib, deterministic, in-memory per invocation. 6.3 is gated on 6.1's measurement anyway, so nothing is built here until a measured need exists. |
| 7 | Per-task delivery mode | 6.1 | `src/scripts/_lib/lean_projection_mode.ts` | **redirect** | `:19` declares `'eager-all' \| 'thin' \| 'delivery'` and `:21` makes `eager-all` the default. **All three arms exist**; `delivery` is simply not shipped as the default, so 6.1's three-arm experiment measures a substrate that is already there. |
| 8 | One shared matcher across offline model and runtime | 6.2 | `src/scripts/_lib/rule_injection.ts` + `src/scripts/_lib/router_match.ts` | **redirect** | `rule_injection.ts:1-19` calls itself *"THE single module both the offline model and the runtime concern read"*, trigger semantics live in `router_match.ts` as *"the single implementation for every surface"*, and the invariant is pinned by `tests/scripts/router_match_parity.test.ts`. 6.2 preserves this rather than adding to it. |
| 9 | Append-only evidence state | 1.3, 7.1 | `docs/contracts/audit-log-v1.md` | **extend** | `:26` allows correction only via a new `type=supersede` line and `:85` carries the `type` enum. 1.3's receipt is a new record type on this contract, which is what *"extend an existing carrier, do not add a store"* asks for by name. |
| 10 | Trigger-corpus census and its discipline | 2.1–2.4 | `src/scripts/lint_skill_trigger_corpus.ts` | **extend** | Its own header states it applies *"the routing-matrix corpus DISCIPLINE … to the skill corpus that already exists"*. The census in 2.1 is a report over that corpus, not a new corpus. |
| 11 | Promotion gate: the answers a new artefact must give | 7.2 | `src/scripts/check_skill_admissions.ts` | **redirect** | Its header records that the five growth questions (family · capability · why-not-extend · why-not-a-guideline · visibility tier) already exist and that this gate is where their answers land. 7.2's *"route through the existing gate, not a second governance system"* names this. |
| 12 | Candidate recurrence tracking before promotion | 3.4 | `src/scripts/update_skill_candidates.ts` | **extend** | A durable per-topic counter that promotes a topic to a live candidate at ≥ 3 mentions. The lifecycle enum 3.4 wants is a state field on this record, not a parallel store. |
| 13 | Regression selection over an affected neighbourhood | 4.6 | `src/scripts/discovery_graph.ts` | **extend** | Its `affected` BFS over the artefact relation graph already answers *what does this reach*, and it resolves on this checkout (785 nodes, 1672 edges). What 4.6 adds is selection over a caller-supplied regression registry and a refusal when a touched surface is absent from the graph. The native `agent-config code-graph` engine was tried first and answers `no code-graph source detected` because `hooks.code_graph.enabled` ships `false` (`src/config/agent-settings.template.yml:1373-1374`), so the substitution is stated at `src/scripts/_lib/regression_neighbourhood.ts:15-40` rather than hidden. |
| 14 | Deterministic near-duplicate screen before any model judgment | 5.5 | `src/scripts/_lib/shingle_similarity.ts` | **redirect** | Step 5.5 names this module by path. It is the entity-neutralized shingle-overlap primitive behind `lint_originality.ts` and it already defeats the find-replace re-skin that `text_similarity.ts` and `audit_skill_overlap.ts` miss. `curator_ops.ts:45` imports it and its import list is asserted to be exactly that one entry, so no second similarity primitive is introduced. |

## Rows that read "build new", and the reason no carrier fits

Six, and each names what was searched rather than asserting absence.

**Rows 4-6 added 2026-08-31**, during the acceptance-criteria audit of the branch that closed steps 4.2, 4.3, 4.5, 4.6, 4.7, 5.2, 5.3, 5.5 and 6.2. Those steps shipped six modules under `src/scripts/_lib/`; three of them were already covered here (the metric vector below, and rows 13-14 above), and three were building a capability with no row at all. That is the gap acceptance criterion AC-1 exists to catch, and it caught it. Every search below is a command that was run on this tree on 2026-08-31, not a recollection.

| Planned capability | Phase | What was searched | Why no carrier fits |
|---|---|---|---|
| **Candidate lifecycle state enum** (`mutated` and `accepted` cannot be confused) | 3.4 | `ls src/scripts/ \| grep -iE 'candidate\|proposer\|evolve'` returns exactly one file, `update_skill_candidates.ts`, whose durable state is an integer mention count. | A counter cannot express a state machine. The enum is new; its **home** is not — it lands on the existing record per row 12, which is why this is a new type rather than a new store. |
| **Operator command surface for candidates** | 3.6 | The CLI verb registry, and `ls src/scripts/` for a candidate-facing entry point. | No verb addresses candidates today. Deliberately deferred to 3.6 rather than sketched here: a command surface with no lifecycle behind it is the speculative-infrastructure shape this estate has measured twice. |
| **Metric vector reporting without a weighted total** | 4.2 | `paired_verdict.ts` (per-metric verdicts, no aggregation) and `eval_publication.ts`. | Both produce per-item verdicts; neither assembles a vector across metrics. The new part is the assembly and the **refusal to weight**, which is a report shape rather than a mechanism — and 4.2's whole point is that the weighted total must not exist. |
| **Minimality tie-break over a committed criterion order** | 4.5 | `ls src/scripts/_lib \| grep -iE 'tie\|minimal\|rank'` returns `arm_ranking.ts`, `model_tier.ts`, `surface_tiers.ts` and `tier_budget_routing.ts`; `grep -rl 'minimality\|tieBreak' src/scripts` returns nothing outside the new module. | `arm_ranking.ts` ranks experiment arms on ONE metric at a time (`tokens`, or `cost-per-solved` when asked) and its own header argues against a single mandatory score; the tier modules assign a tier to an artefact and never compare two candidates. Nothing orders a pair by a committed sequence of criteria, which is what E5 decided and what has to be mechanical for the decision to be reproducible. |
| **Evaluator-promotion refusal** | 4.7 | `ls src/scripts/_lib \| grep -iE 'evaluat\|judge\|promot'` returns `evaluator_contract.ts`, `judge_hygiene.ts` and `knowledge_global_promote.ts`, all three opened. | `evaluator_contract.ts` validates an evaluator's OUTPUT against `docs/contracts/evaluator-output.md`; `judge_hygiene.ts` classifies assertion shapes; `eval_publication.ts` scores plants; `knowledge_global_promote.ts` promotes knowledge pages, not evaluators. Each answers *is this output well formed*. None answers *may this evaluator take the seat*, which is the refusal 4.7 asks for. The scoring and hygiene halves are reused by import (rows 4 and 5), so only the refusal is new. |
| **Role-scoped prompt construction with an admissible-input-set refusal** | 5.3 | `ls src/scripts/_lib \| grep -iE 'role\|prompt'` returns `prompt_shape.ts` and `session_role.ts`; `grep -rln 'buildPrompt\|renderPrompt' src/scripts` returns `second_brain_run.ts`. | `prompt_shape.ts` CLASSIFIES a transcript entry as a prompt for the language hook and the conformance scanner; `session_role.ts` detects whether the current session is a worker; `second_brain_run.buildPrompt` renders one recall task for a paired measurement. None constructs a role-scoped prompt, and none refuses an input outside a role's declared set, which is the whole mechanism of 5.3: the roles collapse when the input set widens, not when someone decides to collapse them. |

## What this matrix does NOT establish

- **It is not the second half of 0.1's verify.** That clause has two parts: this
  file exists with an `evidence-type` marker, and *"every later phase names a row
  in it"*. The second is a **forward obligation on Phases 1–7**, and no document
  written today can satisfy it. It is recorded at 0.1 in the roadmap as a
  standing requirement, and the first later-phase step that cites no row is where
  it fails.
- **It is not a scope grant.** A `redirect` verdict says a carrier exists, not
  that the phase using it is authorised; Phase 7 remains gated on the
  `merge-authority` blocker regardless of what any row here says.
- **Verified means opened, not exercised.** Every citation above is a line read
  at `origin/main` on 2026-08-30. None of these carriers was run against a
  candidate, because no candidate exists yet — the first time these verdicts are
  tested is Phase 3.

## Estate reconciliation — step 0.2's five-verb disposition, per overlapping plan

Step 0.2 asks a different question from the matrix above: that one is
capability → carrier, this one is **roadmap → roadmap**, with one of five verbs
per overlapping plan (`own here / fold into existing / depend on existing /
supersede proposal / drop`) and the closing invariant **no capability has two
execution owners**.

| Overlapping plan | State | Verb | Basis |
|---|---|---|---|
| `road-to-experience-loop-broadening` | active | **depend on existing** (per mechanism, both directions) | Its E1 was resolved 2026-08-29 by AI council 2/2 — *stay separate, every overlap assigned to exactly one canonical owner* — and its canonical ownership matrix already assigns the three shared mechanisms. This roadmap owns the trigger corpus (Phase 2) and the paired-verdict mechanism (4.3); the sibling owns outcome-vocabulary reconciliation (its 1.3), which is why **this roadmap's 1.4 is re-scoped to a non-blocking consumption reference** and is already `[x]`. |
| `road-to-capability-native-execution` | active | **drop** (no overlap to reconcile) | Measured, not assumed: `grep -ciE 'trigger corpus\|paired.?verdict\|outcome vocabular\|activation ladder\|promotion bridge'` over that file returns **0**. Its subject is browser capability dispatch; the only shared thing is the estate-wide *do not build a second router* discipline, which both roadmaps discharge against the same existing primitives rather than against each other. |
| `road-to-inbox-harvest-2026-08-e-council-topology-evidence` | active | **drop** (no overlap to reconcile) | Same measurement, same result: **0** matches. Its subject is council topology evidence. |
| `road-to-routing-assurance-live-floors` | parked in `later/` | **depend on existing** — and keep it parked | Step 5.2 of this roadmap is *"keep the live-floors park intact. No live harness."* The park is a precondition of this roadmap's scope, not a plan to fold in. |
| `road-to-gated-self-evolution` v3 | superseded proposal | **supersede proposal** | Named in this roadmap's own supersedes header. |
| `road-to-evidence-driven-harness-evolution` | superseded proposal | **supersede proposal** | Named in the same header, and cited at `:1200-1201` for its declared trust boundary. |
| `road-to-gated-harness-evolution-deep-v4` | superseded proposal, **not named by the master** | **supersede proposal** | The skipped parent. This roadmap folds its content back in and marks each such item `from-skipped-parent` — which is why the verb is `supersede`, not `drop`: dropping it is the consolidation defect Risk 2 names. |

**Re-measured 2026-08-31, and the estate has moved under three rows without changing any verb.** `road-to-experience-loop-broadening` is now under `agents/roadmaps/archive/`, `road-to-capability-native-execution` is now under `agents/roadmaps/later/`, and `road-to-turnaround-followups` has entered the active set. The State column above is left as measured on 2026-08-30 rather than silently rewritten; what was re-run is the disposition question itself. The 0.2 overlap grep over every file in `agents/roadmaps/` and `agents/roadmaps/later/` returns a non-zero count for exactly two files: this roadmap (34) and `road-to-inbox-harvest-2026-08-e-council-topology-evidence` (1). That single hit is incidental -- it is the phrase *parse-outcome vocabulary* at `:582`, about a typed union for council parse results, not the outcome-vocabulary reconciliation this table assigns -- so its `drop` verb stands and its recorded count of 0 is stale rather than wrong in substance. `road-to-turnaround-followups` measures 0 and is therefore not an overlapping plan. The two `later/` receivers carrying `parent_roadmap: road-to-experience-loop-broadening` (`road-to-experience-loop-owner-decisions`, `road-to-experience-lifecycle-operational-proof`) each measure 0 as well, so the archived sibling's deferrals did not carry an overlap into a file this table does not name.

**No capability has two execution owners.** The only capabilities with a
plausible second claimant are the three in the sibling's matrix, and that matrix
assigns each exactly once. The three `drop` rows have no shared capability to
own, measured rather than asserted. The `supersede` rows are not executing.

**What this does NOT settle.** A verb is a disposition, not a schedule: `depend
on existing` explicitly does **not** make the owner's completion an entry or exit
criterion for the non-owner, per the sibling's *"a reference must not become a
hidden gate"* clause. And the reciprocal half lives in the sibling — this table
is consistent with it and does not restate its authority.
