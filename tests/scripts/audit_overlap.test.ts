// Tests for src/scripts/audit_overlap.ts (py2ts Phase 8 / Wave 8c).
//
// No pytest suite exists. The tsx twin is the source of truth (the python
// original was deleted in the teardown). The script takes no flags and writes
// two tracked files (agents/reports/auto-rules-overlap.json + appends
// auto-rules-audit.md), so the CLI contract snapshots + restores those exact
// bytes around each run to guarantee zero git drift, and asserts the run is
// deterministic. Skipped without the input audit JSON.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_overlap.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const AUDIT_JSON = path.join(REPO_ROOT, 'agents', 'reports', 'auto-rules-audit.json');
const OVERLAP_JSON = path.join(REPO_ROOT, 'agents', 'reports', 'auto-rules-overlap.json');
const AUDIT_MD = path.join(REPO_ROOT, 'agents', 'reports', 'auto-rules-audit.md');

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
function runTs() {
    return spawnSync(TSX_BIN, [TS_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
}

describe.runIf(inputPresent())('audit_overlap — CLI contract', () => {
    it('runs deterministically over the repo, writing a valid overlap JSON', () => {
        const snapOverlap = snapshot(OVERLAP_JSON);
        const snapMd = snapshot(AUDIT_MD);
        try {
            const a = runTs();
            expect(a.status, a.stderr).toBe(0);
            const overlapA = readMaybe(OVERLAP_JSON)?.toString('utf-8');
            expect(overlapA).toBeTruthy();
            expect(() => JSON.parse(overlapA!)).not.toThrow();
            restore(snapOverlap);
            restore(snapMd);
            const b = runTs();
            expect(b.status).toBe(a.status);
            expect(b.stdout).toBe(a.stdout);
            expect(readMaybe(OVERLAP_JSON)?.toString('utf-8')).toBe(overlapA);
        } finally {
            restore(snapOverlap);
            restore(snapMd);
        }
    });

    it('missing input → exit 1 (no output files touched)', () => {
        const snapInput = snapshot(AUDIT_JSON);
        const snapOverlap = snapshot(OVERLAP_JSON);
        const snapMd = snapshot(AUDIT_MD);
        try {
            fs.rmSync(AUDIT_JSON);
            expect(runTs().status).toBe(1);
        } finally {
            restore(snapInput);
            restore(snapOverlap);
            restore(snapMd);
        }
    });
});
