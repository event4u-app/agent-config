---
adr: 033
status: accepted
date: 2026-05-29
decision: distribution-identity-npm-primary
supersedes: —
superseded_by: —
phase: distribution-identity
type: structural
review_date: 2026-08-29
---

# ADR-033 — Distribution identity: npm-primary, Packagist deprecated-in-place

## Status

**Accepted** · 2026-05-29. AI Council (claude-sonnet-4-5 + gpt-4o, analysis lens, 2026-05-29) converged on **npm-primary with Packagist deprecated-in-place**. No maintainer veto surfaced; the de-facto evidence and the operational-honesty argument both point to a single answer. Review date 2026-08-29.

## Context

External feedback rounds 10 / 12 / 13 returned to two recurring symptoms — *"Packagist still shows 1.0.4"* and *"two major bumps in six days with no breaking-change signal"*. A council deliberation (lens: analysis) re-framed both as **one distribution-identity question** the repo has answered in practice but never recorded:

- **`package.json` at `5.1.0`** — the package is past the unified-setup 4.0.0 major and a subsequent 5.0.0 line; semver discipline (per `CONTRIBUTING.md § Versioning policy`) treats installer-layout changes as major, so the cadence is policy-correct.
- **`scripts/release.py` invokes `npm publish` exclusively** — the only publish surface that ships from a release run.
- **No `composer.json` exists in this repo** — the file was removed during the npm pivot (pre-3.x era). The Packagist `event4u/agent-config` 1.0.4 listing is a zombie pointing at a repository state that no longer exists.
- **No automation syncs the Composer surface** — none has existed since the pivot. Pretending the channel is supported is a maintenance lie.
- **ADR-027** already locks the changelog-machine path (`scripts/release.py` derives `CHANGELOG.md § Breaking` from Conventional Commits). The "no breaking-change signal" symptom is stale against that surface — what is missing is a one-click pointer for consumers.

Council framing — two perspectives surfaced:

**Lens A — Strategic / consumer-positioning.** A consumer who lands on Packagist sees 1.0.4 and installs an artefact the repo cannot support. The honest signal is deprecation; dual-track without resources is worse than a single declared channel.

**Lens B — Technical / operational-honesty.** A channel is "supported" only if a release pipeline publishes to it. Composer/Packagist has had no such pipeline since the npm pivot. The simpler invariant — *one channel, one truth* — wins on every measurable axis: maintenance load, consumer trust, audit clarity.

Both lenses converged.

## Decision

1. **The package is npm-primary.** The canonical install path is `npm install @event4u/agent-config` (and the consumer-facing `npx @event4u/agent-config install` wizard). All release tooling (`scripts/release.py`, `package.json`, `CONTRIBUTING.md § Versioning policy`) already aligns with this surface — this ADR records the policy, no code changes follow from the declaration itself.

2. **Composer / Packagist is deprecated-in-place.** No `composer.json` ships from this repo; no PHP autoload surface is supported; the Packagist `event4u/agent-config` 1.0.4 listing is treated as legacy and gets a deprecation pointer through the only mechanism available to a deleted-composer-json repo: a registry-side claim/archive action by the maintainer. The corresponding human-owner item is surfaced in `docs/distribution/registries.md` (see Phase 2 of the [`road-to-distribution-identity.md`](../../agents/roadmaps/road-to-distribution-identity.md) roadmap).

3. **Breaking-change communication uses `CHANGELOG.md § Breaking`.** ADR-027 locked the auto-generated changelog from Conventional Commits. This ADR adds one consumer-facing affordance — a README / distribution-doc pointer linking that section — so a consumer who sees a major-version bump has a one-click path to *what broke, what to do*. No new `BREAKING_CHANGES.md` file unless the maintainer prefers one.

4. **Commit-subject hygiene is enforced in CI.** Because the changelog generator reads commit subjects verbatim, sloppy subjects (`leftover`, `wip`, `temp`, `fixup`, or sub-10-character one-word entries) leak directly into the public changelog. A CI lint (`task lint-commit-subjects` or sibling) rejects those subjects on PR. This is wired in Phase 3 of the same roadmap and is the one hygiene item that ties directly to distribution identity.

## Consequences

**Positive:**

- The distribution story is **single-channel, single-truth**. Anyone scanning the package — consumer, contributor, auditor, package-registry crawler — gets one consistent answer.
- The zombie Packagist listing no longer misdirects PHP-shop consumers (once the maintainer files the registry-side archive action).
- Breaking-change discoverability is two clicks from the README: "release notes" → `CHANGELOG.md § Breaking`. No bespoke `BREAKING_CHANGES.md` to maintain.
- CI catches sloppy commit subjects before they become public changelog lines — the changelog is as clean as the gate that feeds it.

**Negative / accepted costs:**

- A PHP-shop consumer who depends on the 1.0.4 Packagist release is left behind. Mitigation: clear deprecation notice + npm install pointer in the registry-side archive.
- The maintainer must perform a one-time login at `packagist.org/packages/event4u/agent-config` to claim or archive the listing — autonomous tooling cannot do that.
- Future re-entry into the Composer ecosystem would require a new ADR superseding this one. That cost is acceptable: a re-entry would be a strategic redirect, not a quiet re-add.

**Operationally neutral:**

- `scripts/release.py` already does the right thing; no script change follows from this ADR.
- `CONTRIBUTING.md § Versioning policy` already does the right thing; no policy change follows from this ADR. The major bumps that prompted the feedback (4.0.0 unified-setup, 5.0.0 follow-up) were policy-correct under the existing rule.

## Alternatives considered

- **Dual-track with auto-sync.** Rejected. The repo carries no Composer surface to sync; restoring one would mean re-introducing a `composer.json` + a sync pipeline + a PHP-side autoload story, all to support a consumer base nobody has named. The carrying cost outweighs the demand signal.
- **Dual-track without auto-sync (status quo).** Rejected. This is the failure mode that produced the external feedback in the first place — a stale 1.0.4 listing pretends a channel is supported when it is not. Operational-honesty argument carries.
- **Re-introduce composer.json as a stub linking to npm.** Rejected. A stub on Packagist is still a Packagist artifact; consumers may still try to `composer require` it and hit a non-functional package. Registry-side archive is the cleaner signal.
- **A bespoke `BREAKING_CHANGES.md` file.** Rejected by default; ADR-027 already locks the machine-generated changelog as the breaking-change surface. Maintainer may revisit if the changelog format proves insufficient for end-of-life or migration-guide-shape communication.

## References

- [`agents/roadmaps/road-to-distribution-identity.md`](../../agents/roadmaps/road-to-distribution-identity.md) — the work-item plan this ADR underwrites.
- [`ADR-027-changelog-machine-vs-manual.md`](ADR-027-changelog-machine-vs-manual.md) — the prior decision locking the auto-generated changelog.
- [`CONTRIBUTING.md § Versioning policy`](../../CONTRIBUTING.md) — the semver discipline this ADR confirms.
- [`docs/distribution/registries.md`](../distribution/registries.md) — external-registry submission posture; this ADR adds a distribution-channel-identity section to that file.
- `scripts/release.py` — the `npm publish` release pipeline.
- External feedback rounds 10 / 12 / 13 (private session transcripts; convergence summary inlined above to keep this ADR self-contained).
