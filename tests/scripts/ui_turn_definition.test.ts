/**
 * `ui_turn_definition` — one definition of a UI surface, shared by the
 * measurement and by the things that fire on it.
 *
 * The regression that matters is `.blade.php`. The anti-slop hook's original
 * regex was a single-extension alternation, so a two-part suffix never
 * matched and every Blade template — the largest UI surface a Laravel
 * consumer has — read as a non-UI file. A consultation rate measured with
 * that denominator would have been silently wrong in exactly the ecosystem
 * the two UI rules were written for.
 */
import { describe, expect, it } from 'vitest';

import {
    UI_EXT,
    UI_PATH_FRAGMENTS,
    isUiPath,
    isUiTreePath,
} from '../../src/scripts/_lib/ui_surface.js';

describe('isUiPath', () => {
    it('matches the single-extension UI surfaces', () => {
        for (const p of [
            'src/components/Button.tsx',
            'src/components/Button.jsx',
            'app/page.vue',
            'app/page.svelte',
            'site/index.astro',
            'assets/main.css',
            'assets/main.scss',
            'assets/main.sass',
            'assets/main.less',
            'public/index.html',
            'public/index.htm',
        ]) {
            expect(isUiPath(p), p).toBe(true);
        }
    });

    it('matches the compound Blade suffix that a bare extension check misses', () => {
        expect(isUiPath('resources/views/pages/checkout.blade.php')).toBe(true);
        // The failure mode being guarded: extname() of this path is `.php`.
        expect(isUiPath('app/Http/Controllers/CheckoutController.php')).toBe(false);
    });

    it('is case-insensitive', () => {
        expect(isUiPath('Src/Components/Button.TSX')).toBe(true);
        expect(isUiPath('RESOURCES/VIEWS/x.BLADE.PHP')).toBe(true);
    });

    it('does not match non-UI surfaces', () => {
        for (const p of [
            'src/scripts/lint_design_slop.ts',
            'README.md',
            'package.json',
            'src/skills/fe-design/SKILL.md',
            'styles.css.map',
        ]) {
            expect(isUiPath(p), p).toBe(false);
        }
    });

    it('exposes the same regex the hook consumes', () => {
        expect(UI_EXT.test('a.vue')).toBe(true);
        expect(UI_EXT.test('a.ts')).toBe(false);
    });
});

describe('isUiTreePath', () => {
    it('matches beyond the Laravel pair the rules originally carried', () => {
        expect(isUiTreePath('resources/views/home.blade.php')).toBe(true);
        expect(isUiTreePath('resources/js/app.js')).toBe(true);
        // The consumers that matched no path trigger at all before this.
        expect(isUiTreePath('src/components/Card.tsx')).toBe(true);
        expect(isUiTreePath('apps/web/components/Card.tsx')).toBe(true);
        expect(isUiTreePath('pages/about.vue')).toBe(true);
    });

    it('does not treat `app/` as a UI tree — it is the Laravel backend', () => {
        // The over-fire this guards: `app/` would match every controller,
        // model and job in a Laravel consumer.
        expect(isUiTreePath('app/Http/Controllers/CheckoutController.php')).toBe(false);
        expect(isUiTreePath('app/Models/Order.php')).toBe(false);
        // The Next.js router file it would have caught is caught by extension.
        expect(isUiPath('app/dashboard/page.tsx')).toBe(true);
    });

    it('does not treat `pages/api/` as UI — it is server-only route code', () => {
        // Same class of over-fire as `app/`, one level down: `pages/` is a UI
        // fragment but `pages/api/` under it is not, and this predicate is the
        // pre-registered UI-turn denominator as well as a nudge trigger.
        expect(isUiTreePath('pages/api/users.ts')).toBe(false);
        expect(isUiTreePath('apps/web/pages/api/webhook/stripe.ts')).toBe(false);
        // The sibling page in the same tree is still UI.
        expect(isUiTreePath('pages/about.vue')).toBe(true);
    });

    it('does not match an unrelated tree', () => {
        expect(isUiTreePath('src/scripts/hooks/design_slop_hook.ts')).toBe(false);
        expect(isUiTreePath('docs/contracts/ui-track-flow.md')).toBe(false);
    });

    it('keeps the Laravel fragments the two rules already declared', () => {
        expect(UI_PATH_FRAGMENTS).toContain('resources/views/');
        expect(UI_PATH_FRAGMENTS).toContain('resources/js/');
    });
});
