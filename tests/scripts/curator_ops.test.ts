/**
 * Tests for the curator operation set and its deterministic pre-stage
 * (`src/scripts/_lib/curator_ops.ts`,
 * road-to-governed-harness-evolution step 5.5, decision E6).
 *
 * The verify clause is *"a near-duplicate candidate is caught by the similarity
 * stage with zero model calls"*, and the second half is the one that can be
 * faked by reading the source and believing it. So it is established three
 * ways: a static scan of the module AND its one dependency for network /
 * model-client constructs, proved to fire on a synthetic source first; a
 * dynamic run with every network entry point replaced by a throwing stub; and
 * the literal-typed `model_calls: 0` on the result.
 */
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    CURATOR_OPS,
    NEAR_DUPLICATE_THRESHOLD,
    screenNearDuplicates,
    validateOp,
    type CorpusEntry,
    type CuratorProposal,
} from '../../src/scripts/_lib/curator_ops.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CURATOR_TS = path.join(REPO, 'src', 'scripts', '_lib', 'curator_ops.ts');
const SHINGLE_TS = path.join(REPO, 'src', 'scripts', '_lib', 'shingle_similarity.ts');

describe('5.5 — the operation set is E6, option B', () => {
    it('is exactly the seven ops, in the recorded order', () => {
        expect([...CURATOR_OPS]).toEqual([
            'KEEP',
            'ADD',
            'MERGE',
            'REPLACE',
            'SPLIT',
            'RETIRE',
            'SKIP',
        ]);
    });

    it('has SEVEN — the 4-op set and the 6-op middle were both rejected', () => {
        expect(CURATOR_OPS).toHaveLength(7);
        expect(CURATOR_OPS as readonly string[]).toContain('SPLIT');
        expect(CURATOR_OPS as readonly string[]).toContain('RETIRE');
    });

    it('MERGE is n->1 and SPLIT is 1->n, which is why RETIRE + 2x ADD is not a substitute', () => {
        expect(validateOp(proposal({ op: 'MERGE', targets: ['a', 'b'], produces: ['c'] }))).toBeNull();
        expect(validateOp(proposal({ op: 'MERGE', targets: ['a'], produces: ['c'] }))).toContain(
            'MERGE targets',
        );
        expect(validateOp(proposal({ op: 'SPLIT', targets: ['a'], produces: ['b', 'c'] }))).toBeNull();
        expect(validateOp(proposal({ op: 'SPLIT', targets: ['a'], produces: ['b'] }))).toContain(
            'SPLIT produces',
        );
    });

    it('RETIRE consumes one and produces nothing; ADD produces one and consumes nothing', () => {
        expect(validateOp(proposal({ op: 'RETIRE', targets: ['a'], produces: [] }))).toBeNull();
        expect(validateOp(proposal({ op: 'RETIRE', targets: ['a'], produces: ['b'] }))).toContain(
            'RETIRE produces',
        );
        expect(validateOp(proposal({ op: 'ADD', targets: [], produces: ['b'] }))).toBeNull();
        expect(validateOp(proposal({ op: 'ADD', targets: ['a'], produces: ['b'] }))).toContain('ADD targets');
    });
});

// --- § the fixture -----------------------------------------------------------

function proposal(over: Partial<CuratorProposal> = {}): CuratorProposal {
    return {
        id: 'p',
        op: 'ADD',
        targets: [],
        produces: ['new-artifact'],
        text: 'placeholder body long enough to shingle at k equals eight words for the comparison to run',
        ...over,
    };
}

/**
 * A corpus entry and a re-skin of it: the same prose with the framework and
 * vendor nouns swapped, which is exactly the shape `shingle_similarity`
 * neutralises before comparing.
 */
const ORIGINAL =
    'When a queue worker retries a job the handler must be idempotent, because a retry after a partial ' +
    'write leaves the row half updated and the second attempt then doubles the charge. Wrap the write and ' +
    'the dispatch in one transaction on Postgres and dispatch after commit on Laravel.';
const RESKIN =
    'When a queue worker retries a job the handler must be idempotent, because a retry after a partial ' +
    'write leaves the row half updated and the second attempt then doubles the charge. Wrap the write and ' +
    'the dispatch in one transaction on MySQL and dispatch after commit on Symfony.';
const UNRELATED =
    'Colour tokens are declared once on the root element and every component reads them by name, so a ' +
    'palette change lands in one file rather than in forty. A raw hex value in a component is the defect ' +
    'this convention exists to catch, and the linter names the nearest token.';

const CORPUS: CorpusEntry[] = [{ id: 'existing-1', text: ORIGINAL }];

