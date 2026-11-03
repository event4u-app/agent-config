// road-to-tells-a-near-miss-can-refute 5.3: a rewrite that moves a fact is a
// hard finding; a pure reword is clean.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { diffFacts } from '../../src/scripts/_lib/fact_diff.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BEFORE =
    'On March 3, 2026 the Payments Team cut checkout latency from 2.1 seconds to 310 ms, ' +
    'saving $12,400 a month. Details: https://example.com/postmortem and `retry_budget`.';

describe('diffFacts', () => {
    it('a pure reword is clean', () => {
        const after =
            'Checkout latency fell from 2.1 seconds to 310 ms on March 3, 2026, when the Payments Team ' +
            'shipped the change; it saves $12,400 a month. See https://example.com/postmortem and `retry_budget`.';
        expect(diffFacts(BEFORE, after)).toEqual({ lost: [], added: [] });
    });

    it('a dropped number is lost', () => {
        const after = BEFORE.replace(' from 2.1 seconds', '');
        expect(diffFacts(BEFORE, after).lost).toEqual([{ kind: 'number', value: '2.1' }]);
    });

    it('a changed date is lost and added', () => {
        const d = diffFacts(BEFORE, BEFORE.replace('March 3', 'March 5'));
        expect(d.lost).toEqual([{ kind: 'date', value: 'March 3, 2026' }]);
        expect(d.added).toEqual([{ kind: 'date', value: 'March 5, 2026' }]);
    });

    it('an added name is added', () => {
        const d = diffFacts(BEFORE, `${BEFORE} Jane Doe signed it off.`);
        expect(d.added).toEqual([{ kind: 'name', value: 'Jane Doe' }]);
        expect(d.lost).toEqual([]);
    });

    it('a moved currency amount is caught', () => {
        expect(diffFacts(BEFORE, BEFORE.replace('$12,400', '$14,200')).lost).toEqual([{ kind: 'currency', value: '$12,400' }]);
    });
});

// road-to-rewrites-that-keep-their-facts 2.1: the four classes a reword moves
// without touching a digit — a supplied unit-bound number word, a smoothed
// status, a flipped negation or dropped hedge, and an absorbed attribution.
describe('fact-atom fixtures', () => {
    const DIR = path.join(REPO, 'tests', 'fixtures', 'fact-atoms');
    const cases = fs
        .readdirSync(DIR)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => ({ file: f, ...(JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as { type: string; class?: string; before: string; after: string }) }));

    it('carries five mutations and three benign controls', () => {
        expect(cases.filter((c) => c.type === 'mutation')).toHaveLength(5);
        expect(cases.filter((c) => c.type === 'benign')).toHaveLength(3);
    });

    for (const c of cases.filter((x) => x.type === 'mutation')) {
        it(`catches ${c.file} as a ${c.class} finding`, () => {
            const d = diffFacts(c.before, c.after);
            expect([...d.lost, ...d.added].map((f) => f.kind)).toContain(c.class);
        });
    }

    for (const c of cases.filter((x) => x.type === 'benign')) {
        it(`${c.file} gives zero findings`, () => {
            expect(diffFacts(c.before, c.after)).toEqual({ lost: [], added: [] });
        });
    }

    it('reports the supplied number word with its unit', () => {
        const d = diffFacts('We fixed it.', 'We fixed it in eleven days.');
        expect(d.added).toEqual([{ kind: 'numword', value: 'eleven days' }]);
    });

    it('reports we -> I as a lost plural and an added singular attribution', () => {
        const d = diffFacts('Our team rebuilt it.', 'I rebuilt it.');
        expect(d.lost).toEqual([{ kind: 'attribution', value: 'we' }]);
        expect(d.added).toEqual([{ kind: 'attribution', value: 'I' }]);
    });

    it('word <-> digit stays a reported difference (D2)', () => {
        const d = diffFacts('We hired three engineers.', 'We hired 3 engineers.');
        expect(d.lost).toEqual([{ kind: 'numword', value: 'three engineers' }]);
        expect(d.added).toEqual([{ kind: 'number', value: '3' }]);
    });
});

describe('detect_ai_tells --baseline', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fact-diff-'));
    const run = (after: string) => {
        fs.writeFileSync(path.join(dir, 'before.md'), BEFORE);
        fs.writeFileSync(path.join(dir, 'after.md'), after);
        return spawnSync('npx', ['tsx', path.join(REPO, 'src/scripts/detect_ai_tells.ts'), '--baseline', path.join(dir, 'before.md'), path.join(dir, 'after.md')], {
            encoding: 'utf8',
            cwd: REPO,
        });
    };

    it('exits 1 and names the moved fact', () => {
        const r = run(BEFORE.replace('310 ms', '300 ms'));
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('lost number 310');
        expect(r.stdout).toContain('added number 300');
    }, 60_000);

    it('exits 0 on an unchanged fact set', () => {
        expect(run(BEFORE).status).toBe(0);
    }, 60_000);
});
