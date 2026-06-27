---
complexity: structural
status: ready
---

# Road to an injection-defense pressure-corpus (with a defensive judge sliver)

> Harvest the **defensive + measurement methodology** from an external
> LLM-robustness research framework (Source A) into AC — pressure-corpus
> **first**, a thin defensive-judge calibration sliver **second**, two small
> infra adopts **last**. No offensive content enters the suite. Each phase is
> gated on **actionability**: a fixture is only worth building if a failure it
> surfaces has a concrete mitigation path.

## Goal

Close the named, deferred gate — *"enforcement-projection revisit ONLY behind a
pressure-corpus"* — by giving AC's injection-defense rules an adversarial
eval substrate they currently lack, and a defensive judge that scores
**correct refusal / data-not-instruction handling** rather than verbosity.
Stop when the three concrete defense gaps are covered and characterised; do not
grow the corpus past what AC can act on.

## Context

A deep read (3 file:line-cited readers) of Source A — an external,
AGPL-3.0, ~8.5k-star LLM-robustness / red-team research framework — found that
its genuinely transferable value for a *governance/safety* suite is **defensive
and methodological**, not its (rejected) jailbreak content. The AI Council
(anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-06-27, 2 rounds) converged on:

- **Sequence B → A, not A → B.** AC's repeated honest-nulls (enforcement-projection
  Δ=0.000; recursive-verification null) are **corpus saturation** — no adversarial
  load — not measurement imprecision. A full statistical-rigor harness would only
  manufacture *more precise* nulls. Domain reasoning already names the corrective
  (build a pressure-corpus), so paying for power-analysis machinery to "discover"
  it is waste.
- **Most of the rigor bundle is inapplicable to AC.** AC governance is
  single-condition (rules always ON; the no-rules baseline does not exist — that
  *is* the differentiator), so paired-significance / A-B power analysis has no
  pairs to test. Only the **judge-calibration sliver** (synthetic monotonicity /
  construct-validity checks) survives, and it is ~1 day of work.
- **Scope discipline:** the minimal B that unblocks the deferred gate is the
  **three named defense gaps**, not a full perturbation corpus. Stop-condition =
  **actionability**, not statistical significance.

This roadmap therefore front-loads the **deterministic** defense gaps (lint
coverage — no API, immediately verifiable), then the **behavioral** pressure
fixtures (which need the defensive judge sliver), then two small infra adopts.

## Provenance

Source A is anonymised per `source-confidentiality` (the suite never records that
it learned from / adapted a named external project in a tracked artifact). Raw
named harvest evidence + the source link are held **out-of-tree** (local only).
No encryption key is configured (`secrets.link_encryption_key` absent), so no
`ENC1:` token is embedded; the link is not written to the tracked tree.

## Do-not-build (explicit — council + reader rejects)

- [-] **No offensive content** — jailbreak prompts, liberation framings,
  obfuscation generators do **not** enter the suite (only their *categories* as
  payload-free defensive fixtures).
- [-] **No full statistical-inference harness** — bootstrap CIs, prospective
  power analysis, paired-significance machinery: inapplicable (no A/B pairs) and
  the canonical honest-null trap. Build none of it.
- [-] **No verbosity-biased scorer** — Source A's 5-axis scorer is length-dominated
  (46.7%), the opposite of AC's frugality rules.
- [-] **No output hedge/preamble strippers** — duplicate `direct-answers` /
  `telegraph-speak` and would collide with safety-floor disclaimers.
- [-] **No N→1 single-shot synthesis as a council replacement** — AC's
  debate-to-convergence council is the more rigorous aggregator.
- [-] **No online EMA param-tuner** — AC has no inference-param loop to tune.
- [-] **No auto-publish of content to any external dataset** — that is the
  `lethal-trifecta-guard` egress anti-pattern.

## Prerequisites

