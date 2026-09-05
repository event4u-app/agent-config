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

    it('emits a constant node for a MODULE-LEVEL non-function binding', async () => {
        // DECISION REVERSED by `road-to-the-graph-that-lies-confidently` 2.1,
        // and the reason it reversed is kept here rather than deleted.
        //
        // This test used to assert `[]`, on the reasoning that a node per
        // constant would raise the symbol count without improving recall. The
        // v2 benchmark falsified the premise: two of its three `references`
        // questions probe exactly this shape — `EXT_LANG` is a const and
        // `SettingsClass` a type alias — and the class scored recall 0.333
        // against grep's 1.000 because neither probe had a node to resolve to.
        //
        // The count-inflation worry it encoded was real, and is answered by the
        // MODULE-LEVEL scoping asserted in the sibling test below rather than
        // by refusing the node.
        expect(await symbols('const answer = 42; export const name = "x";')).toEqual([
            ['constant', 'answer'],
            ['constant', 'name'],
        ]);
    });

    it('does NOT emit a node for a binding inside a function body', async () => {
        // The scoping guard that replaces the blanket refusal. A loop counter
        // is not a symbol this graph answers questions about, and emitting one
        // per local IS the count-inflation failure the reversed test feared.
        expect(await symbols('export function f() { const local = 1; return local; }')).toEqual([
            ['function', 'f'],
        ]);
        expect(await symbols('const g = () => { const inner = 2; return inner; };')).toEqual([
            ['function', 'g'],
        ]);
        // Also inside a callback the walker reaches by plain recursion rather
        // than through a declaration case.
        expect(await symbols('list.map((x) => { const each = x; return each; });')).toEqual([]);
    });

    it('does NOT emit a node for a destructuring binding', async () => {
        // `const { a, b } = obj` binds two names and neither is a declaration
        // the graph can give a stable id to.
        expect(await symbols('const { a, b } = obj;')).toEqual([]);
    });

    it('emits type, interface and enum nodes', async () => {
        expect(
            await symbols('export type Alias = string; export interface Shape { a: number } export enum C { R }'),
        ).toEqual([
            ['type', 'Alias'],
            ['interface', 'Shape'],
            ['enum', 'C'],
        ]);
    });

    it('emits a CLASS node for a class-expression binding, not a constant', async () => {
        // `kind` is a capability claim the build pass reads: a `constant` may
        // not satisfy `new X()`. Calling this one a constant would make a real
        // `new Widget()` unresolvable.
        expect(await symbols('const Widget = class {};')).toEqual([['class', 'Widget']]);
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
