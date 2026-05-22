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
import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { z } from 'zod';
import { settingsSchema } from '../schemas/settings.js';
import { userMdSchema } from '../../shared/userMd/schema.js';
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
     * not shadow the new sandbox writes. Dry-run skips deletion. ENOENT
     * is silent (idempotent on re-run). The list of removed paths is
     * surfaced in the response as `migratedFrom`.
     */
    legacyReadRoot?: string | null;
    /** Total number of wizard steps (for resume continuity). */
    totalSteps?: number;
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
const SETTINGS_REL = '.agent-settings.yml';
const USER_MD_REL = '.agent-user.md';
// Step count mirrors the UI's `WIZARD_STEPS` array in `src/ui/wizard/steps.ts`
// and the chat-side `~/.claude/skills/onboard/SKILL.md`. Bump in lockstep.
const DEFAULT_TOTAL_STEPS = 7;

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

function zodIssuesToFields(issues: z.ZodIssue[]): Array<{ path: string; message: string }> {
    return issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

/**
 * Delete `.agent-settings.yml` + `.agent-user.md` from `legacyReadRoot`
 * once the new files are safely committed under `writeRoot`. Idempotent:
 * ENOENT is ignored so a re-run of `setup` after a successful migration
 * is a no-op. Returns the list of paths that were actually removed.
 */
async function deleteLegacyArtefacts(
    legacyReadRoot: string,
    writeRoot: string,
): Promise<string[]> {
    if (legacyReadRoot === writeRoot) return [];
    const candidates = [
        join(legacyReadRoot, SETTINGS_REL),
        join(legacyReadRoot, USER_MD_REL),
    ];
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
    const totalSteps = opts.totalSteps ?? DEFAULT_TOTAL_STEPS;
    const dryRun = opts.dryRun === true;
    const legacyReadRoot = opts.legacyReadRoot ?? null;
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
                return { step: 0, totalSteps, partial: {}, startedAt: null };
            }
            return { ...existing, totalSteps: existing.totalSteps ?? totalSteps };
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
            const body = (request.body ?? {}) as { settings?: unknown; userMd?: unknown };
            const settingsParsed = settingsSchema.safeParse(body.settings);
            if (!settingsParsed.success) {
                await reply.code(422).send({
                    error: { code: 'VALIDATION', message: 'invalid settings', fields: zodIssuesToFields(settingsParsed.error.issues) },
                });
                return reply;
            }
            // Wire shape: `userMd` is a bare string. The schema wraps it
            // as `{ body }` for length + frontmatter checks.
            const userMdParsed = body.userMd === undefined || body.userMd === null
                ? null
                : userMdSchema.safeParse({ body: body.userMd });
            if (userMdParsed && !userMdParsed.success) {
                await reply.code(422).send({
                    error: { code: 'VALIDATION', message: 'invalid user-md', fields: zodIssuesToFields(userMdParsed.error.issues) },
                });
                return reply;
            }

            try {
                const template = await readTemplate(opts.packageRoot);
                const settingsBody = mergeIntoTemplate(template, settingsParsed.data as Record<string, unknown>);
                const userMdBody = userMdParsed && userMdParsed.success ? userMdParsed.data.body : null;
                if (dryRun) {
                    // No disk write; surface the rendered would-be bodies
                    // so the maintainer sees the actual diff target.
                    return {
                        ok: true,
                        dryRun: true,
                        preview: { settingsYaml: settingsBody, userMd: userMdBody },
                    };
                }
                const payloads: CommitPayload[] = [
                    { target: join(opts.writeRoot, SETTINGS_REL), contents: settingsBody, mode: 0o600 },
                ];
                if (userMdBody !== null) {
                    payloads.push({ target: join(opts.writeRoot, USER_MD_REL), contents: userMdBody, mode: 0o600 });
                }
                const { txnId } = await commitMulti(payloads, { writeRoot: opts.writeRoot });
                await fs.unlink(statePath(opts.writeRoot)).catch(() => undefined);
                // Auto-migrate: remove the legacy in-CWD copies once the
                // new files are committed. Best-effort — a stat/unlink
                // race that leaves an orphan legacy file is harmless
                // (next re-run is a no-op).
                const migratedFrom = legacyReadRoot !== null
                    ? await deleteLegacyArtefacts(legacyReadRoot, opts.writeRoot).catch(() => [])
                    : [];
                return {
                    writtenPaths: payloads.map((p) => p.target),
                    txnId,
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
