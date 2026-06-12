// Tests for src/scripts/skill_usage_report.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the public helpers (parse_ts, aggregate, status_for, render)
// plus a golden-parity layer that runs python3 vs tsx on a controlled
// --in fixture and a tmp --out, comparing the written report + stdout +
// exit byte-for-byte (skipped without python3). The known-slug discovery
// reads the repo's real .augment/.claude/dist skills, so the parity run
// shares the same repo state across both runtimes.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as sur from '../../src/scripts/skill_usage_report.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'skill_usage_report.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'skill_usage_report.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('skill_usage_report — behavioural spec', () => {
    it('parse_ts handles Z suffix and bad input', () => {
        expect(sur.parse_ts('')).toBeNull();
        expect(sur.parse_ts('not-a-date')).toBeNull();
        const d = sur.parse_ts('2026-05-01T00:00:00Z');
        expect(d).not.toBeNull();
        expect((d as Date).toISOString()).toBe('2026-05-01T00:00:00.000Z');
    });

    it('aggregate buckets exposures/mentions in + out of window', () => {
        const now = new Date('2026-06-01T00:00:00Z');
        const records = [
            { slug: 'a', kind: 'exposure', ts: '2026-05-28T00:00:00Z' }, // in 30d
            { slug: 'a', kind: 'mention', ts: '2026-05-28T00:00:00Z' }, // in 30d
            { slug: 'a', kind: 'exposure', ts: '2026-01-01T00:00:00Z' }, // out of 30d
            { slug: 'b', kind: 'exposure', ts: '2026-05-29T00:00:00Z' }, // in 30d, no mention
            { slug: 'c', kind: 'bogus', ts: '2026-05-29T00:00:00Z' }, // ignored
        ];
        const per = sur.aggregate(records, now, 30);
        const a = per.get('a')!;
        expect(a.exposures_total).toBe(2);
        expect(a.exposures_30d).toBe(1);
        expect(a.mentions_total).toBe(1);
        expect(a.mentions_30d).toBe(1);
        expect(per.has('c')).toBe(false);
        expect(sur.status_for(a)).toBe('active');
        expect(sur.status_for(per.get('b')!)).toBe('exposed-only');
    });

    it('status_for classifies dead', () => {
        expect(
            sur.status_for({
                exposures_total: 5,
                mentions_total: 0,
                exposures_30d: 0,
                mentions_30d: 0,
                last_seen: null,
            }),
        ).toBe('dead');
    });

    it('render sorts dead-first, then by exposures desc, then slug', () => {
        const per = new Map<string, ReturnType<typeof mk>>();
        per.set('zdead', mk(3, 0, 0, 0));
        per.set('aactive', mk(1, 1, 1, 1));
        const text = sur.render(per, new Set(['zdead', 'aactive']));
        const zIdx = text.indexOf('`zdead`');
        const aIdx = text.indexOf('`aactive`');
        // dead sorts first (status != 'dead' is False=0 → ahead).
        expect(zIdx).toBeGreaterThan(0);
        expect(aIdx).toBeGreaterThan(0);
        expect(zIdx).toBeLessThan(aIdx);
        expect(text).toContain('# Skill Usage Report (baseline)');
    });
});

function mk(et: number, mt: number, e30: number, m30: number) {
    return {
        exposures_total: et,
        mentions_total: mt,
        exposures_30d: e30,
        mentions_30d: m30,
        last_seen: null as Date | null,
    };
}

// --- Golden parity (python3 vs tsx) on a controlled --in fixture -------------

const py3 = hasPython3();

const FIXTURE_JSONL = [
    JSON.stringify({ slug: 'eloquent', kind: 'exposure', ts: '2099-01-01T00:00:00Z' }),
    JSON.stringify({ slug: 'eloquent', kind: 'mention', ts: '2099-01-02T00:00:00Z' }),
    JSON.stringify({ slug: 'php-coder', kind: 'exposure', ts: '2099-01-03T00:00:00Z' }),
    JSON.stringify({ slug: 'ghost', kind: 'exposure', ts: '2000-01-01T00:00:00Z' }),
    'not json — skipped',
    '',
].join('\n');

describe.skipIf(!py3)('skill_usage_report — golden parity (python3 vs tsx)', () => {
    // The non-quiet stdout line uses `Path.relative_to(REPO)`, which raises
    // ValueError on an out-of-repo path (a faithfully-replicated Python
    // quirk). The real CLI always writes inside the repo, so the fixture
    // out dir is created UNDER the repo root and removed afterwards (zero
    // git drift — it is a fresh tmp dir, not a tracked path).
    it('written report + stdout + exit match byte-for-byte (in-repo out)', () => {
        const dir = fs.mkdtempSync(path.join(REPO_ROOT, '.sur-par-'));
        try {
            const inp = path.join(dir, 'usage.jsonl');
            fs.writeFileSync(inp, FIXTURE_JSONL);
            const pyOut = path.join(dir, 'py.md');
            const tsOut = path.join(dir, 'ts.md');
            const py = spawnSync('python3', [PY_SCRIPT, '--in', inp, '--out', pyOut], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--in', inp, '--out', tsOut], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            });
            expect(ts.status, ts.stderr).toBe(py.status);
            // stdout "Wrote <relpath> (N skill(s))" — relpath differs only on
            // the file name (py.md vs ts.md); normalize that token.
            const norm = (s: string): string => s.replace(/(ts|py)\.md/, '<out>.md');
            expect(norm(ts.stdout)).toBe(norm(py.stdout));
            expect(ts.stderr).toBe(py.stderr);
            expect(fs.readFileSync(tsOut, 'utf-8')).toBe(fs.readFileSync(pyOut, 'utf-8'));
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('--quiet suppresses stdout, report still matches (out-of-repo OK)', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sur-q-'));
        try {
            const inp = path.join(dir, 'usage.jsonl');
            fs.writeFileSync(inp, FIXTURE_JSONL);
            const pyOut = path.join(dir, 'py.md');
            const tsOut = path.join(dir, 'ts.md');
            const py = spawnSync('python3', [PY_SCRIPT, '--in', inp, '--out', pyOut, '--quiet'], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--in', inp, '--out', tsOut, '--quiet'], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            });
            expect(ts.stdout).toBe('');
            expect(py.stdout).toBe('');
            expect(ts.status).toBe(py.status);
            expect(fs.readFileSync(tsOut, 'utf-8')).toBe(fs.readFileSync(pyOut, 'utf-8'));
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
