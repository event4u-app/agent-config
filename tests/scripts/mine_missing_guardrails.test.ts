// Tests for src/scripts/mine_missing_guardrails.ts (memory/knowledge
// validation Phase 0-pre).
//
// Contract under test: audit-log-v1 record filtering, the candidate signal
// (absence co-occurs with failure across ≥2 distinct work_ids AND the rule is
// success-associated), ordering, empty-log exit 0, JSON envelope with the
// mandatory confounding caveat (never auto-promote).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { loadRecords, mineCandidates } from '../../src/scripts/mine_missing_guardrails.js';
import { runTs } from './_wave8g.js';

const tmp: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mine-guardrails-'));
    tmp.push(d);
    return d;
}
afterEach(() => {
    while (tmp.length) {
        fs.rmSync(tmp.pop() as string, { recursive: true, force: true });
    }
});

interface RecOpts {
    phase?: string;
    outcome?: string;
    rules?: string[];
    workId?: string;
    type?: string;
    schema?: number;
}
function rec({ phase = 'implement', outcome = 'success', rules = [], workId = 'w1', type = 'phase', schema = 1 }: RecOpts): string {
    return JSON.stringify({ schema_version: schema, type, phase, outcome, rules_applied: rules, work_id: workId });
}

function writeAudit(dir: string, lines: string[], file = '2026-07.jsonl'): void {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, file), lines.join('\n') + '\n', 'utf-8');
}

describe('mine_missing_guardrails — loadRecords', () => {
    it('missing dir → empty, not an error', () => {
        expect(loadRecords(path.join(mkTmp(), 'nope'))).toEqual([]);
    });

    it('filters wrong schema, supersede/note types, malformed lines', () => {
        const dir = mkTmp();
        writeAudit(dir, [
            rec({ rules: ['r1'] }),
            rec({ schema: 2, rules: ['r1'] }),
            rec({ type: 'supersede', rules: ['r1'] }),
            rec({ type: 'note', rules: ['r1'] }),
            'not-json{{{',
            JSON.stringify({ schema_version: 1, type: 'phase', phase: 'p' }), // no outcome/rules
        ]);
        expect(loadRecords(dir)).toHaveLength(1);
    });

    it('--month selects a single file', () => {
        const dir = mkTmp();
        writeAudit(dir, [rec({ workId: 'a' })], '2026-06.jsonl');
        writeAudit(dir, [rec({ workId: 'b' }), rec({ workId: 'c' })], '2026-07.jsonl');
        expect(loadRecords(dir, '2026-06')).toHaveLength(1);
        expect(loadRecords(dir)).toHaveLength(3);
    });
});

describe('mine_missing_guardrails — candidate signal', () => {
    const base = [
        // rule 'guard' is success-associated in phase 'implement'
        rec({ rules: ['guard'], outcome: 'success', workId: 's1' }),
        // two DISTINCT failing runs without the rule
        rec({ rules: [], outcome: 'blocked', workId: 'f1' }),
        rec({ rules: [], outcome: 'error', workId: 'f2' }),
    ];

    it('fires on ≥2 distinct failing work_ids + success-with-rule ≥ 1', () => {
        const records = loadRecords(seed(base));
        const cands = mineCandidates(records, 2);
        expect(cands).toHaveLength(1);
        expect(cands[0]).toMatchObject({
            phase: 'implement',
            rule: 'guard',
            success_with_rule: 1,
            failure_without_rule: 2,
            failure_work_ids: ['f1', 'f2'],
        });
    });

    it('does NOT fire when failures share one work_id (not independent runs)', () => {
        const records = loadRecords(
            seed([
                rec({ rules: ['guard'], outcome: 'success', workId: 's1' }),
                rec({ rules: [], outcome: 'blocked', workId: 'f1' }),
                rec({ rules: [], outcome: 'error', workId: 'f1' }),
            ]),
        );
        expect(mineCandidates(records, 2)).toHaveLength(0);
    });

    it('does NOT fire for a rule with zero successes in the phase', () => {
        const records = loadRecords(
            seed([
                rec({ rules: ['guard'], outcome: 'blocked', workId: 's1' }),
                rec({ rules: [], outcome: 'blocked', workId: 'f1' }),
                rec({ rules: [], outcome: 'error', workId: 'f2' }),
            ]),
        );
        expect(mineCandidates(records, 2)).toHaveLength(0);
    });

    it('respects --min-count above the built-in ≥2 floor', () => {
        const records = loadRecords(seed(base));
        expect(mineCandidates(records, 3)).toHaveLength(0);
    });

    it('sorts strongest signal first (most distinct failing runs)', () => {
        const records = loadRecords(
            seed([
                rec({ rules: ['a'], outcome: 'success', workId: 's1' }),
                rec({ rules: ['b'], outcome: 'success', workId: 's2' }),
                rec({ rules: ['b'], outcome: 'blocked', workId: 'f1' }), // fails WITH a absent
                rec({ rules: [], outcome: 'blocked', workId: 'f2' }),
                rec({ rules: [], outcome: 'blocked', workId: 'f3' }),
            ]),
        );
        const cands = mineCandidates(records, 2);
        expect(cands.map((c) => c.rule)).toEqual(['a', 'b']);
        expect(cands[0]?.failure_without_rule).toBe(3);
        expect(cands[1]?.failure_without_rule).toBe(2);
    });

    function seed(lines: string[]): string {
        const dir = mkTmp();
        writeAudit(dir, lines);
        return dir;
    }
});

describe('mine_missing_guardrails — CLI contract', () => {
    it('empty audit log exits 0 with nothing-to-mine', () => {
        const r = runTs('mine_missing_guardrails', ['--audit-dir', mkTmp()]);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('nothing to mine');
    });

    it('--json envelope carries records, candidates, and the confounding caveat', () => {
        const dir = mkTmp();
        writeAudit(dir, [
            rec({ rules: ['guard'], outcome: 'success', workId: 's1' }),
            rec({ rules: [], outcome: 'blocked', workId: 'f1' }),
            rec({ rules: [], outcome: 'error', workId: 'f2' }),
        ]);
        const r = runTs('mine_missing_guardrails', ['--audit-dir', dir, '--json']);
        expect(r.status).toBe(0);
        const report = JSON.parse(r.stdout);
        expect(report.records).toBe(3);
        expect(report.candidates).toHaveLength(1);
        expect(report.confounding).toContain('NOT causation');
        expect(report.confounding).toContain('Never auto-add');
    });

    it('text output surfaces the human-promotion caveat', () => {
        const dir = mkTmp();
        writeAudit(dir, [
            rec({ rules: ['guard'], outcome: 'success', workId: 's1' }),
            rec({ rules: [], outcome: 'blocked', workId: 'f1' }),
            rec({ rules: [], outcome: 'error', workId: 'f2' }),
        ]);
        const r = runTs('mine_missing_guardrails', ['--audit-dir', dir]);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain("rule 'guard'");
        expect(r.stdout).toContain('Correlation, NOT causation');
    });
});
