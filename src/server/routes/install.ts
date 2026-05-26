/**
 * Install API — Phase B1 (council Findings #20 + #24).
 *
 *   GET  /api/v1/install/detect — scope + tool presence at `cwd`.
 *   POST /api/v1/install/plan   — build an {@link InstallPlan} from a
 *                                 declarative {@link PlanSource}[] body.
 *   POST /api/v1/install/apply  — execute the plan; streams SSE frames
 *                                 (`progress` / `conflict` / `error` / `done`).
 *
 * **Error schema (Finding #20):** every SSE frame carries a stable
 * `type` discriminator and errors carry a `code` from
 * {@link ErrorCode} so the UI maps them to localized copy without
 * parsing free-form messages.
 *
 * **Abort-on-disconnect (Finding #24):** the apply handler subscribes
 * to `req.raw.on("close")` and fires an `AbortController`; the engine
 * appends an `abort` marker to the transaction log and resolves the
 * partial {@link ApplyResult}. Next boot's recovery surfaces the marker
 * as `Resume` / `Rollback` / `Ignore`.
 */

import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { applyPlanStreaming, type ApplyProgress } from '../../install/apply.js';
import {
    detectPackageRoot,
    detectProjectShape,
    detectScope,
    detectToolPresence,
} from '../../install/detect.js';
import { getLogPath } from '../../install/paths.js';
import { buildInstallPlan, type PlanSource } from '../../install/plan.js';
import type { ApplyResult, FileEntry, FileKind, InstallPlan, InstallTarget } from '../../install/types.js';
import { expandWizardSources } from '../../install/wizard-plan.js';

/** Stable error codes surfaced over SSE (Finding #20). */
export type ErrorCode = 'E_DISK_FULL' | 'E_PERM' | 'E_CONFLICT_UNRESOLVED' | 'E_CRASH' | 'E_WRITE';

const FileKindSchema: z.ZodType<FileKind> = z.enum(['deployed', 'marker', 'bridge']);
const InstallTargetSchema: z.ZodType<InstallTarget> = z.enum(['global', 'project']);

const PlanSourceSchema: z.ZodType<PlanSource> = z.object({
    toolId: z.string().min(1),
    srcDir: z.string().min(1),
    destDir: z.string().min(1),
    kind: FileKindSchema,
});

const ConflictPolicyWireSchema = z.object({
    force: z.boolean(),
    interactive: z.boolean(),
    knownPaths: z.array(z.string()).default([]),
    knownPointers: z.array(z.string()).default([]),
    defaultStrategy: z.enum(['skip', 'overwrite', 'surface-to-ui']),
});

/**
 * Sources branch — caller has already expanded tool IDs into low-level
 * `(srcDir, destDir, toolId, kind)` tuples. Used by the CLI and tests.
 */
const PlanSourcesBodySchema = z.object({
    target: InstallTargetSchema,
    root: z.string().min(1),
    sources: z.array(PlanSourceSchema),
    policy: ConflictPolicyWireSchema,
});

/**
 * Wizard branch — caller passes the high-level UI selection (tool IDs)
 * and the server expands them via {@link expandWizardSources}. The
 * `packageRoot` falls back to {@link detectPackageRoot} on the install
 * cwd; tests can pin it via `installRouteOptions.packageRoot`.
 *
 * Phase B2 — wires the wizard's `selectedTools` signal end-to-end so
 * the Review step can POST without knowing filesystem paths.
 */
const PlanWizardBodySchema = z.object({
    target: InstallTargetSchema,
    root: z.string().min(1),
    toolIds: z.array(z.string().min(1)),
    policy: ConflictPolicyWireSchema,
    /** Optional override for the resolved package root (tests only). */
    packageRoot: z.string().min(1).optional(),
});

/**
 * Top-level plan request — discriminated on the presence of `sources`
 * vs `toolIds`. `z.union` is used (not `discriminatedUnion`) because
 * the discriminator is structural — neither branch carries a literal
 * `kind: "..."` field. Zod tries both schemas and returns the first
 * match's data.
 */
const PlanRequestSchema = z.union([PlanSourcesBodySchema, PlanWizardBodySchema]);

const FileEntrySchema: z.ZodType<FileEntry> = z.object({
    path: z.string().min(1),
    kind: FileKindSchema,
    sha256: z.string().nullable(),
});

/**
 * Wire-shape of {@link InstallPlan} — Sets serialise as arrays over JSON,
 * so the apply request carries `knownPaths` / `knownPointers` as string
 * arrays. The route converts them to `Set` before handing the plan to
 * the engine. The `/plan` response converts the other direction via
 * {@link planToWire}.
 */
