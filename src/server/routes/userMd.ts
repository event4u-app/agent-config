/**
 * `.agent-user.yml` read / template / write routes.
 *
 * Contract: `docs/contracts/settings-api.md`.
 *
 *   GET /api/v1/user-md           → `{ identity, exists, lastModified }`
 *   GET /api/v1/user-md/template  → 200 with template body, or 204
 *   PUT /api/v1/user-md           → body `{ identity }`, atomic write
 *
 * Wire format is pure JSON: the server owns the YAML serialization so
 * the UI never depends on `js-yaml.dump`. Legacy `.agent-user.md` files
 * (fenced frontmatter + optional markdown body) are read transparently
 * via `parseLegacyUserMd`; the next PUT writes the new yml path and the
 * wizard finish handler deletes the legacy file (auto-migration).
 *
 * Optimistic locking mirrors the settings route: writes require
 * `If-Unmodified-Since` when the file already exists.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ZodIssue } from 'zod';
import { userIdentitySchema } from '../../shared/userMd/schema.js';
import {
    composeUserIdentity,
    parseLegacyUserMd,
    parseUserIdentity,
} from '../../shared/userMd/utils.js';
import { writeAtomic } from '../io/atomicWrite.js';
import { sharedWriteTarget, resolveThroughSymlinks } from '../io/sharedWriteCheck.js';
import { PACKAGE_ROOT } from '../../cli/paths.js';

/**
 * Shared-write collision message (road-to-reciprocal-ecosystem Phase 2)
 * — surfaced verbatim in the 409 body the GUI's blocking confirm reads.
 */
const SHARED_WRITE_MESSAGE =
    'This write lands through an agent-switch shared symlink and affects ALL profiles. ' +
    'Re-send with confirmSharedWrite:true to proceed, or run `agent-switch share off` for profile-local writes.';

export interface UserMdRouteOptions {
    /** Write root — every PUT lands here as `settings/.agent-user.yml`. */
    writeRoot: string;
    /**
     * Legacy-read fallback root. When GET / PUT find no file at the new
     * path, the read also checks the legacy `.agent-user.md` location
     * under `writeRoot` (in-repo migration) and under `legacyReadRoot`
     * (CWD migration). Auto-delete of the legacy files happens in the
     * wizard finish handler, never here.
     */
    legacyReadRoot?: string | null;
    /** Override the package-shipped template path (tests only). */
    templatePath?: string;
    /**
     * Dry-run — PUT validates and returns `{ preview, dryRun }` with the
     * would-be identity object and rendered YAML; no `writeAtomic`,
     * no `Last-Modified` bump.
     */
    dryRun?: boolean;
    /**
     * Read-only user-global config root (package-sandbox mode) — a local
     * test run prefills identity (name, language, roles) from the real
     * `~/.event4u` `.agent-user.yml`. Never written (road-to-setup-
     * experience follow-up).
     */
    userGlobalReadRoot?: string | null;
}

/** New canonical on-disk path, relative to writeRoot. */
export const USER_IDENTITY_RELATIVE = join('settings', '.agent-user.yml');
/** Legacy markdown path, relative to writeRoot or legacyReadRoot. */
const LEGACY_USER_MD_RELATIVE = '.agent-user.md';
const DEFAULT_TEMPLATE = join(PACKAGE_ROOT, 'src', 'templates', 'agent-user.yml');

interface ReadState {
    /** Parsed identity object — never the raw file body. */
    identity: Record<string, unknown>;
    mtimeMs: number;
}

async function readFromPath(path: string, legacy: boolean): Promise<ReadState | null> {
    try {
        const [stat, body] = await Promise.all([fs.stat(path), fs.readFile(path, 'utf8')]);
        const identity = legacy ? parseLegacyUserMd(body) : parseUserIdentity(body);
        return { identity, mtimeMs: Math.trunc(stat.mtimeMs) };
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
    }
}

/**
 * Try the new path, then the legacy paths in priority order:
 *   1. `<writeRoot>/settings/.agent-user.yml`     (canonical)
 *   2. `<writeRoot>/.agent-user.md`               (in-repo legacy)
 *   3. `<legacyReadRoot>/.agent-user.md`          (CWD legacy)
 */
