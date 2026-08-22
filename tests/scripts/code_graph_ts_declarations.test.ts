import { describe, expect, it } from 'vitest';

import { extractFile } from '../../src/scripts/code_graph/extract.js';

/**
 * The declaration forms `extractTsJs` did not cover.
 *
 * Measured cause of the report's `170 TS symbol nodes`: the extractor handled
 * six node kinds and none of them was the dominant modern TS declaration form.
 * A grep for `lexical_declaration`, `variable_declarator`, `arrow_function` and
 * `public_field_definition` across the whole engine returned zero hits.
 *
 * These fixtures are the regression net for the repair. They do NOT assert that
 * the repair explains the retrieval null — it does not; the roadmap's
 * pre-falsifier fired on that question and the reasoning is in
 * `agents/evidence/analysis/code-graph-extractor-repair-2026-08-22.md`.
 */
async function symbols(source: string): Promise<Array<[string, string]>> {
    const out = await extractFile('a.ts', source, 'typescript');
    return out.nodes.filter((n) => n.kind !== 'file').map((n) => [n.kind, n.label] as [string, string]);
}

describe('code-graph TS extraction — binding and field declarations', () => {
    it('emits a function node for an exported arrow binding', async () => {
        expect(await symbols('export const alpha = (x: number) => x + 1;')).toEqual([
            ['function', 'alpha'],
        ]);
    });

    it('emits a function node for a function-expression binding', async () => {
        expect(await symbols('const beta = function () { return 2; };')).toEqual([
            ['function', 'beta'],
        ]);
    });

    it('emits a method node for a class property holding an arrow function', async () => {
        expect(await symbols('class C { m = () => 1 }')).toEqual([
            ['class', 'C'],
            ['method', 'm'],
        ]);
    });

    it('does NOT emit a node for a non-function binding', async () => {
        // The scoping decision, pinned. Emitting a node per constant would raise
        // the symbol count without improving recall, which is exactly the
        // cosmetic-improvement failure the roadmap's pre-falsifier exists to
        // catch. A test that only checked "more nodes than before" would have
        // rewarded it.
        expect(await symbols('const answer = 42; export const name = "x";')).toEqual([]);
    });

    it('still walks a non-function binding for the calls inside it', async () => {
        // Returning early on the whole declaration would have silently dropped
        // call edges from initialisers.
        const out = await extractFile('a.ts', 'const v = compute(1);', 'typescript');
        expect(out.rawEdges.some((e) => e.relation === 'calls' && e.targetName === 'compute')).toBe(
            true,
        );
    });

    it('attributes a call inside an arrow binding to that binding, not the file', async () => {
        const out = await extractFile('a.ts', 'const f = () => helper();', 'typescript');
        const call = out.rawEdges.find((e) => e.relation === 'calls' && e.targetName === 'helper');
        expect(call?.sourceId).toBe('a.ts#f');
    });

    it('keeps the five forms of the roadmap fixture at 5 of 5', async () => {
        const src = [
            'export const alpha = (x: number) => x + 1;',
            'const beta = function () { return 2; };',
            'class C { m = () => 1 }',
            'export function gamma(y: number) { return y; }',
            'class D { classic() { return 4; } }',
        ].join('\n');
        const got = await symbols(src);
        expect(got).toEqual([
            ['function', 'alpha'],
            ['function', 'beta'],
            ['class', 'C'],
            ['method', 'm'],
            ['function', 'gamma'],
            ['class', 'D'],
            ['method', 'classic'],
        ]);
    });
});
