---
adr: 047
status: accepted
date: 2026-06-03
decision: framework-neutral-stack-adaptive-commands
supersedes: —
superseded_by: —
phase: v6.0.0 · D structural restructure
type: decision
---

# ADR-047 — Framework-neutral global commands; stack-adaptive resolution for engineering

## Status

**Accepted** · 2026-06-03. Authored as Phase 7 / Step 20 of
[`road-to-6.0.0-d-structural-restructure`](../../agents/roadmaps/road-to-6.0.0-d-structural-restructure.md).
Codifies, as an architecture decision, the floor already enforced by the
[`framework-neutrality-in-generic-skills`](../../src/rules/framework-neutrality-in-generic-skills.md)
rule and the "stack-adaptive set" resolved in the
[`command-classification worksheet`](../../agents/reports/command-classification-6.0.0-d.md).

## Context

The suite ships **global** commands that run against any consumer project,
whatever its stack. A naive design produces one of two failure modes:

1. **Framework leakage** — a generic command hardcodes a single stack's tooling
   (`php artisan test`, `vendor/bin/phpunit`, `FormRequest`), so it silently
   misbehaves on a Next.js or Python project.
2. **Per-stack command explosion** — `php-test-run`, `jest-test-run`,
   `pytest-run`, … one command per toolchain, multiplying the surface for what
   is conceptually one action.

Both are wrong. The right shape is a single framework-neutral command whose
implementation **detects** the toolchain and runs the right tool.

## Decision

1. **Generic commands are framework-neutral.** A global command never mandates a
   specific framework. Stack specifics live in carve-out artefacts
   (`laravel-*`, `nextjs-*`, `pest-*`, …) the neutral command composes — never
   inlined. This is the existing
   [`framework-neutrality-in-generic-skills`](../../src/rules/framework-neutrality-in-generic-skills.md)
   rule, now ratified as architecture.

2. **A bounded stack-adaptive set, scoped to engineering.** The commands that
   DETECT the toolchain and dispatch are: `test-run`, `test-create`,
   `quality-fix` (`fix-quality`), `review-changes`, and `work`. A resolver
   detects the stack (phpunit / pest / playwright / vitest / jest / pytest / …)
   and runs the matching tool. There is **no per-stack command explosion**.

3. **Monorepo guard.** Stack-adaptive test/quality commands default to the FAST
   path; `--include-slow` / `--include-e2e` opts into the heavy runs.
   `--all`-style "run everything" is a monorepo footgun and is not the default.

4. **Non-interactive by construction.** Detection-based commands must work in CI:
   detect a non-TTY, honor explicit flags (`--php`, `--json`, `--yes`), and never
   block on a prompt. A prompt that hangs CI is "provably wrong for CI/CD".

5. **Genuinely stack-locked commands stay locked.** A command that only makes
   sense for one stack (e.g. `update-form-request-messages` for Laravel
   FormRequests) stays in that stack's pack and is not forced neutral. The
   resolver is for the bounded engineering set, not a universal mandate.

## Consequences

- **Positive.** One command per action, correct on every stack; the surface does
  not multiply per toolchain.
- **Positive.** The neutrality rule gains an architectural backing decision, so
  the lint is not "just a style check" but the enforcement of a recorded contract.
- **Negative / accepted.** The resolver carries detection logic that must stay
  current as toolchains evolve; per-stack run skills it composes are the units
  that change, not the command.
- **Negative / accepted.** Detection can be ambiguous in mixed-stack repos; the
  monorepo guard (fast-default + explicit opt-in) and the `--<stack>` narrowing
  flag are the escape hatches.

## Alternatives considered

- **Per-stack commands.** Rejected: `php-test-run` / `jest-test-run` is the bad
  world — surface explosion for one conceptual action.
- **One neutral command with stack hardcoded to the maintainer's stack.**
  Rejected: that is framework leakage; it breaks on every other consumer.
- **Universal stack-adaptive (every command detects).** Rejected: only the
  engineering set benefits; forcing detection onto genuinely stack-locked
  commands adds complexity for no gain.

## References

- [`framework-neutrality-in-generic-skills`](../../src/rules/framework-neutrality-in-generic-skills.md) — the enforcing rule.
- [`agents/reports/command-classification-6.0.0-d.md`](../../agents/reports/command-classification-6.0.0-d.md) — the stack-adaptive set + monorepo-guard resolution.
- [`ADR-046`](ADR-046-thin-command-principle.md) — thin commands compose per-stack skills.
- [`ADR-044`](ADR-044-command-naming-scheme-hyphenated.md) — naming scheme.
