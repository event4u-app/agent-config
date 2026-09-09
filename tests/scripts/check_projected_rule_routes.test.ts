/**
 * Projected-rule route guard.
 *
 * The gate's own `--self-test` drives the real CLI over throwaway roots and is
 * what CI exercises. These cases cover the two things the CLI cannot show:
 * `evaluate`'s counting in isolation — a gate that resolved every route but
 * counted nothing would pass every CLI case and be blind on a real tree — and
 * the LIVE corpus, which is where a regression would actually land. The live
 * assertion is the one that matters: it is the only place that would notice if
 * the `docs/guidelines/` projection lane stopped writing.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import {
    UNRESOLVED_RELATIVE_FLOOR,
    evaluate,
} from '../../src/scripts/check_projected_rule_routes.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const tmps: string[] = [];

afterAll(() => {
    for (const d of tmps) fs.rmSync(d, { recursive: true, force: true });
});

/** Build a throwaway projection: rules that route, guidelines that exist. */
function projection(rules: Record<string, string>, guidelines: string[]): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prr-t-'));
    tmps.push(root);
    const rulesDir = path.join(root, 'dist', 'agent-src', 'rules');
    const guidelinesDir = path.join(root, 'dist', 'agent-src', 'guidelines');
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.mkdirSync(guidelinesDir, { recursive: true });
    for (const slug of guidelines) {
        const f = path.join(guidelinesDir, `${slug}.md`);
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, '# body\n');
    }
    for (const [name, body] of Object.entries(rules)) {
        fs.writeFileSync(path.join(rulesDir, name), body);
    }
    return root;
}

describe('check_projected_rule_routes — the routes_to half', () => {
    it('accepts a route whose guideline body exists', () => {
        const root = projection({ 'a.md': 'routes_to: guideline:x\n' }, ['x']);
        const v = evaluate(root);
        expect(v.findings).toHaveLength(0);
        expect(v.targets).toBe(1);
    });

    it('reports a route whose guideline body does not exist', () => {
        const root = projection({ 'a.md': 'routes_to: guideline:x\n' }, []);
        const v = evaluate(root);
        expect(v.findings).toHaveLength(1);
        expect(v.findings[0]?.message).toContain('guideline:x');
    });

    it('resolves a nested slug under its own subdirectory', () => {
        const root = projection({ 'a.md': 'routes_to: guideline:agent-infra/x\n' }, [
            'agent-infra/x',
        ]);
        expect(evaluate(root).findings).toHaveLength(0);
    });

    // The exact shape of the defect this gate was written for: the body exists
    // in the SOURCE tree under docs/guidelines/ and not in the projection. A
    // gate that looked anywhere but `dist/agent-src/guidelines/` would pass.
    it('does not accept a body that exists only outside the projection', () => {
        const root = projection({ 'a.md': 'routes_to: guideline:x\n' }, []);
        const stray = path.join(root, 'docs', 'guidelines');
        fs.mkdirSync(stray, { recursive: true });
        fs.writeFileSync(path.join(stray, 'x.md'), '# body\n');
        expect(evaluate(root).findings).toHaveLength(1);
    });

    it('counts distinct targets, not occurrences', () => {
        const root = projection(
            { 'a.md': 'routes_to: guideline:x\n', 'b.md': 'routes_to: guideline:x\n' },
            ['x'],
        );
        const v = evaluate(root);
        expect(v.scanned).toBe(2);
        expect(v.targets).toBe(1);
    });
});

describe('check_projected_rule_routes — the relative-link half', () => {
    it('counts a resolving link as seen and not as unresolved', () => {
        const root = projection({ 'a.md': 'See [b](../guidelines/y.md).\n' }, ['y']);
        const v = evaluate(root);
        expect(v.relativeLinks).toBe(1);
        expect(v.unresolvedRelative).toBe(0);
    });

    it('counts a dangling link as unresolved', () => {
        const root = projection({ 'a.md': 'See [b](../guidelines/nope.md).\n' }, []);
        const v = evaluate(root);
        expect(v.relativeLinks).toBe(1);
        expect(v.unresolvedRelative).toBe(1);
    });

    it('ignores an absolute or bare link — only relative ones are judged', () => {
        const root = projection({ 'a.md': 'See [b](https://example.com/x.md) [c](x.md).\n' }, []);
        expect(evaluate(root).relativeLinks).toBe(0);
    });
});

describe('check_projected_rule_routes — the live projection', () => {
    const live = evaluate(REPO_ROOT);

    // Guards against a silently collapsed corpus: the gate reading three rules
    // and reporting green is the failure gate-coverage.yml exists to catch, and
    // this is the in-process half of the same floor.
    it('reads the real rule corpus', () => {
        expect(live.scanned).toBeGreaterThan(100);
    });

    // The assertion the projection lane is for. If `docs/guidelines/` stops
    // being projected, every one of these targets goes unresolved at once.
    it('resolves every guideline route in the shipped projection', () => {
        expect(live.findings).toEqual([]);
        expect(live.targets).toBeGreaterThan(15);
    });

    // Shrink-only. A rise means a projected rule gained a link into a tree the
    // projection does not carry; a fall means one was fixed and the floor moves
    // down in the same commit.
    it('holds the unresolved-relative-link ratchet', () => {
        expect(live.unresolvedRelative).toBeLessThanOrEqual(UNRESOLVED_RELATIVE_FLOOR);
    });
});
