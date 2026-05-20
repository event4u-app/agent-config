/**
 * Wizard state + finalization routes.
 *
 * Contract: `docs/contracts/settings-api.md`.
 *
 *   GET  /api/v1/wizard/state   → resumable partial state
 *   POST /api/v1/wizard/state   → persist between step transitions
 *   POST /api/v1/wizard/finish  → 2PC commit of settings + user-md
 *
 * State persistence path: `<projectRoot>/.agent-config/wizard-state.json`.
 * The directory is created lazily; both file and dir live behind the
 * `/agent-config/wizard-state.json` gitignore entry shipped by the package
 * `.gitignore` block.
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
import { userMdSchema } from '../schemas/userMd.js';
import { mergeIntoTemplate } from '../io/yamlIO.js';
import { commitMulti, type CommitPayload } from '../io/atomicMultiWrite.js';
import { writeAtomic } from '../io/atomicWrite.js';

export interface WizardRouteOptions {
    /** Project root — every on-disk artefact resolves under this. */
    projectRoot: string;
    /** Total number of wizard steps (for resume continuity). */
    totalSteps?: number;
}

const STATE_REL = join('.agent-config', 'wizard-state.json');
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

export function wizardRoute(opts: WizardRouteOptions & { packageRoot: string }): FastifyPluginAsync {
    const totalSteps = opts.totalSteps ?? DEFAULT_TOTAL_STEPS;

    const plugin: FastifyPluginAsync = async (app: FastifyInstance) => {
        app.get('/api/v1/wizard/state', async () => {
            const existing = await readState(opts.projectRoot);
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
            await writeState(opts.projectRoot, parsed.data);
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
            // Wire shape: `userMd` is a bare string (matches the chat
            // subcommand payload in `cli/commands/onboardFinish.ts`). The
            // schema wraps it as `{ body }` for length + gray-matter checks.
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
                const payloads: CommitPayload[] = [
                    { target: join(opts.projectRoot, SETTINGS_REL), contents: settingsBody, mode: 0o600 },
                ];
                if (userMdParsed && userMdParsed.success) {
                    payloads.push({ target: join(opts.projectRoot, USER_MD_REL), contents: userMdParsed.data.body, mode: 0o600 });
                }
                const { txnId } = await commitMulti(payloads, { projectRoot: opts.projectRoot });
                await fs.unlink(statePath(opts.projectRoot)).catch(() => undefined);
                return { writtenPaths: payloads.map((p) => p.target), txnId };
            } catch (err) {
                const message = err instanceof Error ? err.message : '2PC commit failed';
                await reply.code(500).send({ error: { code: 'TXN_PARTIAL', message } });
                return reply;
            }
        });
    };
    return plugin;
}
