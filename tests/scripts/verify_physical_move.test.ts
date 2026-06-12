// Tests for src/scripts/verify_physical_move.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure diff helpers (_diff_tree, _diff_manifest, _normalise_loaded_snapshot)
// plus a golden-parity layer: capture a fresh pre-move snapshot via the
// (already-ported) snapshot writer, then run python3 vs tsx verify against it
// and compare stdout/stderr/exit byte-for-byte for the human report, --json,
// and the missing-snapshot error path. The temp snapshot is removed afterwards
// so the test leaves zero git drift.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as vp from '../../src/scripts/verify_physical_move.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'verify_physical_move.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'verify_physical_move.py');
const SNAP_WRITER = path.join(REPO_ROOT, 'src', 'scripts', 'snapshot_agent_outputs.py');
const SNAP_PATH = path.join(REPO_ROOT, 'dist', 'migration', '_verify.test.snapshot.json');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('verify_physical_move — _diff_tree', () => {
    it('flags added / removed / changed entries', () => {
        const issues = vp._diff_tree(
            'x',
            { a: 'aaaaaaaaaaaaaaaa', b: 'bbbbbbbbbbbbbbbb' },
            { b: 'cccccccccccccccc', c: 'dddddddddddddddd' },
        );
        expect(issues.some((i) => i.includes('removed a'))).toBe(true);
        expect(issues.some((i) => i.includes('added   c'))).toBe(true);
        expect(issues.some((i) => i.includes('changed b'))).toBe(true);
    });
    it('returns no issues for identical trees', () => {
        expect(vp._diff_tree('x', { a: '1' }, { a: '1' })).toEqual([]);
    });
});

describe('verify_physical_move — _diff_manifest', () => {
    it('returns [] when both are null', () => {
        expect(vp._diff_manifest(null, null)).toEqual([]);
    });
    it('flags a missing pre-move snapshot', () => {
        expect(vp._diff_manifest(null, {})).toEqual(['  manifest: pre-move snapshot missing']);
    });
    it('flags a missing post-move manifest', () => {
        expect(vp._diff_manifest({}, null)).toEqual(['  manifest: post-move manifest missing']);
    });
    it('returns [] when path-stripped content matches', () => {
        const m = { artefacts: [{ name: 'a', checksum: 'x' }] };
        expect(vp._diff_manifest({ ...m }, { ...m })).toEqual([]);
    });
    it('reports added / removed artefacts on a mismatch', () => {
        const issues = vp._diff_manifest(
            { artefacts: [{ name: 'a' }] },
            { artefacts: [{ name: 'b' }] },
        );
        expect(issues[0]).toBe('  manifest: path-stripped content differs');
        expect(issues.some((i) => i.includes('artefact removed: a'))).toBe(true);
        expect(issues.some((i) => i.includes('artefact added:   b'))).toBe(true);
    });
});

describe('verify_physical_move — _normalise_loaded_snapshot', () => {
    it('drops runtime-skip names and recomputes the unassigned counts', () => {
        const snap = {
            trees: { 't': { 'a/last-run.json': 'x', 'a/keep.md': 'y' } },
            manifest_path_stripped: {
                unassigned: [{ path: '.agent-src.uncondensed/u.md', category: 'rule' }],
                documented_unassigned: [],
                artefacts: [{ name: 'a', path: '.agent-src.uncondensed/a.md', checksum: 'c' }],
                stats: { unassigned_count: 99, documented_unassigned_count: 99 },
                checksum: 'drop',
                scanner_version: 'drop',
            },
        };
        vp._normalise_loaded_snapshot(snap);
        const tree = snap.trees['t'] as Record<string, string>;
        expect('a/last-run.json' in tree).toBe(false);
        expect('a/keep.md' in tree).toBe(true);
        const m = snap.manifest_path_stripped;
        expect((m.stats as Record<string, number>)['unassigned_count']).toBe(1);
        expect((m.unassigned[0] as { path: string }).path).toBe('u.md');
        expect((m.artefacts[0] as Record<string, unknown>)['path']).toBeUndefined();
        expect('checksum' in m).toBe(false);
        expect('scanner_version' in m).toBe(false);
    });
});

describe.runIf(hasPython3())('verify_physical_move — golden parity (python3 vs tsx)', () => {
    beforeAll(() => {
        fs.mkdirSync(path.dirname(SNAP_PATH), { recursive: true });
        // Capture a fresh pre-move snapshot from the current outputs.
        const r = spawnSync('python3', [SNAP_WRITER, '--out', SNAP_PATH], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        expect(r.status).toBe(0);
    });
    afterAll(() => {
        if (fs.existsSync(SNAP_PATH)) {
            fs.rmSync(SNAP_PATH);
        }
    });

    for (const args of [['--snapshot', SNAP_PATH], ['--snapshot', SNAP_PATH, '--json']]) {
        it(`byte-identical for: ${args.includes('--json') ? '--json' : 'human'}`, () => {
            const py = spawnSync('python3', [PY_SCRIPT, ...args], {
                encoding: 'utf8',
                cwd: REPO_ROOT,
            });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
                encoding: 'utf8',
                cwd: REPO_ROOT,
            });
            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
        });
    }

    it('exits 2 with matching stderr for a missing snapshot', () => {
        const missing = path.join(REPO_ROOT, 'dist', 'migration', '_does-not-exist.json');
        const py = spawnSync('python3', [PY_SCRIPT, '--snapshot', missing], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--snapshot', missing], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        expect(py.status).toBe(2);
        expect(ts.status).toBe(2);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.stdout).toBe(py.stdout);
    });
});
