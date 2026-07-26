---
complexity: structural
status: ready
---

# Roadmap: Feedback 9.8.0 Follow-ups — stabilize, prove, dispose, decide

> **Source:** seven independent external review passes of Release 9.8.0
> (`agents/tmp.old/feedback-9.8.0-1.txt`, verdicts 9.5–9.8/10 and 2× 119/120).
> **Council:** AI council debate 2026-07-26 (anthropic/claude-sonnet-4-5 +
> openai/gpt-4o, 2 rounds) converged on the cut below — Q1–Q7 verdicts are
> inlined in § Council convergence. **Activated 2026-07-27 by maintainer decision.**

## Goal

Convert the 9.8.0 review convergence into the smallest set of verifiable
follow-ups that (a) make the release externally installable and honestly
described, (b) prove or bound the one big unproven subsystem (code graph),
(c) shrink the visible debt the new enforcement machinery exposed, and
(d) force the two oldest open *decisions* (launch, honest-null disposition)
into falsifiable, recorded form — **without scheduling any new large
subsystem**, per the freeze all seven reviews converged on.

The strongest repeated reviewer signal: the package's next quality jump must
come from **modularized positioning, external field validation and real
disposition of unproven surfaces** — not from another capability.

## Council convergence (2026-07-26, claude-sonnet-4-5 + gpt-4o, 2 rounds)

- **Q1 product identity** — no identity crisis to decide: ADR-124 already IS
  the decision (governance layer + optional Class-A engines, never
  mandatory). Update the POSITIONING TEXT to say what ADR-124 decided;
  **reject multi-package modularization** (~10 weeks of repackaging for zero
  external users; reversible doc fix instead).
- **Q2 code-graph benchmark** — **2 arms only** (graph vs grep/native
  search); external-index/language-server arms would require integrating new
  subsystems, which the freeze prohibits. Pre-registered questions + real
  repos. Null consequence is physical: `code_graph.enabled: false` stays
  permanent, deprecation next major, removal the major after — never a
  silently maintained engine.
- **Q3 taxonomies** — reject ALL three proposed new taxonomies (R1 claim
  levels, R3 7-level enforcement gate, R5 5-level classification). The two
  axes already exist (claims ledger `kind:`/evidence pointers; enforcement
  levels `validator`/`validator-local`/`observer`/`none`). Surface the
  EXISTING axes on the proof page; invent nothing.
- **Q4 freeze shape** — unblock-list freeze (falsifiable exit conditions),
  not a standing WIP cap (accounting theater for a solo maintainer) and not
  an undated "1–2 releases" freeze (no exit condition). This roadmap is the
  instrument of the freeze, not subject to it.
- **Q5 honest-null cleanup** — default-off + deprecation notice + scheduled
  removal at the next major unless external evidence appears. Physical
  removal mid-cycle is irreversible; "never built" is wisdom for new
  features, not a time machine for shipped ones.
- **Q6 new mechanisms** — **REJECT** the host×task evidence router and the
  knowledge-security subsystem for this window: both are new subsystems the
  freeze exists to refuse, regardless of how thin "just wiring existing
  measurements" sounds.
- **Q7 launch** — the roadmap cannot post (maintainer Hard-Floor call), but
  it CAN make non-launch falsifiable: an ADR recording either the go or "no
  public launch before X, because Y" with an expiry. Fifth consecutive
  review cycle with this as the single missing point; the adoption strategy
  deserves the same falsifiability standard as every feature.

## Non-goals — routed or rejected (do not rebuild here)

**Routed to existing roadmaps:**

- Launch/adoption EXECUTION (posting, directories, activation measurement) →
  `road-to-adoption-without-narrative-debt.md` (ready). This roadmap only
  adds the decision ADR (Phase 1).
- Second maintainer / bus factor (R5 P2, "biggest structural risk") →
  `road-to-maintainer-bus-factor.md` (ready).
