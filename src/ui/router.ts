/**
 * Minimal hash-router built on Preact signals.
 *
 * The GUI runs on `127.0.0.1` only — hash routing keeps the Fastify
 * server free of catch-all routes for the SPA. ADR-014 picks hash over
 * History API for that reason.
 *
 * Public API:
 *   - `route` — Signal<string> with the current hash path (e.g. `/settings`).
 *   - `navigate(path)` — programmatic navigation; updates location.hash.
 *   - `initRouter()` — wires `hashchange` once; idempotent.
 */

import { signal } from '@preact/signals';

function readHash(): string {
    const raw = window.location.hash;
    if (raw === '' || raw === '#') return '/';
    return raw.startsWith('#') ? raw.slice(1) : raw;
}

export const route = signal<string>(readHash());

export function navigate(path: string): void {
    const next = path.startsWith('/') ? path : `/${path}`;
    if (`#${next}` === window.location.hash) return;
    window.location.hash = next;
}

let initialised = false;

export function initRouter(): void {
    if (initialised) return;
    initialised = true;
    window.addEventListener('hashchange', () => {
        route.value = readHash();
    });
}
