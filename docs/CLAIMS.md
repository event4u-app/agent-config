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

**Evidence-pointer grammar (v1):**

- `path/to/file.md` or `path/to/file.md:42` — the repo file exists (line advisory).
- `path/to/file.md#substring` — the file exists AND contains `substring`.
- `https://… (YYYY-MM-DD)` — external cite carrying a dated stamp (not fetched in CI).

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
- evidence: .github/workflows/publish-npm.yml#lint_agent_security
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
- evidence: src/scripts/skill_eval_coverage.ts#checkRatchet
- status: backed
- last_verified: 2026-07-08

### claim: domain-soundness-scoped
- claim: The non-coding domain skills (finance/founder/ops/content) are forged on TS/PHP and labeled unvalidated until they pass a sourced domain-truth fixture; no public prose implies proven domain correctness, and the validated count is CI-ratcheted.
- kind: qual
- evidence: src/scripts/domain_soundness_status.ts#checkRatchet
- status: backed
- last_verified: 2026-07-08

### claim: domain-soundness-validated-count
- claim: The validated non-coding domain-skill count is pinned and CI-ratcheted at a maintainer-set floor (9 of 20 default-surface skills carry a sourced `evals/domain-truth.json` fixture at pin time, 2026-07-11 — 5 deterministic, keys from cited formulas; 4 rubric, criteria matching a named external practice); the floor only rises via a maintainer `--write-floor` after a new sourced fixture lands.
- kind: quant
- evidence: internal/evals/domain-soundness-floor.json#validated
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

### claim: second-brain-retrieval-precision
- claim: Removing the perfect-retrieval assumption, the substrate's REAL keyword retrieval recalls the needed decision into the top-5 under keyword-overlapping confusers (precision@5 9/9) and the model disambiguates it from the co-injected confusers — retrieval-on 27/27 vs no-memory 5/27 and vs equal-count placebo 5/27 (claude-haiku-4-5, 9 tasks x 3 seeds, sign test p=0.008 both). Named limit: retrieval RECALLS but does not RANK (mean tie-set 3.3, ties broken by store order, not relevance) — the discrimination gap that motivates the SQLite-FTS5 activation path (ADR-116) at larger scale.
- kind: quant
- evidence: internal/bench/reports/second-brain-retrieval.json
- status: backed
- last_verified: 2026-07-09

### claim: lexical-ranking-lift
- claim: A hand-rolled, dependency-free BM25 + trigram lexical index resolves the "recalls but does not rank" gap: on the retrieval-precision corpus (9 keyword-overlapping-confuser tasks) it drives the mean top tie-set from 3.333 (the `_score` bucket scorer) to 1.0 — every needed decision uniquely top-ranked — with precision@1 and precision@5 unchanged at 1.0. Method: deterministic, model-free re-ranking of the SAME retrieved entry set; both scorers measured over the identical store via `measure_lexical_ranking.ts`.
- kind: quant
- evidence: internal/bench/reports/lexical-ranking.json
- status: backed
- last_verified: 2026-07-09

### claim: context-token-reduction
- claim: A MEASURED-BUT-NOT-SHIPPED experiment — the thin rule projection reduced eager rule load 78,513 → 13,881 GPT-tokens (whole always-loaded projection 98,529 → 33,897, ~65.6%), but FAILED the quality gate (thin win-rate 36.2% vs required 48%) and does not ship; it un-defers only behind `discipline_profile: essential`. Shipped behavior does NOT include this reduction. Method: `agent-config benchmark` over the pinned token baseline; the baseline is the honest "what the user pays if everything loads eagerly", NOT a synthetic full-corpus strawman (council Q4); quality gate per the Phase-0 paired judge run.
- kind: quant
- evidence: internal/bench/reports/token-baseline.json#eager_rule_load
- status: backed
- last_verified: 2026-07-12

---

## Unbacked inventory (documented debt — not yet markered in prose)

These are real README claims that need a durable binding before they may carry a
`<!-- claim: -->` marker. Counts are drift-prone: binding them requires a
count-source mechanism (a generated number the prose must match). That
mechanism now exists (road-to-truth-and-reference-hygiene Phase 1):
`update_counts.ts` generates every prose count from source, and
`check_artefact_count_messaging.ts` fails CI on any count-shaped prose
mention that drifts or is internally inconsistent — so the three count
claims below are `backed`. Remaining entries are listed so the debt is
visible, not hidden.

