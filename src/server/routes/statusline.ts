/**
 * `GET|POST /api/v1/wizard/statusline` — the one offer of the quota status-line tap.
 *
 * Council decision on OQ-19 (2026-10-26, 2/2): `setup` offers the tap once,
 * defaulting to yes, and writes nothing into `~/.claude/settings.json` without
 * that answer. The answer is remembered beside the quota ledger, so a declined
 * offer is not repeated and an accepted one is not re-applied; uninstalling
 * stays `agent-config statusline:uninstall`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import * as z from 'zod';

import { claudeSettingsPath, installTap, TAP_COMMAND } from '../../scripts/_cli/cmd_statusline.js';
import { write_atomic } from '../../scripts/_lib/fs_atomic.js';
import { quotaStateDir } from '../../scripts/_lib/quota_ledger.js';
import type { EnvMap } from '../../scripts/_lib/user_global_paths.js';

export const StatuslineOfferSchema = z.object({
    state: z.enum(['offer', 'installed', 'declined']),
    settings_path: z.string(),
    has_existing: z.boolean(),
});
export type StatuslineOffer = z.infer<typeof StatuslineOfferSchema>;

const ApplyBodySchema = z.object({ install: z.boolean() });

function offerPath(env?: EnvMap | null): string {
    return path.join(quotaStateDir(env), 'statusline-offer.json');
}

function currentStatusLine(file: string): unknown {
    try {
        const o = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown> | null;
        return o?.['statusLine'];
    } catch {
        return undefined;
    }
}

export function readOffer(env?: EnvMap | null): StatuslineOffer {
    const file = claudeSettingsPath(env);
    const sl = currentStatusLine(file);
    const command = sl !== null && typeof sl === 'object' ? (sl as Record<string, unknown>)['command'] : undefined;
    const installed = typeof command === 'string' && command.trim().startsWith(TAP_COMMAND);
    let declined = false;
    try {
        declined = (JSON.parse(fs.readFileSync(offerPath(env), 'utf-8')) as { decision?: unknown }).decision === 'declined';
    } catch {
        declined = false;
    }
    return {
        state: installed ? 'installed' : declined ? 'declined' : 'offer',
        settings_path: file,
        has_existing: !installed && sl !== undefined && sl !== null,
    };
}

export function applyOffer(install: boolean, env?: EnvMap | null): { ok: boolean; message: string } {
    if (!install) {
        write_atomic(offerPath(env), JSON.stringify({ decision: 'declined', at: new Date().toISOString() }));
        return { ok: true, message: 'Not added. `agent-config statusline:install` adds it later.' };
    }
    const r = installTap(env);
    if (r.code === 0) write_atomic(offerPath(env), JSON.stringify({ decision: 'installed', at: new Date().toISOString() }));
    return { ok: r.code === 0, message: r.message };
}

export interface StatuslineRouteOptions {
    readonly dryRun?: boolean;
    readonly env?: EnvMap | null;
}

export function statuslineRoute(opts: StatuslineRouteOptions = {}): FastifyPluginAsync {
    return async (app: FastifyInstance): Promise<void> => {
        app.get('/api/v1/wizard/statusline', async () => readOffer(opts.env));
        app.post('/api/v1/wizard/statusline', async (request, reply) => {
            const parsed = ApplyBodySchema.safeParse(request.body);
            if (!parsed.success) return reply.code(400).send({ ok: false, message: 'body must be { install: boolean }' });
            if (opts.dryRun === true) {
                return { ok: true, message: `Dry-run: ${parsed.data.install ? 'would add' : 'would not add'} the status-line tap.` };
            }
            const r = applyOffer(parsed.data.install, opts.env);
            return reply.code(r.ok ? 200 : 500).send(r);
        });
    };
}
