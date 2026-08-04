// The pre-registered ui-triviality eval: corpus integrity + the recall bar as
// a standing regression net for the intent classifier.
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    load_corpus,
    run_eval,
    CORPUS_REL,
    PREREGISTERED_RECALL,
} from '../../src/scripts/eval_ui_triviality.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const CORPUS = load_corpus(path.join(REPO_ROOT, CORPUS_REL));

describe('corpus integrity', () => {
    it('carries >= 30 well-formed tasks with unique ids', () => {
        expect(CORPUS.length).toBeGreaterThanOrEqual(30);
        for (const t of CORPUS) {
            expect(t.id, JSON.stringify(t)).toMatch(/^uit-\d{3}$/);
            expect(typeof t.prompt).toBe('string');
            expect(t.prompt.length).toBeGreaterThan(10);
            expect(['trivial', 'non-trivial']).toContain(t.label);
            expect(t.label_criterion ?? '').not.toBe('');
        }
        expect(new Set(CORPUS.map((t) => t.id)).size).toBe(CORPUS.length);
    });

    it('keeps both classes populated (labels are frozen, never tuned to pass)', () => {
        const trivial = CORPUS.filter((t) => t.label === 'trivial').length;
        expect(trivial).toBeGreaterThanOrEqual(10);
        expect(CORPUS.length - trivial).toBeGreaterThanOrEqual(15);
    });
});

describe('recall computation', () => {
    it('computes recall/precision on an inline fixture', () => {
        const result = run_eval([
            { id: 'uit-901', prompt: 'make the button red', label: 'trivial' },
            { id: 'uit-902', prompt: 'redesign the whole dashboard experience', label: 'non-trivial' },
            { id: 'uit-903', prompt: 'add a queue worker for invoice emails', label: 'non-trivial' },
        ]);
        expect(result.trivial_total).toBe(1);
        expect(result.trivial_routed).toBe(1);
        expect(result.recall).toBe(1);
        expect(result.verdict).toBe('PASS');
    });

    it('empty trivial class yields recall 0 / MISS, never a division error', () => {
        const result = run_eval([
            { id: 'uit-904', prompt: 'redesign the dashboard', label: 'non-trivial' },
        ]);
        expect(result.recall).toBe(0);
        expect(result.verdict).toBe('MISS');
    });
});

describe('the pre-registered bar — the regression net', () => {
    it(`trivial-lane recall stays >= ${PREREGISTERED_RECALL} on the golden corpus`, () => {
        const result = run_eval(CORPUS);
        expect(result.recall, JSON.stringify(result.rows.filter((r) => !r.hit))).toBeGreaterThanOrEqual(
            PREREGISTERED_RECALL,
        );
        expect(result.verdict).toBe('PASS');
    });
});
