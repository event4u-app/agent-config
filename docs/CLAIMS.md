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
property of the machine.

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
- claim: 14 of 107 governed rules (13.1%) carry a backstop that fails a CI build. The number is RESOLVED, not declared — a `validator:` counts only when the script exists AND a GITHUB WORKFLOW reaches it (transitively, so a sub-check under a wired umbrella counts), and a hook registered `fail_closed: false` resolves to `observer`, never `validator`. The figure was 14 before this correction too, and it was wrong: the resolver treated `taskfiles/` and `.github/workflows/` as one corpus, so "named in a taskfile" counted as blocking — while NO workflow invokes `task ci`, `ci-strict`, or `ci-fast`. Nine of the thirteen validators only ran when a human typed the command. Split into `validator` (CI runs it) and `validator-local` (only a taskfile does), the honest figure was 5 of 107; wiring the nine into `rule-backstops.yml` returned it to 14, this time meaning what the headline says. `local_only` is now 0 and is ratcheted, so a gate cannot drop back out silently. Wiring them also surfaced that FIVE were already failing invisibly — 37 findings, baselined in `rule-backstop-debt.json` and ratcheted against growth. 86 rules declare nothing and count as uncovered, not excluded.
- kind: quant
- evidence: exec:check_enforcement_coverage --check -> 0
- status: backed
- last_verified: 2026-07-25

### claim: skill-count
- claim: 281 skills.
- kind: quant
- evidence: exec:check_artefact_count_messaging -> 0
- status: backed
- last_verified: 2026-07-08

### claim: command-count
- claim: 190 commands.
- kind: quant
- evidence: exec:check_artefact_count_messaging -> 0
- status: backed
- last_verified: 2026-07-08

### claim: rule-count
- claim: 107 governed rules.
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
- claim: The only agent layer that publishes the runs where it changed nothing. Deliberately falsifiable — if a reader finds a comparable agent layer publishing its own honest-null benchmark runs, this line updates; that is the point.
- kind: comparative
- evidence: docs/benchmark.md#honest
- status: backed
- last_verified: 2026-07-20

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