const InstallPlanWireSchema = z.object({
    version: z.literal(2),
    target: InstallTargetSchema,
    root: z.string().min(1),
    filesByTool: z.record(z.string(), z.array(FileEntrySchema)),
    mergedKeysByTool: z.record(z.string(), z.array(z.object({ file: z.string(), pointer: z.string() }))),
    policy: z.object({
        force: z.boolean(),
        interactive: z.boolean(),
        knownPaths: z.array(z.string()).default([]),
        knownPointers: z.array(z.string()).default([]),
        defaultStrategy: z.enum(['skip', 'overwrite', 'surface-to-ui']),
    }),
});

type InstallPlanWire = z.infer<typeof InstallPlanWireSchema>;

function wireToPlan(w: InstallPlanWire): InstallPlan {
    return {
        version: 2,
        target: w.target,
        root: w.root,
        filesByTool: w.filesByTool,
        mergedKeysByTool: w.mergedKeysByTool,
        policy: {
            force: w.policy.force,
            interactive: w.policy.interactive,
            knownPaths: new Set(w.policy.knownPaths),
            knownPointers: new Set(w.policy.knownPointers),
            defaultStrategy: w.policy.defaultStrategy,
        },
    };
}

function planToWire(p: InstallPlan): InstallPlanWire {
    return {
        version: 2,
        target: p.target,
        root: p.root,
        filesByTool: p.filesByTool as Record<string, FileEntry[]>,
        mergedKeysByTool: p.mergedKeysByTool as Record<string, { file: string; pointer: string }[]>,
        policy: {
            force: p.policy.force,
            interactive: p.policy.interactive,
            knownPaths: Array.from(p.policy.knownPaths),
            knownPointers: Array.from(p.policy.knownPointers),
            defaultStrategy: p.policy.defaultStrategy,
        },
    };
}

const ApplyRequestSchema = z.object({
    plan: InstallPlanWireSchema,
    sourceByTarget: z.record(z.string(), z.string()),
    /** Optional override for the transaction-log path (tests only). */
    logPath: z.string().optional(),
});

export type PlanRequest = z.infer<typeof PlanRequestSchema>;
export type ApplyRequest = z.infer<typeof ApplyRequestSchema>;

export const DetectResponseSchema = z.object({
    cwd: z.string(),
    scope: z.object({ scope: z.enum(['project', 'prompt', 'global']), reason: z.string() }),
    projectShape: z.object({
        kind: z.enum(['composer', 'npm', 'cargo', 'pyproject', 'go', 'ruby', 'unknown']),
        root: z.string(),
        manifest: z.string().nullable(),
    }),
    toolPresence: z.object({
        augment: z.boolean(),
        claude: z.boolean(),
        cursor: z.boolean(),
        cline: z.boolean(),
        windsurf: z.boolean(),
        agentsMd: z.boolean(),
    }),
    packageRoot: z.string().nullable(),
});

export type DetectResponse = z.infer<typeof DetectResponseSchema>;

export interface InstallRouteOptions {
    /** Override the cwd used for detection (tests only). */
    cwd?: string;
    /** Override the txlog path the apply route writes to (tests only). */
    logPath?: string;
    /**
     * Override the package root used by the wizard branch of `/plan`
     * (tests only). When unset the route falls back to
     * {@link detectPackageRoot} on the install cwd.
     */
    packageRoot?: string;
    /**
     * Override the user home directory used by {@link expandWizardSources}
     * (tests only). When unset the helper falls back to `os.homedir()`.
     */
    home?: string;
}

/** Map a Node `fs` error code to the stable SSE error code (Finding #20). */
function mapErrorCode(code: string): ErrorCode {
    if (code === 'ENOSPC') return 'E_DISK_FULL';
    if (code === 'EACCES' || code === 'EPERM') return 'E_PERM';
    if (code === 'E_CONFLICT_UNRESOLVED') return 'E_CONFLICT_UNRESOLVED';
    return 'E_WRITE';
}

