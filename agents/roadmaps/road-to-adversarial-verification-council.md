---
complexity: structural
status: ready
execution:
  mode: autonomous
---

# Road to an adversarial verification council — a cross-model skeptic panel that maximizes defect-finding coverage on a real change

> **Draft — authored 2026-07-14, pending maintainer OK before execution.**
> Scope deliberately threads a narrow, evidence-supported corridor: almost
> every *decision-consensus* mechanism in the verify/council family is already
> built or is a recorded honest-null (see "Context — do not relitigate").
> The one un-mined, evidence-backed wedge is **adversarial verification as
> defect FINDING coverage** — not decision quality. This roadmap composes
> existing primitives into one wired surface and gates the whole thing behind a
> pre-registered falsifiable finding-coverage claim; honest-null is an allowed
> outcome.

## Goal

Ship one wired, opt-in, **advisory-only** surface that runs a panel of
**model-diverse adversarial skeptics** against a real, already-verified change —
each prompted to *break/refute* the change (red-team the implementation) — and
reconciles their output into a single **findings-by-severity verdict with
per-finding provenance and a cross-model confidence signal**. The panel
*verifies* (surfaces defects an injection, a hollow impl, a missing control, a
broken edge case) — it never decides accept/reject and never auto-gates
(Hard Floor). Ship it **default-off**, prove-or-drop it against a pre-registered
finding-coverage claim, and record an honest-null if the panel does not out-find
a single cross-model judge at a held false-positive rate.

## The falsifiable claim (pre-registered, `unbacked` at start)

```
claim: adversarial-council-finding-coverage
On the RESIDUAL defect pool — planted defects that SURVIVE a single strong
cross-model judge — an adversarial panel of >=2 distinct-model (cross-vendor)
skeptics finds materially more of the residual defects than that single judge,
at a held-or-lower false-positive rate on a controversial-but-correct control.
Dual threshold (both must hold):
  (a) relative residual-recall lift >= +25%, AND
  (b) absolute residual-recall lift >= +8 percentage points
  AND false-positive rate on the controversial-clean control not worse than the
      single-judge baseline (within noise).
Honest-null (either threshold missed OR FP rate worse) => surface disabled by
default permanently, recorded like recursive-verification.
```

**Council-corrected framing (2026-07-14, see Council notes).** The measured
target is **adversarial residual detection** — defects that survive a competent
first-pass judge — not raw multi-model detection. This is why the benchmark is a
**two-stage protocol** (Phase 4) and the threshold is **dual** (relative +
absolute), guarding against base-rate compression when the single-judge baseline
is already high.

This claim rests on the **backed** `cross-vendor-parity` signal (different
*providers* surface different real findings on multi-file analysis; both catch a
planted hollow impl; both stay silent on a clean control) — hence the skeptic
panel used for the registered run must be **cross-vendor**, not merely
cross-tier. It does **not** claim the council beats a solo model on *decision
quality* — that is the separate, `unbacked`, spend-gated
`council-vs-solo-baseline` question and is explicitly out of scope.

## Context — measured, do not relitigate

Established by a three-strand research pass (surface map + archived-roadmap
autopsy + infra inventory), 2026-07-14. These are landmines; the roadmap must
not re-propose any of them:

- **Recursion / self-correction re-attempt loop** as a capability or discipline
  lever — honest-null, benchmark-measured, council-terminal (ADR-106,
  `docs/benchmark.md § Recursive self-verification`, memory
  `recursive-verification-honest-null`). `verification.recursive` stays `off`.
  This roadmap does **not** add a re-attempt loop.
- **A judge -> revise -> re-judge loop** — already shipped as
  `verify-repair-loop` (N=3 cap, generator != judge, numeric threshold, opt-in,
  no daemon). Do not rebuild; compose with it.
- **The external council engine** — transport, multi-round debate (`rounds:N`),
  session persistence, cost-budget ledger, redaction, neutrality preamble, the
  chairman/stance-tally/debate-gate layer — all built (`src/scripts/council_cli.ts`,
  `src/scripts/ai_council/*`, ADR-120). Do not re-propose. The external council
  is **artefact-only / read-only (Hard Floor)** — never gets repo access, edits,
  PRs, or merges.
- **Personas / named-figure agents / persona panel-mode** — placebo-null
  (Delta=0.17, p=0.607; provider diversity moved quality ~15x more than persona
  identity), evidence-closed, living-person legal/brand risk. Skeptics are
  **model-diverse, not persona-diverse**.
