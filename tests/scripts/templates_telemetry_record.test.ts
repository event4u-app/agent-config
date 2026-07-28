// Intent tests for src/agent-src/templates/scripts/telemetry_record.ts (ADR-094).
//
// Was a python3-vs-tsx byte-parity rig; the `.py` original is gone, so this now
// asserts the tsx template-script's own contract directly. The script is
// default-off (silent exit 0, zero file IO when disabled), validates the
// schema (exit 1), and rejects bad argparse choices (exit 2). Timestamps are
// pinned via --ts so the written JSONL line is deterministic; the no--ts path
// is not snapshotted (wall-clock token). The written log embeds NO tmp path
// (ids only), so no path masking is needed. Each case runs with COLUMNS=200 so
// any argparse usage text does not re-wrap to terminal width.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const S = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const TS_SCRIPT = path.join(S, 'telemetry_record.ts');
const TSX_BIN = process.env.TSX_BIN
    ? path.resolve(REPO_ROOT, process.env.TSX_BIN)
    : path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

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

function runTs(script: string, args: string[], logPath: string): Run {
    const r = spawnSync(TSX_BIN, [script, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, COLUMNS: '200' },
    });
    let log = ' MISSING ';
    try {
        log = fs.readFileSync(logPath, 'utf8');
    } catch {
        log = ' MISSING ';
    }
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', log };
}

