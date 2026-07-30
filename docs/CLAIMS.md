# Claims Ledger

> Every public-facing claim (README, docs, site, marketplace copy) that carries a
> `<!-- claim:<id> -->` marker binds here to resolvable evidence. `check_claims`
> (in `task ci`) fails the build if a markered claim has no `backed` ledger entry
> with a resolving evidence pointer. This is the package's falsifiability culture
> turned on its own marketing — **we sell honesty, so the selling is machine-checked.**
>
> Enforced by [`src/scripts/check_claims.ts`](../src/scripts/check_claims.ts).
> Roadmap: `road-to-final-state-and-market-readiness.md` Phase 1 / Track B (B1).

## How it works

- A public sentence that makes a capability or quantitative claim gets an HTML
  marker: `<!-- claim:my-claim-id -->` (invisible in rendered Markdown).
- The marker's `id` must match a `### claim: my-claim-id` block below with
  `status: backed` and a resolving `evidence` pointer.
- **Only markered claims are enforced.** Unmarkered prose is never checked — the
  ledger tightens as claims are bound over time, never retroactively breaking CI.
- `status: unbacked` entries are **inventory** (documented debt): they record a
  claim that is not yet bound. They do NOT fail the build, but markering their
  claim in prose does (forces the binding first).

## Entry schema

```
### claim: <kebab-id>
- claim: <the sentence, roughly as it appears publicly>
- kind: quant | qual | comparative
- evidence: <pointer>            # see grammar below
- status: backed | unbacked
- last_verified: <YYYY-MM-DD>
```

**Evidence-pointer grammar (v2):**

- `path/to/file.md` or `path/to/file.md:42` — the repo file exists (line advisory).
- `path/to/file.md#substring` — the file exists AND contains `substring`.
- `https://… (YYYY-MM-DD)` — external cite carrying a dated stamp (not fetched in CI).
- `exec:<command> -> <exit-code>` — the command **re-runs** and its exit code
  must match. The only form that can tell a live claim from a stale one.

**Why the fourth form exists.** The first three are existence checks. A claim
reading "the suite is green" whose pointer resolves to a report nobody
regenerated stays `backed` indefinitely — the pointer resolves, the claim is
false. `exec:` re-derives the claim and lets the exit code carry the verdict.

**Where `exec:` runs, and where it does not.** Re-execution happens in CI only.
Locally the gate is read-only and reports `UNVERIFIED — re-execution is CI-only,
skipped locally`; it never runs a command in a consumer's checkout. The static
half — is the pointer well-formed, is the command allowlisted — is checked
everywhere, because a bad pointer is a defect in the ledger rather than a
property of the machine. **Accepted limitation (documented, not silent):** the
re-executing workflow is path-filtered to claims-adjacent files, so a change
elsewhere in the tree does not re-trigger re-execution — an `exec:`-backed
claim is re-derived when the claims surface moves, not on every commit.

**What `exec:` cannot cover.** Only claims whose exit code *is* the verdict. A
figure resting on a paid model run, a stochastic benchmark, or a prose contract
cannot use this form; those stay on a pointer and are listed as
unfalsifiable-by-machine in [`proof.md`](proof.md) rather than quietly omitted.

The allowlist is a set of argv prefix tuples in
[`src/scripts/_lib/exec_evidence.ts`](../src/scripts/_lib/exec_evidence.ts) —
never a regex over a command string, because a regex over shell text is the
classic bypass. Every argument after the matched prefix is re-checked for shell
metacharacters and repo escape, including the right-hand side of `--flag=value`.

---

## Backed claims

### claim: no-runtime-daemon
- claim: The whole layer is compiled into host agents with zero runtime daemon.
- kind: qual
- evidence: docs/contracts/no-runtime-boundary.md#file-first, no-runtime suite
- status: backed
- last_verified: 2026-07-04

### claim: shipped-artifacts-hidden-instruction-scanned
- claim: Every artifact the package ships — source AND the condensed projection that reaches consumers — is machine-scanned in CI for hidden-Unicode, mixed-script-confusable, and instruction-smuggling payloads (the rules-file-backdoor class); a finding blocks the release before `npm publish`, not just the merge.
- kind: qual
- evidence: exec:lint_agent_security -> 0
- status: backed
- last_verified: 2026-07-09

### claim: surgical-uninstall
- claim: Removes only its own keys from a shared host config (matched by JSON-pointer + SHA-256), never a neighbour tool's entries.
- kind: qual
- evidence: docs/contracts/install-layout.md#JSON-pointer
- status: backed
- last_verified: 2026-07-04

### claim: discipline-lift-weak-host
- claim: On a weak host (claude-haiku-4-5) the package produces a significant, placebo-controlled discipline lift on scope/downstream traps; on a strong host the same measurement is a published null — the package transplants discipline a weak model lacks, not model intelligence.
- kind: quant
- evidence: docs/benchmark.md#weak-host-specific
- status: backed
- last_verified: 2026-07-05

