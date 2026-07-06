// Tests for src/scripts/extract_audit_patterns.ts (py2ts Phase 8 / Wave 8g).
//
// 1:1 port of tests/test_extract_audit_patterns.py — grouping, the work_id
// independence floor, supersede chains, forward-compat unknown schema, and
// the CLI surface (min-count gate, --json). Plus CLI intent tests asserting
// the tsx stdout/stderr/exit codes directly on a synthetic audit dir (fixed
// `ts` values → fully deterministic). All synthetic fixtures live in
// os.tmpdir(); the live repo is never mutated.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { mine } from '../../src/scripts/extract_audit_patterns.js';
import { runTs } from './_wave8g.js';

interface Line {
    id: string;
    work_id: string;
    phase?: string;
    outcome?: string;
    rules?: string[];
    ts?: string;
    type_?: string;
    supersedes?: string;
    schema_version?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function line(o: Line): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: Record<string, any> = {
        schema_version: o.schema_version ?? 1,
        id: o.id,
        ts: o.ts ?? '2026-05-11T12:00:00Z',
        work_id: o.work_id,
        phase: o.phase ?? 'verify',
        outcome: o.outcome ?? 'success',
        confidence_band: 'high',
        risk_class: 'low',
        memory: { asks: 0, hits: 0 },
        verify: { claims: 1, first_try_passes: 1 },
        rules_applied: o.rules ?? [],
        persona: null,
        input_kind: 'ticket',
        type: o.type_ ?? 'phase',
    };
    if (o.supersedes) {
        rec.supersedes = o.supersedes;
    }
    return rec;
}

const tmpDirs: string[] = [];
function writeAudit(lines: Array<Record<string, unknown>>, month = '2026-05'): string {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'eap8g-'));
    tmpDirs.push(base);
    const d = path.join(base, 'audit');
    fs.mkdirSync(d);
    fs.writeFileSync(path.join(d, `${month}.jsonl`), lines.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf-8');
    return d;
}

afterEach(() => {
    while (tmpDirs.length) {
        fs.rmSync(tmpDirs.pop() as string, { recursive: true, force: true });
    }
});

describe('extract_audit_patterns.mine — 1:1 port', () => {
    it('groups by phase/outcome/rules', () => {
        const auditDir = writeAudit([
            line({ id: 'A', work_id: 'w1', rules: ['r1', 'r2'] }),
            line({ id: 'B', work_id: 'w2', rules: ['r2', 'r1'] }), // same after sort
            line({ id: 'C', work_id: 'w3', rules: ['r1'] }), // different group
        ]);
        const patterns = mine(auditDir, null, 2);
        expect(patterns.length).toBe(1);
        const p = patterns[0]!;
        expect(p.count).toBe(2);
        expect([...(p.line_ids as string[])].sort()).toEqual(['A', 'B']);
        expect(p.rules_applied).toEqual(['r1', 'r2']);
    });

    it('independence floor — same work_id counts once', () => {
        const auditDir = writeAudit([
            line({ id: 'A', work_id: 'w1' }),
            line({ id: 'B', work_id: 'w1' }),
        ]);
        expect(mine(auditDir, null, 2)).toEqual([]);
    });

    it('supersede chain drops prior', () => {
        const auditDir = writeAudit([
            line({ id: 'A', work_id: 'w1' }),
            line({ id: 'B', work_id: 'w2' }),
            line({ id: 'C', work_id: 'w3', type_: 'supersede', supersedes: 'B' }),
        ]);
        expect(mine(auditDir, null, 2)).toEqual([]);
    });

    it('unknown schema version is skipped', () => {
        const auditDir = writeAudit([
            line({ id: 'A', work_id: 'w1' }),
            line({ id: 'B', work_id: 'w2', schema_version: 99 }),
        ]);
        expect(mine(auditDir, null, 2)).toEqual([]);
    });

    it('malformed json lines are skipped', () => {
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'eap8g-'));
        tmpDirs.push(base);
        const auditDir = path.join(base, 'audit');
        fs.mkdirSync(auditDir);
        const good = line({ id: 'A', work_id: 'w1' });
        const good2 = line({ id: 'B', work_id: 'w2' });
        fs.writeFileSync(
            path.join(auditDir, '2026-05.jsonl'),
            JSON.stringify(good) + '\n' + '{not json\n' + '\n' + JSON.stringify(good2) + '\n',
            'utf-8',
        );
        const patterns = mine(auditDir, null, 2);
        expect(patterns.length).toBe(1);
        expect(patterns[0]!.count).toBe(2);
    });

    it('missing audit dir yields empty', () => {
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'eap8g-'));
        tmpDirs.push(base);
        expect(mine(path.join(base, 'nope'), null, 2)).toEqual([]);
    });
});

