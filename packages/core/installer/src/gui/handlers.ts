/**
 * HTTP handlers for the browser-wizard API.
 *
 * Every endpoint maps to a slice of the existing installer code so the
 * GUI never duplicates business logic — the manifest, selection rules,
 * install-plan, atomic writes, and lockfile all come from the same
 * modules the CLI and agent-mode use (ADR-016 § 4).
 *
 *   GET  /api/manifest           — return DiscoveryManifest (no secrets)
 *   GET  /api/auto-detect        — run detectPacks() against project root
 *   POST /api/preview            — compute plan; no writes
 *   POST /api/apply              — execute plan; stream SSE progress
 *   POST /api/cancel             — append cancel entry to active log
 *   POST /api/open-lockfile      — launch the OS handler for the lockfile
 *   GET  /api/recovery           — report any open transaction log from prior boot
 *   POST /api/recovery/rollback  — delete planned paths + close log
 *   POST /api/recovery/discard   — close log without removing files
 */

import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve as resolvePath } from 'node:path';
import { detectPacks } from '../detect.js';
import { computeInstallPlan, executeInstallPlan } from '../install-plan.js';
import { LOCKFILE_NAME, lockfileToYaml } from '../lockfile.js';
import type { LoadedManifest } from '../manifest-loader.js';
import { findPack } from '../manifest-loader.js';
import { resolvePacks } from '../resolver.js';
import { sha256OfString } from '../io/sha256.js';
import { packsForWorkspaces, validatePackIds, validateWorkspaces } from '../selection.js';
import { buildTelemetryConfig } from '../telemetry/bootstrap.js';
import {
    emit as emitTelemetry,
    errorClassOf,
    initSession as initTelemetrySession,
} from '../telemetry/index.js';
import { packCategoriesOf } from '../telemetry/pack-category.js';
import { collectAdvisoryPacks } from '../tui.js';
import { AGENT_CONFIG_VERSION, PACK_VERSION } from '../version.js';
import { csrfEquals } from './security.js';
import { appendEntry, discardLog, newLogPath, rollback } from './transaction-log.js';
import { getTaskHistory, resolveTask, runTask, TASK_CATALOG } from './task-exec.js';
import { defaultExplainRunner, type ExplainRunner } from './explain-exec.js';
import type { ApplyEvent, TransactionLogEntry } from './types.js';

/**
 * Open transaction log carried over from a prior boot. `server.ts`
 * detects it via `findOpenLog` and passes it in once; the recovery
 * endpoints clear the slot via the caller-provided `clearRecovery`
 * hook after a successful rollback or discard.
 */
export interface RecoveryState {
    readonly logPath: string;
    readonly plannedPaths: readonly string[];
}

export interface ApiContext {
    readonly csrfToken: string;
    readonly loaded: LoadedManifest;
    readonly projectRoot: string;
    readonly recovery?: RecoveryState | undefined;
    readonly clearRecovery?: () => void;
    /**
     * Optional explain-trace runner. Defaults to `defaultExplainRunner`
     * (spawns the CLI). Tests inject fakes to avoid needing a real
     * `.work-state.json` and Python environment in the tmpdir.
     */
    readonly explainRunner?: ExplainRunner;
}

