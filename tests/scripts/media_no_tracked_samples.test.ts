/**
 * No sample media is tracked (road-to-a-verdict-that-shows-its-frame 5.4).
 *
 * Analysis rounds keep real clips in the gitignored inbox, and the media tests
 * generate theirs into a temp directory at run time. A committed `.mp4` or
 * `.mov` under `agents/` or `tests/` is therefore always a mistake: a third
 * party's video (with whatever account or video id its container carries)
 * landing in a public tree.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const VIDEO = /\.(mp4|mov|m4v)$/i;

describe('no sample media in the tracked tree', () => {
    it('tracks no video file under agents/ or tests/', () => {
        const r = spawnSync('git', ['ls-files', '-z', '--', 'agents', 'tests'], { cwd: REPO_ROOT, encoding: 'utf-8' });
        expect(r.status, r.stderr).toBe(0);
        const tracked = r.stdout.split('\0').filter((f) => f !== '');
        expect(tracked.length).toBeGreaterThan(0);
        expect(tracked.filter((f) => VIDEO.test(f))).toEqual([]);
    });

    it('recognises a video path, so an empty result is a finding and not a blind filter', () => {
        expect(['agents/evidence/clip.MP4', 'tests/fixtures/a.mov', 'tests/a.m4v'].filter((f) => VIDEO.test(f))).toHaveLength(3);
        expect(VIDEO.test('tests/fixtures/media/generate.ts')).toBe(false);
    });
});
