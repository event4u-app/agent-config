/**
 * Install API — Phase B1 (council Findings #20 + #24).
 *
 *   GET  /api/v1/install/detect — scope + tool presence at `cwd`.
 *   POST /api/v1/install/plan   — build an {@link InstallPlan} from a
 *                                 declarative {@link PlanSource}[] body.
 *
 * The real *apply* path is owned by `scripts/install.py --apply-payload`
 * (single source of truth, D12 / ADR-020) and surfaced to the GUI via
 * `POST /api/v1/wizard/apply` (see `wizard.ts`). The legacy TypeScript
 * apply engine + its `POST /api/v1/install/apply` SSE route were removed in
 * road-to-single-install-source-of-truth § Phase 3 — this module now only
 * serves the read-only detect / plan-preview / recovery / legacy-v3 routes.
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { computeConflicts } from '../../install/conflict.js';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import {
    detectLegacyV3,
    detectPackageRoot,
    detectProjectShape,
    detectScope,
    detectToolPresence,
    type LegacyV3Detection,
} from '../../install/detect.js';
import { getLogPath } from '../../install/paths.js';
import { buildInstallPlan, type PlanSource } from '../../install/plan.js';
import { appendTxLog, readRecentEntries, type TxLogEntry } from '../../install/txlog.js';
import type {
    ConflictEntry,
    FileEntry,
    FileKind,
    InstallPlan,
    InstallTarget,
} from '../../install/types.js';
import { expandWizardSources } from '../../install/wizard-plan.js';

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

const ConflictEntrySchema: z.ZodType<ConflictEntry> = z.object({
    path: z.string().min(1),
    kind: FileKindSchema,
    plannedSha256: z.string().nullable(),
    existingSha256: z.string().nullable(),
    mergeable: z.boolean(),
});

/**
 * Wire-shape of {@link InstallPlan} — Sets serialise as arrays over JSON,
 * so the apply request carries `knownPaths` / `knownPointers` as string
 * arrays. The route converts them to `Set` before handing the plan to
 * the engine. The `/plan` response converts the other direction via
 * {@link planToWire}.
 *
 * Phase B3 adds the `conflicts` field — populated by the `/plan` route
 * via {@link computeConflicts} so the wizard can transition to the
 * conflict screen before calling `/apply`. The field is `default([])`
 * so older clients that omit it on apply round-trips still parse.
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
    conflicts: z.array(ConflictEntrySchema).default([]),
});

type InstallPlanWire = z.infer<typeof InstallPlanWireSchema>;

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
        conflicts: [...computeConflicts(p)],
    };
}

export type PlanRequest = z.infer<typeof PlanRequestSchema>;

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

/** Recovery recommendation surfaced to the wizard (Phase B4). */
export type RecoveryRecommendation = 'none' | 'resume' | 'rollback' | 'ignore';

/** Shape of `GET /api/v1/install/recovery`. */
export interface RecoveryResponse {
    /** True when the txlog tail shows an interrupted run. */
    readonly incomplete: boolean;
    /** Recommendation for the wizard's recovery-pre-step. */
    readonly recommendation: RecoveryRecommendation;
    /** ISO timestamp of the abort marker, when present. */
    readonly abortedAt: string | null;
    /** Optional abort note (e.g. "client disconnected"). */
    readonly abortNote: string | null;
    /**
     * Tail of recent txlog entries (newest last). Capped by
     * {@link RECOVERY_DEPTH_CAP} on the txlog side, then sliced to the
     * last 50 here so the wizard renders a bounded list.
     */
    readonly lastEntries: readonly TxLogEntry[];
    /** Count of `write` entries since the last `rollback` marker. */
    readonly writesSinceRollback: number;
}

/**
 * Summarise a txlog tail into a recovery decision (Phase B4, council
 * Finding #24 closure).
 *
 * Rules:
 * - Empty / missing log → `incomplete: false`, `recommendation: 'none'`.
 * - Newest entry is `abort` → `incomplete: true`, `recommendation: 'resume'`.
 * - Newest entry is `rollback` → clean, `recommendation: 'none'`.
 * - Otherwise the writer either finished cleanly (no abort tail) or
 *   crashed without an explicit marker; the wizard will treat
 *   `incomplete: false` as the safe default and surface nothing.
 */
