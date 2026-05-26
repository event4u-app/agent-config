/**
 * Tests for src/server/routes/install.ts — Phase B1 contract.
 *
 * Roadmap road-to-unified-setup Phase B1 acceptance:
 *   - `GET /api/v1/install/detect` returns scope + project shape + tool
 *     presence at the fixture project root.
 *   - `POST /api/v1/install/plan` returns a wire-formatted `InstallPlan`
 *     where `knownPaths` / `knownPointers` are JSON arrays (not Sets).
 *   - `POST /api/v1/install/apply` streams SSE frames matching the locked
 *     schema (`progress` / `done`) and writes the files end-to-end.
 *   - Abort-on-disconnect (Finding #24): when the client closes the SSE
 *     channel mid-apply, an `abort` marker lands in the txlog.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:net';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

import { createApp } from '../../src/server/app.js';
import { readRecentEntries } from '../../src/install/txlog.js';

const TOKEN = 'i'.repeat(64);

async function findFreePort(): Promise<number> {
    return await new Promise<number>((res, rej) => {
        const srv = createServer();
        srv.unref();
        srv.on('error', rej);
        srv.listen(0, '127.0.0.1', () => {
            const addr = srv.address();
            if (addr === null || typeof addr === 'string') {
                rej(new Error('no address'));
                return;
            }
            const port = addr.port;
            srv.close(() => res(port));
        });
    });
}

interface BootResult {
    app: FastifyInstance;
    baseUrl: string;
    host: string;
    port: number;
    projectRoot: string;
    srcDir: string;
    destDir: string;
    logPath: string;
    cleanup: () => Promise<void>;
}

async function bootApp(opts: { seedFiles?: number } = {}): Promise<BootResult> {
    const tmp = mkdtempSync(join(tmpdir(), 'agent-config-install-'));
    const projectRoot = join(tmp, 'project');
    const writeRoot = join(tmp, 'write');
    const uiDir = join(tmp, 'ui');
    const srcDir = join(tmp, 'src');
    const destDir = join(tmp, 'dest');
    const logPath = join(tmp, 'install-log.jsonl');
    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(writeRoot, { recursive: true });
    mkdirSync(uiDir, { recursive: true });
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(destDir, { recursive: true });
    writeFileSync(join(uiDir, 'index.html'), '<!doctype html><html><body>ok</body></html>');

    // Fixture project shape signals: `package.json` + `.augment/` so
    // detect returns scope=`prompt` (manifest + AI marker) and tool
    // presence flags `augment=true`.
    writeFileSync(join(projectRoot, 'package.json'), JSON.stringify({ name: 'fixture' }));
    mkdirSync(join(projectRoot, '.augment'), { recursive: true });

    const seedCount = opts.seedFiles ?? 0;
    for (let i = 0; i < seedCount; i++) {
        writeFileSync(join(srcDir, `file-${i}.txt`), `content-${i}\n`);
    }

    const port = await findFreePort();
    const app = await createApp({
        writeRoot,
        projectRoot: writeRoot,
        uiDistDir: uiDir,
        token: TOKEN,
        expectedPort: port,
        logLevel: 'fatal',
        skipReplay: true,
        installRouteOptions: { cwd: projectRoot, logPath },
    });
    await app.listen({ host: '127.0.0.1', port });

    const cleanup = async (): Promise<void> => {
        await app.close();
        rmSync(tmp, { recursive: true, force: true });
    };

    return {
        app,
        baseUrl: `http://127.0.0.1:${port}`,
        host: `127.0.0.1:${port}`,
        port,
        projectRoot,
        srcDir,
        destDir,
        logPath,
        cleanup,
    };
}

function authHeaders(host: string): Record<string, string> {
    return { host, authorization: `Bearer ${TOKEN}` };
}


interface SseFrame {
    readonly type: string;
    readonly [key: string]: unknown;
}

/**
 * Consume an SSE response body and return the parsed frames.
 *
 * Splits on the SSE `\n\n` event terminator, strips the `data: ` prefix,
 * parses JSON. Used by the apply tests to assert against the locked
 * frame schema (Finding #20).
 */
