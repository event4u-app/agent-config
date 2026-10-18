import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ANCHOR_TYPES, buildAnchorTable, typeIssue } from '../../src/scripts/analysis_anchors.js';

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'analysis-anchors-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

function write(rel: string, text: string): void {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
}

describe('buildAnchorTable (step 4.3)', () => {
    it('a consumer fixture without docs/CLAIMS.md yields a typed table from its own signals', () => {
        write('tests/cart.test.ts', "it.skip('applies the discount', () => {});\n");
        write('src/cart.ts', '// FIXME: rounding drops a cent\nexport const x = 1; // TODO: extract the tax table\n');
        const t = buildAnchorTable({ root });
        expect(t.profile).toBe('consumer');
        expect(t.mode).toBe('anchored');
        expect(t.rows).toContainEqual(expect.objectContaining({ type: 'defect', anchor: 'tests/cart.test.ts:1', source: 'skipped-test' }));
        expect(t.rows).toContainEqual(expect.objectContaining({ type: 'defect', anchor: 'src/cart.ts:1', source: 'fixme' }));
        expect(t.rows).toContainEqual(expect.objectContaining({ type: 'maintainability', anchor: 'src/cart.ts:2', source: 'todo' }));
        for (const r of t.rows) expect(ANCHOR_TYPES).toContain(r.type);
    });

    it('with no signal it states feature mode, anchored on --goal, typed as an opportunity', () => {
        write('src/a.ts', 'export const a = 1;\n');
        const t = buildAnchorTable({ root, goal: 'offline sync' });
        expect(t.mode).toBe('feature');
        expect(t.rows).toEqual([{ type: 'product_opportunity', source: 'goal', anchor: '--goal', text: 'offline sync' }]);
        expect(buildAnchorTable({ root }).mode).toBe('feature-needs-goal');
    });

    it('never presents an opportunity as a defect', () => {
        write('agents/roadmaps/road-to-x.md', '# Road to x\n- [ ] **1.1 Add export.**\n');
        const t = buildAnchorTable({ root, issues: [{ number: 7, title: 'Add dark mode', labels: ['enhancement'] }] });
        const roadmap = t.rows.find((r) => r.source === 'roadmap');
        const issue = t.rows.find((r) => r.source === 'issue');
        expect(roadmap?.type).toBe('capability_gap');
        expect(issue?.type).toBe('product_opportunity');
    });

    it("this package's profile stays today's: docs/CLAIMS.md present means the package profile", () => {
        write('docs/CLAIMS.md', '# Claims\n');
        expect(buildAnchorTable({ root }).profile).toBe('package');
    });

    it('reads sources in the profile order and skips vendored and generated trees', () => {
        write('node_modules/lib/a.ts', '// FIXME: not ours\n');
        write('dist/a.js', '// TODO: generated\n');
        write('src/b.ts', '// TODO: ours\n');
        const t = buildAnchorTable({ root });
        expect(t.rows.map((r) => r.anchor)).toEqual(['src/b.ts:1']);
        expect(t.sources_read).toEqual(['skipped-tests', 'issues', 'todo-fixme', 'roadmaps', 'adrs', 'claims']);
    });
});

describe('typeIssue', () => {
    it('types by label, a bug as a defect and anything unlabelled as an opportunity', () => {
        expect(typeIssue(['bug'])).toBe('defect');
        expect(typeIssue(['security'])).toBe('security');
        expect(typeIssue(['performance'])).toBe('performance');
        expect(typeIssue(['tech-debt'])).toBe('maintainability');
        expect(typeIssue([])).toBe('product_opportunity');
    });
});