### claim: essential-tier-cost-factor
- claim: The lift-carrying essential cut (kernel + downstream-changes) keeps a significant weak-host discipline lift at a fraction of the full load's tokens, and the lift is FAMILY- and HOST-SCOPED — measured on three hosts: claude-haiku-4-5 (weak) shows the family-scoped lift (trapE 0.533→1.000, 7/7 discordant, corpus cost 1.71x); claude-sonnet-4-6 (strong) is a ceiling null; gpt-5-mini (non-Claude weak, codex prompt-prepend surface) FAILED replication with headroom (corpus Δ=+0.024 p=0.70, capability trend n.s. — no harm claimed, injection-surface confound documented). Therefore discipline_profile: auto enables the lift only where measured (vendor-granular unknown_defaults). Non-claims — the balanced router profile was removed after a NULL measurement (p=0.81, n=24); no full-tier recommendation exists; no cross-vendor lift is claimed.
- kind: quant
- evidence: docs/benchmark.md#REPLICATION FAILED
- status: backed
- last_verified: 2026-07-07

### claim: downshift-cost-reduction
- claim: On the READ-ONLY FAN-OUT slice family, tier-downshifted subagent dispatch (lite/haiku vs session-tier-proxy sonnet) nets a ≥30% USD-weighted token-cost reduction at held quality — measured 2026-07-08 (n=10 paired live dispatches, 20 telemetry lines): 10/10 exact-match on BOTH arms, 29.4% fewer raw tokens, 76.5% USD-weighted cost reduction at the 3x haiku↔sonnet price ratio. FAMILY-SCOPED — the mechanical-edit family is unmeasured and its downshift (incl. the deferred tier downgrades of existing units) stays gated. Negative control held: an open-ended synthesis/unknown slice never resolves below the session tier (inferSliceTier → medium/inherit, never lite).
- kind: quant
- evidence: internal/bench/routing-downshift/results-2026-07-08.md#FAMILY-SCOPED PROVE
- status: backed
- last_verified: 2026-07-08

### claim: eval-coverage-ratcheted
- claim: Behavioural-eval coverage is measured per tier and CI-ratcheted so it can only rise; the current coverage and its gap are published, never implied as "264 evaluated skills".
- kind: qual
- evidence: exec:skill_eval_coverage --check -> 0
- status: backed
- last_verified: 2026-07-08

### claim: domain-soundness-scoped
- claim: The non-coding domain skills (finance/founder/ops/content) are forged on TS/PHP and labeled unvalidated until they pass a sourced domain-truth fixture; no public prose implies proven domain correctness, and the validated count is CI-ratcheted.
- kind: qual
- evidence: exec:domain_soundness_status --check -> 0
- status: backed
- last_verified: 2026-07-08

### claim: domain-soundness-validated-count
- claim: The validated non-coding domain-skill count is pinned and CI-ratcheted at a maintainer-set floor (9 of 20 default-surface skills carry a sourced `evals/domain-truth.json` fixture at pin time, 2026-07-11 — 5 deterministic, keys from cited formulas; 4 rubric, criteria matching a named external practice); the floor only rises via a maintainer `--write-floor` after a new sourced fixture lands.
- kind: quant
- evidence: exec:domain_soundness_status -> 0
- status: backed
- last_verified: 2026-07-11

### claim: bus-factor-tracked
- claim: The release process is documented as an inheritable runbook + succession doc, and the project's bus-factor (trailing-90-day distinct human reviewers) is tracked and reported truthfully — currently 1, not implied to be more.
- kind: qual
- evidence: docs/succession.md#trailing 90 days
- status: backed
- last_verified: 2026-07-09

### claim: second-brain-recall-lift
- claim: On a deterministic multi-session recall corpus, the memory substrate produces a measured, placebo-controlled recall lift — memory-on 27/27 vs no-memory 10/27 and vs equal-byte placebo 9/27 (claude-haiku-4-5, n=9 tasks x 3 seeds, sign test p=0.031 for BOTH pairings). Scoped honestly: this is the context-value upper bound (perfect retrieval on a one-fact-per-task corpus), not retrieval precision under a large store.
- kind: quant
- evidence: internal/bench/reports/second-brain-delta.json
- status: backed
- last_verified: 2026-07-09

### claim: lexical-ranking-lift
- claim: A hand-rolled, dependency-free BM25 + trigram lexical index resolves the "recalls but does not rank" gap: on the retrieval-precision corpus (9 keyword-overlapping-confuser tasks) it drives the mean top tie-set from 3.333 (the `_score` bucket scorer) to 1.0 — every needed decision uniquely top-ranked — with precision@1 and precision@5 unchanged at 1.0. Method: deterministic, model-free re-ranking of the SAME retrieved entry set; both scorers measured over the identical store via `measure_lexical_ranking.ts`. Cross-artefact note (2026-07-25): this baseline (3.333) is the value in THIS claim's own artefact and is cited correctly, but the retrieval-precision artefact records 4.111 for the same scorer on the same corpus — two bench scripts disagree. The lift direction (ties collapse to 1.0) holds under either baseline; the discrepancy itself is unresolved and recorded rather than smoothed.
- kind: quant
- evidence: exec:measure_lexical_ranking -> 0
- status: backed
- last_verified: 2026-07-09

