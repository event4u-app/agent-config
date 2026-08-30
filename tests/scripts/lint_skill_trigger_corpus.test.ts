import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    CASE_CLASSES,
    CASE_CLASS_POLARITY,
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

describe('the case-class discipline is forward-only and DECLARED', () => {
    const CLASSIFIED = {
        queries: [
            { q: 'a', trigger: true, class: 'exemplar' },
            { q: 'b', trigger: true, class: 'exemplar' },
            { q: 'c', trigger: true, class: 'exemplar', language: 'de' },
            { q: 'd', trigger: false, class: 'near-miss' },
            { q: 'e', trigger: false, class: 'counterexample' },
        ],
    };
    const mutated = (fn: (qs: Record<string, unknown>[]) => void) => {
        const qs = JSON.parse(JSON.stringify(CLASSIFIED.queries)) as Record<string, unknown>[];
        fn(qs);
        return { queries: qs };
    };
    const rules = (body: unknown, forward: boolean) =>
        judge(statsFor('probe', corpusOf(body)), forward).map((v) => v.rule);

    it('holds the closed vocabulary at three members with their polarities', () => {
        // The step asked for FOUR classes. The fourth — `failure`, a case the
        // routing gets wrong today — is an orthogonal axis and deliberately
        // NOT here (AI council 2026-08-30, 2/2). If it ever appears in this
        // list, that decision was reversed and this assertion is where it shows.
        expect([...CASE_CLASSES].sort()).toEqual(['counterexample', 'exemplar', 'near-miss']);
        expect(CASE_CLASS_POLARITY).toEqual({
            exemplar: true,
            'near-miss': false,
            counterexample: false,
        });
    });

    it('accepts a fully classified corpus on a touched file', () => {
        expect(rules(CLASSIFIED, true)).toEqual([]);
    });

    it('does NOT require a class on an untouched file', () => {
        expect(
            rules(
                mutated((qs) => {
                    for (const q of qs) delete q['class'];
                }),
                false,
            ),
        ).toEqual([]);
    });

    it('rejects an unclassified case on a touched file', () => {
        expect(
            rules(
                mutated((qs) => {
                    delete qs[0]?.['class'];
                }),
                true,
            ),
        ).toContain('class-missing');
    });

    it('rejects a value outside the closed vocabulary', () => {
        expect(
            rules(
                mutated((qs) => {
                    if (qs[0]) qs[0]['class'] = 'failure';
                }),
                true,
            ),
        ).toContain('class-vocab');
    });

    it('rejects a negative class on a positive case', () => {
        expect(
            rules(
                mutated((qs) => {
                    if (qs[0]) qs[0]['class'] = 'near-miss';
                }),
                true,
            ),
        ).toContain('class-polarity');
    });

    it('rejects a positive class on a negative case — the other direction', () => {
        // Both directions, because a polarity check written one-way passes
        // every fixture that only ever mislabels in the direction it tests.
        expect(
            rules(
                mutated((qs) => {
                    if (qs[4]) qs[4]['class'] = 'exemplar';
                }),
                true,
            ),
        ).toContain('class-polarity');
    });

    it('rejects a corpus missing the counterexample class entirely', () => {
        expect(
            rules(
                mutated((qs) => {
                    if (qs[4]) qs[4]['class'] = 'near-miss';
                }),
                true,
            ),
        ).toContain('class-coverage');
    });

    it('rejects the legacy string-array shape, which cannot carry a class', () => {
        expect(
            rules({ should_trigger: ['a', 'b', 'c'], should_not_trigger: ['d', 'e'] }, true),
        ).toContain('class-shape');
    });

    it('leaves the legacy shape alone while it stays untouched', () => {
        expect(
            rules({ should_trigger: ['a', 'b', 'c'], should_not_trigger: ['d', 'e'] }, false),
        ).toEqual([]);
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
