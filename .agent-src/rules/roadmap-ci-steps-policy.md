---
type: "auto"
tier: "2a"
description: "Authoring or executing roadmaps — forbid task ci / make test / npm run check steps when quality.local_auto_run is false; skip inline"
source: package
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
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# Roadmap CI-Steps Policy

## Iron Law

```
WHEN quality.local_auto_run IS FALSE,
ROADMAPS MUST NOT SCHEDULE FULL-PIPELINE CI STEPS,
AND EXECUTION MUST SKIP THEM INLINE WITH [-] AND A REASON.
```

When `quality.local_auto_run: false` in `.agent-settings.yml`, every
full-pipeline gate run during roadmap work is wasted wall-clock and
tokens — remote CI on the PR is the authoritative gate. Roadmaps
must neither schedule nor execute them locally. New CI gates and
smoke/test files added by the roadmap itself are exempt — they must
run once locally to count as verified evidence per
[`verify-before-complete`](verify-before-complete.md).

## Forbidden step patterns (authoring + execution)

A step is **CI-shaped** when its text matches any pattern below.
Case-insensitive. Line-bounded — literal must appear inside the
step's `- [ ]` line or its immediate inline `<!-- … -->` / `(…)` note.

| Pattern | Example |
|---|---|
| `task ci` | `Run task ci before the boundary` |
| `task ci-strict` | `task ci-strict release gate` |
| `task ci-fast` | `task ci-fast smoke` |
| `make test` | `Run make test on phase boundary` |
| `make ci` | `make ci pre-merge` |
| `npm run check` / `pnpm run check` / `yarn check` | `npm run check before commit` |
| `composer test` | `composer test on every phase` |
| `vendor/bin/phpunit` (whole-suite, no path arg) | `vendor/bin/phpunit` |
| `php artisan test` (no `--filter`) | `php artisan test` |

Targeted commands (`vendor/bin/phpstan analyse <module-path>` such as
`vendor/bin/phpstan analyse app/Modules/X` in Laravel,
`php artisan test --filter=…`, `npm run lint -- --fix path/`) are
**not** CI-shaped — narrow verifications, allowed regardless of the
setting.

## Carve-outs — when CI-shaped steps are still allowed

1. **New CI gate / smoke test / test file landed by this roadmap.**
   Once-locally execution is mandatory under
   [`verify-before-complete`](verify-before-complete.md) carve-out
   (see `templates/agent-settings.md` § `quality.local_auto_run`).
   Mark the step with `<!-- carve-out: new-gate-verification -->`
   on the same line; linter and execution loop honour it and let the
   step run.
2. **`quality.local_auto_run: true`.** Opt-in restores pre-policy
   behaviour — linter no-ops, execution loop runs CI steps unmodified.
3. **Acceptance-criteria block at end of roadmap.** Final-gate prose
   like "All quality gates pass (`task ci`)" inside an
   `## Acceptance criteria` section is documentation, not an
   executable step (no `- [ ]` checkbox in front). Linter ignores;
   execution loop never reaches it as a step.

## Authoring — linter blocks at write-time

`task lint-roadmap-ci-steps` (wired into `task ci-fast` /
`lint-roadmap-complexity` cadence) scans `agents/roadmaps/*.md` and
per-module roadmap dirs resolved via
`scripts/_lib/agent_settings.py::enumerate_modules()`
(`{module_path}/{modules.agent_folder}/roadmaps/*.md`; Laravel shape:
`app/Modules/*/agents/roadmaps/*.md`). Exit code:

- `0` — no CI-shaped steps, or setting is `true`, or every match is
  carve-out-marked.
- `1` — at least one CI-shaped step in an active (non-archived,
  non-skipped) roadmap with `quality.local_auto_run: false` and no
  carve-out marker. Linter prints file, line, matched literal, and
  suggested rewording.

Archive (`agents/roadmaps/archive/`) and skipped
(`agents/roadmaps/skipped/`) are out of scope — they record history,
not future work.

## Execution — process-loop skips inline

Wrappers `/roadmap:process-step|phase|full` honour the policy at the
top of [`roadmap-process-loop § 5`](../contexts/execution/roadmap-process-loop.md#5-step-loop):

1. Before running a step, match its text against the patterns above.
2. CI-shaped **and** `quality.local_auto_run: false` **and** no
   carve-out marker → flip checkbox to `[-]` (cancelled), append a
   one-line reason as inline note, regenerate the dashboard, continue
   to next step. **Never** run the gate.
3. CI-shaped **and** `quality.local_auto_run: true` → run normally.
4. Carve-out-marked → run regardless of the setting.

The `[-]` reason format is fixed:
`<!-- skipped: quality.local_auto_run=false → remote CI is the gate -->`.
Per [`roadmap-progress-sync`](roadmap-progress-sync.md) the flip and
dashboard regen happen in the **same reply** that decides to skip;
saving skips for the archive commit is a rule violation.

## Failure modes

- Authoring `- [ ] Run task ci` while `local_auto_run: false` — linter
  fails the PR.
- Executing a CI-shaped step without inline-skip flip — Iron Law
  violation; loop never reaches the gate.
- Carve-out marker on an *existing* pipeline run — abuse; the marker
  is reserved for **new** gates introduced by the same roadmap.
- Hiding the literal inside a fenced bash block to dodge the linter —
  linter matches inside fenced blocks too (see
  `scripts/lint_roadmap_ci_steps.py`).

## See also

- [`verify-before-complete`](verify-before-complete.md) — Iron Law
  this rule narrows; carve-out cites it.
- [`roadmap-progress-sync`](roadmap-progress-sync.md) — inline flip +
  dashboard regen contract.
- `templates/agent-settings.md` § `quality.local_auto_run` — source
  of the toggle and its carve-out wording.
- [`contexts/execution/roadmap-process-loop`](../contexts/execution/roadmap-process-loop.md)
  — § 5 owns the inline-skip mechanics.
