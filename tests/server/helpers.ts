/**
 * Shared helpers for Phase 1.6 acceptance tests.
 *
 * Every server route test follows the same shape:
 *   1. mkdtemp a project root.
 *   2. Seed it with the package template at `.agent-settings.yml`.
 *   3. mkdtemp a fake UI dist dir (createApp insists on one).
 *   4. Boot Fastify via `createApp` with `skipReplay: true` for hermetic
 *      tests; the dedicated crash-recovery test opts in to replay.
 *   5. Drive routes via `app.inject` (Fastify's in-process harness).
 *
 * Centralising the boilerplate keeps each acceptance file focused on
 * what it asserts, not on the fixture dance.
 */
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/server/app.js';
import { settingsSchema } from '../../src/server/schemas/settings.js';

export interface TestApp {
    app: FastifyInstance;
    projectRoot: string;
    uiDir: string;
    token: string;
    host: string;
    cleanup: () => Promise<void>;
}

export interface BootOptions {
    /** Per-test port (only used to compose the Host header — Fastify inject does not bind). */
    port: number;
    /** Seed `.agent-settings.yml` with the package template (default: true). */
    seedSettings?: boolean;
    /** Seed an existing `.agent-user.md` body (default: omitted). */
    seedUserMd?: string;
    /** Replay pending 2PC commits at boot (default: false; the crash test flips this). */
    replay?: boolean;
    /** Boot in dry-run mode (every write returns a `preview` payload). */
    dryRun?: boolean;
}

const PACKAGE_ROOT = resolve(process.cwd());
const TEMPLATE_PATH = join(PACKAGE_ROOT, 'config', 'agent-settings.template.yml');

export function settingsTemplate(): string {
    return readFileSync(TEMPLATE_PATH, 'utf8');
}

export async function bootTestApp(opts: BootOptions): Promise<TestApp> {
    const projectRoot = mkdtempSync(join(tmpdir(), 'agent-config-test-'));
    mkdirSync(join(projectRoot, 'state'), { recursive: true });

    if (opts.seedSettings !== false) {
        writeFileSync(join(projectRoot, '.agent-settings.yml'), settingsTemplate(), { mode: 0o600 });
    }
    if (opts.seedUserMd !== undefined) {
        writeFileSync(join(projectRoot, '.agent-user.md'), opts.seedUserMd, { mode: 0o600 });
    }

    const uiDir = mkdtempSync(join(tmpdir(), 'agent-config-ui-'));
    writeFileSync(join(uiDir, 'index.html'), '<!doctype html><html><body>ok</body></html>');

    const token = 'x'.repeat(64);
    const app = await createApp({
        projectRoot,
        uiDistDir: uiDir,
        token,
        expectedPort: opts.port,
        logLevel: 'fatal',
        skipReplay: opts.replay !== true,
        dryRun: opts.dryRun === true,
    });
    await app.ready();

    const cleanup = async (): Promise<void> => {
        await app.close();
        rmSync(projectRoot, { recursive: true, force: true });
        rmSync(uiDir, { recursive: true, force: true });
    };

    return { app, projectRoot, uiDir, token, host: `127.0.0.1:${opts.port}`, cleanup };
}

/**
 * Build a fully-validated settings payload by parsing the schema with
 * defaults-all-the-way-down, then overlaying the keys the wizard
 * actually flips. The Zod schema fills every required field.
 */
export function fixtureSettings(overlay: Record<string, unknown> = {}): Record<string, unknown> {
    const base = settingsSchema.parse({
        cost: { budgets: {}, enforcement: 'advisory' },
        personal: {}, project: {}, github: {}, augment: {}, eloquent: {},
        chat_history: { text_limits: {} }, pipelines: {}, roadmap: {},
        quality: {}, subagents: {}, worktrees: {}, onboarding: {},
        commands: { suggestion: {}, create_pr: {} }, memory: {},
        hooks: { concern_budget: {} }, decision_engine: {},
        update_check: {}, explain: {},
    });
    return { ...base, ...overlay };
}

export function authHeaders(token: string, host: string): Record<string, string> {
    return { host, authorization: `Bearer ${token}` };
}

/**
 * Build a v1-valid `.agent-user.md` body. Mirrors the locked contract
 * (`docs/contracts/agent-user-schema.md`) so any required-field tightening
 * in `userMdSchema` is felt by every wizard / dry-run / user-md test.
 *
 * Pass `overlay` to flip individual frontmatter fields; everything else
 * defaults to a sane Matze-shaped fixture.
 */
export function fixtureUserMd(
    overlay: { name?: string; language?: string; role?: string[]; formality?: 'informal' | 'formal'; pace?: 'pragmatic' | 'thorough' | 'rapid'; voiceSample?: string; lastUpdated?: string; notes?: string } = {},
): string {
    const name = overlay.name ?? 'Matze';
    const language = overlay.language ?? 'de';
    const role = overlay.role ?? ['founder'];
    const formality = overlay.formality ?? 'informal';
    const pace = overlay.pace ?? 'pragmatic';
    const voiceSample = overlay.voiceSample ?? 'Mach das einfach.';
    const lastUpdated = overlay.lastUpdated ?? '2026-05-19';
    const notes = overlay.notes ?? 'hi.';
    const roleBlock = role.map((r) => `  - ${r}`).join('\n');
    return [
        '---',
        'version: 1',
        'identity:',
        `  name: "${name}"`,
        `language: "${language}"`,
        'role:',
        roleBlock,
        'style:',
        `  formality: "${formality}"`,
        `  pace: "${pace}"`,
        'voice_sample: |',
        `  ${voiceSample}`,
        `last_updated: "${lastUpdated}"`,
        '---',
        '',
        '# Notes',
        notes,
        '',
    ].join('\n');
}
