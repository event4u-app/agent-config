---
complexity: structural
status: ready
parent_roadmap: road-to-token-saving
---

# Road to token proof and story — orchestrate, prove, activate, adopt

> The token program now spans six tracks (`road-to-token-saving` +
> HUMAN-MEASUREMENT, `road-to-request-scoped-rule-load`,
> `road-to-golden-set-coverage`, `road-to-discipline-profile-tiering`, and
> this one). This roadmap is the **program orchestrator** (single tracking
> table, per council verdict
> `agents/settings/contexts/token-program-integration-verdict.md` — no
> separate orchestrator roadmap) and closes the loop: harden a verified gate
> hole (the flip gate exits 0 on a dry-run mock), fix one critical path,
> convert proxy estimates into **field evidence**, define the activation
> end-state (ONE runtime setting, default ON), and spend the result on the
> first external pilot. `docs/benchmark.md` honestly publishes a ~5× token
> overhead today; this program is what changes that number, and the change
> is the pitch.

## Goal

When the flips ship, the release carries (a) a hardened, un-fakeable gate
trail, (b) field-measured before/after numbers from real consumer-shaped
sessions, (c) a refreshed public benchmark + release story wired into
`docs/CLAIMS.md`, (d) an activation end-state where the optimization is ON
by default behind evidence gates, and (e) one named external pilot.
Locked: the product-bets council DEFER stands — token cost is an
evidence-backed value prop tested at N=1, not the assumed adoption blocker.

## Context — verified on the live checkout, 2026-07-07

