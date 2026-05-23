/**
 * Wizard state + finalization routes.
 *
 * Contract: `docs/contracts/settings-api.md`.
 *
 *   GET  /api/v1/wizard/state   → resumable partial state
 *   POST /api/v1/wizard/state   → persist between step transitions
 *   POST /api/v1/wizard/finish  → 2PC commit of settings + user-md
 *
 * State persistence path: `<projectRoot>/state/wizard-state.json`.
 * The directory is created lazily; in package-sandbox mode `projectRoot`
 * is `<repo>/agents/` so the marker dir is the gitignored
 * `agents/runtime/state/` already shipped by the package gitignore template.
 *
 * The finish handler delegates atomic dual-write to `commitMulti`, which
 * handles the 2PC marker dance described in the council HIGH 2026-05-18
 * finding. A crash mid-commit is replayed at the next server boot.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { promises as fs, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { z } from 'zod';
import { settingsSchema } from '../schemas/settings.js';
import { userIdentitySchema } from '../../shared/userMd/schema.js';
import { composeUserIdentity } from '../../shared/userMd/utils.js';
import { mergeIntoTemplate } from '../io/yamlIO.js';
import { commitMulti, type CommitPayload } from '../io/atomicMultiWrite.js';
import { writeAtomic } from '../io/atomicWrite.js';

export interface WizardRouteOptions {
    /** Write root — every on-disk artefact (state, settings, user-md) resolves under this. */
    writeRoot: string;
    /**
     * Legacy-read fallback root. When set and distinct from `writeRoot`,
     * the finish handler deletes `<legacyReadRoot>/.agent-settings.yml`
     * and `<legacyReadRoot>/.agent-user.md` after a successful 2PC
     * commit — auto-migration so the maintainer's old in-repo files do
     * not shadow the new sandbox writes. The finish handler also
     * deletes legacy in-package-sandbox files at the flat
     * `<writeRoot>/` root — `.agent-user.md` (superseded by
     * `settings/.agent-user.yml`) and `.agent-settings.yml` (superseded
     * by `settings/.agent-settings.yml`). Dry-run skips deletion.
     * ENOENT is silent (idempotent on re-run). The list of removed
     * paths is surfaced in the response as `migratedFrom`.
     */
    legacyReadRoot?: string | null;
    /**
     * Consumer-project root the finish handler routes writes to when the
     * caller sends `scope: 'project'` (road-to-global-only-install
     * § Phase 2.3). `null` disables the opt-in: any `scope: 'project'`
     * body is then rejected with HTTP 422 because the request would have
     * nowhere meaningful to write. Default scope stays `'global'`, so
     * existing bundles that don't pass `scope` keep working unchanged.
     */
    projectScopeRoot?: string | null;
    /** Total number of wizard steps (for resume continuity). */
    totalSteps?: number;
    /**
     * Extended-step mode — surfaces `ai-tools` + `packs` ahead of the
     * canonical 7 settings steps (road-to-global-only-install § D9).
     * Defaults to `false` so v2.x consumers keep the 7-step flow until
     * the merged path ships end-to-end (§ Phase 1.9 — version is the
     * kill-switch, no dual code paths). Setting this to `true` also
     * unlocks the `/api/v1/wizard/auto-detect` + `/api/v1/wizard/manifest`
     * endpoints.
     */
    extendedSteps?: boolean;
    /**
     * Dry-run — POST /state writes to a per-server in-memory Map (initial
     * read still hits disk so an in-progress real run can be previewed);
     * POST /finish skips `commitMulti` and returns `{ ok, dryRun, preview }`
     * with the rendered would-be settings body and the user-md it would
     * have written. See `agents/roadmaps/onboarding-wizard-takeover.md`
     * § Dry-run state contract.
     */
    dryRun?: boolean;
}

const STATE_REL = join('state', 'wizard-state.json');
const SETTINGS_REL = join('settings', '.agent-settings.yml');
const USER_IDENTITY_REL = join('settings', '.agent-user.yml');
/** Legacy flat-root files — read for migration, deleted on successful finish. */
const LEGACY_USER_MD_REL = '.agent-user.md';
const LEGACY_SETTINGS_REL = '.agent-settings.yml';
// Step count mirrors the UI's `WIZARD_STEPS` array in `src/ui/wizard/steps.ts`
// and the chat-side `~/.claude/skills/onboard/SKILL.md`. Bump in lockstep.
// Extended mode (road-to-global-only-install § Phase 1) prepends two
// steps (ai-tools + packs) to ship the unified 9-step flow.
const DEFAULT_TOTAL_STEPS = 7;
const EXTENDED_TOTAL_STEPS = 9;

