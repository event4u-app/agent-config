/**
 * `.agent-user.md` read / template / write routes.
 *
 * Contract: `docs/contracts/settings-api.md`.
 *
 *   GET /api/v1/user-md           → `{ body, exists, lastModified }`
 *   GET /api/v1/user-md/template  → 200 with template body, or 204
 *   PUT /api/v1/user-md           → atomic write (mode 0600)
 *
 * Same optimistic-locking shape as the settings route: writes require
 * `If-Unmodified-Since` when the file already exists. When the prior GET
 * returned `exists=false` the header may be omitted — the server treats
 * absence as "create new".
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { ZodIssue } from 'zod';
import { userMdSchema } from '../schemas/userMd.js';
import { writeAtomic } from '../io/atomicWrite.js';
import { PACKAGE_ROOT } from '../../cli/paths.js';

export interface UserMdRouteOptions {
    /** Project root — `.agent-user.md` resolves under this. */
    projectRoot: string;
    /** Override the package-shipped template path (tests only). */
    templatePath?: string;
    /**
     * Dry-run — PUT validates and returns `{ preview, dryRun }` with the
     * would-be body; no `writeAtomic`, no `Last-Modified` bump.
     */
    dryRun?: boolean;
}

const USER_MD_RELATIVE = '.agent-user.md';
const DEFAULT_TEMPLATE = join(PACKAGE_ROOT, 'templates', 'agent-user.md');

function userMdPath(root: string): string {
    return join(root, USER_MD_RELATIVE);
}

interface ReadState {
    body: string;
    mtimeMs: number;
}

async function readUserMd(root: string): Promise<ReadState | null> {
    const path = userMdPath(root);
    try {
        const [stat, body] = await Promise.all([fs.stat(path), fs.readFile(path, 'utf8')]);
        return { body, mtimeMs: Math.trunc(stat.mtimeMs) };
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
    }
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
        app.get('/api/v1/user-md', async (_request, _reply) => {
            const state = await readUserMd(opts.projectRoot);
            if (state === null) {
                return { body: '', exists: false, lastModified: null };
            }
            return { body: state.body, exists: true, lastModified: state.mtimeMs };
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
            const body = (request.body ?? {}) as { body?: unknown };
            const parsed = userMdSchema.safeParse(body);
            if (!parsed.success) {
                await reply.code(422).send({
                    error: { code: 'VALIDATION', message: 'invalid user-md body', fields: zodIssuesToFields(parsed.error.issues) },
                });
                return reply;
            }

            const ius = readIfUnmodified(request.headers['if-unmodified-since']);
            const current = await readUserMd(opts.projectRoot);
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
                        current: { body: current.body, lastModified: current.mtimeMs },
                    });
                    return reply;
                }
            }

            try {
                if (opts.dryRun === true) {
                    return {
                        dryRun: true,
                        lastModified: current?.mtimeMs ?? null,
                        preview: { path: USER_MD_RELATIVE, body: parsed.data.body },
                    };
                }
                const path = userMdPath(opts.projectRoot);
                await writeAtomic(path, parsed.data.body, { mode: 0o600 });
                const stat = await fs.stat(path);
                return { lastModified: Math.trunc(stat.mtimeMs), writtenPaths: [USER_MD_RELATIVE] };
            } catch (err) {
                const message = err instanceof Error ? err.message : 'atomic write failed';
                await reply.code(500).send({ error: { code: 'ATOMIC_WRITE', message } });
                return reply;
            }
        });
    };
    return plugin;
}
