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
import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify';
import { promises as fs, existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { settingsSchema } from '../schemas/settings.js';
import { userIdentitySchema } from '../../shared/userMd/schema.js';
import { composeUserIdentity } from '../../shared/userMd/utils.js';
import { mergeIntoTemplate, parseYaml, replaceScalar } from '../io/yamlIO.js';
import { commitMulti, type CommitPayload } from '../io/atomicMultiWrite.js';
import { writeAtomic } from '../io/atomicWrite.js';
import { detectInstalledTools, isBinaryOnPath, knownToolIds } from '../../install/toolDetection.js';
import { readSelectedTools, writeSelectedTools } from '../../install/selectedTools.js';

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
     * Initial step index reported by `GET /api/v1/wizard/state` when no
     * `wizard-state.json` is present. road-to-unified-setup § B0 — the
     * `install` subcommand lands at index 0 (AI tools) and `setup` lands
     * at index 4 (Identity / first settings step), both off the same
     * 13-step extended flow. Ignored when state has been persisted: a
     * resumed wizard always picks up where the user left off.
     */
    initialStep?: number;
    /**
     * Wizard entry mode — road-to-unified-setup § B5. `install` runs the
     * install-only lead (ai-tools / roles / packs) then renders a
     * hard-stop continue-screen at identity. `setup` skips the lead and
     * lands on identity. The project `modules` step sits at the end of the
     * flow (before review) in both modes. `null` / undefined preserves the
     * canonical navigation contract for legacy ui:serve callers.
     */
    wizardMode?: 'install' | 'setup' | null;
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
// road-to-wizard-ux-improvements § Phase 8 — AI Council config file. Lives
// beside the other settings under <writeRoot>/settings/; seeded from the
// package's hand-tuned reference when the target is absent (first run).
const AI_COUNCIL_REL = join('settings', '.ai-council.yml');
const PACKAGE_AI_COUNCIL_REL = join('agents', 'settings', '.ai-council.yml');
const AI_COUNCIL_PROVIDERS = ['anthropic', 'openai', 'gemini', 'xai', 'perplexity'] as const;
// Only these two ship an interactive 0600-key installer; the rest use env vars.
const AI_COUNCIL_KEY_INSTALL: Readonly<Record<string, string>> = {
    anthropic: 'bash scripts/install_anthropic_key.sh',
    openai: 'bash scripts/install_openai_key.sh',
};
/** Legacy flat-root files — read for migration, deleted on successful finish. */
const LEGACY_USER_MD_REL = '.agent-user.md';
const LEGACY_SETTINGS_REL = '.agent-settings.yml';
// Step count mirrors the UI's `getWizardSteps` plan in `src/ui/wizard/steps.ts`.
// Bump in lockstep. Default flow = welcome + 8 core steps (editor, personality,
// cost, roadmap-quality, memory, ai-council, user-md, review) → 9. Extended
// mode adds the install-only lead (ai-tools + roles + packs) and appends the
// project `modules` step just before review → 13.
const DEFAULT_TOTAL_STEPS = 9;
const EXTENDED_TOTAL_STEPS = 13;

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

// road-to-global-only-install § Phase 1.5 — WizardApplyPayload shape.
// Mirrors `internal/schemas/wizard-apply-payload.schema.json`; the discriminator
// (`schema_version`) selects the variant. Real schema validation lives
// in install.py — the route only enforces the outer envelope so the
// bridge spawn surface stays tight.
const installerV1PayloadSchema = z.object({
    schema_version: z.literal('installer-v1'),
    ai_tools: z.array(z.string().min(1)).min(1),
    configs: z.record(z.record(z.unknown())).default({}),
    dry_run: z.boolean().optional(),
});

const wizardV2PayloadSchema = z.object({
    schema_version: z.literal('wizard-v2'),
    tools: z.array(z.string().min(1)).min(1),
    packs: z.array(z.string().min(1)).default([]),
    settings: z.record(z.unknown()).default({}),
    scope_to_project_only: z.boolean().optional(),
    dry_run: z.boolean().optional(),
});

const applyPayloadSchema = z.discriminatedUnion('schema_version', [
    installerV1PayloadSchema,
    wizardV2PayloadSchema,
]);

function statePath(root: string): string {
    return join(root, STATE_REL);
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
 * Read the AI-council YAML body for editing (road-to-wizard-ux-improvements
 * § Phase 8): prefer the target under `<writeRoot>/settings/.ai-council.yml`;
 * fall back to the package's hand-tuned reference so a first-run consumer edits
 * a fully-commented file rather than a synthesised stub.
 */
async function readCouncilBody(writeRoot: string, packageRoot: string): Promise<string> {
    try {
        return await fs.readFile(join(writeRoot, AI_COUNCIL_REL), 'utf8');
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    return fs.readFile(join(packageRoot, PACKAGE_AI_COUNCIL_REL), 'utf8');
}

/** Which provider key files exist on disk (`~/.event4u/agent-config/<p>.key`). */
function councilKeyPresence(): Record<string, boolean> {
    const roots = [
        join(homedir(), '.event4u', 'agent-config'),
        join(homedir(), '.config', 'agent-config'),
    ];
    const out: Record<string, boolean> = {};
    for (const p of AI_COUNCIL_PROVIDERS) {
        out[p] = roots.some((r) => existsSync(join(r, `${p}.key`)));
    }
    return out;
}

interface CouncilMemberView { enabled: boolean; participate_low_impact: boolean }
interface CouncilConfigView {
    enabled: boolean;
    defaults: { mode: string; min_rounds: number };
    cost_budget: { max_total_usd: number };
    members: Record<string, CouncilMemberView>;
    // Mode per decision class (trivial/low_impact/medium_impact); matches the
    // SPA `AiCouncilState.decision` + the POST payload `decision` field.
    decision: Record<string, string>;
}

/** Pull the wizard-controlled scalar subset out of a parsed council config. */
function extractCouncilConfig(body: string): CouncilConfigView {
    const doc = parseYaml(body) as Record<string, unknown>;
    const obj = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? v as Record<string, unknown> : {});
    const defaults = obj(doc['defaults']);
    const costBudget = obj(doc['cost_budget']);
    const membersRaw = obj(doc['members']);
    const dr = obj(doc['decision_resolution']);
    const classes = obj(dr['classes']);
    const members: Record<string, CouncilMemberView> = {};
    for (const p of AI_COUNCIL_PROVIDERS) {
        const m = obj(membersRaw[p]);
        members[p] = {
            enabled: m['enabled'] === true,
            participate_low_impact: m['participate_low_impact'] === true,
        };
    }
    const decision: Record<string, string> = {};
    for (const cls of ['trivial', 'low_impact', 'medium_impact']) {
        const c = obj(classes[cls]);
        if (typeof c['mode'] === 'string') decision[cls] = c['mode'];
    }
    return {
        enabled: doc['enabled'] === true,
        defaults: {
            mode: typeof defaults['mode'] === 'string' ? defaults['mode'] as string : 'api',
            min_rounds: typeof defaults['min_rounds'] === 'number' ? defaults['min_rounds'] as number : 2,
        },
        cost_budget: {
            max_total_usd: typeof costBudget['max_total_usd'] === 'number' ? costBudget['max_total_usd'] as number : 0,
        },
        members,
        decision,
    };
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

/**
 * Spawn the installer in a child process and collect its stdout / stderr.
 * Used by `/api/v1/wizard/apply` to bridge the WizardApplyPayload into
 * `scripts/install.py --apply-payload`. Caller pre-resolved `scriptPath`
 * so this helper stays I/O-only (no path discovery).
 */
interface InstallerResult {
    readonly exitCode: number;
    readonly stdout: string;
    readonly stderr: string;
}

async function spawnInstaller(scriptPath: string, args: readonly string[]): Promise<InstallerResult> {
    return new Promise<InstallerResult>((resolve, reject) => {
        const child = spawn('python3', [scriptPath, ...args], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, AGENT_CONFIG_NO_UPDATE_CHECK: '1' },
        });
        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        child.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
        child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
        child.once('error', reject);
        child.once('close', (code) => {
            resolve({
                exitCode: code ?? 1,
                stdout: Buffer.concat(stdoutChunks).toString('utf8'),
                stderr: Buffer.concat(stderrChunks).toString('utf8'),
            });
        });
    });
}

/**
 * Spawn `install.py --apply-payload` and stream its NDJSON stdout line by
 * line (road-to-single-install-source-of-truth § Phase 2). Each parsed line
 * is handed to `onLine`; malformed lines are forwarded as raw strings so the
 * caller can decide whether to ignore or surface them. stderr is buffered and
 * returned for error surfacing. `signal` aborts the run (abort-on-disconnect,
 * Finding #24) by killing the child.
 */
interface StreamResult {
    readonly exitCode: number;
    readonly stderr: string;
}

/** SSE frame writer — one event per `data:` line, blank-line terminator. */
function writeFrame(reply: FastifyReply, payload: Record<string, unknown>): void {
    reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function streamInstaller(
    scriptPath: string,
    args: readonly string[],
    onLine: (obj: Record<string, unknown>) => void,
    signal?: AbortSignal,
): Promise<StreamResult> {
    return new Promise<StreamResult>((resolve, reject) => {
        const child = spawn('python3', [scriptPath, ...args], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, AGENT_CONFIG_NO_UPDATE_CHECK: '1' },
        });
        const onAbort = (): void => {
            child.kill('SIGTERM');
        };
        if (signal !== undefined) {
            if (signal.aborted) onAbort();
            else signal.addEventListener('abort', onAbort, { once: true });
        }
        const stderrChunks: Buffer[] = [];
        let buf = '';
        const handleLine = (line: string): void => {
            const trimmed = line.trim();
            if (trimmed.length === 0) return;
            try {
                onLine(JSON.parse(trimmed) as Record<string, unknown>);
            } catch {
                // Non-JSON stdout (defensive — real-apply runs with QUIET so
                // only NDJSON reaches stdout). Drop it rather than corrupt the
                // SSE stream.
            }
        };
        child.stdout?.on('data', (chunk: Buffer) => {
            buf += chunk.toString('utf8');
            let nl = buf.indexOf('\n');
            while (nl !== -1) {
                handleLine(buf.slice(0, nl));
                buf = buf.slice(nl + 1);
                nl = buf.indexOf('\n');
            }
        });
        child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
        child.once('error', (err) => {
            if (signal !== undefined) signal.removeEventListener('abort', onAbort);
            reject(err);
        });
        child.once('close', (code) => {
            if (buf.trim().length > 0) handleLine(buf);
            if (signal !== undefined) signal.removeEventListener('abort', onAbort);
            resolve({ exitCode: code ?? 1, stderr: Buffer.concat(stderrChunks).toString('utf8') });
        });
    });
}

