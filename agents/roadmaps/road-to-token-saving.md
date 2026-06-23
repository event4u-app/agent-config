---
complexity: structural
status: ready
---

# Road to token saving — measure, then cut, at constant quality

> Cut the package's per-request token load at **held-constant output quality** —
> measurement substrate first, then the thin-projection lever, cache-aware
> ordering, RTK everywhere, and the dead-weight removals — each gated on real
> evidence, never on a chars/4 estimate.

## Goal

Reduce always-loaded + per-request tokens (today the package is a measured-by-
proxy **net +59k tokens/request** because rule bodies ship eager) toward the
kernel-only floor, **without a quality regression** proven by a length-controlled
paired benchmark. Every lever lands behind a falsification gate; no lever ships
on an unmeasured claim.

> **Council-decided (claude-sonnet-4-5 + gpt-4o, 2026-06-18).** The decisions
> D1–D7 below are resolved verdicts, not open questions — baked in so execution
> does not re-litigate them. Convergence: measurement is D0; thin projection
> adopts globally only after a host-compliance falsification; telegraph-speak
> retires immediately; cache-aware ordering becomes a CI invariant. Both members
> named D0 the highest-leverage move and "thin flip without validation" the
> biggest risk (silent breakage of 78 rules, misread as model regression).

## Context

Internal audit + external research (2026-06-18) found:

- **Thin projection is the biggest lever and ships disabled.** `lean_projection.mode`
  defaults to `eager-all`, inlining all 78 non-kernel rule bodies; `thin` would
  demote them to one-line router pointers (proxy estimate −46k tok/request). The
  thin default was gated behind a live A/B that was never run.
- **`alwaysApply: false` is advisory.** On Claude Code the plugin loader surfaces
  every rule body regardless — only the thin projector physically removes bodies.
  This means thin projection is a *contract with the host*, and may be a no-op on
  hosts that reconstruct bodies internally → must be falsified per host.
- **telegraph-speak measures net-negative** (+56 tok), is maintainer-scoped, and
  is redundant with `direct-answers` Iron-Law-3. BPE already single-tokens
  "the/a/an" → de-articling saves far less than word-count implies.
- **No real tokenizer** (chars/4 proxy everywhere), no live A/B, no quality-held-
  constant benchmark.
- **RTK** is the only measured-positive lever (−585 tok/req) but maintainer-scoped
  with a tiny 8-command corpus.

External evidence shaping the plan (measured, not claimed): context rot (Chroma —
smaller always-loaded surface *improves* quality, not just cost); Tool-Search /
deferred loading (Anthropic — 85% token cut with accuracy rising); KV-cache
stability (Manus — 0.1× cached vs 1× fresh; a byte-stable prefix is a 10× cost
lever); compression degrades structure/code/reasoning (LLMLingua) so Iron-Law
literals and numbered-options must never be compressed; verbosity bias in LLM
judges (+17.3%) means token-saving wins are falsely rejected unless judging is
length-controlled. Tools to learn from: `ctxlint`, `agent-skill-linter`, ECC
`context-budget`, `headroom`/`tokf` (better-measured CLI filters), `promptfoo`
(CI token+quality A/B).

## Prerequisites

- [ ] Confirm the cross-platform hook envelope shape and which hosts support
      tool-input rewrite vs deny-only (`src/scripts/hooks/envelope.py`,
      `block_no_verify.py`).
- [ ] Confirm `lean_projection.mode` default + projector entry points
      (`src/config/agent-settings.template.yml`, `src/scripts/project_thin_rules.py`,
      `src/scripts/condense.py`).

## Automation & human gates

This roadmap is built to run **mostly autonomously**. Decisions D1–D7 are already
resolved (council, above), so execution does not stop to ask which lever to pull.

- **Fully autonomous (mechanical edit + CI/script-verified):** Phases 0, 1, 2, 3,
  5, 6, 7, 8, 9, 10. Scope reclassification, trigger additions, hook + linter
  authoring, telegraph removal, condensation decision (deterministic gate), and
  all measurement are agent-executable and verified by the Phase 0 rig + CI gates
  — no user input needed beyond the standard commit/push authorization.