- **Gate hole (live-verified):** `bench_quality_run --dry-run` writes
  `internal/bench/reports/quality-run.json` (`dry_run: true`, 30 mock ties);
  `check_quality_regression` consumes it and **exits 0** ("inconclusive —
  no decisive pairs"). The source contains zero `dry_run` handling. The
  parent blocker's criterion is literally "the file exists". Containment:
  the report path is gitignored — but the flip decision is a local operator
  workflow, and inconclusive-exit-0 is indistinguishable from pass in a
  script chain.
- **Field-evidence machinery exists, unused for this:**
  `router_telemetry.ts` replays `dist/router.json` trigger-matching over a
  prompt corpus offline (pure, no API; `intent` triggers
  informational-only — replay **undercounts** intent-triggered rules;
  honest caveat required on every replay number).
  `agents/cost-tracking/sessions.jsonl` records real session spend. Nothing
  correlates the two.
- **Intent-semantics divergence:** `trigger_coverage.ts` matches intents via
  word-set inclusion; `router_telemetry.ts` treats them as
  informational-only. Two gates, two semantics — must be reconciled before
  field numbers are publishable.
- **The public number this program changes:** `docs/benchmark.md` reports
  the honest "~5× the tokens" finding, and the 2026-07-07 cost-factor sweep
  added the 11.7×-full vs 3.3×-essential shape. Consumer scoping (−63
  rules) + discipline tiering + (later) thin projection attack exactly the
  measured overhead.
- **Adoption remains the strategic gap**
  (`later/road-to-external-proof-upgrade.md` parked; product-bets Phase 3
  requires a named adopter). The token story is the first pitch grounded in
  the repo's falsifiability culture.

## Automation & human gates

- **Fully autonomous:** Phase 0 (gate hardening), Phase 1 (tracking table),
  Phase 2 build steps (corpus tooling).
- **Human gates:** Phase 2 corpus export (privacy review per the
  low-impact-corpus privacy floor), the flip decisions themselves (owned by
  the respective tracks), Phase 3 publication sign-off, Phase 4 outreach.

## Phase 0 — Harden the flip gate (small, verified, do first)

- [ ] `check_quality_regression`: hard-fail (exit 2, explicit message) when
      the report carries `dry_run: true` — a mock is never an unlock.
- [ ] Add `--as-flip-gate` mode: inconclusive ("0 decisive pairs") → exit 2;
      default CI-inert path keeps exit 0.
- [ ] Tighten the parent blocker's resolution criterion from "file exists"
      to "`check_quality_regression --as-flip-gate` exits 0" (doc edit in
      `road-to-token-saving` § Blockers).
- [ ] Tests: dry-run fixture → exit 2; all-ties fixture → exit 2 under
      `--as-flip-gate`, exit 0 without; decisive-pass fixture → exit 0 both.

**Exit:** a mock or inconclusive report can no longer satisfy any flip gate;
tests prove it.
**Rollback:** flag removal; default CI path byte-identical.

## Phase 1 — One critical path for six tracks (the program table)

The single orchestration surface. Other roadmaps link here, never copy.

- [ ] Write the critical path + tracking table (roadmap → phase → status →
      gate) into this file's § Program tracking below; cross-link from
      `road-to-token-saving`, HUMAN-MEASUREMENT,
      `road-to-request-scoped-rule-load`, `road-to-golden-set-coverage`,
      `road-to-discipline-profile-tiering`. Sequence (council-integrated):
      1. **Parallel now (autonomous):** request-scoped Phases 0–3 (opt-in
         build) ∥ golden-set Phases 0, 1, 3 ∥ this Phase 0 ∥
         discipline-profile-tiering Phase 1 (inert build).
      2. **Operator batch (one sitting):** golden-set Phase 2 labelling →
         live judge run at `--scope consumer` (post-consumer-scoping, ~3×
         cheaper) → live canary on 3 hosts → essential full-corpus baseline
         (discipline-tiering Phase-1 gate).
      3. **Human flip gates, in order:** request-scoped Phase 1 default
         flip (`legacy-all` → scoped) → discipline-tiering default flip
         (`discipline_profile: auto`, its Phase-2 gate) → thin un-deferral
         decision (HUMAN-MEASUREMENT resume, as a sub-mechanism of
         essential, re-swept).
      4. **After flips:** this Phase 2 (field arms) + Phase 3 re-benchmark
         → Phase 4 pilot.
- [ ] **Activation end-state (doc + settings contract):** ONE runtime knob
      `discipline_profile: auto|off|essential|full`, shipped default `auto`
      (= ON) once its evidence gates pass; thin projection folds under
      `essential` as an implementation detail when un-deferred
      (`lean_projection.mode` absorbed/retired then); consumer scoping is
      install-time (default scoped after its gate), not a runtime setting.
      Record this in the rule-router contract + settings template comments
      so no track ships a competing knob.
- [ ] **Rollback SOP (gap closed per council):** one documented reversion
      path per flip — scoped→`legacy-all` (setting), `auto`→`off`/`full`
      (setting), thin→eager (setting + `task generate-tools`) — each with
      the verification command that proves the revert took effect.
- [ ] Explicit non-goals restated to prevent re-litigation: thresholds,
      judge design, hand-labelling, council decisions D1–D7, weak-host-lift
      verdict locks — all upstream.

**Exit:** every token roadmap links the same critical path; no phase claims
an order contradicting it; the activation end-state is written down once.
**Rollback:** doc-only.

## Program tracking

| Track | Next phase | Status | Gate |
|---|---|---|---|
| road-to-token-saving (parent) | P10 backlog triage | open | — |
| HUMAN-MEASUREMENT (later/) | H1 thin flip | parked | essential baseline + hardened flip gate |
| road-to-request-scoped-rule-load | P0–P3 build | open | P1 default flip = human gate |
| road-to-golden-set-coverage | P0, P1, P3 build | open | P2 = operator labelling |
| road-to-discipline-profile-tiering | P1 inert build | open | default flip = evidence gates P1–P2 |
| road-to-token-proof-and-story (this) | P0 gate hardening | open | P2+ = post-flip |

(Update this table per the roadmap-progress-sync cadence; it is the single
program-state surface.)

## Phase 2 — Field evidence: replay + session telemetry

Turn proxy math into "measured in our own production repos".

- [ ] Build a corpus exporter: sample N≥100 real prompts (+ open-file paths
      + invoked commands, which `path_prefix`/`file_pattern`/`command`
      matching needs) from Galawork and event4u agent sessions.
      **Operator/privacy gate:** export is reviewed; prompts with client or
      personal data are dropped or redacted per the low-impact-corpus
      privacy floor before the corpus is stored.
- [ ] **Reconcile intent semantics first:** document which semantics
      (`trigger_coverage.ts` word-set vs `router_telemetry.ts`
      informational-only) models host behaviour, align or justify the
      divergence in the rule-router contract, and state the chosen semantics
      in every replay report.
- [ ] Run `router_telemetry` replays under **four arms**: today (eager, all
      95) / consumer-scoped eager (~32) / scoped + `essential` /
      scoped + essential + thin (when un-deferred; until then report the arm
      as "modelled, not shipped"). Report per-request distribution: rules
      activated p50/p95, token-load p50/p95 per arm; carry the
      intent-undercount caveat on every figure.
- [ ] Correlate with `sessions.jsonl` real spend for the same period
      (before vs after each flip) → one report
      `internal/bench/reports/field-token-evidence.{md,json}`: proxy
      estimate vs replay estimate vs billed reality, deltas explained or
      flagged.
- [ ] Honest-null discipline: if field savings materially undershoot the
      82%/50k estimates (long sessions re-accumulating bodies, intent-rule
      loads dominating), record it as a finding that bounds the public
      claim — the claim ships at the *field* number, not the harness number.

**Exit:** field-token-evidence report exists with the shipped arms + billed
correlation; every public-facing number in Phase 3 traces to it.
**Rollback:** none — measurement only.

## Phase 3 — Public proof refresh (benchmark, claims, release story)

- [ ] Re-run the `docs/benchmark.md` cost axis (methodology unchanged)
      post-flip; publish the new mean-tokens/run beside the old ~5× finding
      — improvement or null, same table, same honesty.
- [ ] Wire the field numbers into `docs/CLAIMS.md` (claim → evidence file →
      reproduction command), so no README/marketing surface can cite an
      untraceable figure.
- [ ] Write the release story from `docs/RELEASE_STORY_TEMPLATE.md`:
      "request-scoped loading" — consumer scoping + discipline tiering +
      host-native globs (+ thin when un-deferred), with the before/after
      and reproduction commands. The differentiator is *measured,
      falsifiable* token governance, not a bigger number.
- [ ] Maintainer sign-off on all public surfaces (human gate).

**Exit:** benchmark, claims and release story published from one evidence
chain; `check_no_external_sources` + claims-lint green.
**Rollback:** docs revert.

## Phase 4 — Spend the story: one named external pilot (N=1)

Framing locked by the product-bets DEFER: token cost is **not assumed** to
be the adoption blocker; it is the strongest current value prop, tested at
N=1.

- [ ] Define the pilot profile: a team already running Claude Code/Cursor
      on a real codebase, feeling context/token pressure.
- [ ] Outreach artifact = the Phase 3 release story + a 15-minute
      reproduce-it-yourself path (`npx` install → `lean-projection-measure`
      → their own numbers on their own repo). Their measurement, not our
      claim.
- [ ] Success criterion (falsifiable): within the pilot, their measured
      per-session rule-layer load drops ≥50% at no reported quality
      regression over 2 weeks — or the miss is recorded and the story
      revised.
- [ ] Honest-null path: if no pilot converts on the token story, record
      that as adoption evidence (bounds the "token cost as value prop"
      hypothesis) and feed it back to the product-bets roadmap — that *is*
      the N-evidence the council asked for.

**Exit:** one pilot ran the measurement on their repo and a verdict
(adopt / decline / null) is recorded — any outcome closes the phase.
**Rollback:** n/a — evidence either way.

## Acceptance criteria

- [ ] A dry-run or inconclusive report cannot green-light any flip;
      test-proven (Phase 0).
- [ ] One critical path + tracking table covers all six tracks; activation
      end-state (one runtime knob, default ON post-gates) and rollback SOP
      are written down once (Phase 1).
- [ ] Field-token-evidence report exists: replay arms + billed correlation,
      intent-undercount caveat carried (Phase 2).
- [ ] Benchmark/claims/release story trace every number to that report
      (Phase 3).
- [ ] One external pilot verdict recorded, honest-null first-class
      (Phase 4).

## Blockers

### blocker: flip-gates-upstream (inherited)
- **Status:** open — owned by HUMAN-MEASUREMENT, golden-set, and
  discipline-profile-tiering roadmaps
- **Blocks:** Phase 2 post-flip arms and Phase 3 (need the flips landed);
  Phases 0, 1 and the Phase 2 corpus/tooling build are unblocked now.

### blocker: field-corpus-privacy
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 2 replay arms (need the exported, privacy-reviewed
  corpus from Galawork/event4u sessions).
- **Resolved when:** a reviewed corpus file exists and the
  low-impact-corpus privacy floor checklist for it is signed off.
