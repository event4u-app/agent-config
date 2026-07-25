/**
 * Theme runtime (road-to-setup-experience § Phase 4.2).
 *
 * The boot snippet in `index.html` sets `data-theme` on `<html>` before
 * first paint (persisted override wins, OS preference otherwise). This
 * module owns the runtime side: the reactive signal, the toggle, and the
 * OS-change listener for users without an explicit override.
 */

import { signal } from '@preact/signals';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'agent-config-theme';

function readInitialTheme(): Theme {
    const attr = typeof document !== 'undefined'
        ? document.documentElement.getAttribute('data-theme')
        : null;
    return attr === 'dark' ? 'dark' : 'light';
}

export const theme = signal<Theme>(readInitialTheme());

function storedOverride(): Theme | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw === 'light' || raw === 'dark' ? raw : null;
    } catch {
        return null;
    }
}

/**
 * Host-supplied `?theme=light|dark` boot override (reciprocal-ecosystem
 * embed contract, Phase 2). When a host opens the page with `?theme=`, the
 * host owns the theme — the same query the pre-paint stamp in `index.html`
 * reads at boot.
 */
function urlThemeOverride(): Theme | null {
    if (typeof window === 'undefined') return null;
    try {
        const q = new URLSearchParams(window.location.search).get('theme');
        return q === 'light' || q === 'dark' ? q : null;
    } catch {
        return null;
    }
}

/**
 * OS light/dark changes are followed only when the user has NOT pinned an
 * explicit theme — either a persisted standalone override or a host-supplied
 * `?theme=` boot query. An explicit theme (stored or host-owned) wins over
 * the OS preference. Exported for direct unit coverage.
 */
export function shouldFollowSystemTheme(): boolean {
    return storedOverride() === null && urlThemeOverride() === null;
}

function apply(next: Theme): void {
    theme.value = next;
    document.documentElement.setAttribute('data-theme', next);
}

/** Flip the theme and persist the explicit choice. */
export function toggleTheme(): void {
    const next: Theme = theme.value === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* private mode */ }
    apply(next);
}

/**
 * Follow OS theme changes while the user has no explicit override.
 * Called once from `main.tsx`.
 */
export function watchSystemTheme(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (): void => {
        if (!shouldFollowSystemTheme()) return;
        apply(mq.matches ? 'dark' : 'light');
    };
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
}