async function readUserMd(
    writeRoot: string,
    legacyReadRoot: string | null | undefined,
    userGlobalReadRoot?: string | null,
): Promise<ReadState | null> {
    const candidates: Array<{ path: string; legacy: boolean }> = [
        { path: join(writeRoot, USER_IDENTITY_RELATIVE), legacy: false },
        { path: join(writeRoot, LEGACY_USER_MD_RELATIVE), legacy: true },
    ];
    // Package-sandbox read fallback: the real user-global identity seeds
    // the wizard when the sandbox has none (read-only).
    if (userGlobalReadRoot && userGlobalReadRoot !== writeRoot) {
        candidates.push({ path: join(userGlobalReadRoot, USER_IDENTITY_RELATIVE), legacy: false });
    }
    if (legacyReadRoot && legacyReadRoot !== writeRoot) {
        candidates.push({ path: join(legacyReadRoot, LEGACY_USER_MD_RELATIVE), legacy: true });
    }
    for (const c of candidates) {
        const state = await readFromPath(c.path, c.legacy);
        if (state !== null) return state;
    }
    return null;
}

function readIfUnmodified(header: unknown): number | null {
    if (typeof header !== 'string') return null;
    const n = Number.parseInt(header, 10);
    return Number.isFinite(n) ? n : null;
}

function zodIssuesToFields(issues: ZodIssue[]): Array<{ path: string; message: string }> {
    return issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

export function userMdRoute(opts: UserMdRouteOptions): FastifyPluginAsync {
    const templatePath = opts.templatePath ?? DEFAULT_TEMPLATE;

    const plugin: FastifyPluginAsync = async (app: FastifyInstance) => {
        app.get('/api/v1/user-md', async () => {
            const state = await readUserMd(opts.writeRoot, opts.legacyReadRoot, opts.userGlobalReadRoot);
            if (state === null) {
                return { identity: null, exists: false, lastModified: null };
            }
            return { identity: state.identity, exists: true, lastModified: state.mtimeMs };
        });

        app.get('/api/v1/user-md/template', async (_request, reply) => {
            try {
                const body = await fs.readFile(templatePath, 'utf8');
                return { body };
            } catch (err) {
                if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
                    await reply.code(204).send();
                    return reply;
                }
                throw err;
            }
        });

        app.put('/api/v1/user-md', async (request, reply) => {
            const body = (request.body ?? {}) as { identity?: unknown; confirmSharedWrite?: unknown };
            const parsed = userIdentitySchema.safeParse(body.identity);
            if (!parsed.success) {
                await reply.code(422).send({
                    error: { code: 'VALIDATION', message: 'invalid user identity', fields: zodIssuesToFields(parsed.error.issues) },
                });
                return reply;
            }

            const ius = readIfUnmodified(request.headers['if-unmodified-since']);
            const current = await readUserMd(opts.writeRoot, opts.legacyReadRoot);
            if (current !== null) {
                if (ius === null) {
                    await reply.code(412).send({
                        error: { code: 'PRECONDITION_REQUIRED', message: 'If-Unmodified-Since header required for existing file' },
                    });
                    return reply;
                }
                if (ius < current.mtimeMs) {
                    await reply.code(409).send({
                        error: { code: 'CONFLICT', message: 'on-disk file has been modified' },
                        current: { identity: current.identity, lastModified: current.mtimeMs },
                    });
                    return reply;
                }
            }

            try {
                const yamlBody = composeUserIdentity(parsed.data as Record<string, unknown>);
                if (opts.dryRun === true) {
                    return {
                        dryRun: true,
                        lastModified: current?.mtimeMs ?? null,
                        preview: { path: USER_IDENTITY_RELATIVE, identity: parsed.data, body: yamlBody },
                    };
                }
                const targetPath = join(opts.writeRoot, USER_IDENTITY_RELATIVE);
                // Shared-write collision gate (road-to-reciprocal-ecosystem
                // Phase 2) — see settings.ts's PUT handler for the same gate;
                // kept in lockstep intentionally rather than factored out,
                // since the two routes' surrounding try/catch shapes differ.
                const sharedPath = sharedWriteTarget(targetPath);
                if (sharedPath !== null && body.confirmSharedWrite !== true) {
                    await reply.code(409).send({ error: 'shared-write', sharedPath, message: SHARED_WRITE_MESSAGE });
                    return reply;
                }
                const writePath = sharedPath !== null ? resolveThroughSymlinks(targetPath) : targetPath;
                await fs.mkdir(dirname(writePath), { recursive: true, mode: 0o700 });
                await writeAtomic(writePath, yamlBody, { mode: 0o600 });
                const stat = await fs.stat(writePath);
                return { lastModified: Math.trunc(stat.mtimeMs), writtenPaths: [USER_IDENTITY_RELATIVE] };
            } catch (err) {
                const message = err instanceof Error ? err.message : 'atomic write failed';
                await reply.code(500).send({ error: { code: 'ATOMIC_WRITE', message } });
                return reply;
            }
        });
    };
    return plugin;
}
