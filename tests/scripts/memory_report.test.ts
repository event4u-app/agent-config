// Tests for src/scripts/memory_report.ts — quarterly + operational-store +
// role-mode sections.
//
// 1:1 port of tests/test_memory_report.py (pytest → vitest, ADR-094 parity
// contract). The pytest suite chdir's into tmp, monkeypatches MEMORY_ROOT /
// INTAKE_ROOT and `memory_status.status`; the TS twin uses process.chdir +
// the `_setMemoryRoot` / `_setIntakeRoot` seams + vi.spyOn on memory_status.
// A trailing golden-parity block runs the real CI invocation (engine.yml:
// `memory_report {{.CLI_ARGS}}`) under python3 vs tsx over a synthetic tree
// and asserts byte-identical stdout/stderr/exit, skipped without python3.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as memory_status from '../../src/scripts/memory_status.js';
import * as report from '../../src/scripts/memory_report.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'memory_report.ts');
const PY_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'memory_report.py');

function pythonAvailable(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
function pyyamlAvailable(): boolean {
    return spawnSync('python3', ['-c', 'import yaml'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = pythonAvailable();
const HAVE_PYYAML = HAVE_PYTHON && pyyamlAvailable();

let tmp: string;
let prevCwd: string;

beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'memrep-'));
    prevCwd = process.cwd();
    process.chdir(tmp);
    report._setMemoryRoot(join(tmp, 'agents', 'memory'));
    report._setIntakeRoot(join(tmp, 'agents', 'memory', 'intake'));
});
afterEach(() => {
    vi.restoreAllMocks();
    process.chdir(prevCwd);
    report._setMemoryRoot(join('agents', 'memory'));
    report._setIntakeRoot(join('agents', 'memory', 'intake'));
    rmSync(tmp, { recursive: true, force: true });
});

function stubStatus(fields: { status: string; backend: string; reason: string; cli_path: string }): void {
    vi.spyOn(memory_status, 'status').mockReturnValue(
        new memory_status.Result(
            fields.status as memory_status.Status,
            fields.backend,
            fields.reason,
            0,
            fields.cli_path,
        ),
    );
}

