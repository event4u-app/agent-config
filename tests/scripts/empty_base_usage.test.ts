/**
 * An empty `--base` is a usage error everywhere it is accepted.
 *
 * An unset variable in `--base "origin/$BASE"` style callers expands to
 * nothing; read as "no override" it silently judged the run against the
 * default branch. Each surface exits 2 before reading or merging anything.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runGitConvention } from '../../src/scripts/_cli/cmd_git_convention.js';
import { blankBaseError } from '../../src/scripts/_lib/git_base_ref.js';
import { main as freshnessMain } from '../../src/scripts/check_branch_freshness.js';
import { main as syncMain } from '../../src/scripts/sync_pr_branch.js';

const made: string[] = [];
afterEach(() => {
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function dir(): string {
    const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'empty-base-')));
    made.push(d);
    return d;
}

function captured(run: () => number): { code: number; err: string } {
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
        const code = run();
        return { code, err: [...err.mock.calls, ...log.mock.calls].map((c) => String(c[0])).join('') };
    } finally {
        out.mockRestore();
        err.mockRestore();
        log.mockRestore();
    }
}

const BLANKS = ['', '   ', '\t'];

describe('blankBaseError', () => {
    it.each(BLANKS)('rejects %j', (v) => {
        expect(blankBaseError(v)).toContain('--base');
    });
    it('accepts a name', () => {
        expect(blankBaseError('main')).toBeNull();
    });
});

describe('every surface exits 2 on a blank --base', () => {
    it.each(BLANKS)('sync_pr_branch --base %j', (v) => {
        const r = captured(() => syncMain(['--repo', dir(), '--base', v]));
        expect(r.code).toBe(2);
        expect(r.err).toContain('--base');
    });

    it.each(BLANKS)('git:convention show --base %j', (v) => {
        const r = runGitConvention(['show', '--base', v], dir());
        expect(r.code).toBe(2);
        expect(r.err.join('\n')).toContain('--base');
    });

    it.each(BLANKS)('git:convention sync --base %j', (v) => {
        const r = captured(() => runGitConvention(['sync', '--base', v], dir()).code);
        expect(r.code).toBe(2);
    });

    it.each(BLANKS)('check_branch_freshness --base %j', (v) => {
        const r = captured(() => freshnessMain(['--base', v]));
        expect(r.code).toBe(2);
        expect(r.err).toContain('--base');
    });

    it.each(BLANKS)('check_branch_freshness --base=%j', (v) => {
        expect(captured(() => freshnessMain([`--base=${v}`])).code).toBe(2);
    });
});
