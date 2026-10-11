import { describe, expect, it } from 'vitest';

import { isVerificationCommand } from '../../src/scripts/_lib/verification_command.js';

/**
 * Step 2.1(b) of `road-to-svg-review-followups`, which REVERSES one half of
 * step 3.5 of `road-to-svg-with-a-witness` on review claim C2.
 *
 * W 3.5 taught this predicate `ui:render --profile asset`, reasoning that it is
 * the one check which opens the delivered file in a real engine. The review
 * read the gate rather than the command and found the argument insufficient:
 * the turn-end gate's TRANSCRIPT path matches a command and never sees an exit
 * code, so a call that rendered nothing — the ordinary case on a machine with
 * no Playwright, where it also exited 0 until the same day — discharged the
 * obligation from its text alone. Both exits are needed; teaching the
 * predicate was the one that made the hole look closed.
 *
 * So NEITHER command verifies here now. The replacement reads the RENDER:
 * `detectOpenSvgObligation` matches a manifest against the file's own digest,
 * and accepts a renderer-absent manifest only together with a clean static
 * witness on those same bytes (`turn_end_gate_svg_render.test.ts`).
 *
 * The `xmllint` rows are unchanged and keep their original reason (S6): a
 * session answered a refused gate twice with a parser pass and a report that
 * the file "is valid". A file can parse and still be the wrong picture.
 */
describe('neither-asset-render-nor-xmllint-verifies', () => {
    it('neither-asset-render-nor-xmllint-verifies', () => {
        // --- refused: the render, because this predicate cannot see its result -
        // The gate reads the manifest instead. A command that rendered nothing
        // must not look like a check that passed.
        for (const command of [
            'agent-config ui:render assets/logo.svg --profile asset',
            './agent-config ui:render assets/logo.svg --profile asset',
            './agent-config ui:render assets/logo.svg --profile asset --json',
            'agent-config ui:render assets/logo.svg --profile=asset',
        ]) {
            expect(isVerificationCommand(command), command).toBe(false);
        }

        // --- refused: a parser pass is `static-only`, never `verified` --------
        for (const command of [
            'xmllint --noout assets/logo.svg',
            'xmllint --noout --schema svg.xsd assets/logo.svg',
            'qlmanage -t -s 512 assets/logo.svg',
        ]) {
            expect(isVerificationCommand(command), command).toBe(false);
        }

        // --- refused: the page profile is not the asset witness ---------------
        // `ui:render` without the asset profile captures three page viewports.
        // It proves something about a page, nothing about a delivered asset, so
        // it must not clear an `.svg` turn.
        for (const command of [
            'agent-config ui:render index.html',
            'agent-config ui:render assets/logo.svg',
            'agent-config ui:render assets/logo.svg --profile page',
            'agent-config ui:render --profile',
        ]) {
            expect(isVerificationCommand(command), command).toBe(false);
        }

        // --- refused: every other subcommand of the same binary ---------------
        // Keying on the head alone would have admitted these, and most of them
        // write a report rather than asserting anything.
        for (const command of [
            'agent-config roadmap:progress',
            'agent-config council:status',
            'agent-config doctor --json',
        ]) {
            expect(isVerificationCommand(command), command).toBe(false);
        }

        // --- and no other agent-config form sneaks back in --------------------
        // The branch is gone rather than narrowed, so there is no spelling of
        // this subcommand that returns true.
        for (const command of [
            'agent-config ui:render a.svg --profile asset || true',
            'agent-config ui:render a.svg --profile asset && echo done',
            'npx agent-config ui:render a.svg --profile asset',
        ]) {
            expect(isVerificationCommand(command), command).toBe(false);
        }

        // The predicate still answers TRUE for a real check, so the rows above
        // are about this subcommand and not about a predicate that broke.
        expect(isVerificationCommand('npx vitest run tests/x.test.ts')).toBe(true);
        expect(isVerificationCommand('npx tsc --noEmit')).toBe(true);
    });
});
