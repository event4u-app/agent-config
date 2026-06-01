/**
 * road-to-global-only-install Phase 1.8 — Playwright E2E spec for the
 * unified 9-step Setup-Wizard. Boots the Fastify app from `src/server`
 * in-process against a temp writeRoot, walks the full state machine in
 * dry-run, asserts the apply preview payload matches the locked schema
 * (`internal/schemas/wizard-apply-payload.schema.json` / `WizardPayloadV2`), and
 * verifies that zero files land under the temp writeRoot.
 *
 * The spec uses Playwright's `request` fixture only — no browser
 * binaries are required so CI can run it from a stock `npm ci`.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { request } from '@playwright/test';

import { createApp } from '../../src/server/app.js';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');

let tmpRoot: string;
let baseURL: string;
let api: APIRequestContext;
let shutdown: () => Promise<void>;

test.beforeAll(async () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'wizard-9steps-'));
    const port = await findFreePort();
    const app = await createApp({
        writeRoot: tmpRoot,
        packageRoot: REPO_ROOT,
        projectRoot: tmpRoot,
        dryRun: true,
        skipReplay: true,
        extendedSteps: true,
        token: 'test-token',
        expectedPort: port,
        uiDistDir: join(REPO_ROOT, 'dist', 'ui'),
    });
    await app.listen({ host: '127.0.0.1', port });
    baseURL = `http://127.0.0.1:${port}`;
    api = await request.newContext({
        baseURL,
        extraHTTPHeaders: {
            authorization: 'Bearer test-token',
            host: `127.0.0.1:${port}`,
        },
    });
    shutdown = async () => {
        await api.dispose();
        await app.close();
    };
});

test.afterAll(async () => {
    if (shutdown) await shutdown();
    if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
});

function snapshotDir(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string, prefix: string): void => {
        let entries: string[] = [];
        try {
            entries = readdirSync(dir);
        } catch {
            return;
        }
        for (const e of entries) {
            const full = join(dir, e);
            const rel = prefix ? `${prefix}/${e}` : e;
            try {
                if (statSync(full).isDirectory()) walk(full, rel);
                else out.push(rel);
            } catch {
                /* race-safe */
            }
        }
    };
    walk(root, '');
    return out.sort();
}

test('walks 9-step dry-run, payload matches WizardPayloadV2, zero writes under writeRoot', async () => {
    const before = snapshotDir(tmpRoot);

    // Steps 1-8: walk the partial state forward via /state, matching the
    // canonical wizardStateSchema (step + partial). Each POST is dry-run
    // so the writes land in the per-server memState Map, not on disk.
    for (let step = 1; step <= 8; step += 1) {
        const stateResp = await api.post('/api/v1/wizard/state', {
            data: {
                step,
                partial: {
                    tools: ['claude-code', 'cursor'],
                    packs: ['core'],
                    settings: { rule_loading_tier: 'balanced' },
                    scope_to_project_only: false,
                },
            },
        });
        expect(stateResp.status(), `step ${step}`).toBe(200);
    }

    // Step 9 — Phase 1.5: drive the WizardPayloadV2 envelope through the
    // /api/v1/wizard/apply bridge and assert the discriminator routes
    // to the wizard-v2 branch with a dry-run preview echoed back.
    const applyResp = await api.post('/api/v1/wizard/apply', {
        data: {
            schema_version: 'wizard-v2',
            tools: ['claude-code', 'cursor'],
            packs: ['core'],
            settings: { rule_loading_tier: 'balanced' },
            scope_to_project_only: false,
            dry_run: true,
        },
    });
    expect(applyResp.status()).toBe(200);
    const applyBody = await applyResp.json();
    expect(applyBody).toMatchObject({ ok: true, dryRun: true, schemaVersion: 'wizard-v2' });
    expect(typeof applyBody.preview).toBe('string');
    expect(applyBody.preview).toContain('schema:      wizard-v2');

    const after = snapshotDir(tmpRoot);
    expect(after).toEqual(before);
});
