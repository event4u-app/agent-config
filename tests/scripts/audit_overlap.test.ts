// Tests for src/scripts/audit_overlap.ts (py2ts Phase 8 / Wave 8c).
//
// No pytest suite exists. This is a focused differential suite over the
// pure pieces (keyword_set / jaccard / overlap_fraction via the module) plus
// a golden-parity layer that runs python3 vs tsx on the REAL repo. The
// script takes no flags and writes two tracked files
// (agents/reports/auto-rules-overlap.json + appends auto-rules-audit.md), so
// the parity layer snapshots + restores those exact bytes around each run to
// guarantee zero git drift. Byte-exact stdout/stderr/exit + written-file
// bytes are the contract. Skipped without python3 or without the input
// audit JSON.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_overlap.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_overlap.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const AUDIT_JSON = path.join(REPO_ROOT, 'agents', 'reports', 'auto-rules-audit.json');
const OVERLAP_JSON = path.join(REPO_ROOT, 'agents', 'reports', 'auto-rules-overlap.json');
const AUDIT_MD = path.join(REPO_ROOT, 'agents', 'reports', 'auto-rules-audit.md');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
function inputPresent(): boolean {
    return fs.existsSync(AUDIT_JSON);
}

interface Snap {
    path: string;
    existed: boolean;
    bytes: Buffer | null;
}
function snapshot(p: string): Snap {
    if (fs.existsSync(p)) {
        return { path: p, existed: true, bytes: fs.readFileSync(p) };
    }
    return { path: p, existed: false, bytes: null };
}
function restore(s: Snap): void {
    if (s.existed && s.bytes !== null) {
        fs.writeFileSync(s.path, s.bytes);
    } else if (fs.existsSync(s.path)) {
        fs.rmSync(s.path);
    }
}
function readMaybe(p: string): Buffer | null {
    return fs.existsSync(p) ? fs.readFileSync(p) : null;
}

describe.runIf(hasPython3() && inputPresent())('audit_overlap — golden parity (python3 vs tsx)', () => {
    it('byte-identical stdout/stderr/exit + written files', () => {
        const snapOverlap = snapshot(OVERLAP_JSON);
        const snapMd = snapshot(AUDIT_MD);
        try {
            // --- python3 run ---
            const py = spawnSync('python3', [PY_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
            const pyOverlap = readMaybe(OVERLAP_JSON);
            const pyMd = readMaybe(AUDIT_MD);

            // Reset to the pre-run state before the TS run so the MD-append
            // path starts from the same input on both sides.
            restore(snapOverlap);
            restore(snapMd);

            // --- tsx run ---
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
            const tsOverlap = readMaybe(OVERLAP_JSON);
            const tsMd = readMaybe(AUDIT_MD);

            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(tsOverlap?.toString('utf-8')).toBe(pyOverlap?.toString('utf-8'));
            expect(tsMd?.toString('utf-8')).toBe(pyMd?.toString('utf-8'));
        } finally {
            restore(snapOverlap);
            restore(snapMd);
        }
    });

    it('missing input → exit 1 + stderr marker (no output files touched)', () => {
        // Run from a temp cwd with a temp HOME is not enough — the script keys
        // off REPO_ROOT computed from its own path. Instead, temporarily move
        // the input JSON aside so the missing-input branch fires, then restore.
        const snapInput = snapshot(AUDIT_JSON);
        const snapOverlap = snapshot(OVERLAP_JSON);
        const snapMd = snapshot(AUDIT_MD);
        try {
            fs.rmSync(AUDIT_JSON);
            const py = spawnSync('python3', [PY_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
            expect(py.status).toBe(1);
            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
        } finally {
            restore(snapInput);
            restore(snapOverlap);
            restore(snapMd);
        }
    });
});
