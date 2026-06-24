---
complexity: structural
status: ready
---

# Road to legal-review-prep — rename, consent-gate, council-gate, hard STOP

> **Baseline.** Assumes the legal-pack hardening (PR #653: OSS-forever ADR-108,
> RDG individual-case guardrail, LEGAL_NOTICE ×2, no-definitive-language lint,
> test-enforced disclaimer) is merged. This roadmap takes the pack from "well-built
> but named/positioned as `legal`" to "**review-prep tool, maximally fenced**" —
> per a deep AI-council (3 rounds, anthropic/claude-sonnet-4-5 + openai/gpt-4o,
> 2026-06-24) and ~8 external 7.1.0 reviewers.

> **The deep-council finding (it flipped).** Round 1 both voices called
> council-gating "expensive theatre". The critique rounds **reversed both**: gating
> legal output behind the council + deep-research is **legally substantive
> defense-in-depth** — German *Verkehrssicherungspflicht* (graduated duty of care
> rewards documented multi-stage review), the **reliance paradox** (higher quality
> raises reliance → raises civil liability *unless* structurally bounded; the gate
> is the bounding friction), **litigation-ready audit artefacts**, and it touches
> risks beyond RDG (GDPR-by-design, UWG, host-ToS). **Caveats kept honest:** it does
> **not** cure RDG (only the individual-case refusal does), enforcement is
> advisory-prose + settings + lint (skills can't force a CLI call), and the real
> legal sufficiency is deferred to the attorney-framing-review tripwire (Phase 5).
> Council members repeatedly stressed: this is engineering, not legal advice.

## Phase 0 — Rename `legal` → `legal-review-prep`

> Council + every reviewer: "legal" reads as "legal advice"; "legal-review-prep"
> reads as "prepare for attorney review" — the single biggest expectation/risk lever.
> The pack just merged → adoption ~zero → churn is cheapest now.

- [x] **0.1 — Vocab rename** across `workspaces.yml` (legal→legal-review-prep) + `packs.yml` + the `ADR_WORKSPACES`/`ADR_PACKS` sets in `lint_discovery_vocabulary.ts` + the `workspace_id`/`pack_id` enums in `discovery-manifest.schema.json`, with an **ADR-013 amendment** in the same PR.
- [x] **0.2 — Artefact rename** — `src/domains/legal/` → `src/domains/legal-review-prep/`; every skill's `packs: [legal]` → `[legal-review-prep]` + `workspaces:`; the floor `packs:`/`workspaces:`; FIRST_WIN + LEGAL_NOTICE pack-local; trigger-eval `packs` refs.
- [x] **0.3 — Update references** — ADR-107/108, `lint_legal_pack`, `legal-disclaimer-presence.test.ts`, README note, `LEGAL_NOTICE.md`. Keep the skill NAMES (`contract-review`, `dpa-review`, …) — they already read as review/analysis, not "advisor".
- [x] **0.4 — Verify** — `task consistency-fix`, vocab lint, discovery `--strict`, `lint_legal_pack`, tests, `check-refs` green; condensation re-done.

## Phase 1 — Hard individual-case STOP (not a hedge)

> The floor already refuses individual-case examination; council: word it as a loud
> **STOP / termination**, not a disclaimer-shaped hedge.

- [x] **1.1 — Rewrite the floor's individual-case section** to an explicit STOP: on specific-facts / outcome-prediction / deadline-driven / definitive-action ("may I terminate?", "will I win?", "is this enforceable in my case?") → emit a `🛑 I must stop here — this needs a lawyer` block with attorney-search pointers (e.g. Rechtsanwaltskammer, Beratungshilfe) and **do not continue** the individual-case analysis. Keep general info/templates available separately.
- [x] **1.2 — Lint the STOP** — extend `lint_legal_pack` / the disclaimer test to assert each skill carries the STOP-on-individual-case instruction (presence check, not phrasing-fragile).
- [x] **1.3 — Verify** — lint + tests green.

## Phase 2 — Install/setup consent gate ("I understand this is not legal advice")

> Council (both voices, both rounds): YES. Active consent ≠ passive disclaimer —
> materially helps civil-liability / host-ToS / expectation (not an RDG cure).

- [ ] **2.1 — Settings flag** `legal_review_prep.acknowledged: true` (+ timestamp) in the settings schema (`src/server/schemas/settings.ts` + `.agent-settings` template).
- [ ] **2.2 — Wizard step** — when the pack is selected in the setup wizard (`src/server/routes/wizard.ts`), require an explicit checkbox: *"This pack provides templates and general information ONLY — not legal advice, no attorney-client relationship. Individual cases need a lawyer. I understand."* Unchecked → pack not activated.
- [ ] **2.3 — Floor enforcement** — the floor refuses legal-review-prep skills until `acknowledged: true` (fail-closed), pointing the user to the wizard / settings.
- [ ] **2.4 — Verify** — wizard step renders + persists the flag; floor-refusal path tested.

## Phase 3 — Council + deep-research gate (defense-in-depth)

> The maintainer's core ask, validated by the deep council as substantive (audit
> trail + reliance-bounding friction), with honest enforcement limits.

