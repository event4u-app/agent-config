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

## Rows that read "build new", and the reason no carrier fits

Three, and each names what was searched rather than asserting absence.

| Planned capability | Phase | What was searched | Why no carrier fits |
|---|---|---|---|
| **Candidate lifecycle state enum** (`mutated` and `accepted` cannot be confused) | 3.4 | `ls src/scripts/ \| grep -iE 'candidate\|proposer\|evolve'` returns exactly one file, `update_skill_candidates.ts`, whose durable state is an integer mention count. | A counter cannot express a state machine. The enum is new; its **home** is not — it lands on the existing record per row 12, which is why this is a new type rather than a new store. |
| **Operator command surface for candidates** | 3.6 | The CLI verb registry, and `ls src/scripts/` for a candidate-facing entry point. | No verb addresses candidates today. Deliberately deferred to 3.6 rather than sketched here: a command surface with no lifecycle behind it is the speculative-infrastructure shape this estate has measured twice. |
| **Metric vector reporting without a weighted total** | 4.2 | `paired_verdict.ts` (per-metric verdicts, no aggregation) and `eval_publication.ts`. | Both produce per-item verdicts; neither assembles a vector across metrics. The new part is the assembly and the **refusal to weight**, which is a report shape rather than a mechanism — and 4.2's whole point is that the weighted total must not exist. |

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

**No capability has two execution owners.** The only capabilities with a
plausible second claimant are the three in the sibling's matrix, and that matrix
assigns each exactly once. The three `drop` rows have no shared capability to
own, measured rather than asserted. The `supersede` rows are not executing.

**What this does NOT settle.** A verb is a disposition, not a schedule: `depend
on existing` explicitly does **not** make the owner's completion an entry or exit
criterion for the non-owner, per the sibling's *"a reference must not become a
hidden gate"* clause. And the reciprocal half lives in the sibling — this table
is consistent with it and does not restate its authority.