### claim: skill-count
- claim: 278 skills.
- kind: quant
- evidence: src/scripts/check_artefact_count_messaging.ts#Artefact-count messaging gate
- status: backed
- last_verified: 2026-07-08

### claim: command-count
- claim: 190 commands.
- kind: quant
- evidence: src/scripts/check_artefact_count_messaging.ts#Artefact-count messaging gate
- status: backed
- last_verified: 2026-07-08

### claim: rule-count
- claim: 105 governed rules.
- kind: quant
- evidence: src/scripts/check_artefact_count_messaging.ts#Artefact-count messaging gate
- status: backed
- last_verified: 2026-07-08

### claim: host-agent-count
- claim: Compiled into 7+ host agents (Claude Code, Cursor, Augment, Cline, Windsurf, Copilot, Gemini).
- kind: quant
- evidence: stays unbacked pending a machine-readable projection-targets list — the concrete binding artifact is `src/config/surface-matrix.yml` (authored by road-to-install-path-convergence Phase 2, per the 2026-07-07 install-path council); once it exists, bind the count to that file and flip. Triaged 2026-07-08 (truth-and-reference-hygiene P3): do NOT bind to prose host tables (`docs/enforcement-by-host.md`) — a substring pointer cannot verify a count.
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

### claim: persona-identity-placebo-null
- claim: On a 12-fixture option-decision corpus (3 arms × 2 providers, blind rubric judge claude-opus-4-8, pre-registered hypotheses), famous-figure identity framing added nothing beyond the underlying method text (method 5.04 vs figure 4.88, Δ=0.17, sign-test p=0.607), and provider diversity moved judged quality ~15× more than persona identity (provider Δ=2.58 vs identity Δ=0.17); the whole persona layer lifted only +0.08 over bare prompts. Honest null — persona panel-mode stays CUT, evidence-closed.
- kind: quant
- evidence: internal/bench/reports/persona-placebo.json#honest-null
- status: backed
- last_verified: 2026-07-12

### claim: retrieval-substrate-live-pass
- claim: On the live end-to-end retrieval benchmark (9 tasks × 3 arms × 3 seeds on claude-haiku, fixture store with keyword-overlapping confusers), the memory retrieval substrate scored precision@5 = 100% (9/9) with 100% poisoned-entry rejection, and the retrieval-on arm passed 27/27 model-scored tasks vs 2/27 with retrieval off and 4/27 with a placebo injection. Known limit stays published: mean tie-set 4.1 means top-k ties break by store order, not relevance (the ADR-116/FTS5 signal).
- kind: quant
- evidence: internal/bench/reports/second-brain-retrieval.json#retrieval-on
- status: backed
- last_verified: 2026-07-12

### claim: cross-model-parity-count
- claim: The first cross-vendor parity pass (5 orchestration-corpus tasks × 2 vendors × 3 repeats, identical prompts via the council transport, $0.16) measured real per-host finding-count differences — claude-sonnet-4-5 surfaced ~2× the findings of gpt-4o on the multi-file analysis task (median 11 vs 5) while both vendors were identical on the planted hollow-implementation task (2 vs 2) and perfectly silent on the clean-code negative control (0 vs 0, no spurious findings). The per-task `finding_floor` values are calibrated from the cross-host lower envelope and the gate is armed.
- kind: quant
- evidence: internal/bench/reports/parity-count.json#min over hosts of median
- status: backed
- last_verified: 2026-07-12

### claim: adversarial-council-finding-coverage
- claim: On the residual defect pool (planted defects that survive a single strong cross-model judge), an adversarial panel of >=2 distinct-vendor skeptics finds materially more residual defects than that single judge — relative residual-recall lift >= +25% AND absolute >= +8 percentage points — at a false-positive rate on a controversial-but-correct control no worse than the single-judge baseline (within noise). Scope: finding coverage, NOT decision quality (the separate, unbacked council-vs-solo-baseline question). Pre-registered; honest-null (either threshold missed or FP worse) keeps the surface off by default permanently.
- kind: quant
- evidence: docs/benchmark.md#adversarial-verification-council
- status: unbacked
- last_verified:
