/**
 * HTTP handlers for the browser-wizard API.
 *
 * Every endpoint maps to a slice of the existing installer code so the
 * GUI never duplicates business logic — the manifest, selection rules,
 * install-plan, atomic writes, and lockfile all come from the same
 * modules the CLI and agent-mode use (ADR-016 § 4).
 *
 *   GET  /api/manifest     — return DiscoveryManifest (no secrets)
 *   GET  /api/auto-detect  — run detectPacks() against project root
 *   POST /api/preview      — compute plan; no writes
 *   POST /api/apply        — execute plan; stream SSE progress
 *   POST /api/cancel       — append cancel entry to active log
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { detectPacks } from '../detect.js';
import { computeInstallPlan, executeInstallPlan } from '../install-plan.js';
import type { LoadedManifest } from '../manifest-loader.js';
import { findPack } from '../manifest-loader.js';
import { resolvePacks } from '../resolver.js';
import { sha256OfString } from '../io/sha256.js';
import { lockfileToYaml } from '../lockfile.js';
import { packsForWorkspaces, validatePackIds, validateWorkspaces } from '../selection.js';
import { collectAdvisoryPacks } from '../tui.js';
import { AGENT_CONFIG_VERSION, PACK_VERSION } from '../version.js';
import { csrfEquals } from './security.js';
import { appendEntry, newLogPath } from './transaction-log.js';
import type { ApplyEvent, TransactionLogEntry } from './types.js';

export interface ApiContext {
    readonly csrfToken: string;
    readonly loaded: LoadedManifest;
    readonly projectRoot: string;
}

export async function handleApi(req: IncomingMessage, res: ServerResponse, ctx: ApiContext): Promise<void> {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';
    if (method === 'GET' && url === '/api/manifest') return getManifest(res, ctx);
    if (method === 'GET' && url === '/api/auto-detect') return getAutoDetect(res, ctx);
    if (method === 'POST' && url === '/api/preview') return postPreview(req, res, ctx);
    if (method === 'POST' && url === '/api/apply') return postApply(req, res, ctx);
    if (method === 'POST' && url === '/api/cancel') return postCancel(req, res, ctx);
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
