// Tests for src/scripts/lint_command_routing.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the public behaviour (frontmatter parse, visible-tier gate,
// intent/routes_to/replaces checks, central-eval-store resolution, MIN_CASES,
// per-case prompt/expected validation) plus a golden-parity layer that runs
// python3 vs tsx on the REAL REPO (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as lcr from '../../src/scripts/lint_command_routing.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_command_routing.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_command_routing.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_command_routing — behavioural spec', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lcr-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function write(rel: string, content: string): string {
        const p = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, content, 'utf-8');
        return p;
    }

    it('exempts internal commands (tier 2 / absent) — no violations', () => {
        const md = write(
            'cmd.md',
            '---\ntier: 2\nname: internal\n---\nbody\n',
        );
        expect(lcr.check(md)).toHaveLength(0);
    });

    it('exempts a command with no tier (defaults to 2)', () => {
        const md = write('cmd.md', '---\nname: thing\n---\nbody\n');
        expect(lcr.check(md)).toHaveLength(0);
    });

    it('flags missing intent / routes_to / replaces on a visible command', () => {
        const md = write('cmd.md', '---\ntier: 1\nname: vis\n---\nbody\n');
        const v = lcr.check(md);
        const reasons = v.map((x) => x.reason);
        expect(reasons).toContain('missing/empty `intent` (Step 4b)');
        expect(reasons).toContain('missing/empty `routes_to` list (Step 4b)');
        expect(reasons.some((r) => r.startsWith('missing `replaces` key'))).toBe(true);
    });

    it('treats empty intent string as missing', () => {
        const md = write(
            'cmd.md',
            '---\ntier: 0\nname: vis\nintent: "   "\nroutes_to: [skill-x]\nreplaces: []\n---\n',
        );
        const reasons = lcr.check(md).map((x) => x.reason);
        expect(reasons).toContain('missing/empty `intent` (Step 4b)');
    });

    it('treats empty routes_to list as missing', () => {
        const md = write(
            'cmd.md',
            '---\ntier: 1\nname: vis\nintent: just\nroutes_to: []\nreplaces: []\n---\n',
        );
        const reasons = lcr.check(md).map((x) => x.reason);
        expect(reasons).toContain('missing/empty `routes_to` list (Step 4b)');
    });

    it('accepts replaces: [] (key present, empty list)', () => {
        const md = write(
            'cmd.md',
            '---\ntier: 1\nname: vis\nintent: just\nroutes_to: [skill-x]\nreplaces: []\n---\n',
        );
        const reasons = lcr.check(md).map((x) => x.reason);
        expect(reasons.some((r) => r.startsWith('missing `replaces` key'))).toBe(false);
    });

    it('flags a missing routing eval (Step 5)', () => {
        const md = write(
            'cmd.md',
            '---\ntier: 1\nname: novel-cmd\nintent: just\nroutes_to: [skill-x]\nreplaces: []\n---\n',
        );
        const reasons = lcr.check(md).map((x) => x.reason);
        expect(reasons.some((r) => r.includes('missing routing eval'))).toBe(true);
        // The repr lists the eval keys (name + replaces aliases) as a Python list.
        expect(reasons.some((r) => r.includes("['novel-cmd']"))).toBe(true);
    });

    it('exports the locked constants', () => {
        expect(lcr.MIN_CASES).toBe(5);
        expect([...lcr.VISIBLE_TIERS].sort()).toEqual([0, 1]);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_command_routing — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    it('matches the default (no-flag) run byte-for-byte', () => {
        const py = runPy([]);
        const ts = runTs([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('matches the --quiet run byte-for-byte (real CI invocation)', () => {
        const py = runPy(['--quiet']);
        const ts = runTs(['--quiet']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
