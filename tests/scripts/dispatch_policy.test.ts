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
    claimRecords,
    claimStatuses,
    loadPolicy,
    overdueRows,
    policyDelta,
    readSink,
    renderMeasuredSection,
    type PolicyRow,
    type PolicyTable,
} from '../../src/scripts/_lib/dispatch_policy.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LEDGER = fs.readFileSync(path.join(ROOT, 'docs', 'CLAIMS.md'), 'utf8');

/** `sinks` overrides by sink file first, then by row id; everything else agrees. */
function check(table: PolicyTable, sinks: Record<string, unknown> = {}): string[] {
    return checkPolicy(table, {
        readSink: (row, sink) => (sink.file in sinks ? sinks[sink.file] : row.id in sinks ? sinks[row.id] : row.value),
        claimStatus: (id) => claimStatuses(LEDGER).get(id),
        claimReviewBy: (id) => claimRecords(LEDGER).get(id)?.review_by,
    });
}

/** A fixture row; an override set to `undefined` drops that field. */
function row(over: { [K in keyof PolicyRow]?: PolicyRow[K] | undefined } = {}): PolicyRow {
    const out: Record<string, unknown> = {
        id: 'fixture-row',
        value: 'inherit',
        sink: { kind: 'subagent-frontmatter', file: 'src/subagents/ac-worker.md', key: 'model_tier' },
        claim: 'unmeasured',
        review_by: '2026-12-15',
        local: 'learnable',
        ...over,
    };
    for (const k of Object.keys(out)) {
        if (out[k] === undefined) delete out[k];
    }
    return out as unknown as PolicyRow;
}

describe('dispatch-policy table', () => {
    it('every sink in the tree agrees with its row', () => {
        const table = loadPolicy(ROOT);
        const findings = checkPolicy(table, {
            readSink: (_r, sink) => readSink(ROOT, sink),
            claimStatus: (id) => claimStatuses(LEDGER).get(id),
            claimReviewBy: (id) => claimRecords(LEDGER).get(id)?.review_by,
        });
        expect(findings).toEqual([]);
    });

    it('checks the council example a consumer config is copied from', () => {
        const rounds = loadPolicy(ROOT).rows.find((r) => r.id === 'council-min-rounds')!;
        expect(rounds.also?.map((s) => s.file)).toContain('agents/templates/.ai-council.yml.example');
        expect(check({ rows: [rounds] }, { 'agents/templates/.ai-council.yml.example': 1 }).join('\n')).toContain(
            '.ai-council.yml.example defaults.min_rounds is 1',
        );
    });

    it('reds a row whose review_by disagrees with the claim it measures', () => {
        const findings = check({ rows: [row({ measures: 'tier-downshift-quality-held', review_by: '2027-06-01' })] });
        expect(findings.join('\n')).toContain('disagrees with claim `tier-downshift-quality-held`');
    });

    it('stops reading a claim at the next heading', () => {
        const ledger = '### claim: a\n- claim: x\n\n## Other\n- status: backed\n';
        expect(claimRecords(ledger).get('a')).toEqual({ status: '', review_by: '' });
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
        expect(readSink(ROOT, { kind: 'yaml-file', file: 'src/config/agent-settings.template.yml', key: 'subagents.adversarial_council' })).toBe('off');
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

describe('measured-in-this-release section', () => {
    const before: PolicyTable = {
        rows: [
            row({ id: 'tier', value: 'inherit' }),
            row({ id: 'parallel', value: 3, review_by: '2026-01-01' }),
        ],
    };

    it('lists a moved row and an overdue row', () => {
        const after: PolicyTable = {
            rows: [
                row({ id: 'tier', value: 'lite', claim: 'tier-downshift-quality-held', review_by: undefined }),
                row({ id: 'parallel', value: 3, review_by: '2026-01-01' }),
            ],
        };
        const lines = renderMeasuredSection(policyDelta(before, after), overdueRows(after, '2026-10-25'));
        const text = lines.join('\n');
        expect(lines[0]).toBe('### Measured in this release');
        expect(text).toContain('`tier`: "inherit" → "lite" (claim `tier-downshift-quality-held`)');
        expect(text).toContain('Overdue');
        expect(text).toContain('`parallel` — unmeasured, review_by 2026-01-01');
    });

    it('renders nothing for an unchanged table whose dates lie ahead', () => {
        const dated: PolicyTable = { rows: [row({ id: 'tier' })] };
        expect(renderMeasuredSection(policyDelta(dated, dated), overdueRows(dated, '2026-10-25'))).toEqual([]);
    });

    it('names added and removed rows, and a first table as one line', () => {
        const added = policyDelta({ rows: [] }, before);
        expect(added.map((d) => d.kind)).toEqual(['added', 'added']);
        expect(policyDelta(before, { rows: [] }).map((d) => d.kind)).toEqual(['removed', 'removed']);
        expect(renderMeasuredSection(policyDelta(null, before), [], before).join('\n')).toContain(
            'dispatch-policy table introduced with 2 row(s)',
        );
    });
});

describe('constraint changes', () => {
    it('reports a floor that loses its forbid list even when the value holds', () => {
        const before: PolicyTable = { rows: [row({ id: 'floor', local: 'fixed', floor: true, forbid: ['lite'] })] };
        const after: PolicyTable = { rows: [row({ id: 'floor', local: 'fixed', floor: true })] };
        const delta = policyDelta(before, after);
        expect(delta.map((d) => d.kind)).toEqual(['constrained']);
        expect(renderMeasuredSection(delta, []).join('\n')).toContain('`floor` constraints changed');
    });
});
