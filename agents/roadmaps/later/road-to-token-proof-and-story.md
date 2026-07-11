---
complexity: structural
status: later
parent_roadmap: road-to-token-saving
---

# Road to token proof and story — orchestrate, prove, activate, adopt

> **Parked in `later/` (2026-07-11, AI-council re-scoping).** Phase 2 measures
> FIELD token savings "before vs after each flip" + correlates with real
> `sessions.jsonl` — but the thin/scoped default-flips it would measure FAILED
> the quality gate (#887, thin 36.2% < 48%) and are evidence-blocked (#888), and
> no field cost data is captured. So the field-evidence report cannot exist yet.
> Council (claude-sonnet-4-5 + gpt-4o, 2-round debate, 2026-07-11) converged:
> **park, do not close** — the token-savings THESIS is intact; only the *thin*
> mechanism died. If scoped-context-reduction under orchestration (the live path,
> `road-to-orchestration-scope-decision` + `road-to-subagent-value-realization-followup`)
> shows quality-neutral savings, Phase 2's measurement chain applies to that
> mechanism instead.
>
> **Resume when:** a context-reduction mechanism (orchestration-scoped loading,
> or a new single-request one) passes the quality gate AND real field
> `sessions.jsonl` spend data exists for a before/after window.

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

- [x] `check_quality_regression`: hard-fail (exit 2, explicit message) when
      the report carries `dry_run: true` — a mock is never an unlock.
- [x] Add `--as-flip-gate` mode: inconclusive ("0 decisive pairs") → exit 2;
      default CI-inert path keeps exit 0.
- [x] Tighten the parent blocker's resolution criterion from "file exists"
      to "`check_quality_regression --as-flip-gate` exits 0" (doc edit in
      `road-to-token-saving` § Blockers).
- [x] Tests: dry-run fixture → exit 2; all-ties fixture → exit 2 under
      `--as-flip-gate`, exit 0 without; decisive-pass fixture → exit 0 both.

**Exit:** a mock or inconclusive report can no longer satisfy any flip gate;
tests prove it.
**Rollback:** flag removal; default CI path byte-identical.

## Phase 1 — One critical path for six tracks (the program table)

The single orchestration surface. Other roadmaps link here, never copy.

- [x] Write the critical path + tracking table (roadmap → phase → status →
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
      <!-- done 2026-07-07: table + sequence live below (§ Program tracking);
      cross-links added to road-to-token-saving + later/HUMAN-MEASUREMENT;
      request-scoped + golden-set link from their "Covered elsewhere" blocks.
      road-to-discipline-profile-tiering linked after the origin/main merge
      brought it into this branch (2026-07-07). -->
- [x] **Activation end-state (doc + settings contract):** ONE runtime knob
      `discipline_profile: auto|off|essential|full`, shipped default `auto`
      (= ON) once its evidence gates pass; thin projection folds under
      `essential` as an implementation detail when un-deferred
      (`lean_projection.mode` absorbed/retired then); consumer scoping is
      install-time (default scoped after its gate), not a runtime setting.
      Record this in the rule-router contract + settings template comments
      so no track ships a competing knob.
      <!-- done: rule-router contract § Activation end-state + settings
      template comments (projection.rule_workspaces/rule_packs). -->
- [x] **Rollback SOP (gap closed per council):** one documented reversion
      path per flip — scoped→`legacy-all` (setting), `auto`→`off`/`full`
      (setting), thin→eager (setting + `task generate-tools`) — each with
      the verification command that proves the revert took effect.
      <!-- done: § Rollback SOP below. -->
- [x] Explicit non-goals restated to prevent re-litigation: thresholds,
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
| road-to-request-scoped-rule-load | P1 default flip (P0–P3 built; P4 parked) | gate | P1 default flip = human gate |
| road-to-golden-set-coverage | P2 labelling (P0/P1/P3 built) | gate | P2 = operator labelling |
| road-to-discipline-profile-tiering | P1 inert build | open | default flip = evidence gates P1–P2 |
| road-to-token-proof-and-story (this) | P2 arms (P0/P1 + P2-build done) | gate | corpus privacy + flips |

(Update this table per the roadmap-progress-sync cadence; it is the single
program-state surface.)

## Rollback SOP — one documented reversion path per flip

| Flip | Revert | Proof the revert took effect |
|---|---|---|
| Consumer scoping (`projection.rule_workspaces` / `rule_packs`) | Remove/empty the keys in `.agent-settings.yml`, run `task generate-tools` | `.claude/rules` count equals `dist/agent-src/rules` count; `npx vitest run tests/scripts/rule_workspace_scoping.test.ts` green |
| `discipline_profile` default (`auto`) | Set `discipline_profile: full` (legacy surface) or `off` in `.agent-settings.yml` | resolution tests owned by `road-to-discipline-profile-tiering` |
| Thin projection (`lean_projection.mode: thin`) | Set `eager-all`, run `task generate-tools` + `task sync` | rule BODIES present again in the tool trees; `project_thin_rules --measure` matches the eager reference |

Every revert is a settings flip + regeneration — no code change (ADR-040).

## Phase 2 — Field evidence: replay + session telemetry

Turn proxy math into "measured in our own production repos".

- [x] Build a corpus exporter: sample N≥100 real prompts (+ open-file paths
      + invoked commands, which `path_prefix`/`file_pattern`/`command`
      matching needs) from Galawork and event4u agent sessions.
      **Operator/privacy gate:** export is reviewed; prompts with client or
      personal data are dropped or redacted per the low-impact-corpus
      privacy floor before the corpus is stored.
      <!-- done (build): src/scripts/export_replay_corpus.ts + tests —
      JSONL chat-history → redacted router_telemetry corpus (prompts/command),
      .local.yaml gitignored so an unreviewed export cannot land. The export
      RUN + privacy review is operator work (blocker field-corpus-privacy). -->
- [x] **Reconcile intent semantics first:** document which semantics
      (`trigger_coverage.ts` word-set vs `router_telemetry.ts`
      informational-only) models host behaviour, align or justify the
      divergence in the rule-router contract, and state the chosen semantics
      in every replay report.
      <!-- done: rule-router contract § Intent-trigger semantics — divergence
      locked as justified (falsifiability floor vs field estimation); replay
      undercount caveat mandatory on every published figure. -->
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

- [x] A dry-run or inconclusive report cannot green-light any flip;
      test-proven (Phase 0).
      <!-- verified: 17 flip-gate tests green post-merge -->
- [x] One critical path + tracking table covers all six tracks; activation
      end-state (one runtime knob, default ON post-gates) and rollback SOP
      are written down once (Phase 1).
      <!-- verified: § Program tracking + Rollback SOP + contract § Activation end-state live on main -->
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
- **Owner:** maintainer
- **Blocks:** Phase 2 post-flip arms and Phase 3 (need the flips landed);
  Phases 0, 1 and the Phase 2 corpus/tooling build are unblocked now.
- **What to do:** execute the flip sequence in § Program tracking step 3
  (consumer-scoping default → discipline_profile default → thin
  un-deferral decision), each behind its own hardened gate.
- **Resolved when:** the consumer-scoping default flip and the
  discipline_profile default flip have landed (thin optional — arms can
  run with the "modelled, not shipped" label for the thin arm).

### blocker: field-corpus-privacy
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 2 replay arms (need the exported, privacy-reviewed
  corpus from Galawork/event4u sessions).
- **What to do:** run `./scripts-run src/scripts/export_replay_corpus
  --history <repo>/agents/runtime/.agent-chat-history --limit 200` per
  repo, then review the `.local.yaml` output under the low-impact-corpus
  privacy floor (drop/redact anything client- or person-identifying).
  Progress 2026-07-07: agent-config's own history exported (30 prompts →
  `internal/bench/corpora/field-prompts.local.yaml`, gitignored, awaiting
  review). Still needed: exports from the Galawork consumer repos (their
  history files are outside this checkout — operator run) to reach N≥100.
- **Resolved when:** a reviewed corpus file exists and the
  low-impact-corpus privacy floor checklist for it is signed off.