describe('5.5 — verify: a near-duplicate is caught by the similarity stage', () => {
    it('rejects the re-skin and names what it duplicates', () => {
        const result = screenNearDuplicates([proposal({ id: 'reskin', text: RESKIN })], CORPUS);
        expect(result.admitted).toEqual([]);
        expect(result.near_duplicates).toHaveLength(1);
        const dup = result.near_duplicates[0];
        expect(dup?.against).toBe('existing-1');
        expect(dup?.overlap_percent ?? 0).toBeGreaterThanOrEqual(NEAR_DUPLICATE_THRESHOLD);
    });

    it('admits an unrelated proposal — the stage is not rejecting everything', () => {
        const result = screenNearDuplicates([proposal({ id: 'fresh', text: UNRELATED })], CORPUS);
        expect(result.near_duplicates).toEqual([]);
        expect(result.admitted.map((a) => a.proposal.id)).toEqual(['fresh']);
    });

    it('everything admitted is a CANDIDATE and nothing else', () => {
        const result = screenNearDuplicates([proposal({ id: 'fresh', text: UNRELATED })], CORPUS);
        expect(result.admitted.map((a) => a.lifecycle)).toEqual(['candidate']);
        for (const a of result.admitted) {
            expect(Object.keys(a).sort()).toEqual(['lifecycle', 'proposal']);
        }
    });

    it('a malformed op is rejected before any comparison runs', () => {
        const result = screenNearDuplicates(
            [proposal({ id: 'bad', op: 'SPLIT', targets: ['a'], produces: [] })],
            CORPUS,
        );
        expect(result.admitted).toEqual([]);
        expect(result.malformed.map((m) => m.proposal_id)).toEqual(['bad']);
    });
});

// --- § zero model calls, established rather than asserted --------------------

/** Comments are stripped: this module documents the calls it does not make. */
export function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

export function findModelCallConstructs(source: string): string[] {
    const body = stripComments(source);
    const banned: Array<[string, RegExp]> = [
        ['fetch', /\bfetch\s*\(/],
        ['http-module', /\bnode:https?\b|require\(['"]https?['"]\)/],
        ['net-module', /\bnode:(net|tls|dgram)\b/],
        ['child_process', /\bchild_process\b/],
        ['model-endpoint', /api\.(openai|anthropic)\.com|\/v1\/(chat\/completions|messages)\b/],
        ['model-client', /\bnew\s+(OpenAI|Anthropic)\b|@anthropic-ai|openai-node/],
        ['api-key', /\b(OPENAI|ANTHROPIC)_API_KEY\b/],
        ['await', /\bawait\b/],
    ];
    return banned.filter(([, re]) => re.test(body)).map(([name]) => name);
}

describe('5.5 — zero model calls, three independent ways', () => {
    it('the scanner FIRES on model-calling sources (negative polarity)', () => {
        expect(findModelCallConstructs('const r = await fetch(url);')).toEqual(['fetch', 'await']);
        expect(findModelCallConstructs("import https from 'node:https';")).toEqual(['http-module']);
        expect(findModelCallConstructs("post('https://api.openai.com/v1/chat/completions')")).toEqual([
            'model-endpoint',
        ]);
        expect(findModelCallConstructs('const c = new Anthropic({});')).toEqual(['model-client']);
        expect(findModelCallConstructs('process.env.OPENAI_API_KEY')).toEqual(['api-key']);
        expect(findModelCallConstructs("import cp from 'node:child_process';")).toEqual(['child_process']);
    });

    it('the scanner is silent on a plain source (positive polarity)', () => {
        expect(findModelCallConstructs('export function f(a: string): number { return a.length; }')).toEqual(
            [],
        );
    });

    it('the module and its one dependency carry none of them', () => {
        expect(findModelCallConstructs(readFileSync(CURATOR_TS, 'utf-8'))).toEqual([]);
        expect(findModelCallConstructs(readFileSync(SHINGLE_TS, 'utf-8'))).toEqual([]);
    });

    it('the module imports nothing but its one deterministic dependency', () => {
        const body = stripComments(readFileSync(CURATOR_TS, 'utf-8'));
        const imports = [...body.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
        expect(imports).toEqual(['./shingle_similarity.js']);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('runs to completion with every network global replaced by a throwing stub', () => {
        const boom = (): never => {
            throw new Error('a model call was made — the pre-stage is not deterministic');
        };
        vi.stubGlobal('fetch', boom);
        vi.stubGlobal('XMLHttpRequest', boom);
        vi.stubGlobal('WebSocket', boom);

        const result = screenNearDuplicates(
            [proposal({ id: 'reskin', text: RESKIN }), proposal({ id: 'fresh', text: UNRELATED })],
            CORPUS,
        );
        expect(result.near_duplicates.map((d) => d.proposal_id)).toEqual(['reskin']);
        expect(result.admitted.map((a) => a.proposal.id)).toEqual(['fresh']);
        expect(result.model_calls).toBe(0);
    });

    it('is synchronous, so it cannot await a call even if one were added', () => {
        const out = screenNearDuplicates([proposal()], CORPUS);
        expect(out).not.toBeInstanceOf(Promise);
        expect(screenNearDuplicates.constructor.name).toBe('Function');
    });
});