### claim: context-token-reduction
- claim: A MEASURED-BUT-NOT-SHIPPED experiment — the thin rule projection reduced eager rule load 78,513 → 13,881 GPT-tokens (whole always-loaded projection 98,529 → 33,897, ~65.6%), but FAILED the quality gate (thin win-rate 36.2% vs required 48%) and does not ship; it un-defers only behind `discipline_profile: essential`. Shipped behavior does NOT include this reduction. Method: `agent-config benchmark` over the pinned token baseline; the baseline is the honest "what the user pays if everything loads eagerly", NOT a synthetic full-corpus strawman (council Q4); quality gate per the Phase-0 paired judge run.
- kind: quant
- evidence: internal/bench/reports/token-baseline.json#eager_rule_load
- status: backed
- last_verified: 2026-07-12

### claim: ledger-exec-verifiability
- claim: NONE of the backed ledger claims are machine-re-verifiable today — every evidence pointer is checked for existence (file present, substring present, URL carries a date), never for truth, so a claim pointing at a stale artefact stays backed indefinitely. A measured minority COULD carry a re-executing `exec:` form, clearing the >= 10 pp threshold that was pre-registered before the count was taken, which is why that form is scheduled rather than assumed. The rest cannot: paid or stochastic benchmark runs no CI job can re-derive, and prose contracts. Exact counts live in the evidence file and are NOT restated here on purpose — this entry hard-coded its denominator twice and drifted within a day both times (25 when the ledger held 26, then 26 when it held 27) while CI stayed green, because the pointer resolved. `check_claims` now compares the stored denominator against the live ledger and fails on divergence. A number a human retypes on every ledger edit will drift; the fix was to stop retyping it.
- kind: quant
- evidence: internal/reports/exec-evidence-feasibility.json#"exec_feasible"
- status: backed
- last_verified: 2026-07-25