export async function handleApi(req: IncomingMessage, res: ServerResponse, ctx: ApiContext): Promise<void> {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';
    if (method === 'GET' && url === '/api/manifest') return getManifest(res, ctx);
    if (method === 'GET' && url === '/api/auto-detect') return getAutoDetect(res, ctx);
    if (method === 'POST' && url === '/api/preview') return postPreview(req, res, ctx);
    if (method === 'POST' && url === '/api/apply') return postApply(req, res, ctx);
    if (method === 'POST' && url === '/api/cancel') return postCancel(req, res, ctx);
    if (method === 'POST' && url === '/api/open-lockfile') return postOpenLockfile(req, res, ctx);
    if (method === 'GET' && url === '/api/recovery') return getRecovery(res, ctx);
    if (method === 'POST' && url === '/api/recovery/rollback') return postRecoveryRollback(req, res, ctx);
    if (method === 'POST' && url === '/api/recovery/discard') return postRecoveryDiscard(req, res, ctx);
    if (method === 'GET' && url === '/api/v1/task/catalog') return getTaskCatalog(res);
    if (method === 'POST' && url === '/api/v1/task/run') return postTaskRun(req, res, ctx);
    if (method === 'GET' && url === '/api/v1/task/history') return getTaskHistoryEndpoint(res);
    if (method === 'GET' && url === '/api/v1/council/recent') return getCouncilRecent(res, ctx);
    if (method === 'GET' && (url ?? '').startsWith('/api/v1/council/session/')) return getCouncilSession(req, res, ctx);
    if (method === 'GET' && url === '/api/v1/memory/list') return getMemoryList(res, ctx);
    if (method === 'GET' && (url ?? '').startsWith('/api/v1/memory/file')) return getMemoryFile(req, res, ctx);
    if (method === 'GET' && url === '/api/v1/explain/last') return getExplainLast(res, ctx);
    if (method === 'GET' && url === '/api/v1/health') return getHealth(req, res, ctx);
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'not_found' }));
}

function getManifest(res: ServerResponse, ctx: ApiContext): void {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ manifest: ctx.loaded.manifest, sha256: ctx.loaded.sha256 }));
}

function getAutoDetect(res: ServerResponse, ctx: ApiContext): void {
    const signals = detectPacks({ projectRoot: ctx.projectRoot });
    const known = signals.filter((s) => findPack(ctx.loaded.manifest, s.packId) !== undefined);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ signals: known }));
}

