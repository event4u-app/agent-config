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
    /** Write root — every PUT lands here as `.agent-settings.yml`. */
    writeRoot: string;
    /**
     * Legacy-read fallback root. When GET / diff / PUT find no file under
     * `writeRoot`, the read is retried under `legacyReadRoot`. A PUT that
     * promoted from the legacy location silently migrates by writing the
     * merged body to `writeRoot` (legacy file is left untouched — the
     * next read prefers `writeRoot` once it exists).
     */
    legacyReadRoot?: string | null;
    /**
     * Dry-run — PUT validates, merges, and returns `{ preview, dryRun }`
     * with the rendered would-be body; no `writeAtomic`, no `Last-Modified`
     * bump. Subsequent real runs start from the same baseline.
     */
    dryRun?: boolean;
}

const SETTINGS_RELATIVE = join('settings', '.agent-settings.yml');
/** Pre-typed-subdir flat-root location. Read as fallback for migration. */
const LEGACY_FLAT_RELATIVE = '.agent-settings.yml';

function settingsPath(root: string): string {
    return join(root, SETTINGS_RELATIVE);
}

function legacyFlatPath(root: string): string {
    return join(root, LEGACY_FLAT_RELATIVE);
}

interface ReadState {
    raw: string;
    values: Record<string, unknown>;
    mtimeMs: number;
}

/**
 * Hints carried out-of-band on GET responses so the wizard can pre-fill
 * fields that have since moved out of the settings schema. The `user_name`
 * key was retired from `personal.*` (now lives in `.agent-user.md` →
 * `identity.name`); legacy files still carry it, and we surface the value
 * here so a returning user does not have to retype their name when
 * onboarding picks up a pre-v2 `.agent-settings.yml`.
 */
export interface SettingsLegacyHints {
    user_name?: string;
}

function extractLegacyHints(values: Record<string, unknown>): SettingsLegacyHints {
    const hints: SettingsLegacyHints = {};
    const personal = values.personal;
    if (personal !== null && typeof personal === 'object' && !Array.isArray(personal)) {
        const userName = (personal as Record<string, unknown>).user_name;
        if (typeof userName === 'string' && userName.trim() !== '') {
            hints.user_name = userName;
        }
    }
    return hints;
}

async function readYamlFile(path: string): Promise<ReadState | null> {
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

async function readSettingsFrom(root: string): Promise<ReadState | null> {
    return readYamlFile(settingsPath(root));
}

/**
 * Read `.agent-settings.yml` from `writeRoot/settings/`, falling back to:
 *   1. `writeRoot/.agent-settings.yml` (pre-typed-subdir flat-root).
 *   2. `legacyReadRoot/settings/.agent-settings.yml`.
 *   3. `legacyReadRoot/.agent-settings.yml`.
 * A hit on any fallback is what makes the silent-migration story work:
 * the next PUT writes to `writeRoot/settings/` and the legacy file is
 * no longer consulted (and is deleted by the wizard 2PC finish).
 */
async function readSettings(
    writeRoot: string,
    legacyReadRoot: string | null | undefined,
): Promise<ReadState | null> {
    const primary = await readSettingsFrom(writeRoot);
    if (primary !== null) return primary;
    const flatInSandbox = await readYamlFile(legacyFlatPath(writeRoot));
    if (flatInSandbox !== null) return flatInSandbox;
    if (legacyReadRoot && legacyReadRoot !== writeRoot) {
        const legacyTyped = await readSettingsFrom(legacyReadRoot);
        if (legacyTyped !== null) return legacyTyped;
        return readYamlFile(legacyFlatPath(legacyReadRoot));
    }
    return null;
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
                const state = await readSettings(opts.writeRoot, opts.legacyReadRoot);
                if (state === null) {
                    await reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'settings file missing' } });
                    return reply;
                }
                const legacyHints = extractLegacyHints(state.values);
                return {
                    values: state.values,
                    lastModified: state.mtimeMs,
                    path: SETTINGS_RELATIVE,
                    schema: SETTINGS_JSON_SCHEMA,
                    legacyHints,
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
            const current = await readSettings(opts.writeRoot, opts.legacyReadRoot);
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
            const current = await readSettings(opts.writeRoot, opts.legacyReadRoot);
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
                const path = settingsPath(opts.writeRoot);
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