function writeCurated(mtype: string, hashName: string, entryYaml: string): void {
    const dir = join(tmp, 'agents', 'memory', mtype);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${hashName}.yml`), entryYaml, 'utf-8');
}

function writeIntakeSupersede(month: string, ts: string): void {
    const intake = join(tmp, 'agents', 'memory', 'intake');
    mkdirSync(intake, { recursive: true });
    writeFileSync(
        join(intake, `signals-${month}.jsonl`),
        `${JSON.stringify({ type: 'supersede', ts, old_id: 'x', new_id: 'y' })}\n`,
        'utf-8',
    );
}

function writeScanFile(rel: string, body: string): void {
    const target = join(tmp, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body, 'utf-8');
}

describe('memory_report.ts — _quarter_of via build_report quarterly', () => {
    // _quarter_of is private; covered through quarterly aggregation + the
    // golden-parity block. The four boundary dates are exercised here.
    it('groups dates correctly through accepted_by_quarter', () => {
        stubStatus({ status: 'absent', backend: 'file', reason: '', cli_path: '' });
        writeCurated('domain-invariants', 'a', 'id: a\ncreated: 2026-01-15\nrule: x\nstatus: active\n');
        writeCurated('domain-invariants', 'b', 'id: b\ncreated: 2026-04-01\nrule: y\nstatus: active\n');
        writeCurated('domain-invariants', 'c', 'id: c\ncreated: 2026-09-30\nrule: z\nstatus: active\n');
        writeCurated('domain-invariants', 'd', 'id: d\ncreated: 2026-12-31\nrule: w\nstatus: active\n');
        const r = report.build_report();
        expect((r.quarterly.accepted_by_quarter as Record<string, number>)).toEqual({
            '2026Q1': 1,
            '2026Q2': 1,
            '2026Q3': 1,
            '2026Q4': 1,
        });
    });
});

describe('memory_report.ts — build_report quarterly + operational', () => {
    it('accepted counted by created date', () => {
        stubStatus({ status: 'absent', backend: 'file', reason: '', cli_path: '' });
        writeCurated('domain-invariants', 'aaa', 'id: one\ncreated: 2026-01-10\nrule: x\nstatus: active\n');
        writeCurated('domain-invariants', 'bbb', 'id: two\ncreated: 2026-04-05\nrule: y\nstatus: active\n');
        const r = report.build_report();
        expect(r.quarterly.accepted_by_quarter).toEqual({ '2026Q1': 1, '2026Q2': 1 });
    });

    it('retired counted from supersede', () => {
        stubStatus({ status: 'absent', backend: 'file', reason: '', cli_path: '' });
        writeIntakeSupersede('2026-03', '2026-03-15T10:00:00+00:00');
        writeIntakeSupersede('2026-05', '2026-05-02T09:00:00+00:00');
        const r = report.build_report();
        expect(r.quarterly.retired_by_quarter).toEqual({ '2026Q1': 1, '2026Q2': 1 });
    });

    it('operational store null when backend absent', () => {
        stubStatus({ status: 'absent', backend: 'file', reason: 'not on PATH', cli_path: '' });
        const r = report.build_report();
        expect(r.operational_store).toBeNull();
    });

    it('operational store present returns stub', () => {
        stubStatus({ status: 'present', backend: 'agent-memory', reason: '', cli_path: '/usr/bin/am' });
        const r = report.build_report();
        expect(r.operational_store).not.toBeNull();
        expect((r.operational_store as { enabled: boolean }).enabled).toBe(true);
        expect('note' in (r.operational_store as unknown as Record<string, unknown>)).toBe(true);
    });
});

describe('memory_report.ts — _role_mode_stats', () => {
    it('counts known modes', () => {
        writeScanFile(
            'agents/sessions/s1.md',
            'Some text.\n\n<!-- role-mode: developer | contract: goal/plan -->\n',
        );
        writeScanFile(
            'agents/runtime/reports/r1.md',
            '<!-- role-mode: reviewer | contract: summary/risks -->\n' +
                '<!-- role-mode: reviewer | contract: summary/risks -->\n',
        );
        const stats = report._role_mode_stats();
        expect(stats.total_markers).toBe(3);
        expect(stats.files_scanned).toBe(2);
        expect(stats.by_mode).toEqual({ developer: 1, reviewer: 2 });
        expect(stats.unknown_modes).toEqual([]);
    });

    it('flags unknown mode', () => {
        writeScanFile('agents/handoffs/h1.md', '<!-- role-mode: saboteur | contract: x/y -->\n');
        const stats = report._role_mode_stats();
        expect(stats.by_mode).toEqual({ saboteur: 1 });
        expect(stats.unknown_modes).toEqual(['saboteur']);
    });

    it('empty when no dirs', () => {
        const stats = report._role_mode_stats();
        expect(stats.total_markers).toBe(0);
        expect(stats.files_scanned).toBe(0);
        expect(stats.by_mode).toEqual({});
    });

    it('build_report includes role modes', () => {
        stubStatus({ status: 'absent', backend: 'file', reason: '', cli_path: '' });
        writeScanFile('agents/learnings/l1.md', '<!-- role-mode: planner | contract: goal -->\n');
        const r = report.build_report();
        expect(r.role_modes.total_markers).toBe(1);
        expect(r.role_modes.by_mode).toEqual({ planner: 1 });
    });
});

// --- golden parity vs python3 --------------------------------------------
//
// Mirrors the real CI invocation `./scripts-run src/scripts/memory_report
// {{.CLI_ARGS}}` (taskfiles/engine.yml). Runs both implementations over an
// identical synthetic memory tree from the same cwd, with no agent-memory CLI
// on PATH (deterministic `absent` backend), and asserts byte-identical
// stdout/stderr/exit for both --format text and json.

describe.skipIf(!HAVE_PYYAML)('memory_report — golden parity', () => {
    let emptyPathDir: string;
    let work: string;

    beforeEach(() => {
        emptyPathDir = mkdtempSync(join(tmpdir(), 'memrep-path-'));
        const py = spawnSync('which', ['python3'], { encoding: 'utf8' }).stdout.trim();
        spawnSync('ln', ['-s', process.execPath, join(emptyPathDir, 'node')]);
        if (py) {
            spawnSync('ln', ['-s', py, join(emptyPathDir, 'python3')]);
        }
        // Build a synthetic memory tree under the chdir'd tmp root.
        const mem = join(tmp, 'agents', 'memory');
        const di = join(mem, 'domain-invariants');
        mkdirSync(di, { recursive: true });
        // Curated entries: one fresh, one overdue (last_validated far in past).
        writeFileSync(
            join(di, 'one.yml'),
            'id: one\ncreated: 2026-01-10\nlast_validated: 2020-01-01\nreview_after_days: 30\nrule: x\nstatus: active\n',
            'utf-8',
        );
        writeFileSync(
            join(di, 'two.yml'),
            'id: two\ncreated: 2026-04-05\nrule: y\nstatus: active\n',
            'utf-8',
        );
        const intake = join(mem, 'intake');
        mkdirSync(intake, { recursive: true });
        writeFileSync(
            join(intake, 'signals-2026-03.jsonl'),
            [
                JSON.stringify({ id: 's1', entry_type: 'ownership', path: 'app/A', body: 'b' }),
                JSON.stringify({ id: 's2', entry_type: 'historical-patterns', path: 'app/B', body: 'c' }),
                JSON.stringify({ type: 'supersede', ts: '2026-03-15T10:00:00+00:00', old_id: 'x', new_id: 'y' }),
            ].join('\n') + '\n',
            'utf-8',
        );
        // Role-mode markers.
        const sess = join(tmp, 'agents', 'sessions');
        mkdirSync(sess, { recursive: true });
        writeFileSync(join(sess, 's1.md'), '<!-- role-mode: developer | contract: goal/plan -->\n', 'utf-8');
        work = tmp;
    });
    afterEach(() => {
        rmSync(emptyPathDir, { recursive: true, force: true });
    });

    function bothRun(args: string[]): { ts: ReturnType<typeof spawnSync>; py: ReturnType<typeof spawnSync> } {
        const env = { HOME: process.env['HOME'] ?? '', PATH: emptyPathDir, AGENT_MEMORY_STATUS: '' };
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: work, encoding: 'utf8', env });
        const py = spawnSync('python3', [PY_SCRIPT, ...args], { cwd: work, encoding: 'utf8', env });
        return { ts, py };
    }

    it('text output parity (populated tree)', () => {
        const { ts, py } = bothRun([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('json output parity (populated tree)', () => {
        const { ts, py } = bothRun(['--format', 'json']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('bad --format choice parity', () => {
        const { ts, py } = bothRun(['--format', 'xml']);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
    });
});
