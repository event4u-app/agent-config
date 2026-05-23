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
import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { detectPacks } from '../detect.js';
import { computeInstallPlan, executeInstallPlan } from '../install-plan.js';
import { LOCKFILE_NAME, lockfileToYaml } from '../lockfile.js';
import type { LoadedManifest } from '../manifest-loader.js';
import { findPack } from '../manifest-loader.js';
import { resolvePacks } from '../resolver.js';
import { sha256OfString } from '../io/sha256.js';
import { packsForWorkspaces, validatePackIds, validateWorkspaces } from '../selection.js';
import { collectAdvisoryPacks } from '../tui.js';
import { AGENT_CONFIG_VERSION, PACK_VERSION } from '../version.js';
import { csrfEquals } from './security.js';
import { appendEntry, discardLog, newLogPath, rollback } from './transaction-log.js';
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
    return { workspaces, packs, acceptAdvisory, csrf };
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
            res.end();
            return;
        }
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
        res.end();
    } catch (err) {
        const message = (err as Error).message;
        emit({ type: 'error', message });
        log({ kind: 'error', ts: now(), message });
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
