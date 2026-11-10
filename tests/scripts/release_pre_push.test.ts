import { describe, expect, it } from 'vitest';

import { pre_push_argvs } from '../../src/scripts/_lib/release_pre_push.js';
import { local_release_gate_argv } from '../../src/scripts/release_publication.js';

describe('release pre-push steps', () => {
    it('runs the local release gates first, then the CI mirror on the release head', () => {
        const steps = pre_push_argvs();
        expect(steps[0]).toEqual(local_release_gate_argv());
        expect(steps.at(-1)).toEqual(['./scripts-run', 'src/scripts/ci_mirror']);
    });

    it('runs the mirror as a whole plan, never a --job subset, which writes no push stamp', () => {
        const mirror = pre_push_argvs().find((a) => a.includes('src/scripts/ci_mirror'));
        expect(mirror).toBeDefined();
        expect(mirror).not.toContain('--job');
    });
});
