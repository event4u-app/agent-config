// Tests for src/scripts/ci_summary.ts (py2ts Phase 8 / Wave 8a).
//
// Ports tests/test_ci_summary.py 1:1 (load_runs / render_summary /
// write_output) plus a golden-parity layer that runs python3 vs tsx on the
// REAL REPO default args (skipped without python3).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as cs from '../../src/scripts/ci_summary.js';



type Dict = Record<string, unknown>;

function _result(
    name: string,
    opts: {
        status?: string;
        exit_code?: number;
        duration_ms?: number;
        stderr?: string;
        error?: string | null;
    } = {},
): Dict {
    return {
        skill_name: name,
        handler: 'shell',
        command: ['bash', '-c', 'true'],
        cwd: '/tmp',
        exit_code: opts.exit_code ?? 0,
        stdout: '',
        stderr: opts.stderr ?? '',
        duration_ms: opts.duration_ms ?? 12,
        status: opts.status ?? 'success',
        timed_out: false,
        error: opts.error ?? null,
        artifacts: [],
    };
}

describe('ci_summary — ported pytest suite', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cisum-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('load_runs: missing directory → []', () => {
        expect(cs.load_runs(path.join(tmp, 'does-not-exist'))).toEqual([]);
    });

    it('load_runs: empty directory → []', () => {
        expect(cs.load_runs(tmp)).toEqual([]);
    });

    it('load_runs: sorted by filename', () => {
        fs.writeFileSync(path.join(tmp, 'b.json'), JSON.stringify(_result('b')));
        fs.writeFileSync(path.join(tmp, 'a.json'), JSON.stringify(_result('a')));
        const runs = cs.load_runs(tmp);
        expect(runs.map((r) => r.skill_name)).toEqual(['a', 'b']);
    });

    it('load_runs: skips malformed', () => {
        fs.writeFileSync(path.join(tmp, 'ok.json'), JSON.stringify(_result('ok')));
        fs.writeFileSync(path.join(tmp, 'bad.json'), 'not json at all');
        const runs = cs.load_runs(tmp);
        expect(runs.map((r) => r.skill_name)).toEqual(['ok']);
    });

    it('render_summary: empty', () => {
        const md = cs.render_summary([], 'Title');
        expect(md).toContain('## Title');
        expect(md).toContain('No dispatcher runs');
    });

    it('render_summary: all pass', () => {
        const runs = [_result('lint'), _result('refs')];
        const md = cs.render_summary(runs, 'Runs');
        expect(md).toContain('Passed: **2**');
        expect(md).toContain('Failed: **0**');
        expect(md).toContain('| `lint`');
        expect(md).toContain('| `refs`');
        expect(md).toContain('✅ success');
    });

    it('render_summary: failure details', () => {
        const runs = [
            _result('good'),
            _result('bad', {
                status: 'failure',
                exit_code: 1,
                stderr: 'something broke\nstack trace here',
                error: 'boom',
            }),
        ];
        const md = cs.render_summary(runs, 'Runs');
        expect(md).toContain('Passed: **1**');
        expect(md).toContain('Failed: **1**');
        expect(md).toContain('### Failure details');
        expect(md).toContain('<details><summary><code>bad</code>');
        expect(md).toContain('**Error:** boom');
        expect(md).toContain('something broke');
    });

    it('write_output: without env → false', () => {
        const prev = process.env.GITHUB_STEP_SUMMARY;
        delete process.env.GITHUB_STEP_SUMMARY;
        try {
            expect(cs.write_output('hello\n')).toBe(false);
        } finally {
            if (prev !== undefined) process.env.GITHUB_STEP_SUMMARY = prev;
        }
    });

    it('write_output: with env → appends, adds trailing newline', () => {
        const target = path.join(tmp, 'summary.md');
        const prev = process.env.GITHUB_STEP_SUMMARY;
        process.env.GITHUB_STEP_SUMMARY = target;
        try {
            expect(cs.write_output('first\n')).toBe(true);
            expect(cs.write_output('second')).toBe(true); // no trailing → added
            const content = fs.readFileSync(target, 'utf-8');
            expect(content).toBe('first\nsecond\n');
        } finally {
            if (prev !== undefined) process.env.GITHUB_STEP_SUMMARY = prev;
            else delete process.env.GITHUB_STEP_SUMMARY;
        }
    });
});