describe('telemetry_record — template contract', () => {
    it('disabled (default) → silent exit 0 and zero file IO', () => {
        const dir = mkTmp();
        const settings = settingsFile(dir, false);
        const logPath = path.join(dir, 'eng.jsonl');
        const args = ['--settings', settings, '--task-id', 't', '--consulted', 'skills:x'];
        const ts = runTs(TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toBe('');
        expect(ts.stderr).toBe('');
        expect(fs.existsSync(logPath)).toBe(false);
    });

    it('enabled CLI args → canonical JSONL line', () => {
        const dir = mkTmp();
        const logPath = path.join(dir, 'eng.jsonl');
        const args = [
            '--settings', settingsFile(dir, true), '--ts', '2026-01-02T03:04:05Z',
            '--task-id', 'ticket-1', '--boundary', 'task',
            '--consulted', 'skills:php-coder', '--consulted', 'rules:scope-control',
            '--applied', 'skills:php-coder',
            '--outcome', 'verification_failed', '--outcome', 'stop_rule_triggered',
        ];
        const ts = runTs(TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(0);
        expect(ts.log).toMatchInlineSnapshot(`
          "{"applied":{"skills":["php-coder"]},"boundary_kind":"task","consulted":{"rules":["scope-control"],"skills":["php-coder"]},"outcomes":["verification_failed","stop_rule_triggered"],"schema_version":1,"task_id":"ticket-1","ts":"2026-01-02T03:04:05Z"}
          "
        `);
    });

    it('--force bypasses the disabled flag', () => {
        const dir = mkTmp();
        const logPath = path.join(dir, 'eng.jsonl');
        const args = [
            '--force', '--settings', settingsFile(dir, false), '--ts', '2026-05-05T05:05:05Z',
            '--task-id', 'forced', '--consulted', 'guidelines:g1',
        ];
        const ts = runTs(TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(0);
        expect(ts.log).toMatchInlineSnapshot(`
          "{"applied":{},"boundary_kind":"task","consulted":{"guidelines":["g1"]},"schema_version":1,"task_id":"forced","ts":"2026-05-05T05:05:05Z"}
          "
        `);
    });

    it('JSON payload via --stdin → canonical JSONL line', () => {
        const dir = mkTmp();
        const logPath = path.join(dir, 'eng.jsonl');
        const payload = '{"task_id":"p1","boundary_kind":"phase-step","consulted":{"rules":["r1","r2"]},"applied":{"rules":["r1"]},"ts":"2026-03-03T03:03:03Z"}';
        const r = spawnSync(TSX_BIN, [TS_SCRIPT, '--settings', settingsFile(dir, true), '--stdin'], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            input: payload,
            env: { ...process.env, COLUMNS: '200' },
        });
        expect(r.status).toBe(0);
        expect(fs.readFileSync(logPath, 'utf8')).toMatchInlineSnapshot(`
          "{"applied":{"rules":["r1"]},"boundary_kind":"phase-step","consulted":{"rules":["r1","r2"]},"schema_version":1,"task_id":"p1","ts":"2026-03-03T03:03:03Z"}
          "
        `);
    });

    it('bad artefact kind → schema error + exit 1', () => {
        const dir = mkTmp();
        const logPath = path.join(dir, 'eng.jsonl');
        const args = ['--settings', settingsFile(dir, true), '--task-id', 't', '--consulted', 'badkind:x'];
        const ts = runTs(TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(1);
        expect(ts.stderr).toMatchInlineSnapshot(`
          "❌  schema validation failed: consulted.'badkind' is not an allowed artefact kind (allowed: ('skills', 'rules', 'commands', 'guidelines', 'personas'))
          "
        `);
    });

    it('redaction floor (slash in id) → error + exit 1', () => {
        const dir = mkTmp();
        const logPath = path.join(dir, 'eng.jsonl');
        const args = ['--settings', settingsFile(dir, true), '--task-id', 't', '--consulted', 'skills:a/b'];
        const ts = runTs(TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(1);
        expect(ts.stderr).toMatchInlineSnapshot(`
          "❌  schema validation failed: consulted.skills contains forbidden character '/'; id fields must be repository-internal artefact ids only (no paths, no free-text)
          "
        `);
    });

    it('--consulted without a colon → error + exit 1', () => {
        const dir = mkTmp();
        const logPath = path.join(dir, 'eng.jsonl');
        const args = ['--settings', settingsFile(dir, true), '--task-id', 't', '--consulted', 'noColonHere'];
        const ts = runTs(TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(1);
        expect(ts.stderr).toMatchInlineSnapshot(`
          "❌  --consulted/--applied must be 'kind:id', got 'noColonHere'
          "
        `);
    });

    it('missing --task-id with no payload → error + exit 1', () => {
        const dir = mkTmp();
        const logPath = path.join(dir, 'eng.jsonl');
        const args = ['--settings', settingsFile(dir, true)];
        const ts = runTs(TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(1);
        expect(ts.stderr).toMatchInlineSnapshot(`
          "❌  --task-id required (or pass --payload-file/--stdin)
          "
        `);
    });

    it('duplicate outcome → schema error + exit 1', () => {
        const dir = mkTmp();
        const logPath = path.join(dir, 'eng.jsonl');
        const args = ['--settings', settingsFile(dir, true), '--task-id', 't', '--consulted', 'skills:x', '--outcome', 'blocked', '--outcome', 'blocked'];
        const ts = runTs(TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(1);
        expect(ts.stderr).toMatchInlineSnapshot(`
          "❌  schema validation failed: outcomes contains duplicate 'blocked'
          "
        `);
    });

    it('invalid --boundary choice → exit 2', () => {
        const dir = mkTmp();
        const logPath = path.join(dir, 'eng.jsonl');
        const args = ['--settings', settingsFile(dir, true), '--task-id', 't', '--boundary', 'bogus'];
        const ts = runTs(TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(2);
        expect(ts.stderr).toMatchInlineSnapshot(`
          "error: argument --boundary: invalid choice: 'bogus' (choose from 'task', 'phase-step', 'tool-call')
          "
        `);
    });

    // road-to-feedback-9.2.0-followups 1.4 — --cross-source facet.
    it('a simulated task with one real discrepancy records exactly one cross_source entry', () => {
        const dir = mkTmp();
        const logPath = path.join(dir, 'eng.jsonl');
        const args = [
            '--settings', settingsFile(dir, true), '--ts', '2026-07-28T00:00:00Z',
            '--task-id', 'task-with-discrepancy', '--consulted', 'rules:cross-source-consistency',
            '--cross-source', 'd1:text-image:ask',
        ];
        const ts = runTs(TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(0);
        expect(ts.log).toMatchInlineSnapshot(`
          "{"applied":{},"boundary_kind":"task","consulted":{"rules":["cross-source-consistency"]},"cross_source":[{"asked":true,"id":"d1","type":"text-image"}],"schema_version":1,"task_id":"task-with-discrepancy","ts":"2026-07-28T00:00:00Z"}
          "
        `);
    });

    it('a consistent-sources task (no --cross-source) records zero — no cross_source field written', () => {
        const dir = mkTmp();
        const logPath = path.join(dir, 'eng.jsonl');
        const args = [
            '--settings', settingsFile(dir, true), '--ts', '2026-07-28T00:00:00Z',
            '--task-id', 'consistent-task', '--consulted', 'rules:cross-source-consistency',
        ];
        const ts = runTs(TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(0);
        expect(ts.log).not.toContain('cross_source');
        expect(ts.log).toMatchInlineSnapshot(`
          "{"applied":{},"boundary_kind":"task","consulted":{"rules":["cross-source-consistency"]},"schema_version":1,"task_id":"consistent-task","ts":"2026-07-28T00:00:00Z"}
          "
        `);
    });

    it('--cross-source with a warn verdict records asked:false', () => {
        const dir = mkTmp();
        const logPath = path.join(dir, 'eng.jsonl');
        const args = [
            '--settings', settingsFile(dir, true), '--ts', '2026-07-28T00:00:00Z',
            '--task-id', 't', '--cross-source', 'd2:silent-needed:warn',
        ];
        const ts = runTs(TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(0);
        expect(ts.log).toContain('"cross_source":[{"asked":false,"id":"d2","type":"silent-needed"}]');
    });

    it('malformed --cross-source (missing parts) → error + exit 1', () => {
        const dir = mkTmp();
        const logPath = path.join(dir, 'eng.jsonl');
        const args = ['--settings', settingsFile(dir, true), '--task-id', 't', '--cross-source', 'd1:text-image'];
        const ts = runTs(TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(1);
        expect(ts.stderr).toMatchInlineSnapshot(`
          "❌  --cross-source must be 'id:type:ask|warn', got 'd1:text-image'
          "
        `);
    });

    it('--cross-source with a bogus verdict → error + exit 1', () => {
        const dir = mkTmp();
        const logPath = path.join(dir, 'eng.jsonl');
        const args = ['--settings', settingsFile(dir, true), '--task-id', 't', '--cross-source', 'd1:text-image:maybe'];
        const ts = runTs(TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(1);
        expect(ts.stderr).toMatchInlineSnapshot(`
          "❌  --cross-source verdict must be 'ask' or 'warn', got 'maybe'
          "
        `);
    });

    it('--cross-source with an unknown discrepancy type → schema error + exit 1', () => {
        const dir = mkTmp();
        const logPath = path.join(dir, 'eng.jsonl');
        const args = ['--settings', settingsFile(dir, true), '--task-id', 't', '--cross-source', 'd1:bogus-type:ask'];
        const ts = runTs(TS_SCRIPT, args, logPath);
        expect(ts.status).toBe(1);
        expect(ts.stderr).toMatchInlineSnapshot(`
          "❌  schema validation failed: cross_source.type must be one of ('text-image', 'silent-needed', 'spec-code', 'intra-ticket'), got 'bogus-type'
          "
        `);
    });
});
