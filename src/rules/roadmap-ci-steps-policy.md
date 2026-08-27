---
type: "auto"
tier: "2a"
description: "Roadmap authoring/execution — no full-pipeline CI steps when quality.local_auto_run is false; skip inline"
triggers:
  - path_prefix: "agents/roadmaps/"
  - path_prefix: "{module_root}/"  # resolved via modules.root_paths; Laravel shape: app/Modules/
  - keyword: "task ci"
  - keyword: "make test"
  - keyword: "npm run check"
  - keyword: "pnpm run check"
  - keyword: "yarn check"
  - keyword: "composer test"
  - phrase: "run the quality pipeline"
  - phrase: "run task ci"
  - phrase: "run the full ci"
applies_to_user_types:
  - "maintainer"
  - "developer"
validator_ignore:
  - type: "substring"
    pattern: "agents/roadmaps/"
    reason: "Rule's subject is roadmap files under agents/roadmaps/; every body link points there by design."
  - type: "substring"
    pattern: ".agent-settings.yml"
    reason: "Rule reads quality.local_auto_run from .agent-settings.yml; naming the file is the contract."
self_contained: true
workspaces: [agent-config-maintainer, engineering]
packs: [meta]
roles: [planner]
collision_ok:
  "agents/roadmaps/": "roadmap steps must not schedule CI-shaped gates"
# obligation: line 41
obligation_frequency: "per-edit"
enforced_by:
  - "validator:src/scripts/lint_roadmap_ci_steps.ts"
---

# Roadmap CI-Steps Policy

## Iron Law

```
WHEN quality.local_auto_run IS FALSE,
ROADMAPS MUST NOT SCHEDULE FULL-PIPELINE CI STEPS,
AND EXECUTION MUST SKIP THEM INLINE WITH [-] AND A REASON.
```

When autonomous local-CI runs are disabled in `.agent-settings.yml`
(`quality.local_auto_run: false` — the shipped template default; that file is the
project layer of a cascade that starts user-global, and this key is one where an
ABSENT value resolves to `true` at its reader and therefore DISABLES this gate —
`agent-config settings:get quality.local_auto_run` reports both facts), every
full-pipeline gate run during roadmap work is wasted wall-clock and
tokens — the remote CI on the PR is the authoritative gate. Roadmaps must
neither schedule nor execute those gates locally. New CI gates and
smoke/test files added by the roadmap itself remain exempt — those
have to run once locally to be considered verified evidence per
[`verify-before-complete`](verify-before-complete.md).

A step is **CI-shaped** when its `- [ ]` line (or its immediate inline note)
matches a full-pipeline literal — `task ci` / `task ci-strict` / `task ci-fast`,
`make ci` / `make test`, `npm|pnpm run check` / `yarn check`, `composer test`,
whole-suite `vendor/bin/phpunit`, or `php artisan test` without `--filter`.
Targeted commands stay allowed.

Body migrated to [`contexts/execution/roadmap-ci-steps-mechanics.md`](../contexts/execution/roadmap-ci-steps-mechanics.md) (per P4 of `road-to-kernel-and-router.md`) — full pattern table, carve-outs (new-gate marker, `local_auto_run: true`, acceptance-criteria prose), `lint-roadmap-ci-steps` authoring contract, inline-skip execution mechanics, failure modes.
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## See also

- [`contexts/execution/roadmap-ci-steps-mechanics`](../contexts/execution/roadmap-ci-steps-mechanics.md)
  — the migrated body.
- [`verify-before-complete`](verify-before-complete.md) — the
  Iron Law this rule narrows; carve-out cites it.
- [`roadmap-progress-sync`](roadmap-progress-sync.md) — inline flip
  + dashboard regen contract.
- [`contexts/execution/roadmap-process-loop`](../contexts/execution/roadmap-process-loop.md)
  — § 5 step 0 owns the inline-skip gate.