async function spawnBash(scriptPath: string, args: readonly string[]): Promise<InstallerResult> {
    return new Promise<InstallerResult>((resolve, reject) => {
        const child = spawn('bash', [scriptPath, ...args], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, AGENT_CONFIG_NO_UPDATE_CHECK: '1' },
        });
        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        child.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
        child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
        child.once('error', reject);
        child.once('close', (code) => {
            resolve({
                exitCode: code ?? 1,
                stdout: Buffer.concat(stdoutChunks).toString('utf8'),
                stderr: Buffer.concat(stderrChunks).toString('utf8'),
            });
        });
    });
}

/**
 * Phase B Step 4 of road-to-clean-skill-distribution-channels.
 * Parses the line-oriented output of scripts/_lib/scope_guard.sh into
 * a structured response for the wizard UI. Each non-SUMMARY line carries
 * verdict, tool, otherScopePath, otherVersion, thisVersion.
 */
interface ScopeGuardFinding {
    verdict: 'OK' | 'WARN' | 'DRIFT';
    tool: string;
    otherScopePath: string;
    otherVersion: string;
    thisVersion: string;
}

interface ScopeGuardResult {
    overall: 'OK' | 'WARN' | 'DRIFT';
    countOk: number;
    countWarn: number;
    countDrift: number;
    findings: ScopeGuardFinding[];
}

