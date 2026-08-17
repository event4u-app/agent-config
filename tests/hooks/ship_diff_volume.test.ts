import { describe, expect, it } from 'vitest';

import {
    correctedVolume,
    isExcluded,
    isShipCommand,
    DEFAULT_THRESHOLD,
} from '../../src/scripts/hooks/ship_diff_volume_hook.js';

describe('ship-diff-volume', () => {
    it('fires only on ship verbs', () => {
        for (const cmd of ['git push', 'git push --force-with-lease origin x', 'gh pr create --fill']) {
            expect(isShipCommand(cmd)).toBe(true);
        }
        for (const cmd of ['git status', 'git commit -m x', 'gh pr view 12', 'npm run push-docs']) {
            expect(isShipCommand(cmd)).toBe(false);
        }
    });

    it('excludes the repository bookkeeping the s04 replay identified', () => {
        // The measured defect: a committed copy of the diff being measured.
        expect(isExcluded('agents/evidence/reviews/x.review-input/diff.patch')).toBe(true);
        expect(isExcluded('agents/roadmaps/archive/index.json')).toBe(true);
        expect(isExcluded('dist/agent-src/rules/x.md')).toBe(true);
        expect(isExcluded('.claude/rules/x.md')).toBe(true);
    });

    it('counts ordinary source as volume', () => {
        expect(isExcluded('src/scripts/foo.ts')).toBe(false);
        expect(isExcluded('agents/roadmaps/road-to-x.md')).toBe(false);
        // A sibling archive file that is NOT the generated index still counts.
        expect(isExcluded('agents/roadmaps/archive/road-to-y.md')).toBe(false);
    });

    it('subtracts excluded paths from the volume rather than the file count', () => {
        const numstat = [
            '10\t5\tsrc/scripts/a.ts',
            '2000\t800\tagents/evidence/reviews/x.review-input/diff.patch',
            '3\t0\tsrc/scripts/b.ts',
        ].join('\n');
        const r = correctedVolume(numstat);
        expect(r.volume).toBe(18);
        expect(r.excluded).toBe(2800);
        expect(r.files).toBe(2);
    });

    it('treats a binary numstat row as zero rather than NaN', () => {
        const r = correctedVolume('-\t-\tassets/logo.png\n4\t1\tsrc/x.ts');
        expect(r.volume).toBe(5);
        expect(Number.isNaN(r.volume)).toBe(false);
    });

    it('pins the threshold to the derived p90, so a silent retune is a visible diff', () => {
        expect(DEFAULT_THRESHOLD).toBe(1695);
    });
});