- **Browser-automation / Playwright council members / web-subscription
  scraping** — maintainer-killed (council-modes Phase 2c). Not revived here.
- **A `--council` in-flow UX product surface / standardized verdict-report
  product layer** — stub, gated on `road-to-orchestration-scope-decision`
  Phase 3 + a demand signal. This roadmap ships a *verification* mechanism, not
  a marketing/visibility product; its verdict schema is an engineering contract,
  not a productized report.
- **Any claim that convening the council beats a solo strong model on decision
  quality** — no evidence exists, pre-registered `unbacked`, spend-gated. Out of
  scope.
- **Claiming orchestration/dispatch value as measured**, or building an
  agent-execution harness to measure it — unmeasurable in the no-runtime harness.
  This roadmap's claim is *finding coverage* on a static planted-defect corpus,
  which the existing bench:ab machinery already measures (that is how
  `cross-vendor-parity` was established).
- **Prose-computed tallies / reconciliation** — anti-lesson. The quorum and
  false-positive-refutation logic lives in TS with tests, never as LLM-computed
  prose.

## Reusable primitives (build ON these, do not rebuild)

- `src/skills/subagent-orchestration/SKILL.md` — form gate + 8 modes; Mode 6
  `judge-with-debate` is the nearest kin (2 judges + meta-judge, **strict-er
  wins** on one verdict). The new mode differs: its output is a **union of
  findings with provenance**, not one accept/reject verdict.
- `src/skills/subagent-orchestration/schemas/subagent-status.json` — the reusable
  return envelope (4 statuses, hand-validated by
  `tests/test_subagent_status_schema.py`, no jsonschema runtime dep).
- The 7 `judge-*` skills — reused as the skeptic *lenses* (bug-hunter,
  security-auditor, injection-defense, test-coverage, code-quality,
  artifact-completeness) + `judge-synthesis` (consume-only consolidation).
- `judge-bug-hunter` already carries a single-judge self-refutation pass for red
  findings — the panel generalizes that to N independent models.
- `src/agent-src/contexts/execution/verify-budget.md` + `subagents.judge_model` —
  the model-routing + escalation surface the panel plugs into as an opt-in tier.
- `src/scripts/council_cli.ts` — precedent + the ONLY path for cross-*vendor*
  external skeptics on the highest-risk tier (artefact/diff-as-text, read-only).
- The `cross-model Iron Law` (subagent-orchestration): a judge never runs on the
  same model as the implementer on the same context — the panel enforces it
  across all skeptics.

## Resolved design decisions (AI council, 2026-07-14)

**F1 — skeptic transport → RESOLVED: A everyday, B for the registered claim +
high-risk tier.** Everyday mode = in-session subagent panel with enforced
*model diversity* (host-native, no mandatory spend). The **benchmark run and the
opt-in high-risk tier require cross-*vendor* skeptics** via `council_cli.ts`
(artefact/diff-as-text, read-only) — the backed `cross-vendor-parity` signal is
provider-level, so the registered claim cannot rest on same-vendor model
diversity alone. (openai flagged the ambiguity; resolved here per the backed
evidence.)

**F2 — where the mode lives → RESOLVED: distinct 9th mode.** No council
objection. `adversarial-verification-council` is a distinct 9th
`subagent-orchestration` mode because its output contract is a **findings-union
with provenance**, categorically different from Mode 6 `judge-with-debate`'s
strict-er-wins single verdict.

---

## Phase 0 — Decision record, claim pre-registration, landmine clearance

No production code. Locks the shape before any build.

- [x] Run the AI council (deep, 2 rounds, anthropic claude-sonnet-4-5 + openai
  gpt-4o, 2026-07-14, actual $0.12) on THIS roadmap; forks F1/F2 resolved above,
  no landmine re-proposed, convergence folded into "Council notes" below +
  Phase 4 hardened per the residual-detection critique.
- [x] Write **ADR-122 — adversarial verification council (finding-coverage
  scope)**: records the finding-vs-decision scope split, the advisory/read-only
  Hard-Floor invariant, default-off, the F1/F2 resolution, and the prove-or-drop
  gate. Status: Accepted. (`docs/decisions/ADR-122-adversarial-verification-council.md`,
  in `docs/decisions/INDEX.md`.)
