import { describe, expect, it } from 'vitest';

import { isVerificationCommand } from '../../src/scripts/_lib/verification_command.js';

/**
 * Step 3.5 of `road-to-svg-with-a-witness` — the turn-end gate learns the check
 * that actually looks at the file, and deliberately does not learn the one that
 * only parses it.
 *
 * The measured failure this pins (S6): a session converting a raster logo to
 * SVG had its turn-end gate refuse twice, and both times answered with
 * `xmllint --noout` plus a report that the SVG "is valid". A file can parse and
 * still be the wrong picture. Before this change an `.svg` edit could satisfy
 * the gate with a syntax check or not at all — `isVerificationCommand` returned
 * `false` for `ui:render` as well, so there was no honest way through.
 *
 * Both directions were observed RED before the change: the asset-render rows
 * returned `false` and were the gap; the `xmllint` rows already returned
 * `false` and are kept here so a later widening of the predicate cannot quietly
 * admit a parser as a visual check.
 */
describe('asset-render-verifies-and-xmllint-does-not', () => {
    it('asset-render-verifies-and-xmllint-does-not', () => {
        // --- accepted: the render that binds a manifest to the file's digest ---
        for (const command of [
            'agent-config ui:render assets/logo.svg --profile asset',
            './agent-config ui:render assets/logo.svg --profile asset',
            './agent-config ui:render assets/logo.svg --profile asset --json',
        ]) {
            expect(isVerificationCommand(command), command).toBe(true);
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

        // --- the discard rule still applies -----------------------------------
        // A render whose failure the shell throws away proves nothing, exactly
        // as it does for every other verification command.
        expect(
            isVerificationCommand('agent-config ui:render a.svg --profile asset || true'),
        ).toBe(false);
    });
});
