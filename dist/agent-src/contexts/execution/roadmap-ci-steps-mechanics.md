# Roadmap CI-Steps — Mechanics

Migrated body of the [`roadmap-ci-steps-policy`](../../rules/roadmap-ci-steps-policy.md)
rule (per P4 of `road-to-kernel-and-router.md`). Loaded by
[`roadmap-process-loop § 5` step 0](roadmap-process-loop.md#5-step-loop) and by
the rule's routing line. The Iron Law stays in the rule; this file carries the
pattern table, carve-outs, linter contract, inline-skip mechanics, and failure
modes.

## Forbidden step patterns (authoring + execution)

A step is **CI-shaped** when its text matches any of the patterns
below. Case-insensitive. Pattern matching is line-bounded — the
literal must appear inside the step's `- [ ]` line or its immediate
inline note (the next indented `<!-- … -->` or `(…)` annotation).

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
**not** CI-shaped — they are narrow verifications, allowed regardless
of the setting.

## Carve-outs — when CI-shaped steps are still allowed

1. **New CI gate / smoke test / test file landed by this roadmap.**
   Once-locally execution is mandatory under
   [`verify-before-complete`](../../rules/verify-before-complete.md) carve-out
   (see `templates/agent-settings.md` § `quality.local_auto_run`).
   Mark the step with `<!-- carve-out: new-gate-verification -->`
   on the same line; the linter and the execution loop both honour
   the marker and let the step run.
2. **`quality.local_auto_run: true`.** Setting opt-in restores the
   pre-policy behaviour — the linter no-ops and the execution loop
   runs CI steps unmodified.
3. **Acceptance-criteria block at end of roadmap.** Final-gate prose
   like "All quality gates pass (`task ci`)" inside an
   `## Acceptance criteria` section is documentation, not an
   executable step (no `- [ ]` checkbox in front of the literal).
   Linter ignores; execution loop never reaches it as a step.

## Authoring — linter blocks at write-time

`task lint-roadmap-ci-steps` (wired into `task ci-fast` /
`lint-roadmap-complexity` cadence) scans `agents/roadmaps/*.md` and
per-module roadmap dirs resolved via
`scripts/_lib/agent_settings.ts::enumerate_modules()`
(`{module_path}/{modules.agent_folder}/roadmaps/*.md`; Laravel shape:
`app/Modules/*/agents/roadmaps/*.md`). Exit code:

- `0` — no CI-shaped steps, or setting is `true`, or every match is
  carve-out-marked.
- `1` — at least one CI-shaped step in an active (non-archived,
  non-skipped) roadmap with `quality.local_auto_run: false` and no
  carve-out marker. Linter prints the file, line, matched literal,
  and suggested rewording.

Archive (`agents/roadmaps/archive/`) and skipped
(`agents/roadmaps/skipped/`) are out of scope — they record history,
not future work.

## Execution — process-loop skips inline

Wrappers `/roadmap:process-step|phase|full` honour the policy at the
top of [`roadmap-process-loop § 5`](roadmap-process-loop.md#5-step-loop):

1. Before running a step, match its text against the patterns above.
2. If CI-shaped **and** `quality.local_auto_run: false` **and** no
   carve-out marker → flip the checkbox to `[-]` (cancelled), append
   a one-line reason as inline note, regenerate the dashboard,
   continue to the next step. **Never** run the gate.
3. If CI-shaped **and** `quality.local_auto_run: true` → run the
   step normally.
4. If carve-out-marked → run the step regardless of the setting.

The `[-]` reason format is fixed:
`<!-- skipped: quality.local_auto_run=false → remote CI is the gate -->`.
Per [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md) the flip and
the dashboard regen happen in the **same reply** that decides to
skip; saving skips for the archive commit is a rule violation.

## Failure modes

- Authoring `- [ ] Run task ci` while `local_auto_run: false` — linter
  fails the PR.
- Executing a CI-shaped step without the inline-skip flip — Iron Law
  violation; the loop never reaches the gate.
- Adding a carve-out marker to bypass the gate for an *existing*
  pipeline run — abuse; the marker is reserved for **new** gates
  introduced by the same roadmap.
- Hiding the literal inside a fenced bash block to dodge the linter —
  the linter matches inside fenced blocks too (see
  `scripts/lint_roadmap_ci_steps.ts`).

## See also

- [`roadmap-ci-steps-policy`](../../rules/roadmap-ci-steps-policy.md) — the
  Iron Law + trigger surface this file backs.
- [`verify-before-complete`](../../rules/verify-before-complete.md) — the
  Iron Law the policy narrows; carve-out cites it.
- [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md) — inline flip
  + dashboard regen contract.
- `templates/agent-settings.md` § `quality.local_auto_run` — source
  of the toggle and its carve-out wording.
- [`roadmap-process-loop`](roadmap-process-loop.md) — § 5 owns the
  inline-skip step gate.
