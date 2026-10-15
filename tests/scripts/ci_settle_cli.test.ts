/**
 * `agent-config ci:settle` — the CI waiter reached through the package's own
 * executable, so a shipped command never names a path under `node_modules/` or
 * pulls a TypeScript runner from the registry.
 *
 * Both cases run with no PR argument: the usage refusal is the one path that
 * proves the wiring end to end without a network call.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { findCommand } from '../../src/cli/registry.js';
import { CI_SETTLE_INVOCATION } from '../../src/scripts/hooks/push_settle_hook.js';

const ROOT = process.cwd();
const DISPATCH = path.join(ROOT, 'src/scripts/_dispatch.bash');
const WRAPPER = path.join(ROOT, 'src/scripts/_cli/cmd_ci_settle.ts');
const TSX = path.join(ROOT, 'node_modules', '.bin', 'tsx');

// Every shipped surface that tells a consumer how to wait for CI. The packed
// install smoke (tests/test_release_install_e2e.sh § consumer-ci-settle) runs
// the /fix ci line; this keeps the other surfaces on the same invocation.
const EMITTERS = [
    'src/domains/engineering-base/fix/ci/command.md',
    'src/domains/git/pr/create/command.md',
    'src/domains/product-basic/roadmap/process-full/command.md',
];
// A generic skill may not name an npm invocation (lint_framework_leakage), so the
// git-workflow skill points at /fix ci instead of emitting the line itself.
const POINTERS = ['src/skills/git-workflow/SKILL.md'];

function countUsage(stderr: string): number {
    return stderr.split('usage: ci_settle').length - 1;
}

describe('ci:settle verb', () => {
    it('is registered for --help', () => {
        expect(findCommand('ci:settle')?.disposition).toBe('delegate');
    });

    it('the dispatcher routes ci:settle to the waiter', () => {
        const r = spawnSync('bash', [DISPATCH, 'ci:settle'], { encoding: 'utf8', timeout: 60_000 });
        expect(r.status).toBe(2);
        expect(countUsage(r.stderr)).toBe(1);
    });

    it('the wrapper runs the waiter exactly once', () => {
        const r = spawnSync(TSX, [WRAPPER], { encoding: 'utf8', timeout: 60_000 });
        expect(r.status).toBe(2);
        expect(countUsage(r.stderr)).toBe(1);
    });

    it('every shipped surface emits the one invocation that works on a project-local install', () => {
        expect(CI_SETTLE_INVOCATION).toBe('npm exec --no -- agent-config ci:settle');
        for (const rel of EMITTERS) {
            const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
            const uses = text.split('ci:settle').length - 1;
            expect(uses, rel).toBeGreaterThan(0);
            expect(text.split(CI_SETTLE_INVOCATION).length - 1, rel).toBe(uses);
        }
        for (const rel of POINTERS) {
            const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
            expect(text, rel).not.toContain('ci:settle');
            expect(text, rel).toContain('`/fix ci` § 0');
        }
    });
});
