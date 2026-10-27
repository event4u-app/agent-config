/**
 * J.3 — answers that are right: tests-for on a module finds the tests of its
 * symbols and resolves `.js` specifiers; usage covers symbols; pack seeds a
 * `.js` word; an empty answer names the grep fallback.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { noEntryLine, symbolUsage } from '../../src/scripts/code_graph/answer_correctness.js';
import { type LoadedGraph, loadGraph } from '../../src/scripts/code_graph/query.js';
import type { CodeEdge, CodeGraph, CodeNode } from '../../src/scripts/code_graph/types.js';
import { contextPack } from '../../src/scripts/code_graph/verify/pack.js';
import { testsFor } from '../../src/scripts/code_graph/verbs.js';

const n = (id: string, kind: CodeNode['kind'] = 'function'): CodeNode => {
    const file = id.split('#')[0] as string;
    return { id, label: id.includes('#') ? (id.split('#')[1] as string) : path.basename(id), kind: id.includes('#') ? kind : 'file', source_file: file, source_location: id.includes('#') ? [1, 1, 3, 1] : [] };
};
const e = (source: string, target: string, relation: CodeEdge['relation'], resolved_via: CodeEdge['resolved_via'] = 'import-specifier'): CodeEdge => ({ source, target, relation, confidence: relation === 'tests' ? 'INFERRED' : 'EXTRACTED', resolved_via, provider: 'native' });

const hook = 'src/hooks/inject_hook.ts';
const graph: CodeGraph = {
    schema_version: 7,
    source_checksum: 'fixture',
    languages: ['typescript'],
    grammar_abi: 14,
    edge_confidence_counts: { EXTRACTED: 0, INFERRED: 0, AMBIGUOUS: 0 },
    suppressed_edge_counts: { dynamic_no_candidate: 0 },
    nodes: [n(hook), n(`${hook}#main`), n(`${hook}#build`), n('tests/a.test.ts'), n('tests/b.test.ts'), n('tests/c.test.ts'), n('src/cli.ts'), n('src/cli.ts#run')],
    edges: [
        e(hook, `${hook}#main`, 'member', 'same-file'),
        e(hook, `${hook}#build`, 'member', 'same-file'),
        e('tests/a.test.ts', `${hook}#main`, 'tests', 'test-import'),
        e('tests/b.test.ts', `${hook}#build`, 'tests', 'test-import'),
        e('tests/c.test.ts', `${hook}#main`, 'tests', 'test-import'),
        e('src/cli.ts#run', `${hook}#main`, 'calls'),
    ],
} as unknown as CodeGraph;

let dir: string;
let g: LoadedGraph;
beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'answer-correct-'));
    fs.writeFileSync(path.join(dir, 'g.json'), JSON.stringify(graph));
    g = loadGraph(path.join(dir, 'g.json'), 'fixture');
});
afterEach(() => {
    g.close();
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('tests-for', () => {
    it('a module seed lists the tests of the symbols it declares', () => {
        expect(testsFor(g, 'inject_hook.ts', 'fresh').tests).toEqual(['tests/a.test.ts', 'tests/b.test.ts', 'tests/c.test.ts']);
    });

    it('a .js specifier resolves to its .ts source', () => {
        expect(testsFor(g, 'src/hooks/inject_hook.js', 'fresh').tests).toHaveLength(3);
    });
});

describe('usage covers symbols', () => {
    it('counts the users of an exact symbol and refuses a fuzzy guess', () => {
        expect(symbolUsage(g, `${hook}#main`)).toEqual({ symbol: `${hook}#main`, users: expect.any(Number), files: expect.arrayContaining(['src/cli.ts']) });
        expect(symbolUsage(g, 'mai')).toBeNull();
    });
});

describe('pack', () => {
    it('seeds a task word written as a .js specifier', () => {
        const p = contextPack(g, dir, path.join(dir, 'g.json'), 'why does src/hooks/inject_hook.js fail');
        expect(p.seeds.from_task).toContain(hook);
    });
});

describe('no entry', () => {
    it('names the grep fallback and says it is not proof of absence', () => {
        expect(noEntryLine("it's", 'tests-for')).toBe("no entry for 'it'\\''s' in the graph's tests-for — this is not proof of absence; search the text: grep -rn -- 'it'\\''s' .");
    });
});
