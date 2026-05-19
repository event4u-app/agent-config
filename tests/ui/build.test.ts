/**
 * Tests for the Vite UI build artefacts.
 *
 * Roadmap Phase 4 acceptance: `dist/ui/index.html` exists, references
 * a hashed asset bundle, and the bundle is non-empty.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const UI_DIST = resolve(process.cwd(), 'dist/ui');

describe('UI build artefacts', () => {
    it('dist/ui/index.html exists', () => {
        expect(existsSync(resolve(UI_DIST, 'index.html'))).toBe(true);
    });

    it('index.html references a hashed JS bundle under assets/', () => {
        const html = readFileSync(resolve(UI_DIST, 'index.html'), 'utf8');
        // Vite output: <script type="module" crossorigin src="/assets/index-<hash>.js">
        expect(html).toMatch(/src="\/assets\/index-[A-Za-z0-9_-]+\.js"/);
    });

    it('the referenced JS bundle exists and is non-empty', () => {
        const html = readFileSync(resolve(UI_DIST, 'index.html'), 'utf8');
        const m = /src="\/(assets\/index-[A-Za-z0-9_-]+\.js)"/.exec(html);
        expect(m).not.toBeNull();
        const bundlePath = resolve(UI_DIST, m![1] as string);
        expect(existsSync(bundlePath)).toBe(true);
        expect(statSync(bundlePath).size).toBeGreaterThan(0);
    });
});
