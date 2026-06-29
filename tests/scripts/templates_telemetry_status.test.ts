// Intent tests for src/agent-src/templates/scripts/telemetry_status.ts (ADR-094).
//
// Was a python3-vs-tsx byte-parity rig; the `.py` original is gone, so this now
// asserts the tsx template-script's own contract directly (text + json status
// for the disabled-defaults, enabled-not-created, populated, and
// no-trailing-newline paths, plus the bad --format exit-2 path). The status
// output embeds the absolute settings/log tmp path, so `norm()` collapses the
// per-run tmp dir to `<TMP>` (and the macOS `/private` realpath prefix) so the
// snapshots are stable on Linux CI. COLUMNS=200 keeps argparse usage stable.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const S = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const TS_SCRIPT = path.join(S, 'telemetry_status.ts');
const TSX_BIN = process.env.TSX_BIN
    ? path.resolve(REPO_ROOT, process.env.TSX_BIN)
    : path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

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

// Mask the per-run tmp dir → `<TMP>`, collapsing the macOS `/private` realpath
// prefix so snapshots match on Linux CI.
function norm(s: string, dir: string): string {
    let out = s.split(`/private${dir}`).join('<TMP>');
    out = out.split(dir).join('<TMP>');
    return out;
}

function runTs(dir: string, args: string[]): Run {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, COLUMNS: '200' },
    });
    return {
        status: r.status,
        stdout: norm(r.stdout ?? '', dir),
        stderr: norm(r.stderr ?? '', dir),
    };
}

describe('telemetry_status — template contract', () => {
    it('no settings section → disabled-with-defaults note (text)', () => {
        const dir = mkTmp();
        const settings = path.join(dir, 'settings.yml');
        fs.writeFileSync(settings, 'other: {}\n');
        expect(runTs(dir, ['--settings', settings])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "  artifact-engagement: ⛔  disabled (no telemetry section in .agent-settings.yml — using defaults)
            granularity:         task
            record:              consulted=True applied=True
            log path:            .agent-engagement.jsonl
            log:                 not yet created
          ",
          }
        `);
    });

    it('no settings section → disabled-with-defaults note (json)', () => {
        const dir = mkTmp();
        const settings = path.join(dir, 'settings.yml');
        fs.writeFileSync(settings, 'other: {}\n');
        expect(runTs(dir, ['--settings', settings, '--format', 'json'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{
            "enabled": false,
            "granularity": "task",
            "log": {
              "exists": false,
              "last_event_ts": null,
              "line_count": 0,
              "path": ".agent-engagement.jsonl",
              "size_bytes": 0
            },
            "record": {
              "applied": true,
              "consulted": true
            },
            "section_present": false
          }
          ",
          }
        `);
    });

    it('enabled, log not yet created → "not yet created" (text)', () => {
        const dir = mkTmp();
        const settings = path.join(dir, 'settings.yml');
        const logPath = path.join(dir, 'eng.jsonl');
        fs.writeFileSync(
            settings,
            `telemetry:\n  artifact_engagement:\n    enabled: true\n    granularity: phase-step\n    output:\n      path: ${logPath}\n`,
        );
        expect(runTs(dir, ['--settings', settings])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "  artifact-engagement: ✅  enabled
            granularity:         phase-step
            record:              consulted=True applied=True
            log path:            <TMP>/eng.jsonl
            log:                 not yet created
          ",
          }
        `);
    });

    it('enabled, log not yet created → exists:false (json)', () => {
        const dir = mkTmp();
        const settings = path.join(dir, 'settings.yml');
        const logPath = path.join(dir, 'eng.jsonl');
        fs.writeFileSync(
            settings,
            `telemetry:\n  artifact_engagement:\n    enabled: true\n    granularity: phase-step\n    output:\n      path: ${logPath}\n`,
        );
        expect(runTs(dir, ['--settings', settings, '--format', 'json'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{
            "enabled": true,
            "granularity": "phase-step",
            "log": {
              "exists": false,
              "last_event_ts": null,
              "line_count": 0,
              "path": "<TMP>/eng.jsonl",
              "size_bytes": 0
            },
            "record": {
              "applied": true,
              "consulted": true
            },
            "section_present": true
          }
          ",
          }
        `);
    });

    it('enabled with a populated log → size + line_count + last_event_ts (text)', () => {
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
        expect(runTs(dir, ['--settings', settings])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "  artifact-engagement: ✅  enabled
            granularity:         task
            record:              consulted=False applied=True
            log path:            <TMP>/eng.jsonl
            log size:            296 bytes (3 events)
            last event ts:       2026-02-02T02:02:02Z
          ",
          }
        `);
    });

    it('enabled with a populated log → size + line_count + last_event_ts (json)', () => {
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
        expect(runTs(dir, ['--settings', settings, '--format', 'json'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{
            "enabled": true,
            "granularity": "task",
            "log": {
              "exists": true,
              "last_event_ts": "2026-02-02T02:02:02Z",
              "line_count": 3,
              "path": "<TMP>/eng.jsonl",
              "size_bytes": 296
            },
            "record": {
              "applied": true,
              "consulted": false
            },
            "section_present": true
          }
          ",
          }
        `);
    });

    it('log with no trailing newline still counts the final line (json)', () => {
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
        expect(runTs(dir, ['--settings', settings, '--format', 'json'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{
            "enabled": true,
            "granularity": "task",
            "log": {
              "exists": true,
              "last_event_ts": "2026-01-01T00:00:00Z",
              "line_count": 1,
              "path": "<TMP>/eng.jsonl",
              "size_bytes": 127
            },
            "record": {
              "applied": true,
              "consulted": true
            },
            "section_present": true
          }
          ",
          }
        `);
    });

    it('invalid --format choice → exit 2', () => {
        const dir = mkTmp();
        const settings = path.join(dir, 'settings.yml');
        fs.writeFileSync(settings, 'telemetry: {}\n');
        const ts = runTs(dir, ['--settings', settings, '--format', 'bogus']);
        expect(ts.status).toBe(2);
        expect(ts.stderr).toMatchInlineSnapshot(`
          "error: argument --format: invalid choice: 'bogus' (choose from 'text', 'json')
          "
        `);
    });
});
