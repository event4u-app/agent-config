/**
 * A `--base` value reaches git as a positional argument; one starting with `-`
 * would be read as an option. The value is refused at the parser, and the
 * fetch that names a branch puts `--` before the remote and refspec anyway.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runGitConvention } from '../../src/scripts/_cli/cmd_git_convention.js';
import { baseValueError } from '../../src/scripts/_lib/git_base_ref.js';
import { carrierBlobAt, type GitRunner } from '../../src/scripts/_lib/git_convention_carrier.js';
import { main as syncMain } from '../../src/scripts/sync_pr_branch.js';

const made: string[] = [];
afterEach(() => {
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('a --base value starting with "-"', () => {
    it('is a usage error at the shared parser', () => {
        expect(baseValueError('-upload-pack=x')).toContain('starts with');
        expect(baseValueError('origin/-x')).toContain('starts with');
        expect(baseValueError('release/1.x')).toBeNull();
        expect(baseValueError('  ')).toContain('empty');
    });

    it('is refused by sync and show with exit 2', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'base-dash-'));
        made.push(dir);
        const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        try {
            expect(syncMain(['--repo', dir, '--base', '-x'])).toBe(2);
        } finally {
            spy.mockRestore();
        }
        expect(runGitConvention(['show', '--base', '-x'], dir).code).toBe(2);
    });
});

describe('the carrier fetch', () => {
    it('puts -- before the remote and the branch it names', () => {
        const calls: string[][] = [];
        const run: GitRunner = (_cmd, args) => {
            calls.push([...args]);
            return { ok: false, out: '', err: '', timedOut: false };
        };
        carrierBlobAt('/nonexistent', 'a'.repeat(40), 'origin/-x', run);
        const fetch = calls.find((a) => a[0] === 'fetch');
        expect(fetch).toBeDefined();
        const sep = (fetch ?? []).indexOf('--');
        expect(sep).toBeGreaterThan(-1);
        expect((fetch ?? []).indexOf('-x')).toBeGreaterThan(sep);
    });
});
