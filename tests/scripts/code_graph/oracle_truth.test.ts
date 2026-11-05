import { describe, expect, it } from 'vitest';

import {
    callerClosure,
    exclusionConflicts,
    isTestPath,
    pendingSymbols,
    scipReferences,
    truthFor,
    type Enclosing,
    type Question,
    type Refs,
} from '../../../internal/bench/code-graph/oracle_truth.js';
import type { ScipDocument } from '../../../src/scripts/code_graph/scip_reader.js';

// A small call chain: Guard::check <- Job::handle <- Ctrl::store (a controller, nothing calls it),
// and Guard::check is also called from a test file at file scope.
const refs = (): Refs =>
    new Map([
        ['App\\Guard::check', [{ file: 'app/Job.php', line: 10 }, { file: 'tests/GuardTest.php', line: 5 }]],
        ['App\\Job::handle', [{ file: 'app/Http/Controllers/Ctrl.php', line: 20 }]],
        ['App\\Http\\Controllers\\Ctrl::store', []],
    ]);
const enclosing = (): Enclosing =>
    new Map([
        ['app/Job.php:10', 'App\\Job::handle'],
        ['tests/GuardTest.php:5', '-'],
        ['app/Http/Controllers/Ctrl.php:20', 'App\\Http\\Controllers\\Ctrl::store'],
    ]);
const q = (over: Partial<Question>): Question => ({ id: 'x', class: 'change-impact', subject: 's', language: 'php', probe: 'check', ...over });

describe('callerClosure', () => {
    it('walks callers breadth-first and records the hop each file is first reached at', () => {
        const c = callerClosure('App\\Guard::check', refs(), enclosing(), 6);
        expect(Object.fromEntries(c.fileHop)).toEqual({ 'app/Job.php': 1, 'tests/GuardTest.php': 1, 'app/Http/Controllers/Ctrl.php': 2 });
        expect([...c.callers].sort()).toEqual(['App\\Http\\Controllers\\Ctrl::store', 'App\\Job::handle']);
        expect(c.terminals).toEqual(['App\\Http\\Controllers\\Ctrl::store']);
        expect(c.truncated).toBe(false);
    });

    it('stops at the depth cap and says so', () => {
        const c = callerClosure('App\\Guard::check', refs(), enclosing(), 1);
        expect([...c.fileHop.keys()].sort()).toEqual(['app/Job.php', 'tests/GuardTest.php']);
        expect(c.truncated).toBe(true);
    });

    it('names the symbols whose references are still unknown, for the next oracle round', () => {
        const partial = refs();
        partial.delete('App\\Job::handle');
        expect(pendingSymbols('App\\Guard::check', partial, enclosing(), 6)).toEqual(['App\\Job::handle']);
        expect(pendingSymbols('App\\Guard::check', refs(), enclosing(), 6)).toEqual([]);
    });
});

