/**
 * D3 intent-conditioned verb selection (road-to-reachable-code-memory
 * Phase 9) — `suggestVerb` is a pure regex table (no model call). The
 * pre-registered ship gate: it must beat the always-`query` baseline's
 * correct-verb rate over `tests/fixtures/code-graph-intent/queries.json`, a
 * 30-question set written and labelled BEFORE `intent.ts` existed. This test
 * locks that gate in as an ongoing regression check, not just a one-time
 * measurement.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { suggestVerb, type Verb } from '../../src/scripts/code_graph/intent.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(HERE, '..', 'fixtures', 'code-graph-intent', 'queries.json');

interface LabelledQuery {
    id: number;
    question: string;
    verb: Verb;
}

function loadFixture(): LabelledQuery[] {
    const parsed = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8')) as { queries: LabelledQuery[] };
    return parsed.queries;
}

describe('D3 suggestVerb vs the pre-registered 30-query set', () => {
    it('the fixture carries exactly 30 labelled queries covering all four verbs', () => {
        const queries = loadFixture();
        expect(queries).toHaveLength(30);
        const verbs = new Set(queries.map((q) => q.verb));
        expect(verbs).toEqual(new Set(['query', 'affected', 'path', 'explain']));
    });

    it('beats the always-query baseline on correct-verb rate (the D3 ship gate)', () => {
        const queries = loadFixture();
        const correct = queries.filter((q) => suggestVerb(q.question) === q.verb).length;
        const baselineCorrect = queries.filter((q) => q.verb === 'query').length;
        const rate = correct / queries.length;
        const baselineRate = baselineCorrect / queries.length;
        expect(rate).toBeGreaterThan(baselineRate);
    });

    it('is deterministic — same question always yields the same verb', () => {
        for (const q of loadFixture()) {
            expect(suggestVerb(q.question)).toBe(suggestVerb(q.question));
        }
    });
});
