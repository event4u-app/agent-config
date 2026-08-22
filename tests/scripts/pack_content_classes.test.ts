import { describe, expect, it } from 'vitest';

import { classifyPayload, payloadClassCounts } from '../../src/scripts/check_pack_size.js';

const f = (path: string) => ({ path, size: 1 });
/** A payload is "built" iff it carries dist/cli/**. */
const BUILT = f('dist/cli/agent-config.js');

describe('pack content classes', () => {
    it('refuses a compiled test artefact — both the JS and its map', () => {
        // Measured 2026-08-22: 8 `.test.js` files shipped alongside their 8
        // `.test.js.map` files. Stripping only the maps would have left the
        // compiled tests in the tarball, which is the symptom-not-cause case a
        // council seat raised before the measurement confirmed it.
        const errs = classifyPayload([
            BUILT,
            f('dist/cli/configRoot.test.js'),
            f('dist/cli/configRoot.test.js.map'),
        ]);
        expect(errs).toHaveLength(1);
        expect(errs[0]).toContain('compiled-test-artefact');
        expect(errs[0]).toContain('configRoot.test.js');
        expect(errs[0]).toContain('configRoot.test.js.map');
    });

    it('refuses a credential-shaped path, on a class that is EMPTY today', () => {
        // The reason this class exists at all: a clean class with no check is
        // indistinguishable from a class nobody looked at.
        for (const p of ['dist/.env', 'dist/cli/key.pem', 'dist/id_rsa', 'dist/cert.p12']) {
            const errs = classifyPayload([BUILT, f(p)]);
            expect(errs.some((e) => e.includes('credential-shaped')), p).toBe(true);
        }
    });

    it('refuses IDE metadata', () => {
        expect(classifyPayload([BUILT, f('.vscode/settings.json')])[0]).toContain('ide-metadata');
        expect(classifyPayload([BUILT, f('.idea/modules.xml')])[0]).toContain('ide-metadata');
    });

    it('accepts product source maps up to the measured ratchet and refuses one more', () => {
        const maps = (n: number) =>
            Array.from({ length: n }, (_, i) => f(`dist/cli/m${String(i)}.js.map`));
        expect(classifyPayload([BUILT, ...maps(120)])).toEqual([]);
        const over = classifyPayload([BUILT, ...maps(121)]);
        expect(over).toHaveLength(1);
        expect(over[0]).toContain('source-map');
    });

    it('reports a build-dependent class NOT MEASURABLE on an unbuilt payload', () => {
        // The false-pass this closes: `npm pack --ignore-scripts` on a clean
        // checkout — the condition pack-size-budget.json declares for its own
        // numbers — produces no dist/cli/** at all, so a source-map count of 22
        // sails under a limit of 120 while measuring a fifth of the payload.
        const unbuilt = [f('dist/agent-src/skills/x/SKILL.md'), f('src/scripts/a.ts')];
        const counts = payloadClassCounts(unbuilt);
        expect(counts.find((c) => c.id === 'source-map')?.measurable).toBe(false);
        expect(counts.find((c) => c.id === 'compiled-test-artefact')?.measurable).toBe(false);
        // …and the classes that span the whole payload stay measurable.
        expect(counts.find((c) => c.id === 'credential-shaped')?.measurable).toBe(true);
        expect(counts.find((c) => c.id === 'ide-metadata')?.measurable).toBe(true);
    });

    it('does not flag a build-dependent class on an unbuilt payload that would violate it', () => {
        // Sensitivity in the other direction: not-measurable must not silently
        // become a pass OR a failure. It reports and abstains.
        const unbuilt = [f('lib/thing.test.js')];
        expect(classifyPayload(unbuilt)).toEqual([]);
        expect(payloadClassCounts(unbuilt).find((c) => c.id === 'compiled-test-artefact')?.measurable).toBe(
            false,
        );
    });

    it('every class carries the tree its limit was measured in', () => {
        // Step 1.2's requirement, pinned. A threshold with no stated tree reads
        // as drift the first time someone runs it from a fresh checkout.
        const errs = classifyPayload([BUILT, f('dist/cli/a.test.js')]);
        expect(errs[0]).toContain('measured in:');
        expect(errs[0]).toContain('2026-08-22');
    });

    it('names the offending paths, not just a count', () => {
        const errs = classifyPayload([BUILT, f('.idea/x.xml')]);
        expect(errs[0]).toContain('.idea/x.xml');
    });
});
