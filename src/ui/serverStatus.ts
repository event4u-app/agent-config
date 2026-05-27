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
    /** @deprecated mirrors `writeRoot` — kept for old bundle compatibility. */
    projectRoot: string;
    writeRoot: string;
    mode: 'package-sandbox' | 'global';
    dryRun: boolean;
    /**
     * `true` when the wizard may offer the "scope to this project only"
     * checkbox in Review (road-to-global-only-install § Phase 2.3). The
     * UI hides the checkbox when `false`. Older server bundles do not
     * send the flag — the parser defaults to `false` so the UI stays
     * safe by hiding the toggle.
     */
    projectScopeAvailable: boolean;
    /** Best-effort OS account name, used to pre-fill the welcome step. */
    systemUser?: string;
}

export const serverStatus = signal<ServerStatus | null>(null);

export async function fetchServerStatus(): Promise<void> {
    try {
        const res = await apiFetch<Partial<ServerStatus> & Pick<ServerStatus, 'ok' | 'version' | 'writeRoot' | 'mode' | 'dryRun' | 'projectRoot'>>(
            '/api/v1/ping',
        );
        // Default `projectScopeAvailable` to false so an older server
        // bundle (pre Phase 2.3) keeps the checkbox hidden — safer than
        // surfacing a toggle that would 422 on submit.
        serverStatus.value = {
            ...res,
            projectScopeAvailable: res.projectScopeAvailable === true,
        };
    } catch {
        // Banner stays hidden on transport errors — the page will surface
        // its own error UI when the user tries to save.
        serverStatus.value = null;
    }
}
