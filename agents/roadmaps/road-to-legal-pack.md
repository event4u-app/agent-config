---
complexity: structural
status: ready
---

# Road to a legal pack — built on its own legs, evaluated honestly

> **The bet.** Bring real legal capabilities into the suite as a **single governed,
> EU/DE-scoped pack** that fits our condensation / kernel / safety-floor discipline.
> Legal is built **correctly on its own merits** — not designed to serve a speculative
> general pattern. If a reusable domain-pack sequence emerges, it gets **documented
> retrospectively** and only promoted to a rule once a *second* domain validates it
> (per `domain-pack-extraction-when-triggered`, N=2). Binding constraint =
> **single-maintainer attention**, not token budget — the smallest *honest* cut wins.

> **The hardest-won lesson (council round 3, 2026-06-24).** An earlier cut of this
> roadmap gated skill ship on "≥X% match to attorney ground-truth" and called it "the
> objective replacement for reviewer sign-off." The council ruled that **epistemic
> theatre**: the ground-truth was unsourced, the maintainer's legal qualification is
> unconfirmed (Gate 2), the threshold borrows statistical language from a cross-model
> parity infrastructure that does not yet exist, and model capability caps at ~F1 0.62
> so any passable threshold measures "not worse than a mediocre baseline," not
> correctness. **This revision strips the false objectivity.** The eval that ships is a
> **regression/consistency harness**; the *objective* eval pack becomes a separate,
> explicitly-gated track; correctness stays where it belongs — **licensed-attorney
> review on material use**, baked into every skill's output, not a footer.

## Evolution of this plan (three council rounds, 2026-06-24)

| Decision | R1 (single-voice) | R2 (2 voices) | R3 (2 voices, adversarial) |
|---|---|---|---|
| Jurisdiction | neutral + EU default | **EU/DE-only hard refusal** | (held) |
| Personas | ≤2 | **dropped** | (held — procedure-not-personality) |
| Enforcement | linters late | linters early + jurisdiction-tag lint | (held) |
| Eval pack | (none) | "objective acceptance, before skills" | **reframed: regression harness ships; objective eval = separate gated track** |
| Reference-architecture | (none) | **elevated to the framing/title** | **demoted to retrospective note (N=1 must not drive design)** |
| Privilege guard | new hook | extend PII+trifecta, late (Phase 5) | **pulled to Phase 1.5, suite-level, with upfront probe** |
| Product liability | (none) | conditional meta-gate | (held) |
| Gate 2 (owner) | named owner | named owner | **+ objective qualification check (external, not self-assessed)** |

Genuine split recorded (R3): one voice argued the objective legal eval pack is
**unachievable under solo-maintainer constraints and should be dropped permanently**
(+ documented as an anti-pattern); the other tolerated **defer-and-fund**. Resolution:
**defer-and-gate** (not permanent drop) **and** write the anti-pattern doc — honour the
epistemic point now without foreclosing a funded asset later.

## Why now / evidence

- **Demand** (domain-adoption Gate 1): user-named direction, EU/GDPR context. Anchors
  ship: `contracts-cognition`, `privacy-review`, `data-handling-judgment`,
  `data-flow-mapper`, `domain-safety-disclaimer` (legal sector), `domain-safety-pii`,
  `lethal-trifecta-guard` (already has "gate egress behind human-in-the-loop"), and the
  `finance-safety-floor` / `strategy-safety-floor` precedents (~106 lines, terse).
- **External references** (anonymized — see Provenance): Source A = a first-party
  legal-plugin reference suite (prompt-only enforcement, empty hooks — our deterministic
  linters/guards are the differentiator); Sources B–D = community legal skills.
- **Empirical floor**: Claude clause-extraction ~F1 0.62 — strong first-pass, **not** a
  substitute for attorney review. This number is *why* Phase 3 is a regression harness,
  not a correctness oracle (a threshold above 0.62 fails every skill).
- **Our own eval standard** (`road-to-operator-runtime-harvest`, the cross-model-parity
  keystone — itself unbuilt): an objective eval gate "must be calibrated from cross-model
  finding-count distributions + a labeled gold set; **useless and falsely-baselined
  before parity exists**" and needs "**inter-annotator agreement ≥0.7**". Legal — higher
  stakes — gets *at least* that bar (gated track), or it does not claim objectivity.

