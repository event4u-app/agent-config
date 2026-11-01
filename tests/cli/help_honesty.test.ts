/**
 * road-to-docs-that-sell 4.5 — small honesty fixes on the per-command help.
 *
 * Each case is a place where asking for help either ran the command, pointed at
 * a path a consumer does not have, or listed flags and verbs with no word on
 * what they do.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main as doctorMain } from '../../src/scripts/_cli/cmd_doctor.js';
import { main as codeGraphMain } from '../../src/scripts/code_graph/cli.js';
import { runInProc } from '../_lib/run_in_process.js';

const ROOT = process.cwd();

let tmp: string;
beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'help-honesty-'));
});
afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
});

describe('first-run --help', () => {
    it('prints help and exits 0 instead of running the checklist', () => {
        const res = spawnSync('bash', [resolve(ROOT, 'src/scripts/first-run.sh'), '--help'], {
            cwd: tmp,
            encoding: 'utf8',
        });
        expect(res.status).toBe(0);
        expect(res.stdout).toContain('Usage: agent-config first-run');
        expect(res.stdout).not.toContain('Agent Config — First Run');
    });
});

describe('unknown command', () => {
    it('names `agent-config help`, not a repo-local ./agent-config', () => {
        const res = spawnSync('bash', [resolve(ROOT, 'src/scripts/_dispatch.bash'), 'no-such-command'], {
            cwd: tmp,
            encoding: 'utf8',
        });
        expect(res.status).toBe(2);
        expect(res.stderr).toContain('Run `agent-config help` for the command list.');
        expect(res.stderr).not.toContain('./agent-config');
    });
});

describe('doctor --help', () => {
    it('describes every flag in its usage line', () => {
        const t = runInProc(doctorMain, ['--help'], { cwd: tmp });
        expect(t.status).toBe(0);
        expect(t.stdout.startsWith('usage: agent-config doctor')).toBe(true);
        const usage = t.stdout.slice(0, t.stdout.indexOf('\n\n'));
        const flags = [...new Set(usage.match(/--[a-z][a-z-]*/g) ?? [])];
        expect(flags.length).toBeGreaterThan(8);
        for (const flag of flags) {
            expect(t.stdout, flag).toMatch(new RegExp(`^ {2}${flag}\\b.*\\S.*\\s{2,}\\S`, 'm'));
        }
    });
});

describe('code-graph --help', () => {
    async function run(argv: string[]): Promise<{ code: number; out: string; err: string }> {
        let out = '';
        let err = '';
        const o = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => ((out += String(c)), true));
        const e = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => ((err += String(c)), true));
        try {
            const code = await codeGraphMain(argv);
            return { code, out, err };
        } finally {
            o.mockRestore();
            e.mockRestore();
        }
    }

    it('exits 0 and describes every verb on its own line', async () => {
        const r = await run(['--help']);
        expect(r.code).toBe(0);
        expect(r.out).toContain('Usage: agent-config code-graph <verb> [options]');
        for (const verb of ['build', 'refresh', 'query', 'impact', 'tests-for', 'dead', 'map', 'open', 'ask', 'scan']) {
            expect(r.out, verb).toMatch(new RegExp(`^ {2}${verb} .*\\S`, 'm'));
        }
        expect(r.out).not.toContain('code_graph/cli.ts');
    });

    it('a missing verb still fails, and shows the same help on stderr', async () => {
        const r = await run([]);
        expect(r.code).toBe(2);
        expect(r.err).toContain('Usage: agent-config code-graph <verb> [options]');
    });
});