export function summarizeRecovery(entries: readonly TxLogEntry[]): RecoveryResponse {
    if (entries.length === 0) {
        return {
            incomplete: false,
            recommendation: 'none',
            abortedAt: null,
            abortNote: null,
            lastEntries: [],
            writesSinceRollback: 0,
        };
    }
    const tail = entries.slice(-50);
    const newest = entries[entries.length - 1];
    let writesSinceRollback = 0;
    for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i];
        if (e === undefined) continue;
        if (e.kind === 'rollback') break;
        if (e.kind === 'write') writesSinceRollback += 1;
    }
    if (newest !== undefined && newest.kind === 'abort') {
        return {
            incomplete: true,
            recommendation: 'resume',
            abortedAt: newest.ts,
            abortNote: newest.note ?? null,
            lastEntries: tail,
            writesSinceRollback,
        };
    }
    return {
        incomplete: false,
        recommendation: 'none',
        abortedAt: null,
        abortNote: null,
        lastEntries: tail,
        writesSinceRollback,
    };
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
                // Validate the wire shape on the way out so the response
                // contract stays enforced now that the schema is no longer
                // referenced by the (removed) apply route.
                return InstallPlanWireSchema.parse(planToWire(planFromRequest(parsed.data, opts)));
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

        // Phase B4 — recovery-pre-step: read the txlog tail and surface
        // an abort marker so the wizard can prompt Resume / Rollback /
        // Ignore before showing Step 1.
        app.get('/api/v1/install/recovery', async () => {
            const logPath = opts.logPath ?? getLogPath();
            const entries = readRecentEntries(logPath);
            return summarizeRecovery(entries);
        });

        // Phase E2 — v3 legacy detection. The wizard fetches this on
        // boot and renders a backup-screen when `present: true`.
        app.get('/api/v1/install/legacy-v3', async () => {
            const detection = detectLegacyV3(opts.home !== undefined ? { home: opts.home } : {});
            return detection satisfies LegacyV3Detection;
        });

        // Phase E2 — backup-then-proceed action. Copies the v3 tree to
        // `<home>/.event4u/agent-config.v3.bak/` atomically (cp -r
        // fallback; rsync is not assumed to be on the operator's PATH).
        // The destination is recomputed from `detectLegacyV3` so a
        // stale UI payload cannot redirect the write elsewhere.
        app.post('/api/v1/install/backup-v3', async (_req, reply) => {
            const detection = detectLegacyV3(opts.home !== undefined ? { home: opts.home } : {});
            if (!detection.present) {
                await reply.code(409).send({
                    error: 'no v3 install detected',
                    code: 'E_NO_LEGACY_V3',
                });
                return;
            }
            if (existsSync(detection.backupTarget)) {
                await reply.code(409).send({
                    error: 'backup target already exists',
                    code: 'E_BACKUP_EXISTS',
                    path: detection.backupTarget,
                });
                return;
            }
            try {
                mkdirSync(detection.backupTarget, { recursive: true, mode: 0o700 });
                cpSync(detection.path, detection.backupTarget, {
                    recursive: true,
                    preserveTimestamps: true,
                });
            } catch (err) {
                await reply.code(500).send({
                    error: err instanceof Error ? err.message : String(err),
                    code: 'E_BACKUP_FAILED',
                });
                return;
            }
            return {
                ok: true,
                source: detection.path,
                target: detection.backupTarget,
                version: detection.version,
            };
        });

        // Phase B4 — dismiss path: append a `rollback` marker so the next
        // recovery scan returns `incomplete: false`. The `reason` is
        // free-form and lands in the txlog `note` for audit; the wire
        // accepts `resume` / `rollback` / `ignore` to match the UI CTAs.
        app.post('/api/v1/install/recovery/dismiss', async (req, reply) => {
            const schema = z.object({
                reason: z.enum(['resume', 'rollback', 'ignore']).default('ignore'),
            });
            const parsed = schema.safeParse(req.body ?? {});
            if (!parsed.success) {
                await reply.code(400).send({ error: 'invalid dismiss request', details: parsed.error.flatten() });
                return;
            }
            const logPath = opts.logPath ?? getLogPath();
            appendTxLog(logPath, {
                ts: new Date().toISOString(),
                kind: 'rollback',
                path: '',
                sha256: null,
                note: `recovery dismissed: ${parsed.data.reason}`,
            });
            return { ok: true, reason: parsed.data.reason };
        });
    };
    return plugin;
}

