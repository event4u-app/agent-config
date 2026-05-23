/**
 * Tests for the standalone `gui` subcommand
 * (`packages/core/installer/src/commands/gui.ts`).
 *
 * Boots the compiled CLI as a child process, parses the readiness line
 * (`WIZARD_READY url=…`), asserts the PID file is created at the
 * documented location, then sends SIGINT for a clean shutdown.
 *
 * Roadmap: `agents/roadmaps/wizard-install-py-wiring.md` Step 1.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeArtefact, makeManifest, makePack } from './_fixtures.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '..', 'dist', 'cli.js');
const READY_RE = /^WIZARD_READY url=(http:\/\/(?:127\.0\.0\.1|localhost):\d+\/)\r?$/m;

let projectRoot: string;

function writeManifest(root: string): string {
    const manifest = makeManifest({
        packs: [makePack({ id: 'a' })],
        artefacts: [makeArtefact({ path: '.agent-src.uncompressed/rules/foo.md', packs: ['a'] })],
    });
    const dir = join(root, 'dist', 'discovery');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, 'discovery-manifest.json');
    writeFileSync(path, JSON.stringify(manifest));
    return path;
}

beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'gui-cli-cmd-'));
    writeManifest(projectRoot);
});

afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
});

describe('gui subcommand', () => {
    it.skipIf(!existsSync(CLI_PATH))(
        'prints WIZARD_READY and creates the PID file',
        async () => {
            const child = spawn(
                process.execPath,
                [CLI_PATH, 'gui', '--project-root', projectRoot, '--port', '0', '--no-open'],
                { stdio: ['ignore', 'pipe', 'pipe'] },
            );

            let stdout = '';
            child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
            let stderr = '';
            child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });

            // Wait for the readiness line (up to 10s).
            const url = await new Promise<string>((resolveUrl, rejectUrl) => {
                const timer = setTimeout(() => {
                    rejectUrl(new Error(`timeout; stdout=${stdout}\nstderr=${stderr}`));
                }, 10_000);
                child.stdout.on('data', () => {
                    const m = stdout.match(READY_RE);
                    if (m !== null && m[1] !== undefined) {
                        clearTimeout(timer);
                        resolveUrl(m[1]);
                    }
                });
                child.on('exit', (code) => {
                    clearTimeout(timer);
                    rejectUrl(new Error(`child exited early with code ${code}; stderr=${stderr}`));
                });
            });

            expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
            const pidFile = join(projectRoot, 'agents', 'runtime', 'gui', 'server.pid');
            expect(existsSync(pidFile)).toBe(true);

            // Clean shutdown.
            child.kill('SIGINT');
            await new Promise<void>((resolveExit) => {
                child.on('exit', () => resolveExit());
            });
            expect(existsSync(pidFile)).toBe(false);
        },
        20_000,
    );

    it('rejects a relative --project-root via the runGui validator', async () => {
        const { runGui } = await import('../src/commands/gui.js');
        await expect(
            runGui(
                { mode: 'non-interactive', projectRoot: 'relative/path', dryRun: false, yes: false },
                {},
            ),
        ).rejects.toThrow(/absolute/);
    });

    it('rejects a system root via the runGui validator', async () => {
        const { runGui } = await import('../src/commands/gui.js');
        await expect(
            runGui(
                { mode: 'non-interactive', projectRoot: '/etc', dryRun: false, yes: false },
                {},
            ),
        ).rejects.toThrow(/system directory/);
    });
});
