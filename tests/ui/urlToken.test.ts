/**
 * Post-boot token-strip hardening (reciprocal-ecosystem embed contract,
 * Phase 2). After the SPA reads `?token=` at boot it removes only that
 * param from the URL, preserving the path, every other query param, and the
 * hash route — in both standalone and embedded boots.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { stripTokenFromUrl } from '../../src/ui/urlToken.js';

beforeEach(() => { window.location.href = 'http://localhost/'; });

describe('stripTokenFromUrl', () => {
    it('removes the token param after boot', () => {
        window.location.href = 'http://localhost/?token=deadbeef';
        stripTokenFromUrl();
        expect(window.location.search).toBe('');
        expect(new URLSearchParams(window.location.search).has('token')).toBe(false);
    });

    it('preserves embed, theme, and the hash route (embedded boot)', () => {
        window.location.href = 'http://localhost/?token=deadbeef&embed=1&theme=dark#/settings/personal';
        stripTokenFromUrl();
        const params = new URLSearchParams(window.location.search);
        expect(params.has('token')).toBe(false);
        expect(params.get('embed')).toBe('1');
        expect(params.get('theme')).toBe('dark');
        expect(window.location.hash).toBe('#/settings/personal');
    });

    it('is a no-op when no token is present (standalone, already stripped)', () => {
        window.location.href = 'http://localhost/?embed=1#/settings';
        stripTokenFromUrl();
        expect(window.location.search).toBe('?embed=1');
        expect(window.location.hash).toBe('#/settings');
    });

    it('strips only the token when it is the last of several params', () => {
        window.location.href = 'http://localhost/?theme=light&token=cafe#/setup';
        stripTokenFromUrl();
        expect(window.location.search).toBe('?theme=light');
        expect(window.location.hash).toBe('#/setup');
    });
});