/** SSE frame writer — one event per `data:` line, blank line terminator. */
function writeFrame(reply: FastifyReply, payload: Record<string, unknown>): void {
    reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * Resolve a {@link PlanRequest} into the low-level `PlanSource[]` array.
 * Sources branch passes through unchanged; wizard branch runs the
 * {@link expandWizardSources} expansion against the route's effective
 * `packageRoot` (option override → `detectPackageRoot(cwd)` fallback).
 *
 * Throws when the wizard branch cannot resolve a package root — the
 * caller maps that to a 400 with `code: 'E_NO_PACKAGE_ROOT'`.
 */
function resolveSources(body: PlanRequest, opts: InstallRouteOptions): PlanSource[] {
    if ('sources' in body) return [...body.sources];
    const packageRoot = body.packageRoot
        ?? opts.packageRoot
        ?? detectPackageRoot(opts.cwd ?? process.cwd());
    if (!packageRoot) {
        throw new Error('E_NO_PACKAGE_ROOT');
    }
    return expandWizardSources(
        opts.home === undefined
            ? { toolIds: body.toolIds, packageRoot }
            : { toolIds: body.toolIds, packageRoot, home: opts.home },
    );
}

function planFromRequest(body: PlanRequest, opts: InstallRouteOptions): InstallPlan {
    const sources = resolveSources(body, opts);
    return buildInstallPlan({
        target: body.target,
        root: body.root,
        sources,
        policy: {
            force: body.policy.force,
            interactive: body.policy.interactive,
            knownPaths: new Set(body.policy.knownPaths),
            knownPointers: new Set(body.policy.knownPointers),
            defaultStrategy: body.policy.defaultStrategy,
        },
    });
}

function mapApplyProgressToFrame(p: ApplyProgress): Record<string, unknown> {
    if (p.status === 'written' || p.status === 'skipped') {
        return {
            type: 'progress',
            file: p.file.path,
            status: p.status,
            written: p.written,
            total: p.total,
        };
    }
    if (p.status === 'conflict') {
        return {
            type: 'conflict',
            entries: [{ path: p.file.path, kind: p.file.kind }],
        };
    }
    const code: ErrorCode = p.error ? mapErrorCode(p.error.code) : 'E_WRITE';
    return {
        type: 'error',
        code,
        message: p.error?.message ?? 'unknown error',
        recoverable: code !== 'E_DISK_FULL' && code !== 'E_CRASH',
        file: p.file.path,
    };
}

function summaryFrame(result: ApplyResult): Record<string, unknown> {
    return {
        type: 'done',
        summary: {
            target: result.target,
            written: result.written.length,
            skipped: result.skipped.length,
            conflicts: result.conflicts.length,
            errors: result.errors.length,
        },
    };
}

async function applyHandler(
    req: FastifyRequest,
    reply: FastifyReply,
    opts: InstallRouteOptions,
): Promise<void> {
    const parsed = ApplyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        await reply.code(400).send({ error: 'invalid apply request', details: parsed.error.flatten() });
        return;
    }

    // SSE headers — flush immediately so the browser opens the channel.
    reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    reply.raw.flushHeaders?.();

    const controller = new AbortController();
    // Council Finding #24: tear down the apply loop when the client
    // disconnects so half-applied installs surface a clean partial result
    // instead of a zombie loop. The transaction log records an `abort`
    // marker so the next boot can offer Resume / Rollback / Ignore.
    //
    // Listen on `reply.raw` (ServerResponse), not `req.raw` (IncomingMessage):
    // the request stream emits `close` as soon as the body is fully
    // consumed (undici / fetch send-then-half-close), which would fire
    // mid-stream on every healthy request. The response stream only
    // emits `close` on actual client teardown. Guard with `writableEnded`
    // so the server's own `reply.raw.end()` (in `finally`) does not
    // trigger the abort.
    const onClose = (): void => {
        if (!reply.raw.writableEnded) {
            controller.abort();
        }
    };
    reply.raw.on('close', onClose);

    const sourceByTarget = new Map(Object.entries(parsed.data.sourceByTarget));
    const logPath = parsed.data.logPath ?? opts.logPath ?? getLogPath();

    try {
        const result = await applyPlanStreaming({
            plan: wireToPlan(parsed.data.plan),
            sourceByTarget,
            logPath,
            signal: controller.signal,
            onProgress: (p) => writeFrame(reply, mapApplyProgressToFrame(p)),
        });
        writeFrame(reply, summaryFrame(result));
    } catch (err) {
        const code: ErrorCode = 'E_CRASH';
        writeFrame(reply, {
            type: 'error',
            code,
            message: err instanceof Error ? err.message : String(err),
            recoverable: false,
        });
    } finally {
        reply.raw.off('close', onClose);
        reply.raw.end();
    }
}

export function installRoute(opts: InstallRouteOptions = {}): FastifyPluginAsync {
    const plugin: FastifyPluginAsync = async (app: FastifyInstance) => {
        app.get('/api/v1/install/detect', async () => {
            const cwd = opts.cwd ?? process.cwd();
            const response: DetectResponse = {
                cwd,
                scope: detectScope(cwd),
                projectShape: detectProjectShape(cwd),
                toolPresence: detectToolPresence(cwd),
                packageRoot: detectPackageRoot(cwd),
            };
            return response;
        });

        app.post('/api/v1/install/plan', async (req, reply) => {
            const parsed = PlanRequestSchema.safeParse(req.body);
            if (!parsed.success) {
                await reply.code(400).send({ error: 'invalid plan request', details: parsed.error.flatten() });
                return;
            }
            try {
                return planToWire(planFromRequest(parsed.data, opts));
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                if (message === 'E_NO_PACKAGE_ROOT') {
                    await reply.code(400).send({
                        error: 'package root not found — pass `packageRoot` in the wizard payload or run the server with a discoverable cwd',
                        code: 'E_NO_PACKAGE_ROOT',
                    });
                    return;
                }
                throw err;
            }
        });

        app.post('/api/v1/install/apply', async (req, reply) => {
            await applyHandler(req, reply, opts);
        });
    };
    return plugin;
}

