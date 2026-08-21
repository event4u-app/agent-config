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
- `status: resolved-null` entries are **closed, not debt**: the question was
  asked, the pre-registered threshold was missed, and the answer is in. They are
  not `backed` (nothing was demonstrated) and they are not inventory (there is
  nothing left to bind). Filing a finished null as indefinite pending debt
  overstates what is open and leaves the claim quietly available to be
  re-argued; the honest lifecycle ends here. Same enforcement as `unbacked`:
  a `resolved-null` claim may not carry a marker in public prose.

## Entry schema

```
### claim: <kebab-id>
- claim: <the sentence, roughly as it appears publicly>
- kind: quant | qual | comparative
- evidence: <pointer>            # see grammar below
- status: backed | unbacked | resolved-null
- last_verified: <YYYY-MM-DD>
- superseded_by: <kebab-id>      # optional; resolved-null entries only
```

**`superseded_by` — the forward link out of a closed question.** The
retire-never-delete lifecycle keeps a `resolved-null` readable forever, which is
the point: a null nobody can find gets quietly re-argued. What it lacked was the
other direction — a reader who arrives at the closed entry has no way to learn
that the same question was later reopened **by a different mechanism**. This
optional field is that link.

Three rules, all machine-checked by `check_claims`:

- It may name only an id that exists in this ledger. A dangling successor sends
  the reader nowhere, which is worse than no link.
- It is only meaningful on `resolved-null`. On a `backed` or `unbacked` entry it
  claims a closure that never happened, and is rejected.
- It never points at its own entry.