interface SelectionPayload {
    readonly workspaces: readonly string[];
    readonly packs: readonly string[];
    readonly acceptAdvisory: readonly string[];
    readonly csrf: string;
    readonly dryRun: boolean;
    /**
     * Per-install telemetry opt-in choice from the browser wizard. Never
     * persisted; only honoured when paired with the build-time worker
     * URL + HMAC secret env (see `telemetry/bootstrap.ts`). Default
     * `false` keeps the SDK inert on every legacy payload.
     */
    readonly telemetryOptIn: boolean;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function parseSelection(raw: unknown): SelectionPayload | { error: string } {
    if (raw === null || typeof raw !== 'object') return { error: 'body_not_object' };
    const r = raw as Record<string, unknown>;
    const workspaces = Array.isArray(r.workspaces) ? r.workspaces.filter((x): x is string => typeof x === 'string') : [];
    const packs = Array.isArray(r.packs) ? r.packs.filter((x): x is string => typeof x === 'string') : [];
    const acceptAdvisory = Array.isArray(r.acceptAdvisory) ? r.acceptAdvisory.filter((x): x is string => typeof x === 'string') : [];
    const csrf = typeof r.csrf === 'string' ? r.csrf : '';
    const dryRun = r.dry_run === true || r.dryRun === true;
    const telemetryOptIn = r.telemetry_opt_in === true || r.telemetryOptIn === true;
    return { workspaces, packs, acceptAdvisory, csrf, dryRun, telemetryOptIn };
}

async function postPreview(req: IncomingMessage, res: ServerResponse, ctx: ApiContext): Promise<void> {
    const sel = parseSelection(await readJsonBody(req).catch(() => null));
    if ('error' in sel) return endJson(res, 400, { error: sel.error });
    if (!csrfEquals(sel.csrf, ctx.csrfToken)) return endJson(res, 403, { error: 'csrf_invalid' });
    try {
        const wsIds = validateWorkspaces(ctx.loaded.manifest, sel.workspaces);
        const packIds = validatePackIds(ctx.loaded.manifest, sel.packs);
        const resolved = resolvePacks(ctx.loaded.manifest, packIds);
        if (resolved.missing.length > 0) return endJson(res, 400, { error: 'unknown_pack', missing: resolved.missing });
        const advisory = collectAdvisoryPacks(ctx.loaded.manifest.packs, resolved.packs.map((p) => p.id));
        const plan = computeInstallPlan({
            manifest: ctx.loaded.manifest,
            workspaces: wsIds,
            packs: resolved.packs,
            packageRoot: packageRootOf(ctx.loaded.path),
            projectRoot: ctx.projectRoot,
        });
        return endJson(res, 200, {
            workspaces: wsIds,
            packs: resolved.packs,
            autoAdded: resolved.packs.filter((p) => p.autoSelected).map((p) => p.id),
            advisory: advisory.map((p) => p.id),
            candidates: packsForWorkspaces(ctx.loaded.manifest, wsIds).map((p) => p.id),
            files: plan.files.length,
        });
    } catch (err) {
        return endJson(res, 400, { error: 'preview_failed', message: (err as Error).message });
    }
}

function endJson(res: ServerResponse, code: number, body: unknown): void {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
}

function packageRootOf(manifestPath: string): string {
    // dist/discovery/discovery-manifest.json → package root is 3 dirs up.
    const p = manifestPath.split('/');
    return p.slice(0, Math.max(0, p.length - 3)).join('/');
}

async function postApply(req: IncomingMessage, res: ServerResponse, ctx: ApiContext): Promise<void> {
    const sel = parseSelection(await readJsonBody(req).catch(() => null));
    if ('error' in sel) return endJson(res, 400, { error: sel.error });
    if (!csrfEquals(sel.csrf, ctx.csrfToken)) return endJson(res, 403, { error: 'csrf_invalid' });

    // Install-funnel telemetry (Phase 4). Inert by default: stays silent
    // unless the build-time worker URL + per-channel HMAC env are set
    // AND the kill-switch resolves enabled AND `telemetry_opt_in` is
    // true on the payload. Per-install, never persisted.
    const telemetryConfig = buildTelemetryConfig({
        entryPath: 'gui',
        optedIn: sel.telemetryOptIn,
    });
    await initTelemetrySession(telemetryConfig);
    void emitTelemetry({ stage: 'started', wizardUsed: true });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Connection', 'keep-alive');

    const emit = (event: ApplyEvent): void => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const logPath = newLogPath(ctx.projectRoot);
    const now = (): string => new Date().toISOString();
    const log = (entry: TransactionLogEntry): void => appendEntry(logPath, entry);

    try {
        const wsIds = validateWorkspaces(ctx.loaded.manifest, sel.workspaces);
        const packIds = validatePackIds(ctx.loaded.manifest, sel.packs);
        const resolved = resolvePacks(ctx.loaded.manifest, packIds);
        if (resolved.missing.length > 0) {
            emit({ type: 'error', message: `unknown_pack: ${resolved.missing.join(',')}` });
            log({ kind: 'error', ts: now(), message: `unknown_pack: ${resolved.missing.join(',')}` });
            void emitTelemetry({ stage: 'errored', errorClass: 'config_invalid', wizardUsed: true });
            res.end();
            return;
        }
        const advisory = collectAdvisoryPacks(ctx.loaded.manifest.packs, resolved.packs.map((p) => p.id));
        const acceptedSet = new Set(sel.acceptAdvisory);
        const unacked = advisory.filter((p) => !acceptedSet.has(p.id));
        if (unacked.length > 0) {
            const msg = `advisory_unacked: ${unacked.map((p) => p.id).join(',')}`;
            emit({ type: 'error', message: msg });
            log({ kind: 'error', ts: now(), message: msg });
            void emitTelemetry({ stage: 'errored', errorClass: 'config_invalid', wizardUsed: true });
            res.end();
            return;
        }
        const packCategories = packCategoriesOf(resolved.packs.map((p) => p.id));
        void emitTelemetry({ stage: 'packs_selected', packCategories, wizardUsed: true });
        log({ kind: 'start', ts: now(), workspaces: wsIds, packs: resolved.packs.map((p) => p.id) });
        const plan = computeInstallPlan({
            manifest: ctx.loaded.manifest,
            workspaces: wsIds,
            packs: resolved.packs,
            packageRoot: packageRootOf(ctx.loaded.path),
            projectRoot: ctx.projectRoot,
        });
        for (const f of plan.files) {
            log({ kind: 'plan', ts: now(), path: f.destRelative, pack: f.pack });
            emit({ type: 'plan-file', path: f.destRelative, pack: f.pack });
        }
        if (sel.dryRun) {
            // road-to-global-only-install Phase 0.2 — dry-run preview path.
            // Plan is computed and surfaced but no files are written and no
            // lockfile is materialised. The transaction log records the
            // dry-run intent so a follow-up real apply is still resumable.
            log({ kind: 'commit', ts: now(), filesWritten: 0, lockfileSha256: 'dry-run' });
            emit({ type: 'progress', written: 0, total: plan.files.length });
            emit({ type: 'done', filesWritten: 0, lockfileSha256: 'dry-run', dryRun: true });
            // Dry-run is not a terminal install — do not emit 'applied'.
            res.end();
            return;
        }
        const result = executeInstallPlan({
            plan,
            projectRoot: ctx.projectRoot,
            manifestSha256: ctx.loaded.sha256,
            agentConfigVersion: AGENT_CONFIG_VERSION,
            packVersion: PACK_VERSION,
            manifest: ctx.loaded.manifest,
        });
        const lockfileSha = sha256OfString(lockfileToYaml(result.lockfile));
        log({ kind: 'commit', ts: now(), filesWritten: result.filesWritten, lockfileSha256: lockfileSha });
        emit({ type: 'progress', written: result.filesWritten, total: plan.files.length });
        emit({ type: 'done', filesWritten: result.filesWritten, lockfileSha256: lockfileSha });
        void emitTelemetry({ stage: 'applied', packCategories, wizardUsed: true });
        res.end();
    } catch (err) {
        const message = (err as Error).message;
        emit({ type: 'error', message });
        log({ kind: 'error', ts: now(), message });
        void emitTelemetry({ stage: 'errored', errorClass: errorClassOf(err), wizardUsed: true });
        res.end();
    }
}

async function postCancel(req: IncomingMessage, res: ServerResponse, ctx: ApiContext): Promise<void> {
    const sel = parseSelection(await readJsonBody(req).catch(() => null));
    if ('error' in sel) return endJson(res, 400, { error: sel.error });
    if (!csrfEquals(sel.csrf, ctx.csrfToken)) return endJson(res, 403, { error: 'csrf_invalid' });
    // Cancel is best-effort: signal acknowledged. The SSE handler closes its
    // own stream when the request aborts; the transaction log already
    // records its own terminal entry on completion / failure.
    return endJson(res, 200, { ok: true });
}

interface OpenLockfilePayload {
    readonly csrf: string;
}

function parseCsrfOnly(raw: unknown): OpenLockfilePayload | { error: string } {
    if (raw === null || typeof raw !== 'object') return { error: 'body_not_object' };
    const r = raw as Record<string, unknown>;
    const csrf = typeof r.csrf === 'string' ? r.csrf : '';
    return { csrf };
}

async function postOpenLockfile(req: IncomingMessage, res: ServerResponse, ctx: ApiContext): Promise<void> {
    const body = parseCsrfOnly(await readJsonBody(req).catch(() => null));
    if ('error' in body) return endJson(res, 400, { error: body.error });
    if (!csrfEquals(body.csrf, ctx.csrfToken)) return endJson(res, 403, { error: 'csrf_invalid' });
    const path = join(ctx.projectRoot, LOCKFILE_NAME);
    if (!existsSync(path)) return endJson(res, 404, { error: 'lockfile_not_found', path });
    const launch = openInOs(path);
    if (launch.ok) return endJson(res, 200, { ok: true, path });
    return endJson(res, 200, { ok: false, path, reason: launch.reason });
}

/**
 * Launch the OS file-handler against an absolute path. Headless Linux
 * (no `DISPLAY` and no `WAYLAND_DISPLAY`) is reported back so the SPA
 * can fall through to showing the path for manual copy/open.
 */
function openInOs(absPath: string): { ok: true } | { ok: false; reason: string } {
    const p = process.platform;
    if (p !== 'darwin' && p !== 'win32' && !process.env['DISPLAY'] && !process.env['WAYLAND_DISPLAY']) {
        return { ok: false, reason: 'headless' };
    }
    const cmd = p === 'darwin' ? 'open' : p === 'win32' ? 'cmd' : 'xdg-open';
    const args = p === 'win32' ? ['/c', 'start', '""', absPath] : [absPath];
    try {
        const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
        child.on('error', () => undefined);
        child.unref();
        return { ok: true };
    } catch {
        return { ok: false, reason: 'spawn_failed' };
    }
}

function getRecovery(res: ServerResponse, ctx: ApiContext): void {
    if (ctx.recovery === undefined) return endJson(res, 200, { open: false });
    return endJson(res, 200, {
        open: true,
        logPath: ctx.recovery.logPath,
        plannedPaths: ctx.recovery.plannedPaths,
    });
}

async function postRecoveryRollback(req: IncomingMessage, res: ServerResponse, ctx: ApiContext): Promise<void> {
    const body = parseCsrfOnly(await readJsonBody(req).catch(() => null));
    if ('error' in body) return endJson(res, 400, { error: body.error });
    if (!csrfEquals(body.csrf, ctx.csrfToken)) return endJson(res, 403, { error: 'csrf_invalid' });
    if (ctx.recovery === undefined) return endJson(res, 404, { error: 'no_open_log' });
    try {
        const result = rollback(ctx.projectRoot, ctx.recovery.logPath);
        ctx.clearRecovery?.();
        return endJson(res, 200, { ok: true, removed: result.removed, missing: result.missing });
    } catch (err) {
        return endJson(res, 500, { error: 'rollback_failed', message: (err as Error).message });
    }
}

async function postRecoveryDiscard(req: IncomingMessage, res: ServerResponse, ctx: ApiContext): Promise<void> {
    const body = parseCsrfOnly(await readJsonBody(req).catch(() => null));
    if ('error' in body) return endJson(res, 400, { error: body.error });
    if (!csrfEquals(body.csrf, ctx.csrfToken)) return endJson(res, 403, { error: 'csrf_invalid' });
    if (ctx.recovery === undefined) return endJson(res, 404, { error: 'no_open_log' });
    try {
        discardLog(ctx.recovery.logPath);
        ctx.clearRecovery?.();
        return endJson(res, 200, { ok: true });
    } catch (err) {
        return endJson(res, 500, { error: 'discard_failed', message: (err as Error).message });
    }
}


// ──────────────────────────────────────────────────────────────────────
// Phase 1 — Task execution surface (road-to-ai-os-product-ui)
// ──────────────────────────────────────────────────────────────────────

function getTaskCatalog(res: ServerResponse): void {
    return endJson(res, 200, { tasks: TASK_CATALOG });
}

function getTaskHistoryEndpoint(res: ServerResponse): void {
    return endJson(res, 200, { runs: getTaskHistory() });
}

interface TaskRunPayload {
    readonly id: string;
    readonly csrf: string;
}

function parseTaskRun(raw: unknown): TaskRunPayload | { error: string } {
    if (raw === null || typeof raw !== 'object') return { error: 'body_not_object' };
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id : '';
    const csrf = typeof r.csrf === 'string' ? r.csrf : '';
    if (id.length === 0) return { error: 'missing_id' };
    return { id, csrf };
}

async function postTaskRun(req: IncomingMessage, res: ServerResponse, ctx: ApiContext): Promise<void> {
    const body = parseTaskRun(await readJsonBody(req).catch(() => null));
    if ('error' in body) return endJson(res, 400, { error: body.error });
    if (!csrfEquals(body.csrf, ctx.csrfToken)) return endJson(res, 403, { error: 'csrf_invalid' });
    const entry = resolveTask(body.id);
    if (entry === undefined) return endJson(res, 404, { error: 'unknown_task' });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Connection', 'keep-alive');

    try {
        for await (const event of runTask(entry, ctx.projectRoot)) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
    } catch (err) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: (err as Error).message })}\n\n`);
    }
    res.end();
}

// ──────────────────────────────────────────────────────────────────────
// Phase 4 — Council inspection (read-only)
// ──────────────────────────────────────────────────────────────────────

const COUNCIL_SESSIONS_REL = 'agents/runtime/council/sessions';
const MAX_RECENT = 50;
const SESSION_ID_RE = /^[A-Za-z0-9._:T-]+$/;

function councilSessionsDir(ctx: ApiContext): string {
    const pkgRoot = packageRootOf(ctx.loaded.path);
    return join(pkgRoot, COUNCIL_SESSIONS_REL);
}

interface CouncilSessionSummary {
    readonly id: string;
    readonly timestamp: string;
    readonly artefact?: string | undefined;
    readonly provider?: string | undefined;
    readonly model?: string | undefined;
    readonly mode?: string | undefined;
    readonly actualUsd?: number | undefined;
    readonly inputTokens?: number | undefined;
    readonly outputTokens?: number | undefined;
}

function readCouncilManifest(dir: string, id: string): CouncilSessionSummary | undefined {
    try {
        const raw = JSON.parse(readFileSync(join(dir, id, 'manifest.json'), 'utf8')) as Record<string, unknown>;
        const pick = <T>(k: string): T | undefined => (raw[k] === undefined ? undefined : raw[k] as T);
        return {
            id,
            timestamp: pick<string>('timestamp_utc') ?? id,
            artefact: pick<string>('artefact'),
            provider: pick<string>('provider'),
            model: pick<string>('model'),
            mode: pick<string>('mode'),
            actualUsd: pick<number>('actual_usd'),
            inputTokens: pick<number>('input_tokens'),
            outputTokens: pick<number>('output_tokens'),
        };
    } catch { return undefined; }
}

function getCouncilRecent(res: ServerResponse, ctx: ApiContext): void {
    const dir = councilSessionsDir(ctx);
    if (!existsSync(dir)) return endJson(res, 200, { sessions: [] });
    try {
        const ids = readdirSync(dir).filter((id) => SESSION_ID_RE.test(id) && statSync(join(dir, id)).isDirectory());
        ids.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
        const sessions = ids.slice(0, MAX_RECENT).map((id) => readCouncilManifest(dir, id)).filter((s): s is CouncilSessionSummary => s !== undefined);
        return endJson(res, 200, { sessions });
    } catch (err) {
        return endJson(res, 500, { error: 'council_listing_failed', message: (err as Error).message });
    }
}

function getCouncilSession(req: IncomingMessage, res: ServerResponse, ctx: ApiContext): void {
    const url = req.url ?? '';
    const id = url.slice('/api/v1/council/session/'.length).split('?')[0] ?? '';
    if (!SESSION_ID_RE.test(id)) return endJson(res, 400, { error: 'invalid_session_id' });
    const dir = councilSessionsDir(ctx);
    const sessionDir = join(dir, id);
    if (!existsSync(sessionDir)) return endJson(res, 404, { error: 'session_not_found' });
    const manifest = readCouncilManifest(dir, id);
    if (manifest === undefined) return endJson(res, 404, { error: 'manifest_unreadable' });
    let response: string | undefined;
    try { response = readFileSync(join(sessionDir, 'response.md'), 'utf8'); } catch { /* optional */ }
    return endJson(res, 200, { session: manifest, response });
}

// ──────────────────────────────────────────────────────────────────────
// Phase 4 — Memory inspection (read-only)
// ──────────────────────────────────────────────────────────────────────
//
// Surfaces materialized memory artefacts the runtime writes under
// `<projectRoot>/agents/memory/<scope>/`. Read-only inspection; no
// mutation in this phase — write access lives behind a council decision
// (road-to-ai-os-product-ui Phase 4 Step 4 contract).
//
// Path-safety contract:
//   * `scope` is a closed enum (MEMORY_SCOPES). Anything else → 400.
//   * `id` matches MEMORY_ID_RE (no leading slash, no `..`, no whitespace).
//   * Final resolved absolute path MUST be a child of the scope dir.
//     Symlinks that escape are rejected via the resolved-path check.
//   * Per-scope listing capped at MEMORY_MAX_ENTRIES.
//   * File read capped at MEMORY_MAX_BYTES.

const MEMORY_SCOPES = ['contexts', 'decisions', 'evidence', 'features', 'overrides', 'reference'] as const;
type MemoryScope = (typeof MEMORY_SCOPES)[number];
const MEMORY_ID_RE = /^[A-Za-z0-9._/-]+$/;
const MEMORY_MAX_ENTRIES = 500;
const MEMORY_MAX_BYTES = 256 * 1024;

function memoryRoot(ctx: ApiContext): string {
    return join(ctx.projectRoot, 'agents', 'memory');
}

function isMemoryScope(s: string): s is MemoryScope {
    return (MEMORY_SCOPES as readonly string[]).includes(s);
}

interface MemoryEntry {
    readonly id: string;
    readonly sizeBytes: number;
    readonly modifiedAtIso: string;
}

interface MemoryScopeSummary {
    readonly name: MemoryScope;
    readonly count: number;
    readonly entries: readonly MemoryEntry[];
    readonly truncated: boolean;
}

function listScopeEntries(scopeDir: string): { entries: MemoryEntry[]; truncated: boolean } {
    if (!existsSync(scopeDir)) return { entries: [], truncated: false };
    const out: MemoryEntry[] = [];
    let truncated = false;
    const walk = (dir: string, rel: string): void => {
        if (out.length >= MEMORY_MAX_ENTRIES) { truncated = true; return; }
        let names: string[];
        try { names = readdirSync(dir); } catch { return; }
        names.sort();
        for (const name of names) {
            if (out.length >= MEMORY_MAX_ENTRIES) { truncated = true; return; }
            if (name.startsWith('.')) continue;
            const abs = join(dir, name);
            let s;
            try { s = statSync(abs); } catch { continue; }
            const relPath = rel === '' ? name : `${rel}/${name}`;
            if (s.isDirectory()) { walk(abs, relPath); continue; }
            if (!s.isFile()) continue;
            out.push({ id: relPath, sizeBytes: s.size, modifiedAtIso: s.mtime.toISOString() });
        }
    };
    walk(scopeDir, '');
    return { entries: out, truncated };
}

function getMemoryList(res: ServerResponse, ctx: ApiContext): void {
    const root = memoryRoot(ctx);
    const scopes: MemoryScopeSummary[] = MEMORY_SCOPES.map((name) => {
        const { entries, truncated } = listScopeEntries(join(root, name));
        return { name, count: entries.length, entries, truncated };
    });
    return endJson(res, 200, { root: 'agents/memory', scopes });
}

function parseMemoryQuery(url: string): { scope: string; id: string } | { error: string } {
    const q = url.split('?')[1] ?? '';
    const params = new URLSearchParams(q);
    const scope = params.get('scope') ?? '';
    const id = params.get('id') ?? '';
    if (scope === '' || id === '') return { error: 'missing_param' };
    return { scope, id };
}

function getMemoryFile(req: IncomingMessage, res: ServerResponse, ctx: ApiContext): void {
    const parsed = parseMemoryQuery(req.url ?? '');
    if ('error' in parsed) return endJson(res, 400, { error: parsed.error });
    if (!isMemoryScope(parsed.scope)) return endJson(res, 400, { error: 'invalid_scope' });
    if (!MEMORY_ID_RE.test(parsed.id) || parsed.id.includes('..') || parsed.id.startsWith('/')) {
        return endJson(res, 400, { error: 'invalid_id' });
    }
    const scopeDir = join(memoryRoot(ctx), parsed.scope);
    const candidate = resolvePath(scopeDir, parsed.id);
    const scopeResolved = resolvePath(scopeDir);
    if (!candidate.startsWith(scopeResolved + '/') && candidate !== scopeResolved) {
        return endJson(res, 400, { error: 'path_escape' });
    }
    let stats;
    try { stats = statSync(candidate); } catch { return endJson(res, 404, { error: 'not_found' }); }
    if (!stats.isFile()) return endJson(res, 404, { error: 'not_found' });
    if (stats.size > MEMORY_MAX_BYTES) {
        return endJson(res, 413, { error: 'file_too_large', sizeBytes: stats.size, maxBytes: MEMORY_MAX_BYTES });
    }
    let content: string;
    try { content = readFileSync(candidate, 'utf8'); }
    catch (err) { return endJson(res, 500, { error: 'read_failed', message: (err as Error).message }); }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('X-Memory-Scope', parsed.scope);
    res.setHeader('X-Memory-Modified-At', stats.mtime.toISOString());
    res.end(content);
}

// ──────────────────────────────────────────────────────────────────────
// Phase 2 — Explain-trace surface (road-to-ai-os-product-ui)
// ──────────────────────────────────────────────────────────────────────

async function getExplainLast(res: ServerResponse, ctx: ApiContext): Promise<void> {
    const runner = ctx.explainRunner ?? defaultExplainRunner;
    const pkgRoot = packageRootOf(ctx.loaded.path);
    try {
        const result = await runner(ctx.projectRoot, pkgRoot);
        if (result.kind === 'ok') return endJson(res, 200, { trace: result.trace });
        if (result.kind === 'not_found') return endJson(res, 404, { error: 'no_trace', message: result.stderr.trim() });
        return endJson(res, 500, { error: 'explain_failed', exitCode: result.exitCode, message: result.stderr.trim() });
    } catch (err) {
        return endJson(res, 500, { error: 'explain_failed', message: (err as Error).message });
    }
}

// ──────────────────────────────────────────────────────────────────────
// Phase 1 — Health endpoint (road-to-internal-ai-os-deployment Step 4)
// ──────────────────────────────────────────────────────────────────────
//
// Threat-model note (security-sensitive-stop rule):
//
//   * Read-only. No mutations, no auth state, no PII.
//   * No CSRF token required (no state-changing side effects).
//   * Returns version, uptime, and the *names* of two config knobs
//     (STORAGE_MODE, SESSION_BACKEND) — no secrets, no DB URL, no
//     allowlist members.
//   * Rate-limited to 1 request per second per remote IP via an
//     in-memory token-bucket. Survives docker healthcheck cadence
//     (10s default) by a wide margin.
//   * The endpoint MUST stay under the host-header allowlist gate
//     enforced by server.ts handleRequest; this handler only fires
//     after that gate passes. Operators in front of a reverse proxy
//     must extend ALLOWED_HOSTS so the proxy's probe is not 403'd.

const HEALTH_RATE_LIMIT_MS = 1000;
const healthLastHit = new Map<string, number>();
const BOOT_TIME_MS = Date.now();

function getHealth(req: IncomingMessage, res: ServerResponse, ctx: ApiContext): void {
    const ip = req.socket.remoteAddress ?? '0.0.0.0';
    const now = Date.now();
    const last = healthLastHit.get(ip);
    if (last !== undefined && now - last < HEALTH_RATE_LIMIT_MS) {
        res.setHeader('Retry-After', '1');
        return endJson(res, 429, { error: 'rate_limited', retry_after_seconds: 1 });
    }
    healthLastHit.set(ip, now);
    // Bound the map to avoid unbounded growth from spoofed probes.
    if (healthLastHit.size > 1024) {
        const cutoff = now - 60_000;
        for (const [k, v] of healthLastHit) {
            if (v < cutoff) healthLastHit.delete(k);
        }
    }
    const storageMode = process.env['STORAGE_MODE'] ?? 'filesystem';
    const sessionBackend = process.env['SESSION_BACKEND'] ?? 'memory';
    return endJson(res, 200, {
        status: 'ok',
        version: AGENT_CONFIG_VERSION,
        pack_version: PACK_VERSION,
        uptime_seconds: Math.floor((now - BOOT_TIME_MS) / 1000),
        storage_mode: storageMode,
        session_backend: sessionBackend,
        manifest_sha256: ctx.loaded.sha256,
    });
}