/**
 * Discovery-manifest path. Resolved from the package root the server
 * was booted with — same artefact the installer reads (ADR-015 locks
 * the location at `dist/discovery/discovery-manifest.json`).
 */
const MANIFEST_REL = join('dist', 'discovery', 'discovery-manifest.json');

const wizardStateSchema = z.object({
    step: z.number().int().min(0),
    totalSteps: z.number().int().min(1).optional(),
    partial: z.record(z.unknown()).default({}),
    startedAt: z.string().nullable().default(null),
});

type WizardState = z.infer<typeof wizardStateSchema>;

function statePath(root: string): string {
    return join(root, STATE_REL);
}

async function readState(root: string): Promise<WizardState | null> {
    try {
        const raw = await fs.readFile(statePath(root), 'utf8');
        const parsed = wizardStateSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : null;
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        return null;
    }
}

async function writeState(root: string, state: WizardState): Promise<void> {
    const path = statePath(root);
    await fs.mkdir(dirname(path), { recursive: true });
    await writeAtomic(path, JSON.stringify(state, null, 2), { mode: 0o600 });
}

async function readTemplate(packageRoot: string): Promise<string> {
    return fs.readFile(join(packageRoot, 'config', 'agent-settings.template.yml'), 'utf8');
}

/**
 * Lightweight pack/AI auto-detection — minimal port of
 * `packages/core/installer/src/detect.ts` to avoid a cross-package
 * import (the wizard server lives in `src/`, the installer ships
 * separately). Same signal shape, same evidence-paths.
 * road-to-global-only-install § Phase 1.2.
 */
interface DetectionSignal {
    readonly id: string;
    readonly reason: string;
    readonly evidence: string;
}

function detectProjectSignals(root: string): readonly DetectionSignal[] {
    const out: DetectionSignal[] = [];
    const exists = (rel: string): boolean => existsSync(join(root, rel));
    if (exists('composer.json')) out.push({ id: 'pack-php', reason: 'composer.json found', evidence: 'composer.json' });
    if (exists('package.json')) out.push({ id: 'pack-js', reason: 'package.json found', evidence: 'package.json' });
    if (exists('pyproject.toml') || exists('requirements.txt')) out.push({ id: 'pack-python', reason: 'python project file found', evidence: 'pyproject.toml/requirements.txt' });
    if (exists('artisan')) out.push({ id: 'pack-laravel', reason: 'artisan found', evidence: 'artisan' });
    if (exists('next.config.js') || exists('next.config.mjs') || exists('next.config.ts')) out.push({ id: 'pack-nextjs', reason: 'next.config found', evidence: 'next.config.*' });
    return out;
}