describe('extract_audit_patterns — CLI (tsx)', () => {
    function fixtureDir(): string {
        return writeAudit([
            line({ id: 'A', work_id: 'w1', ts: '2026-05-01T00:00:00Z', rules: ['r1', 'r2'] }),
            line({ id: 'B', work_id: 'w2', ts: '2026-05-02T00:00:00Z', rules: ['r2', 'r1'] }),
            line({ id: 'C', work_id: 'w3', ts: '2026-05-03T00:00:00Z', phase: 'apply', rules: ['r1'] }),
            line({ id: 'D', work_id: 'w4', ts: '2026-05-04T00:00:00Z', phase: 'apply', rules: ['r1'] }),
        ]);
    }

    it('--json emits the mined patterns sorted (-count, summary)', () => {
        const d = fixtureDir();
        const r = runTs('extract_audit_patterns', ['--audit-dir', d, '--json']);
        expect(r.status).toBe(0);
        expect(r.stderr).toBe('');
        expect(JSON.parse(r.stdout)).toEqual([
            {
                count: 2,
                first_seen: '2026-05-03T00:00:00Z',
                last_seen: '2026-05-04T00:00:00Z',
                line_ids: ['C', 'D'],
                outcome: 'success',
                phase: 'apply',
                rules_applied: ['r1'],
                summary: 'apply:success:r1',
                work_ids: ['w3', 'w4'],
            },
            {
                count: 2,
                first_seen: '2026-05-01T00:00:00Z',
                last_seen: '2026-05-02T00:00:00Z',
                line_ids: ['A', 'B'],
                outcome: 'success',
                phase: 'verify',
                rules_applied: ['r1', 'r2'],
                summary: 'verify:success:r1+r2',
                work_ids: ['w1', 'w2'],
            },
        ]);
    });

    it('text table renders header + one row per pattern', () => {
        const d = fixtureDir();
        const r = runTs('extract_audit_patterns', ['--audit-dir', d]);
        expect(r.status).toBe(0);
        const lines = r.stdout.trimEnd().split('\n');
        expect(lines[0]).toMatch(/^count\s+phase\s+outcome\s+rules\s+summary$/);
        expect(lines).toHaveLength(4); // header + separator + 2 patterns
        expect(lines[2]).toMatch(/^\s+2\s+apply\s+success\s+r1\s+apply:success:r1$/);
        expect(lines[3]).toMatch(/^\s+2\s+verify\s+success\s+r1,r2\s+verify:success:r1\+r2$/);
    });

    it('empty result prints the no-patterns placeholder, exit 0', () => {
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'eap8g-'));
        tmpDirs.push(base);
        const empty = path.join(base, 'nope');
        const r = runTs('extract_audit_patterns', ['--audit-dir', empty]);
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('(no patterns at or above the min-count threshold)\n');
    });

    it('--min-count below the independence floor: exit 2 + stderr message', () => {
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'eap8g-'));
        tmpDirs.push(base);
        const r = runTs('extract_audit_patterns', ['--audit-dir', base, '--min-count', '1']);
        expect(r.status).toBe(2);
        expect(r.stdout).toBe('');
        expect(r.stderr).toBe(
            '❌  --min-count must be >= 2 (independence floor per audit-log-v1 § Privacy floor).\n',
        );
    });
});