function parseScopeGuardOutput(stdout: string): ScopeGuardResult {
    const findings: ScopeGuardFinding[] = [];
    let overall: 'OK' | 'WARN' | 'DRIFT' = 'OK';
    let countOk = 0;
    let countWarn = 0;
    let countDrift = 0;
    for (const line of stdout.split('\n')) {
        if (!line.trim()) continue;
        const parts = line.split('\t');
        if (parts[0] === 'SUMMARY') {
            overall = (parts[1] as 'OK' | 'WARN' | 'DRIFT') ?? 'OK';
            countOk = Number.parseInt(parts[2] ?? '0', 10);
            countWarn = Number.parseInt(parts[3] ?? '0', 10);
            countDrift = Number.parseInt(parts[4] ?? '0', 10);
            continue;
        }
        const [verdict, tool, otherScopePath, otherVersion, thisVersion] = parts;
        if (verdict !== 'OK' && verdict !== 'WARN' && verdict !== 'DRIFT') continue;
        findings.push({
            verdict: verdict as 'OK' | 'WARN' | 'DRIFT',
            tool: tool ?? '?',
            otherScopePath: otherScopePath ?? '-',
            otherVersion: otherVersion ?? '-',
            thisVersion: thisVersion ?? '-',
        });
    }
    return { overall, countOk, countWarn, countDrift, findings };
}

// road-to-configurable-modules § Phase E — wire shape of the
// `modulesConfig` field on `POST /api/v1/wizard/finish`. Matches the
// `proposed_block` JSON emitted by `propose_modules_config.py --json`
// so the wizard can round-trip the detection output untouched. Extra
// fields are rejected — the persistence helper has its own coercion
// for older payload shapes, but the wizard always sends the strict
// shape.
const modulesConfigSchema = z.object({
    enabled: z.boolean(),
    root_paths: z.array(z.string()),
    namespace_template: z.string().optional(),
    agent_folder: z.string().optional(),
    skip_dirs: z.array(z.string()).optional(),
}).strict();

// road-to-wizard-ux-improvements § Phase 8 — wizard-controlled scalar subset of
// `.ai-council.yml`. Scalar leaves only (safe for `replaceScalar`); the LOCKED
// decision classes (high_impact / user_required) and deep knobs (advisors,
// model_ladder, …) are intentionally NOT writable here — hand-edit only.
const aiCouncilPayloadSchema = z.object({
    enabled: z.boolean().optional(),
    defaultMode: z.enum(['manual', 'api', 'cli']).optional(),
    minRounds: z.number().int().min(1).optional(),
    maxTotalUsd: z.number().min(0).optional(),
    members: z.record(z.object({
        enabled: z.boolean().optional(),
        participateLowImpact: z.boolean().optional(),
    })).optional(),
    // keys ∈ {trivial, low_impact, medium_impact} — others ignored.
    decision: z.record(z.enum(['agent', 'council', 'user'])).optional(),
}).strict();

