import { describe, expect, it } from 'vitest';

import { isUiSurface } from '../../src/scripts/hooks/design_pass_hook.js';
import { isUiWrite } from '../../src/scripts/hooks/ui_route_nudge_hook.js';
import { UI_EXTENSIONS, isUiPath } from '../../src/scripts/_lib/ui_surface.js';
import { scanSvg } from '../../src/scripts/_lib/svg_rules.js';

/**
 * Step 1.4 of `road-to-svg-with-a-witness` — DEFERRED, and this file is what
 * keeps the deferral honest rather than invisible.
 *
 * The step routes an `.svg` write to the SVG rules inside `design_pass_hook`.
 * It was implemented, measured, reviewed and withdrawn in the same change. The
 * measurement: importing the rule set into that hook adds 30,924 bytes to
 * `dist/hooks/dispatch.js`, the single bundle every hook event loads on every
 * dispatch, which is 12,931 past the byte ceiling that exists to police exactly
 * that. A ceiling raise was proposed and an independent two-provider council
 * refused it 2/2 on 2026-10-11: `confirmed-non-expanding` on authority, refused
 * on the engineering, and both seats named the same sequencing — extract the
 * rules, settle the loading strategy with a prototype and runtime measurements,
 * ratify any budget change, and enable the routing last. A follow-up roadmap
 * carries the step and that verdict.
 *
 * What this file pins is the half that survived, and it is the half that would
 * have been the expensive mistake:
 *
 *   `UI_EXTENSIONS` must NOT gain `svg`. That was the obvious way to make the
 *   design pass see an `.svg`, and it would also have changed
 *   `ui_route_nudge_hook`'s `isUiWrite`, because the two read the same
 *   predicate — so every icon dropped into `public/` would start drawing a UI
 *   routing nudge and its tokens, on every asset write in the tree (decision
 *   E10, Risk 4). A later attempt at step 1.4 that reaches for the predicate
 *   reds here.
 */
describe('step 1.4 is deferred, and the predicate it must not widen', () => {
    it('UI_EXTENSIONS does not carry svg, in either direction', () => {
        expect(UI_EXTENSIONS as readonly string[]).not.toContain('svg');
        expect(isUiPath('assets/logo.svg')).toBe(false);
        expect(isUiPath('components/logo.svg')).toBe(false);

        const write = (file: string) => ({ isWrite: true, file }) as Parameters<typeof isUiWrite>[0];
        expect(isUiWrite(write('assets/logo.svg'))).toBe(false);
        expect(isUiWrite(write('public/logo.svg'))).toBe(false);
        // Unchanged for the UI-tree case, which is what "unchanged" has to mean
        // in both directions — a predicate pinned only on the false side can be
        // satisfied by breaking it.
        expect(isUiWrite(write('components/logo.svg'))).toBe(true);
        expect(isUiWrite(write('components/Logo.tsx'))).toBe(true);
    });

    it('the design pass still reaches an .svg inside a UI tree — and learns nothing there', () => {
        // This is the defect the deferred step closes, pinned so the deferral
        // describes something real. `components/logo.svg` ALREADY reaches the
        // pass; what it meets there is `lint_design_slop`, which holds zero SVG
        // rules. An `.svg` outside a UI tree does not reach it at all.
        expect(isUiSurface('components/logo.svg')).toBe(true);
        expect(isUiSurface('assets/logo.svg')).toBe(false);
        expect(isUiSurface('public/logo.svg')).toBe(false);
    });

    it('the rules the step would have routed to are shipped and work', () => {
        // The extraction landed; only the hook import did not. A consumer
        // reaches these through `lint_svg_asset` today, and the follow-up has a
        // working rule set to route to rather than a rewrite.
        const defective = `<svg viewBox="0 0 24 24">\n  <circle cx="12" cy="12" r="6" fill="url(#nope)" />\n</svg>\n`;
        const rules = scanSvg(defective, 'assets/logo.svg', { delivery: 'inline' }).map((f) => f.rule);
        expect(rules).toContain('svg-structure-dangling-reference');
        expect(rules).toContain('svg-a11y-no-accessible-name');
        expect(rules).toContain('svg-structure-missing-xmlns');
    });
});
