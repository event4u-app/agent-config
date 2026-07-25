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
import { userInfo } from 'node:os';
import { PACKAGE_JSON } from '../../cli/paths.js';
import { CAPABILITIES } from '../../shared/capabilities.js';

function systemUserName(): string {
    try {
        const name = userInfo().username;
        return typeof name === 'string' ? name : '';
    } catch {
        return '';
    }
}

export const PingResponseSchema = z.object({
    ok: z.literal(true),
    version: z.string().min(1),
    /**
     * @deprecated mirrors `writeRoot` — retained so existing UI bundles
     * and integration tests keep parsing. Remove after one release cycle.
     */
    projectRoot: z.string().min(1),
    writeRoot: z.string().min(1),
    mode: z.enum(['package-sandbox', 'global']),
    dryRun: z.boolean(),
    /**
     * `true` when the wizard may offer the "scope to this project only"
     * checkbox in Review (road-to-global-only-install § Phase 2.3). The
     * server hides the checkbox in package-sandbox mode and when the
     * operator pinned `writeRoot` via `--project`.
     */
    projectScopeAvailable: z.boolean(),
    /**
     * Best-effort OS account name (e.g. `matze`), used to pre-fill the
     * welcome step's name field on a fresh wizard. Empty string when the
     * platform does not expose it.
     */
    systemUser: z.string(),
    /**
     * `true` only when the CLI was invoked with an explicit project
     * intent (`config --project`) — the UI shows the Project nav tab
     * exclusively in that case (road-to-setup-experience follow-up).
     * Distinct from `projectScopeAvailable`, which is cwd-inferred.
     */
    projectSurface: z.boolean(),
    /**
     * Maintainer/dev surfaces (Workspace) — shown only when the server
     * runs with AGENT_CONFIG_DEV_MODE=1 (council 2026-07-08 Q2: the
     * beta-internal employee workspace leaves the default nav; the
     * `#/workspace` deep link keeps working regardless).
     */
    devSurfaces: z.boolean(),
    /**
     * Host-facing capability advertisement (reciprocal-ecosystem Phase 2)
     * — a spawner reads `capabilities.configRoot` to detect support for a
     * host-supplied config root, and `capabilities.embed` to detect the
     * `?embed=1` embed contract, before relying on either. An older server
     * omits this block, so a newer host degrades to "not supported". The
     * shape mirrors `Capabilities` in `src/shared/capabilities.ts`.
     */
    capabilities: z.object({
        configRoot: z.boolean(),
        embed: z.object({
            supported: z.boolean(),
            version: z.number(),
            features: z.array(z.enum(['theme', 'deepLink'])),
        }),
    }),
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
    writeRoot: string;
    /**
     * Consumer-project root the wizard may opt to scope to. `null` when
     * no opt-in is available — the UI then hides the scope checkbox.
     */
    projectScopeRoot?: string | null;
    mode: 'package-sandbox' | 'global';
    /** Server-wide dry-run flag — surfaced to the UI for the banner. */
    dryRun?: boolean;
    /** Explicit project intent from the CLI (`config --project`). */
    projectSurface?: boolean;
}

export function pingRoute(opts: PingRouteOptions): FastifyPluginAsync {
    const plugin: FastifyPluginAsync = async (app: FastifyInstance) => {
        app.get('/api/v1/ping', async () => {
            const response: PingResponse = {
                ok: true,
                version: readPackageVersion(),
                projectRoot: opts.writeRoot,
                writeRoot: opts.writeRoot,
                mode: opts.mode,
                dryRun: opts.dryRun === true,
                projectScopeAvailable: opts.projectScopeRoot !== undefined && opts.projectScopeRoot !== null,
                systemUser: systemUserName(),
                projectSurface: opts.projectSurface === true,
                devSurfaces: (process.env['AGENT_CONFIG_DEV_MODE'] ?? '') === '1',
                capabilities: { ...CAPABILITIES },
            };
            return response;
        });
    };
    return plugin;
}