- Existing rules in scope: `untrusted-input-defense`, `lethal-trifecta-guard`,
  `security-sensitive-stop`; existing linter `lint_hidden_unicode.ts`.
- Fixture contract (payload-free): each fixture =
  `{ untrusted_content_block, technique_category[], expected_defense_behavior }`
  where `expected_defense_behavior` ∈ { treat-as-data-not-instruction,
  refuse-role-takeover, flag-hidden-unicode, emit-correct-refusal,
  ignore-fake-boundary-token }. Store **expected behaviour, never measured
  bypass rates**, and combine ≥2 perturbation categories per behavioral fixture.

## Automation & human gates

- Deterministic phases (lint coverage) run fully in-session — verifiable without
  any model API.
- Behavioral phases that need a judge are **human-gated** for any billable model
  run, consistent with prior eval discipline.
- No `task ci` / full-pipeline steps scheduled here; verification uses the
  narrowest tool that proves each item.

## Phase 1 — Deterministic perturbation coverage (no API, highest certainty)

The cheapest, highest-confidence slice of Bundle B: the input-perturbation
categories that have a *lexical* signal a linter can catch. Each step lands a
fixture set **and** the matching detector hardening, then proves coverage.

- [x] **1.1 Build the perturbation fixture seed** — a payload-free corpus of
  untrusted-content blocks exercising: zero-width insertion, visible-confusable /
  mixed-script homoglyphs, leetspeak, mixed/alternating case, phonetic, and
  ≥2-category composites. Use the source's trigger lexicon only as **defensive
  seed vocabulary** (words a defender should flag when they appear de-obfuscated),
  never as a runtime blocklist.
- [x] **1.2 Homoglyph / confusables gap (the biggest concrete gap)** — verify
  `lint_hidden_unicode.ts` scope: it catches *invisible* chars but not *visible*
  mixed-script confusables. Add a confusable-skeleton / mixed-script check (or a
  sibling linter) and wire it into the same backstop. Verify: run the linter over
  the 1.1 fixtures; every homoglyph fixture is flagged, benign mixed-language
  fixtures (legit non-Latin prose) are **not** (false-positive guard).
- [x] **1.3 Zero-width runtime gate** — today zero-width detection is a corpus
  linter only; §5.5 of Source A confirms it is trivially scannable (U+200B–U+FEFF).
  Promote it to a deterministic gate on untrusted-content ingestion paths (or, if
  no such hook exists on a given host, a documented fixture proving the rule
  prose mandates flagging). Verify against the zero-width fixtures from 1.1.
- [x] **1.4 Semantic-defense assertion for ASCII obfuscation** — leetspeak /
  mixed-case / phonetic have **no** lexical defense and need none *if* AC's
  defense is semantic (data-not-instructions). Add fixtures that **prove AC does
  not silently rely on literal keyword matching** for injection detection
  (these are behavioral — mark them `needs-judge` and carry to Phase 2; do not
  fake a lexical pass).
- [x] **1.5 Coverage report** — for each perturbation category emit a
  COVERED / GAP-CLOSED / DEFERRED-to-Phase-2 line. Actionability gate: any
  category with **no** mitigation path is documented as out-of-scope, not padded
  with un-actionable fixtures.

## Phase 2 — Behavioral pressure-corpus + defensive judge sliver

The behavioral half of Bundle B, plus the *only* part of Bundle A worth taking:
a calibration sliver for a judge that rewards **correct defensive behaviour**.

- [x] **2.1 Defensive judge (inverted axis)** — adapt Source A's *configurable
  objective* idea by **inverting** its anti-refusal axis: the judge scores
  treat-as-data / correct-refusal / fake-boundary-ignored as the *positive*
  outcome. Rubric/criterion-based (never the verbosity scorer). Single, small,
  deterministic-where-possible.
