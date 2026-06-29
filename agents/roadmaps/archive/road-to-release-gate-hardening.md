---
complexity: structural
status: ready
---

# Road to release-gate hardening — turn reactive catches into pre-merge gates

> Distilled from the 7.5.0 (PR #694) external review round. Six independent
> reviewers converged on one structural theme: **too much is caught reactively
> that should have been a blocking gate** — the LEGAL_NOTICE path bug, the
> condense-hash drift, and a template version-pin that shipped one release
> behind. This roadmap closes that class. It deliberately does **not** add new
> product surface (connectors, employee mode, knowledge layer) — those are
> already tracked, council-deferred, and demand-gated in
> `road-to-product-bets`. The single highest-leverage move per the reviewers is
> "a more comprehensive pre-merge verification net", not another feature.

## Why these and not the bigger asks

The review's P0/P1 strategic items — knowledge connectors, employee mode,
consumer-install smoke, mission-success analytics — are **already** captured in
`road-to-product-bets` (draft, council-deferred behind demand signals and
`domain-adoption-policy`). Re-opening them here would duplicate a deliberate
deferral. The design-feature refinements (anti-slop configurable rule-sets,
judge-synthesis minority dissent, design-system.json schema hardening, golden
tasks) are genuine but are feature work that needs its own scoping round, not an
autonomous hygiene sweep. What remains — and what every reviewer flagged as the
recurring failure mode — is gate-hardening. That is this roadmap.

## Phase 1 — Template version-pin: fix the live drift and wire the guard into CI

> Root cause confirmed on `main`: `package.json` is `7.5.0` but both
> `agent-project-settings.example.yml` twins are pinned `7.4.0`, so
> `check_template_pin_drift` is **red inside `task ci`** today. It merged anyway
> because that guard is wired into **no** GitHub workflow — it only runs in the
> local `task ci` meta-task. A fresh install on 7.5.0 therefore starts with a
> 7.4.0-pinned example. The example template is also the one hand-maintained pin
> outside the `generate_pack_manifests` generator, which is why it alone drifts.

- [x] **1.1 — Bump both template twins to the current `package.json` version** — `src/agent-src/templates/agents/agent-project-settings.example.yml` and the `dist/agent-src/` twin, `agent_config_version: "7.5.0"`. Verify `./scripts-run src/scripts/check_template_pin_drift` exits 0.
- [x] **1.2 — Make the bump automatic for future releases** — add `set_template_pin()` to `src/scripts/release.ts`, called from the bump step alongside `set_package_version`/`set_marketplace_version` (the src twin; `task release-prepare` regenerates the dist twin). Add it to the preview print and export it for tests. Mirror the embedded patch from the review.
- [x] **1.3 — Allowlist the template in the release-PR-shape guard** — add both template paths to `ALLOWLIST_GLOBS` in `src/scripts/check_release_pr_shape.ts`, so the legitimate release-time bump is not rejected. Without this, 1.1+1.2 deadlock against the shape guard.
- [x] **1.4 — Wire `check-template-pin-drift` into a GitHub gate** — add the guard to the release-gating workflow (`release-validation.yml` / `release-guard.yml`, whichever gates release PRs) so a future pin drift fails the PR at the source instead of being caught a release later. This is the actual root-cause fix; 1.1 is only the symptom.
- [x] **1.5 — Verify** — `./scripts-run src/scripts/check_template_pin_drift` green, `check_release_pr_shape` green, and the `release.ts` test suite green over the new `set_template_pin`.

## Phase 2 — Legal-pack reference-resolution gate

> The 7.5.0 changelog carries `correct LEGAL_NOTICE.md relative path in
> legal-safety-floor rule` — a broken path shipped in the one pack whose
> disclaimer is the liability shield. From `src/rules/legal-safety-floor.md` the
> `../../../LEGAL_NOTICE.md` link still does not resolve (it points above the
> repo root); the path is only correct from the `dist/agent-src/rules/`
> projection. `lint_legal_pack.ts` exists but let the break through. A
> projection-aware resolution check is the missing gate.

- [x] **2.1 — Inventory the references** — enumerate every path/link reference in `legal-safety-floor` (LEGAL_NOTICE, disclaimer paths, cross-linked skills) and record, per reference, whether it resolves from the `src/` location, the `dist/agent-src/` projection, or both. Establish the intended resolution root.
- [x] **2.2 — Add the resolution gate** — extend `lint_legal_pack.ts` (or add a focused check it calls) to assert every reference in the legal-safety-floor rule resolves from its shipped projection. Fail on any unresolvable reference.
- [x] **2.3 — Negative fixture** — add a test that points the gate at a deliberately broken reference and asserts it fails, so the gate itself is covered.
- [x] **2.4 — Fix any reference the new gate flags** — including the `LEGAL_NOTICE.md` link if it is still wrong from any shipped projection. Verify the gate is green afterward.

## Phase 3 — Close the two open release-verification questions

> Two merged-but-unverified claims from the 7.5.0 cycle the reviewers flagged as
> 10-second checks. Record the evidence rather than re-litigate.

- [x] **3.1 — `rubric:score` drop semver check** — confirm the dropped `rubric:score` was a judge/council-internal surface (Minor-safe), not a consumed public surface. Record the evidence in the roadmap or a short note.
- [x] **3.2 — Trigger-evals over the 15 trimmed descriptions** — confirm the trigger-evals pass over the 15 at-cap skill descriptions trimmed in 7.5.0, so the token-saving trim did not regress routing. Record the result.

## Out of scope — already tracked or needs its own round

- **Knowledge connectors, simple/expert (employee) mode, subagent explainability, consumer-install smoke** — `road-to-product-bets` (draft, council-deferred, demand-gated). Do not duplicate.
- **Condense-hash drift as a blocking gate** — already enforced in `consistency.yml` (`sync-check-hashes` + `check_condensation`). No new work; the 7.5.0 "pre-existing drift" was refreshed reactively but the gate exists.
- **Design capability-boundary contract** (a `design-capability-boundary` doc under `docs/contracts/`) — a genuine reviewer follow-up, but a 2-member AI council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-06-29) found it is **not gate-hardening**: a documentation artefact blocks none of the three cited mechanical defects (template drift, broken legal path, missing release verification). It belongs in its own design-governance round, not this roadmap.
- **Design-feature refinements** (anti-slop configurable rule-sets, judge-synthesis minority dissent, design-system.json schema hardening + good/bad/migration examples, design-quality golden tasks, mission-success analytics) — real, but feature work needing its own scoping/council round, not a hygiene sweep.
- **Branch protection** — repo-admin action, not a code change; tracked separately and needs a human with admin rights.

## Acceptance criteria

- `./scripts-run src/scripts/check_template_pin_drift` exits 0 and the guard runs in a GitHub release gate.
- A future release bump moves the template pin automatically (covered by a `release.ts` test).
- Every reference in the legal-safety-floor rule is gate-verified to resolve from its shipped projection, with a negative fixture.
- The two release-verification questions are answered with recorded evidence.
- No new product surface added; the strategic asks remain in `road-to-product-bets`.