### claim: enforcement-coverage-resolved
- claim: 14 of 111 governed rules (12.6%) carry a backstop that fails a CI build. The number is RESOLVED, not declared — a `validator:` counts only when the script exists AND a GITHUB WORKFLOW reaches it (transitively, so a sub-check under a wired umbrella counts), and a hook registered `fail_closed: false` resolves to `observer`, never `validator`. The figure was 14 before this correction too, and it was wrong: the resolver treated `taskfiles/` and `.github/workflows/` as one corpus, so "named in a taskfile" counted as blocking — while NO workflow invokes `task ci`, `ci-strict`, or `ci-fast`. Nine of the thirteen validators only ran when a human typed the command. Split into `validator` (CI runs it) and `validator-local` (only a taskfile does), the honest figure was 5 of 107 at the time; wiring the nine into `rule-backstops.yml` returned it to 14, this time meaning what the headline says. `local_only` is now 0 and is ratcheted, so a gate cannot drop back out silently. Wiring them also surfaced that FIVE were already failing invisibly, 37 findings deep. Those are now CLEARED: the baseline in `rule-backstop-debt.json` stands at 0, so the ratchet enforces rather than tolerates. Roughly two thirds of the 37 were never violations — the gates were misreading allowances their own rules already grant (license-required attribution, multi-stack peer examples), which is the same class of defect one level down. 88 rules declare nothing and count as uncovered, not excluded (the two scale/history pack rules ship enforced by `lint_persistence` in consumer CI, which this resolver — scoped to THIS repo's workflows — correctly does not count).
- kind: quant
- evidence: exec:check_enforcement_coverage --check -> 0
- status: backed
- last_verified: 2026-07-25

### claim: skill-count
- claim: 286 skills.
- kind: quant
- evidence: exec:check_artefact_count_messaging -> 0
- status: backed
- last_verified: 2026-07-08

### claim: command-count
- claim: 192 commands.
- kind: quant
- evidence: exec:check_artefact_count_messaging -> 0
- status: backed
- last_verified: 2026-07-08

### claim: rule-count
- claim: 111 governed rules.
- kind: quant
- evidence: exec:check_artefact_count_messaging -> 0
- status: backed
- last_verified: 2026-07-08

### claim: host-agent-count
- claim: 23 host agents are detected and inventoried; 20 receive a written config surface (18 projection + 1 plugin + 1 bundle target) and 3 are export-only (aider, zed, jetbrains). The count is enforced, not asserted — `knownToolIds()` is pinned at 23 by a test whose assertion literal IS the number, and `src/config/surface-matrix.yml` is held in set-equality with the installer's own user-scope path map by `lint_surface_matrix`, so a host added to one and not the other fails the build. This entry stood `unbacked` while naming its own unblocking condition ("once `surface-matrix.yml` exists, bind the count to that file and flip"); the condition was met and nothing fired, so the shipped figure stayed "7+" — understating real coverage by 3x.
- kind: quant
- evidence: exec:vitest run tests/install/toolDetection.test.ts -> 0
- status: backed
- last_verified: 2026-07-25

### claim: provenance-detector-transformation-sensitivity
- claim: On the frozen synthetic provenance corpus (24 seeded samples across three transformation depths + 12 independently authored controls, 18 TS / 18 PHP), the offline deterministic layer (jscpd token-clone scan) detects verbatim and rename-only copies at the Phase-0 measured rate with a bounded false-positive rate on the independent controls. SCOPE BOUND, stated before any run: this measures TRANSFORMATION-DEPTH SENSITIVITY and FP behaviour only. It does NOT measure recall against SCANOSS's real-OSS knowledge base — the corpus is synthetic-canonical (independently authored algorithm shapes, never upstream copies), so no sample is indexed in any KB and a KB lookup would return zero hits for reasons that say nothing about the detector. Real-KB recall requires a second, real-snippet corpus and is explicitly unmeasured here.
- kind: quant
- evidence: PRE-REGISTERED 2026-07-28 BEFORE the S0.3 baseline run (road-to-provenance-and-license-governance Phase 0; corpus frozen at content-sha256 dbbc84a7325e4fa38483ba05d35d9c0c98fa822ae25d873bd5efbafaf2534bb3 over internal/bench/provenance/, 36 files). Thresholds fixed BEFORE data, per the roadmap's S0.2 and its denominator fix: (1) detector recall on the verbatim+rename-only subset >= 10/16 (8 verbatim + 8 rename-only); (2) false positives on the 12 independent controls <= 1/12; (3) rename-only samples MUST hit (principle 6 — laundering by rename cannot clear a hit); (4) structural-rewrite samples form the residual class and their recall feeds the Phase-5 drop gate (>= 21/24 on the full seeded corpus DROPS Phase 5). The floor is a GO/NO-GO gate for building the CI layer, never the marketed capability — the marketed capability is the measured rate published per S3.1/S3.3 with the scope bound above co-located. HONEST-NULL consequence (K1): thresholds missed => no deterministic-gate claim ever, the behavioural layer ships alone, null published; no silent threshold adjustment.
- status: unbacked
- last_verified:

### claim: provenance-gate-effectiveness
- claim: AC's provenance system is a license policy derived from the target repo's own detected license (`detect_target_license.ts` + a closed compatibility matrix), a strict own-records ledger linter (`lint_provenance.ts`, wired into `ci`/`ci-strict` STRICT from day one) that fails a deny-class or unknown-license borrow entry, a missing transformation_note, or a rename-only-phrased transformation_note, and an on-demand `license-compliance-audit` skill a human invokes deliberately. It is NOT a similarity-detection gate: no scanner runs in CI against changed-file content, it does NOT and cannot certify absence of copying (no tool sees model training data), and it does NOT detect rename-only laundering — the ledger's transformation_note check is the anti-launder control on OUR OWN RECORDS, not a backstop to a detector that independently catches it.
- kind: qual
- evidence: PRE-REGISTERED 2026-07-28 (road-to-provenance-and-license-governance Phase 3, S3.1 — registered AFTER Gate G0's verdict, so this claim's text already reflects the re-scope rather than describing a capability that was later cancelled; the original S3.1 draft text ("AC's provenance gate detects seeded verbatim and rename-only OSS copies at the Phase-0 measured rate") is FALSE post-G0 and is not reused). G0 honest-null context (see `provenance-detector-transformation-sensitivity` for the pre-registered thresholds): the deterministic scan layer (jscpd offline + SCANOSS online) measured, on the frozen synthetic corpus, verbatim+rename-only recall 12/16 (union) and false positives 2/12 (union) — missing BOTH the recall and FP thresholds — with SCANOSS alone recalling rename-only samples 0/8. Council decision 2026-07-28 (K1 literal, Option A): no `lint_code_provenance.ts` ships in ANY form in CI, not even advisory — the scan capability exists ONLY as the `license-compliance-audit` skill (src/skills/license-compliance-audit/), invoked deliberately by a human, never wired into any pipeline. Falsification criteria fixed at registration: (1) any deny-class or unknown-license ledger entry passes `ci` (a `lint_provenance.ts` regression); (2) any ledger entry missing a `transformation_note` passes `ci`; (3) any rename-only-phrased `transformation_note` (the 15-phrase rejection list) passes `lint_provenance.ts`; (4) any user-facing surface asserts or implies a CI-facing similarity/duplication detector exists, or omits the co-located scope statement (S3.2/S3.3 global consequence bound, enforced by `lint_provenance_vocabulary.ts`). Backing trigger: (a) >=1 real (non-empty, non-fixture) ledger entry survives `lint_provenance` in a merged PR with a substantive transformation_note, AND (b) the Phase-4 dogfood self-audit (S4.1) publishes its findings against this repo itself, whatever the outcome. Part (b) is already satisfied — `internal/bench/provenance/reports/self-audit-2026-07-28.md` published a headline finding that 551 of 552 online-scanner hits on this repo's OWN source were self-matches against its own published releases, a third independent argument for the G0 verdict and evidence the corpus's 2/12 false-positive rate understated the real-world surface. Part (a) is NOT yet satisfied — `provenance/borrows.jsonl` holds zero entries — so this claim stays unbacked until a real borrow lands and clears the ledger.
- status: unbacked
- last_verified:

### claim: lean-init-cost-reduction
- claim: On the LOOKUP-CLASS task family ONLY (definition-location, reference/call-site, string-existence, report-run — `classifyLookup` in `src/scripts/_lib/auto_dispatch.ts`), routing to deterministic primitives instead of subagent spawns nets a ≥90% token reduction at held answer quality vs the observed subagent baseline (live 2026-07-28 evidence: 280–327k tokens per lookup worker; the 12-golden primitive run answered all 12 for <1.6k tokens total, 12/12 correctness match).
- kind: quant
- evidence: PRE-REGISTERED 2026-07-28 (road-to-lean-agent-init Phase 3 — registered BEFORE any savings number is cited anywhere; family-scoped, modeled on `downshift-cost-reduction`; quality definition reused from the correctness-comparison acceptance, no second truth). Falsification criteria fixed BEFORE data: (1) correctness floor — primitive answer ≡ agent answer on the golden corpus (`internal/bench/lean-init/results-2026-07-28.md`, 12/12); ANY mismatch on a routed real task recorded via `correctness_match: false` counts against the claim; (2) negative control — a non-lookup task never routes to a primitive (`LOOKUP_CORPUS` lk-n1..n4, FP=0); (3) cost metric — read from `agents/runtime/state/audit/*.jsonl` orchestration lines tagged `origin: lean-init-2026` with `lookup_class != null`, comparing `route_taken: primitive` token cost against `route_taken: subagent` lines of the same class (n and family scope stated at backing time); (4) segregation — lines carry `origin: lean-init-2026` so the `road-to-orchestration-scope-decision` sample stays uncontaminated (council Q5, 2026-07-28). PROVE → flip to backed for the lookup family only; DROP → honest null, primitives stay (correctness-validated) but no savings number is ever cited.
- status: unbacked
- last_verified:

### claim: orchestration-dispatch-net-win
- claim: On the ordered-refactor + competitive-impl families (`orch-02`, `orch-03`), contract-governed subagent dispatch nets ≥15% token-or-wall reduction at non-regressed quality vs single-agent execution.
- kind: comparative
- evidence: PRE-REGISTERED 2026-07-11 (road-to-orchestration-scope-decision Phase 1 — no goalpost-moving after the numbers land). Falsification criteria fixed BEFORE data: (1) held quality is deterministic, scored by `src/scripts/check_quality_regression.ts` thresholds — a token/wall win that degrades output below the regression threshold FAILS the claim; (2) negative control — `pv-02-negative-control` must NOT trigger dispatch (a classifier that fires on everything is a cost leak, not a win); (3) win metric — ≥15% reduction in token-or-wall on `orch-02`+`orch-03` vs the single-agent baseline, read from `agents/runtime/state/audit/*.jsonl` orchestration lines through `gateVerdict()` / `resolveShippedDefault()`. Binds to a resolving report once ≥20 real `ask`-mode telemetry lines exist (Phase 2 — maintainer-run; the corpus `--run` agent-spawn is gated out of auto-mode). PROVE → flip to backed for the proven family only; DROP → renewed honest-null, keep `ask`, demote orchestration from the public value proposition.
- status: unbacked
- last_verified:

### claim: utilization-window-decidability
- claim: The 2026-07-12 engagement observation window terminates in a DECIDABLE portfolio statement — at window close it either names >=1 concrete keep/cut/review decision per artifact kind, or records a pre-registered honest null (underpowered after one 30-day extension).
- kind: comparative
- evidence: PRE-REGISTERED 2026-07-12 (road-to-feedback-8.11-2 Phase 0 — no goalpost-moving after the numbers land; criteria at `docs/design/utilization-window-criteria.md`). Floor fixed BEFORE data: >=100 task boundaries AND >=2 hosts (or the documented degraded form) AND >=45 elapsed days; decision rules D1 (loaded-never-consulted -> retirement-candidate list), D2 (consulted-never-applied <10% applied-ratio at >=5 consultations -> trigger-review queue), D3 (above floor -> >=1 named decision per kind or a recorded why-not), D4 (below floor after one extension -> honest null, lifecycle/ledger gates stay closed). Kernel + safety floors exempt by construction.
- status: unbacked
- last_verified:

### claim: council-vs-solo-baseline
- claim: On a pre-registered corpus of ≥30 real decisions (≥8 per impact class), full-council debate produces higher blind-judged verdict quality than a single strong model on at least one identifiable decision subset, at a cost multiple the subset's stakes justify.
- kind: comparative
- evidence: PRE-REGISTERED 2026-07-12 (road-to-feedback-8.11 Phase 3 — no goalpost-moving after the numbers land; design at `docs/design/council-vs-solo-baseline.md`). Falsification criteria fixed BEFORE data: (1) quality = blind post-hoc grading against known ground-truth dispositions, two blind judges, admissible only at Cohen's κ ≥ 0.60 (reuse `check_quality_regression.ts` kappa machinery); (2) the five feedback-proposed admission dimensions are recorded per decision AT pre-registration, so "≥2-of-5" is a testable post-hoc correlate, never a pre-imposed gate; (3) NO lift on any subset (overall, per impact class, per dimension stratum) → honest null, deliberation-protocol phases stop (maintenance-only), recorded in road-to-opt-council-deliberation; lift on a subset → admission criteria derived FROM that subset's characteristics. Execution is spend-gated (user confirms rendered estimate in-session); shadow-log was absent/empty at design time — zero prior council-vs-solo data exists.
- status: unbacked
- last_verified:

### claim: humanizer-tell-reduction
- claim: On the fixture corpus (n = 20 before/after pairs, 16 length-controlled within ±25%), the humanizer pass removes every mechanically detected AI-writing tell (mean hard hits 0.9 → 0, cluster score 53.97 → 0 per 500 words, dash density 9.22 → 0), and a blind judge (claude-sonnet-4-5, deterministic per-pair A/B seed) preferred the humanized text in 16/16 length-controlled pairs. Scope note — the "before" fixtures were deliberately tell-seeded, so this measures seeded-tell removal on a self-constructed corpus, NOT real-draft improvement; real-world lift is unmeasured until step 4b has processed real ghostwriter drafts (see the road-to-humanizer-hardening live-usage blocker).
- kind: quant
- evidence: internal/bench/reports/humanizer-v1.md#prefers the humanized text
- status: backed
- last_verified: 2026-07-11

### claim: positioning-honest-nulls
- claim: We publish our own measured null results and retire or constrain features when the evidence does not support them. Deliberately falsifiable — every published null links the run that produced it; find one that does not resolve and this line updates.
- kind: qual
- evidence: docs/benchmark.md#honest
- status: backed
- last_verified: 2026-07-28

### claim: persona-identity-placebo-null
- claim: On a 12-fixture option-decision corpus (3 arms × 2 providers, blind rubric judge claude-opus-4-8, pre-registered hypotheses), famous-figure identity framing added nothing beyond the underlying method text (method 5.04 vs figure 4.88, Δ=0.17, sign-test p=0.607), and provider diversity moved judged quality ~15× more than persona identity (provider Δ=2.58 vs identity Δ=0.17); the whole persona layer lifted only +0.08 over bare prompts. Honest null — persona panel-mode stays CUT, evidence-closed.
- kind: quant
- evidence: internal/bench/reports/persona-placebo.json#honest-null
- status: backed
- last_verified: 2026-07-12

### claim: retrieval-substrate-live-pass
- claim: On the live end-to-end retrieval benchmark (9 tasks × 3 arms × 3 seeds on claude-haiku, fixture store with keyword-overlapping confusers), the memory retrieval substrate scored precision@5 = 100% (9/9) with 100% poisoned-entry rejection, and the retrieval-on arm passed 27/27 model-scored tasks vs 2/27 with retrieval off and 4/27 with a placebo injection. Known limit stays published: mean tie-set 4.111 means top-k ties break by store order, not relevance (the ADR-116/FTS5 signal). SOLE RECORD for this artefact as of 2026-07-25: a second entry (`second-brain-retrieval-precision`) described the same measurement from the precision angle and had drifted to 5/27, 5/27 and tie-set 3.3 — figures absent from the shared artefact. Two entries over one artefact is what allowed them to disagree while both resolved, so the pair was folded into this one.
- kind: quant
- evidence: internal/bench/reports/second-brain-retrieval.json#retrieval-on
- status: backed
- last_verified: 2026-07-25

### claim: wedge-hollow-detection
- claim: On the A3 orchestration eval (deterministic verify, measured token deltas), the production-validator subagent returned the correct verdict on both fixtures — NOT READY with the exact `file:line` citation on a planted hollow implementation, READY with zero spurious findings on the clean control — while consuming ~45k fewer tokens than the inline-host baseline on each task. Scope: two planted fixtures on a Claude Code host, not a broad hit-rate.
- kind: quant
- evidence: internal/bench/orchestration/pv-a3-results.md#token_delta_provenance: measured
- status: backed
- last_verified: 2026-07-20

### claim: cross-model-parity-count
- claim: The first cross-vendor parity pass (5 orchestration-corpus tasks × 2 vendors × 3 repeats, identical prompts via the council transport, $0.16) measured real per-host finding-count differences — claude-sonnet-4-5 surfaced ~2× the findings of gpt-4o on the multi-file analysis task (median 11 vs 5) while both vendors were identical on the planted hollow-implementation task (2 vs 2) and perfectly silent on the clean-code negative control (0 vs 0, no spurious findings). The per-task `finding_floor` values are calibrated from the cross-host lower envelope and the gate is armed.
- kind: quant
- evidence: internal/bench/reports/parity-count.json#min over hosts of median
- status: backed
- last_verified: 2026-07-12

### claim: team-defect-finding-null
- claim: On the pre-registered 12-fixture defect-finding corpus (three arms, deterministic file-level recall, codex reviewer gpt-5.5), the cross-model team-review arm produced NO recall lift over single-model self-review — all three arms recalled every planted defect (Δ = 0, H1 not met). Honest null, ceiling-limited (recall 1.00 everywhere: the seeded defects are too obvious to discriminate the arms on recall); the only non-null signal is a single self-review false positive on the controversial-but-correct control vs 0 for team/council. No cross-model quality/lift claim binds; team mode stays workflow-value-only. Re-open: a judge-survivable-subtlety corpus or a new model generation.
- kind: quant
- evidence: internal/bench/reports/defect-finding.json#honest_null
- status: backed
- last_verified: 2026-07-20

### claim: adversarial-council-finding-coverage
- claim: On the residual defect pool (planted defects that survive a single strong cross-model judge), an adversarial panel of >=2 distinct-vendor skeptics finds materially more residual defects than that single judge — relative residual-recall lift >= +25% AND absolute >= +8 percentage points — at a false-positive rate on a controversial-but-correct control no worse than the single-judge baseline (within noise). Scope: finding coverage, NOT decision quality (the separate, unbacked council-vs-solo-baseline question). Pre-registered; honest-null (either threshold missed or FP worse) keeps the surface off by default permanently.
- kind: quant
- evidence: docs/benchmark.md#adversarial-verification-council
- status: unbacked
- last_verified: 2026-07-21
- resolution: HONEST-NULL (resolved, not pending). Registered cross-vendor run 2026-07-21 on the curated judge-survivable corpus (internal/bench/adversarial-council/): on the judge-passed residual, the 2-vendor skeptic panel (anthropic+openai) matched the single skeptic exactly (residual recall 0.6 = 0.6, zero lift — the second vendor's residual catches were a strict subset of the first), at a 100% false-positive rate on the controversial-but-correct controls under the adversarial-skeptic posture. Both recall thresholds missed → honest-null → Mode 9 surface stays default-off permanently (like recursive-verification). Reproducible artifact: internal/bench/adversarial-council/runs/. Note: an initial run via `council_cli run` was REJECTED as a measurement artifact (that transport imposes multi-round peer-review + prose output, defeating the independent-skeptic + JSON-scoring protocol) — the valid run uses direct independent per-vendor client calls.

### claim: gated-platform-reads
- claim: A credential-free prescription layer reads content the host's own web tools cannot fetch at all — Reddit thread text (Atom feeds) AND comment ranking plus reply nesting (server-rendered HTML), and a single named tweet (the platform's own oEmbed endpoint). Measured 2026-07-25 from a residential network against a pre-registered 6-task-per-channel set with a native control and thresholds frozen before the run: reddit tier 1 6/6, reddit tier 2 6/6, twitter-oembed 6/6, native 0/6 on both Reddit tiers. Zero credentials, zero resident processes, zero auto-installs. Scope bounds that travel WITH the claim: (a) the twitter gap is narrower than 6/6 suggests — native also passed 2 of those 6 via third-party mirrors, so the channel earns its place only on tweets nothing mirrors; (b) reddit tier 2 is on an announced closing path and ships with a kill-switch keyed on an OBSERVED login wall; (c) youtube-transcripts is PARKED, not shipped — its backend is human-installed by contract and was never exercised; (d) residential network is load-bearing, and CI is explicitly not a bench environment.
- kind: quant
- evidence: docs/benchmark.md#ship-gated-reach
- status: backed
- last_verified: 2026-07-25

### claim: install-audit-clean
- claim: A fresh registry install of this package carries zero high/critical npm-audit findings on the runtime dependency tree (0 vulnerabilities total at last verification), gated on every PR and every release PR.
- kind: quant
- evidence: .github/workflows/release-validation.yml#npm audit --omit=dev --audit-level=high
- status: backed
- last_verified: 2026-07-27

### claim: hook-dispatch-latency
- claim: Hook dispatch runs as one precompiled node process with all concerns in-process — measured p50 76–103 ms / p95 81–103 ms per event across GitHub-hosted CI runners (shared-runner wall-clock varies ±23% run-to-run; a darwin dev machine measures ~70-90 ms) against the pre-registered budget (pre_tool_use p95 <= 150 ms, any event <= 250 ms), down from ~1.6 s p50 on the retired CLI-to-bash-to-tsx per-concern-respawn chain; the bench harness and its regression gate run in CI.
- kind: quant
- evidence: docs/hook-latency.json#pre_tool_use
- status: backed
- last_verified: 2026-07-27

### claim: default-install-context-cost
- claim: The scoped-projection default for new installs ships 215 of 286 skills (untagged core plus engineering/maintainer packs), an approximately 25% reduction of the skill-catalog surface (a reduction of 71 projected entries; the token figures measured 2026-07-27 at the then-283-skill catalog were about 577k to about 428k approximated tokens and are NOT rescaled here), with the counting method pinned in the benchmark doc.
- kind: quant
- evidence: docs/benchmark.md#Default-install context cost
- status: backed
- last_verified: 2026-07-27

### claim: code-graph-retrieval-null
- claim: On the pre-registered 2-arm retrieval benchmark (18 hand-verified code-structure questions across 3 real repos, ground truth hash-bound before the run, deterministic, zero model calls), the native code graph scored mean recall 0.365 vs grep 0.797 on the 15 graph-shaped questions (delta -43.2 pp against a pre-declared +10 pp win threshold) and 0.111 vs 0.833 on the negative controls. HONEST NULL — measured root cause: TS arrow-function exports produce no symbol nodes (170 TS vs 13,428 PHP symbol nodes on same-shaped repos) and string-keyed dynamic consumers have no static edge. Consequence bound: code_graph.enabled stays false permanently; deprecation at the next major, removal the major after unless external evidence appears.
- kind: quant
- evidence: internal/bench/reports/code-graph-vs-grep.md#Verdict — NULL, decisively
- status: backed
- last_verified: 2026-07-28

### claim: cross-source-consistency-precision
- claim: On the shared 30-fixture false-premise corpus (20 positives across the four discrepancy classes text-image / silent-needed / spec-code / intra-ticket + 10 negative controls), the default-on `cross-source-consistency` rule surfaces real discrepancies at >= 85% precision with an unnecessary-ask (over-firing) rate <= 5% on the negative controls.
- kind: quant
- evidence: PRE-REGISTERED 2026-07-28 (road-to-feedback-9.2.0-followups Phase 1 — no goalpost-moving after the numbers land). Falsification criteria fixed BEFORE data: (1) fixtures + expected actions are pinned in `internal/bench/corpora/honesty-false-premise.yaml` (shared with the honesty bench, extended-not-forked); (2) the scorer is `src/scripts/bench_cross_source_eval.ts` (ask|proceed|warn classification, forbidden-assumption + over-firing checks) — precision = correctly-surfaced discrepancies / all surfaced; over-firing = asks on negative controls / negative controls; (3) the run needs real model responses per fixture (paid, maintainer-gated spend) — this entry stands as documented debt until that run lands; (4) HONEST NULL consequence bound: precision < 85% or over-firing > 5% → loosen the rule's default (`consistency.cross_source: on` → `auto`) or tighten its confidence tiers — never silently keep firing. This binds the weaker-evidenced default-on rule to a measurement like every other default-flip.
- status: unbacked
- last_verified:

### claim: encoding-floor-text-layer-only
- claim: The retrieval sanitize floor covers the TEXT layer only, by construction — never file or network channels (image / audio / PDF / DNS / TCP / file-metadata steganography) and never semantic evasion (word choice, phrasing, garden-path constructions, word-order permutation). On the frozen 653-entry corpus it strips or flags 99.00% of in-scope positives (100.00% on the unambiguous zero-width / bidi / variation-selector classes) at a 0.00% false-positive rate over 353 real in-repo negatives, with zero added model spend and 0.018 ms p95 per message. Exactly ONE of the seven added channels removes bytes; the other six report and pass the text through unchanged — this is NOT a claim to block steganography.
- kind: quant
- evidence: agents/evidence/reports/encoding-floor-measurement.md#Selected branch: ADOPT
- status: backed
- last_verified: 2026-07-29

### claim: encoding-corpus-scope-guard
- claim: The text-layer-only boundary above is machine-enforced, not asserted: a scope-guard test fails if any corpus entry declares a non-text layer, and that guard is itself falsified by a test that splices in a `layer: file` PNG-metadata fixture and requires the guard to fail. The corpus is sha256-frozen and was committed BEFORE any detector existed, so no detector was tuned against it.
- kind: qual
- evidence: tests/scripts/encoding_corpus.test.ts#FAILS when a deliberately out-of-scope fixture is added
- status: backed
- last_verified: 2026-07-29
