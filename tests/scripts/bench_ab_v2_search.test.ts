/**
 * T5's re-scorer — the report contract and the dry-run judge.
 *
 * Two declared jobs. The first mirrors T4's: an unmeasured trial must leave no
 * `search_adherence` key behind, because a 0 asserts the run searched for
 * nothing while the truth is that nobody could judge it. The second is the
 * **mock judge's spread** — an all-yes mock would let a smoke test pass while
 * proving nothing about whether the pipeline can express a `no`, so the mock is
 * asserted to produce both answers on inputs that differ.
 *
 * No key, no network: every judge here is an injected function.
 */
import { describe, expect, it } from 'vitest';

import {
    loadTaskPrompts,
    mockJudge,
    renderSearchTable,
    rescoreSearch,
    trialsWrittenByLastSearchRescore,
} from '../../src/scripts/bench_ab_v2_search.js';
import { searchAdherencePrompt, type AskFn } from '../../src/scripts/_lib/bench_ab_search_adherence.js';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.resolve(HERE, '..', '..', 'internal', 'bench', 'corpora', 'ab-trackb-v2.yaml');

const YES = 'NAMED: yes\nINSPECTED: yes\nJUSTIFIED: yes';
const yes: AskFn = () => YES;
const junk: AskFn = () => 'I cannot answer that';

const report = (trial: Record<string, unknown>, taskId = 'trapA-overeng-01'): Record<string, unknown> => ({
    records: [{ id: taskId, arms: { package: [trial] } }],
});

describe('loadTaskPrompts', () => {
    it('reads the prompt the run was given', () => {
        expect(loadTaskPrompts(CORPUS).get('trapA-overeng-01')).toMatch(/paginate/);
    });

    it('degrades to an empty map on a missing corpus instead of throwing', () => {
        expect(loadTaskPrompts('/nope.yaml').size).toBe(0);
        expect(loadTaskPrompts(null).size).toBe(0);
    });
});

describe('rescoreSearch — the report contract', () => {
    it('writes the score for a measured trial', () => {
        const payload = report({ seed: 0, transcript_path: '/t.txt', metrics: {} });
        const rows = rescoreSearch(payload, {
            asks: [yes, yes],
            write: true,
            corpusPath: CORPUS,
            readTranscript: () => 'I grepped for an existing helper and reused it',
        });
        expect(rows[0]?.search_adherence).toBe(1);
        expect(trialsWrittenByLastSearchRescore()).toBe(1);
    });

    it('DELETES a stale key rather than writing 0 when the trial is unmeasured', () => {
        const payload = report({ seed: 0, transcript_path: '/t.txt', metrics: { search_adherence: 1 } });
        const rows = rescoreSearch(payload, {
            asks: [yes, junk],
            write: true,
            corpusPath: CORPUS,
            readTranscript: () => 'anything',
        });
        expect(rows[0]?.search_adherence).toBeNull();
        const rec = (payload['records'] as Record<string, unknown>[])[0] as Record<string, unknown>;
        const arms = rec['arms'] as Record<string, Record<string, unknown>[]>;
        expect(((arms['package'] as Record<string, unknown>[])[0] as Record<string, unknown>)['metrics']).toEqual({});
        expect(trialsWrittenByLastSearchRescore()).toBe(0);
    });

    it('names the coverage boundary for a report written before transcripts were preserved', () => {
        const rows = rescoreSearch(report({ seed: 0, metrics: {} }), {
            asks: [yes, yes],
            corpusPath: CORPUS,
            readTranscript: () => 'unused',
        });
        expect(rows[0]?.search_adherence).toBeNull();
        expect(rows[0]?.reason).toMatch(/predates transcript preservation/);
    });

    it('reports a transcript that is gone from disk as unmeasured', () => {
        const rows = rescoreSearch(report({ seed: 0, transcript_path: '/gone.txt', metrics: {} }), {
            asks: [yes, yes],
            corpusPath: CORPUS,
            readTranscript: () => null,
        });
        expect(rows[0]?.search_adherence).toBeNull();
        expect(rows[0]?.reason).toMatch(/missing on disk/);
    });

    it('reports a task the corpus does not carry as unmeasured', () => {
        const rows = rescoreSearch(report({ seed: 0, transcript_path: '/t.txt', metrics: {} }, 'not-a-task'), {
            asks: [yes, yes],
            corpusPath: CORPUS,
            readTranscript: () => 'anything',
        });
        expect(rows[0]?.search_adherence).toBeNull();
        expect(rows[0]?.reason).toMatch(/not in the corpus/);
    });

    it('survives a report with no records at all', () => {
        expect(rescoreSearch({}, { asks: [yes, yes], corpusPath: CORPUS })).toEqual([]);
    });
});

describe('mockJudge — the dry-run judge must be able to say no', () => {
    it('credits nothing on a transcript with no search evidence', () => {
        const out = mockJudge(searchAdherencePrompt('t', 'I wrote a new helper.'));
        expect(out).toBe('NAMED: no\nINSPECTED: no\nJUSTIFIED: no');
    });

    it('credits every item on a transcript carrying all three shapes', () => {
        const out = mockJudge(
            searchAdherencePrompt('t', 'I could reuse the existing paginate helper, so I read it, and used it'),
        );
        expect(out).toBe('NAMED: yes\nINSPECTED: yes\nJUSTIFIED: yes');
    });

    it('produces a partial reading, so a dry run has a spread rather than a ceiling', () => {
        const out = mockJudge(searchAdherencePrompt('t', 'There is an existing helper here.'));
        expect(out).toContain('NAMED: yes');
        expect(out).toContain('INSPECTED: no');
    });
});

describe('renderSearchTable', () => {
    it('prints the measured count and renders a null as a dash', () => {
        const out = renderSearchTable([
            { task: 't', arm: 'package', seed: 0, search_adherence: 0.67, reason: 'r' },
            { task: 't', arm: 'vanilla', seed: 0, search_adherence: null, reason: 'no transcript' },
        ]);
        expect(out).toContain('1/2 trials carry a search-adherence observation.');
        expect(out).toContain('0.67');
        expect(out.split('\n').some((l) => l.includes('| - |'))).toBe(true);
    });
});