describe('truthFor', () => {
    const seeds = (id: string, ...s: string[]) => new Map([[id, s]]);

    it('marks the classes no reference engine answers as human-required, with no files', () => {
        for (const cls of ['route-trace', 'model-table', 'change-impact-xplane']) {
            const t = truthFor(q({ class: cls }), new Map(), refs(), enclosing(), [], false, 6);
            expect(t).toMatchObject({ status: 'human-required', truth_via: 'human', files: [] });
        }
    });

    it('projects a change-impact closure to files and flags the open route hops of a controller entry point', () => {
        const t = truthFor(q({}), seeds('x', 'App\\Guard::check'), refs(), enclosing(), [], false, 6);
        expect(t.files).toEqual(['app/Http/Controllers/Ctrl.php', 'app/Job.php', 'tests/GuardTest.php']);
        expect(t.hop_stratum_oracle).toBe(2);
        expect(t.status).toBe('oracle-partial');
        expect(t.open?.[0]).toMatch(/route hops/);
    });

    it('flags a non-controller method nothing calls as a framework-invoked entry point', () => {
        const r = refs();
        r.set('App\\Job::handle', []);
        const t = truthFor(q({}), seeds('x', 'App\\Guard::check'), r, enclosing(), [], false, 6);
        expect(t.status).toBe('oracle-partial');
        expect(t.open).toEqual(['framework-invoked entry point(s) not followed: App\\Job::handle']);
    });

    it('keeps only test files for tests-for', () => {
        const t = truthFor(q({ class: 'tests-for' }), seeds('x', 'App\\Guard::check'), refs(), enclosing(), [], false, 6);
        expect(t.files).toEqual(['tests/GuardTest.php']);
    });

    it('answers direct callers only, at hop 1, for a precise-semantics question', () => {
        const t = truthFor(q({ class: 'precise-semantics', shape: 'callers' }), seeds('x', 'App\\Guard::check'), refs(), enclosing(), [], false, 6);
        expect(t).toMatchObject({ status: 'oracle', files: ['app/Job.php', 'tests/GuardTest.php'], hop_stratum_oracle: 1 });
    });

    it('refuses to pick between two declarations', () => {
        const t = truthFor(q({}), seeds('x', 'A::check', 'B::check'), refs(), enclosing(), [], false, 6);
        expect(t.status).toBe('unresolved');
        expect(t.open?.[0]).toMatch(/ambiguous/);
    });

    it('confirms a negative control whose probe has no declaration, and voids one the oracle can reach', () => {
        const none = truthFor(q({ class: 'negative-control', shape: 'symbol' }), seeds('x'), refs(), enclosing(), [], false, 6);
        expect(none.status).toBe('confirms-empty');
        const pathQ = q({ class: 'negative-control', shape: 'path', probe: 'Ctrl', probe_to: 'Guard' });
        const reached = new Map([['x', ['App\\Http\\Controllers\\Ctrl']], ['x>to', ['App\\Guard::check']]]);
        expect(truthFor(pathQ, reached, refs(), enclosing(), [], false, 6).status).toBe('void');
        const unreached = new Map([['x', ['App\\Other']], ['x>to', ['App\\Guard::check']]]);
        expect(truthFor(pathQ, unreached, refs(), enclosing(), [], false, 6).status).toBe('confirms-empty');
    });

    it('marks a TypeScript answer partial when the subject has Vue files scip-typescript cannot index', () => {
        const docs: ScipDocument[] = [
            { path: 'lib/u.ts', occurrences: [{ line: 9, symbol: 'npm x `lib/u.ts`/toUrl().', definition: true }] },
            { path: 'lib/a.ts', occurrences: [{ line: 3, symbol: 'npm x `lib/u.ts`/toUrl().', definition: false }] },
        ];
        const tsQ = q({ class: 'precise-semantics', language: 'ts', probe: 'toUrl', declared_in: 'lib/u.ts:10' });
        expect(truthFor(tsQ, new Map(), new Map(), new Map(), docs, true, 6)).toMatchObject({ status: 'oracle-partial', files: ['lib/a.ts'] });
        expect(truthFor(tsQ, new Map(), new Map(), new Map(), docs, false, 6)).toMatchObject({ status: 'oracle', files: ['lib/a.ts'] });
    });
});

describe('scipReferences', () => {
    it('finds the symbol defined at the declared line and returns the files that reference it', () => {
        const docs: ScipDocument[] = [
            { path: 'u.ts', occurrences: [{ line: 0, symbol: 's/toUrl().', definition: true }, { line: 4, symbol: 's/toUrl().', definition: false }] },
            { path: 'b.ts', occurrences: [{ line: 1, symbol: 's/other().', definition: false }] },
        ];
        expect(scipReferences(docs, 'u.ts:1', 'toUrl')).toEqual({ symbol: 's/toUrl().', files: ['u.ts'] });
        expect(scipReferences(docs, 'u.ts:2', 'toUrl')).toEqual({ files: [] });
    });
});

describe('exclusionConflicts', () => {
    it('names every probe token a file mentions as a whole word, so an excluded file cannot hide a reference', () => {
        const text = '$x = collect(config("acl")); $svc->sendBatchByIds($ids);';
        expect(exclusionConflicts(text, ['sendBatchByIds', 'httpOptions', 'acl'])).toEqual(['sendBatchByIds', 'acl']);
        expect(exclusionConflicts('sendBatchByIdsX()', ['sendBatchByIds'])).toEqual([]);
    });
});

describe('isTestPath', () => {
    it('recognises test directories and *Test.php files', () => {
        expect(isTestPath('tests/Unit/A.php')).toBe(true);
        expect(isTestPath('packages/X/tests/Feature/B.php')).toBe(true);
        expect(isTestPath('app/CTest.php')).toBe(true);
        expect(isTestPath('app/Services/Testing.php')).toBe(false);
    });
});
