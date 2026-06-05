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
import { dirname, join } from 'node:path';
import type { ZodIssue } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { settingsSchema } from '../schemas/settings.js';
import { parseYaml, mergeIntoTemplate, diffValues, deepMerge } from '../io/yamlIO.js';
import { writeAtomic } from '../io/atomicWrite.js';
import { PACKAGE_ROOT } from '../../cli/paths.js';

// Installer placeholders in `src/config/agent-settings.template.yml` that
// `scripts/install.py` substitutes per-user. The TypeScript defaults layer
// renders the same scalars so the wizard's first-run form is schema-valid.
// Keep this map in lockstep with the template — any new `__*__` placeholder
// added there must get its default here, or `settingsSchema.safeParse` on
// the merged defaults will reject the first save.
const TEMPLATE_PLACEHOLDER_DEFAULTS: Readonly<Record<string, string>> = {
    __RULE_LOADING_TIER__: 'balanced',
    __USER_TYPE__: '',
    __CHAT_HISTORY_FREQUENCY__: 'per_turn',
    __CHAT_HISTORY_MAX_SIZE_KB__: '2048',
    __CHAT_HISTORY_ON_OVERFLOW__: 'rotate',
};

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
     * Package root — used to locate `src/config/agent-settings.template.yml`
     * for the defaults layer of the three-layer merge (Phase 2.2 of
     * road-to-global-only-install). Defaults to the resolved `PACKAGE_ROOT`
     * so existing callers stay green; tests override via `createApp`.
     */
    packageRoot?: string;
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
 * Three-layer merged settings — defaults < global < project.
 *
 * Mirrors `scripts/install.py::read_layered_settings` so the Python
 * installer and the Fastify server produce the same effective tree.
 *
 *   - `values` is the deep-merged result across all layers.
 *   - `raw` is the highest-priority real on-disk content (project, then
 *     global); it scaffolds template comments through PUTs via
 *     `mergeIntoTemplate`.
 *   - `mtimeMs` is `max(globalMtime, projectMtime)` so any concurrent
 *     edit anywhere in the stack invalidates the client's
 *     `If-Unmodified-Since`. Defaults carry no mtime — the template is
 *     a static package asset.
 *   - `hasRealFile` is `false` only when neither global nor project
 *     exists; in that case the route returns 404 (defaults alone are
 *     not an "installed" state — `docs/decisions/ADR-020`).
 */
interface LayeredState {
    raw: string;
    values: Record<string, unknown>;
    mtimeMs: number;
    hasRealFile: boolean;
}

/**
 * Parse the package settings template with `__RULE_LOADING_TIER__` /
 * `__USER_TYPE__` substituted for their permissive defaults. Returns
 * `{}` if the template is missing or YAML-invalid — callers treat this
 * as "no defaults available" rather than erroring, matching the Python
 * `_load_default_settings` shape.
 */
async function loadDefaultSettings(packageRoot: string): Promise<Record<string, unknown>> {
    try {
        const text = await fs.readFile(join(packageRoot, 'src', 'config', 'agent-settings.template.yml'), 'utf8');
        let rendered = text;
        for (const [placeholder, value] of Object.entries(TEMPLATE_PLACEHOLDER_DEFAULTS)) {
            rendered = rendered.replaceAll(placeholder, value);
        }
        const parsed = parseYaml(rendered);
        return parsed ?? {};
    } catch {
        return {};
    }
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
 * Read the highest-priority real on-disk file at `<root>/settings/...`
 * (typed subdir) or `<root>/.agent-settings.yml` (pre-typed-subdir
 * flat-root). Used as the per-layer reader inside `readLayeredSettings`.
 */
async function readSingleLayer(root: string): Promise<ReadState | null> {
    const typed = await readSettingsFrom(root);
    if (typed !== null) return typed;
    return readYamlFile(legacyFlatPath(root));
}

/**
 * Three-layer settings merge — `defaults < global < project`.
 *
 *   - Defaults: package template with placeholders substituted.
 *   - Global: `writeRoot/settings/.agent-settings.yml` (flat fallback).
 *   - Project: `legacyReadRoot/settings/.agent-settings.yml` (flat
 *     fallback) — only consulted when `legacyReadRoot` differs from
 *     `writeRoot`.
 *
 * If neither global nor project exists, returns `hasRealFile: false`
 * so the route can emit 404 (ADR-020 § "Installed" semantic).
 *
 * Mirrors `scripts/install.py::read_layered_settings`.
 */
async function readLayeredSettings(
    packageRoot: string,
    writeRoot: string,
    legacyReadRoot: string | null | undefined,
): Promise<LayeredState> {
    const defaults = await loadDefaultSettings(packageRoot);
    const globalLayer = await readSingleLayer(writeRoot);
    const projectLayer = legacyReadRoot && legacyReadRoot !== writeRoot
        ? await readSingleLayer(legacyReadRoot)
        : null;

    let merged: Record<string, unknown> = defaults;
    if (globalLayer !== null) merged = deepMerge(merged, globalLayer.values);
    if (projectLayer !== null) merged = deepMerge(merged, projectLayer.values);

    const scaffold = projectLayer ?? globalLayer;
    const mtimeMs = Math.max(globalLayer?.mtimeMs ?? 0, projectLayer?.mtimeMs ?? 0);
    return {
        raw: scaffold?.raw ?? '',
        values: merged,
        mtimeMs,
        hasRealFile: scaffold !== null,
    };
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
    const packageRoot = opts.packageRoot ?? PACKAGE_ROOT;
    const plugin: FastifyPluginAsync = async (app: FastifyInstance) => {
        app.get('/api/v1/settings', async (_request, reply) => {
            try {
                const state = await readLayeredSettings(packageRoot, opts.writeRoot, opts.legacyReadRoot);
                if (!state.hasRealFile) {
                    // No on-disk file yet — the wizard creates it. Surface the
                    // template-defaults values + schema + path in the body so
                    // the SPA's fetchSettingsWithFallback can seed the form
                    // with a fully-defaulted shape (otherwise it falls back to
                    // `{}` and the user's first save fails schema validation).
                    await reply.code(404).send({
                        error: { code: 'NOT_FOUND', message: 'settings file missing' },
                        defaults: state.values,
                        lastModified: 0,
                        path: SETTINGS_RELATIVE,
                        schema: SETTINGS_JSON_SCHEMA,
                    });
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
            const current = await readLayeredSettings(packageRoot, opts.writeRoot, opts.legacyReadRoot);
            if (!current.hasRealFile) {
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
            const current = await readLayeredSettings(packageRoot, opts.writeRoot, opts.legacyReadRoot);
            if (!current.hasRealFile) {
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
                await fs.mkdir(dirname(path), { recursive: true, mode: 0o700 });
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
