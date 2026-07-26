/**
 * An unresolvable baseline must fail loudly (road-to-wiring-truth, P2 fallout).
 *
 * Found while wiring the rule backstops into CI. `check_secret_leak` defaults to
 * "files changed vs origin/main + untracked". `git diff <missing-ref>` prints no
 * lines, so on a shallow checkout — the default `actions/checkout@v4` shape —
 * the changed-set became empty and the gate reported "no high-confidence secret
 * found in the tracked tree" while examining **zero files**.
 *
 * Verified before fixing: with an unresolvable base the resolver returned 0
 * paths. A secret gate that passes green on an empty scan is worse than no gate,
 * because it is believed.
 */
import { describe, expect, it } from 'vitest';

import { scanRepo } from '../../src/scripts/check_secret_leak.js';

const REPO = process.cwd();

describe('check_secret_leak — an empty scan is not a clean scan', () => {
    it('throws when the baseline ref does not resolve', () => {
        expect(() => scanRepo(REPO, 'diff', { base: 'origin/definitely-not-a-branch' })).toThrow(
            /does not resolve/,
        );
    });

    it('names the remedies rather than just failing', () => {
        // A gate that fails without saying how to satisfy it gets bypassed.
        try {
            scanRepo(REPO, 'diff', { base: 'origin/definitely-not-a-branch' });
            throw new Error('expected a throw');
        } catch (e) {
            const msg = String(e);
            expect(msg).toMatch(/fetch-depth/);
            expect(msg).toMatch(/--all/);
        }
    });

    it('still scans normally against a resolvable base', () => {
        // Regression guard on the fix itself: the probe must not break the
        // ordinary path. `--all` needs no baseline and must stay unaffected.
        expect(() => scanRepo(REPO, 'all')).not.toThrow();
    });

    it('explicit paths need no baseline at all', () => {
        expect(() => scanRepo(REPO, 'explicit', { explicit: ['README.md'] })).not.toThrow();
    });
});
