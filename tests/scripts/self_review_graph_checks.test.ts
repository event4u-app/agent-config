/**
 * The code graph's review checks reach the self-review gate as advisory
 * findings in the review-findings shape, each pinned by a typed exhibit.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import { graphCheckFindings } from '../../src/scripts/_lib/graph_check_findings.js';
import { wellFormedExhibit } from '../../src/scripts/_lib/finding_exhibits.js';
import type { ReviewCheck } from '../../src/scripts/code_graph/review_risk.js';
import { classifyBlocking, findingId } from '../../src/scripts/self_review_gate.js';

const SCHEMA = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/scripts/schemas/review-findings.schema.json'), 'utf-8')) as {
    properties: { findings: { items: { required: string[]; properties: Record<string, { enum?: string[] }> } } };
};

describe('graph checks as self-review findings', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-checks-'));
    fs.mkdirSync(path.join(root, 'app'), { recursive: true });
    fs.writeFileSync(path.join(root, 'app/a.ts'), 'export function lonely() {\n  return 1;\n}\n');
    const checks: ReviewCheck[] = [
        {
            id: 'untested-change',
            status: 'finding',
            items: [
                { id: 'app/a.ts#lonely', label: 'lonely', verdict: 'untested', witness: 'app/a.ts:1', edges: [] },
                { id: 'app/a.ts#covered', label: 'covered', verdict: 'tested', witness: 'app/a.ts:2', edges: ['t --tests/test-import--> app/a.ts#covered'] },
            ],
        },
        { id: 'missing-co-change', status: 'unknown', reason: 'shallow clone', items: [] },
        { id: 'touched-entry-point', status: 'pass', items: [] },
    ];
    const findings = graphCheckFindings(checks, root, 'abcdef1');

    it('emits one finding per flagged item and one per check that did not run, none for a pass', () => {
        expect(findings.map((f) => f.check)).toEqual(['untested-change', 'missing-co-change']);
        expect(findings[0]!.title).toBe('changed symbol has no test path: lonely');
        expect(findings[1]!.title).toBe('graph check missing-co-change did not run: shallow clone');
    });

    it('carries a well-formed presence exhibit at the witness', () => {
        const ex = findings[0]!.exhibits?.[0];
        expect(wellFormedExhibit(ex)).toEqual({ type: 'presence', path: 'app/a.ts', line: 1, quote: 'export function lonely() {', commit: 'abcdef1' });
        expect(findings[0]).toMatchObject({ file: 'app/a.ts', line: 1 });
    });

    it('fits the review-findings schema and stays advisory', () => {
        const item = SCHEMA.properties.findings.items;
        for (const f of findings) {
            for (const k of item.required) expect(f, k).toHaveProperty(k);
            expect(item.properties['severity']!.enum).toContain(f.severity);
            expect(item.properties['kind']!.enum).toContain(f.kind);
            expect(f.disposition).toBe('advisory');
            expect(classifyBlocking(f)).toBe(false);
            expect(findingId(f)).toMatch(/^[0-9a-f]{12}$/);
        }
    });
});
