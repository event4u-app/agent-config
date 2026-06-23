
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as memory_status from '../../src/scripts/memory_status.js';
import * as report from '../../src/scripts/memory_report.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'memory_report.ts');

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

function stubStatus(fields: { status: string; backend: string; reason: string }): void {
    vi.spyOn(memory_status, 'status').mockReturnValue({
        status: fields.status,
        backend: fields.backend,
        reason: fields.reason,
        elapsed_ms: 0,
    });
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
        stubStatus({ status: 'absent', backend: 'file', reason: '' });
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

describe('memory_report.ts — build_report quarterly', () => {
    it('accepted counted by created date', () => {
        stubStatus({ status: 'absent', backend: 'file', reason: '' });
        writeCurated('domain-invariants', 'aaa', 'id: one\ncreated: 2026-01-10\nrule: x\nstatus: active\n');
        writeCurated('domain-invariants', 'bbb', 'id: two\ncreated: 2026-04-05\nrule: y\nstatus: active\n');
        const r = report.build_report();
        expect(r.quarterly.accepted_by_quarter).toEqual({ '2026Q1': 1, '2026Q2': 1 });
    });

    it('retired counted from supersede', () => {
        stubStatus({ status: 'absent', backend: 'file', reason: '' });
        writeIntakeSupersede('2026-03', '2026-03-15T10:00:00+00:00');
        writeIntakeSupersede('2026-05', '2026-05-02T09:00:00+00:00');
        const r = report.build_report();
        expect(r.quarterly.retired_by_quarter).toEqual({ '2026Q1': 1, '2026Q2': 1 });
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
        stubStatus({ status: 'absent', backend: 'file', reason: '' });
        writeScanFile('agents/learnings/l1.md', '<!-- role-mode: planner | contract: goal -->\n');
        const r = report.build_report();
        expect(r.role_modes.total_markers).toBe(1);
        expect(r.role_modes.by_mode).toEqual({ planner: 1 });
    });
});