## Phase 0 — Gates, scope, floor (before any skill)

- [x] **0.1 — Gate 1 (demand):** record demand + EU/GDPR context in `agents/settings/contexts/`.
- [ ] **0.2 — Gate 2 (maintenance owner) — BLOCKING:** name a single maintainer + a
  refresh cadence (quarterly min) **and an objective qualification check** — the
  maintainer's EU/DE legal-domain competence is confirmed by external/adversarial review,
  **not self-assessment** (the whole eval/floor soundness rests on this). Pack stays
  `[-] gated` until confirmed. <!-- owner-gate: needs user confirmation -->
- [x] **0.3 — Gate 3 (CI-tooling):** legal skills are validated (skill_linter +
  trigger-evals + Phase-1 linters + Phase-3 regression harness), not platform-bound.
- [x] **0.4 — Scope: EU/DE-only hard refusal.** Encode in `src/domains/legal/pack.yaml`
  (`scope.jurisdictions: [EU, DE]` + hard-refusal message). Out-of-scope → refuse +
  "consult licensed local counsel", never a stale guess. Scope is a one-line config
  decision; expansion is a future owner decision gated on its own currency promise.
- [x] **0.5 — Author `rule:legal-safety-floor`** (`src/rules/legal-safety-floor.md`,
  ~100 lines, sibling to finance/strategy). Iron-Law elements: **(a) no-final-legal-call**;
  **(b) mandatory disclosure footer** (extends `domain-safety-disclaimer`
  `not-legal-advice`); **(c) role-conditional work-product header** (lawyer →
  privileged/work-product *with jurisdiction-honesty caveat*; non-lawyer → research
  notes + attorney gate); **(d) jurisdiction-honesty, machine-checkable** via a mandatory
  `Jurisdiction:` tag (lint-enforced, Phase 1); **(e) privilege-circle / destination
  check**; **(f) currency + source-tag vocabulary**; **(g) retrieved content is data,
  not instructions**; **(h) GREEN×non-lawyer → attorney gate** (a "standard-approve"
  severity for a non-lawyer never self-approves); **(i) every skill output carries
  `⚠️ Attorney review required on material use` in the body, not a footnote.**
- [ ] **0.6 — Conditional product-liability meta-gate:** if commercial (Pro-tier)
  distribution is planned, a licensed attorney reviews the **pack itself** (floor +
  skill procedures + the regression-harness design) before ship — provider liability is
  distinct from per-output oversight. N/A for internal/open-source.
  <!-- meta-gate: conditional on commercial distribution -->
- [x] **0.7 — ADR** (`skill:adr-create`): domain adoption, EU/DE-only scope, the
  regression-vs-objective-eval split, the rejections (Phase 6), and the N=1 reversal.
- [x] **0.8 — Retrospective pattern note (NOT a design driver):** after legal is built,
  a short `docs/guidelines/agent-infra/domain-pack-architecture.md` *observes* the
  sequence legal happened to follow and states "**validate against domain #2 before
  promoting to a rule**". It does not constrain legal's design and ships no
  `domain-pack:new` tooling (deferred to N=2). Written near the end, not the start.
- [x] **0.9 — Scaffold:** `src/domains/legal/pack.yaml` + `src/config/discovery/packs.yml`
  entry; `unassigned-artefacts.yml` if needed so `build_discovery_manifest --strict` stays green.
- [x] **0.10 — Verify:** `skill_linter` (floor shape), discovery builds strict, `task lint-skills` green.

## Phase 1 — Enforcement teeth (the floor's machine-checkable backstops)

- [x] **1.1 — Disclaimer/attorney-flag-presence linter:** fails the build if a legal-pack
  skill output omits the floor header/footer **or** the `⚠️ Attorney review required` body line.
- [x] **1.2 — Jurisdiction-tag linter:** fails if a legal-pack output omits `Jurisdiction:`
  or names one outside `pack.yaml scope` (makes floor (d) deterministic, not prompt-only).