async function readSseFrames(res: Response): Promise<SseFrame[]> {
    const text = await res.text();
    const frames: SseFrame[] = [];
    for (const block of text.split('\n\n')) {
        const trimmed = block.trim();
        if (trimmed.length === 0) continue;
        const payload = trimmed.replace(/^data:\s*/, '');
        try {
            frames.push(JSON.parse(payload) as SseFrame);
        } catch {
            /* tolerate malformed tails — keep happy-path assertions clean */
        }
    }
    return frames;
}

describe('installRoute', () => {
    let boot: BootResult;

    afterEach(async () => {
        if (boot) await boot.cleanup();
    });

    describe('GET /api/v1/install/detect', () => {
        beforeEach(async () => {
            boot = await bootApp();
        });

        it('returns scope + project shape + tool presence for the fixture cwd', async () => {
            const res = await fetch(`${boot.baseUrl}/api/v1/install/detect`, {
                headers: authHeaders(boot.host),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as {
                cwd: string;
                scope: { scope: string; reason: string };
                projectShape: { kind: string; manifest: string | null };
                toolPresence: Record<string, boolean>;
                packageRoot: string | null;
            };
            expect(body.cwd).toBe(boot.projectRoot);
            // package.json + .augment/ → prompt (ambiguous; resolved by UI).
            expect(body.scope.scope).toBe('prompt');
            expect(body.projectShape.kind).toBe('npm');
            expect(body.projectShape.manifest).toBe('package.json');
            expect(body.toolPresence.augment).toBe(true);
            expect(body.toolPresence.claude).toBe(false);
        });

        it('rejects unauthenticated requests with HTTP 401', async () => {
            const res = await fetch(`${boot.baseUrl}/api/v1/install/detect`, {
                headers: { host: boot.host },
            });
            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/v1/install/plan', () => {
        beforeEach(async () => {
            boot = await bootApp({ seedFiles: 2 });
        });

        it('returns a wire-formatted plan with array policy fields', async () => {
            const res = await fetch(`${boot.baseUrl}/api/v1/install/plan`, {
                method: 'POST',
                headers: { ...authHeaders(boot.host), 'content-type': 'application/json' },
                body: JSON.stringify({
                    target: 'global',
                    root: boot.destDir,
                    sources: [
                        { toolId: 'augment', srcDir: boot.srcDir, destDir: boot.destDir, kind: 'deployed' },
                    ],
                    policy: {
                        force: false,
                        interactive: false,
                        knownPaths: [],
                        knownPointers: [],
                        defaultStrategy: 'skip',
                    },
                }),
            });
            expect(res.status).toBe(200);
            const plan = (await res.json()) as {
                version: number;
                target: string;
                filesByTool: Record<string, { path: string; kind: string; sha256: string | null }[]>;
                policy: { knownPaths: unknown; knownPointers: unknown; defaultStrategy: string };
            };
            expect(plan.version).toBe(2);
            expect(plan.target).toBe('global');
            // Wire shape: policy collections are arrays, not empty objects
            // (the Set→array conversion is the contract under test).
            expect(Array.isArray(plan.policy.knownPaths)).toBe(true);
            expect(Array.isArray(plan.policy.knownPointers)).toBe(true);
            expect(plan.policy.defaultStrategy).toBe('skip');
            expect(plan.filesByTool.augment).toHaveLength(2);
            expect(plan.filesByTool.augment![0]!.sha256).toMatch(/^[a-f0-9]{64}$/);
        });

        it('returns HTTP 400 on a malformed plan request', async () => {
            const res = await fetch(`${boot.baseUrl}/api/v1/install/plan`, {
                method: 'POST',
                headers: { ...authHeaders(boot.host), 'content-type': 'application/json' },
                body: JSON.stringify({ target: 'bogus' }),
            });
            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/v1/install/plan (wizard branch — Phase B2)', () => {
        beforeEach(async () => {
            boot = await bootApp();
            // Seed a minimal `.agent-src/rules/` tree inside the project root
            // so the wizard branch's `packageRoot` override has content the
            // expander can resolve. Two files → assert filesByTool count.
            mkdirSync(join(boot.projectRoot, '.agent-src', 'rules'), { recursive: true });
            writeFileSync(join(boot.projectRoot, '.agent-src', 'rules', 'one.md'), 'rule-one\n');
            writeFileSync(join(boot.projectRoot, '.agent-src', 'rules', 'two.md'), 'rule-two\n');
        });

        it('expands toolIds + home override into a plan with per-tool entries', async () => {
            const fakeHome = mkdtempSync(join(tmpdir(), 'agent-config-home-'));
            // Override the route's home so `~/.codeium/windsurf/rules/` lands
            // under a tmp tree we can inspect.
            await boot.app.close();
            const port = await findFreePort();
            const app = await createApp({
                writeRoot: boot.projectRoot,
                projectRoot: boot.projectRoot,
                uiDistDir: join(boot.projectRoot, '..', 'ui'),
                token: TOKEN,
                expectedPort: port,
                logLevel: 'fatal',
                skipReplay: true,
                installRouteOptions: {
                    cwd: boot.projectRoot,
                    logPath: boot.logPath,
                    packageRoot: boot.projectRoot,
                    home: fakeHome,
                },
            });
            await app.listen({ host: '127.0.0.1', port });
            const host = `127.0.0.1:${port}`;
            try {
                const res = await fetch(`http://${host}/api/v1/install/plan`, {
                    method: 'POST',
                    headers: { ...authHeaders(host), 'content-type': 'application/json' },
                    body: JSON.stringify({
                        target: 'global',
                        root: fakeHome,
                        toolIds: ['windsurf'],
                        policy: {
                            force: false,
                            interactive: false,
                            knownPaths: [],
                            knownPointers: [],
                            defaultStrategy: 'surface-to-ui',
                        },
                    }),
                });
                expect(res.status).toBe(200);
                const plan = (await res.json()) as PlanWire;
                expect(plan.version).toBe(2);
                expect(plan.filesByTool.windsurf).toHaveLength(2);
                // dest path lands under fakeHome → `.codeium/windsurf/rules/`
                expect(plan.filesByTool.windsurf![0]!.path).toContain('windsurf');
            } finally {
                await app.close();
                rmSync(fakeHome, { recursive: true, force: true });
            }
        });

        it('returns an empty plan for unknown tool IDs', async () => {
            const fakeHome = mkdtempSync(join(tmpdir(), 'agent-config-home-'));
            await boot.app.close();
            const port = await findFreePort();
            const app = await createApp({
                writeRoot: boot.projectRoot,
                projectRoot: boot.projectRoot,
                uiDistDir: join(boot.projectRoot, '..', 'ui'),
                token: TOKEN,
                expectedPort: port,
                logLevel: 'fatal',
                skipReplay: true,
                installRouteOptions: {
                    cwd: boot.projectRoot,
                    logPath: boot.logPath,
                    packageRoot: boot.projectRoot,
                    home: fakeHome,
                },
            });
            await app.listen({ host: '127.0.0.1', port });
            const host = `127.0.0.1:${port}`;
            try {
                const res = await fetch(`http://${host}/api/v1/install/plan`, {
                    method: 'POST',
                    headers: { ...authHeaders(host), 'content-type': 'application/json' },
                    body: JSON.stringify({
                        target: 'global',
                        root: fakeHome,
                        toolIds: ['totally-unknown-tool'],
                        policy: {
                            force: false,
                            interactive: false,
                            knownPaths: [],
                            knownPointers: [],
                            defaultStrategy: 'surface-to-ui',
                        },
                    }),
                });
                expect(res.status).toBe(200);
                const plan = (await res.json()) as PlanWire;
                expect(Object.keys(plan.filesByTool)).toHaveLength(0);
            } finally {
                await app.close();
                rmSync(fakeHome, { recursive: true, force: true });
            }
        });
    });

    describe('POST /api/v1/install/apply', () => {
        beforeEach(async () => {
            boot = await bootApp({ seedFiles: 2 });
        });

        it('streams progress + done SSE frames and writes files', async () => {
            const plan = await buildPlanForFixture(boot);
            const res = await fetch(`${boot.baseUrl}/api/v1/install/apply`, {
                method: 'POST',
                headers: { ...authHeaders(boot.host), 'content-type': 'application/json' },
                body: JSON.stringify({
                    plan,
                    sourceByTarget: planSourceByTarget(plan, boot.srcDir),
                }),
            });
            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
            const frames = await readSseFrames(res);
            const progress = frames.filter((f) => f.type === 'progress');
            const done = frames.filter((f) => f.type === 'done');
            expect(progress.length).toBeGreaterThanOrEqual(1);
            expect(done).toHaveLength(1);
            const summary = (done[0] as {
                summary: { written: number; skipped: number; conflicts: number; errors: number };
            }).summary;
            expect(summary).toMatchObject({ written: 2, errors: 0, skipped: 0, conflicts: 0 });
        });
    });

    describe('apply abort-on-disconnect (Finding #24)', () => {
        beforeEach(async () => {
            // Enough entries to give the abort signal time to land between
            // `processEntry` calls — the streaming loop yields via
            // setImmediate so any aborted=true read after the first write
            // bails out and appends a single `abort` marker.
            boot = await bootApp({ seedFiles: 20 });
        });

        it('appends an `abort` marker to the txlog when the client disconnects', async () => {
            const plan = await buildPlanForFixture(boot);
            const controller = new AbortController();
            const fetchPromise = fetch(`${boot.baseUrl}/api/v1/install/apply`, {
                method: 'POST',
                signal: controller.signal,
                headers: { ...authHeaders(boot.host), 'content-type': 'application/json' },
                body: JSON.stringify({
                    plan,
                    sourceByTarget: planSourceByTarget(plan, boot.srcDir),
                }),
            });
            // Give the server one tick to start streaming, then disconnect.
            await new Promise((r) => setTimeout(r, 10));
            controller.abort();
            await fetchPromise.catch(() => {
                /* expected: AbortError on the client side */
            });
            // Allow the server-side `req.raw.on('close')` handler to fire
            // and the streaming loop to write the abort marker.
            await new Promise((r) => setTimeout(r, 100));
            const entries = readRecentEntries(boot.logPath);
            const aborts = entries.filter((e) => e.kind === 'abort');
            expect(aborts.length).toBeGreaterThanOrEqual(1);
            expect(aborts[0]!.note).toBe('client disconnect');
        });
    });
});

interface PlanWire {
    version: 2;
    target: string;
    root: string;
    filesByTool: Record<string, { path: string; kind: string; sha256: string | null }[]>;
    mergedKeysByTool: Record<string, { file: string; pointer: string }[]>;
    policy: {
        force: boolean;
        interactive: boolean;
        knownPaths: string[];
        knownPointers: string[];
        defaultStrategy: 'skip' | 'overwrite' | 'surface-to-ui';
    };
}

async function buildPlanForFixture(boot: BootResult): Promise<PlanWire> {
    const res = await fetch(`${boot.baseUrl}/api/v1/install/plan`, {
        method: 'POST',
        headers: { ...authHeaders(boot.host), 'content-type': 'application/json' },
        body: JSON.stringify({
            target: 'global',
            root: boot.destDir,
            sources: [
                { toolId: 'augment', srcDir: boot.srcDir, destDir: boot.destDir, kind: 'deployed' },
            ],
            policy: {
                force: false,
                interactive: false,
                knownPaths: [],
                knownPointers: [],
                defaultStrategy: 'skip',
            },
        }),
    });
    return (await res.json()) as PlanWire;
}

/**
 * Build the `target → source` map the apply route expects. The plan
 * records target paths under `destDir`; the source files live under
 * `srcDir` with the same relative name.
 */
function planSourceByTarget(plan: PlanWire, srcDir: string): Record<string, string> {
    const map: Record<string, string> = {};
    for (const entries of Object.values(plan.filesByTool)) {
        for (const e of entries) {
            const name = e.path.split('/').pop()!;
            map[e.path] = join(srcDir, name);
        }
    }
    return map;
}

