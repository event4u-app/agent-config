---
complexity: structural
status: draft
---

# Roadmap: Feedback 9.2.0 Follow-ups

> **Source:** external review passes of Release 9.2.0 / `main` @ 9.2.0
> (`agents/tmp/feedback-9.2.0-1.txt`, multiple independent reviewers, verdicts
> 9.4–9.6/10 and 119/120). The reviews are overwhelmingly positive; this roadmap
> captures **only the concrete, code-shaped, net-new defects and gaps** they
> surfaced — not the field/measurement-gated items (those are routed in
> § Disposition, not rebuilt). **Draft — pending maintainer OK / council
> greenlight before execution.**

## Goal

Close the small set of concrete, verifiable defects and instrumentation gaps the
9.2.0 review passes converged on — the ones that are **code, not field**: the
missing behavioral eval for the new situational rule, one oversized skill the
project's own linter already flags, a release-PR review that reads the wrong diff
base, and a recurring install-bundle build-hygiene defect. Everything the reviews
frame as *field*, *measurement-gated*, or *already-tracked* is routed in
§ Disposition without a duplicate roadmap.

The strongest single reviewer signal: `cross-source-consistency` ships **default
`on` without a behavioral eval or an ask-rate measurement**, in a package that
otherwise binds default-flips to evidence. That inconsistency — and the
over-firing (ask-inflation) failure mode it exposes — is Phase 1.

## Non-goals (already tracked, measurement-gated, or council-deferred — see § Disposition)

- Adversarial-council benchmark / claim resolution → `road-to-adversarial-council-benchmark.md`.
- Adversarial reconciliation core v2 → **gated on that benchmark** — do not extend
  an `unbacked`, default-off surface before it survives its own claim.
- Verification-surface router (one intent-based selector over council / team /
  judge / adversarial / verify-repair / review-changes) → **design-first**, route
  to `road-to-orchestration-scope-decision.md`; it is an architectural cut that
  needs a council, not a build-now step.
- Real external participant / adoption → `road-to-adoption-without-narrative-debt.md` — field, not code.
- Team-mode outcome benchmark → `road-to-team-mode.md` — needs benchmark spend.
- Utilization sweep (REAP / KEEP / MERGE / DEMOTE) → **let the pre-registered
  window run**; decide after it elapses, do not rebuild telemetry.
- Knowledge sensitivity classes → **shipped** (ADR-121); the broader
  knowledge-security block (cross-project isolation, PII, retention, org
  promotion) is its own track, not this roadmap.
- Bus factor / second maintainer → `road-to-maintainer-bus-factor.md`.
- `/explain-run` → true runtime execution-trace (read a recorded trace, not
  reconstruct) → larger observability effort; the discoverable command already shipped.
- Governance-overhead-per-workflow metric, external ticket connectors → feature-bets, demand-gate defer.

---

## Phase 1 — A situational-rule behavioral eval, proven first on `cross-source-consistency`

The reviewers' most-repeated P0. The existing harnesses do not fit: trigger-evals
are skill-scoped (rules are unsupported), and golden-outcome baselines fit only
sharp Iron-Law rules — a situation-dependent rule has no home. Build the generic
harness once, then use it to close the `cross_source` evidence gap.

- [ ] **1.1 Add a generic situational-rule eval format + runner.** A fixture
      declares `sources:` (ticket / mockup_description / spec / code_state / api_contract)
      and `expected:` (`action: ask | proceed | warn`, `question_contains`,
      `forbidden_assumptions`). Reusable beyond this rule (scope-control,
      design-fidelity, ask-when-uncertain, evidence-freshness, demand-gate later).
      verify: the runner loads a fixture and produces a pass/fail against the
      `expected` block on a hand-written sample; runs under the repo's TS test tool.
- [ ] **1.2 Author the `cross-source-consistency` fixture set — positives AND the
      negative control.** Positives: text↔image (birthday-today vs mockup-two-days-ago),
      spec-silent-on-holidays (no unrequested scope), ticket↔codebase, intra-ticket.
      Negative controls (the more important half): consistent sources → do **not**
      ask; cosmetic/naming-only difference → do not ask; mockup marked illustrative →
      prioritize text; an authoritative source hierarchy present → use it, do not
      re-ask. verify: real discrepancies flip `action: ask`; every negative control
      is `action: proceed` (a false-positive on any negative control fails the eval).
- [ ] **1.3 Register a pre-registered claim for `cross_source` (even as debt).**
      Add a `docs/CLAIMS.md` entry so the weaker-evidenced default-on rule is bound
      to a measurement like every other default-flip: target discrepancy precision
      ≥ 85% and unnecessary-ask (over-firing) rate ≤ 5% on the fixture set. Status
      `unbacked` until the eval is run; honest-null accepted (loosen the default or
      the confidence tiers, never silently keep firing). verify: `check_claims` sees
      the new entry; it does not claim `backed` without a run.
- [ ] **1.4 Ask-rate telemetry facet.** Emit a per-task counter of surfaced
      cross-source discrepancies (structured, PII-exclusion-by-construction — an id
      + a discrepancy-type enum + a boolean, no free-form fields), so real over-firing
      is measurable before a user disables the rule out of friction. verify: a
      simulated task with one real discrepancy records exactly one surfaced-discrepancy
      event; a consistent-sources task records zero.

## Phase 2 — Split the oversized `subagent-orchestration` skill