- [ ] **3.1 — `council_depth: deep` frontmatter** on every legal-review-prep skill (existing key → deeper deliberation when consulted via the council).
- [ ] **3.2 — `legal_review_prep.require_council: true` settings flag** (default true) + a floor Iron Law: a legal **work-product** (review, redline, gap-frame, demand draft) is produced via a council / `research:deep` pass — single-model legal output is refused; **fail-closed** when no council is configured (acceptable for a high-risk pack: no infra → no output, not unsafe output). Be explicit in the rule that this is advisory+settings enforcement, not hard runtime — the host is asked, the floor + flag + lint are the teeth.
- [ ] **3.3 — Audit artefact** — when a council/deep-research pass runs for a legal work-product, persist the deliberation pointer (timestamp + members + artefact hash) so the "documented multi-stage review" rationale is real, not claimed.
- [ ] **3.4 — Honest framing in the floor + LEGAL_NOTICE** — council deliberation improves quality + creates an audit trail; it does **not** make output reliable legal advice. State it plainly so the gate doesn't manufacture false confidence.
- [ ] **3.5 — Verify** — flag round-trips; floor refuses a single-model legal work-product; lint asserts the council requirement is present per skill.

## Phase 4 — High-risk pack metadata

> Legal-specific now; the *generalizable* risk-class framework is deferred to
> `road-to-capability-governance` (N=2 discipline — council split, anthropic won).

- [ ] **4.1 — Pack frontmatter keys** on `legal-review-prep` in `packs.yml`: `risk_profile: rdg_regulated_eu_de`, `requires_explicit_consent: true`, `requires_council: true`, `default_install: false`, `promotion_gate: attorney_framing_review`. Documentation-first (enforcement lives in the floor + consent gate + lint).
- [ ] **4.2 — Legal row in the capability-boundary doc** (the doc itself is built in `road-to-capability-governance`; this adds the legal-review-prep row: default=no · opt-in=yes · consent=yes · council=yes · disclaimer=yes · eval=yes · risk=high).
- [ ] **4.3 — Verify** — frontmatter validates; pack stays `experimental`/`lab`, in no default profile.

## Phase 5 — Attorney-framing-review promotion tripwire

> Council: a bounded (~€300–800, ~1–2h) review by a German lawyer of the *framing*
> (floor + LEGAL_NOTICE + RDG-refusal wording) — NOT skill correctness — gates any
> promotion out of `lab`. Not a blocker for the lab release.

- [ ] **5.1 — ADR + tripwire** — record (extend ADR-107 §7 / a new ADR) that promotion of legal-review-prep out of `surface_tier: lab` / `trust_level: experimental`, default-on, or any commercial/hosted surface is **blocked** until a licensed German attorney has reviewed the framing and the review (name, date, scope, outcome) is recorded in `LEGAL_NOTICE.md`.
- [ ] **5.2 — Promotion guard** — a lint/check that fails if the pack's tier is promoted without the recorded attorney-framing-review marker.
- [ ] **5.3 — Verify** — guard fails on a simulated premature promotion; passes at current lab tier.

## Phase 6 — Deferred / rejected (recorded)

- [ ] **6.1 — Generic `risk_class` capability class + boundary-matrix framework** — deferred to `road-to-capability-governance` (N=2 discipline; legal is the first instance, extract the generic governance when a 2nd high-risk domain — medical/tax/compliance — actually arrives). Council split: anthropic defer (won), gpt-4o build-now.
- [ ] **6.2 — Council-gating is NOT an RDG cure (recorded).** Only the individual-case refusal (Phase 1) addresses RDG. The council/consent/audit layers are civil-liability / host-ToS / reliance-management defense-in-depth. Do not let docs claim the gate makes output "compliant" or "reliable".
- [ ] **6.3 — Hard runtime enforcement of "council-only"** — out of scope; skills are prose, the host can't be forced to shell out. The settings flag + floor + lint are the honest mechanism; revisit only if a host exposes a real pre-generation hook for this.

## Acceptance criteria

- Pack renamed to `legal-review-prep` (vocab + artefacts + refs + ADR-013), all gates green.
- Floor emits a hard STOP on individual-case requests (lint-checked).
- Consent flag gates activation (wizard checkbox + floor refusal until acknowledged).
- Legal work-product is council/deep-research-gated (fail-closed), with an audit pointer and honest framing that it is not legal advice.
- Pack carries high-risk frontmatter, stays `lab`/`experimental`/opt-in; promotion is blocked behind a recorded attorney-framing review.
- No artefact claims the guardrails make output legally reliable or RDG-compliant.
