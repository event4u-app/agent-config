// Tests for src/agent-src/templates/scripts/telemetry_record.ts (ADR-094).
//
// Template-only entry point over the telemetry/ package. Golden-parity:
// python3 vs tsx on tmp fixtures, byte-identical stdout / stderr / exit AND
// the written JSONL line. Timestamps are pinned via --ts so the byte
// comparison is deterministic; the no--ts path is covered by a unit assertion
// that does not compare the wall-clock token. argparse --help is not compared.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const S = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const TS_SCRIPT = path.join(S, 'telemetry_record.ts');
const PY_SCRIPT = path.join(S, 'telemetry_record.py');
const TSX_BIN = process.env.TSX_BIN
    ? path.resolve(REPO_ROOT, process.env.TSX_BIN)
    : path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tele-rec-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop();
        if (d && fs.existsSync(d)) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

function settingsFile(dir: string, enabled: boolean, logRel = 'eng.jsonl'): string {
    const p = path.join(dir, 'settings.yml');
    fs.writeFileSync(
        p,
        `telemetry:\n  artifact_engagement:\n    enabled: ${enabled}\n    output:\n      path: ${path.join(dir, logRel)}\n`,
    );
    return p;
}

interface Run {
    status: number | null;
    stdout: string;
    stderr: string;
    log: string;
}

function run(bin: string, script: string, args: string[], logPath: string): Run {
    const r = spawnSync(bin, [script, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    let log = ' MISSING ';
    try {
        log = fs.readFileSync(logPath, 'utf8');
    } catch {
        log = ' MISSING ';
    }
    return { status: r.status, stdout: r.stdout, stderr: r.stderr, log };
}

describe.runIf(hasPython3())('telemetry_record — golden parity (python3 vs tsx)', () => {
    it('disabled (default) → silent exit 0 and zero file IO', () => {
        const dir = mkTmp();
        const settings = settingsFile(dir, false);
        const logPath = path.join(dir, 'eng.jsonl');
        const args = ['--settings', settings, '--task-id', 't', '--consulted', 'skills:x'];
        const py = run('python3', PY_SCRIPT, args, logPath);
        expect(fs.existsSync(logPath)).toBe(false);
        const ts = run(TSX_BIN, TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(fs.existsSync(logPath)).toBe(false);
    });

    it('enabled CLI args → byte-identical JSONL line', () => {
        const args = (settings: string): string[] => [
            '--settings', settings, '--ts', '2026-01-02T03:04:05Z',
            '--task-id', 'ticket-1', '--boundary', 'task',
            '--consulted', 'skills:php-coder', '--consulted', 'rules:scope-control',
            '--applied', 'skills:php-coder',
            '--outcome', 'verification_failed', '--outcome', 'stop_rule_triggered',
        ];
        const pyDir = mkTmp();
        const tsDir = mkTmp();
        const pyLog = path.join(pyDir, 'eng.jsonl');
        const tsLog = path.join(tsDir, 'eng.jsonl');
        const py = run('python3', PY_SCRIPT, args(settingsFile(pyDir, true)), pyLog);
        const ts = run(TSX_BIN, TS_SCRIPT, args(settingsFile(tsDir, true)), tsLog);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.log).toBe(py.log);
    });

    it('--force bypasses the disabled flag', () => {
        const pyDir = mkTmp();
        const tsDir = mkTmp();
        const a = (settings: string): string[] => [
            '--force', '--settings', settings, '--ts', '2026-05-05T05:05:05Z',
            '--task-id', 'forced', '--consulted', 'guidelines:g1',
        ];
        const pyLog = path.join(pyDir, 'eng.jsonl');
        const tsLog = path.join(tsDir, 'eng.jsonl');
        const py = run('python3', PY_SCRIPT, a(settingsFile(pyDir, false)), pyLog);
        const ts = run(TSX_BIN, TS_SCRIPT, a(settingsFile(tsDir, false)), tsLog);
        expect(ts.status).toBe(py.status);
        expect(ts.log).toBe(py.log);
    });

    it('JSON payload via --stdin → byte-identical JSONL line', () => {
        const pyDir = mkTmp();
        const tsDir = mkTmp();
        const payload = '{"task_id":"p1","boundary_kind":"phase-step","consulted":{"rules":["r1","r2"]},"applied":{"rules":["r1"]},"ts":"2026-03-03T03:03:03Z"}';
        const pyLog = path.join(pyDir, 'eng.jsonl');
        const tsLog = path.join(tsDir, 'eng.jsonl');
        const pyR = spawnSync('python3', [PY_SCRIPT, '--settings', settingsFile(pyDir, true), '--stdin'], { cwd: REPO_ROOT, encoding: 'utf8', input: payload });
        const tsR = spawnSync(TSX_BIN, [TS_SCRIPT, '--settings', settingsFile(tsDir, true), '--stdin'], { cwd: REPO_ROOT, encoding: 'utf8', input: payload });
        expect(tsR.status).toBe(pyR.status);
        expect(tsR.stderr).toBe(pyR.stderr);
        expect(fs.readFileSync(tsLog, 'utf8')).toBe(fs.readFileSync(pyLog, 'utf8'));
    });

    it('bad artefact kind → byte-identical schema error + exit 1', () => {
        const dir = mkTmp();
        const settings = settingsFile(dir, true);
        const logPath = path.join(dir, 'eng.jsonl');
        const args = ['--settings', settings, '--task-id', 't', '--consulted', 'badkind:x'];
        const py = run('python3', PY_SCRIPT, args, logPath);
        const ts = run(TSX_BIN, TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(1);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('redaction floor (slash in id) → byte-identical error + exit 1', () => {
        const dir = mkTmp();
        const settings = settingsFile(dir, true);
        const logPath = path.join(dir, 'eng.jsonl');
        const args = ['--settings', settings, '--task-id', 't', '--consulted', 'skills:a/b'];
        const py = run('python3', PY_SCRIPT, args, logPath);
        const ts = run(TSX_BIN, TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(1);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('--consulted without a colon → byte-identical error + exit 1', () => {
        const dir = mkTmp();
        const settings = settingsFile(dir, true);
        const logPath = path.join(dir, 'eng.jsonl');
        const args = ['--settings', settings, '--task-id', 't', '--consulted', 'noColonHere'];
        const py = run('python3', PY_SCRIPT, args, logPath);
        const ts = run(TSX_BIN, TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(1);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('missing --task-id with no payload → byte-identical error + exit 1', () => {
        const dir = mkTmp();
        const settings = settingsFile(dir, true);
        const logPath = path.join(dir, 'eng.jsonl');
        const args = ['--settings', settings];
        const py = run('python3', PY_SCRIPT, args, logPath);
        const ts = run(TSX_BIN, TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(1);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('duplicate outcome → byte-identical schema error + exit 1', () => {
        const dir = mkTmp();
        const settings = settingsFile(dir, true);
        const logPath = path.join(dir, 'eng.jsonl');
        const args = ['--settings', settings, '--task-id', 't', '--consulted', 'skills:x', '--outcome', 'blocked', '--outcome', 'blocked'];
        const py = run('python3', PY_SCRIPT, args, logPath);
        const ts = run(TSX_BIN, TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(1);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('invalid --boundary choice → exit 2 on both (usage text not compared)', () => {
        const dir = mkTmp();
        const settings = settingsFile(dir, true);
        const logPath = path.join(dir, 'eng.jsonl');
        const args = ['--settings', settings, '--task-id', 't', '--boundary', 'bogus'];
        const py = run('python3', PY_SCRIPT, args, logPath);
        const ts = run(TSX_BIN, TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
    });
});
