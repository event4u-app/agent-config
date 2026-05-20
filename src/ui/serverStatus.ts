/**
 * Server-status signal — single `GET /api/v1/ping` on boot, cached as a
 * Preact signal so the App shell can show a `DRY RUN` banner when the
 * server was launched with `--dry-run`.
 *
 * Roadmap reference: `agents/roadmaps/onboarding-wizard-takeover.md`
 * Phase 1 (dry-run mode).
 */

import { signal } from '@preact/signals';
import { apiFetch } from './api.js';

export interface ServerStatus {
    ok: true;
    version: string;
    projectRoot: string;
    dryRun: boolean;
}

export const serverStatus = signal<ServerStatus | null>(null);

export async function fetchServerStatus(): Promise<void> {
    try {
        const res = await apiFetch<ServerStatus>('/api/v1/ping');
        serverStatus.value = res;
    } catch {
        // Banner stays hidden on transport errors — the page will surface
        // its own error UI when the user tries to save.
        serverStatus.value = null;
    }
}
