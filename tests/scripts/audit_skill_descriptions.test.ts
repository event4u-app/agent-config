// Tests for src/scripts/audit_skill_descriptions.ts (py2ts Phase 8 / Wave 8a).
//
// Two layers:
//   1. A 1:1 port of tests/test_audit_skill_descriptions.py — the description
//      flagging rules (too-short, no-trigger-prefix, pushy-accept, too-long,
//      200-char boundary, hedge, only-when, text-sort-worst-first, missing-root
//      exit, real-repo smoke) — driven via the tsx subprocess exactly like the
//      pytest suite drives the python3 subprocess.
//   2. A golden-parity layer (python3 vs tsx) on the real repo: --json, text,
//      and --full are asserted byte-identical. Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_skill_descriptions.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_skill_descriptions.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function runTs(args: string[]): { stdout: string; stderr: string; status: number | null } {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

interface Finding {
    skill: string;
    path: string;
    description: string;
    length: number;
    flags: string[];
}

let tmpDir: string;
beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auditdesc-'));
});
afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeSkill(root: string, name: string, description: string): void {
    const dir = path.join(root, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'SKILL.md'),
        `---\nname: ${name}\ndescription: "${description}"\n---\n\n# ${name}\n`,
        'utf-8',
    );
}

function runJson(root: string): Finding[] {
    const r = runTs(['--root', root, '--json']);
    expect(r.status).toBe(0);
    return JSON.parse(r.stdout) as Finding[];
}

describe('audit_skill_descriptions — flagging rules (ported)', () => {
    it('flags a too-short description', () => {
        writeSkill(tmpDir, 'tiny', 'Use when tiny. Short.');
        const findings = runJson(tmpDir);
        expect(findings.length).toBe(1);
        expect(
            findings[0]!.flags.includes('very-short') || findings[0]!.flags.includes('too-short'),
        ).toBe(true);
    });

    it('flags a missing trigger prefix', () => {
        const desc =
            'Something that is about Laravel controllers and their ' +
            'conventions including middleware use and request validation ' +
            'plus related concerns and edge cases appearing over time.';
        writeSkill(tmpDir, 'no-prefix', desc);
        expect(runJson(tmpDir)[0]!.flags).toContain('no-trigger-prefix');
    });

    it('accepts a pushy description', () => {
        const desc =
            'Use when writing Playwright E2E tests — locators, assertions, ' +
            'Page Objects, fixtures, CI, and flaky test prevention — even ' +
            "if the user doesn't say Playwright.";
        writeSkill(tmpDir, 'good', desc);
        expect(runJson(tmpDir)[0]!.flags).toEqual([]);
    });

    it('flags a too-long description', () => {
        const desc =
            'Use when writing, reviewing, or fixing commit messages and squash-merge ' +
            'titles — `feat:`, `fix:`, `chore:`, scopes, breaking-change markers — ' +
            "even when the user just says 'commit this' or 'good commit title?' " +
            'without naming Conventional Commits.';
        expect(desc.length).toBeGreaterThan(200);
        writeSkill(tmpDir, 'verbose', desc);
        expect(runJson(tmpDir)[0]!.flags).toContain('too-long');
    });

    it('accepts a description at exactly 200 chars', () => {
        const head = 'Use when writing Eloquent models, relationships, scopes, queries — ';
        const tail = " — even if the user doesn't say Eloquent.";
        const filler = 'x'.repeat(200 - head.length - tail.length);
        const desc = head + filler + tail;
        expect(desc.length).toBe(200);
        writeSkill(tmpDir, 'boundary', desc);
        expect(runJson(tmpDir)[0]!.flags).not.toContain('too-long');
    });

    it('flags a hedge phrase', () => {
        const desc =
            'Use when things happen. This may help with various Laravel ' +
            'controller concerns and also covers various edge cases and ' +
            'scenarios that arise in modern PHP development workflows.';
        writeSkill(tmpDir, 'hedgy', desc);
        const hedge = runJson(tmpDir)[0]!.flags.filter((f) => f.startsWith('hedge:'));
        expect(hedge.length).toBeGreaterThan(0);
    });

    it('accepts an ONLY-when prefix', () => {
        const desc =
            'ONLY when user explicitly requests: performance audit, ' +
            'bottleneck analysis, or N+1 query detection. NOT for regular ' +
            'feature work or unrelated Laravel questions.';
        writeSkill(tmpDir, 'only-when', desc);
        expect(runJson(tmpDir)[0]!.flags).not.toContain('no-trigger-prefix');
    });

    it('text output sorts worst-first (bad shown)', () => {
        writeSkill(
            tmpDir,
            'good',
            'Use when writing things — triggers a, b, c, d, e — even if ' +
                'the user does not explicitly name the skill or mention it.',
        );
        writeSkill(tmpDir, 'bad', 'Use when things.');
        const r = runTs(['--root', tmpDir]);
        expect(r.status).toBe(0);
        const lines = r.stdout.split('\n');
        const badIdx = lines.findIndex((line) => line.includes('bad') && !line.includes('SCORE'));
        expect(badIdx).toBeGreaterThan(0);
    });

    it('exits non-zero on a missing root', () => {
        const r = runTs(['--root', path.join(tmpDir, 'does-not-exist')]);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain('does not exist');
    });

    it('real-repo smoke: parses JSON, > 50 skills, no missing flag', () => {
        const r = runTs(['--json']);
        expect(r.status).toBe(0);
        const data = JSON.parse(r.stdout) as Finding[];
        expect(data.length).toBeGreaterThan(50);
        expect(data.filter((d) => d.flags.includes('missing'))).toEqual([]);
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('audit_skill_descriptions — golden parity (python3 vs tsx)', () => {
    function py(args: string[]): { stdout: string; stderr: string; status: number | null } {
        const r = spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
        return { stdout: r.stdout, stderr: r.stderr, status: r.status };
    }
    it('--json byte-identical on the real repo', () => {
        const p = py(['--json']);
        const t = runTs(['--json']);
        expect(t.stdout).toBe(p.stdout);
        expect(t.status).toBe(p.status);
    });
    it('text byte-identical on the real repo', () => {
        const p = py([]);
        const t = runTs([]);
        expect(t.stdout).toBe(p.stdout);
        expect(t.status).toBe(p.status);
    });
    it('--full byte-identical on the real repo', () => {
        const p = py(['--full']);
        const t = runTs(['--full']);
        expect(t.stdout).toBe(p.stdout);
        expect(t.status).toBe(p.status);
    });
    it('missing-root stderr + exit identical', () => {
        const p = py(['--root', '/tmp/py2ts-nope-xyz']);
        const t = runTs(['--root', '/tmp/py2ts-nope-xyz']);
        expect(t.stderr).toBe(p.stderr);
        expect(t.status).toBe(p.status);
    });
});
