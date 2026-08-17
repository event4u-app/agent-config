/**
 * Detector C's verify allowlist — the fixture `road-to-stop-gate-honesty`
 * step 2.2 requires.
 *
 * The step's own words: "enumerate the verify-shaped commands the team actually
 * runs, test each against `isVerificationCommand`, and record the misses. Any
 * addition ships with a fixture mapping command string to recognised."
 *
 * So this file is a TABLE, not a sample. Every command below was produced by
 * this project's real surface — its `package.json` scripts, its `Taskfile`
 * targets, `./scripts-run`, `./agent-config`, and the language toolchains the
 * suite supports — and carries the verdict the allowlist gives it today.
 *
 * The rows that read `false` are as load-bearing as the ones that read `true`.
 * Risk 2 of that roadmap is that widening this list turns detector C into a
 * rubber stamp, so the deliberate non-additions are pinned here: if a later
 * change makes `task sync` or `npm run prepack` clear an unverified edit, this
 * file fails and the widening has to be argued rather than slipped in.
 */

import { describe, expect, it } from 'vitest';

import { isVerificationCommand } from '../../src/scripts/hooks/turn_end_gate_hook.js';

/** `[command, recognised]` — the audited table, 2026-08-17. */
const AUDIT: ReadonlyArray<readonly [string, boolean]> = [
    // ---- this repo's npm scripts -------------------------------------------
    ['npm run typecheck', true],
    ['npm run lint:ts', true],
    ['npm run test:ts', true],
    ['npm run build', true],
    ['npm run tokens:check', true],
    ['npm run build:hooks', true],
    // NOT added: a lifecycle hook whose content is per-project.
    ['npm run prepack', false],

    // ---- Taskfile, the dominant surface here --------------------------------
    ['task ci', true],
    ['task ci-fast', true],
    ['task preflight', true],
    ['task test', true],
    ['task typecheck', true],
    ['task lint-skills', true],
    ['task check-claims', true],
    // NOT added: generators. They rewrite the tree and check nothing.
    ['task sync', false],
    ['task generate-tools', false],
    // NOT added: repo-local vocabulary with no general meaning.
    ['task audit-tokens', false],
    ['task consistency', false],
    ['task bench', false],

    // ---- the repo's own runners ---------------------------------------------
    ['./scripts-run src/scripts/check_completion_review', true],
    // ADDED by this audit — `\blint\b` needs a boundary and `_` is a word char,
    // so every `lint_*` script in `src/scripts/` was missing.
    ['./scripts-run src/scripts/lint_persistence', true],
    ['./scripts-run src/scripts/lint_provenance', true],
    ['./scripts-run src/scripts/lint_roadmap_blockers', true],
    // NOT added: a census writes a report; it asserts nothing.
    ['./scripts-run src/scripts/rule_activation_census', false],
    // NOT added: enumerates gates, runs none.
    ['./agent-config gates --all', false],
    // NOT added: a regenerator.
    ['./agent-config roadmap:progress', false],

    // ---- direct runners an agent reaches for --------------------------------
    ['npx vitest run tests/scripts/x.test.ts', true],
    ['npx tsc --noEmit', true],
    ['npx eslint src/', true],
    ['vitest run', true],
    ['pnpm test', true],
    ['yarn lint', true],

    // ---- PHP: claim 4 said these already matched. Re-verified, they do. -----
    ['vendor/bin/phpunit', true],
    ['vendor/bin/phpunit --filter Foo', true],
    ['pest', true],
    ['composer test', true],
    ['php artisan test', true],
    ['php artisan test --filter=Foo', true],
    ['vendor/bin/ecs check', true],
    // ADDED by this audit — same class as mypy / pyright / clippy.
    ['vendor/bin/phpstan analyse', true],
    // NOT added: a refactoring tool. Its dry run prints a diff; it asserts nothing.
    ['vendor/bin/rector process --dry-run', false],

    // ---- other ecosystems ---------------------------------------------------
    ['pytest -q', true],
    ['go test ./...', true],
    ['cargo check', true],
    ['cargo test', true],
    ['make test', true],
    ['mypy .', true],
    ['ruff check .', true],

    // ---- must NEVER clear an unverified edit --------------------------------
    ['ls -la', false],
    ['git status', false],
    ['cat README.md', false],
    ['git log --oneline -5', false],
    ['gh pr view 1400', false],
    ['echo done', false],
    ['git diff --stat', false],
];

describe('detector C — the verify allowlist, audited', () => {
    for (const [command, recognised] of AUDIT) {
        it(`${recognised ? 'recognises' : 'does NOT recognise'}: ${command}`, () => {
            expect(isVerificationCommand(command)).toBe(recognised);
        });
    }

    it('keeps the read-only commands out — the rubber-stamp guard', () => {
        // Stated as its own assertion rather than left implicit in the rows:
        // if this ever passes for `ls`, detector C has stopped detecting and the
        // rest of the table is decoration.
        const readOnly = AUDIT.filter(([, ok]) => !ok).map(([c]) => c);
        expect(readOnly.length).toBeGreaterThan(0);
        for (const c of readOnly) expect(isVerificationCommand(c)).toBe(false);
    });
});
