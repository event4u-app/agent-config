// Tests for src/scripts/probe_projection_fidelity.ts (py2ts Phase 8 / Wave 8c).
//
// No pytest suite exists. The script reads a fixture YAML + the projected
// trees and writes a JSON report. We point --report at a temp path so the
// gitignored real report (agents/runtime/reports/projection-fidelity.json) is
// never touched, and --fixture at the real CI fixture. Golden parity:
// python3 vs tsx — byte-exact stdout/stderr/exit + written-report bytes.
// Skipped without python3 or without the fixture.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'probe_projection_fidelity.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'probe_projection_fidelity.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', 'projection_fidelity', 'fixtures.yml');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

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

describe.runIf(hasPython3() && fs.existsSync(FIXTURE))(
    'probe_projection_fidelity — golden parity (python3 vs tsx)',
    () => {
        it('byte-identical stdout/stderr/exit + written report', () => {
            // The --report path is relative to REPO_ROOT inside the script.
            const tmp = mkTmp();
            const pyReportRel = path.relative(REPO_ROOT, path.join(tmp, 'py-report.json'));
            const tsReportRel = path.relative(REPO_ROOT, path.join(tmp, 'ts-report.json'));

            const py = spawnSync(
                'python3',
                [PY_SCRIPT, '--report', pyReportRel],
                { encoding: 'utf8', cwd: REPO_ROOT },
            );
            const ts = spawnSync(
                TSX_BIN,
                [TS_SCRIPT, '--report', tsReportRel],
                { encoding: 'utf8', cwd: REPO_ROOT },
            );

            // stdout names the --report path, so it differs by design; compare
            // status, stderr, and the written report bytes instead, plus the
            // stdout with the report path normalized out.
            expect(ts.status).toBe(py.status);
            expect(ts.stderr).toBe(py.stderr);

            const pyReport = path.join(REPO_ROOT, pyReportRel);
            const tsReport = path.join(REPO_ROOT, tsReportRel);
            expect(fs.existsSync(tsReport)).toBe(fs.existsSync(pyReport));
            if (fs.existsSync(pyReport)) {
                expect(fs.readFileSync(tsReport, 'utf-8')).toBe(fs.readFileSync(pyReport, 'utf-8'));
            }

            const pyStdoutNorm = py.stdout.split(pyReportRel).join('<REPORT>');
            const tsStdoutNorm = ts.stdout.split(tsReportRel).join('<REPORT>');
            expect(tsStdoutNorm).toBe(pyStdoutNorm);
        });

        it('default --report path parity (write to the real gitignored path)', () => {
            // The default report lives under agents/runtime/ which is gitignored,
            // so writing it causes no tracked-file drift. Compare both runs'
            // stdout/stderr/exit + the written bytes, restoring the file between.
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
                const py = spawnSync('python3', [PY_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
                const pyBytes = fs.readFileSync(DEFAULT_REPORT, 'utf-8');
                const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
                const tsBytes = fs.readFileSync(DEFAULT_REPORT, 'utf-8');
                expect(ts.status).toBe(py.status);
                expect(ts.stdout).toBe(py.stdout);
                expect(ts.stderr).toBe(py.stderr);
                expect(tsBytes).toBe(pyBytes);
            } finally {
                if (before !== null) {
                    fs.writeFileSync(DEFAULT_REPORT, before);
                } else if (fs.existsSync(DEFAULT_REPORT)) {
                    fs.rmSync(DEFAULT_REPORT);
                }
            }
        });
    },
);
