---
status: ready
complexity: structural
parent_roadmap: road-to-6.0.0-b-pack-scoped-projection
---

# Road to 6.0.0-C — Governance, evals, and evidence-based pruning

> Third of three `road-to-6.0.0-*` roadmaps. With profiles/packs now the
> surfacing unit (6.0.0-B), this roadmap installs the **governance that keeps
> the surface from re-bloating** and replaces the part1 feedback's *arbitrary*
> reduction targets (cut to 4 personas, halve rules, 223→120 skills) with
> **evidence-based** pruning. Depends on
> [`road-to-6.0.0-b-pack-scoped-projection.md`](road-to-6.0.0-b-pack-scoped-projection.md).
> Governance ships AFTER user-facing value, per the council ("governance before
> value is theater").

## Goal

A new visible command cannot be added without a pack, a budget slot, a
controlled verb, and a routing eval. Per-pack command budgets are linted. And
the persona/skill/rule "reduce it" asks are resolved by *measurement* (citation
counts, overlap analysis, tier-2 load telemetry) rather than by the reviewer's
arbitrary targets — so the cuts that happen are defensible and the option-value
artefacts survive.

## Context

**Verified reality (2026-06-02).** The repo already has strong growth
governance the part1 feedback overlooked: `lint_no_new_atomic_commands.py`
(every new command joins a locked cluster or is a shim), `command-surface-tiers.md`
(visibility tiers 0/1/2), `audit_command_surface.py` (overlap detection),
`lint_persona_governance.py` (≤2 specialists/domain, ≥1 skill citation, CI-gated),
`artifact-drafting-protocol` + `preservation-guard` + `skill_linter.py`. What's
**missing**: a per-pack command BUDGET lint, a controlled VERB list, routing
EVALS per visible command, and TELEMETRY to drive evidence-based pruning.

**Why the feedback's reduction targets are rejected as written.** The council
was decisive on all three of my pushbacks:

- **Personas → 4:** REJECT. The ≤2/domain cap is already linted; 14 specialists
  are cited by 30+ skills; collapsing breaks citations + the linter + domain
  framing. The "fewer visible" goal is met by pack-scoped surfacing (a developer
  never sees finance personas), not deletion. *Conditional:* run a citation +
  git-log audit; personas with <5 citations AND <3 commits/year are deletion
  candidates — evidence, not a target.
- **Skills 223→120:** PARTIALLY WRONG. Pack-scoping fixes the *user* visibility
  problem but not the *maintainer* review/merge/onboarding burden. Right move =
  measured-redundancy reduction (overlap analysis on families, collapse >70%
  content-similar same-domain skills) → realistic ~223→180-190, not 120.
- **Halve rules:** REJECT blanket halving. The router already loads only kernel
  (10) on `minimal`; tier-2 is hidden unless triggered. BUT my "option-value
  insurance" defence is itself unfalsifiable — require tier-2 load telemetry and
  prune the *provably* unused (<5% load over 30 days), keep the rest.

> **Council convergence (claude-sonnet-4-5 + gpt-4o, 2026-06-02):** "Both the
> plan ('223 is fine') and the reviewer ('223 is too many') argue maintenance
> burden in the absence of data. Add telemetry; decide on usage. Hard caps are
> right IF the exemption process is explicit (ADR-gated) — weighted/dynamic caps
> are governance-by-algorithm and get gamed at the meta level. Cap the public
> surface (visible + advanced); leave the internal composition layer
> uncapped — capping it kills composability."

## Phase 1: Per-pack command budget governance

- [ ] **Step 1:** Add a per-pack command-budget lint (extend the existing
  command-surface tooling, do NOT add a parallel script) enforcing **visible**
  budgets only: core ≤8, small ≤2, medium ≤5, large ≤8, platform ≤10. Count
  `visibility: visible` (+ `advanced`) commands per pack; `internal` is
  uncapped (composition layer). Pack size class comes from the pack manifest.
- [ ] **Step 2:** Add the **explicit exemption process** (not a dynamic cap):
  a pack over budget requires an ADR documenting the user need + the
  alternatives considered (merge / relocate / internalize); the exemption is
  re-justified at the next major. Add a gaming-detection note: >3 new packs in
  6 months without a user-facing launch triggers a governance review (prevents
  "pack-split to dodge the cap").
- [ ] **Step 3:** Wire the budget lint into `task ci` as a hard gate **for new
  commands only** — existing commands are grandfathered (those that 6.0.0-B set
  to `internal` are already under budget; the gate is forward-looking).
  <!-- carve-out: new-gate-verification -->

## Phase 2: Verb discipline + routing evals

- [ ] **Step 4:** Author the controlled verb list as an ADR + a lint: visible
  command sub-names must use an approved verb (work, audit, plan, implement,
  review, fix, test, ship, sync, explain, estimate, refine, publish, …);
  **no `create-*` commands** (the agent decides which files to create in-flow);
  no new verb without an ADR. Enforce via the existing cluster/command lint
  surface.
- [ ] **Step 5:** Require a routing eval per **visible** command:
  `evals/triggers.json` with 5–10 example prompts mapping intent → command
  (e.g. "implement PROJ-123" → `ticket:implement`; "fix phpstan" →
  `laravel:quality`). Add a lint that every `visibility: visible` command has a
  non-empty eval. Internal commands are exempt.
  <!-- carve-out: new-gate-verification -->

## Phase 3: Telemetry for evidence-based pruning

- [ ] **Step 6:** Extend the existing local-analytics surface
  (`workspace_analytics.py`, local-only, opt-out — do NOT add a new telemetry
  system) to record (anonymized, local) tier-2 rule load events, persona
  citations-in-use, and skill activation under the active profile. This is the
  *measurement* the council requires before any cut — it must reuse the
  established opt-out + 90-day-retention contract, never POST.
- [ ] **Step 7:** Author the **evidence-based pruning contract** under
  `docs/contracts/`: the thresholds the council set — personas (<5 citations AND
  <3 commits/year → deprecation candidate), skills (>70% content overlap +
  same domain → merge candidate), rules (<5% tier-2 load over 30 days → prune
  candidate). No artefact is cut by this roadmap; this phase ships the *rule* by
  which a later, data-bearing roadmap cuts.

## Phase 4: Skill-family overlap analysis (measured, not arbitrary)

- [ ] **Step 8:** Run an overlap analysis over skill families (api-*, laravel-*,
  project-*, judge-*, …) — content similarity, not name prefix. Produce a
  `agents/reports/` candidate list of >70%-overlap same-domain pairs. This
  feeds a *future* consolidation roadmap; nothing merges here. Surfacing the
  measured candidates replaces the feedback's arbitrary "223→120".

## Phase 5: [CONDITIONAL] Runtime resolver — gated on evidence

- [ ] **Step 9:** *Decision gate.* Review the 6.0.0-B + telemetry data: did
  pack-scoped projection (build/install-time) solve "the surface feels
  bloated"? Do users actually request mid-session pack switching (telemetry on
  profile-switch frequency, or recruit-session signal)? **Only if** the answer
  is "switching demanded" does a runtime resolver earn its place. If not, STOP —
  projection-time filtering was sufficient and a runtime resolver is
  over-engineering (the council's hardest pushback). Record the decision either
  way.
- [ ] **Step 10:** *(Conditional on Step 9 = proceed.)* Spec the runtime
  resolver in a new ADR per the Execution-Model contract (where it runs, host-
  tool integration, trust boundary, rollback) and spawn a dedicated follow-up
  roadmap. Do not implement inline here.

## Acceptance Criteria

- [ ] Per-pack visible-command budget linted in CI (new commands); ADR-gated
  exemption process documented; gaming-detection note in place.
- [ ] Controlled verb list ADR + lint; no `create-*` visible commands; every
  visible command has a routing eval.
- [ ] Local tier-2/persona/skill usage telemetry recording via the existing
  analytics surface (opt-out, local-only); evidence-based pruning contract
  shipped with the council thresholds.
- [ ] Skill-family overlap report produced (candidates only, zero merges this
  roadmap).
- [ ] Runtime-resolver decision gate recorded; resolver built only if evidence
  demands it, and then via its own ADR + roadmap.
- [ ] No persona/skill/rule deleted by arbitrary target; every cut (if any)
  traces to a measured threshold.