function zodIssuesToFields(issues: z.ZodIssue[]): Array<{ path: string; message: string }> {
    return issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

/**
 * Delete legacy artefacts once the new files are safely committed under
 * `writeRoot`. Covers two legacy locations:
 *   - `<legacyReadRoot>/.agent-settings.yml` + `.agent-user.md` (CWD)
 *   - `<writeRoot>/.agent-user.md` + `<writeRoot>/.agent-settings.yml`
 *     (in-sandbox flat-root; superseded by `settings/.agent-user.yml`
 *     and `settings/.agent-settings.yml`).
 * Idempotent: ENOENT is ignored so a re-run after a successful migration
 * is a no-op. Returns the list of paths that were actually removed.
 */
async function deleteLegacyArtefacts(
    legacyReadRoot: string | null,
    writeRoot: string,
): Promise<string[]> {
    const candidates: string[] = [];
    if (legacyReadRoot !== null && legacyReadRoot !== writeRoot) {
        candidates.push(
            join(legacyReadRoot, LEGACY_SETTINGS_REL),
            join(legacyReadRoot, LEGACY_USER_MD_REL),
        );
    }
    // In-sandbox legacy: pre-typed-subdir flat-root files.
    candidates.push(join(writeRoot, LEGACY_USER_MD_REL));
    candidates.push(join(writeRoot, LEGACY_SETTINGS_REL));
    const removed: string[] = [];
    for (const target of candidates) {
        try {
            await fs.unlink(target);
            removed.push(target);
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        }
    }
    return removed;
}

export function wizardRoute(opts: WizardRouteOptions & { packageRoot: string }): FastifyPluginAsync {
    const extended = opts.extendedSteps === true;
    const totalSteps = opts.totalSteps ?? (extended ? EXTENDED_TOTAL_STEPS : DEFAULT_TOTAL_STEPS);
    const dryRun = opts.dryRun === true;
    const legacyReadRoot = opts.legacyReadRoot ?? null;
    const projectScopeRoot = opts.projectScopeRoot ?? null;
    // Per-process in-memory state for dry-run. One CLI invocation = one
    // server = one Map; cross-session leakage is impossible because each
    // `agent-config setup --dry-run` mints a fresh server. See § Dry-run
    // state contract in the roadmap.
    let memState: WizardState | null = null;

    const plugin: FastifyPluginAsync = async (app: FastifyInstance) => {
        app.get('/api/v1/wizard/state', async () => {
            // Dry-run: in-memory write wins; fall back to disk so an
            // in-progress real run can be previewed.
            const existing = dryRun ? (memState ?? await readState(opts.writeRoot)) : await readState(opts.writeRoot);
            if (existing === null) {
                return { step: 0, totalSteps, partial: {}, startedAt: null, extendedSteps: extended };
            }
            return { ...existing, totalSteps: existing.totalSteps ?? totalSteps, extendedSteps: extended };
        });

        // road-to-global-only-install § Phase 1.2 — Auto-detect endpoint.
        // Reads package signals from the maintainer's CWD (the consumer
        // repo the wizard is running against). 404 when extended-mode is
        // off so the canonical 7-step contract stays unchanged.
        app.get('/api/v1/wizard/auto-detect', async (_request, reply) => {
            if (!extended) {
                await reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'extended-mode endpoint disabled' } });
                return reply;
            }
            const root = legacyReadRoot ?? process.cwd();
            const signals = detectProjectSignals(root);
            return { root, signals };
        });

        // road-to-global-only-install § Phase 1.3 — Manifest endpoint.
        // Surfaces the locked discovery-manifest (ADR-015) so the UI can
        // render the supported AI IDs + every pack the manifest exposes.
        app.get('/api/v1/wizard/manifest', async (_request, reply) => {
            if (!extended) {
                await reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'extended-mode endpoint disabled' } });
                return reply;
            }
            try {
                const manifestPath = join(opts.packageRoot, MANIFEST_REL);
                const raw = await fs.readFile(manifestPath, 'utf8');
                return JSON.parse(raw) as unknown;
            } catch (err) {
                const message = err instanceof Error ? err.message : 'manifest read failed';
                await reply.code(500).send({ error: { code: 'MANIFEST_UNAVAILABLE', message } });
                return reply;
            }
        });

        app.post('/api/v1/wizard/state', async (request, reply) => {
            const body = (request.body ?? {}) as Record<string, unknown>;
            const parsed = wizardStateSchema.safeParse({
                step: body.step,
                partial: body.partial ?? {},
                totalSteps: body.totalSteps ?? totalSteps,
                startedAt: body.startedAt ?? new Date().toISOString(),
            });
            if (!parsed.success) {
                await reply.code(422).send({
                    error: { code: 'VALIDATION', message: 'invalid wizard state', fields: zodIssuesToFields(parsed.error.issues) },
                });
                return reply;
            }
            if (dryRun) {
                memState = parsed.data;
                return { ok: true, dryRun: true };
            }
            await writeState(opts.writeRoot, parsed.data);
            return { ok: true };
        });

        app.post('/api/v1/wizard/finish', async (request, reply) => {
            const body = (request.body ?? {}) as { settings?: unknown; identity?: unknown; scope?: unknown };
            const settingsParsed = settingsSchema.safeParse(body.settings);
            if (!settingsParsed.success) {
                await reply.code(422).send({
                    error: { code: 'VALIDATION', message: 'invalid settings', fields: zodIssuesToFields(settingsParsed.error.issues) },
                });
                return reply;
            }
            // Wire shape: `identity` is the parsed YAML object (or omitted
            // when the user skipped the userMd step). The server owns the
            // YAML serialization via `composeUserIdentity`.
            const identityParsed = body.identity === undefined || body.identity === null
                ? null
                : userIdentitySchema.safeParse(body.identity);
            if (identityParsed && !identityParsed.success) {
                await reply.code(422).send({
                    error: { code: 'VALIDATION', message: 'invalid user identity', fields: zodIssuesToFields(identityParsed.error.issues) },
                });
                return reply;
            }
            // road-to-global-only-install § Phase 2.3 — explicit scope opt-in.
            // `'global'` (default) lands writes under the resolved writeRoot
            // (typically `~/.event4u/agent-config/`). `'project'` routes
            // writes to `<projectScopeRoot>/settings/` so a consumer can
            // pin settings to a single repo. Any other value rejected.
            const rawScope = body.scope;
            const scope: 'global' | 'project' = rawScope === 'project' ? 'project' : 'global';
            if (rawScope !== undefined && rawScope !== 'global' && rawScope !== 'project') {
                await reply.code(422).send({
                    error: { code: 'VALIDATION', message: "invalid scope (expected 'global' or 'project')", fields: [{ path: 'scope', message: 'must be \'global\' or \'project\'' }] },
                });
                return reply;
            }
            if (scope === 'project' && projectScopeRoot === null) {
                await reply.code(422).send({
                    error: { code: 'VALIDATION', message: 'project scope is unavailable in this server mode', fields: [{ path: 'scope', message: 'projectScopeRoot is null' }] },
                });
                return reply;
            }
            const effectiveWriteRoot = scope === 'project' && projectScopeRoot !== null
                ? projectScopeRoot
                : opts.writeRoot;

            try {
                const template = await readTemplate(opts.packageRoot);
                const settingsBody = mergeIntoTemplate(template, settingsParsed.data as Record<string, unknown>);
                const identityBody = identityParsed && identityParsed.success
                    ? composeUserIdentity(identityParsed.data as Record<string, unknown>)
                    : null;
                if (dryRun) {
                    // No disk write; surface the rendered would-be bodies
                    // so the maintainer sees the actual diff target.
                    return {
                        ok: true,
                        dryRun: true,
                        scope,
                        preview: {
                            settingsYaml: settingsBody,
                            identity: identityParsed && identityParsed.success ? identityParsed.data : null,
                            userIdentityYaml: identityBody,
                        },
                    };
                }
                const payloads: CommitPayload[] = [
                    { target: join(effectiveWriteRoot, SETTINGS_REL), contents: settingsBody, mode: 0o600 },
                ];
                if (identityBody !== null) {
                    payloads.push({ target: join(effectiveWriteRoot, USER_IDENTITY_REL), contents: identityBody, mode: 0o600 });
                }
                const { txnId } = await commitMulti(payloads, { writeRoot: effectiveWriteRoot });
                // Wizard state lives under the original writeRoot (server
                // boot resolves it once and the resume path reads from
                // there). Clear it regardless of scope so the wizard
                // restarts clean on next launch.
                await fs.unlink(statePath(opts.writeRoot)).catch(() => undefined);
                // Auto-migrate: remove legacy `.agent-user.md` (both the
                // in-CWD copy and the in-sandbox copy) and the in-CWD
                // `.agent-settings.yml` once the new files are committed.
                // Skipped for scope='project' when the legacy root IS the
                // effective write root — we just wrote `settings/*` there
                // and the flat-root files are independent legacy artefacts
                // that should still be cleaned. The helper handles that.
                const migratedFrom = await deleteLegacyArtefacts(legacyReadRoot, effectiveWriteRoot).catch(() => []);
                return {
                    writtenPaths: payloads.map((p) => p.target),
                    txnId,
                    scope,
                    ...(migratedFrom.length > 0 ? { migratedFrom } : {}),
                };
            } catch (err) {
                const message = err instanceof Error ? err.message : '2PC commit failed';
                await reply.code(500).send({ error: { code: 'TXN_PARTIAL', message } });
                return reply;
            }
        });
    };
    return plugin;
}
