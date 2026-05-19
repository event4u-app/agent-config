/**
 * `GET /api/v1/discovery/manifest` — release-time discovery manifest.
 *
 * Returns the parsed manifest (verbatim) or a single slice when the
 * `?slice=` query parameter is set. Slices: `workspaces`, `packs`,
 * `artefacts`, `unassigned`.
 *
 * Behaviour when the manifest is missing on disk:
 *   - HTTP 503 + `{ error: 'discovery manifest not available' }`.
 *
 * The route never crashes the server — absence is operator error
 * (PR working tree, dev install) rather than a runtime bug. See ADR-013
 * and the R3 roadmap for the broader contract.
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
    loadManifest,
    ManifestNotFoundError,
    ManifestParseError,
    type DiscoveryManifest,
} from '../../cli/discovery/loadManifest.js';

export const DiscoverySliceSchema = z.enum(['workspaces', 'packs', 'artefacts', 'unassigned']);
export type DiscoverySlice = z.infer<typeof DiscoverySliceSchema>;

export interface DiscoveryRouteOptions {
    /** Override the on-disk manifest path (tests only). */
    manifestPath?: string;
}

function pickSlice(
    manifest: DiscoveryManifest,
    slice: DiscoverySlice,
): Record<string, unknown> {
    switch (slice) {
        case 'workspaces':
            return { workspaces: manifest.workspaces };
        case 'packs':
            return { packs: manifest.packs };
        case 'artefacts':
            return { artefacts: manifest.artefacts };
        case 'unassigned':
            return { unassigned: manifest.unassigned };
    }
}

export function discoveryRoute(opts: DiscoveryRouteOptions = {}): FastifyPluginAsync {
    const plugin: FastifyPluginAsync = async (app: FastifyInstance) => {
        app.get('/api/v1/discovery/manifest', async (request, reply) => {
            let manifest: DiscoveryManifest;
            try {
                manifest = loadManifest(opts.manifestPath ? { path: opts.manifestPath } : {});
            } catch (err) {
                if (err instanceof ManifestNotFoundError) {
                    await reply.code(503).send({
                        error: 'discovery manifest not available',
                        detail: `expected at ${err.path}`,
                    });
                    return reply;
                }
                if (err instanceof ManifestParseError) {
                    await reply.code(500).send({
                        error: 'discovery manifest is malformed',
                        detail: err.message,
                    });
                    return reply;
                }
                throw err;
            }

            const query = request.query as Record<string, unknown> | undefined;
            const sliceRaw = typeof query?.['slice'] === 'string' ? (query['slice'] as string) : undefined;
            if (sliceRaw !== undefined) {
                const parsed = DiscoverySliceSchema.safeParse(sliceRaw);
                if (!parsed.success) {
                    await reply.code(400).send({
                        error: 'invalid slice parameter',
                        detail: `slice must be one of: workspaces, packs, artefacts, unassigned`,
                    });
                    return reply;
                }
                return pickSlice(manifest, parsed.data);
            }

            return manifest;
        });
    };
    return plugin;
}
