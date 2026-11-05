import { describe, expect, it } from 'vitest';

import { closureFromEdges, edgeKey, parseEdgeRulings, standingEdges, type Edge } from '../../../internal/bench/code-graph/closure_check.js';

const target = { file: 'app/Guard.php', line: 10, symbol: 'Guard::check' };
const e = (from: string, to: string, toLine = 1, toSymbol = 'X::y'): Edge => ({ from_file: from, from_line: 1, to_file: to, to_line: toLine, to_symbol: toSymbol, kind: 'call' });
// Job -> Guard::check (hop 1); Ctrl -> Job (hop 2); routes -> Ctrl (hop 3); JobTest -> Job (hop 2)
const chain: Edge[] = [
    e('app/Job.php', 'app/Guard.php', 10, 'Guard::check'),
    e('app/Http/Controllers/Ctrl.php', 'app/Job.php'),
    e('routes/api.php', 'app/Http/Controllers/Ctrl.php'),
    e('tests/Feature/JobTest.php', 'app/Job.php'),
];

describe('closureFromEdges', () => {
    it('walks from the target symbol outward and records each file at its first hop', () => {
        expect(Object.fromEntries(closureFromEdges(target, chain))).toEqual({
            'app/Job.php': 1,
            'app/Http/Controllers/Ctrl.php': 2,
            'tests/Feature/JobTest.php': 2,
            'routes/api.php': 3,
        });
    });

    it('starts only from edges into the target symbol, not from any edge into its file', () => {
        const other = [e('app/Unrelated.php', 'app/Guard.php', 40, 'Guard::other')];
        expect(closureFromEdges(target, other).size).toBe(0);
    });

    it('treats any member of a class target as the target', () => {
        const classTarget = { file: 'app/Guard.php', line: 3, symbol: 'App\\Guard' };
        expect(closureFromEdges(classTarget, [e('app/Form.php', 'app/Guard.php', 40, 'Guard::validate')]).get('app/Form.php')).toBe(1);
    });

    it('keeps a free function target symbol-level: another function in its file is not the target', () => {
        const fnTarget = { file: 'resources/js/lib/utils.ts', line: 10, symbol: 'toUrl' };
        expect(closureFromEdges(fnTarget, [e('a.ts', 'resources/js/lib/utils.ts', 30, 'cn')]).size).toBe(0);
        expect(closureFromEdges(fnTarget, [e('a.ts', 'resources/js/lib/utils.ts', 10, 'toUrl')]).get('a.ts')).toBe(1);
    });

    it('counts the target file only when something inside it reaches the target', () => {
        expect(closureFromEdges(target, chain).has('app/Guard.php')).toBe(false);
        expect(closureFromEdges(target, [e('app/Guard.php', 'app/Guard.php', 10, 'Guard::check')]).get('app/Guard.php')).toBe(1);
    });

    it('applies a stated hop limit and a tests-only filter', () => {
        expect([...closureFromEdges(target, chain, { hopLimit: 2 }).keys()].sort()).toEqual(['app/Http/Controllers/Ctrl.php', 'app/Job.php', 'tests/Feature/JobTest.php']);
        expect([...closureFromEdges(target, chain, { testsOnly: true }).keys()]).toEqual(['tests/Feature/JobTest.php']);
    });
});

describe('closureFromEdges at symbol level', () => {
    // Service.php: run() calls Guard::check (hop 1); other() does not reach it.
    // Ctrl::store calls Service::run (hop 2); Admin::index calls Service::other (unrelated).
    const sym: Record<string, string> = {
        'app/Service.php:12': 'App\\Service::run',
        'app/Service.php:30': 'App\\Service::other',
        'app/Service.php:5': 'App\\Service',
        'app/Ctrl.php:8': 'App\\Ctrl::store',
        'app/Admin.php:4': 'App\\Admin::index',
        'routes/api.php:3': '-',
        'tests/ATest.php:9': '-',
    };
    const nodeOf = (file: string, line: number): string | undefined => sym[`${file}:${line}`];
    const edge = (from: string, fl: number, to: string, tl: number, s = 'X'): Edge => ({ from_file: from, from_line: fl, to_file: to, to_line: tl, to_symbol: s, kind: 'call' });
    const edges: Edge[] = [
        edge('app/Service.php', 12, 'app/Guard.php', 10, 'Guard::check'),
        edge('app/Ctrl.php', 8, 'app/Service.php', 12, 'Service::run'),
        edge('app/Admin.php', 4, 'app/Service.php', 30, 'Service::other'),
        edge('routes/api.php', 3, 'app/Ctrl.php', 8, 'Ctrl::store'),
        edge('tests/ATest.php', 9, 'routes/api.php', 3, 'POST /a'),
    ];

    it('follows the symbol a caller calls, not every caller of the same file', () => {
        const c = closureFromEdges(target, edges, {}, nodeOf);
        expect(Object.fromEntries(c)).toEqual({ 'app/Service.php': 1, 'app/Ctrl.php': 2, 'routes/api.php': 3, 'tests/ATest.php': 4 });
        expect(c.has('app/Admin.php')).toBe(false);
    });

    it('counts hops by symbol, so a stated limit is not crossed through a shared file', () => {
        expect([...closureFromEdges(target, edges, { hopLimit: 2 }, nodeOf).keys()].sort()).toEqual(['app/Ctrl.php', 'app/Service.php']);
    });

    it('reaches a class node once any of its members is reached', () => {
        const inst = [...edges, edge('app/Factory.php', 2, 'app/Service.php', 5, 'Service')];
        expect(closureFromEdges(target, inst, {}, (f, l) => sym[`${f}:${l}`] ?? (f === 'app/Factory.php' ? 'App\\Factory::make' : undefined)).get('app/Factory.php')).toBe(2);
    });
});

describe('parseEdgeRulings', () => {
    it('maps judge edge ids back to edge keys and refuses a reply with no rulings', () => {
        const ids = { E1: 'a.php:1->b.php:2' };
        expect(parseEdgeRulings('```json\n{"edges":[{"id":"E1","verdict":"VALID","reason":"r"}]}\n```', ids).get('a.php:1->b.php:2')).toBe('VALID');
        expect(() => parseEdgeRulings('looks fine to me', ids)).toThrow(/no edge rulings/);
    });
});

describe('standingEdges', () => {
    it('keeps an edge the reader states and at least one judge rules VALID; UNSURE is not VALID', () => {
        const [a, b, c] = chain as [Edge, Edge, Edge];
        const verdicts = {
            openai: new Map([[edgeKey(a), 'VALID'], [edgeKey(b), 'UNSURE'], [edgeKey(c), 'INVALID']]),
            google: new Map([[edgeKey(a), 'INVALID'], [edgeKey(b), 'UNSURE'], [edgeKey(c), 'VALID']]),
        } as const;
        expect(standingEdges([a, b, c], verdicts).map(edgeKey)).toEqual([edgeKey(a), edgeKey(c)]);
    });
});