The project's own `skill_linter` already emits `pass_with_warnings: skill_too_large`
for this skill (9 modes + contracts + prompts + schemas in one file). The reviewers
name the decomposition: the central skill should only route; detail contracts move
to contexts / specialized surfaces.

- [ ] **2.1 Extract the mode detail out of `SKILL.md`.** Keep routing / mode
      selection (the form gate + the mode-picker) in the skill; move the per-mode
      execution contracts, council-mode detail, and telemetry/reporting detail into
      `contexts/` (or sibling skills) that the skill points to. Preserve every Iron
      Law, cross-model invariant, and the advisory/Hard-Floor boundary verbatim
      (preservation-guard). verify: `skill_linter` on `subagent-orchestration` no
      longer warns `skill_too_large`; all 9 modes still resolve from the skill;
      `check_references` + host-loadability green.
- [ ] **2.2 Re-sync projections + descriptions.** Run `task sync` +
      `task generate-tools` + `/condense` for the touched surfaces; the skill
      description still carries the mode list; `validate_frontmatter` clean. verify:
      `sync-check` + `sync-check-hashes` clean; the mode count in the description
      matches the routed modes.

## Phase 3 — Tag-aware release-PR review

On a release PR the review bot diffs `release-branch → main` and then reports the
release's own features as "not in the diff" (they merged before the cut) — the
false-advisory the reviewers flagged as the most visible current operational
weakness. Release PRs need the `previous_tag...release_head` base.

- [ ] **3.1 Add a release-mode to the PR-review path.** Detect a release PR
      (version in title / changelog block), resolve the previous tag, analyze
      `previous_tag...release_head` as the feature range, and treat the release-PR
      diff only as an additional packaging diff. Validate claims against the full
      release commit range, not the packaging diff. verify: on a synthetic release
      PR whose feature merged pre-cut, the review no longer emits "feature/ADR not
      in diff"; a normal feature PR's review base is unchanged.

## Phase 4 — Hermetic, reproducible install-bundle build

Repeated 9.1 rebuild-fixes (real `node_modules` paths, repo-relative module paths,
post-settings rebuilds) show the bundle is sensitive to build environment and path
origin. Make local/absolute/worktree path leakage structurally impossible rather
than patched per PR.

- [ ] **4.1 Guard against path leakage in the built bundle.** Add a check that fails
      the build if any absolute, `/Users`/home, or worktree-specific module path
      appears in the emitted install bundle. verify: the guard is red on a synthetic
      absolute-path-in-bundle fixture and green on a clean bundle.
- [ ] **4.2 Document + wire the reproducible build path.** Document the
      clean-checkout → `npm ci` → build → pack → manifest/hash sequence and wire the
      leakage guard into the package's release/build gate so a leak cannot merge.
      verify: a from-clean build reproduces a stable bundle manifest; the guard runs
      in the build gate.

---

## Disposition — reviewer items routed, not rebuilt

| Reviewer item | Disposition |
| --- | --- |
| Adversarial-council benchmark / resolve the claim (P0) | Existing `road-to-adversarial-council-benchmark.md` — corpus + maintainer-gated spend |
| Adversarial reconciliation core v2 (semantic finding identity, severity aggregation, confidence labeling, structured description) | **Gated on the benchmark** — do not extend an `unbacked` default-off surface first |
| Verification-surface router / mechanism-proliferation consolidation (P1) | **Design-first** → `road-to-orchestration-scope-decision.md`; needs a council, not a build-now step |
| Real external participant / adoption (P0) | Existing `road-to-adoption-without-narrative-debt.md` — field, not code |
| Team-mode outcome benchmark | Existing `road-to-team-mode.md` — needs benchmark spend |
| Utilization sweep (REAP/KEEP/MERGE/DEMOTE) | Gated on the pre-registered window; let it run |
| Knowledge sensitivity classes | **Shipped** — ADR-121; broader knowledge-security is its own block |
| Bus factor / second maintainer | Existing `road-to-maintainer-bus-factor.md` |
| `/explain-run` → true runtime execution trace | Larger observability effort; discoverable command already shipped |
| Governance-overhead-per-workflow metric | Feature-bet; gated on real utilization data |
| External ticket connectors (Linear / Jira / Confluence) | Feature-bet, demand-gate defer (reviewers agree) |

## Acceptance criteria

- Phase 1 delivers a reusable situational-rule eval harness + the `cross_source`
  fixture set (positives + negative controls) + a `docs/CLAIMS.md` entry + an
  ask-rate telemetry facet; the eval runs and the claim is either `backed` or a
  documented honest-null.
- Phase 2: `skill_linter` no longer warns `skill_too_large` on
  `subagent-orchestration`; all 9 modes resolve; projections re-synced.
- Phase 3: release-PR review uses the previous-tag feature range; the
  "feature not in diff" false-advisory does not recur on a release PR.
- Phase 4: a path-leakage guard fails on a synthetic leak and is wired into the build gate.
- `task ci` green (remote CI is the authoritative gate).
- No duplicate roadmap created for any § Disposition item.

## Rollback

All changes are a new eval harness + fixtures, a CLAIMS entry, one telemetry
counter, a skill split (content-preserving), a review-path branch, and a build
guard — each revertable by reverting its commit. No runtime or data migration.
State-dependent note: the Phase-1 CLAIMS entry is a debt marker; reverting it
un-registers the measurement rather than breaking behavior. The Phase-2 split must
preserve every Iron Law and invariant verbatim (preservation-guard) — a revert
restores the single-file skill unchanged.