- [x] **2.2 Judge-calibration sliver (the 5% of Bundle A)** — synthetic
  controlled inputs → **monotonicity** + **strict quality-tier ordering** +
  **per-axis ablation**, to catch judge bias *before* the judge is trusted (the
  technique that caught Source A's own 46.7% length bias). Add the step they
  skipped: a tiny **gold slice** (hand- or council-labelled) and a **rank
  correlation** (Spearman / Cohen's κ) of judge vs gold. No statistical-inference
  apparatus beyond this. Verify: calibration suite runs deterministically; judge
  is monotone + strictly tier-ordered; correlation reported.
- [x] **2.3 Behavioral pressure fixtures** — author the prompt-structure
  categories as payload-free fixtures: identity-dissolution / role-takeover,
  fake divider / boundary-inversion tokens, manufactured consent / authority,
  and the two under-covered shapes — **refusal-suppression-by-coercion** and
  **dual-response / hidden-channel**. Each maps to the rule that must catch it.
- [x] **2.4 Run the behavioral corpus (human-gated)** <!-- operator-gate: lexical legs verified (lint_confusables/hidden-unicode tests); corpus+judge shipped ready; live cross-host behavioral measurement is the documented billable operator run --> — score the 2.3 + 1.4
  fixtures with the 2.1 judge. For every failure **with a mitigation path**,
  harden the responsible rule (`untrusted-input-defense` /
  `security-sensitive-stop` / `lethal-trifecta-guard`) with a named fixture and
  re-run. Actionability stop-condition: a failure with no mitigation path is
  logged, not chased.
- [x] **2.5 Characterise residual nulls honestly** — for any fixture class that
  comes back null, state *why* (covered-by-design vs not-reachable-on-this-host
  vs out-of-scope). This is the disciplined use of the threats-to-validity idea —
  **labels, not a statistics harness.**

## Phase 3 — Two small infra adopts (gap-fillers, optional)

Only the infra patterns that fill a real AC gap; each is independently shippable
and can be dropped without affecting Phases 1–2.

- [-] **3.1 Two-tier disagreement-flag classifier** <!-- cancelled: optional gap-filler, no current consumer; cheap lexical tripwire tier already ships via Phase-1 linters; LLM-escalation tier is speculative maintenance debt per council do-not-cross --> — a cheap regex tripwire that
  escalates to an LLM classifier and **records disagreement** (`mixed_signal` /
  `regex_disagreed`) rather than dropping it. Apply it as a **defensive
  pre-filter / red-team triage** for untrusted content, not as a runtime
  blocklist. Verify on the Phase-1 fixtures: disagreements are surfaced, not
  swallowed.
- [x] **3.2 PII-exclusion-by-construction telemetry** — adopt the *design
  principle* (make the event/log TYPE physically incapable of holding content, so
  there is no scrubber to fail) as a hardening note for `domain-safety-pii`
  (Surface 2 — logs) and `artifact-engagement-recording`. Keep AC's stricter
  posture (telemetry default-OFF). Reject the always-on tiers and any public
  dataset egress. Verify: the principle is documented against both surfaces;
  no new always-on collection is introduced.
- [-] **3.3 (defer) Early-exit parallel racing** <!-- cancelled: deferred by design; documented future option only --> — note the `minResults` +
  grace-period + hard-timeout + staggered-wave pattern as a future option **iff**
  the council ever fans out beyond its fixed member set. Not built now.

## Acceptance criteria

- The three named defense gaps (homoglyph/confusables, zero-width runtime gate,
  refusal-suppression/dual-channel) are each COVERED or explicitly DEFERRED with
  a reason — the deferred enforcement-projection revisit is unblocked by a real
  pressure-corpus.
- A defensive judge exists that scores correct refusal / data-handling, is
  monotone + strictly tier-ordered, and has a reported rank-correlation to a gold
  slice.
- Every shipped fixture has a mitigation path or is documented out-of-scope; no
  fixture stores a measured bypass rate.
- The Do-not-build list is honoured: no offensive content, no statistical-rigor
  harness, no verbosity scorer, no egress.