It is a *successor*, not a *citation*. A later claim that merely references a
null in its reasoning — as `worker-capsule-trigger-arm` references
`orchestration-observed-dispatch-cost` — is not a successor: the question was
not reopened, it was used as a prior. Use the field only when the new claim asks
the **same** question by other means. No entry carries one today; the field is
here for the first reopening, and the gate is here so that it cannot be added
wrong.

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
- evidence: exec:vitest run tests/lib/json_pointers.test.ts -> 0
- status: backed
- last_verified: 2026-08-11

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
- claim: The release process is documented as an inheritable runbook + succession doc, and the project's bus-factor (trailing-90-day distinct human reviewers) is tracked and reported truthfully — currently 1, not implied to be more. The doc separately reports the distinct MERGER count (2, one of them an unreviewed self-merge) so the reviewer figure cannot be inflated by conflating the two.
- kind: qual
- evidence: docs/succession.md#trailing 90 days
- status: backed
- last_verified: 2026-08-20

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
- claim: 15 of 119 governed rules (12.8%) carry a backstop that fails a CI build — `blocking` read live from `internal/reports/enforcement-coverage.json` on 2026-08-12, which is the file to quote rather than a figure copied out of a release review. Two denominators are in play and conflating them is the trap: 117 is the governed-rule count (enforced by the counts updater), while that report's `summary.total` is **114**, because the resolver is scoped to THIS repo's workflows and correctly excludes the two scale/history pack rules named at the end of this entry — so the same 15 rules read as 13.2% in-scope. Blocking itself rose 14 → 15 since the 2026-07-25 measurement, and `undeclared` is 86 in the 114-scope (89 in the 117-frame). The five reviews of the 9.30→9.35 span cite 12.9% and are right; their companion claim that "the 84 baseline rules are unchanged 84" matches this report in neither frame. Their substantive point stands and is the half worth keeping — the ratio has not risen across five releases, because the ratchet prevents regression and does not raise the level. The number is RESOLVED, not declared — a `validator:` counts only when the script exists AND a GITHUB WORKFLOW reaches it (transitively, so a sub-check under a wired umbrella counts), and a hook registered `fail_closed: false` resolves to `observer`, never `validator`. The figure was 14 before this correction too, and it was wrong: the resolver treated `taskfiles/` and `.github/workflows/` as one corpus, so "named in a taskfile" counted as blocking — while NO workflow invokes `task ci`, `ci-strict`, or `ci-fast`. Nine of the thirteen validators only ran when a human typed the command. Split into `validator` (CI runs it) and `validator-local` (only a taskfile does), the honest figure was 5 of 107 at the time; wiring the nine into `rule-backstops.yml` returned it to 14, this time meaning what the headline says. `local_only` is now 0 and is ratcheted, so a gate cannot drop back out silently. Wiring them also surfaced that FIVE were already failing invisibly, 37 findings deep. Those are now CLEARED: the baseline in `rule-backstop-debt.json` stands at 0, so the ratchet enforces rather than tolerates. Roughly two thirds of the 37 were never violations — the gates were misreading allowances their own rules already grant (license-required attribution, multi-stack peer examples), which is the same class of defect one level down. 86 rules declare nothing and count as uncovered, not excluded (the two scale/history pack rules ship enforced by `lint_persistence` in consumer CI, which this resolver — scoped to THIS repo's workflows — correctly does not count).
- kind: quant
- evidence: exec:check_enforcement_coverage --check -> 0
- status: backed
- last_verified: 2026-08-12

### claim: skill-count
- claim: 290 skills.
- kind: quant
- evidence: exec:check_artefact_count_messaging -> 0
- status: backed
- last_verified: 2026-07-08

### claim: command-count
- claim: 200 commands.
- kind: quant
- evidence: exec:check_artefact_count_messaging -> 0
- status: backed
- last_verified: 2026-07-08

### claim: rule-count
- claim: 119 governed rules.
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
- status: resolved-null
- last_verified: 2026-07-28
- resolution: HONEST-NULL (resolved, not pending). K1 fired: the registered run measured verbatim+rename-only recall 12/16 (union) against a >= 10/16 floor that it met, but false positives 2/12 against a <= 1/12 ceiling that it missed, and SCANOSS alone recalled rename-only 0/8 against principle 6's must-hit requirement — so the gate thresholds were missed and the pre-registered consequence applies: no deterministic-gate claim ever, no `lint_code_provenance.ts` in CI in any form (council 2026-07-28, Option A). The measured rates are published with the run; the sibling entry `provenance-gate-effectiveness` carries the same numbers as its G0 context. Reclassified 2026-08-02 (road-to-release-shape-honesty Phase 3): the answer was in since 2026-07-28 and the entry stayed filed as pending debt, which overstated what is open.

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

### claim: orchestration-observed-dispatch-cost
- claim: On the OBSERVED production dispatch corpus (real historical `Agent` dispatches recorded in this repo's host transcripts), per dispatch-family, contract-governed dispatch nets a ≥15% median token reduction against a stated in-session baseline at non-regressed quality.
- kind: comparative
- evidence: PRE-REGISTERED 2026-08-07 (road-to-orchestrator-first-execution Phase 0 — written BEFORE the backfill extractor was built or any of its numbers were read; no goalpost-moving after the data lands). SIBLING, NOT A REPLACEMENT for `orchestration-dispatch-net-win`: that claim binds a PROSPECTIVE two-arm corpus run over `orch-02`/`orch-03`; this one binds the RETROSPECTIVE population of dispatches that already happened in production. Different populations — neither substitutes for the other, and a verdict on one is never reported as a verdict on the other. Falsification criteria fixed BEFORE data: (1) PER-FAMILY, never aggregate — `read-only-fanout`, `ordered-steps`, `competitive`, `verdict-judge`; a family with n<5 is reported UNDERPOWERED and is never merged into another family to reach n (the council's round-2 finding that eight dispatch templates were being treated as one hypothesis while the benchmark shows role-specific lift); (2) PROVENANCE HONESTY is a pass condition, not a footnote — the orchestrated side is `measured` (per-dispatch `totalTokens` from the transcript), the in-session counterfactual is NOT on disk and is `estimated` with its method named on the line; no line may report an estimated delta as measured, and any family whose verdict would flip on the choice of baseline method is recorded INDETERMINATE rather than as a win; (3) thresholds — PROVE at ≥15% median token reduction at non-regressed quality (`src/scripts/check_quality_regression.ts` thresholds); DROP at median `token_delta > 0` (delegation cost more); anything between is INDETERMINATE, and indeterminate is NOT a pass; (4) the NEGATIVE direction is pre-registered with the same force as the positive — if no family proves out, the recorded consequence is a renewed honest null, orchestration demoted from the public value proposition, and Phases 3–4 of the originating roadmap cancelled as `[-]`, never a re-scoped claim invented after the numbers; (5) power context recorded at pre-registration — the model-carried `orchestration_record` step captured 1 of 369 observed dispatches (0.3%), so any verdict resting on the PRE-backfill audit log is underpowered by construction and may not be cited for either direction. RESOLVED 2026-08-07 → HONEST NULL, no family proves out: `gateVerdict()`'s two inputs are both unmeasurable from this corpus — `net_win` needs a counterfactual that is not on disk (every family's verdict, and `resolveShippedDefault` itself, flips between `fail`/`ask` and `pass`/`on` on the choice of baseline method, which criterion (2) defines as INDETERMINATE), and `quality_held` needs paired outputs the single-arm corpus does not hold. Per criterion (4), Phases 3–4 of the originating roadmap are cancelled `[-]` and the orchestrator-first mode is not built on this evidence. The corpus DID settle three things without the counterfactual: 0.27% telemetry capture (370 dispatches, 1 recorded line), downshift not operating (27 of 39 metric-bearing dispatches resolved to an Opus tier, Haiku once, `resolveSubagentRouting` has zero production callers), and `competitive` absent from a month of production.
- evidence: internal/bench/orchestration/backfill-2026-08-07-verdict.md#honest null
- status: resolved-null
- last_verified: 2026-08-07

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

### claim: reference-loop-upgrade-value
- claim: The five mechanisms folded into `/analyze:reference-repo` (anchor table before fetch, bound-claim collision gate, interop probe, verdict convergence, bounded `--deep` tier) produce findings the pre-upgrade command structurally could not. Bar: EACH of the next two real reference analyses run under the upgraded command produces >= 1 interop-probe finding at file:line precision AND >= 1 bound-claim routing — both analyses, not one of two, because the claim is that the mechanisms fire reliably, not that they can fire.
- kind: quant
- evidence: PRE-REGISTERED 2026-08-12 (road-to-cross-repo-differential-loop Phase 6 — no goalpost-moving after the runs land). Falsification criteria fixed BEFORE data: (1) the comparison is against a shadow run of the pre-upgrade command text on the same reference, so "could not have produced" is decided by diffing two documents, not by assertion; (2) a finding counts only with a concrete file:line on OUR side — a probe recording `consumer not locatable` is an honest result but not a positive; (3) TIME BOUND: 180 days from merge — an event-bound measurement on a rare event is an unbacked row that never settles, so window expiry counts as the bar not cleared; (4) HONEST NULL consequence bound, asymmetric by construction: bar not cleared or window expired → the interop-probe, convergence and `--deep` mechanisms revert and the null is published; the anchor-table and bound-claim-gate mechanisms stay regardless, because they enforce ADR-211 C/D and the claims ledger — doctrine that already binds — rather than claiming new value. A measurement that never arrives therefore cannot leave the command worse than before the upgrade.
- status: unbacked
- last_verified:

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
- status: resolved-null
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
- claim: Hook dispatch runs as one precompiled node process with all concerns in-process, and the CI latency gate measures the REAL invocation path — the exact command hooks.json installs (bash wrapper + install-shape probes + dispatcher), via `bench_hook_latency --gate --via-cli`, whose per-event commands come from the same generator that writes hooks.json — not the bare bundle the pre-repair gate measured. The repair (road-to-hook-latency-repair) is pinned before/after on one machine in the committed baseline history: pre-fix CLI path pre_tool_use p95 164 ms → post-fix bundle-direct path p95 84 ms (darwin dev, warm cache, n=50 each; the pre-fix path measured ~450–500 ms/event on a 1-vCPU container). Budget re-derived 2026-08-19: pre_tool_use p95 175 ms (was 150), any event 250 ms on GitHub-hosted CI runners, both BLOCKING. The raise is measured rather than bent around a red check — 150 sat INSIDE the observed legitimate distribution (green main runs 115, 120, 146, 150, 150 ms; reds 151, 152, 152, 154 ms; a comment-only PR run at 157 ms) and failed 5 of 33 tests.yml runs on main over 2026-08-16..18, i.e. 15%, with hand re-runs as the standing workaround. The budget file records that distribution, the failure rate, the cited derivation rule and a revisit-if that routes the NEXT breach to the cause rather than to a third raise: a GREEN run whose p50 rises above 160 ms is the cost growing, not the runner. Down from ~1.6 s p50 on the retired CLI-to-bash-to-tsx per-concern-respawn chain.
- kind: quant
- evidence: docs/hook-latency.json#invocation_path
- status: backed
- last_verified: 2026-08-19

### claim: default-install-context-cost
- claim: The scoped-projection default for new installs ships 219 of 290 skills (untagged core plus engineering/maintainer packs), an approximately 25% reduction of the skill-catalog surface (a reduction of 71 projected entries; the token figures measured 2026-07-27 at the then-283-skill catalog were about 577k to about 428k approximated tokens and are NOT rescaled here). Both figures are generated, not typed: reproduce them with `./scripts-run src/scripts/count_scoped_projection`, which partitions the canonical skill catalog with the same predicate `install.ts` applies when it prunes a real tree.
- kind: quant
- evidence: exec:update_counts --check -> 0
- status: backed
- last_verified: 2026-08-02

### claim: scope-dedup-cold-start-reduction
- claim: Scope de-duplication of the rule projection removes 38.0% of the median cold-start payload (87,677 of 230,556 tokens) against a pre-registered 15% bar. CONDITION, inseparable from the number: that figure is FIXTURE-MEASURED on byte-identical global and project projections, and it is **currently unreachable for production installs** — the installer stamps ownership metadata (`package:` / `source_path:`) onto every installed rule unconditionally, so the two scopes are produced by two writers with deliberately different output, the byte-identity gate correctly refuses to dedup, and the recipient set is empty. The mechanism works; the saving is not realised by any consumer today.
- kind: quant
- evidence: agents/settings/contexts/cache-economy-refusals.md#Honest null — scope de-duplication is measured but
- status: backed
- last_verified: 2026-08-02

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

### claim: governance-aggregation-refusal-invariance
- claim: The council aggregation cannot be steered against a refusal. Pre-registered spike S0.1 measured that it WAS classification-steerable — `w_total` counted only members whose stance line parsed, so a refusal phrased as prose left the quorum and made consensus easier: steering margin 0.6667 (margin -0.25 parsed vs +0.4167 unparsed) with the outcome flipping from no-consensus to Adopt. High severity because the direction was the dangerous one. Fixed in the same change: a member who responded counts toward the quorum whether or not its stance parsed, and the post-fix steering margin is exactly 0. The divergence signal is an observation and is asserted never to reach the scoring path. No observed attack prompted this; the expected outcome was a null and it was pre-registered as such before the run.
- kind: quant
- evidence: internal/bench/reports/governance-invariants.json#s0_1_aggregation_steerability
- status: backed
- last_verified: 2026-08-02

### claim: governance-decomposition-effect-boundary
- claim: Pre-registered spike S0.2 measured that both of this package's fail-closed gates judged the shape of ONE action rather than the effect, so a sequence whose every step they allowed composed into the outcome they exist to prevent — leak count 2 of 2 gated outcomes, with all 4 single-step controls blocking correctly. Both were moved to the effect they govern. The positive control is `check_secret_leak`, which scopes to the cumulative diff against a base ref and therefore returned null before any fix — decomposition gains nothing against an effect-scoped gate. Scope bound, published rather than swept: `mv` / `chmod` / `rm` against `.git/hooks/*` still reach the first outcome and are asserted as an open gap, because recognising them would make a fail-closed guard a shell sandbox. Decomposition in this package is model-carried — there is no executable subagent dispatcher — so the measured layer is the PreToolUse hook layer; the 2026-08-02 council dissent on whether that is a faithful discharge is recorded in the spike header.
- kind: quant
- evidence: internal/bench/reports/governance-invariants.json#s0_2_decomposition_laundering
- status: backed
- last_verified: 2026-08-02

### claim: governance-marker-preservation-null
- claim: Pre-registered spike S0.3 measured that a stated uncertainty, hedge, or provenance marker survives this package's telegraph condenser into the audited text — 3 marker classes, 10 fixture cases, marker-loss count 0, negation count preserved. Honest null, published with the spike wired as the regression test. The first run's two "failures" were fixture defects (carriers written as phrases containing an article the condenser is documented to drop) and are recorded as an unmet premise rather than edited away. Scope bound: this protects a marker the agent DID emit; it cannot make an agent state an uncertainty it never stated.
- kind: quant
- evidence: internal/bench/reports/governance-invariants.json#s0_3_marker_survival
- status: backed
- last_verified: 2026-08-02

### claim: governance-adjacent-properties
- claim: Four adjacent governance properties were closed as regression tests rather than phases, on the expectation that each was already true. One of the four was. (a) enforcement never branches on a base-model refusal string — holds; the single module compiling refusal regexes only ever escalates, and no refusal branch reaches an allow decision. (b) a capability gate resolves only from trusted config — VIOLATED: the runtime dispatcher returned ready for a skill whose own frontmatter declared `safety_mode: strict` and granted itself 2 tools absent from the 2-entry registry, while the validator implementing that allowlist had zero production callers; now wired. (c) caller-agnosticism — holds: 0 caller-identity inputs reach a gate verdict, and the 3 platforms that carry the blocking slot are pinned so none silently loses a concern. (d) constraint monotonicity — holds: 0 blocking gates read persisted state, with 1 advisory anti-nag exception named in the test. All 7 inverted properties produced a failing test.
- kind: quant
- evidence: internal/bench/reports/governance-invariants.json#adjacent_properties
- status: backed
- last_verified: 2026-08-02

### claim: keyword-anchoring-census
- claim: Word-boundary-anchored keyword matching reduced unintended rule activations by 12.5% (495 → 433) over the 302-prompt matrix-derived corpus with zero intended positives lost. Disclosure — the derived corpus was co-edited in the same change (6 German positives re-authored to standalone tokens; verb-inflection recall is a documented accepted cost). The circularity is broken by an independent replay over 49 UN-edited real-corpus prompts: recall 15/17 in BOTH arms (zero labels lost to anchoring), unintended activations 110 → 99 (−10.0%).
- kind: quant
- evidence: agents/evidence/analysis/anchoring-independent-replay-2026-08.md
- status: backed
- last_verified: 2026-08-03

### claim: budget-routing-relation
- claim: The budget-routing relation (cheapest classifier-adequate tier WITH available budget; exhausted/cooling tier falls back upward; all unavailable → session model, work never blocked; session model never switched) is implemented and deterministically tested, including the atomic reserve lifecycle (acquire → TTL-expire/settle → compact, shared-TTL single source, stale-lock breakage; pre-registered AC1–AC5). DELIVERY is agent-adherent policy — no code caller dispatches through pickTier at runtime — and is monitored by routing:doctor's delivery-evidence check, which WARNs UNCONDITIONALLY when recorded dispatches carry zero tier decisions: always-on orchestration removed the `subagents.budget_routing` key, so there is no binding left to condition the warning on (`routing_doctor.ts` check_budget_delivery says so in its own docstring). The reserve arithmetic is dead on the same evidence — `tier-reserves.jsonl` has exactly one writer (`acquireBudgetPermit`, no production caller), so the `reserved_usd` term `budget.mjs tier` sums is structurally always 0 in production, and `budget.mjs tier` itself has no production caller either. This entry deliberately does NOT claim "budget-aware delegation shipped" as autonomous runtime behavior.
- kind: qual
- evidence: docs/contracts/budget-routing.md#Why it was retired
- status: resolved-null
- last_verified: 2026-08-16
- resolution: RETIRED (closed, not pending). The mechanism this entry described was ARCHIVED on 2026-08-16 by a converged AI-council verdict (anthropic + openai, 2 of 2, neither reporting a premise correction), which reversed the v1 contract locked 2026-08-03 and retired its pre-registered AC1–AC5. Filed `resolved-null` rather than deleted because the answer is in and worth keeping: the layer was implemented and tested, and it still could never fire. `pickTier` required a `routing_switch` whose sole source — the `subagents.budget_routing` settings key — was deliberately deleted by always-on orchestration, so wiring it meant inventing a replacement for a removed category rather than finishing an integration; it had zero production callers; and with `session_tier` non-null in 0 of 327 orchestration records its saving was unmeasurable in principle, so AC1–AC5 could never fire. The claim text above is kept verbatim as the record of what was asserted while the code existed — it describes no current capability. What survives in the tree is `TIER_ORDER` + `readCooldowns`, monitoring rather than routing, consumed by `routing_doctor.ts`. Reopen only on the union revisit-if in the migration record: an authoritative per-request tier-selection signal WITH a named production dispatch point, AND telemetry carrying both the chosen and the realized tier.

### claim: plan-gates-measurement-protocol
- claim: The plan-governance gates (C/R1/R2) ship with a two-stage pre-registered measurement protocol committed BEFORE the first data point — Stage A (this entry) fixes the metric definitions, denominators, and a fixed advisory window: the first 10 gated PRs run Gate R2 in advisory-only mode (`check_completion_review --advisory`) and the observed critical/high catch rate is recorded as the baseline; Stage B derives the enforced-mode success threshold for `r2_critical_catch_rate` from that observed baseline and commits it to this ledger BEFORE the enforced window — set exactly once, never lowered afterwards. Protocol-level gates registered now: cost ceiling `gate_latency_p95 <= 5 min` per PR; alarm `honest_null_rate >= 90%` over 10 consecutive reviews (review toothless or reviewer too lax); sanity `r2_skip_rate` rising on code-bearing work = applicability guard miscalibrated; `gate_c_bypass_rate` persistently ~100% = gate friction exceeds value; alarm `gate_internal_error` on >= 10% of a gate's runs over 20 consecutive runs = that gate is de-facto off, since exit 2 is warn-and-allow at every call site (audit the gate; it is NOT auto-promoted to blocking, which §6 forbids) — coverage boundary: the agent-side and pre-push path only, so the counter is a floor and never a census, because §7.1 bars the validator from appending and a CI runner has no agent to do it. Metric events append to agents/evidence/metrics/gate-metrics.jsonl (ids + counters only, PII-free by construction). HONEST-NULL consequence: thresholds missed => publish the result and rework or roll back the gates — never lower a threshold after the fact. After 20 gated PRs a measurement report exists regardless of outcome (carrier: the trigger-gated follow-up in the roadmap layer).
- kind: quant
- evidence: docs/contracts/plan-review-gates.md#Advisory window (Stage A, verdict #20)
- status: unbacked
- last_verified: 2026-08-04

### claim: critic-protocol-load-bearing-ab
- claim: PRE-REGISTERED 2026-08-09, BEFORE any run (road-to-judgment-and-forensic-evidence Phase 2; thresholds, prompts, and scorer semantics frozen at registration and not adjusted after the numbers land). On the frozen adversarial-council corpus (internal/bench/adversarial-council/corpus.json, built 2026-07-21 — 12 defect fixtures + 3 controversial-but-correct clean controls), the `load_bearing` critic protocol — one independent single-shot review per vendor (anthropic claude-sonnet-4-5 + openai gpt-4o, direct client calls, strict JSON; NEVER council_cli transport, per the adversarial-council-finding-coverage measurement-artifact note) — achieves, PER VENDOR: (1) false-positive rate < 50% on the 3 clean controls AND (2) true-positive retention >= 80% of the legacy skeptic arm's TP count on the 12 defect fixtures, both arms measured in the same run. Both conditions, both vendors, or the arm does not promote; `legacy` stays the default in either case (promotion is a separate human decision on top of a passing result). Scoring is the existing deterministic scorer (caughtDefect: defect-file basename + category-family match; isFalsePositive: any non-low-confidence finding on a clean control) applied IDENTICALLY to both arms on findings only; the protocol's verdict field is published as a secondary signal, and a "flawed" verdict with empty findings is counted separately as `incoherent` (per the 2026-08-09 council design pass), never as a TP catch and never as an FP. Mechanism hypothesis, stated so it can be wrong: a critic that cannot return "this holds" cannot have an FP rate below 100% by construction; the protocol makes "holds" a positive, defensible output. Published in both directions regardless of outcome.
- kind: quant
- evidence: internal/bench/adversarial-council/runs/critic-protocol-ab-report.json
- status: resolved-null
- last_verified: 2026-08-09
- resolution: RESOLVED 2026-08-09, same day as registration, run AFTER the registration commit — NO PROMOTION, published in both directions. anthropic/claude-sonnet-4-5: the load_bearing arm PASSES both thresholds — FP 1/3 (33%) vs legacy 3/3 (100%, replicating the measured defect in the same run), TP retention exactly 0.80 (8/12 vs legacy 10/12). openai/gpt-4o: the load_bearing arm FAILS the retention floor in the most instructive way available — 0/12 defects caught, verdict "holds" on 14 of 15 fixtures, and the single "flawed" verdict (inv-02) missed the ground truth, so TP stays 0/12 — blanket approval in effect, the roadmap risk-register rank-2 risk materialized on the weaker model; FP 0/3 passes trivially as a side effect of approving nearly everything. Per the frozen registration (both conditions, both vendors) the arm does not promote; critic_protocol stays legacy. What survives: the mechanism hypothesis holds on the strong model (permitting "holds" cut FP from 100% to 33% at the exact retention floor) and is falsified in its general form — the permission to approve is only safe where the model retains defect-finding under the protocol. Run artifacts: internal/bench/adversarial-council/runs/critic-protocol-ab-{report.json,trace.txt}.

### claim: forensics-pack-value
- claim: PRE-REGISTERED 2026-08-09 (road-to-judgment-and-forensic-evidence Phase 3.5), BEFORE any release has been scored. Across the next 3 releases of this package, the machine-derived forensics findings (hotspot + change-coupling deltas from src/scripts/forensics_report.ts, ingested advisory into agents/evidence/release-findings/<version>.json) surface at least 2 confirmed unique findings — findings the manual release review missed or contradicts, confirmed by the maintainer's disposition on the ledger entry. >= 2 confirmed unique findings across the 3 releases promotes the forensics pack to a standing release-review input; zero confirmed unique findings closes it as an on-demand tool (the pack stays installable, the per-release wiring is dropped). 1 confirmed finding = the question extends one further release, once, then resolves on the same rule. The counting surface is the disposition field on the ledger entries, not this ledger.
- kind: quant
- evidence: agents/evidence/release-findings/
- status: unbacked
- last_verified: 2026-08-09

### claim: conformance-advisory-vs-blocking
- claim: On the first post-fix behaviour-conformance measurement (round 5, `/analyze:conformance --limit 30`, run 2026-08-07, every violation split by its own timestamp against the 2026-08-06 carrier merge), both BLOCKING `pre_tool_use` guards eliminated their classes — unauthorized irreversible git ops 8 → 0, evaluator prompt pre-loading its verdict 1 → 0 — while neither advisory carrier did: language-mirror violations fell 555 → 19 under advisory state injection at `user_prompt_submit` (−96.6%, not zero) and verification-claimed-on-empty-output fell 4 → 1 at `post_tool_use`. Advisory reduces massively; only blocking eliminates. Scope bounds, inseparable from the numbers: the post-fix corpus is ONE session (~600 assistant turns), so this is a recorded prior, not a law; the language pin was verified PRESENT on the violating post-fix turns (which is why an UNBOUNDED re-pin — restating it on every tool call — stays refused; what shipped 2026-08-20 instead is a BOUNDED re-emit, once per 150 tool calls, against a red baseline this round-5 corpus could not produce and whose own revisit clause called for: 11 English replies to a German user, all of them 179+ tool calls past the pin, none below. Corrected here because the unqualified earlier wording — "higher injection frequency is refused as a fix" — is a claim the shipped code contradicts; the reasoning, the measured distances, and the accepted false-fire cost are in `agents/settings/contexts/reminder-injection-verdict.md`); and the 555 pre-merge count is partly contaminated by the synthetic-turn mis-pin fixed in the same round (`isSyntheticPrompt`). NOT PRE-REGISTERED, and it could not have been: this is a post-hoc audit reading taken after the carrier landed, so no bar existed to freeze before the data. What stands in for pre-registration is that the one choice a post-hoc split could game — where before ends and after begins — was not chosen by the measurement: the boundary is the carrier merge's own commit timestamp (2026-08-06) and every violation is assigned by its own timestamp against it. The detector is deterministic and re-runnable over the same transcript store, so the numbers are reproducible rather than attested. Read it as a recorded prior, never as a pre-registered result; the sibling claim that DOES carry a frozen bar is the scoped-rule absence experiment, pre-registered precisely because its data does not exist yet.
- kind: quant
- evidence: src/domains/analysis-workbench/analyze/conformance/command.md#Both blocking carriers reached zero
- status: backed
- last_verified: 2026-08-10

### claim: worker-capsule-trigger-arm
- claim: A worker that reaches an emission trigger below its stop-loss budget can hand off a CHECKPOINT capsule a successor generation works from, and one of the two candidate triggers — the 80% token watermark or novelty-per-step saturation — is measurably the better emission point.
- kind: comparative
- evidence: PRE-REGISTERED 2026-08-09 (road-to-worker-generation-recycling Phase 1.4 — registered BEFORE the first shadow capsule is read; the mechanism ships shadow-only, so no capsule has been scored at registration time). CAPSULE-QUALITY RUBRIC, fixed here, five binary criteria scored 0-5 per capsule — (1) `remaining[]` names every open item the task still needs, no silent drops; (2) `decisions[]` names each choice a successor would otherwise silently re-open; (3) `assumptions[]` is non-empty and every entry carries a resolving `basis` ref; (4) every `done[]` ref resolves to a real file/line; (5) a successor briefed on the ORIGINAL brief plus the capsule alone takes a first action that neither repeats completed work nor asks for a re-brief. ADOPTION MARGIN, fixed BEFORE data: an arm is adopted only if, on paired samples from the same runs, it fires at a median of >= 2 steps earlier AND its capsules score >= 4/5 on the rubric with no regression against the other arm; an arm that wins on earliness while dropping below 4/5 is NOT adopted, because an earlier bad capsule is worse than a later good one. Sample floor: >= 30 shadow capsules with BOTH trigger points recorded (`watermark_step`, `saturation_step`, `trigger_arm_earlier` on the `orchestration_record` line). Instrument: `src/scripts/_lib/capsule_trigger.ts` (`compareTriggers`, `earlierArm`), term-frequency only, no embeddings. HONEST-NULL consequence, pre-authorised: BOTH arms losing (neither reaches 4/5, or the margin is not met) is a publishable result that closes the mechanism as default-off — it is the expected-value outcome given the standing `orchestration-observed-dispatch-cost` null, and it must be cheap to record. Token delta is reported as a pair with quality and is explicitly NOT the claim.
- status: unbacked
- last_verified:

### claim: judge-family-llm-as-a-judge-foundation
- claim: The judge-skill family (`judge-bug-hunter`, `judge-code-quality`, `judge-security-auditor`, `judge-synthesis`, `judge-test-coverage`, and the `/review-changes` dispatcher) implements the LLM-as-a-judge pattern — a specialized model scoring another model's output against a rubric — and names position bias and self-consistency as its known failure modes. SCOPE: the pointer backs the pattern and its named failure modes, which is what the cited work establishes. It does NOT back any claim about how this repo mitigates them; a statement about the dispatcher's own behaviour needs a repo pointer, not a paper.
- kind: qual
- evidence: https://arxiv.org/abs/2306.05685 (2026-08-11)
- status: backed
- last_verified: 2026-08-11

### claim: adversarial-review-tree-of-thoughts
- claim: `adversarial-review` structures its critique as branching exploration with explicit pruning rather than a single pass, following the Tree-of-Thoughts formulation.
- kind: qual
- evidence: https://arxiv.org/abs/2305.10601 (2026-08-11)
- status: backed
- last_verified: 2026-08-11

### claim: autonomous-analysis-self-refine
- claim: `analysis-autonomous-mode` runs iterative self-critique between steps rather than only at the end, following the Self-Refine formulation.
- kind: qual
- evidence: https://arxiv.org/abs/2303.17651 (2026-08-11)
- status: backed
- last_verified: 2026-08-11

### claim: bug-analyzer-chain-of-verification
- claim: `bug-analyzer` verifies each candidate root cause against a concrete trigger before reporting it, following the Chain-of-Verification formulation — which is the mechanism behind its "never invent issues" constraint.
- kind: qual
- evidence: https://arxiv.org/abs/2309.11495 (2026-08-11)
- status: backed
- last_verified: 2026-08-11

### claim: sequential-thinking-chain-of-thought
- claim: `sequential-thinking` applies chain-of-thought decomposition with two constraints the original formulation does not carry — a cap on the number of thoughts and a mandatory validation step — specifically to bound the unbounded-expansion failure mode.
- kind: qual
- evidence: https://arxiv.org/abs/2201.11903 (2026-08-11)
- status: backed
- last_verified: 2026-08-11

### claim: skill-improvement-reflexion
- claim: `skill-improvement-pipeline` converts post-task outcomes into durable written lessons rather than in-context retries, following the Reflexion formulation.
- kind: qual
- evidence: https://arxiv.org/abs/2303.11366 (2026-08-11)
- status: backed
- last_verified: 2026-08-11

### claim: design-slop-false-positive-baseline
- claim: On a 32-file labelled clean-UI corpus, 18 of the 19 shipped design-slop rules produced zero false positives; the nineteenth (`slop-c6-lock-colour`, catalog C6) fired on 4 of the 32 files and was demoted to judgment-only rather than tuned.
- kind: quant
- evidence: internal/bench/corpora/design-slop-fp-PREREG.md#The ceiling, declared before the run
- status: backed
- last_verified: 2026-08-13

  Counting method: M1 is the number of distinct corpus files on which a rule
  emits at least one finding — per file, not per hit. Every corpus file is
  labelled clean by construction, so a finding is a false positive by
  definition and no adjudication step stands between the run and the number.
  The corpus hash pins the epoch; a figure quoted without it is not comparable
  to this one.

  What this does NOT say. It is not a precision result. The pre-registration
  names the honest-null branch in advance: an all-zero outcome would show that
  the corpus fails to discriminate, not that the detector is precise. After the
  C6 demotion the remaining 18 rules do read all-zero, and that is exactly the
  branch this sentence is invoking — the surviving registry is *not* thereby
  shown to be precise on unseen UI. What the run did demonstrate is that the
  instrument discriminates at all, because it caught a real defect on its first
  use, and that the corpus is not merely too weak to fire.

  The C6 finding, stated as measured. The catalog entry describes "≥ 3 distinct
  saturated *accent* hue families … no single accent identity". Two independent
  mechanical causes were traced by running the rule's own `hueBucket` over each
  flagged file, and they compound:

  - **The saturation gate admits neutrals.** It tests HSL saturation ≥ 0.25, and
    HSL saturation inflates at extreme lightness. `#16202b`, a near-black body-
    text slate, computes s = 0.33; `#eef2f6`, a near-white row-hover background,
    computes s = 0.31 at l = 0.949 — just under the 0.95 ceiling. Both are
    ink-and-paper neutrals counted as accent hue families.
  - **Semantic status colour is not accent identity.** In `data-table.css` the
    four buckets were one accent blue plus a settled-green pill, a pending-amber
    pill, and neutrals; genuine accent count, one. `toast-stack.css` reached
    three buckets with **zero** accents — an error red, a warning amber, and its
    near-white text.

  Making those files pass would have meant desaturating error text or dropping
  status pills from a table: worse UI written to keep a regex quiet. The
  pre-registered response to M1 ≥ 1 is demotion with the count, explicitly not
  tuning the rule until it passes, and that is what happened; a tightened C6
  would be a new rule measured against a new epoch.

  Not consumer telemetry. The deferral that motivated this instrument asks for
  a false-positive rate "in real consumer use". This is not that, and the gap
  is not closed by calling a repo-authored corpus real. What it replaces is an
  absence.

  Delta, same epoch (corpus hash unchanged, so the two numbers are comparable).
  Six catalog entries whose thresholds the catalog already published — V4, C3,
  T9, T10, M1, M3 — were promoted to rules and graded individually rather than
  as a batch. All six recorded M1 = 0 and each fires on its own positive
  fixture, so N = 6 of 6 shipped and the registry stands at 24. The per-rule bar
  is what makes that reportable: a batch bar would have let one noisy rule sink
  five clean ones, or let an average carry a bad one through.

  The same caveat governs the delta. Six more rules at zero on 32 files is six
  more rules that did not fire here, not six rules shown to be precise. The one
  thing the epoch does establish is that the instrument is capable of a non-zero
  reading, because it produced one on its first use.

### claim: experiment-loop-iteration-floor
- claim: A session-bound keep-or-revert loop against a scalar metric sustains at least five clean iterations — each recording a correct keep-or-revert decision — before its own machinery degrades.
- kind: quant
- evidence: PRE-REGISTERED 2026-08-17 (road-to-metric-loop-and-review-integrity Phase 0/5 — the floor was fixed before the spike ran, and the spike's kill criterion was its complement: "fewer than five clean iterations" would have left Phase 3 unbuilt). Measured on a toy metric in a scratch repository, `agents/evidence/eval-findings/metric-loop-s01.md`: 6 clean iterations, metric 24 → 3, with iteration 5 reverting a change that improved the metric 67 % and broke behaviour. That result answers the PHASE GATE and is why the skill shipped. It does NOT back this claim, and the distinction is the whole reason the entry stays unbacked: the run was one agent, one session, one toy metric whose evaluator was written alongside the loop, so it measured whether the PROTOCOL holds, not whether the shipped skill drives a real metric. BACKING REQUIRES: ≥ 3 runs of the shipped `experiment-loop` skill against metrics that existed before the run, each with its register committed, each reaching ≥ 5 clean iterations. DROP: any run below the floor publishes the null and the skill is withdrawn rather than the floor lowered — lowering a pre-registered floor after seeing the data is the tuning this roadmap's own s04 finding forbids.
- status: unbacked
- last_verified:

### claim: review-independence-changes-consumption
- claim: Recording `review_independence` / `acceptance_status` on a review artifact changes how a consumer treats it — a same-family verdict stops being read as cross-model acceptance.
- kind: qual
- evidence: PRE-REGISTERED 2026-08-17 (road-to-metric-loop-and-review-integrity Phase 2/5 — registered BEFORE any consumption claim is made anywhere). The MECHANISM shipped and is machine-checked: `check_review_schema` refuses an artifact whose `acceptance_status` contradicts its `review_independence`, and its `--self-test` plants the exact defect (a same-family set claiming `accepted`) and confirms the rejection fires. The EFFECT is a different question and is not measured: nothing yet observes a consumer reading the field and behaving differently, and the only committed ledger (`9.14.0`) was backfilled by this same change rather than consumed by anyone. BACKING REQUIRES: ≥ 2 recorded instances where a reader or a downstream gate declined to treat a `provisional` artifact as acceptance, with the artifact and the decision both citeable. DROP: if the fields ship for one release and every consumer still reads the verdict line alone, the honest null is that the metadata is inert — the Risk-Register rank-2 outcome — and it is published as such rather than defended.
- status: unbacked
- last_verified:

### claim: user-out-of-loop-baseline
- claim: After the initial planning window, a roadmap run reaches an open PR with a lower median count of synchronous user contacts than the pre-change baseline, without raising the held defect rate.
- kind: quant
- evidence: PRE-REGISTERED 2026-08-17 (road-to-user-out-of-the-loop Phase 0 Step 3 — registered BEFORE the instrument had recorded a single observation, and deliberately BEFORE any Phase 1 mechanism ships, so the baseline cannot be read after the change it is meant to judge). INSTRUMENT: the `interruption-ledger` concern (`src/scripts/hooks/interruption_ledger_hook.ts`, `stop` slot, capture-only) writes one `{run_id, turn, kind, class, roadmap}` line per turn to `agents/runtime/state/interruptions.jsonl`; `src/scripts/interruption_report.ts` reads it. DEFINITION fixed before data, and it is three classes rather than two on purpose: a CONTACT is a turn whose closing paragraph either ends in a question (`ask`) or yields the decision without one (`handback`). Counting only `?` would score this package's own preferred hand-back shape as zero contacts and make the metric flatter the design — the Risk-6 failure the roadmap names. POWER CAVEAT recorded at registration, not discovered later: the rolling chat history is a buffer, not an archive — measured the day this was written it held **5 sessions, all from one day**, against the 30-session conformance window the step asks for. The report therefore reports `sessions_found` next to `window_requested` and flags `window_short`; a number computed over a short window may not be cited as an N-session baseline in either direction. FALSIFICATION fixed before data: (1) the QUALITY ANCHOR is the held defect rate — a contact reduction that moves the defect rate is a FAIL regardless of its own number, and the two are never reported apart; (2) the baseline must rest on ≥ 20 recorded runs before any post-change comparison is made, and a comparison against fewer is reported UNDERPOWERED, never as a win; (3) a run present in the ledger but not the history, or the reverse, is reported with the missing axis null and is never scored as zero — scoring an unmeasured run as zero contacts is the arithmetic that would manufacture the result. HONEST-NULL PATH: if the median does not move, or moves only with the defect rate, the null is published and Phase 1's mechanisms are judged on it rather than the claim being re-scoped to a family that happened to win.
- status: unbacked
- last_verified:

### claim: roadmap-wall-clock-baseline
- claim: A roadmap run's median wall-clock hours from run start to open PR falls against the pre-change baseline, without raising the held defect rate.
- kind: quant
- evidence: PRE-REGISTERED 2026-08-17 (road-to-user-out-of-the-loop Phase 0 Step 3). SEPARATE FROM `user-out-of-loop-baseline` BY CONSTRUCTION, never merged into it: the roadmap's Goal states the two axes are deliberately not one, because a run can ask zero questions and still be slow — a single blended metric would let a contact win pay for a wall-clock loss and report the pair as progress. INSTRUMENT: `src/scripts/interruption_report.ts` derives elapsed time per run from `agents/runtime/.agent-chat-history` timestamps and splits it into WAITING (agent turn → the next real user turn) and WORKING (elapsed minus waiting). The join to the contact axis is the session tag: the ledger writes `run_id` via `derive_session_tag`, the same derivation that file writes as `s`. SYNTHETIC-TURN EXCLUSION is part of the definition, not a filter applied later: the harness writes task notifications and system reminders into the user role, and counting those as replies collapses every measured wait toward zero and makes the whole axis read as already-solved. The count of excluded turns is reported so the exclusion is auditable. POWER CAVEAT: identical to the sibling claim — 5 sessions measured against a 30-session request on the day of registration; `window_short` is reported and a short window may not be cited as a baseline. FALSIFICATION fixed before data: (1) the QUALITY ANCHOR is the held defect rate, same as the sibling — a wall-clock win that moves it is a FAIL; (2) WORKING time, not elapsed, is the number a mechanism is judged on when the mechanism claims to remove waiting — reporting an elapsed improvement produced entirely by a faster human is the attribution error this criterion exists to block; (3) ≥ 20 recorded runs before any comparison, else UNDERPOWERED. HONEST-NULL PATH: if elapsed falls while working time does not, the recorded finding is that the change moved the human's response time and not the run's, and no autonomy claim is made from it. POST-REGISTRATION FINDING 2026-08-19 (road-to-long-horizon-execution, added AFTER registration and changing NO threshold — the ≥ 20 floor above stands exactly as written): the floor is **structurally unreachable with this instrument at default retention**, which is a different statement from "not yet reached" and has a different remedy. Timing comes only from `agents/runtime/.agent-chat-history`, whose retention is `DEFAULT_MAX_SESSIONS = 5` (`src/scripts/chat_history.ts`; `chat_history.max_sessions` is unset on every settings layer, so the default is live). Five retained sessions yielded **4** timing-bearing runs on 2026-08-19, and the same file held 5 sessions at registration on 2026-08-17 — two readings two days apart, both at the cap. Waiting therefore does not fill this window; it rotates it. Backing this claim requires either a timing source that is not a rolling buffer, or an explicit retention change with its own privacy review — or this claim closes on the honest-null path above. Recorded here rather than in a roadmap because the reachability of a pre-registered floor is a property of the claim, and a reader deciding whether to wait for more data needs it at the point of the claim. The sibling `user-out-of-loop-baseline` is NOT affected: its source is the committed append-only ledger, which stood at **19** of 20 on the same day and is reachable by one more recorded run. `interruption_report` now prints each axis's own N against the floor, because the single ⚠️ SHORT WINDOW banner over both axes had already produced one live misreading — `runs: 21` read as the contact axis clearing the floor, when 2 of those runs carry timing and no ledger entry.
- status: unbacked
- last_verified:

### claim: context-fidelity-compaction-compliance
- claim: Across a compaction boundary, a measured share of trigger-loaded obligations is still followed afterwards, and that share is high enough to decide whether a reinjection carrier is worth building.
- kind: quant
- evidence: PRE-REGISTERED 2026-08-17 (road-to-context-fidelity Phase 0 Step 4 — registered while the census that would answer it, cf01, has NOT been run, so this is a genuine pre-registration and not a ledger entry written around a number already in hand). THRESHOLD fixed before data, taken verbatim from the roadmap: **a baseline compliance at or above 90 % for all three probe classes closes Phase 1 UNBUILT** and the null is published with the host version recorded. The three probe classes are a session-canary-bound obligation, a completion-gate reminder, and one trigger-loaded rule with a detectable obligation; the threshold binds all three separately, so a mean of 90 % carried by one strong class is not a pass. METHOD CONSTRAINT discovered before the census ran, and it is why this entry does not simply wait: cf03 measured 29 compaction events across 473 sessions, **all 29 tagged host-automatic and none tagged manual** (`agents/evidence/eval-findings/context-fidelity-cf03.md`). That zero is **absence of a RECORD, not absence of an event** — corrected on R2 finding 6, which caught the first phrasing here reporting an unobservable as an observation. The detector is pinned to one OBSERVED auto event (`src/scripts/_lib/session_eol.ts:11-19`) and nothing in the tree establishes that a manual compaction writes a `compact_boundary` record at all. So the constraint on cf01 is sharper than "measures a rare path": until manual detectability is established, a cf01 null is UNINTERPRETABLE — indistinguishable from a compaction that happened and left no trace. Establishing it is one manual compaction in one instrumented session, and it is a precondition rather than a result. FALSIFICATION fixed before data: (1) the host version is stamped on every observation, because compaction survival is a host fact that changes without notice; (2) a probe present only as paraphrase counts as NOT followed — the obligation is the behaviour, not the recall; (3) at or above 90 % on all three classes the recorded consequence is that Phase 1 is not built and the folklore is named as folklore, with the same force as the positive direction. HONEST-NULL PATH is therefore the DEFAULT outcome of a high reading, not a fallback: this claim exists to be able to close work rather than to justify it.
- status: unbacked
- last_verified:

### claim: context-fidelity-memory-staleness
- claim: A materially large share of the curated memory store is stale against the live tree — large enough that an eviction ladder is justified rather than shrunk to stamps.
- kind: quant
- evidence: PRE-REGISTERED 2026-08-17 (road-to-context-fidelity Phase 0 Step 4). THE THRESHOLD PREDATES THE DATA, THE LEDGER ENTRY DOES NOT, and the distinction is stated rather than blurred: the roadmap fixed **a stale ratio below 10 % shrinks Phase 2 to stamps only** on the day it was written, BEFORE any census ran; this entry was written after cf02 produced a first reading, so it records a resolution-in-progress rather than claiming the ledger row itself came first. FIRST READING, from `agents/evidence/eval-findings/context-fidelity-cf02.md`: 107 curated entries walked one by one against the tree — 73 still-true, 23 stale, 11 unverifiable, i.e. **21.5 % of all entries and 24.0 % of the verifiable subset**. Both denominators clear 10 %, so the kill criterion does not fire on either reading and the ladder stays justified. THE LOAD-BEARING FINDING is that the shipped instrument disagrees: `memory_report` reports `staleness-rate=0.0%` because all 107 entries carry the SAME `last_validated: 2026-07-09` and the SAME `review_after_days: 365` — one bulk stamping event, so the age axis cannot read stale before 2027-07-09. Reading the kill criterion off that 0.0 % would have closed Phase 2 on a number that measures stamping rather than truth, which is the already-satisfied-test failure this repository has recorded before. WHY THIS STAYS UNBACKED despite having a number: the tree axis was walked BY HAND because no store-wide contradiction sweep exists (`check_memory_contradiction` takes `--type --key --body`, i.e. it validates one proposed entry), three observers each classified one store, and inter-rater agreement is therefore UNMEASURED. A hand classification is not a reproducible instrument, and a ratio that cannot be re-derived by a command is not backing. BACKING TRIGGER: a store-wide sweep exists AND reproduces a ratio within its own stated error of 21.5 %. FALSIFICATION fixed before data: (1) unverifiable entries are counted as their own class and folded into neither side — folding them into still-true inflates the pass rate, folding them into stale manufactures defects; (2) the commit anchor is the precondition for any automated reading, because without it a date cannot be tied to a tree state; (3) below 10 % on a reproducible sweep the recorded consequence is the roadmap's own: the ladder is unbuilt, only stamps ship, and the null is published.
- status: unbacked
- last_verified:

### claim: council-fallback-loses-zero-seats
- claim: An eligible mid-flight cli failure with a constructible api twin loses zero council seats WHEN THE PROJECTED-SPEND GATE PERMITS THE RETRY — the seat answers over the api rung instead of dropping out of the pass. A retry the budget REFUSES is outside the claim: the original failure stands, the seat is absent, and `fallback_skipped: cost_budget` says so.
- kind: qual
- evidence: exec:vitest run tests/scripts/ai_council/council_cli.test.ts -> 0
- status: backed
- last_verified: 2026-08-19

**The condition was added 2026-08-19, after a review found the unconditional
wording refuted by its own evidence.** Recorded here rather than quietly
applied, because this is the failure shape the ledger exists against. The cited
suite contains `a fallback that was REFUSED by the retry budget still counts as
absent` — an ELIGIBLE failure with a CONSTRUCTIBLE twin whose seat IS lost,
precisely the case the unconditional sentence denied. Nothing was steered and
no test was wrong; the pointer simply did not prove what the prose above it
said.

**The gate could not have caught it, and that limitation is not fixed by this
entry.** `check_claims` runs the command and compares an exit code, so a green
suite publishes a ✅ over a sentence the suite refutes. An `exec:` pointer
proves that a suite PASSES — never that the suite tests the claim. The
mitigation available at authoring time is the boundary statement below; a
reviewer reading the claim and the suite together is what closed this one.

**What the suite does prove**, per test: a vendor-official cli member
(`billable: false`, `transport: cli`) that fails eligibly is answered by its api
twin and counts PRESENT in the quorum; the substitution is sticky, so a later
round reuses the twin rather than re-spawning the dead binary and losing the
seat to the ledger's one-shot rule; and a dead FREE seat cannot trigger the
round-wide budget short-circuit.

**What it does not prove**, stated so the boundary is not re-blurred: nothing
about an ineligible failure class (`timeout` and `server_error` are ineligible
under every policy and no config key can enable them), nothing about a provider
with no api rung (`no_twin`), and nothing about the budget-refused path, which
is the named exception in the claim itself.

### claim: unattended-demotion-gate
- claim: An unattended run's 14-day rework rate does not exceed the attended baseline; a breach returns the scheduler default to off.
- kind: quant
- evidence: PRE-REGISTERED 2026-08-19 (road-to-long-horizon-execution Phase 4.2, sequencing UOTL Phase 7.3). REGISTERED BEFORE THE CAPABILITY EXISTS, which is the point and is stated rather than implied: at registration time NO unattended run has occurred and none can, because the headless spawn is deliberately unbuilt (`unattended_guard.ts` § "Why the spawn is not in this file") and the budget defaults to both ceilings zero, which disables the lane rather than permitting it. So this entry cannot have been written around a number already in hand. THRESHOLD, fixed now: the rework rate of PRs produced by unattended runs, measured over the 14 days after each merges, must not exceed the same-window rate for attended PRs; a breach flips `max_usd`/`max_tokens` back to 0 in the same change that reports the number. REWORK is defined before any data exists, because a metric defined after the fact is chosen: a follow-up commit touching a file the run's PR touched, within 14 days of merge, excluding (a) commits by the same run continuing planned roadmap work, (b) pure dependency bumps, (c) reverts of an unrelated change that merely collide. POWER: at least 10 unattended PRs and 10 attended PRs in the comparison window, else UNDERPOWERED and no claim either way — a two-PR sample producing a favourable ratio is the failure this line exists against. FALSIFICATION: (1) an unattended PR that a human had to substantially rewrite counts as rework even when no commit touched the same file, and that case is recorded by hand rather than dropped because the mechanical definition missed it; (2) the comparison is rate-vs-rate, never absolute counts, since the two populations will not be the same size; (3) a rate that is LOWER for unattended runs is reported as-is and is NOT used to argue for widening the lane — this gate can close a lane, never open one. HONEST-NULL PATH: if the lane never runs (the spawn stays unbuilt, or the budget stays at zero), the recorded finding is that the gate was pre-registered and never had data, and the capability is closed rather than left indefinitely pending — the same D-5 shape this roadmap opens by naming. **HONEST-NULL PATH TAKEN 2026-08-19 — the SAME DAY it was registered, and that is stated rather than rounded** (R2 round 1, finding 2 caught this entry claiming "one day after"; registration above is dated 2026-08-19 too, so the elapsed time is zero). A pre-registration closed on its own registration date deserves the suspicion it attracts, so here is why it is not a threshold written around a result: the entry was registered when the spawn was DEFERRED, and closed when the spawn became REFUSED. Nothing measured moved in between — a decision did, and it is recorded with its council and its reasoning. The threshold never met data in either state. The lane will not run: the headless spawn is no longer "deliberately unbuilt" but a published refusal (road-to-long-horizon-execution 4.0, AI council 2026-08-19), and the two acceptance criteria that depended on it are cancelled WILL-NOT-MEASURE. So the recorded finding is exactly the one this path fixed in advance: **the gate was pre-registered, never had data, and the capability is closed** — zero unattended PRs against the ≥ 10-vs-10 power floor, which is not a null result but an absent population, and the entry says which. Nothing here is read as evidence in either direction, and specifically not as "unattended runs are safe": an unrun lane has no rework rate. The threshold, the rework definition and the power floor are left EXACTLY as registered so that a future roadmap reopening the capability inherits a bar written before anyone knew the answer; reopening requires that new roadmap, never a re-reading of this entry. The reopen trigger is 4.0's: the first checkpoint written by a real dying run. STATUS `resolved-null`, not `unbacked` (R2 round 2, finding 3): the ledger already has the terminal status for exactly this state, and leaving a closed question inside the documented-debt inventory would inflate the unbacked count and leave it looking pending — the indefinite-pending shape this entry argues against, reproduced by the entry that argues against it.
- status: resolved-null
- last_verified: 2026-08-19

### claim: adr-interruption-baseline
- claim: ADR-caused synchronous contacts with the owner, measured per 20 roadmap runs, do not rise after the evidence axes land, and the post-window figure is published whether or not it falls.
- kind: quant
- evidence: PRE-REGISTERED 2026-08-21 (road-to-evidence-based-adr-governance Phase 6.1). REGISTERED BEFORE THE MECHANISM CHANGES ANY BEHAVIOUR, and that ordering is the point: the axes ship descriptive (ADR-238 § 2 — a grade prices review burden and confers no authority), so the baseline is measured against a tree where nothing has been unlocked yet. METRIC, fixed now: a contact counts when a run stops or asks the owner AND the stated reason names an ADR — read from session transcripts, not from an agent's self-report, because "I was blocked by ADR-X" is exactly the claim the surrounding roadmap exists to stop taking on faith. DENOMINATOR: 20 roadmap runs, counted as `/roadmap:process-*` invocations that reach at least one closed step; a run that aborts before its first step is not a run. POWER: at least 20 runs on each side, else UNDERPOWERED and no claim in either direction — a five-run sample producing a favourable ratio is the failure this line exists against. FALSIFICATION: (1) a fall in contacts accompanied by a rise in the held-defect rate is NOT a win and is reported as a trade, not a success; (2) the comparison is rate-vs-rate, never absolute counts, since run volume will differ; (3) a rise is published as a rise — this metric can close the mechanism, and per ADR-238's own review_trigger a flat result reopens that record. HONEST-NULL PATH: if 20 runs do not accumulate, the recorded finding is that the metric was pre-registered and never had a population, and the interruption claim is withdrawn rather than left pending.
- status: unbacked
- last_verified: 2026-08-21

### claim: adr-grade-accuracy-vs-gold
- claim: Heuristic and reviewer evidence grades agree with an externally adjudicated gold sample often enough to be usable, at a threshold fixed before the sample is drawn.
- kind: quant
- evidence: PRE-REGISTERED 2026-08-21 (road-to-evidence-based-adr-governance Phase 6.2). WHY NOT INTER-REVIEWER AGREEMENT, which is the obvious metric and the wrong one: agreement measures shared bias as readily as accuracy, and this repository has the receipt — 44 engine-shaped REJECT records accumulated under correlated council agreement (`engine-reclassification-2026-07.md`) and were disposed of by one measurement (`claim:code-graph-retrieval-null`). Two reviewers who searched the same way and read the same rubric will agree while both being wrong. METRIC: an anchor sample of 12-15 records is graded independently, then adjudicated to a gold value by a party that did not produce either grade; accuracy is the proportion of proposals matching gold on the E0/E1-versus-E2+ boundary, which is the boundary that matters because it is the one the burden table prices. THRESHOLD, fixed now: 85%. Reported WITH the disagreement count and stratified by record type, never as a bare percentage. POWER: fewer than 12 adjudicated records is UNDERPOWERED and yields no claim. FALSIFICATION: (1) high accuracy on records that constrain nothing, paired with low accuracy on records that constrain agent behaviour, is a FAILURE even if the aggregate clears 85% — see `claim:adr-beneficiary-grade-bias`; (2) an adjudicator who saw a proposal first is not independent and that sample is void; (3) if adjudication itself proves unrepeatable, the finding is that evidence grading is not reliably gradeable here, which is a publishable null and closes the authority question by itself.
- status: unbacked
- last_verified: 2026-08-21

### claim: adr-evidence-discovery-recall
- claim: Records graded E0 with `discovery: complete` genuinely have no findable evidence, at a recall floor fixed before the sample is drawn.
- kind: quant
- evidence: PRE-REGISTERED 2026-08-21 (road-to-evidence-based-adr-governance Phase 6.2). WHAT IT MEASURES: the failure mode the `discovery` field exists for. A bare E0 collapses five states — evidence absent, evidence existed and was never cited, cited somewhere non-standard, present in the tree and not found, external and never fetched — and the last four are discovery failures, not evidence failures. A record graded weak because nobody looked is the cheapest possible way to manufacture a reopenable lock. METRIC: draw a random sample of at least 15 records carrying `strength: E0` with `discovery: complete`, run a deeper independent search on each (full-tree grep for the decision's own terms, the roadmap and PR that produced it, the external sources its body names), and count how many turn out to have locatable evidence. THRESHOLD, fixed now: no more than 20% of the sample may turn out to have findable evidence. FALSIFICATION: (1) a breach means `complete` is being asserted where `incomplete` is the honest value, and the remedy is to make `incomplete` the only permitted value for a heuristic proposal rather than to lower the floor; (2) if nearly every honest answer is `incomplete`, that is itself the finding — the field then records uncertainty rather than resolving it, which is stated in ADR-238 § Assumptions as an accepted possibility rather than discovered later. HONEST-NULL PATH: if no record ever carries `discovery: complete`, the recorded finding is that the strong form was never used, and this claim resolves null with the observation that E0 in this tree means "unsearched" in practice.
- status: unbacked
- last_verified: 2026-08-21

### claim: adr-beneficiary-grade-bias
- claim: Records that constrain agent behaviour are not graded weaker than records that do not, beyond a pre-registered tolerance.
- kind: quant
- evidence: PRE-REGISTERED 2026-08-21 (road-to-evidence-based-adr-governance Phase 6.2). WHY THIS EXISTS: it is the measured form of the conflict of interest a two-seat council named as the design's central risk. An agent grading a record that constrains it has a structural incentive to grade it weak, and recording provenance documents the conflict without neutralising it — an audit log is not a control. METRIC: partition accepted records into CONSTRAINING (the record forbids, gates, or requires human involvement in an action an agent could otherwise take) and NON-CONSTRAINING, classified from the record's Decision section by a party that did not assign its grade; compare the E0/E1 rate across the two partitions. THRESHOLD, fixed now: the constraining partition's weak-grade rate may exceed the non-constraining partition's by no more than 15 percentage points. POWER: at least 25 records per partition, else UNDERPOWERED. FALSIFICATION: (1) a breach is evidence of grade deflation and suspends any authority consequence outright — it does not trigger a re-grade by the same party, which would be the same conflict applied to its own audit; (2) the reverse skew (constraining records graded STRONGER) is reported as-is and is not read as a virtue: it would suggest defensive over-grading, which inflates reopen burden instead of deflating it; (3) a null result here does NOT license the authority coupling on its own — it removes one objection out of four (`claim:adr-grade-accuracy-vs-gold`, `claim:adr-evidence-discovery-recall` and `claim:adr-interruption-baseline` are the others), and the coupling stays owner-reserved regardless.
- status: unbacked
- last_verified: 2026-08-21
