import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    GRANDFATHERED,
    MIN_NEAR_MISSES,
    MIN_POSITIVES,
    evaluate,
    judge,
    statsFor,
} from '../../src/scripts/lint_skill_trigger_corpus.js';
import { DeadScopeError } from '../../src/scripts/_lib/scan_scope.js';

const REPO = path.resolve(__dirname, '..', '..');

let tmp = '';
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lstc-t-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function mkCorpus(unit: string, body: unknown): string {
    const root = fs.mkdtempSync(path.join(tmp, 'repo-'));
    const d = path.join(root, 'src', 'skills', unit, 'evals');
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'triggers.json'), JSON.stringify(body));
    return root;
}

const GOOD = {
    queries: [
        { q: 'a', trigger: true },
        { q: 'b', trigger: true },
        { q: 'c', trigger: true, language: 'de' },
        { q: 'd', trigger: false },
        { q: 'e', trigger: false },
    ],
};

describe('both corpus shapes are read', () => {
    it('counts the queries shape', () => {
        const root = mkCorpus('probe', GOOD);
        const s = statsFor('probe', path.join(root, 'src/skills/probe/evals/triggers.json'));
        expect(s.positives).toBe(3);
        expect(s.nearMisses).toBe(2);
        expect(s.germanPositives).toBe(1);
    });

    it('counts the should_trigger shape, which 2 shipped files use', () => {
        const root = mkCorpus('probe', {
            should_trigger: ['a', 'b', 'c'],
            should_not_trigger: ['d', 'e'],
        });
        const s = statsFor('probe', path.join(root, 'src/skills/probe/evals/triggers.json'));
        // A reader that knew only the majority shape returned ZERO here while
        // the coverage ratio counted the file as covered — the silent no-op
        // this gate and the Phase 1 loader were both corrected for.
        expect(s.positives).toBe(3);
        expect(s.nearMisses).toBe(2);
    });
});

describe('the count discipline', () => {
    it('accepts a corpus at exactly the floor', () => {
        expect(judge(statsFor('probe', corpusOf(GOOD)), false)).toEqual([]);
    });

    it('rejects one positive below the floor', () => {
        const v = judge(statsFor('probe', corpusOf({ queries: GOOD.queries.slice(1) })), false);
        expect(v.map((x) => x.rule)).toContain('positives');
    });

    it('rejects one near-miss below the floor', () => {
        const v = judge(statsFor('probe', corpusOf({ queries: GOOD.queries.slice(0, 4) })), false);
        expect(v.map((x) => x.rule)).toContain('near-misses');
    });

    it('holds the floors at the documented numbers, so a silent loosening shows up here', () => {
        expect(MIN_POSITIVES).toBe(3);
        expect(MIN_NEAR_MISSES).toBe(2);
    });
});

describe('the language discipline is forward-only and DECLARED', () => {
    it('does not require German on an untouched corpus', () => {
        const withoutDe = { queries: GOOD.queries.map((q) => ({ q: q.q, trigger: q.trigger })) };
        expect(judge(statsFor('probe', corpusOf(withoutDe)), false)).toEqual([]);
    });

    it('DOES require it on a corpus the diff touched', () => {
        const withoutDe = { queries: GOOD.queries.map((q) => ({ q: q.q, trigger: q.trigger })) };
        const v = judge(statsFor('probe', corpusOf(withoutDe)), true);
        expect(v.map((x) => x.rule)).toContain('german');
    });

    it('is satisfied by the declaration, never by German-looking text', () => {
        // A detector would pass this. The gate must not: it counts declarations.
        const looksGerman = {
            queries: [
                { q: 'mach das bitte', trigger: true },
                { q: 'zeig mir das', trigger: true },
                { q: 'räum das auf', trigger: true },
                { q: 'x', trigger: false },
                { q: 'y', trigger: false },
            ],
        };
        const v = judge(statsFor('probe', corpusOf(looksGerman)), true);
        expect(v.map((x) => x.rule)).toContain('german');
    });
});

describe('grandfathering is by NAME, not by count', () => {
    it('exempts exactly the two units that predate the discipline', () => {
        expect([...GRANDFATHERED].sort()).toEqual(['brand-asset-generation', 'estimate-ticket']);
    });

    it('lets a grandfathered unit hold zero cases', () => {
        expect(judge(statsFor('estimate-ticket', corpusOf({ queries: [] })), true)).toEqual([]);
    });

    it('does not extend the exemption to a third unit', () => {
        expect(judge(statsFor('some-other-skill', corpusOf({ queries: [] })), false).length).toBeGreaterThan(0);
    });
});

describe('scan-scope protection', () => {
    it('throws rather than reporting clean when src/skills is unreadable', () => {
        const root = fs.mkdtempSync(path.join(tmp, 'bare-'));
        expect(() => evaluate(root)).toThrow(DeadScopeError);
    });

    it('throws when the root exists but holds no corpus at all', () => {
        const root = fs.mkdtempSync(path.join(tmp, 'empty-'));
        fs.mkdirSync(path.join(root, 'src', 'skills'), { recursive: true });
        // 90 corpus files exist in the shipped tree, so zero means the root
        // moved. A gate that scans nothing exits green unless it says this.
        expect(() => evaluate(root)).toThrow(DeadScopeError);
    });
});

describe('the shipped tree', () => {
    it('holds the discipline on every non-grandfathered corpus', () => {
        const r = evaluate(REPO);
        expect(r.violations).toEqual([]);
        expect(r.scanned).toBeGreaterThanOrEqual(90);
    });
});

function corpusOf(body: unknown): string {
    const root = mkCorpus('probe', body);
    return path.join(root, 'src', 'skills', 'probe', 'evals', 'triggers.json');
}
