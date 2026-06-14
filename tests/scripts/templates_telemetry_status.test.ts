// Tests for src/agent-src/templates/scripts/telemetry_status.ts (ADR-094).
//
// Template-only entry point over the telemetry/ package. Golden-parity:
// python3 vs tsx on tmp fixtures, byte-identical stdout / stderr / exit for
// text and JSON formats. The log path embedded in the output is pinned to an
// absolute tmp path passed via the settings file, so it normalises naturally
// (both interpreters read the same fixed path). argparse --help not compared.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const S = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const TS_SCRIPT = path.join(S, 'telemetry_status.ts');
const PY_SCRIPT = path.join(S, 'telemetry_status.py');
const TSX_BIN = process.env.TSX_BIN
    ? path.resolve(REPO_ROOT, process.env.TSX_BIN)
    : path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tele-stat-'));
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

interface Run {
    status: number | null;
    stdout: string;
    stderr: string;
}

function run(bin: string, script: string, args: string[]): Run {
    const r = spawnSync(bin, [script, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function assertParity(args: string[]): void {
    const py = run('python3', PY_SCRIPT, args);
    const ts = run(TSX_BIN, TS_SCRIPT, args);
    expect(ts.status).toBe(py.status);
    expect(ts.stdout).toBe(py.stdout);
    expect(ts.stderr).toBe(py.stderr);
}

describe.runIf(hasPython3())('telemetry_status — golden parity (python3 vs tsx)', () => {
    it('no settings section → disabled-with-defaults note (text + json)', () => {
        const dir = mkTmp();
        const settings = path.join(dir, 'settings.yml');
        fs.writeFileSync(settings, 'other: {}\n');
        assertParity(['--settings', settings]);
        assertParity(['--settings', settings, '--format', 'json']);
    });

    it('enabled, log not yet created → "not yet created" / exists:false', () => {
        const dir = mkTmp();
        const settings = path.join(dir, 'settings.yml');
        const logPath = path.join(dir, 'eng.jsonl');
        fs.writeFileSync(
            settings,
            `telemetry:\n  artifact_engagement:\n    enabled: true\n    granularity: phase-step\n    output:\n      path: ${logPath}\n`,
        );
        assertParity(['--settings', settings]);
        assertParity(['--settings', settings, '--format', 'json']);
    });

    it('enabled with a populated log → size + line_count + last_event_ts', () => {
        const dir = mkTmp();
        const settings = path.join(dir, 'settings.yml');
        const logPath = path.join(dir, 'eng.jsonl');
        fs.writeFileSync(
            settings,
            `telemetry:\n  artifact_engagement:\n    enabled: true\n    record:\n      consulted: false\n    output:\n      path: ${logPath}\n`,
        );
        const lines = [
            '{"schema_version":1,"ts":"2026-01-01T00:00:00Z","task_id":"a","boundary_kind":"task","consulted":{"skills":["x"]},"applied":{}}',
            '{"schema_version":1,"ts":"2026-02-02T02:02:02Z","task_id":"b","boundary_kind":"task","consulted":{"rules":["y"]},"applied":{"rules":["y"]}}',
            'malformed-tail-line-ignored',
        ];
        fs.writeFileSync(logPath, `${lines.join('\n')}\n`);
        assertParity(['--settings', settings]);
        assertParity(['--settings', settings, '--format', 'json']);
    });

    it('log with no trailing newline still counts the final line', () => {
        const dir = mkTmp();
        const settings = path.join(dir, 'settings.yml');
        const logPath = path.join(dir, 'eng.jsonl');
        fs.writeFileSync(
            settings,
            `telemetry:\n  artifact_engagement:\n    enabled: true\n    output:\n      path: ${logPath}\n`,
        );
        fs.writeFileSync(
            logPath,
            '{"schema_version":1,"ts":"2026-01-01T00:00:00Z","task_id":"a","boundary_kind":"task","consulted":{"skills":["x"]},"applied":{}}',
        );
        assertParity(['--settings', settings, '--format', 'json']);
    });

    it('invalid --format choice → exit 2 on both (usage text not compared)', () => {
        const dir = mkTmp();
        const settings = path.join(dir, 'settings.yml');
        fs.writeFileSync(settings, 'telemetry: {}\n');
        const args = ['--settings', settings, '--format', 'bogus'];
        const py = run('python3', PY_SCRIPT, args);
        const ts = run(TSX_BIN, TS_SCRIPT, args);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
    });
});