- `cross-source-consistency` behavioral eval (R6: "fourth review, unchanged
  open") → `road-to-feedback-9.2.0-followups.md` Phase 1; Phase 1 here only
  forces the execute-or-park decision.
- Lazy-catalog / request-scoped rule load A/B (R5 unblock item) →
  `road-to-request-scoped-rule-load.md`.
- Reach channel expansion (Twitter login, Reddit sessions, YouTube,
  transcription) → parked reach roadmaps in `later/`; standing rule stays:
  **no new channel without real demand** (R3 P2, R4 P6).
- Physical command consolidation mechanics beyond Phase 4's scope →
  `road-to-surface-consolidation.md` (extend, don't fork).

**Rejected (council-confirmed):**

- Host×task evidence router (R4 Priority 1) — new subsystem under freeze;
  static profiles have not measurably failed.
- Knowledge-security subsystem (R4 Priority 9) — real gap, wrong window;
  revisit after the freeze's unblock list clears.
- Multi-package modularization (R1 Option A mechanics) — positioning text
  fix instead (Phase 1).
- Any new claim/enforcement taxonomy (R1/R3/R5) — surface existing axes
  (Phase 3).
- Standing WIP cap 2+2+1 (R4 Priority 8) — replaced by the unblock-list
  freeze (Phase 1).
- Subagent safety-floor technical attestation (envelope schema, floor
  version telemetry — R4 Priority 5) — the floors are now projected and
  tested; the attestation layer is a new mechanism, deferred until a host
  integration actually consumes it.
- Embed-contract SemVer hardening (R4 Priority 7) — under the freeze the
  GUI does not grow, so the v1 contract has no second consumer yet; becomes
  relevant the moment host work resumes.
- Utilization sweep decisions before the pre-registered window elapses
  (~2026-08-26) — let the window run; Phase 4 schedules the decision AFTER
  expiry, never preempts it.

## Phase 0 — Stabilization floor: installable, honest, convention-clean

> Small, verifiable fixes that make 9.8.x externally consumable. No new
> mechanisms. Reviewer sources: R5 P1 (release E2E), R5 (GUI announcement),
> R6 P2 (Tests line), R7 (spawn-env residue), R5 P1 (proof claim).

- [ ] **Release install E2E in the release path, non-skippable.** One
  scripted run: `npm pack` → fresh global install → postinstall (GUI
  start honored/suppressed) → upgrade from 9.7.0 → WASM/tree-sitter load →
  `code_graph` build on a fixture repo → embed ping → `reach:doctor` →
  secret-gate smoke → clean uninstall (no orphaned globals). Wire it so a
  release PR cannot merge with this job skipped (the 9.8.0 release-PR
  context skipped tests + Public Install Smoke — that must be structurally
  impossible, not remembered).
  *Verify:* the job runs and passes on a release-shaped branch; a release PR
  with the job skipped fails its gate.
- [ ] **Install-time side-effect honesty** (rewritten 2026-07-26 — the
  original wording presumed a LIVE GUI-launching postinstall; verification
  showed the declared postinstall is DEAD, and its removal is owned by
  `road-to-credible-install.md` Phase 0). Narrowed scope: no install-time
  GUI side effect may exist silently. If a GUI launch is ever deliberately
  (re)introduced on any surface, it announces itself ("GUI launched; set
  `AGENT_CONFIG_NO_UI=1` to disable", exact env var per implementation)
  and honors the suppress var; until then, the GUI notice prints on first
  CLI invocation instead.
  *Verify:* fresh install runs no silent GUI side effect; first CLI
  invocation prints the notice; the suppress var is honored wherever a
  launch exists.
- [ ] **Changelog convention repair.** Add the aggregate `Tests: NNNN (+N
  since 9.7.0)` line to the 9.8.0 section (the `### Tests` commit list
  exists; the count line broke a five-release convention) and add the
  presence check to the release flow.
  *Verify:* line present; release-flow check red when absent.
- [ ] **Spawn-env residue.** Add `GIT_DIR`, `GIT_INDEX_FILE`,
  `GIT_NAMESPACE` to the `hardenedSpawnEnv` strip list (path-redirection
  vectors, low severity, correctly deprioritized — but a one-line close)
  with a red/green test.
  *Verify:* test proves the vars do not survive the sanitized env.
- [ ] **Defuse the risky proof claim.** Replace `docs/CLAIMS.md` "The only
  agent layer that publishes the runs where it changed nothing" with the
  self-provable form (R5 wording): "We publish our own measured null results
  and retire or constrain features when the evidence does not support them."
  Keep the falsifiability note.
  *Verify:* claims check green; no "only" superlative remains in the entry.

## Phase 1 — Decisions made falsifiable: positioning, freeze, launch

> The three items that are decisions, not work — recorded so they stop
> recurring in every review. Reviewer sources: R1 P0 (identity), R3/R4/R5
> (freeze), R6 P0/R7 #1 (launch), R5 (trust-boundary ADR), R6 P1
> (execute-or-park).

- [ ] **Positioning text update (NOT repackaging).** State in README +
  positioning docs what ADR-124 already decided: a governance layer with
  optional, individually opt-in Class-A engines (code intelligence, gated
  reach, GUI, bench lab) — core stays content + governance; engines are
  never mandatory and never default-on without measured lift.
  *Verify:* the "content + governance layer, not a runtime" sentence is
  replaced by the doctrine-accurate framing; docs-consistency checks green.
- [ ] **Freeze contract as an ADR (unblock-list form).** No new large
  subsystem (new engine class, new platform integration, new persistent
  service, new channel) until ALL of: (a) code-graph benchmark decided
  (Phase 2), (b) baselined backstop debt ≤ 25 findings (Phase 3), (c)
  release install E2E green in the release path (Phase 0), (d) one real
  external usage session recorded OR the launch ADR explicitly defers with
  expiry. Explicitly names the evidence router and knowledge-security
  subsystem as refused under the freeze.
  *Verify:* ADR merged; freeze conditions each falsifiable (yes/no).
- [ ] **Launch decision ADR.** Either the maintainer greenlights posting
  (execution then runs under `road-to-adoption-without-narrative-debt.md`)
  or the ADR records "no public launch before <condition>, because
  <reason>" with an expiry date — the drafted-not-posted pattern (two
  announcements, two months) ends either way. Notes the utilization-window
  expiry (~2026-08-26) as decision input. **Posting itself stays a
  maintainer Hard-Floor call — this item is the record, not the act.**
  *Verify:* ADR exists with a dated, falsifiable condition; no third
  undated draft.
- [ ] **Trust-boundary escalation ADR** (R5): which risk class may not be
  downgraded, which verification is mandatory, whether a user may switch it
  off, weak-host behavior, permissible cost — the questions the 9.8.0
  classification work left open when it deliberately did not activate
  non-refusable escalation.
  *Verify:* ADR answers all five questions; no enforcement change ships
  without it.
- [ ] **Execute-or-park `road-to-feedback-9.2.0-followups.md` Phase 1.**
  Council-approved 2026-07-14, all boxes still open while the rule runs
  default-on unmeasured — the only default-on surface without a measurement
  point. Decide: run it this cycle or move the roadmap to `later/` with the
  parking reason recorded.
  *Verify:* that roadmap is either in execution (first boxes flipped) or in
  `later/` with a reason — not a third state.

## Phase 2 — Code-graph proof: 2-arm, pre-registered, physical null-consequence

> The engine is technically strong and product-unproven (reviewer scores:
> engineering 9.4–9.5, product evidence 6.5–7.5). ADR-124's own test —
> "changes WHAT the tool can answer, not just how fast" — is measurable.
> Council: 2 arms, P0/P1; extra arms rejected (each would require
> integrating another subsystem).

- [ ] **Pre-register the benchmark** (before any run): ~20 code-structure
  questions (impact analysis, call path, symbol ownership, refactor scope,
  hidden/dynamic dispatch, plus grep-optimal negative controls) across 3
  real repos (a Laravel monolith, a TypeScript frontend, a mixed PHP/TS
  repo); metrics: answer correctness, missed/wrong callers, false edges,
  tokens, wall time, cold-build amortization; win threshold declared before
  the run.
  *Verify:* pre-registration document committed before the first result.
- [ ] **Run arm A (host grep/search) vs arm B (native code graph)** on the
  registered questions; publish per-question rows, not just aggregates.
  *Verify:* results file with per-question verdicts; threshold comparison
  stated.
- [ ] **Bind the outcome.** Win → a claims-ledger entry binding the measured
  lift (and only then any default-nudge discussion). Null → record the
  honest null; `code_graph.enabled: false` becomes permanent, deprecation
  notice at the next major, removal the major after unless external
  evidence appears. Either way the "product-unproven" reviewer flag closes.
  *Verify:* claims ledger updated; disposition recorded; no unbound
  marketing of the engine remains.

## Phase 3 — Enforcement truth: debt down, existing axes surfaced, meters hardened

> The enforcement work exposed the debt honestly (14/107 blocking = 13.1%,
> 86 undeclared, 37 baselined findings across 5 gates); now the numbers must
> move — without chasing an artificial 100%. Reviewer sources: R1 P1, R4
> P4, R5 P0, R7 #3, R3 P1 (scanner), R3 P1 (evidence-engine meta-tests),
> R7 #4 (auto_apply).

- [ ] **Baselined-findings paydown.** The 37 pre-existing findings
  (framework-leakage 11, roadmap-refs 2, council-refs 5, external-sources
  18, token-optimizer 1) get an owner + fix-or-waive decision each; target
  ≤ 25 by end of this roadmap (the freeze unblock condition), each waiver
  carrying a reason + revisit condition. The ratchet (rise fails the build)
  stays.
  *Verify:* `internal/reports/rule-backstop-debt.json` total ≤ 25 with the
  ratchet green; every remaining finding has a recorded owner/reason.
- [ ] **High-risk backstop binding — the named list only.** Bind CI-failing
  backstops (or record `not-enforceable — honest`) for the high-risk set
  the reviews converged on: secrets (`secret-vcs-guard`), release/installer
  safety, data-loss surfaces, claims/number truth, projection correctness —
  cross-checked against R5's named rules (`security-sensitive-stop`,
  `tool-safety`, kernel-override guard). NO coverage target for the other
  ~90 rules: honest classification (`observer`/`none`) is the deliverable,
  not a percentage.
  *Verify:* enforcement-coverage report shows the high-risk set at
  `blocking` or explicitly `none` with rationale; `blocking_pct` movement
  reported but not targeted.
- [ ] **Surface the existing two axes on the proof page.** One generated
  table: per MUST rule its enforcement level (validator / validator-local /
  observer / none); per public claim its evidence form (pointer / exec /
  benchmark / prose). No new labels, no new taxonomy — projection of what
  the ledger and `enforced_by` resolution already know.
  *Verify:* proof page renders both axes from generated data; zero
  hand-written rows.
- [ ] **Evidence-engine meta-tests** (the engine that checks claims gets
  checked): fixtures for a false-positive script, a stale fixture, a
  manipulated denominator, a non-deterministic result, and a
  local-only-but-counted-as-CI gate — each must be caught red.
  *Verify:* meta-test suite red/green run committed; each failure mode has
  a fixture.
- [ ] **Secret-scanner adversarial fixture corpus**: base64-wrapped keys,
  multiline PEM, `.env` variants, JWTs, plus negative controls (hashes,
  UUIDs, example keys, redacted values); measure precision/recall/FP-rate
  and publish alongside the detector.
  *Verify:* fixture corpus in tests; measured rates published; FP rate on
  the negative controls bounded.
- [ ] **`auto_apply: TRUE` quality eval** (council auto-tiering — three
  releases old, the only default-ON without a quality counter-measurement):
  a small paired eval or an explicit downgrade to `ask`.
  *Verify:* eval result recorded or default changed; the R7 watch-item
  closes either way.

## Phase 4 — Disposition and physical surface (window-gated)

> Honest-null features get a recorded disposition instead of Schrödinger
> state; the physical surface starts shrinking where usage data allows.
> Reviewer sources: R1 P1, R5 P1 (190→<150), council Q5. **Gated on the
> pre-registered utilization window (~2026-08-26) — decisions run after it
> elapses, never before.**

- [ ] **Disposition record per honest-null survivor** — adversarial council
  mode, team mode, recursive verification, remaining reach-router
  artefacts: confirm default-off, add a deprecation note naming the null
  that binds it, schedule removal at the next major unless external
  evidence appears before then. Workflow-value survivors (council for
  perspective diversity / decision documentation) keep an honest "what this
  is NOT sold as" line.
  *Verify:* one disposition line per feature in the relevant contract/skill
  docs; no honest-null feature without a recorded disposition.
- [ ] **Archive obsolete bench roadmaps + artefacts** the nulls closed
  (reach-router bench roadmaps, superseded corpus notes) via the normal
  archive flow — repository surface, not history, shrinks.
  *Verify:* `agents/roadmaps/` active tree contains no closed-null bench
  roadmap; archives carry the closing note.
- [ ] **Utilization-window disposition (after ~2026-08-26).** When the
  pre-registered window elapses, run the KEEP / MERGE / DEMOTE / REMOVE
  sweep on commands + skills with the window's data; target the reviewers'
  190 → <150 commands direction by folding variants into cluster-head modes
  and deleting de-eligibled, unused commands — extending
  `road-to-surface-consolidation.md`, not forking it.
  *Verify:* post-window decision log exists; command count and the per-item
  decisions recorded; no pre-window deletions.

## Acceptance criteria (roadmap-level)

1. Release install E2E is structurally unskippable in the release path
   (Phase 0) — the 9.8.0 skip cannot recur.
2. Three ADRs exist and are falsifiable: freeze (unblock list), launch
   (go or dated defer), trust-boundary escalation (Phase 1).
3. The code graph carries either a bound lift claim or a recorded null with
   a physical disposition path (Phase 2).
4. Baselined backstop debt ≤ 25 with ratchet green; high-risk rules are
   `blocking` or honestly `none`; the proof page surfaces both existing
   axes with zero new taxonomy (Phase 3).
5. Every honest-null feature has a recorded disposition; the utilization
   sweep ran after (never before) its window (Phase 4).
6. No new large subsystem was started while this roadmap was open.
