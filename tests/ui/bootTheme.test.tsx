/**
 * Pre-paint theme stamp (reciprocal-ecosystem embed contract, Phase 2).
 *
 * Executes the REAL inline boot snippet from `src/ui/index.html` — the one
 * that runs before first paint — so this locks the shipped precedence with
 * zero drift: a host-supplied `?theme=light|dark` wins, then a persisted
 * localStorage override, then the OS preference. Applied at boot → no flash.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** The inline pre-paint boot snippet, extracted from the shipped index.html. */
const BOOT_SNIPPET = (() => {
    const html = readFileSync(resolve(process.cwd(), 'src/ui/index.html'), 'utf8');
    const m = /<script>([\s\S]*?)<\/script>/.exec(html);
    if (m === null) throw new Error('index.html: pre-paint boot <script> not found');
    return m[1] as string;
})();

/**
 * Deterministic in-memory localStorage stub. The env's happy-dom storage is
 * flaky across `window.location.href` navigation, so we control it directly.
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

/** Run the boot snippet against a given URL and return the stamped theme. */
function runBoot(url: string, stored?: 'light' | 'dark'): string | null {
    window.location.href = url;
    stubStorage(stored);
    document.documentElement.removeAttribute('data-theme');
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function(BOOT_SNIPPET)();
    return document.documentElement.getAttribute('data-theme');
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('index.html pre-paint theme stamp', () => {
    it('?theme=dark stamps data-theme="dark"', () => {
        expect(runBoot('http://localhost/?theme=dark')).toBe('dark');
    });

    it('?theme=light stamps data-theme="light"', () => {
        expect(runBoot('http://localhost/?theme=light')).toBe('light');
    });

    it('?theme= wins over a persisted localStorage override (host owns the theme)', () => {
        expect(runBoot('http://localhost/?embed=1&theme=dark', 'light')).toBe('dark');
    });

    it('an invalid ?theme= value falls through to the persisted override', () => {
        expect(runBoot('http://localhost/?theme=purple', 'dark')).toBe('dark');
    });

    it('without ?theme= the persisted override still wins (standalone unchanged)', () => {
        expect(runBoot('http://localhost/#/settings', 'dark')).toBe('dark');
    });
});
