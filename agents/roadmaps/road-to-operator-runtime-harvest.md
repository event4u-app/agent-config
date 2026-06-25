---
complexity: structural
status: ready
---

# Road to operator-runtime harvest — cross-model parity is the keystone; gate the rest on it

**Trigger:** User ask — deep-dive a hyped, high-star external Claude-Code
skill-pack ("level up our package"), run the AI council, be critical, and plan
the adoption. Sharpened by a second pass: a strong third-party model analysis
(both repos cloned fresh) plus a two-member critical council.
**Mode:** Harvest plate. The adoptable work is **one dependency chain**, not a
menu of independent units (see § Dependency graph). Source referenced
source-anonymously per `source-confidentiality`; real link as an `ENC1:` token
in § Provenance.

- **Source A** — an external, high-momentum operator-runtime / Claude-Code
  skill-pack reference (role-based slash-command suite + a headless-browser
  daemon; runtime-agnostic install across 5+ AI tools).

## Goal

Source A is a **direct category peer**, not an app starter. Its loudest public
criticism — *"just prompts in text files, no validation"* — is precisely the gap
this package already closes (linters, condensation gates, CI, trigger-evals,
frontmatter schema, `CAPABILITIES.yaml`). So adoption is **not** "copy Source A";
it is "extract the small slice of genuine engineering we lack, **without**
importing its runtime identity," and sequence it by its real dependency chain.

The decisive finding of the critical pass: the highest-leverage move is **not**
Source A's flagship mechanic (per-model behavioral `model-overlays/`). It is
**cross-model e2e parity** — because (a) it closes our one *existential
falsifiability gap* (we claim multi-tool/multi-host but eval Anthropic-only), and
(b) it is the **prerequisite** that gates and calibrates everything else. Most of
Source A's surface we already ship; its flagship is gated by our own honest-null.

## Provenance of the comparison (anti-stale-clone discipline)

Verified against **this repo at HEAD (v7.0.2)**, not the third-party analysis's
clone. The council flagged stale-clone risk explicitly, and the check paid off —
two third-party "gaps" were **already shipped**:

- **slop/originality CI gate** → ALREADY-HAVE (`src/scripts/lint_skill_originality.ts` + allowlist).
- **LLM-judge-style eval** → PARTIAL ALREADY-HAVE (a `rubric` assertion kind exists in `src/scripts/run_skill_evals.ts`).

Confirmed-real gaps at HEAD: `model-overlays/` absent; no `finding_floor`
assertion kind; evals run **Anthropic-only**; no skill-size *undershoot* floor;
no runtime destructive-command-content gate (we have it as rules + a PreToolUse
surface, not as enforced content).

## Council signal (two-member, design lens, 2026-06-23)

