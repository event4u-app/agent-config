// Tests for src/scripts/check_release_published.ts (py2ts Phase 4 / Wave 4c).
//
// 1:1 port of tests/test_check_release_published.py. The Python suite
// monkeypatches the module-level _package_version / _package_name /
// _tag_exists / _on_main / _npm_latest helpers; the TS twin exposes the
// same surface via an injectable `Hooks` bag passed to main(). A
// golden-parity layer runs python3 vs tsx on the REAL REPO (no flags →
// warn-only, exit 0) when python3 is present.
import { describe, expect, it } from 'vitest';

import * as c from '../../src/scripts/check_release_published.js';



function stub(opts: {
    version: string;
    tagged: boolean;
    npm_latest?: string | null;
    on_main?: boolean;
    name?: string;
}): c.Hooks {
    const { version, tagged, npm_latest = null, on_main = true, name = '@event4u/agent-config' } =
        opts;
    return {
        _package_version: () => version,
        _package_name: () => name,
        _tag_exists: () => tagged,
        _on_main: () => on_main,
        _npm_latest: () => npm_latest,
    };
}

// ─── _tag_exists — published means ON THE REMOTE ──────────────────────────────
// Neither arm of this probe had a test while it answered local-OR-remote, which
// is how it came to report "tagged, therefore published" for the 14.6.0 tag that
// existed only in the maintainer's checkout (2026-08-20). The seam exists so the
// branches are reachable without minting and deleting tags in the checkout.

describe('_tag_exists', () => {
    it('asks origin, not the local tag list', () => {
        const calls: string[][] = [];
        c._tag_exists('14.6.0', (...args) => {
            calls.push(args);
            return [0, ''];
        });
        expect(calls).toHaveLength(1);
        expect(calls[0]).toEqual(['ls-remote', '--exit-code', '--tags', 'origin', '14.6.0']);
    });

    it('true when origin carries the tag', () => {
        expect(c._tag_exists('14.6.0', () => [0, 'deadbeef\trefs/tags/14.6.0'])).toBe(true);
    });

    it('false when origin does not — a local-only tag published nothing', () => {
        expect(c._tag_exists('14.6.0', () => [2, ''])).toBe(false);
    });
});

describe('check_release_published.main — exit codes (1:1 port)', () => {
    it('pass when tagged', () => {
        expect(c.main(['--strict'], stub({ version: '5.8.0', tagged: true }))).toBe(0);
    });

    it('strict fails when untagged', () => {
        expect(c.main(['--strict'], stub({ version: '5.8.0', tagged: false }))).toBe(1);
    });

    it('warn-only never fails', () => {
        expect(c.main([], stub({ version: '5.8.0', tagged: false }))).toBe(0);
    });

    it('npm lag fails strict', () => {
        expect(
            c.main(
                ['--strict', '--check-npm'],
                stub({ version: '5.8.0', tagged: true, npm_latest: '5.7.0' }),
            ),
        ).toBe(1);
    });

    it('npm in sync passes', () => {
        expect(
            c.main(
                ['--strict', '--check-npm'],
                stub({ version: '5.8.0', tagged: true, npm_latest: '5.8.0' }),
            ),
        ).toBe(0);
    });

    it('npm unreadable is warned not failed', () => {
        expect(
            c.main(
                ['--strict', '--check-npm'],
                stub({ version: '5.8.0', tagged: true, npm_latest: null }),
            ),
        ).toBe(0);
    });

    it('require-main no-ops off main', () => {
        expect(
            c.main(
                ['--strict', '--require-main'],
                stub({ version: '5.8.0', tagged: false, on_main: false }),
            ),
        ).toBe(0);
    });

    it('require-main enforces on main', () => {
        expect(
            c.main(
                ['--strict', '--require-main'],
                stub({ version: '5.8.0', tagged: false, on_main: true }),
            ),
        ).toBe(1);
    });

    it('non-semver version errors (exit 3)', () => {
        expect(c.main(['--strict'], stub({ version: 'not-a-version', tagged: true }))).toBe(3);
    });
});