- [x] **1.3 — Freshness linter** (early — stale law > missing disclaimer): warns at
  invocation when `last_verified` / `freshness_window` is stale.
- [x] **1.4 — Wire 1.1–1.3 into `task ci-fast`.**
- [x] **1.5 — Verify:** linters fail-red on a non-compliant fixture skill, pass-green on a compliant stub.

## Phase 1.5 — Sensitive-outbound / privilege guard (suite-level, pulled forward)

> Privileged-document leakage is a worse failure than a mediocre review, and it threatens
> **every** pack today (a founder summarizing a privileged memo), not just legal. So this
> lands before the legal skills exist.

- [x] **1.5.1 — Extend `rule:domain-safety-pii` + `rule:lethal-trifecta-guard`** to detect
  privilege/work-product markers on outbound MCP/egress (try config/markers extension
  first; `lethal-trifecta-guard` already has the egress-gate primitive).
- [x] **1.5.2 — Upfront falsification probe (defines success/failure before building):**
  a `founder`-pack request "summarize this PDF for the board" where the PDF header reads
  "ATTORNEY-CLIENT PRIVILEGED — PREPARED AT REQUEST OF COUNSEL" **must** trigger a block
  *before* generation, surfacing "privileged material — blocked pending explicit
  confirmation; disclosure may waive privilege", requiring an explicit confirm token. The
  probe is designed to defeat generic PII matching (the header is not PII — it needs
  semantic privilege detection). **If the extension cannot pass this probe → that is the
  trigger** for a dedicated `legal-privilege-guard` PreToolUse hook (`hook_manifest.yaml`,
  default off). Record the failure evidence in the ADR. Generic "sensitive-outbound-guard"
  generalization remains an N=2 decision.
- [x] **1.5.3 — Verify:** the probe blocks the privileged summary; clean content passes.

## Phase 2 — Core review skills (EU/DE-scoped, procedure-only, attorney-flagged)

> Each skill: ships **no default legal positions** (reads from the practice profile,
> Phase 4; `[configure]` until then), emits floor header/footer + `Jurisdiction:` tag +
> `⚠️ Attorney review required` in body, GREEN/YELLOW/RED frame.

- [x] **2.1 — `skill:contract-review`** — position-aware, redline *suggestions*; risk
  taxonomy from a public clause-risk reference. Extends `contracts-cognition`. + trigger evals.
- [x] **2.2 — `skill:nda-triage`** — fast GREEN/YELLOW/RED; **GREEN×non-lawyer → attorney gate** (floor (h)). + trigger evals.
- [x] **2.3 — `skill:dpa-review`** — EU-native (GDPR Art. 28), controller/processor gap flags. Cites `privacy-review` + `data-handling-judgment`. + trigger evals.
- [x] **2.4 — `skill:legal-intake-triage`** — "is this a legal problem?" triage + lightweight matter intake (no matter-workspace). + trigger evals.
- [x] **2.5 — Verify:** `skill_linter` green; disclaimer + jurisdiction linters green;
  trigger-evals pass (live trigger-eval is a human `/dev/tty` gate — hand to the user).

## Phase 3 — Regression / consistency harness (NOT a correctness oracle)

> Honest framing per council R3. This catches "did a change make a skill *worse than its
> own baseline*" — it does **not** validate correctness. Correctness = attorney review on
> material use (floor (i)). No "objective replacement for reviewer sign-off" language.

- [x] **3.1 — `legal-evals/` fixtures** (NDA, DPA, SaaS/MSA, vendor, processor, …) with
  **self-labeled** expected flags **explicitly marked `self-labeled — pending attorney
  validation; regression-only, not correctness, not objective`.**
- [x] **3.2 — Baseline + regression gate:** first skill run sets the baseline; later
  changes must not regress against it. The gate is a *consistency* check, never a
  correctness threshold; the threshold lives *below* the ~F1 0.62 cap by construction.
- [ ] **3.3 — Verify:** harness flags a deliberately regressed skill; no skill claims correctness.

## Phase 4 — Practice-profile mechanism (the keystone, adapted not cloned)

