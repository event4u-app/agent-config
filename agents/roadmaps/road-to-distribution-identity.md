---
complexity: lightweight
---

# Roadmap: Distribution identity — make npm-primary explicit, retire the stale registry

> External feedback rounds 10/12/13 kept circling two symptoms: "Packagist still shows 1.0.4" and "two major bumps in six days with no breaking-change signal". Council (claude-sonnet-4-5 + gpt-4o, 2026-05-27, analysis lens) converged on the real diagnosis: these are **not two findings, they are one distribution-identity question** the repo has answered in practice but never stated. `package.json` is at `4.3.0`, `scripts/release.py` runs `npm publish`, and the versioning policy in `CONTRIBUTING.md` already defines major = installer-layout change — which is exactly what the 4.0.0 unified-setup did. So the bump cadence is **policy-correct, not a discipline lapse**, and the package is **npm-primary in fact**. What is missing is making that explicit and stopping the abandoned Packagist listing from misleading consumers.

## Context

- **Already mature — do not rebuild.** Auto-generated changelog from Conventional Commits (`scripts/release.py`), a documented versioning policy (`CONTRIBUTING.md § Versioning policy`), a `### Breaking` section in `CHANGELOG.md`, and `docs/decisions/ADR-027-changelog-machine-vs-manual.md` all exist. The feedback's "no breaking-change notes" claim is largely stale against this surface.
- **The genuine gap.** No ADR records the npm-primary-vs-dual-track decision, and the Packagist 1.0.4 listing sits abandoned with no deprecation signal — a consumer scanning Packagist sees a 1.x package and the wrong install instructions.
- **Scope discipline.** Council warned the earlier "release hygiene" cluster was a grab-bag. This roadmap is scoped to one coherent question — *how is this package distributed, and how does that distribution communicate breaking changes* — plus the one verified hygiene defect that feeds the auto-changelog (sloppy commit subjects).
- **Gates.** `scope-control` (no version/tag/deprecation-date pinned in a roadmap — these are work items, not a release schedule), `commit-policy` (no commit steps), `roadmap-progress-sync`.

## Phase 1: Decide and record the distribution identity

> **Human-input gate.** The npm-primary-vs-dual-track call is a maintainer decision; the roadmap drafts the ADR and surfaces the evidence, the maintainer confirms the verdict.

- [ ] **Step 1:** Draft an ADR (next number in `docs/decisions/`, regen the index) — "Distribution identity: npm-primary". Capture the de-facto evidence (`package.json` 4.3.0, `release.py` npm publish, Composer surface frozen at 1.x) and the decision: is Composer/Packagist a supported channel or deprecated-in-place? Default proposal: **npm-primary, Packagist deprecated-in-place** unless the maintainer names a Composer-consuming project.
- [ ] **Step 2:** Exit gate — ADR `Status: accepted` with the maintainer's confirmed verdict; index regenerated; the decision is referenced from `docs/distribution/registries.md`.

## Phase 2: Execute the decision on the consumer-facing surfaces

- [ ] **Step 1:** If Phase 1 lands on "deprecated-in-place" — add a deprecation notice to the Packagist/Composer surface (composer.json `description` + an `abandoned`/replacement pointer to the npm package) so the stale 1.0.4 listing redirects consumers to the real install path. *(Registry-side claim/archive on Packagist itself is a maintainer login action — capture it as a human-owner step, not an autonomous push.)*
- [ ] **Step 2:** Add a consumer "breaking changes at a glance" pointer — a short README/distribution note linking the `CHANGELOG.md § Breaking` section, so a consumer who sees a major bump has a one-click answer to "what broke / do I need to act". Reuses the existing changelog; no new `BREAKING_CHANGES.md` file unless the maintainer prefers one.
- [ ] **Step 3:** Exit gate — `docs/distribution/registries.md` reflects the posture; reference checker green (no dangling links).

## Phase 3: Release-comms hygiene — commit-subject lint

Because `release.py` generates the changelog **from commit subjects**, a sloppy subject ("commit leftovers" — the third such occurrence per feedback 13) becomes a sloppy public changelog line. This is the one hygiene item that ties directly to distribution.

- [ ] **Step 1:** Add a CI lint that rejects PR commit subjects that are too short (< ~10 chars) or contain blocklist words (`leftover`, `wip`, `temp`, `fixup`). CI-enforced, not a local pre-commit hook (bypassable). Wire into the existing `task ci` lint tier.
- [ ] **Step 2:** Exit gate — the lint runs in CI, passes on clean history, and fails on a deliberately bad fixture subject.

## Acceptance criteria

- [ ] Phase 1: distribution-identity ADR accepted with maintainer verdict; index regenerated; referenced from `docs/distribution/registries.md`.
- [ ] Phase 2: stale Packagist listing carries a deprecation/redirect signal (or dual-track is explicitly chosen and auto-sync is scoped); consumer breaking-change pointer added.
- [ ] Phase 3: commit-subject CI lint shipped, green on clean history, red on a bad fixture.
- [ ] `task ci` green on each phase's PR; reference checker resolves all new links.

## Notes

- **Not a versioning overhaul.** The semver policy is sound and documented; this roadmap does not change it. It records the distribution identity that policy already implies and removes a misleading external signal.
- **Roadmap plans work, not a release.** No version, tag, or deprecation date is pinned here.
- **Human-owner items** (Packagist registry claim/archive, the npm-primary verdict) are surfaced, not auto-executed.
- **Cross-reference.** Independent of `road-to-wizard-sse-hardening` and `road-to-abstraction-budget-discovery`.
