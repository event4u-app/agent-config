/**
 * OS-follow guard (reciprocal-ecosystem embed contract, Phase 2).
 *
 * `watchSystemTheme()` follows OS light/dark changes only when the user has
 * NOT pinned an explicit theme — a persisted standalone override OR a
 * host-supplied `?theme=` boot query. Under embed the host owns the theme,
 * so an OS flip must not override it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.resetModules(); vi.unstubAllGlobals(); });

/**
 * Deterministic in-memory localStorage stub — the env's happy-dom storage is
 * flaky across `window.location.href` navigation.
 */
function stubStorage(stored?: 'light' | 'dark'): void {
    const store = new Map<string, string>();
    if (stored !== undefined) store.set('agent-config-theme', stored);
    vi.stubGlobal('localStorage', {
        getItem: (k: string): string | null => store.get(k) ?? null,
        setItem: (k: string, v: string): void => { store.set(k, String(v)); },
        removeItem: (k: string): void => { store.delete(k); },
        clear: (): void => { store.clear(); },
        key: (): string | null => null,
        length: 0,
    });
}

async function shouldFollow(url: string, stored?: 'light' | 'dark'): Promise<boolean> {
    vi.resetModules();
    window.location.href = url;
    stubStorage(stored);
    const { shouldFollowSystemTheme } = await import('../../src/ui/theme.js');
    return shouldFollowSystemTheme();
}

describe('shouldFollowSystemTheme', () => {
    it('follows the OS when no explicit theme is pinned (standalone default)', async () => {
        expect(await shouldFollow('http://localhost/')).toBe(true);
    });

    it('does NOT follow the OS when the host supplied ?theme= (host owns theme)', async () => {
        expect(await shouldFollow('http://localhost/?embed=1&theme=dark')).toBe(false);
    });

    it('does NOT follow the OS when a standalone override is persisted', async () => {
        expect(await shouldFollow('http://localhost/', 'light')).toBe(false);
    });

    it('ignores an invalid ?theme= value (falls back to OS-follow)', async () => {
        expect(await shouldFollow('http://localhost/?theme=purple')).toBe(true);
    });
});
