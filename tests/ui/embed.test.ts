/**
 * Embed boot-flag reader (reciprocal-ecosystem embed contract, Phase 1).
 *
 * `?embed=1` opts the page into embed mode; anything else (absent, other
 * values) is standalone. `vi.resetModules()` + dynamic import re-reads the
 * flag off the URL set for each case, matching how `main.tsx` reads it once
 * at boot.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.resetModules(); });

async function readEmbedFor(url: string): Promise<boolean> {
    vi.resetModules();
    window.location.href = url;
    const { readEmbed } = await import('../../src/ui/embed.js');
    return readEmbed();
}

describe('readEmbed', () => {
    it('is true with ?embed=1', async () => {
        expect(await readEmbedFor('http://localhost/?embed=1')).toBe(true);
    });

    it('is true when ?embed=1 sits alongside token/theme/hash', async () => {
        expect(await readEmbedFor('http://localhost/?token=abc&embed=1&theme=dark#/settings')).toBe(true);
    });

    it('is false without the query', async () => {
        expect(await readEmbedFor('http://localhost/#/settings')).toBe(false);
    });

    it('is false for other embed values (only "1" opts in)', async () => {
        expect(await readEmbedFor('http://localhost/?embed=0')).toBe(false);
        expect(await readEmbedFor('http://localhost/?embed=true')).toBe(false);
    });

    it('the module-level `embed` const reflects the boot URL', async () => {
        vi.resetModules();
        window.location.href = 'http://localhost/?embed=1';
        const mod = await import('../../src/ui/embed.js');
        expect(mod.embed).toBe(true);
    });
});
