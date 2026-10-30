/**
 * A resume refreshes the release-PR body, but the surface-equality check only
 * runs on `pull_request` pushes — a body edit never re-triggers it, so its red
 * verdict outlives the fix. 19.1.0 needed a hand `gh run rerun` for exactly
 * that. The resume now reruns the job itself; this pins which job it picks.
 */
import { describe, expect, it } from 'vitest';

import { _stale_surface_check_jobs } from '../../src/scripts/_lib/release_surface_check.js';

const NAME = 'PR body equals CHANGELOG entry';
const link = (run: number, job: number): string =>
    `https://github.com/event4u-app/agent-config/actions/runs/${run}/job/${job}`;

describe('_stale_surface_check_jobs', () => {
    it('returns the job id of a failed surface-equality check', () => {
        const json = JSON.stringify([
            { name: NAME, bucket: 'fail', link: link(41119851255, 117000000001) },
            { name: 'Tests', bucket: 'pass', link: link(1, 2) },
        ]);
        expect(_stale_surface_check_jobs(json)).toEqual(['117000000001']);
    });

    it('ignores a passing or pending surface-equality check', () => {
        for (const bucket of ['pass', 'pending', 'skipping']) {
            const json = JSON.stringify([{ name: NAME, bucket, link: link(3, 4) }]);
            expect(_stale_surface_check_jobs(json)).toEqual([]);
        }
    });

    it('ignores other failing checks — only the body check is stale by construction', () => {
        const json = JSON.stringify([{ name: 'Release-PR shape detector', bucket: 'fail', link: link(5, 6) }]);
        expect(_stale_surface_check_jobs(json)).toEqual([]);
    });

    it('skips an entry whose link carries no job id', () => {
        const json = JSON.stringify([{ name: NAME, bucket: 'fail', link: 'https://example.invalid/check' }]);
        expect(_stale_surface_check_jobs(json)).toEqual([]);
    });

    it('returns [] on unparseable or non-array output', () => {
        expect(_stale_surface_check_jobs('not json')).toEqual([]);
        expect(_stale_surface_check_jobs('{}')).toEqual([]);
    });
});
