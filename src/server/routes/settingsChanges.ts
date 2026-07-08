/**
 * Pending settings-surface delta routes
 * (road-to-settings-change-review; council 2026-07-08).
 *
 *   GET  /api/v1/settings/changes      → pending SurfaceDelta or 404
 *   POST /api/v1/settings/changes/ack  → clear the pending delta
 *
 * The delta file is written by the installer when an upgrade changes the
 * settings surface (`state/settings-delta.json` under the global root).
 * The review page classifies each change against the user's current
 * values client-side via the shared `settingsSurface` module; the server
 * only serves and clears the flag. In package-sandbox mode the read
 * falls back to the real user-global root (consistent with the settings
 * prefill fallback) — ack never deletes outside the writeRoot.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { SurfaceDelta } from '../../shared/settingsSurface.js';

const DELTA_REL = join('state', 'settings-delta.json');

export interface SettingsChangesRouteOptions {
    writeRoot: string;
    /** Read-only user-global fallback (package-sandbox mode). */
    userGlobalReadRoot?: string | null;
    /** Dry-run — ack returns a preview and deletes nothing. */
    dryRun?: boolean;
}

async function readDelta(path: string): Promise<SurfaceDelta | null> {
    try {
        const raw = await fs.readFile(path, 'utf8');
        const parsed = JSON.parse(raw) as SurfaceDelta;
        if (Array.isArray(parsed.changes)) return parsed;
        return null;
    } catch {
        return null;
    }
}

export function settingsChangesRoute(opts: SettingsChangesRouteOptions): FastifyPluginAsync {
    const plugin: FastifyPluginAsync = async (app: FastifyInstance) => {
        app.get('/api/v1/settings/changes', async (_request, reply) => {
            const primary = join(opts.writeRoot, DELTA_REL);
            let delta = await readDelta(primary);
            let source: 'writeRoot' | 'userGlobal' = 'writeRoot';
            if (delta === null && opts.userGlobalReadRoot && opts.userGlobalReadRoot !== opts.writeRoot) {
                delta = await readDelta(join(opts.userGlobalReadRoot, DELTA_REL));
                source = 'userGlobal';
            }
            if (delta === null) {
                await reply.code(404).send({ error: { code: 'NO_PENDING_CHANGES', message: 'no pending settings-surface delta' } });
                return reply;
            }
            return { delta, source };
        });

        app.post('/api/v1/settings/changes/ack', async (_request, reply) => {
            const primary = join(opts.writeRoot, DELTA_REL);
            if (opts.dryRun === true) {
                return { ok: true, dryRun: true, cleared: false };
            }
            try {
                await fs.unlink(primary);
                return { ok: true, cleared: true };
            } catch (err) {
                if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
                    // Sandbox fallback reads never delete the real machine's
                    // delta — reviewing in a sandbox resolves the sandbox only.
                    return { ok: true, cleared: false };
                }
                const message = err instanceof Error ? err.message : 'ack failed';
                await reply.code(500).send({ error: { code: 'ACK_FAILED', message } });
                return reply;
            }
        });
    };
    return plugin;
}
