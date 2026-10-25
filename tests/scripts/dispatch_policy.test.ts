/**
 * The dispatch-policy table binds every dispatch default to its sinks
 * (road-to-a-policy-the-measurements-write 1.2).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    checkPolicy,
    claimStatuses,
    loadPolicy,
    readSink,
    type PolicyRow,
    type PolicyTable,
} from '../../src/scripts/_lib/dispatch_policy.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LEDGER = fs.readFileSync(path.join(ROOT, 'docs', 'CLAIMS.md'), 'utf8');

function check(table: PolicyTable, sinks: Record<string, unknown> = {}): string[] {
    return checkPolicy(table, {
        readSink: (row) => (row.id in sinks ? sinks[row.id] : row.value),
        claimStatus: (id) => claimStatuses(LEDGER).get(id),
    });
}

function row(over: Partial<PolicyRow> = {}): PolicyRow {
    return {
        id: 'fixture-row',
        value: 'inherit',
        sink: { kind: 'subagent-frontmatter', file: 'src/subagents/ac-worker.md', key: 'model_tier' },
        claim: 'unmeasured',
        review_by: '2026-12-15',
        local: 'learnable',
        ...over,
    };
}

describe('dispatch-policy table', () => {
    it('every sink in the tree agrees with its row', () => {
        const table = loadPolicy(ROOT);
        const findings = checkPolicy(table, {
            readSink: (r) => readSink(ROOT, r.sink),
            claimStatus: (id) => claimStatuses(LEDGER).get(id),
        });
        expect(findings).toEqual([]);
    });

    it('seeds every dispatch knob the roadmap names', () => {
        const ids = loadPolicy(ROOT).rows.map((r) => r.id);
        for (const id of [
            'ac-worker-tier',
            'ac-researcher-tier',
            'ac-worker-instruction-skip',
            'ac-researcher-instruction-skip',
            'max-parallel',
            'adversarial-council',
            'council-min-rounds',
            'council-deep-min-rounds',
        ]) {
            expect(ids).toContain(id);
        }
    });

    it('reads each sink kind from the tree', () => {
        expect(readSink(ROOT, { kind: 'settings-template', file: 'src/config/agent-settings.template.yml', key: 'subagents.adversarial_council' })).toBe('off');
        expect(readSink(ROOT, { kind: 'council-default', file: 'src/scripts/ai_council/config.ts', key: 'min_rounds' })).toBe(2);
        expect(readSink(ROOT, { kind: 'subagent-frontmatter', file: 'src/subagents/ac-worker.md', key: 'omit_project_instructions' })).toBe(true);
    });

    it('reds a sink that disagrees with its row', () => {
        expect(check({ rows: [row()] }, { 'fixture-row': 'lite' })).toEqual([
            expect.stringContaining('fixture-row'),
        ]);
    });

    it('reds a forbidden value on a floor row', () => {
        const floor = row({ local: 'fixed', floor: true, forbid: ['lite'], value: 'lite' });
        expect(check({ rows: [floor] }).join('\n')).toContain('forbidden');
    });

    it('reds a floor that is learnable', () => {
        expect(check({ rows: [row({ floor: true, local: 'learnable' })] }).join('\n')).toContain('floor');
    });

    it('reds an unmeasured row without a valid review_by', () => {
        expect(check({ rows: [row({ review_by: undefined })] }).join('\n')).toContain('review_by');
        expect(check({ rows: [row({ review_by: '15.12.2026' })] }).join('\n')).toContain('review_by');
    });

    it('reds a row whose claim is open or missing', () => {
        expect(check({ rows: [row({ claim: 'council-vs-solo-baseline', review_by: undefined })] }).join('\n')).toContain('unbacked');
        expect(check({ rows: [row({ claim: 'no-such-claim', review_by: undefined })] }).join('\n')).toContain('no-such-claim');
    });

    it('reds a measures pointer at a claim that does not exist', () => {
        expect(check({ rows: [row({ measures: 'no-such-claim' })] }).join('\n')).toContain('no-such-claim');
    });

    it('reds an unknown sink kind and a duplicate id', () => {
        const odd = row({ sink: { kind: 'prose' as never, file: 'x', key: 'y' } });
        expect(check({ rows: [odd] }).join('\n')).toContain('sink kind');
        expect(check({ rows: [row(), row()] }).join('\n')).toContain('duplicate');
    });
});
