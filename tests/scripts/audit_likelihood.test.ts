// Tests for src/scripts/audit_likelihood.ts (py2ts Phase 8 / Wave 8c).
//
// No pytest suite existed for audit_likelihood.py, so this is a focused
// differential suite:
//   1. Unit checks of the pure helpers (tokens) in-process.
//   2. A golden-parity layer (python3 vs tsx) on the real repo. The likelihood
//      JSON's `hits` field is GENUINELY non-deterministic in Python itself:
//      its top-8 truncation `dict(sorted(...)[:8])` depends on the hash-seed
//      ordering of a Python `set`, so two python runs under different
//      PYTHONHASHSEED differ at the 8th slot. The TS twin is deterministic
//      (token-ascending tie-break). We therefore compare every score field
//      EXCEPT `hits` byte-for-byte (name, tokens, hit_count, total_hit_volume,
//      low_likelihood, corpus_size), and assert the appended Markdown section
//      — which never uses the `hits` dict — is byte-identical. The report
//      files are snapshotted and restored so the run leaves zero git drift.
//      Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { tokens } from '../../src/scripts/audit_likelihood.js';
import { acquireGlobalStateLock } from './_global_state_lock.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_LIKELIHOOD = path.join(REPO_ROOT, 'src', 'scripts', 'audit_likelihood.ts');
const PY_LIKELIHOOD = path.join(REPO_ROOT, 'src', 'scripts', 'audit_likelihood.py');
const TS_AUDIT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_auto_rules.ts');
const PY_AUDIT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_auto_rules.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const REPORT_DIR = path.join(REPO_ROOT, 'agents', 'reports');
const AUDIT_JSON = path.join(REPORT_DIR, 'auto-rules-audit.json');
const AUDIT_MD = path.join(REPORT_DIR, 'auto-rules-audit.md');
const LIKELIHOOD_JSON = path.join(REPORT_DIR, 'auto-rules-likelihood.json');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
function ts(script: string, args: string[]): { stdout: string; stderr: string; status: number | null } {
    const r = spawnSync(TSX_BIN, [script, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}
function py(script: string, args: string[]): { stdout: string; stderr: string; status: number | null } {
    const r = spawnSync('python3', [script, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

describe('audit_likelihood — unit helpers', () => {
    it('tokens lowercases, filters stopwords and len<=3', () => {
        const t = tokens('Use WHEN the Router fires for AGENT code paths.');
        // "use","when","the","for","agent","code" are stopwords; len<=3 dropped.
        expect(t.has('router')).toBe(true);
        expect(t.has('fires')).toBe(true);
        expect(t.has('paths')).toBe(true);
        expect(t.has('agent')).toBe(false);
        expect(t.has('use')).toBe(false);
    });
    it('tokens requires len > 3 (4+ code points)', () => {
        const t = tokens('abcd abc ab');
        expect(t.has('abcd')).toBe(true);
        expect(t.has('abc')).toBe(false);
    });
});

const py3 = hasPython3();

interface LikeScore {
    name: string;
    tokens: string[];
    hits: Record<string, number>;
    hit_count: number;
    total_hit_volume: number;
    low_likelihood: boolean;
}
interface LikeDump {
    corpus_size: number;
    scores: LikeScore[];
}

/** Strip the Python-non-deterministic `hits` field for a fair comparison. */
function canon(d: LikeDump): unknown {
    return {
        corpus_size: d.corpus_size,
        scores: d.scores.map((s) => ({
            name: s.name,
            tokens: s.tokens,
            // hits intentionally omitted — non-deterministic top-8 in Python.
            hit_count: s.hit_count,
            total_hit_volume: s.total_hit_volume,
            low_likelihood: s.low_likelihood,
        })),
    };
}

describe.skipIf(!py3)('audit_likelihood — golden parity (python3 vs tsx)', () => {
    let snap: Record<string, string | null> = {};
    let release: (() => void) | null = null;
    beforeEach(() => {
        release = acquireGlobalStateLock();
        for (const f of [AUDIT_JSON, AUDIT_MD, LIKELIHOOD_JSON]) {
            snap[f] = fs.existsSync(f) ? fs.readFileSync(f, 'utf-8') : null;
        }
    });
    afterEach(() => {
        for (const f of [AUDIT_JSON, AUDIT_MD, LIKELIHOOD_JSON]) {
            const s = snap[f];
            if (s !== null && s !== undefined) {
                fs.writeFileSync(f, s, 'utf-8');
            } else if (fs.existsSync(f)) {
                fs.rmSync(f);
            }
        }
        snap = {};
        if (release) {
            release();
            release = null;
        }
    });

    it('likelihood deterministic fields + appended MD byte-identical', () => {
        // Python pass: regenerate the audit JSON + MD, then score likelihood.
        expect(py(PY_AUDIT, []).status).toBe(0);
        const pl = py(PY_LIKELIHOOD, []);
        const pyLike = JSON.parse(fs.readFileSync(LIKELIHOOD_JSON, 'utf-8')) as LikeDump;
        const pyMd = fs.readFileSync(AUDIT_MD, 'utf-8');

        // TS pass: same sequence with the twins.
        expect(ts(TS_AUDIT, []).status).toBe(0);
        const tl = ts(TS_LIKELIHOOD, []);
        const tsLike = JSON.parse(fs.readFileSync(LIKELIHOOD_JSON, 'utf-8')) as LikeDump;
        const tsMd = fs.readFileSync(AUDIT_MD, 'utf-8');

        expect(tl.stdout).toBe(pl.stdout);
        expect(tl.stderr).toBe(pl.stderr);
        expect(tl.status).toBe(pl.status);
        expect(tl.status).toBe(0);
        // The appended Markdown section never references the `hits` dict.
        expect(tsMd).toBe(pyMd);
        // Everything except the non-deterministic `hits` top-8 matches.
        expect(canon(tsLike)).toEqual(canon(pyLike));
    });

    it('missing audit JSON → exit 1, byte-identical stderr', () => {
        // Remove the audit JSON, then run likelihood on both.
        if (fs.existsSync(AUDIT_JSON)) {
            fs.rmSync(AUDIT_JSON);
        }
        const p = py(PY_LIKELIHOOD, []);
        if (fs.existsSync(AUDIT_JSON)) {
            fs.rmSync(AUDIT_JSON);
        }
        const t = ts(TS_LIKELIHOOD, []);
        expect(t.status).toBe(1);
        expect(p.status).toBe(1);
        expect(t.stderr).toBe(p.stderr);
        expect(t.stdout).toBe(p.stdout);
    });
});
