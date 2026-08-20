/**
 * The hermeticity setup guards itself.
 *
 * `tests/_lib/hermetic-env.ts` strips the ambient locale variables before every
 * test file, because a hook that falls back to `process.env` otherwise makes the
 * whole suite pass or fail on the runner's `LANG`. That is not hypothetical: it
 * is why PR #1458 was green on two developer machines and every ubuntu shard and
 * red on `Node Tests (macos-latest, shard 2/4)`.
 *
 * A setup file registered in `vitest.config.ts` is exactly the kind of thing a
 * later edit removes without anything noticing — the config keeps parsing, the
 * suite keeps passing on whichever machine ran it, and the locale dependency
 * comes back invisibly. So the setup is asserted rather than trusted: delete the
 * `setupFiles` entry and this file goes red on any machine that has a locale set.
 *
 * It is deliberately NOT a test of `systemLocaleVerdict` (that has its own, with
 * explicit arguments). It tests the ENVIRONMENT the rest of the suite runs in.
 */
import { describe, expect, it } from 'vitest';

import { NEUTRALISED_LOCALE_VARS } from '../_lib/hermetic-env.js';
import { systemLocaleVerdict } from '../../src/scripts/language_mirror_hook.js';

describe('ambient locale is neutralised for every test file', () => {
    it('the setup file actually ran — no locale variable survives', () => {
        const survivors = NEUTRALISED_LOCALE_VARS.filter(
            (name) => process.env[name] !== undefined,
        );
        expect(
            survivors,
            `ambient locale leaked into the suite: ${survivors.join(', ')}. ` +
                'Either `setupFiles: ["tests/_lib/hermetic-env.ts"]` is missing from ' +
                'vitest.config.ts, or something re-set these after it ran. Every test ' +
                'that lets a hook read `process.env` is environment-dependent until ' +
                'this passes.',
        ).toEqual([]);
    });

    it('a hook reading the ambient environment therefore gets no verdict', () => {
        // The consequence, stated as an assertion rather than left implicit:
        // with the variables gone, the production locale reader returns `und`
        // from the real environment, so no test can accidentally depend on a
        // fallback firing.
        expect(systemLocaleVerdict(process.env)).toBe('und');
    });

    it('an EXPLICIT locale still works — the fix narrows nothing', () => {
        // The neutralisation must not disable locale handling itself, or tests
        // that legitimately exercise the fallback would silently stop covering
        // it. Passing the value explicitly never consults the environment.
        expect(systemLocaleVerdict({ LANG: 'de_DE.UTF-8' })).toBe('de');
        expect(systemLocaleVerdict({ LANG: 'en_US.UTF-8' })).toBe('en');
    });

    it('the guarded list covers every variable the production reader consults', () => {
        // A variable the reader honours but the setup does not strip is a hole
        // that reopens the whole class. Probe each one against the real reader:
        // if it produces a verdict, it MUST be in the neutralised list.
        for (const name of ['LC_ALL', 'LC_MESSAGES', 'LANG', 'LANGUAGE']) {
            const verdict = systemLocaleVerdict({ [name]: 'de_DE.UTF-8' });
            if (verdict !== 'und') {
                expect(
                    NEUTRALISED_LOCALE_VARS as readonly string[],
                    `${name} yields a verdict but is not neutralised`,
                ).toContain(name);
            }
        }
    });
});
