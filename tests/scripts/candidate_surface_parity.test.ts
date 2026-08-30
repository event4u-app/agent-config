// The candidate surface list exists in THREE places and must stay one list.
//
//   - `bench_ab_clone.WITH_SURFACES`        — what a clone copies in
//   - `bench_ab_integrity.ALLOWED_DELTA_PATHS` — where divergence is legal
//   - `candidate_record.CANDIDATE_OWNED_PATHS` — where a mutation may write
//
// A refactor to one shared constant would touch the byte-exact CLI contract of
// both ported scripts (ADR-200 py2ts), so the three copies stay and this test
// is the forcing function instead. It is the cheapest form of one source of
// truth available here, and it fails loudly rather than letting a candidate
// write somewhere integrity does not check — which is a silent hole, not a
// tidiness problem.
//
// Same shape as the existing `router_match_parity` test: the copies are pinned
// to each other, not to a literal restated here.

import { describe, expect, it } from 'vitest';

import {
    CANDIDATE_PREFIX as CLONE_PREFIX,
    CANDIDATE_RECORD_FILE,
    WITH_SURFACES,
} from '../../src/scripts/bench_ab_clone.js';
import {
    ALLOWED_DELTA_FILES,
    ALLOWED_DELTA_PATHS,
    CANDIDATE_PREFIX as INTEGRITY_PREFIX,
    is_under_allowed_path,
} from '../../src/scripts/bench_ab_integrity.js';
import { CANDIDATE_OWNED_PATHS } from '../../src/scripts/_lib/candidate_record.js';

describe('candidate surface parity', () => {
    it('the three surface lists are identical', () => {
        expect([...CANDIDATE_OWNED_PATHS]).toEqual([...WITH_SURFACES]);
        expect([...CANDIDATE_OWNED_PATHS]).toEqual([...ALLOWED_DELTA_PATHS]);
    });

    it('every candidate-owned path is a path integrity permits to diverge', () => {
        // The direction that matters: a mutation the record admits must not be
        // reported as a violation by the checker. The reverse is allowed to be
        // wider — integrity also permits the manifest and settings files, which
        // a candidate does not write.
        for (const p of CANDIDATE_OWNED_PATHS) {
            expect(is_under_allowed_path(p), `${p} owned but not allowed to diverge`).toBe(true);
        }
    });

    it('the candidate record file is on integrity`s allowed-delta list', () => {
        // A candidate clone always carries this file and the baseline never
        // does. If it drifted off the list, EVERY candidate would report a
        // violation and the sabotage test would pass for the wrong reason.
        expect([...ALLOWED_DELTA_FILES]).toContain(CANDIDATE_RECORD_FILE);
        expect(is_under_allowed_path(CANDIDATE_RECORD_FILE)).toBe(true);
    });

    it('both scripts agree on the candidate clone directory prefix', () => {
        // The clone writes the directory; integrity discovers it by this
        // prefix. A drift here makes every candidate invisible to the checker,
        // which exits 0 while scanning nothing.
        expect(CLONE_PREFIX).toBe(INTEGRITY_PREFIX);
    });
});