- [x] Pre-register `claim: adversarial-council-finding-coverage` in
  `docs/CLAIMS.md` with `status: unbacked` and an evidence pointer to the (not
  yet existing) bench section — inventory/debt, does not fail CI.
- [x] Record a one-paragraph landmine-clearance note in the ADR mapping each
  do-not-relitigate item to why this roadmap does not touch it. (ADR-122
  § Landmine-clearance.)

**Acceptance:** ADR-122 merged content present; CLAIMS entry present as
`unbacked`; council notes folded into this file; forks F1/F2 resolved in writing.

## Phase 1 — TS core: findings schema + reconciliation tally + tests

The countable heart. All reconciliation logic is TS with hand-rolled tests
(anti-lesson: never LLM-computed prose).

- [x] Add `src/skills/subagent-orchestration/schemas/adversarial-findings.json`
  (draft-07) — findings envelope: `findings[]` each with `{id, severity, category,
  location, description, raised_by[], refuted_by[], confidence}`, plus
  `panel {models[], skeptic_count}` and `false_positives_suppressed[]`,
  `additionalProperties: false`.
- [x] Add `src/scripts/_lib/adversarial_reconcile.ts` — pure deterministic
  functions: `reconcileFindings` (dedup by location+category, strict-er-wins
  severity), `severityQuorum` (confidence from corroboration), and
  `isSuppressedFalsePositive` (lone finding refuted by a strict majority of the
  rest → demoted to `false_positives_suppressed`, never dropped). Never gates.
- [x] Add `src/scripts/_lib/adversarial_reconcile.test.ts` (vitest, the repo's TS
  convention) — 19 tests: dedup, quorum-confidence math, FP suppression, empty
  panel, single-finding, unanimous vs split, determinism-across-order, malformed
  rejection, + hand-rolled schema validation. **Green: 19/19.**

**Acceptance:** schema + reconcile module + tests exist and pass locally
(`task typecheck-ts` + the schema test); reconciliation is deterministic and
covered for boundary cases.

## Phase 2 — The orchestration mode + skeptic prompts

- [x] Add Mode 9 to `src/skills/subagent-orchestration/SKILL.md`:
  `adversarial-verification-council` — dispatch N (default 2, cap per verify
  budget) **distinct-model** skeptics over a real, already-verified change; each
  skeptic is prompted to actively *break/refute* the change through one or more
  `judge-*` lenses and return the `adversarial-findings` envelope; reconcile via
  the Phase-1 TS core; emit findings-by-severity with provenance + confidence.
