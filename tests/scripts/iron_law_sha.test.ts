// Tests for src/scripts/iron_law_sha.ts (py2ts Phase 8 / Wave 8e).
//
// No pytest suite existed for iron_law_sha.py — focused differential:
// the iron_law_sha() hashing algorithm against handcrafted inputs (the SHA of
// a rule's fences IS deterministic, so we compare it), plus a golden-parity
// layer over the real repo (python3 vs tsx) for --all-kernel, single rules,
// --diff match/mismatch, and the no-args error path.
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/iron_law_sha.js';
import { artefact_roots } from '../../src/scripts/_lib/agent_src.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'iron_law_sha.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'iron_law_sha.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const EMPTY_SHA = crypto.createHash('sha256').update(Buffer.from('', 'utf-8')).digest('hex');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('iron_law_sha — algorithm', () => {
    it('no fences hashes the empty string', () => {
        expect(mod.iron_law_sha('plain text, no fences')).toBe(EMPTY_SHA);
    });

    it('empty fence hashes the empty string', () => {
        const text = '```\n```';
        expect(mod.iron_law_sha(text)).toBe(EMPTY_SHA);
    });

    it('collapses whitespace, strips per line, upper-cases', () => {
        // Two fences; the language tag line is dropped by the regex.
        const a = '```\nfoo   bar\n```';
        const b = '```text\n  foo bar  \n```';
        // Both collapse to "FOO BAR" after WS-collapse + strip + upper.
        const expected = crypto
            .createHash('sha256')
            .update(Buffer.from('FOO BAR', 'utf-8'))
            .digest('hex');
        expect(mod.iron_law_sha(a)).toBe(expected);
        expect(mod.iron_law_sha(b)).toBe(expected);
    });

    it('concatenates multiple fences with no separator', () => {
        const text = '```\nALPHA\n```\nprose\n```\nBETA\n```';
        // norm = "ALPHA" + "BETA" (each WS-collapsed/stripped/upper)
        const expected = crypto
            .createHash('sha256')
            .update(Buffer.from('ALPHABETA', 'utf-8'))
            .digest('hex');
        expect(mod.iron_law_sha(text)).toBe(expected);
    });
});

describe('iron_law_sha — golden parity (python3 vs tsx)', () => {
    const py = hasPython3();
    const runPy = (args: string[]) =>
        spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    const runTs = (args: string[]) =>
        spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });

    // Pick a couple of rule ids that definitely exist under an artefact root.
    function _hasRules(): boolean {
        return artefact_roots().some((r) => {
            try {
                return require('node:fs').statSync(path.join(r, 'rules')).isDirectory();
            } catch {
                return false;
            }
        });
    }
    const haveRules = _hasRules();

    it.skipIf(!py || !haveRules)('--all-kernel matches byte-for-byte', () => {
        const p = runPy(['--all-kernel']);
        const t = runTs(['--all-kernel']);
        expect(t.status).toBe(p.status);
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
    });

    it.skipIf(!py || !haveRules)('single rules match (ljust width)', () => {
        const a = ['commit-policy', 'direct-answers'];
        const p = runPy(a);
        const t = runTs(a);
        expect(t.status).toBe(p.status);
        expect(t.stdout).toBe(p.stdout);
    });

    it.skipIf(!py || !haveRules)('--diff match exits 0 identically', () => {
        const expected = (runPy(['commit-policy']).stdout || '').trim().split(/\s+/)[1] ?? '';
        const a = ['--diff', 'commit-policy', '--against', expected];
        const p = runPy(a);
        const t = runTs(a);
        expect(p.status).toBe(0);
        expect(t.status).toBe(0);
        expect(t.stdout).toBe(p.stdout);
    });

    it.skipIf(!py || !haveRules)('--diff mismatch exits 1 identically', () => {
        const a = ['--diff', 'commit-policy', '--against', 'deadbeef'];
        const p = runPy(a);
        const t = runTs(a);
        expect(p.status).toBe(1);
        expect(t.status).toBe(1);
        expect(t.stdout).toBe(p.stdout);
    });

    it.skipIf(!py)('no args errors out identically (exit 2)', () => {
        const p = runPy([]);
        const t = runTs([]);
        expect(p.status).toBe(2);
        expect(t.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
    });
});
