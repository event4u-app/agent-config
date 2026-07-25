/**
 * Post-boot token-strip hardening (reciprocal-ecosystem embed contract,
 * Phase 2).
 *
 * The SPA bootstraps by reading `?token=` from the page URL (`main.tsx`).
 * Once the token is set on the API client it no longer needs to linger in
 * the address bar, the webview navigation history, or a copy-pasted URL,
 * so this removes the `token` param via `history.replaceState`. Only the
 * `token` param is dropped — the path, every other query param (`embed`,
 * `theme`), and the hash route (`#/settings/<section>`) are preserved.
 *
 * Applies to standalone and embedded boots alike; no behaviour change
 * beyond the URL cosmetic. `src/ui/**` is a browser bundle — no Node
 * built-ins, no I/O.
 */

/** Strip the `?token=` credential from the current URL after boot. */
export function stripTokenFromUrl(): void {
    if (typeof window === 'undefined' || typeof window.history?.replaceState !== 'function') return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('token')) return;
    params.delete('token');
    const query = params.toString();
    const next = window.location.pathname + (query ? `?${query}` : '') + window.location.hash;
    window.history.replaceState(window.history.state, '', next);
}