- [x] Add `src/skills/subagent-orchestration/prompts/adversarial-verification-council.md`
  — the skeptic prompt (red-team stance, "name one failure mode you actively
  looked for", one lens per skeptic) + the reconciliation/output contract.
- [x] Enforce invariants in the mode text: cross-model Iron Law across skeptics,
  N cap from verify-budget, **advisory-only / never auto-gates (Hard Floor)**,
  no daemon / no persistent runtime, reuse `subagent-status.json` for each
  skeptic return before reconciliation.
- [x] **Skill-reuse resolution (council):** the `judge-*` skills are reused as
  detection *engines* (the checklist — what security/test/quality dimensions to
  examine); the **adversarial objective is injected at the prompt level** (find
  breakage, not confirm correctness). `judge-bug-hunter`'s self-refutation is an
  *intra-skeptic* post-finding severity filter (runs within one skeptic before
  reconciliation) — the cross-model **quorum** is what provides the adversarial
  boost. State explicitly in the prompt that posture is red-team and
  self-refutation does not suppress cross-skeptic findings. **No skill fork.**
- [x] Cross-link Mode 6 (`judge-with-debate`) <-> Mode 9: Mode 6 = strict-er-wins
  single verdict for a go/no-go; Mode 9 = finding-coverage union. Update the
  mode-selection form gate.

**Acceptance:** Mode 9 documented with invariants; skeptic prompt present; the
skill still passes `lint-skills` + `lint-new-skill-gate` overlap checks; the
mode selection gate routes correctly.

## Phase 3 — Opt-in wiring + settings (advisory, default-off)

- [x] Add `subagents.adversarial_council` to
  `src/config/agent-settings.template.yml` — enum `off|ask|on`, **default
  `off`**, with a comment pointing to ADR-122 + the prove-or-drop gate. Updated
  the settings schema (`src/server/schemas/settings.ts`) + rebuilt the install
  bundle (`dist/install/install.mjs`, which inlines the schema); `validate_agent_settings` OK.
- [x] Add an opt-in escalation tier to `verify-budget.md`: for explicitly
  high-risk changes AND `adversarial_council != off`, the verify step MAY escalate
  to Mode 9 — recorded as `verify_mode: council` (added to the `VerifyMode` type
  in `verify_budget.ts`). Never automatic when `off`; never auto-gates.
- [x] Expose an opt-in flag on `/review-changes` (§ 4c) that runs Mode 9 as an
  alternative advisory input alongside the five-judge pass — human decides.
- [x] Confirm F1(B): cross-vendor is mandatory for the registered claim +
  high-risk tier (council-resolved); the optional external-skeptic path via
  `council_cli.ts` (artefact/diff-as-text, read-only) is documented in the mode +
  detail + prompt, behind the same `off` default.

**Acceptance:** settings key present + schema-validated + default off; verify-budget
escalation documented as opt-in advisory; `/review-changes` (or `/judge`) opt-in
flag documented; nothing fires when the key is `off`.

## Phase 4 — Benchmark arm + prove-or-drop gate (council-hardened)

Resolves the pre-registered claim. Execution is spend-gated (maintainer-authorized
paid runs). The council's single load-bearing critique — a corpus built for
cross-vendor *parity* measures the wrong thing and forces an honest-null as a
*measurement artifact* — is answered by the two-stage, residual-detection design
below. Do NOT run the registered arm until the corpus-validity gate passes.

- [x] **Corpus-validity gate (blocks the registered run).** Assessed the existing
  `internal/bench/orchestration/corpus/` (5 tasks, built for cross-vendor
  *parity* + A3): it does NOT meet the judge-survivable-subtlety bar (`pv-01` is a
  deliberately obvious hollow impl; none is a residual-defect design). Bar +
  assessment + required subtlety distribution documented in
  `docs/design/adversarial-council-eval.md`. Conclusion: registered run blocked.
- [x] **Two-stage benchmark protocol (explicit, not implicit).** Stage 1 strong
  single judge → Stage 2 panel on the judge-passed residual subset; recall
  measured on the residual. Specified in `docs/design/adversarial-council-eval.md`.
- [x] **Controversial-but-correct FP control.** Specified in the design doc — the
  clean control carries real perf/security tradeoffs + uncommon patterns, panel
  FP compared to single-judge FP on the SAME control.
- [x] **Panel = cross-vendor for the registered run** (F1): >=2 distinct
  *providers* (anthropic + openai) via `council_cli.ts`. Specified in the design
  doc + settings comment.
- [x] Define the pass/fail gate in TS exactly as the pre-registered dual
  threshold — `src/scripts/_lib/adversarial_council_gate.ts` (`evaluateCouncilBench`,
  RELATIVE_LIFT_THRESHOLD 0.25, ABSOLUTE_LIFT_THRESHOLD_PP 0.08, FP-not-worse),
  8 tests green (incl. the base-rate-compression + FP-regression cases). Threshold
  locked at pre-registration.
- [-] Run the arm (spend-gated) + resolve CLAIMS. **MOVED to follow-up roadmap.**
  Blocked by design on the corpus-validity gate (needs a curated
  judge-survivable-subtlety corpus with a published distribution before a
  maintainer-gated paid cross-vendor run) and the claim stays `unbacked`. Per the
  maintainer disposition, this deferred item is carried into a dedicated follow-up
  roadmap so the build phases above can archive complete. See
  `road-to-adversarial-council-benchmark.md` (corpus curation → registered run →
  claim resolution).
  <!-- moved: carried into road-to-adversarial-council-benchmark.md per maintainer disposition (spawn follow-up + archive) -->
  <!-- was: blocked — registered paid cross-vendor run needs a curated residual-defect corpus first (docs/design/adversarial-council-eval.md § corpus-validity) -->


**Acceptance:** corpus-validity gate documented with a published subtlety
distribution; two-stage protocol + controversial-clean control implemented;
cross-vendor panel recorded; dual-threshold gate reproducible; a verdict is
recorded; CLAIMS entry resolved (`backed` with evidence OR documented
honest-null); no false "backed" without a passing run.

## Phase 5 — Evals, triggers, docs, CI/sync green, PR

- [x] Add a Mode 9 behavior eval (`sao-adversarial-council-advisory-no-gate` in
  `src/skills/subagent-orchestration/evals/evals.json`): fires only when opted-in,
  emits a findings-union envelope, corroborated finding = high confidence, lone
  refuted finding demoted, and **never auto-gates** (advisory). subagent-orchestration
  already carries trigger-eval presence (mode added to an existing skill).
- [x] Descriptions updated (skill description carries the mode); `validate_frontmatter`
  410 artefacts 0 failing; `skill_linter` on the skill + delegation-policy pass
  (skill_too_large is a non-fatal warning — `lint-skills` runs without `--strict-warnings`).
- [x] Updated `docs/` (subagent-orchestration mode list + prompts README + modes-detail,
  verify-budget, benchmark.md, ADR-122, design doc). No capability-matrix entry
  needed — the new TS exports are not `generate_*` functions (coverage guard N/A).
- [x] `task sync` + `/condense` (6 edited + 4 dep-folded twins marked done) +
  `task generate-tools`; `sync-check` + `sync-check-hashes` clean;
  `check_condensation` passed; install bundle rebuilt.
- [-] `task ci` (full pipeline) — skipped per `roadmap-ci-steps-policy`
  (`quality.local_auto_run: false` → remote CI is the gate). Targeted changed-files
  static pass done instead: `task typecheck-ts` clean, vitest 27/27, `check_references`
  clean, `check_claims` OK, `lint_agent_security` clean, ADR index fresh.
  <!-- skipped: quality.local_auto_run=false → remote CI is the gate -->
  Then create the final PR.

**Acceptance:** full `task ci` green; projections regenerated; PR created with
the ADR, the mode, the schema+TS core, the settings key, the bench arm, and the
resolved/honest-null CLAIMS entry.

## Acceptance criteria (roadmap-level)

1. The surface is **advisory/read-only, default-off**, never auto-gates a change
   (Hard Floor honored).
2. It **composes** existing primitives (subagent-orchestration, judge-*,
   subagent-status envelope, verify-budget) — no rebuilt council engine, no
   recursion loop, no persona layer, no browser automation, no `--council` UX
   product.
3. All reconciliation logic is **TS with tests**; nothing countable is
   LLM-computed prose.
4. The value claim is **finding coverage** (not decision quality), pre-registered
   and resolved by a reproducible bench arm; **honest-null is an accepted
   outcome** and keeps the surface inert-by-default.
5. `task ci` is green and projections are regenerated before the PR.

## Council notes

AI-council debate, 2 rounds, **anthropic/claude-sonnet-4-5 + openai/gpt-4o**,
2026-07-14, roadmap input mode, actual $0.12
(`agents/runtime/council/responses/adversarial-verification-council-challenge.json/`).
Necessity: borderline (5 necessary / 6 unnecessary) — proceeded.

**Convergence — the one load-bearing finding (both members).** The architecture
is sound and the composition-over-rebuild + landmine-avoidance is validated; the
single real risk is **Phase 4 measurement validity**. A corpus built for
cross-vendor *parity* (models catch different *obvious* things) does not simulate
the post-single-judge residual state space, so an honest-null would reflect
*measurement failure*, not mechanism failure. Answered by hardening Phase 4:
two-stage protocol (judge → panel on judge-passed residual), corpus-subtlety
gate + published distribution, dual threshold (relative + absolute pp floor),
controversial-but-correct FP control.

**Secondary, resolved:**
- *Skill-reuse tension* (anthropic R1 raised, R2 self-resolved): reuse the
  `judge-*` checklists as detection engines; inject adversarial posture at the
  prompt; self-refutation is intra-skeptic; cross-model quorum is the boost — no
  fork. Folded into Phase 2.
- *F1 model-diversity sufficiency* (openai flagged unresolved): resolved to
  cross-*vendor* for the registered claim + high-risk tier; model-diverse
  in-session for everyday use. Folded into "Resolved design decisions" + Phase 4.
- *Iterative benchmarking* (openai): corpus/protocol may be refined before the
  registered run; the **threshold is locked at pre-registration** (no post-hoc
  shopping). Folded into Phase 4.

**Not overridden:** the finding-coverage (not decision-quality) scope, the
default-off / advisory / Hard-Floor invariant, and the honest-null-is-acceptable
exit all survived the debate unchallenged.
