// Tests for src/scripts/check_depth_budget.ts.
//
// Two things are worth pinning here and nothing else is:
//
//   1. The measurement — which files count as the depth layer, and where the
//      boundary sits. An off-by-one at the ceiling decides whether a file is
//      debt or not, so the inclusive edge is asserted from both sides.
//   2. The ratchet baseline is the LIVE count. A baseline recorded one above
//      the truth is a gate that permits one free regression and reads green
//      while doing it — the failure the ratchet exists to prevent, reintroduced
//      through its own config.
//
// The exit-code behaviour is proven by the gate's `--self-test`, which drives
// the real binary against a synthetic tree, so it is not re-mocked here.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    DEPTH_CEILING_CHARS,
    DEPTH_ROOTS,
    collectDepthFiles,
    measure,
} from '../../src/scripts/check_depth_budget.js';

const REPO = path.resolve(__dirname, '..', '..');

function makeTree(files: Record<string, number>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cdb-'));
    for (const [rel, size] of Object.entries(files)) {
        const p = path.join(root, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, 'x'.repeat(size), 'utf-8');
    }
    return root;
}

describe('check_depth_budget — what the depth layer is', () => {
    it('collects from both roots', () => {
        const root = makeTree({
            'docs/guidelines/a.md': 10,
            'src/agent-src/contexts/b.md': 10,
        });
        expect(collectDepthFiles(root).map((f) => path.relative(root, f))).toEqual(
            [path.join('docs', 'guidelines', 'a.md'), path.join('src', 'agent-src', 'contexts', 'b.md')].sort(),
        );
    });

    it('recurses into nested directories', () => {
        const root = makeTree({ 'docs/guidelines/agent-infra/deep/x.md': 10 });
        expect(collectDepthFiles(root)).toHaveLength(1);
    });

    it('ignores non-markdown files', () => {
        const root = makeTree({ 'docs/guidelines/a.md': 10, 'docs/guidelines/b.json': 10 });
        expect(collectDepthFiles(root)).toHaveLength(1);
    });

    it('does not reach outside the two declared roots', () => {
        const root = makeTree({ 'src/rules/a.md': 10, 'src/skills/x/SKILL.md': 10 });
        // Rules and skills carry their OWN budgets; counting them here would
        // double-govern them and make this gate's number un-interpretable.
        expect(collectDepthFiles(root)).toEqual([]);
    });
});

describe('check_depth_budget — the ceiling boundary', () => {
    it('is inclusive: exactly at the ceiling is not over', () => {
        const root = makeTree({ 'docs/guidelines/a.md': DEPTH_CEILING_CHARS });
        const over = measure(root, collectDepthFiles(root)).filter(
            (m) => m.chars > DEPTH_CEILING_CHARS,
        );
        expect(over).toEqual([]);
    });

    it('one char over is over', () => {
        const root = makeTree({ 'docs/guidelines/a.md': DEPTH_CEILING_CHARS + 1 });
        const over = measure(root, collectDepthFiles(root)).filter(
            (m) => m.chars > DEPTH_CEILING_CHARS,
        );
        expect(over.map((o) => o.file)).toEqual(['docs/guidelines/a.md']);
    });

    it('reports repo-relative POSIX paths, so a finding is copy-pasteable', () => {
        const root = makeTree({ 'docs/guidelines/agent-infra/a.md': 5 });
        expect(measure(root, collectDepthFiles(root))[0]?.file).toBe(
            'docs/guidelines/agent-infra/a.md',
        );
    });
});

describe('check_depth_budget — the baseline is the live count', () => {
    it('the recorded baseline equals the number of over-ceiling files in the real tree', () => {
        const live = measure(REPO, collectDepthFiles(REPO)).filter(
            (m) => m.chars > DEPTH_CEILING_CHARS,
        );
        const baselines = JSON.parse(
            fs.readFileSync(path.join(REPO, 'src/config/gate-violation-baselines.json'), 'utf-8'),
        ) as { gates: Record<string, { count: number }> };
        const entry = baselines.gates['check_depth_budget'];
        expect(entry, 'check_depth_budget has no baseline entry').toBeDefined();
        // Equality, not `<=`: a baseline ABOVE the live count silently grants
        // one free regression, and the gate would still print green.
        expect(entry?.count).toBe(live.length);
    });

    it('both declared roots exist in the real tree — a moved root would make the count meaningless', () => {
        for (const root of DEPTH_ROOTS) {
            expect(fs.existsSync(path.join(REPO, root)), `${root} is missing`).toBe(true);
        }
    });
});
