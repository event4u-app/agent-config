/**
 * `GET /api/v1/ping` — server liveness probe.
 *
 * Returns the package version + projectRoot so consumers (the UI
 * bundle, future Roadmap-2 wizard, CI smoke tests) can verify they
 * are connected to the right process. The zod schema is exported so
 * tests assert against the same source of truth as the handler.
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { PACKAGE_JSON } from '../../cli/paths.js';

export const PingResponseSchema = z.object({
    ok: z.literal(true),
    version: z.string().min(1),
    projectRoot: z.string().min(1),
    dryRun: z.boolean(),
});

export type PingResponse = z.infer<typeof PingResponseSchema>;

function readPackageVersion(): string {
    try {
        const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')) as { version?: unknown };
        return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
    } catch {
        return '0.0.0';
    }
}

export interface PingRouteOptions {
    projectRoot: string;
    /** Server-wide dry-run flag — surfaced to the UI for the banner. */
    dryRun?: boolean;
}

export function pingRoute(opts: PingRouteOptions): FastifyPluginAsync {
    const plugin: FastifyPluginAsync = async (app: FastifyInstance) => {
        app.get('/api/v1/ping', async () => {
            const response: PingResponse = {
                ok: true,
                version: readPackageVersion(),
                projectRoot: opts.projectRoot,
                dryRun: opts.dryRun === true,
            };
            return response;
        });
    };
    return plugin;
}
