// Tests for src/scripts/probe_projection_fidelity.ts (py2ts Phase 8 / Wave 8c).
//
// No pytest suite exists. The tsx twin is the source of truth (the python
// original was deleted in the teardown). The script reads a fixture YAML + the
// projected trees and writes a JSON report. We point --report at a temp path so
// the gitignored real report (agents/runtime/reports/projection-fidelity.json)
// is never touched, and --fixture at the real CI fixture. CLI contract: defined
// exit + a valid written report + determinism. Skipped without the fixture.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'probe_projection_fidelity.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', 'projection_fidelity', 'fixtures.yml');

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'proj-fid-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length) {
        const d = tmpDirs.pop()!;
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            /* ignore */
        }
    }
});

function runTs(reportRel?: string) {
    const args = reportRel ? [TS_SCRIPT, '--report', reportRel] : [TS_SCRIPT];
    return spawnSync(TSX_BIN, args, { encoding: 'utf8', cwd: REPO_ROOT });
}

describe.runIf(fs.existsSync(FIXTURE))('probe_projection_fidelity — CLI contract', () => {
    it('writes a valid JSON report deterministically', () => {
        // The --report path is relative to REPO_ROOT inside the script.
        const tmp = mkTmp();
        const reportRel = path.relative(REPO_ROOT, path.join(tmp, 'ts-report.json'));
        const report = path.join(REPO_ROOT, reportRel);

        const a = runTs(reportRel);
        expect(a.status, a.stderr).not.toBeNull();
        expect(fs.existsSync(report)).toBe(true);
        const bytesA = fs.readFileSync(report, 'utf-8');
        expect(() => JSON.parse(bytesA)).not.toThrow();

        const b = runTs(reportRel);
        expect(b.status).toBe(a.status);
        expect(b.stdout).toBe(a.stdout);
        expect(fs.readFileSync(report, 'utf-8')).toBe(bytesA);
    });

    it('default --report path (gitignored) runs deterministically', () => {
        // The default report lives under agents/runtime/ which is gitignored,
        // so writing it causes no tracked-file drift. Restore it between runs.
        const DEFAULT_REPORT = path.join(
            REPO_ROOT,
            'agents',
            'runtime',
            'reports',
            'projection-fidelity.json',
        );
        const existedBefore = fs.existsSync(DEFAULT_REPORT);
        const before = existedBefore ? fs.readFileSync(DEFAULT_REPORT) : null;
        try {
            const a = runTs();
            expect(a.status, a.stderr).not.toBeNull();
            const bytesA = fs.readFileSync(DEFAULT_REPORT, 'utf-8');
            const b = runTs();
            expect(b.status).toBe(a.status);
            expect(b.stdout).toBe(a.stdout);
            expect(fs.readFileSync(DEFAULT_REPORT, 'utf-8')).toBe(bytesA);
        } finally {
            if (before !== null) {
                fs.writeFileSync(DEFAULT_REPORT, before);
            } else if (fs.existsSync(DEFAULT_REPORT)) {
                fs.rmSync(DEFAULT_REPORT);
            }
        }
    });
});