Genuine two-voice council this pass (Anthropic Sonnet 4.5 + OpenAI GPT-4o — the
first run's Anthropic member had timed out; this one returned). Strong
convergence:

- **`model-overlays/` → GATE, do not adopt now.** Our own discipline-axis
  benchmark hit **honest-null at micro scale** (Wilcoxon p=1.0 — no lift; a
  strong host is "already disciplined"). That is a *falsification* at current
  scale, not missing data. RDP already encodes host-behavior discipline
  generically. Per-model overlay files are a recurring single-maintainer
  maintenance tax with no proven ROI.
- **Gate overlays on the *achievable* trigger, not the unrunnable one.** The
  Anthropic member's sharpest point: the meso-pilot that might surface lift may
  be **unrunnable** (weak hosts disappear from the market; baselines drift), so
  do **not** gate overlays on "meso-pilot runs." Gate them on **"cross-model
  e2e exposes RDP failure on a host"** — which the keystone work produces anyway.
- **Cross-model e2e = highest leverage AND a prerequisite.** It forces
  resolution of the overlay question and calibrates `finding_floor`.
- **`finding_floor` depends on cross-model e2e.** Thresholds are model-dependent;
  an Anthropic-only floor is a false baseline that breaks when GPT/Gemini run
  (terse models → fewer findings). Calibrate floor = ~p10 across hosts, with a
  human-labeled gold set + inter-annotator agreement ≥0.7. It is a 3–5 day item
  (labeling included), not 1.
- **Root error of the third-party plan: assuming the units are independent.**
  They are a chain (see below).
- **`careful`/`freeze`/`guard` runtime content → route to the sibling plugin,
  reject for core.** `<careful>` tags without execution control are a
  credibility/capability mismatch and violate the no-runtime identity.
- **New P0 open question the council surfaced:** does the suite govern *output
  format* (schema/diff-format) or only *behavior* (RDP)? Cross-model e2e may
  expose all hosts passing RDP yet producing *incompatible output formats* — a
  format-governance gap, not an overlay problem.

Session artefacts live under `agents/runtime/council/responses/` (gitignored,
auto-pruned; not part of the tracked surface).

## Verdict table (verified against HEAD; ranked by leverage for our identity)

| Candidate (Source A) | Verdict | Reason |
|---|---|---|
| **Cross-model e2e parity** (eval against a 2nd + 3rd vendor) | **ADOPT — keystone** | Closes the existential falsifiability gap (multi-host parity is currently *unproven*); the prerequisite that gates overlays + calibrates `finding_floor`. |
| **`finding_floor` eval kind** (≥N substantive findings) | **ADAPT — after keystone** | Builds on the existing `rubric` kind. Must be calibrated from cross-model finding-count distributions + a labeled gold set; useless (and falsely-baselined) before parity exists. |
| **size-budget undershoot-floor + audited override** | **ADAPT — after finding_floor** | Distinguishes "small=good" from "small=truncated" — only meaningful once `finding_floor` exists. Small once unblocked. |
| **Output-format governance** (council-surfaced) | **INSTRUMENT in P0; decision-gated** | The P0 smoke emits an output-shape fingerprint per host (cheap now, expensive late). But the council (3rd pass) **rejected promoting it to a first-class P2 without evidence** — falsifiability-first: build format governance only if the keystone shows divergence actually occurs. |
| **Skill-graph / workflow-graph engine** (file-2 proposed it as P3) | **STAY KILLED** | We already KILLED per-skill skill-DAG (sequencing chicken-egg; archived disposition) and `work_engine/` already runs a directive graph for `/work`. No delta beyond work_engine; fails the reopen trigger. Council converged: stay killed. |
| **`model-overlays/`** (per-model behavioral patch) | **GATE (default-off)** | Falsified at current scale (honest-null); duplicates RDP; maintenance tax. Reopen *only* if the keystone exposes RDP failure on a real host. |
| Real-browser QA auto-fix loop | **ADAPT (orchestration-only)** | User-approved prior pass: an authoring-time skill wrapping our Playwright skills + an enforcement gate. NOT a binary/daemon. Lower leverage than the discipline-core; parallel track. |
| Repositioning narrative ("cross-model governed agent infrastructure — write once, run consistently across Claude/Codex/Gemini/Cursor") | **ADAPT — but sequence AFTER parity** | Council: the right narrative, but claim only what P0 proves. Drop "AI OS / AI team" framing for the portability claim *once the keystone demonstrates it*; not before. Supersedes the weaker "one builder, team scale" packaging. |
| slop/originality CI gate | **ALREADY-HAVE** | `lint_skill_originality.ts` ships. (Third-party plan was stale here.) |
| LLM-judge eval | **PARTIAL ALREADY-HAVE** | `rubric` assertion kind ships; `finding_floor` is the genuine delta. |
| Cross-model code review in-flow | **ALREADY-HAVE** | AI Council (5-provider, debate, peer-review, cost-gated) > Source A's single-vendor `/codex`. |
| `careful`/`freeze`/`guard` runtime content | **REJECT (core) → route to plugin** | No-runtime scope trap; route the destructive-command-content gate to the sibling `agent-ide-plugin` (P-plugin). |
| Browser daemon + L1–L6 security | **REJECT (core) → route to plugin** | Compiled runtime betrays no-runtime identity; the *security lessons* (canary token, port-separation, egress sanitization) belong in `agent-ide-plugin`. |
| Doc export HTML→PDF/DOCX; iOS QA | **REJECT / DEFER** | Scope creep / no demand signal (`domain-adoption-policy` gate unmet). |
| "Boil the ocean" ethos | **REJECT (explicit)** | Direct opposite of our falsifiability-first / default-off / honest-null culture; would dilute the core moat. |

## Dependency graph (this is one chain, not a menu)

```
P0  cross-model e2e parity ──┬──► P1  finding_floor (calibrated from P0 distributions)
   (keystone; also surfaces  │         └──► P2  size-budget undershoot-floor
    output-format question)  │
                             └──► [GATE] model-overlays — open ONLY if P0 shows
                                          a host failing RDP. Else stays shelved.
parallel / independent: QA-orchestration-skill · lifecycle packaging · plugin transfer
```

## Scope guard

- This roadmap is the **deliverable the user asked for** (authoring). Executing
  any phase is a **separate** decision (`scope-control § authoring vs
  implementation`) — get an explicit go-ahead. (The QA-orchestration-skill's
  *design* decision was already resolved with the user; its *execution* is not.)
- The GATE and REJECT rows are load-bearing. Reopening overlays requires the P0
  RDP-failure trigger; reopening browser/doc/iOS requires the three
  `domain-adoption-policy` gates (demand + maintainer + CI).
- Every new artefact passes the existing floors unchanged (`skill-quality`,
  `size-enforcement`, `framework-neutrality`, `lint_skill_originality`),
  condensed from `src/` via `/condense`.
- **Governance floor (the council's sharpest trap): an AI-generated analysis is
  NOT a demand signal.** This whole harvest was seeded by model-written reviews.
  Their *verified facts* (a real injectable seam, a real `sk-ant-` gate) are
  evidence; their *proposals* (skill-graph, format-governance, overlays) are
  hypotheses. Reopening a killed decision (skill-DAG) or opening a new domain
  requires empirical **user** demand — concretely: ≥2 consumer projects, a named
  user ask with a target, or a reproduced external incident (`domain-adoption-policy`)
  — never "two models suggested it." Define the skill-DAG reopen trigger as that,
  not a model's enthusiasm.
- **Rollback/kill-switch (recurring council ask):** each new gate (T-003/004/005,
  finding_floor, undershoot) ships default-off or behind its tier until its
  baseline evidence lands; a red gate with no calibrated baseline is reverted, not
  tuned-to-green.

---

## Phase 0 — Cross-model e2e parity (keystone; everything downstream gates on it)

Goal: prove the multi-host claim and produce the per-model evidence that gates
overlays and calibrates `finding_floor`.

> **Verified extension points (HEAD `b7ec30b6`).** `src/scripts/skill_trigger_eval.ts`
> exposes an injectable `TriggerRouter` (`:124`, alongside `MockRouter`/`AnthropicRouter`)
> — the clean seam for `CodexRouter`/`GeminiRouter`. The first portability landmine is the
> hard `sk-ant-` key gate (`:416`) — add per-vendor gates *alongside* it, never weaken it.
> No `EVALS_TIER` exists in CI yet, so the gate/periodic split below is **net-new infra**,
> not a config toggle. A ready 6-ticket Phase-0 bundle (T-001…T-006, SHA-pinned, with
> `must_touch`/`must_not_touch` + dependency graph) exists and can be materialised via
> `/roadmap:materialize` — do **not** auto-create external (Linear) issues without permission.

- [x] **T-000 · Capability matrix (3rd-pass add — before the smoke).** Build an explicit matrix (tool-calls / structured-output / long-context / function-routing × Claude/Codex/Gemini) so a later parity failure is attributable to a **capability gap** vs a **behavior gap**. This is load-bearing for the overlay gate: overlays only make sense for a *behavior* gap — a capability gap is a host limitation, not something an overlay fixes. Reuse the existing `model_tier.ts` capability data where present; do not re-derive.
- [x] **T-001 · Fixture-portability audit (do FIRST — the council's hidden-cost warning, read-only).** Inventory eval fixtures: what % hardcode Anthropic-specific responses (citation/tool-call shape, the `sk-ant-` gate)? **Also report the coverage denominator** — at HEAD there are ~32 trigger fixtures and **0 behavioral `evals.json` fixtures across 252 skills**, so the rubric/finding harness is effectively unused. Output a portability % + a port list + the real coverage fraction. No new runs.
- [x] **T-002 · Vendor prereqs + tier decision (human-gated).** Confirm API credits for vendor #2 (Codex CLI) + #3 (Gemini); CI parallel-vs-serialize; per-run cost. **No credits → explicit BLOCK on the smoke; never claim parity on mocks.**
- [x] **T-003 · GRADED negative control / discriminator (3rd-pass sharpening — necessary AND sufficient).** A single *gross* RDP-violating control only proves the smoke "can go red," not that it is *sensitive enough* — pair it with a too-easy positive set and you get control-red ✔ + all-hosts-green ✔ → a false "parity proven" (the underpowered null with a green check in front). So add **two** controls: a gross violation **and** a just-over-threshold subtle one. `discrimination_ok` becomes "smallest detected divergence," and outcome (a) is valid only if the *subtle* case is also caught. <!-- carve-out: new-gate-verification -->
- [x] **T-004 · Cross-model smoke (keystone).** Built SDK-free fetch routers (`src/scripts/_lib/trigger_routers.ts`) + the smoke (`src/scripts/cross_model_smoke.ts`); ran **live** across all 3 vendors, emitting per-host pass-rate, token usage, parse-rate (output-shape signal), and negative-control catch-rate. Evidence: `agents/evidence/cross-model-baseline.md`.
- [x] **T-005 · Gate-tier cross-vendor canary (hardening #4; net-new CI infra).** Shipped `.github/workflows/cross-model-canary.yml` with the cost-bounded gate/periodic split: a **free `--dry-run` (MockRouter) job on every PR** that touches the eval surface (catches router/harness code regressions, no spend, no secrets), plus a **scheduled + dispatch live matrix** that activates only when `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`GEMINI_API_KEY` repo secrets are present (no-op otherwise). **Maintainer action to enable the live tier:** add those three repo secrets.
- [x] **T-006 · Baseline capture + outcome read.** Captured in `agents/evidence/cross-model-baseline.md`. Outcome **(c) fired** (Gemini output-format divergence, 80% parse) → Phase 0b is now evidence-backed; **(b) not cleanly established** on a thin, capability-confounded slice → overlays stay shelved. Coverage honestly named: 1 of 258 skills (directional, not a parity verdict). Run once locally (`verify-before-complete`); capture per-host metrics + cost + `discrimination_ok`. **Report the coverage denominator (3rd-pass honesty-coupling): "parity proven on N of 252 skills (trigger) / M behavioral"** — and the repositioning (Phase 3) may claim *exactly that fraction*, never whole-suite consistency. Read against three outcomes (council): **(a)** all pass RDP **and** the *graded* `discrimination_ok=true` (subtle case caught) → overlays stay shelved, honest-null is the **final** word *for the covered slice*; **(b)** a host fails RDP (and T-000 shows it is a behavior gap, not a capability gap) → open Phase G for *that host only*; **(c)** all pass but output-shapes diverge → open Phase 0b. If `discrimination_ok=false`, outcome (a) is **invalid** (underpowered) → fix the control before reading any null.

## Phase 0b — Output-format governance (decision-gated on P0 evidence; NOT a first-class P2)

The output-shape fingerprint is **already measured** in P0 (T-004). This phase is
the *decision*, not speculative building — the council (3rd pass) explicitly
rejected promoting format governance to a first-class P2 without evidence.

- [x] **(c) FIRED in T-006 → RESOLVED.** Fixed the Gemini format divergence at the source: `GeminiRouter` now sends a JSON output contract (`responseMimeType: 'application/json'`). Chosen by a live 3-variant comparison (strict `responseSchema` recovered parse to 100% but crushed routing accuracy 90%→60%; mimeType-only fixed parse with far less collateral) — see `agents/evidence/cross-model-baseline.md` § Phase 0b. Applied only to the host that diverged; broader output-schema governance not built (falsifiability-first — other hosts were 100% parse).

## Phase 1 — `finding_floor` eval kind (after Phase 0; calibrated, not guessed)

Goal: assert "skill produced ≥N substantive findings," calibrated across hosts so
it is not an Anthropic-only false baseline.

- [x] **Prerequisite (3rd-pass correction): author behavioral eval fixtures first.** At HEAD there are **0 `evals.json` behavioral fixtures** — the `rubric`/finding harness exists but is unused, so there is nothing for `finding_floor` to run against or calibrate from. Author a starter set of behavioral `evals.json` for a representative skill slice **before** the floor has any meaning. (This is why the coverage denominator in T-006 matters — `finding_floor` only covers what fixtures exist.)
- [~] <!-- HUMAN-REQUIRED residual: a gold set with ≥0.7 inter-annotator agreement is inherently a human-annotation task (≥2 annotators) — it cannot be produced autonomously without becoming the tuned-to-pass trap it exists to prevent. This is the genuine human dependency to finish finding_floor. --> Build a **labeled gold set** (human-judged substantive findings on ≥10 sample tasks) and confirm inter-annotator agreement ≥0.7 on "substantive" — without this the floor can only be tuned-to-pass (teaching-to-the-test), the exact honest-null lesson.
- [~] <!-- deferred: needs (a) the human gold set above and (b) a BEHAVIORAL execution harness — finding_floor counts a skill's OUTPUT findings, which requires running the behavioral evals.json per host (the run_skill_evals `_spawn_subagent` path), distinct from the routing smoke. A data-driven floor WITHOUT the gold set is exactly the teaching-to-the-test trap the roadmap forbids. --> Set the floor **per-host-dynamic** from Phase 0's distributions (hardening #3). A single `p10-across-hosts` constant is an explicit **trap**: the tersest host (GPT/Gemini → fewer findings) drags the floor below the level that catches Anthropic-side regressions — trading portability-protection for regression-blindness. Nail it per host; never a single global constant.
- [x] Add the `finding_floor` assertion kind to `src/scripts/run_skill_evals.ts` (alongside `contains` / `file_exists` / `rubric`); gate the paid judge call like the existing harness. <!-- carve-out: new-gate-verification --> Shipped as a deterministic count-based mechanism (`_count_findings` + `finding_floor` kind); the threshold `n` is a parameter, **not yet an enforcing CI gate** — see lines below (calibration deferred).
- [x] Add tests + run once locally. <!-- carve-out: new-gate-verification --> `run_skill_evals.test.ts` extended with 3 `finding_floor` cases (default list-item count, explicit pattern, invalid-regex safety); vitest green.

## Phase 2 — size-budget undershoot-floor + audited override (after Phase 1)

Goal: catch suspicious skill *shrinkage*, distinguishable from legitimate small
skills only once `finding_floor` exists.

- [~] <!-- WON'T-BUILD-SPECULATIVELY (user-confirmed 2026-06-25): no truncation incident has occurred, so this would be a guard against a problem the evidence does not show — exactly the speculative governance this roadmap's ethos (honest-null; don't fix what isn't broken) rejects. The natural host scripts are delicate (check_always_budget = CI-tuned overshoot gate; measure_augment_budget = faithful-twin with golden tests), and for the always-budget a *drop* is normally desirable, not suspect. Reopen on a real truncation incident. --> Extend `check_always_budget` / `measure_augment_budget` with an undershoot floor (skill below expected size = suspect truncation) and an override that requires a logged reason (`*_OVERRIDE_REASON` → audit log).
- [~] <!-- ~ALREADY-COVERED: `measure_augment_budget` already gates the whole always-on prompt against a 49,512-char cap, and that total already counts always-rule bodies AND auto-rule stubs *including their descriptions*. A separate description-sum cap would be largely redundant. Deferred unless a distinct, evidenced need appears. --> Add the catalog-token target (sum of always-on descriptions ≤ threshold) if not already covered — directly addresses the historical always-on-budget pressure.

## Phase G (GATED) — model-overlays — open ONLY on a Phase-0 RDP failure

Goal: do nothing unless Phase 0 proves a host actually fails RDP. This is the
disciplined default-off posture, not a deferral.

- [x] **Entry condition evaluated → STAYS CLOSED (honest-null).** T-006 + the 10-skill wider run showed a routing spread (haiku 74 / openai 80 / gemini 65) that is **tier-confounded** (all weakest-tier models), not a clean RDP behavior gap. Per T-000 a capability gap is not an overlay candidate. Overlays stay shelved; the honest-null is the final word unless a **capability-controlled** re-run later exposes a real behavior gap on a specific host.
- [~] <!-- gated: opens only if a capability-controlled re-run exposes a real behavior gap on a specific host --> If opened: build the overlay axis only for the failing host(s), empirically derived from `frontier-reasoning-operating-profile.md`, explicitly subordinated to safety gates ("preferences, not rules"), default-off, hung off `model_tier.ts`. Re-run Phase 0 to confirm the overlay closes the specific gap; honest-null → drop it.

## Phase 3 (parallel track) — product surface: QA-orchestration skill + lifecycle packaging

Independent of the discipline chain; lower leverage; user already approved the
QA design.

- [ ] <!-- open — separate track, not in this push: a new skill needs the artifact-drafting-protocol (Understand→Research→Draft with user input), not a mechanical autonomous build. --> QA real-browser skill as **pure orchestration** over our Playwright skills + an enforcement gate (no binary, no daemon, no new dependency) — per the prior decision-gate resolution.
- [~] <!-- deferred: parallel-owned — a draft `road-to-positioning-and-enforcement.md` (parent: this roadmap) is already in flight in the working tree, authored outside this autonomous run. Not mine to land. Also: the wider run shows parity is NOT yet clean (tier-confounded ~15pp spread), so the narrative is not yet earned. --> **Repositioning (sequence AFTER P0 proves parity — council 3rd pass).** Once the keystone demonstrates cross-host parity, lead with **"cross-model governed agent infrastructure — write once, run consistently across Claude, Codex, Gemini, Cursor and future agents,"** the enforcement-teeth differentiator front and centre. This supersedes the weaker "one builder, team scale" framing. Claim only what the parity evidence proves — do not ship the narrative before the keystone lands (overpromising the unproven multi-host claim is the failure this whole roadmap exists to fix). **Two honesty-couplings (3rd pass):** (1) claim the *measured coverage fraction* from T-006 ("consistent across hosts on N of 252 skills"), never whole-suite; (2) **name only hosts actually evaluated** — `Cursor` is currently a *projection target* (`cursor-rule.mdc.j2`), not an eval'd model, so either drop it from the parity line or add it as vendor #4 in T-002/T-004 first.

## Phase plugin (separate repo) — route the rejected runtime work to `agent-ide-plugin`

- [x] Recorded the sibling-repo security lessons in `agents/evidence/agent-ide-plugin-security-lessons.md` (canary token + rolling-buffer detection, port-separation, egress sanitization, content-security layering, daemon hardening) — a durable backlog hand-off for `agent-ide-plugin`, explicitly out-of-scope for this no-runtime suite.

---

## Acceptance criteria

- Cross-model e2e parity exists and emits per-host RDP pass/fail + finding
  distributions; the multi-host claim is **proven, not asserted**.
- No new runtime component, binary, or third-party-service dependency ships in
  core; runtime/security work is routed to the plugin.
- `finding_floor` is calibrated from real cross-host distributions + a labeled
  gold set (≥0.7 agreement) — never an Anthropic-only constant.
- model-overlays remain **shelved** unless Phase 0 produces a real RDP failure;
  the honest-null is honored, not worked around.
- The ALREADY-HAVE corrections (slop-gate, rubric) and the explicit REJECTs
  (overlays-now, runtime guardrails in core, browser daemon, boil-the-ocean,
  doc export) are recorded so they are not relitigated.

## Provenance

Source links retained encrypted per `source-confidentiality` (decrypt with the
maintainer key via `src/scripts/_lib/link_crypto`):

- Source A — `ENC1:LQKGCmokNy2xYTfT88tOTdbn3y7hnXsrO1xHsvHalFIq+AMMZuZzra85lVtOaZJzcfu9hjB4f9i/X8eNO0Lu0Q==`
