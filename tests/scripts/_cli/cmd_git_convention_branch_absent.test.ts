/**
 * `branch` with no `branch_pattern` in force: no layer sets it and the template
 * this install reads carries no default. That state is `absent`, not a refusal,
 * and the line printed for it named a success code (`git-convention-ok`) on an
 * error exit.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/scripts/_lib/agent_settings.js', async (importOriginal) => {
    const real = await importOriginal<typeof import('../../../src/scripts/_lib/agent_settings.js')>();
    return { ...real, template_defaults: () => ({}) };
});

const { runGitConvention } = await import('../../../src/scripts/_cli/cmd_git_convention.js');

const made: string[] = [];
afterEach(() => {
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function repo(): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'git-convention-branch-absent-')));
    made.push(dir);
    execFileSync('git', ['init', '-q', '-b', 'main', dir]);
    return dir;
}

describe('git:convention branch without any branch_pattern', () => {
    it('says no pattern is declared and how to pass one, never a success code', () => {
        const r = runGitConvention(['branch', '--slug', 'export'], repo());
        expect(r.code).toBe(1);
        const text = r.err.join('\n');
        expect(text).not.toContain('git-convention-ok');
        expect(text).toContain('no branch_pattern declared');
        expect(text).toContain('--pattern');
    });

    it('still renders with --pattern', () => {
        const r = runGitConvention(['branch', '--slug', 'export', '--pattern', '{slug}'], repo());
        expect(r.code).toBe(0);
        expect(r.out).toEqual(['export']);
    });
});