export function wizardRoute(opts: WizardRouteOptions & { packageRoot: string }): FastifyPluginAsync {
    const extended = opts.extendedSteps === true;
    const totalSteps = opts.totalSteps ?? (extended ? EXTENDED_TOTAL_STEPS : DEFAULT_TOTAL_STEPS);
    // Clamp the CLI-provided initial step to the active step range so a
    // stale `--initial-step=99` cannot shove the UI past the last screen.
    const rawInitial = opts.initialStep ?? 0;
    const initialStep = Math.max(0, Math.min(totalSteps - 1, Math.trunc(rawInitial)));
    const wizardMode: 'install' | 'setup' | null = opts.wizardMode ?? null;
    const dryRun = opts.dryRun === true;
    const legacyReadRoot = opts.legacyReadRoot ?? null;
    const projectScopeRoot = opts.projectScopeRoot ?? null;
    // Per-server-session in-memory wizard state (road-to-wizard-ux-improvements
    // § Phase 1 — "server-boot = fresh"). Each `init`/`setup`/`--dry-run`
    // launch mints a fresh server, so a brand-new launch ALWAYS starts at
    // `initialStep`. Resume happens only within the same running server
    // lifetime (e.g. a browser refresh while the server is up), driven by this
    // in-memory state — never from the on-disk `wizard-state.json`, which is a
    // crash breadcrumb, not a cross-launch resume source.
    let memState: WizardState | null = null;

    const plugin: FastifyPluginAsync = async (app: FastifyInstance) => {
        app.get('/api/v1/wizard/state', async () => {
            // Resume from the in-memory session only — a fresh server boot has
            // no session state and therefore starts fresh at `initialStep`.
            const existing = memState;
            if (existing === null) {
                return {
                    step: initialStep,
                    totalSteps,
                    partial: {},
                    startedAt: null,
                    extendedSteps: extended,
                    wizardMode,
                };
            }
            return {
                ...existing,
                totalSteps: existing.totalSteps ?? totalSteps,
                extendedSteps: extended,
                wizardMode,
            };
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

        // road-to-wizard-ux-improvements § Phase 2 — AI-tool presence on the
        // machine running the wizard. Probes the user's home dir + app bundles
        // + $PATH (NOT the project) so Step 1 can pre-select installed tools on
        // first run and badge each tool. Read-only; extended-mode only.
        app.get('/api/v1/wizard/detect-tools', async (_request, reply) => {
            if (!extended) {
                await reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'extended-mode endpoint disabled' } });
                return reply;
            }
            // `configured` = the tools the user selected in a prior wizard run
            // (wizard-tools.json), NOT every deployed tool. Step 1 pre-selects
            // these on a repeat run; only when none are recorded does it fall
            // back to pre-selecting every installed tool (first-run convenience).
            return {
                tools: detectInstalledTools(),
                configured: readSelectedTools(new Set(knownToolIds())),
            };
        });

        // road-to-wizard-ux-improvements § Phase 7 — rtk presence on the
        // Editor-and-tooling step. Detection is the ONLY source of truth (the
        // value is never loaded from `.agent-settings.yml`). When rtk is
        // missing, return the suggested per-OS install command + repo so the
        // UI can offer a copy-and-run button (we surface the command rather
        // than shelling out an unverified package install — non-destructive
        // by default). Read-only; extended-mode only.
        app.get('/api/v1/wizard/detect-rtk', async (_request, reply) => {
            if (!extended) {
                await reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'extended-mode endpoint disabled' } });
                return reply;
            }
            const installed = isBinaryOnPath('rtk');
            // Per-OS install hint (maintainer-tunable). `cargo install --git`
            // is the portable fallback for the Rust tool when no packaged
            // formula is known.
            const repo = 'https://github.com/event4u-app/rtk';
            const installCommandByOs: Record<string, string> = {
                darwin: 'brew install rtk',
                linux: `cargo install --git ${repo}`,
                win32: `cargo install --git ${repo}`,
            };
            return {
                installed,
                platform: process.platform,
                repo,
                installCommand: installed ? null : (installCommandByOs[process.platform] ?? `cargo install --git ${repo}`),
            };
        });

        // road-to-wizard-ux-improvements § Phase 8 — AI Council config.
        // GET returns the wizard-controlled scalar subset (read from the write
        // root, or seeded from the package's hand-tuned reference), plus which
        // provider keys exist + the install-command affordance. Extended only.
        app.get('/api/v1/wizard/ai-council', async (_request, reply) => {
            if (!extended) {
                await reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'extended-mode endpoint disabled' } });
                return reply;
            }
            try {
                const body = await readCouncilBody(opts.writeRoot, opts.packageRoot);
                return {
                    config: extractCouncilConfig(body),
                    providers: AI_COUNCIL_PROVIDERS,
                    keyPresence: councilKeyPresence(),
                    keyInstall: AI_COUNCIL_KEY_INSTALL,
                };
            } catch (err) {
                const message = err instanceof Error ? err.message : 'failed to read .ai-council.yml';
                await reply.code(500).send({ error: { code: 'COUNCIL_READ_FAILED', message } });
                return reply;
            }
        });

        // POST applies the scalar subset into `.ai-council.yml` via
        // comment-preserving `replaceScalar` edits (never a full dump), then
        // atomic-writes <writeRoot>/settings/.ai-council.yml.
        app.post('/api/v1/wizard/ai-council', async (request, reply) => {
            if (!extended) {
                await reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'extended-mode endpoint disabled' } });
                return reply;
            }
            const parsed = aiCouncilPayloadSchema.safeParse(request.body ?? {});
            if (!parsed.success) {
                await reply.code(422).send({
                    error: { code: 'VALIDATION', message: 'invalid ai-council payload', fields: zodIssuesToFields(parsed.error.issues) },
                });
                return reply;
            }
            const p = parsed.data;
            try {
                let body = await readCouncilBody(opts.writeRoot, opts.packageRoot);
                const set = (path: string[], value: unknown): void => {
                    if (value !== undefined) body = replaceScalar(body, path, value);
                };
                set(['enabled'], p.enabled);
                set(['defaults', 'mode'], p.defaultMode);
                set(['defaults', 'min_rounds'], p.minRounds);
                set(['cost_budget', 'max_total_usd'], p.maxTotalUsd);
                for (const provider of AI_COUNCIL_PROVIDERS) {
                    const m = p.members?.[provider];
                    if (m === undefined) continue;
                    set(['members', provider, 'enabled'], m.enabled);
                    set(['members', provider, 'participate_low_impact'], m.participateLowImpact);
                }
                for (const cls of ['trivial', 'low_impact', 'medium_impact']) {
                    set(['decision_resolution', 'classes', cls, 'mode'], p.decision?.[cls]);
                }
                const target = join(opts.writeRoot, AI_COUNCIL_REL);
                await fs.mkdir(dirname(target), { recursive: true });
                await writeAtomic(target, body, { mode: 0o600 });
                return { ok: true, written: target };
            } catch (err) {
                const message = err instanceof Error ? err.message : 'failed to write .ai-council.yml';
                await reply.code(500).send({ error: { code: 'COUNCIL_WRITE_FAILED', message } });
                return reply;
            }
        });

        // road-to-configurable-modules § Phase E — Modules detect endpoint.
        // Read-only scan: spawns `scripts/propose_modules_config.py --json`
        // against the consumer project so the wizard's modules step can
        // surface candidate root_paths + a prefilled `modules:` block.
        // Same root-resolution rule as `/auto-detect` (legacyReadRoot ??
        // cwd) — the consumer repo the maintainer is running the wizard
        // against. Available on every surface: module configuration is now
        // its own top-level "Projekt" page, not a wizard-only step.
        app.get('/api/v1/modules/detect', async (_request, reply) => {
            const root = legacyReadRoot ?? process.cwd();
            const scriptPath = join(opts.packageRoot, 'scripts', 'propose_modules_config.py');
            try {
                const result = await spawnInstaller(scriptPath, ['--json', '--project', root]);
                if (result.exitCode !== 0) {
                    await reply.code(500).send({
                        error: { code: 'DETECT_FAILED', message: result.stderr || 'module detect bridge exited non-zero', exitCode: result.exitCode },
                    });
                    return reply;
                }
                try {
                    return JSON.parse(result.stdout) as unknown;
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'invalid JSON from module detect bridge';
                    await reply.code(500).send({ error: { code: 'DETECT_PARSE_FAILED', message } });
                    return reply;
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : 'module detect bridge failed';
                await reply.code(500).send({ error: { code: 'DETECT_FAILED', message } });
                return reply;
            }
        });

        // Modules apply endpoint — persists the `modules:` block to the
        // consumer project's `.agent-project-settings.yml` via
        // `apply_modules_config.py`. Standalone counterpart to the modules
        // payload the wizard finish used to carry: module configuration is
        // now its own "Projekt" surface, so it saves independently of the
        // global-settings wizard. Project-scoped by construction (writes the
        // team file under `legacyReadRoot ?? cwd`).
        app.post('/api/v1/modules/apply', async (request, reply) => {
            const parsed = modulesConfigSchema.safeParse(request.body ?? {});
            if (!parsed.success) {
                await reply.code(422).send({
                    error: { code: 'VALIDATION', message: 'invalid modulesConfig', fields: zodIssuesToFields(parsed.error.issues) },
                });
                return reply;
            }
            const projectRoot = legacyReadRoot ?? process.cwd();
            const scriptPath = join(opts.packageRoot, 'scripts', 'apply_modules_config.py');
            const tmpPath = join(tmpdir(), `agent-config-modules-${randomBytes(8).toString('hex')}.json`);
            try {
                await fs.writeFile(tmpPath, JSON.stringify(parsed.data), { mode: 0o600 });
                const result = await spawnInstaller(scriptPath, ['--project', projectRoot, '--input-file', tmpPath]);
                if (result.exitCode !== 0) {
                    await reply.code(500).send({
                        error: { code: 'MODULES_APPLY_FAILED', message: result.stderr || 'modules apply bridge exited non-zero', exitCode: result.exitCode },
                    });
                    return reply;
                }
                return { ok: true, appliedTo: result.stdout.trim() || null, projectRoot };
            } catch (err) {
                const message = err instanceof Error ? err.message : 'modules apply bridge failed';
                await reply.code(500).send({ error: { code: 'MODULES_APPLY_FAILED', message } });
                return reply;
            } finally {
                await fs.unlink(tmpPath).catch(() => undefined);
            }
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

        // road-to-clean-skill-distribution-channels § Phase D Step 3 —
        // harness-expectations endpoint. Returns the three classes the
        // wizard's final review step renders after install completes.
        // Content is static + sourced from docs/contracts/harness-expectations.md
        // (the doc is the long form; this endpoint is the wizard-shaped
        // short form so the UI does not have to parse markdown).
        app.get('/api/v1/wizard/harness-expectations', async (_request, reply) => {
            if (!extended) {
                await reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'extended-mode endpoint disabled' } });
                return reply;
            }
            return {
                contractPath: 'docs/contracts/harness-expectations.md',
                classes: [
                    {
                        id: 'sibling-plugins',
                        title: 'Plugin-namespaced peer skills',
                        symptom: 'Skills appear under namespaces like codex:* or cc-gemini-plugin:*.',
                        cause: 'Sibling AI-tool plugins loaded by the harness; not owned by this package.',
                        action: 'Use the harness’s plugin-list command to identify the source.',
                    },
                    {
                        id: 'deferred-tools',
                        title: 'Tools deferred behind ToolSearch',
                        symptom: 'system-reminder mentions “deferred tools … available via ToolSearch”.',
                        cause: 'Harness defers schema load until needed to protect context budget.',
                        action: 'Run ToolSearch with select:<name> to load the schema before calling.',
                    },
                    {
                        id: 'duplicate-registration',
                        title: 'Duplicate skill registration',
                        symptom: 'Same skill name appears twice in the available-skills list.',
                        cause: 'Cross-scope install drift (~/.claude/skills/ + ./.claude/skills/ at different versions).',
                        action: 'Run `task probe:skills` — if findings show DUPLICATE/DRIFT, clean with `bash scripts/cleanup_other_scope.sh --confirm`.',
                    },
                ],
                triage: [
                    'Run `task probe:skills` first — confirms or rules out class 3.',
                    'If a vendor: prefix shows, check the harness’s plugin list.',
                    'deferred-tools reminder = expected; the skill must call ToolSearch.',
                ],
            };
        });

        // road-to-clean-skill-distribution-channels § Phase C Step 6 —
        // probe endpoint. Spawns scripts/probe_skill_registration.py with
        // --format=json so the wizard's final step can surface DUPLICATE /
        // DRIFT findings before the operator closes the install. Read-only.
        app.get('/api/v1/wizard/probe', async (_request, reply) => {
            if (!extended) {
                await reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'extended-mode endpoint disabled' } });
                return reply;
            }
            const probePath = join(opts.packageRoot, 'scripts', 'probe_skill_registration.py');
            if (!existsSync(probePath)) {
                await reply.code(500).send({ error: { code: 'PROBE_MISSING', message: `probe script not found at ${probePath}` } });
                return reply;
            }
            const projectRoot = legacyReadRoot ?? process.cwd();
            try {
                const result = await spawnInstaller(probePath, ['--project', projectRoot, '--format=json']);
                // Default mode exits 0 regardless of findings; --strict (not
                // passed here) is the only path with a non-zero exit.
                if (result.exitCode !== 0) {
                    await reply.code(500).send({
                        error: { code: 'PROBE_FAILED', message: result.stderr || `probe exited ${result.exitCode}`, exitCode: result.exitCode },
                    });
                    return reply;
                }
                try {
                    return JSON.parse(result.stdout) as unknown;
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'invalid JSON from probe';
                    await reply.code(500).send({ error: { code: 'PROBE_PARSE_FAILED', message } });
                    return reply;
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : 'probe failed to spawn';
                await reply.code(500).send({ error: { code: 'PROBE_FAILED', message } });
                return reply;
            }
        });

        // road-to-clean-skill-distribution-channels § Phase B Step 4 —
        // scope-guard endpoint. Spawns scripts/_lib/scope_guard.sh against
        // the target project root and the user's $HOME, returns a
        // structured verdict the wizard's first step renders before the
        // operator picks an install scope. Read-only — no file writes.
        app.get('/api/v1/wizard/scope-guard', async (_request, reply) => {
            if (!extended) {
                await reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'extended-mode endpoint disabled' } });
                return reply;
            }
            const guardPath = join(opts.packageRoot, 'scripts', '_lib', 'scope_guard.sh');
            if (!existsSync(guardPath)) {
                await reply.code(500).send({ error: { code: 'GUARD_MISSING', message: `scope_guard.sh not found at ${guardPath}` } });
                return reply;
            }
            const projectRoot = legacyReadRoot ?? process.cwd();
            try {
                const result = await spawnBash(guardPath, ['project', opts.packageRoot, projectRoot]);
                // The script always exits 0; we still pass through stderr
                // on a non-zero so the UI can surface platform issues.
                if (result.exitCode !== 0) {
                    await reply.code(500).send({
                        error: { code: 'GUARD_FAILED', message: result.stderr || `scope_guard.sh exited ${result.exitCode}`, exitCode: result.exitCode },
                    });
                    return reply;
                }
                return parseScopeGuardOutput(result.stdout);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'scope_guard.sh failed to spawn';
                await reply.code(500).send({ error: { code: 'GUARD_FAILED', message } });
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
            // Always update the in-memory session state (the resume source).
            memState = parsed.data;
            if (dryRun) {
                return { ok: true, dryRun: true };
            }
            // Disk write is a crash breadcrumb only (not read back for resume);
            // the finish handler clears it on a successful commit.
            await writeState(opts.writeRoot, parsed.data);
            return { ok: true };
        });

        // road-to-single-install-source-of-truth § Phase 2 — Wizard Apply bridge.
        // Validates the WizardApplyPayload envelope and spills it to a temp file,
        // then dispatches `scripts/install.py --apply-payload <tmp>` — the single
        // installer (D12 / ADR-020). Two modes on the SAME endpoint:
        //   • dry_run:true  → buffered plan-summary preview (JSON), used by the
        //     Review step. Adds `--dry-run`.
        //   • dry_run:false → REAL apply, streamed as SSE. install.py emits NDJSON
        //     (`{type:"file"|"done"|"error"}`); we map each line to the SSE frame
        //     vocabulary the UI consumes (`progress`/`done`/`error`) and abort the
        //     child on client disconnect (Finding #24). CSRF + Host/Origin
        //     allow-list are enforced by the app-level onRequest hooks.
        app.post('/api/v1/wizard/apply', async (request, reply) => {
            if (!extended) {
                await reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'extended-mode endpoint disabled' } });
                return reply;
            }
            const parsed = applyPayloadSchema.safeParse(request.body);
            if (!parsed.success) {
                await reply.code(422).send({
                    error: { code: 'VALIDATION', message: 'invalid apply payload', fields: zodIssuesToFields(parsed.error.issues) },
                });
                return reply;
            }
            const isDryRun = parsed.data.dry_run === true;
            const payload = parsed.data;
            const tmpPath = join(tmpdir(), `agent-config-apply-${randomBytes(8).toString('hex')}.json`);
            const scriptPath = join(opts.packageRoot, 'scripts', 'install.py');

            if (isDryRun) {
                // Plan-summary preview — buffered JSON (Review step).
                try {
                    await fs.writeFile(tmpPath, JSON.stringify(payload), { mode: 0o600 });
                    const result = await spawnInstaller(scriptPath, ['--apply-payload', tmpPath, '--dry-run']);
                    if (result.exitCode !== 0) {
                        await reply.code(500).send({
                            error: { code: 'BRIDGE_FAILED', message: result.stderr || 'installer bridge exited non-zero', exitCode: result.exitCode },
                        });
                        return reply;
                    }
                    return {
                        ok: true,
                        dryRun: true,
                        schemaVersion: payload.schema_version,
                        preview: result.stdout,
                    };
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'apply bridge failed';
                    await reply.code(500).send({ error: { code: 'BRIDGE_FAILED', message } });
                    return reply;
                } finally {
                    await fs.unlink(tmpPath).catch(() => undefined);
                }
            }

            // Real apply — SSE stream. Flush headers so the browser opens the
            // channel immediately.
            reply.raw.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                Connection: 'keep-alive',
                'X-Accel-Buffering': 'no',
            });
            reply.raw.flushHeaders?.();
            const controller = new AbortController();
            const onClose = (): void => {
                if (!reply.raw.writableEnded) controller.abort();
            };
            reply.raw.on('close', onClose);

            // Record the user's tool selection so the next wizard run
            // pre-selects exactly these (detect-tools `configured`). Written
            // on the real-apply path only — a dry-run preview must not.
            if (payload.schema_version === 'wizard-v2') {
                writeSelectedTools(payload.tools);
            }

            let written = 0;
            let total = 0;
            let sawTerminal = false;
            try {
                await fs.writeFile(tmpPath, JSON.stringify(payload), { mode: 0o600 });
                const result = await streamInstaller(
                    scriptPath,
                    ['--apply-payload', tmpPath],
                    (obj) => {
                        const t = obj.type;
                        if (t === 'file') {
                            written = typeof obj.written === 'number' ? obj.written : written;
                            total = typeof obj.total === 'number' ? obj.total : total;
                            writeFrame(reply, {
                                type: 'progress',
                                file: obj.file,
                                status: obj.status,
                                written,
                                total,
                            });
                        } else if (t === 'done') {
                            sawTerminal = true;
                            writeFrame(reply, { type: 'done', summary: { written, total } });
                        } else if (t === 'error') {
                            sawTerminal = true;
                            writeFrame(reply, {
                                type: 'error',
                                code: typeof obj.code === 'string' ? obj.code : 'E_INSTALL',
                                message: typeof obj.message === 'string' ? obj.message : 'install failed',
                                recoverable: false,
                            });
                        }
                    },
                    controller.signal,
                );
                // install.py exited without a terminal frame (crash / kill): emit
                // one so the UI never hangs waiting for `done`/`error`.
                if (!sawTerminal) {
                    if (result.exitCode === 0) {
                        writeFrame(reply, { type: 'done', summary: { written, total } });
                    } else {
                        writeFrame(reply, {
                            type: 'error',
                            code: 'BRIDGE_FAILED',
                            message: result.stderr.trim() || `installer exited ${result.exitCode}`,
                            recoverable: false,
                        });
                    }
                }
            } catch (err) {
                writeFrame(reply, {
                    type: 'error',
                    code: 'E_CRASH',
                    message: err instanceof Error ? err.message : String(err),
                    recoverable: false,
                });
            } finally {
                reply.raw.off('close', onClose);
                reply.raw.end();
                await fs.unlink(tmpPath).catch(() => undefined);
            }
            return reply;
        });

        app.post('/api/v1/wizard/finish', async (request, reply) => {
            const body = (request.body ?? {}) as {
                settings?: unknown;
                identity?: unknown;
                scope?: unknown;
                modulesConfig?: unknown;
            };
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
            // road-to-configurable-modules § Phase E — parse the modules
            // payload. Extended-mode only; legacy 7-step flow never sends
            // this field. Omitted / null → skip persistence (the team
            // file stays untouched).
            const rawModulesConfig = body.modulesConfig;
            let modulesConfigData: z.infer<typeof modulesConfigSchema> | null = null;
            if (rawModulesConfig !== undefined && rawModulesConfig !== null) {
                if (!extended) {
                    await reply.code(422).send({
                        error: { code: 'VALIDATION', message: 'modulesConfig requires extended mode', fields: [{ path: 'modulesConfig', message: 'extended-mode only' }] },
                    });
                    return reply;
                }
                const modulesParsed = modulesConfigSchema.safeParse(rawModulesConfig);
                if (!modulesParsed.success) {
                    await reply.code(422).send({
                        error: { code: 'VALIDATION', message: 'invalid modulesConfig', fields: zodIssuesToFields(modulesParsed.error.issues) },
                    });
                    return reply;
                }
                modulesConfigData = modulesParsed.data;
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
                            modulesConfig: modulesConfigData,
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
                // road-to-configurable-modules § Phase E — invoke the
                // persistence helper after the 2PC commit so a failed
                // settings write never leaves a half-applied
                // `.agent-project-settings.yml` behind. Best-effort: a
                // bridge failure surfaces in `modulesApply.error` but
                // does NOT roll back the settings commit (the team file
                // is a separate artefact and the user can re-apply).
                // Same root rule as `/auto-detect`: legacyReadRoot ??
                // process.cwd() — that's the consumer repo, not the
                // server's writeRoot.
                let modulesAppliedTo: string | null = null;
                let modulesApplyError: { code: string; message: string; exitCode?: number } | null = null;
                if (modulesConfigData !== null) {
                    const projectRoot = legacyReadRoot ?? process.cwd();
                    const scriptPath = join(opts.packageRoot, 'scripts', 'apply_modules_config.py');
                    const tmpPath = join(tmpdir(), `agent-config-modules-${randomBytes(8).toString('hex')}.json`);
                    try {
                        await fs.writeFile(tmpPath, JSON.stringify(modulesConfigData), { mode: 0o600 });
                        const result = await spawnInstaller(scriptPath, ['--project', projectRoot, '--input-file', tmpPath]);
                        if (result.exitCode !== 0) {
                            modulesApplyError = { code: 'MODULES_APPLY_FAILED', message: result.stderr || 'modules apply bridge exited non-zero', exitCode: result.exitCode };
                        } else {
                            modulesAppliedTo = result.stdout.trim() || null;
                        }
                    } catch (err) {
                        const message = err instanceof Error ? err.message : 'modules apply bridge failed';
                        modulesApplyError = { code: 'MODULES_APPLY_FAILED', message };
                    } finally {
                        await fs.unlink(tmpPath).catch(() => undefined);
                    }
                }
                return {
                    writtenPaths: payloads.map((p) => p.target),
                    txnId,
                    scope,
                    ...(migratedFrom.length > 0 ? { migratedFrom } : {}),
                    ...(modulesAppliedTo !== null ? { modulesAppliedTo } : {}),
                    ...(modulesApplyError !== null ? { modulesApplyError } : {}),
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
