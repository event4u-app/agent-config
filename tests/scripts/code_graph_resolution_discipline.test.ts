/**
 * Resolution discipline — road-to-edges-that-earn-their-target, Phases 1 and 2.
 *
 * Each shape here was a false or arbitrary edge at `700c41137b`: a closure local
 * reached by name from another file, a repo-wide lookup that bound the first of
 * several same-named declarations. Every test fails on that build.
 */
import { describe, expect, it } from 'vitest';

import { buildGraph, type SourceFile } from '../../src/scripts/code_graph/build.js';
import { extractFile } from '../../src/scripts/code_graph/extract.js';
import type { CodeGraph, Lang } from '../../src/scripts/code_graph/types.js';

const langOf = (p: string): Lang => (p.endsWith('.php') ? 'php' : 'typescript');

async function build(files: SourceFile[]): Promise<CodeGraph> {
    const extracts = [];
    for (const f of files) extracts.push(await extractFile(f.path, f.source, langOf(f.path)));
    return buildGraph(files, extracts);
}

const callsFrom = (g: CodeGraph, source: string) => g.edges.filter((e) => e.source === source && e.relation === 'calls');

describe('closure local (1.1)', () => {
    const FILES = [
        {
            path: 'a.ts',
            source: 'export function outer() {\n  const fn = () => 1;\n  function helper() { return 2; }\n  return fn() + helper();\n}\n',
        },
        { path: 'b.ts', source: 'export function caller() { return helper() + fn(); }\n' },
    ];

    it('emits no edge from another file onto a function declared inside a function body', async () => {
        const g = await build(FILES);
        const wrong = callsFrom(g, 'b.ts#caller').filter((e) => e.target.startsWith('a.ts#'));
        expect(wrong, JSON.stringify(wrong)).toEqual([]);
    });

    it('still resolves the closure local inside its own file', async () => {
        const g = await build(FILES);
        const targets = callsFrom(g, 'a.ts#outer').map((e) => [e.target, e.resolved_via]);
        expect(targets).toContainEqual(['a.ts#fn', 'same-file']);
        expect(targets).toContainEqual(['a.ts#helper', 'same-file']);
    });
});

describe('name collision (1.2)', () => {
    it('is ambiguous with both candidates when two files declare the name', async () => {
        const g = await build([
            { path: 'a.ts', source: 'export function run() { return 1; }\n' },
            { path: 'b.ts', source: 'export function run() { return 2; }\n' },
            { path: 'c.ts', source: 'export function go() { return run(); }\n' },
        ]);
        const [e] = callsFrom(g, 'c.ts#go');
        expect(e).toMatchObject({
            target: 'symbol:run',
            confidence: 'AMBIGUOUS',
            resolved_via: 'name-lookup',
            ambiguity_reason: 'name-collision',
            candidates: ['a.ts#run', 'b.ts#run'],
        });
    });

    it('still binds a name exactly one file declares', async () => {
        const g = await build([
            { path: 'a.ts', source: 'export function solo() { return 1; }\n' },
            { path: 'c.ts', source: 'export function go() { return solo(); }\n' },
        ]);
        expect(callsFrom(g, 'c.ts#go')[0]).toMatchObject({ target: 'a.ts#solo', confidence: 'INFERRED' });
    });

    it('sets a test file aside for a production caller, so one candidate remains', async () => {
        const g = await build([
            { path: 'tests/a.test.ts', source: 'export function run() { return 2; }\n' },
            { path: 'src/a.ts', source: 'export function run() { return 1; }\n' },
            { path: 'src/c.ts', source: 'export function go() { return run(); }\n' },
        ]);
        expect(callsFrom(g, 'src/c.ts#go')[0]).toMatchObject({ target: 'src/a.ts#run', confidence: 'INFERRED' });
    });

    it('does not bind a PHP `use` by base name when two classes share it', async () => {
        const g = await build([
            { path: 'One/Mailer.php', source: '<?php\nnamespace One;\nclass Mailer { public function send() {} }\n' },
            { path: 'Two/Mailer.php', source: '<?php\nnamespace Two;\nclass Mailer { public function send() {} }\n' },
            { path: 'App.php', source: '<?php\nuse Two\\Mailer;\nclass App { public function go() { return new Mailer(); } }\n' },
        ]);
        const imp = g.edges.find((e) => e.source === 'App.php' && e.relation === 'imports');
        expect(imp?.target).not.toBe('One/Mailer.php#Mailer');
        const ctor = callsFrom(g, 'App.php#App::go')[0];
        expect(ctor).toMatchObject({ confidence: 'AMBIGUOUS', ambiguity_reason: 'name-collision' });
    });
});