- **The falsification checklist is a script, not a judgement call.** Phase 4's
  six gates (a–f) ship as one `task tokensave:falsify` script that emits
  pass/fail per gate; the thin flip is data-gated, never vibe-gated.
- **Two — and only two — human gates:**
  1. **Phase 4 thin-projection rollout to real consumers.** Flipping the default
     and ramping 10%→100% changes behaviour for downstream projects → explicit
     user sign-off once the falsification script is green. (Everything up to "all
     gates green, ready to ramp" is autonomous.)
  2. **Host-vendor escalation** if a host (e.g. Claude Code) reconstructs rule
     bodies and ignores thin projection — filing/raising that is the maintainer's
     call.
- **Phase 6 (retire telegraph-speak) is unblocked and parallel** — zero
  dependencies; can land before Phase 0 completes.

## Disposition (2026-06-23) — autonomous / human-measurement split

The autonomous-mandate master-plan council (claude-sonnet-4-5 + gpt-4o, deep,
`agents/runtime/council/responses/master-plan-2026-06-23.json`) drew the
autonomous/deferred boundary for this 52-step roadmap. The verdict-gated phases —
**Phase 4** (thin-projection flip, the −46k lever), **Phase 6** (retire
telegraph-speak, gated on the real-tokenizer net-negative finding), **Phase 7**
(condensation-ROI decision), and **Phase 9** (rule-surface audit, after thin is
proven) — require a human-judged paired experiment, a host-compliance
falsification, and a production-shaping rollout decision that an unattended agent
**cannot** credibly produce or sign off. They are split into
[`later/road-to-token-saving-HUMAN-MEASUREMENT.md`](later/road-to-token-saving-HUMAN-MEASUREMENT.md)
(parked `later`, resumes when the operator has run the measurement harness).

**Autonomous track (this roadmap):** Phase 0 (build the measurement *harness* —
real tokenizer, golden set, paired-judge harness, host-compliance probe — the
*scaffolding*, not the human verdict run), Phases 1–3 (RTK scope/triggers/wrap
hook + snapshot tests), Phase 5 + Phase 8 (the CI invariant + budget linter —
the linter machinery, with the Phase-0-derived threshold applied once measured),
and Phase 10 (backlog triage). These are buildable disabled-by-default without a
human verdict and are the next focused execution unit — NOT yet started here
(building measurement infrastructure under an exhausted context would risk the
measure-first discipline this roadmap is locked on). All 52 items remain `[ ]`;
none is force-marked done.

## Phase 0 — Measurement substrate (the prerequisite to every cut)

Council D2, promoted to D0: no architectural cut on a ±25% chars/4 estimate.
Build the evidence rig first.

- [ ] Add a real tokenizer (tiktoken `cl100k_base`) to the bench path; replace
      the chars/4 proxy in `projection-cost.json` / value-ladder with real counts
      (or record both and flag the delta).
- [ ] Build a held-out golden set of ~30 tasks spanning all 88 rules, including
      multi-turn, conflicting-rule, and corner-case scenarios; hand-labelled
      expected outcomes (not LLM-generated).
- [ ] Build a **length-controlled paired judge**: pairwise A/B in randomised
      order, swap-and-recheck for position/length bias, reject the judge if it
      flips; paired significance (Wilcoxon signed-rank). Evaluate `promptfoo` as
      the harness before hand-rolling.
- [ ] Add a **host-compliance probe**: ship a thin-projected canary rule, invoke
      its keyword on each supported host (Claude Code, Cursor, Augment), assert
      the rule fires AND the host shows the pointer, not the body.
- [ ] Instrument latency p95/p99 for on-demand rule loads (not just mean).
- [ ] Wire CI gates: token-regression (fail if a projection exceeds baseline
      >5%) and quality-regression (fail if thin's judge win-rate <48%).
      <!-- carve-out: new-gate-verification -->

**Exit:** a real-tokenizer before/after of thin vs eager on the golden set, with
a length-controlled judge verdict and per-host compliance result, all reproducible
in CI.
**Rollback:** none — measurement only; the rig is additive.

## Phase 1 — RTK everywhere (un-gate the scope)

Headline fix: RTK assets are maintainer-only → inactive in consumer projects.
Council: if RTK is truly deterministic + safe, it belongs in the kernel, not a
profile toggle — validate against the Phase 0 golden set, then promote.

- [ ] Remove `workspaces: [agent-config-maintainer]` + reclassify `packs: [meta]`
      → core scope on `src/rules/cli-output-handling.md` and
      `src/skills/rtk-output-filtering/SKILL.md`, so they load in every project.
- [ ] Run the Phase 0 golden set through RTK; confirm no output-completeness
      regression (ANSI/structured output, the `git diff` truncation denylist).
      If clean → promote RTK wrapping to always-on; if not → keep profile-gated
      and record the failing case.
- [ ] Decide `/optimize rtk` exposure (default: keep internal — filter authoring
      is maintenance); ensure its scope does not block the rule/skill from loading.
- [ ] Re-generate `dist/router.json`, discovery manifest, condensation, per-tool
      projections; confirm no asset assumed the maintainer-only scope.

**Exit:** rule + skill resolve in a consumer-shaped project (no maintainer
workspace), verified against `dist/router.json` + discovery manifest; RTK
golden-set regression result recorded.
**Rollback:** revert the scope frontmatter; re-run sync/condense.

## Phase 2 — Close the RTK trigger gap

The rule fires only on `git/phpstan/rector/phpunit/composer`; the skill's
"✅ Always" table covers far more.

- [ ] Add missing trigger keywords to `cli-output-handling`: `npm`, `pnpm`,
      `yarn`, `eslint`, `tsc`, `vitest`, `jest`, `pytest`, `ruff`, `mypy`,
      `pyright`, `cargo`, `go`, `golangci-lint`, `docker`, `kubectl`, `terraform`
      (reconciled against the skill table + `/optimize rtk` detection table).
- [ ] De-duplicate: every "✅ Always" command has exactly one matching trigger;
      every "❌/⛔" command has none.
- [ ] Spot-check via trigger lookup (live trigger-eval is a human gate — hand the
      command to the user if needed).

**Exit:** every "✅ Always" command in the skill has a matching trigger.
**Rollback:** revert the added triggers.

## Phase 3 — Deterministic RTK wrap hook + install verification

Convert RTK from advisory to deterministic; stop trusting the self-reported flag.

- [ ] Add a runtime `which rtk` probe; key wrapping decisions off the live probe,
      not `personal.n`. Mismatch (flag vs reality) surfaces once; absent rtk →
      silent plain-command fallback, no nag.
- [ ] Implement a `pre_tool_use` wrap hook modeled on `block_no_verify.py`: parse
      Bash, no-op when rtk absent, **denylist completeness-critical** (`git diff`,
      `rtk read`, already-piped, short commands), fail-open on parse error.
      Mechanism: deny-and-instruct (cross-platform exit-code envelope) where
      rewrite is unsupported; `updatedInput` rewrite where the host supports it.
- [ ] Wire into `hook_manifest.yaml` for every supporting platform; respect
      `lint_hook_concern_budget`; add a settings toggle (conservative default).
- [ ] Snapshot tests under `tests/hooks/`: eligible wrapped/flagged, denylisted
      untouched, rtk-absent no-op, parse-error fail-open.
      <!-- carve-out: new-gate-verification -->

**Exit:** hook fires on an eligible command, leaves denylisted commands untouched,
proven by snapshot tests run locally.
**Rollback:** remove the manifest entry + script; Phases 1–2 advisory path stands.

## Phase 4 — Thin projection (the −46k lever), gated on Phase 0

Council D1: adopt globally, but only after Phase 0 evidence + host compliance.
The #1 risk is silent breakage — 78 rules that stop firing while the build looks
green.

- [ ] Ship the falsification as a script (`task tokensave:falsify` or
      `src/scripts/tokensave_falsify.py`) that runs gates (a)–(f) below and emits
      a single pass/fail report — so the flip is data-gated and re-runnable, not
      a manual checklist. <!-- carve-out: new-gate-verification -->
- [ ] **Falsify before flipping** (all must pass): (a) all 78 demoted rules fire
      on realistic invocations on every host; (b) host shows pointer not body
      (Phase 0 probe) — if a host reconstructs bodies, thin is a no-op there →
      block + escalate to the vendor; (c) real-tokenizer thin-vs-eager within ±10%
      of the −46k estimate or the business case is void; (d) on-demand cache-hit
      rate >90%; (e) p99 latency <1s; (f) no quality regression on the Phase 0
      length-controlled judge.
- [ ] Flip the default projection to `thin` behind a tight rollout: 48h opt-in
      (env/profile) → 72h maintainer-forced → 10% → 50% → 100% within ≤7 days
      (fast to avoid KV-cache fragmentation across thin/eager pools). Keep an
      `eager` escape hatch live for 30 days.
- [ ] Kill-switch (any → instant rollback): rule-firing <100% on the CI corpus,
      host non-compliance, cache-hit <90%, p99 >1s, judge win-rate <48%.

**Exit:** thin is the default; the falsification checklist passed; rollout
completed with telemetry showing rule-firing at 100% and no quality regression.
**Rollback:** flip `lean_projection.mode` back to `eager-all` (one setting);
escape hatch covers in-flight sessions.

## Phase 5 — Cache-aware ordering as a CI invariant (D5)

KV-cache: cached reads bill at 0.1× vs 1× fresh, but any prefix edit re-pays a
1.25×–2× write and invalidates downstream → byte-stability is a 10× cost lever.

- [ ] Adopt a two-level invariant: macro order `tools → system → kernel → (variable
      last)`; micro deterministic sort within each layer (alphabetical / stable
      hash) so build-to-build reordering never invalidates cache.
- [ ] Add a CI guard: the kernel/always-loaded prefix must be byte-identical to
      the previous release unless a version bump is present.
      <!-- carve-out: new-gate-verification -->
- [ ] Promote the existing ≥24h kernel-edit slow-rollout from advisory to a
      blocking gate (cache-invalidation cost is the second justification, beside
      review safety).

**Exit:** the CI guard fails a non-version-bumped kernel-prefix change; projection
order is deterministic across two clean builds.
**Rollback:** demote the guard to warning.

## Phase 6 — Retire telegraph-speak (D3)

Net-negative, unmeasured, maintainer-scoped, redundant with `direct-answers`
Iron-Law-3; BPE already single-tokens the articles it strips.

- [ ] Delete `src/rules/telegraph-speak.md`, its CI gate
      (`validate_telegraph_carveouts.py`), and settings keys (`telegraph.*`);
      migrate any load-bearing carve-out semantics into `direct-answers` /
      `preservation-guard` if not already covered.
- [ ] Changelog note: removed telegraph-speak (redundant, measured net-negative).
- [ ] Trace downstream refs (frugality-charter index, router, projections).

**Exit:** telegraph-speak removed; brevity behaviour unchanged (covered by
`direct-answers`), verified on the Phase 0 golden set (no quality delta).
**Rollback:** restore from git; re-add the router entry.

## Phase 7 — Condensation ROI decision (D4)

Condensation returns ~1.1–1.7% on already-terse source — possibly measuring BPE
noise, not signal — while carrying real CI/hash machinery. Thin projection makes
rule-condensation largely moot (pointers don't need condensing).

- [ ] Measure on the real tokenizer (Phase 0): does skills-condensation save ≥500
      tokens? Is the pipeline deterministic (no temp>0 LLM step that would
      invalidate KV-cache)? Does telegraph-style source tokenize *worse*
      (bytes/token)? Is a condensed skill human-debuggable in <30s?
- [ ] Decide per the gate: ≥500 tok AND deterministic AND readable → keep
      skills-only, retire rule-condensation gates (moot under thin); otherwise
      retire the pipeline entirely.
- [ ] Apply the decision: remove the now-moot rule-condensation CI machinery if
      retired.

**Exit:** a measured ROI verdict + the pipeline scoped/retired accordingly; CI
machinery matches the decision.
**Rollback:** revert the scope change; re-enable condensation gates.

## Phase 8 — Always-loaded budget linter (D6)

Make the always-loaded token surface a first-class, gated metric.

- [ ] Add a CI linter (learn from `ctxlint` / ECC `context-budget`) that sums the
      always-loaded token surface (kernel + always-scanned skill descriptions +
      tier-1) and fails past a threshold.
      <!-- carve-out: new-gate-verification -->
- [ ] Set the threshold at the **quality elbow** found in Phase 0 (context-rot:
      quality degrades well before the window fills), not at a % of max window.
- [ ] Trim the 15 skill descriptions at the 202-char cap toward ~150; descriptions
      are always-scanned across ~250 skills.

**Exit:** the linter fails a synthetic over-budget always-loaded surface and
passes the current one; threshold documented with its Phase 0 evidence.
**Rollback:** demote the linter to warning.

## Phase 9 — Rule-surface audit (D7), after thin is proven

Once on-demand loading is proven viable, question whether 88 rules even need
router entries.

- [ ] Audit the 50 tier-2 rules: which genuinely need a router pointer vs could
      move entirely to skill-triggered loading (zero always-loaded footprint)?
- [ ] Move the qualifying rules; re-measure the always-loaded surface (Phase 8
      linter) to confirm the reduction.

**Exit:** tier-2 rules that don't need router entries are skill-triggered; the
always-loaded surface measurably drops with no rule-firing regression.
**Rollback:** restore router entries for any rule whose firing regressed.

## Phase 10 — Token-saving backlog (extensible umbrella)

Park the next levers here; triage into committed phases rather than spawning
one-off roadmaps.

- [ ] Triage: benchmark RTK against `headroom` / `tokf` on the Phase 0 rig (both
      publish methodologies; RTK's 60–90% is its own unmeasured claim).
- [ ] Triage: MCP code-execution / Tool-Search deferred loading for tool/MCP
      schemas (measured 85–98% cuts) — applicability to how the suite exposes tools.
- [ ] Triage: sub-agent context isolation for read-only fan-out (research, audit)
      — return ~1–2k-token digests, not raw work (caveat: not for interdependent
      build work).
- [ ] Triage: output-side redirect→summary→targeted-detail patterns beyond RTK.
- [ ] Triage: any further lever — capture here, promote to a phase when committed.

**Exit:** each candidate is promoted to a phase or marked `[-]` with a reason; no
stale candidates.
**Rollback:** none — backlog only.

## Acceptance criteria

- [ ] A real-tokenizer, length-controlled, paired benchmark exists and runs in CI
      (Phase 0).
- [ ] RTK rule + skill are active in a consumer-shaped project; trigger gap closed;
      deterministic wrap hook ships with passing tests (Phases 1–3).
- [ ] Thin projection is the default, having passed the full falsification
      checklist with rule-firing at 100% and no quality regression (Phase 4).
- [ ] Cache-aware ordering + kernel byte-stability are CI-enforced (Phase 5).
- [ ] telegraph-speak is removed with no brevity-behaviour regression (Phase 6).
- [ ] Condensation ROI is measured and the pipeline scoped/retired accordingly
      (Phase 7).
- [ ] An always-loaded budget linter gates CI at the quality-elbow threshold
      (Phase 8).
- [ ] Tier-2 rules that don't need router entries are skill-triggered; always-
      loaded surface measurably reduced (Phase 9).
- [ ] The Phase 10 backlog is triaged (no stale candidates).
- [ ] Every shipped lever carries a measured before/after at held-constant
      quality — no lever shipped on an unmeasured claim.
