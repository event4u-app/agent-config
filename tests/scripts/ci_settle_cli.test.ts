/**
 * `agent-config ci:settle` — the CI waiter reached through the package's own
 * executable, so a shipped command never names a path under `node_modules/` or
 * pulls a TypeScript runner from the registry.
 *
 * Both cases run with no PR argument: the usage refusal is the one path that
 * proves the wiring end to end without a network call.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { findCommand } from '../../src/cli/registry.js';

const ROOT = process.cwd();
const DISPATCH = path.join(ROOT, 'src/scripts/_dispatch.bash');
const WRAPPER = path.join(ROOT, 'src/scripts/_cli/cmd_ci_settle.ts');
const TSX = path.join(ROOT, 'node_modules', '.bin', 'tsx');

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
});
