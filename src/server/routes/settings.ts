/**
 * `.agent-settings.yml` read / diff / write routes.
 *
 * Contract: `docs/contracts/settings-api.md`.
 *
 *   GET  /api/v1/settings        → `{ values, lastModified, path }`
 *   POST /api/v1/settings/diff   → `{ changes: [...] }` (preview, no write)
 *   PUT  /api/v1/settings        → atomic write; requires `If-Unmodified-Since`
 *
 * Optimistic locking: every write echoes the on-disk `mtimeMs` (truncated to
 * integer) and rejects PUTs whose `If-Unmodified-Since` header lags the
 * current value (HTTP 409). The body of a 409 includes the latest disk state
 * so the SPA can render a 3-way merge without a second roundtrip.
 *
 * Validation: every PUT body is parsed through `settingsSchema`. Failures
 * become HTTP 422 with `error.fields` populated from the Zod issue tree.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { promises as fs } from 'node:fs';
import type { Stats } from 'node:fs';
import { join } from 'node:path';
import type { ZodIssue } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { settingsSchema } from '../schemas/settings.js';
import { parseYaml, mergeIntoTemplate, diffValues } from '../io/yamlIO.js';
import { writeAtomic } from '../io/atomicWrite.js';

// Computed once — Zod → JSON Schema conversion is pure and the schema is static.
const SETTINGS_JSON_SCHEMA = zodToJsonSchema(settingsSchema, {
    name: 'AgentSettings',
    $refStrategy: 'none',
    target: 'jsonSchema7',
});

export interface SettingsRouteOptions {
    /** Project root — `.agent-settings.yml` resolves under this. */
    projectRoot: string;
    /**
     * Dry-run — PUT validates, merges, and returns `{ preview, dryRun }`
     * with the rendered would-be body; no `writeAtomic`, no `Last-Modified`
     * bump. Subsequent real runs start from the same baseline.
     */
    dryRun?: boolean;
}

const SETTINGS_RELATIVE = '.agent-settings.yml';

function settingsPath(root: string): string {
    return join(root, SETTINGS_RELATIVE);
}

interface ReadState {
    raw: string;
    values: Record<string, unknown>;
    mtimeMs: number;
}

async function readSettings(root: string): Promise<ReadState | null> {
    const path = settingsPath(root);
    let stat: Stats;
    let raw: string;
    try {
        [stat, raw] = await Promise.all([fs.stat(path), fs.readFile(path, 'utf8')]);
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
    }
    const values = parseYaml(raw);
    return { raw, values, mtimeMs: Math.trunc(stat.mtimeMs) };
}

function zodIssuesToFields(issues: ZodIssue[]): Array<{ path: string; message: string }> {
    return issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

function readIfUnmodified(header: unknown): number | null {
    if (typeof header !== 'string') return null;
    const n = Number.parseInt(header, 10);
    return Number.isFinite(n) ? n : null;
}

export function settingsRoute(opts: SettingsRouteOptions): FastifyPluginAsync {
    const plugin: FastifyPluginAsync = async (app: FastifyInstance) => {
        app.get('/api/v1/settings', async (_request, reply) => {
            try {
                const state = await readSettings(opts.projectRoot);
                if (state === null) {
                    await reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'settings file missing' } });
                    return reply;
                }
                return {
                    values: state.values,
                    lastModified: state.mtimeMs,
                    path: SETTINGS_RELATIVE,
                    schema: SETTINGS_JSON_SCHEMA,
                };
            } catch (err) {
                const message = err instanceof Error ? err.message : 'YAML parse failed';
                await reply.code(500).send({ error: { code: 'YAML_PARSE', message } });
                return reply;
            }
        });

        app.post('/api/v1/settings/diff', async (request, reply) => {
            const body = (request.body ?? {}) as { values?: unknown; ifUnmodifiedSince?: unknown };
            const parsed = settingsSchema.safeParse(body.values);
            if (!parsed.success) {
                await reply.code(422).send({
                    error: { code: 'VALIDATION', message: 'invalid settings', fields: zodIssuesToFields(parsed.error.issues) },
                });
                return reply;
            }
            const current = await readSettings(opts.projectRoot);
            if (current === null) {
                await reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'settings file missing' } });
                return reply;
            }
            const ius = typeof body.ifUnmodifiedSince === 'number' ? body.ifUnmodifiedSince : null;
            if (ius !== null && ius < current.mtimeMs) {
                await reply.code(409).send({
                    error: { code: 'CONFLICT', message: 'on-disk file has been modified' },
                    current: { values: current.values, lastModified: current.mtimeMs },
                });
                return reply;
            }
            const changes = diffValues(current.values, parsed.data as Record<string, unknown>);
            return { changes };
        });

        app.put('/api/v1/settings', async (request, reply) => {
            const ius = readIfUnmodified(request.headers['if-unmodified-since']);
            if (ius === null) {
                await reply.code(412).send({ error: { code: 'PRECONDITION_REQUIRED', message: 'If-Unmodified-Since header required' } });
                return reply;
            }
            const body = (request.body ?? {}) as { values?: unknown };
            const parsed = settingsSchema.safeParse(body.values);
            if (!parsed.success) {
                await reply.code(422).send({
                    error: { code: 'VALIDATION', message: 'invalid settings', fields: zodIssuesToFields(parsed.error.issues) },
                });
                return reply;
            }
            const current = await readSettings(opts.projectRoot);
            if (current === null) {
                await reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'settings file missing' } });
                return reply;
            }
            if (ius < current.mtimeMs) {
                await reply.code(409).send({
                    error: { code: 'CONFLICT', message: 'on-disk file has been modified' },
                    current: { values: current.values, lastModified: current.mtimeMs },
                });
                return reply;
            }
            try {
                const merged = mergeIntoTemplate(current.raw, parsed.data as Record<string, unknown>);
                if (opts.dryRun === true) {
                    // No disk write, no Last-Modified bump — surface the
                    // rendered body so the maintainer sees what a real
                    // PUT would have written.
                    return {
                        dryRun: true,
                        lastModified: current.mtimeMs,
                        preview: { path: SETTINGS_RELATIVE, body: merged },
                    };
                }
                const path = settingsPath(opts.projectRoot);
                await writeAtomic(path, merged, { mode: 0o600 });
                const stat = await fs.stat(path);
                return { lastModified: Math.trunc(stat.mtimeMs), writtenPaths: [SETTINGS_RELATIVE] };
            } catch (err) {
                const message = err instanceof Error ? err.message : 'atomic write failed';
                await reply.code(500).send({ error: { code: 'ATOMIC_WRITE', message } });
                return reply;
            }
        });
    };
    return plugin;
}
