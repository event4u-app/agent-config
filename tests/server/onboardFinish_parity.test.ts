/**
 * Phase 2 parity gate for `agents/roadmaps/archive/onboard-skill-wizard-convergence.md`.
 *
 * Asserts that the chat-side `agent-config onboard:finish` subcommand
 * and the browser-side `POST /api/v1/wizard/finish` route produce
 * byte-identical `.agent-settings.yml` and `.agent-user.md` when fed
 * the same fixture payload. Both paths share `commitMulti` +
 * `mergeIntoTemplate`; this gate guards against future drift.
 *
 * Test strategy: two temp project roots, each seeded with a fresh
 * copy of `config/agent-settings.template.yml`. Path A drives
 * `commitOnboardPayload` directly. Path B drives the wizard route via
 * `app.inject`. The resulting files are diffed.
 *
 * Known divergences (canonicalised before comparison):
 *   - none today. The 2PC `txnId` is per-call random but never lands
 *     in the user-facing file; only the intent marker carries it and
 *     that marker is unlinked post-commit.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/server/app.js';
import { commitOnboardPayload } from '../../src/cli/commands/onboardFinish.js';
import { settingsSchema } from '../../src/server/schemas/settings.js';

const TOKEN = 'p'.repeat(64);
const PORT = 41556;
const HOST = `127.0.0.1:${PORT}`;

const PACKAGE_ROOT = resolve(process.cwd());
const TEMPLATE_PATH = join(PACKAGE_ROOT, 'config', 'agent-settings.template.yml');

/**
 * Build a fully-validated settings payload. `settingsSchema.parse({})` fills
 * every default (the schema is defaults-all-the-way-down), then we overlay
 * the subset the chat `/onboard` flow captures. The template itself holds
 * `__PLACEHOLDER__` tokens for keys the installer fills in, so we cannot
 * use a raw `js-yaml.load(template)` as the base — those raw strings fail
 * the wizard route's strict enum validation.
 */
function fixturePayload(): { settings: Record<string, unknown>; userMd: string | null } {
    const base = settingsSchema.parse({
        cost: { budgets: {}, enforcement: 'advisory' },
        personal: {},
        project: {},
        github: {},
        augment: {},
        eloquent: {},
        chat_history: { text_limits: {} },
        pipelines: {},
        roadmap: {},
        quality: {},
        subagents: {},
        worktrees: {},
        onboarding: {},
        commands: { suggestion: {}, create_pr: {} },
        memory: {},
        hooks: { concern_budget: {} },
        decision_engine: {},
        update_check: {},
        explain: {},
    });
    return {
        settings: {
            ...base,
            cost_profile: 'balanced',
            personal: {
                ...base.personal,
                user_name: 'Matze',
                ide: 'code',
                open_edited_files: true,
                pr_comment_bot_icon: false,
                rtk_installed: true,
                user_type: 'developer',
            },
            onboarding: { ...base.onboarding, onboarded: true },
        },
        userMd: null,
    };
}

function seedProject(): string {
    const root = mkdtempSync(join(tmpdir(), 'onboard-parity-'));
    mkdirSync(join(root, 'agents', 'state'), { recursive: true });
    const template = readFileSync(TEMPLATE_PATH, 'utf8');
    writeFileSync(join(root, '.agent-settings.yml'), template, { mode: 0o600 });
    return root;
}

describe('onboard:finish ↔ wizard /api/v1/wizard/finish parity', () => {
    let app: FastifyInstance;
    let uiDir: string;
    let projectA: string;
    let projectB: string;

    beforeEach(async () => {
        projectA = seedProject();
        projectB = seedProject();
        uiDir = mkdtempSync(join(tmpdir(), 'onboard-parity-ui-'));
        writeFileSync(join(uiDir, 'index.html'), '<!doctype html>');
        app = await createApp({
            projectRoot: projectB,
            packageRoot: PACKAGE_ROOT,
            uiDistDir: uiDir,
            token: TOKEN,
            expectedPort: PORT,
            logLevel: 'fatal',
            skipReplay: true,
        });
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
        rmSync(uiDir, { recursive: true, force: true });
        rmSync(projectA, { recursive: true, force: true });
        rmSync(projectB, { recursive: true, force: true });
    });

    it('produces byte-identical .agent-settings.yml from both surfaces', async () => {
        const payload = fixturePayload();

        // Path A — chat subcommand core (in-process).
        const aResult = await commitOnboardPayload(payload, projectA);
        expect(aResult.ok, JSON.stringify(aResult)).toBe(true);

        // Path B — wizard HTTP route.
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/wizard/finish',
            headers: { host: HOST, authorization: `Bearer ${TOKEN}` },
            payload,
        });
        expect(res.statusCode, res.body).toBe(200);

        const aSettings = readFileSync(join(projectA, '.agent-settings.yml'), 'utf8');
        const bSettings = readFileSync(join(projectB, '.agent-settings.yml'), 'utf8');
        expect(aSettings).toBe(bSettings);
    });

    it('persists user-md only when provided and identically on both surfaces', async () => {
        const userMd = '---\nname: Matze\ntype: developer\n---\n\n# Matze\n\nHi.\n';
        const payload = { settings: fixturePayload().settings, userMd };

        const aResult = await commitOnboardPayload(payload, projectA);
        expect(aResult.ok, JSON.stringify(aResult)).toBe(true);

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/wizard/finish',
            headers: { host: HOST, authorization: `Bearer ${TOKEN}` },
            payload,
        });
        expect(res.statusCode, res.body).toBe(200);

        const aMd = readFileSync(join(projectA, '.agent-user.md'), 'utf8');
        const bMd = readFileSync(join(projectB, '.agent-user.md'), 'utf8');
        expect(aMd).toBe(userMd);
        expect(aMd).toBe(bMd);
    });

    it('rejects an invalid user-md with the documented error code', async () => {
        // `userMdSchema` caps body at 8 000 chars — exceed it for a
        // deterministic failure regardless of gray-matter's tolerance.
        const badMd = 'x'.repeat(8_001);
        const payload = { settings: fixturePayload().settings, userMd: badMd };

        const aResult = await commitOnboardPayload(payload, projectA);
        expect(aResult.ok).toBe(false);
        if (!aResult.ok) expect(aResult.error.code).toBe('VALIDATION');
    });
});