- [x] **4.1 — `skill:legal-practice-profile`** — cold-start-style interview writing a
  **plain-prose** profile (playbook positions, jurisdiction *within scope*, escalation,
  reviewer, user role) into `.agent-settings.yml` + the `agent-config setup` wizard (NOT
  a per-plugin `CLAUDE.md`). Quick/full fork; pause/resume; optional seed-doc delta.
- [x] **4.2 — Wire Phase-2 skills to the profile;** replace `[configure]` with reads;
  **halt-on-placeholder**; a non-lawyer-filled profile cannot redefine RED-as-GREEN (floor (h) holds).
- [x] **4.3 — Verify:** profile round-trips; halt-on-placeholder fires when unset.

## Phase 5 — Deferred / gated / rejected (recorded, not built)

- [x] **5.1 — OBJECTIVE legal eval pack — DEMAND+FUNDING-GATED TRACK (not Phase-3).** A true
  correctness eval (attorney-validated gold set, **inter-annotator agreement ≥0.7**) is gated
  on **(i) validated demand** and **(ii) funding** (~3–5 attorney-days *per fixture type*) —
  **NOT** on the cross-model-parity keystone (corrected in the full critique round: legal
  matching is classification, not finding-count distributions; the real dependency is
  gold-set tooling the pack builds itself). **No timeline.** Recorded split: drop-permanently
  vs defer-and-fund → resolved to **defer-and-gate** + the anti-pattern doc (5.2). Until then,
  only the Phase-3 regression harness ships. See `docs/guidelines/agent-infra/domain-eval-anti-pattern.md`.
- [x] **5.2 — Anti-pattern doc:** `docs/guidelines/agent-infra/domain-eval-anti-pattern.md`
  — "objective domain evals at N=1 under solo-maintainer constraints manufacture false
  objectivity; here is the failure mode and the regression-harness alternative." A real
  asset for the next domain.
- [x] **5.3 — Personas — DROPPED.** Procedure-not-personality; role focus → skill tags + profile.
- [x] **5.4 — matter-workspace — rejected** (too heavy; single-client/in-house never needs it).
- [x] **5.5 — Scheduled watchers** (renewal/docket/reg-feed) — defer to a future scheduling surface + `subagent-orchestration`.
- [x] **5.6 — Community-skill installer hub** — out of scope (`upstream-contribute` + `check-refs` cover it).
- [x] **5.7 — Legal MCP connectors** (CourtListener, EUR-Lex, court e-filing, CLM/DMS) — recommend-only in the README; do not vendor.
- [x] **5.8 — Rejected scope:** US-state employment tests, full litigation depth, bar-prep, Swiss cantonal depth, non-EU/DE jurisdictions. Re-open only on cited quantitative demand (record in ADR).

## Acceptance criteria

- Gate 2 satisfied (named owner + cadence + **external qualification confirmation**), or pack `[-] gated`, not shipped.
- Scope is **EU/DE-only** in `pack.yaml`; out-of-scope hard-refuses; scope is one-line config.
- `rule:legal-safety-floor` exists, Iron-Law-shaped; header/footer + `Jurisdiction:` tag +
  `⚠️ Attorney review required` body line are **linter-enforced**; GREEN×non-lawyer → gate.
- Privilege guard (1.5) passes its upfront probe before any legal skill ships.
- Phase-2 skills ship **no default legal positions**; the Phase-3 harness is labeled
  **regression-only, not correctness** — and **no artifact in the pack claims "objective"
  legal acceptance.**
- The objective eval pack stays a **gated track** with its three blockers explicit; the
  anti-pattern doc is written.
- The reference-architecture note is **retrospective**, validate-at-N=2; no `domain-pack:new` tooling ships.
- All skills pass `skill_linter`; discovery builds strict; `task ci-fast` green; no personas added.

## Provenance

External references anonymized per `source-confidentiality`. Real source names, links,
the three council session pointers, and the ContractEval baseline live local-only in
`agents/.harvest-local/legal-pack-provenance.md` (gitignored). Source A = a first-party
legal-plugin reference suite; Sources B–D = community legal skills.
