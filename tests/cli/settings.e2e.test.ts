/**
 * End-to-end smoke for `agent-config settings` and `agent-config ui:serve`.
 *
 * Spawns the compiled TS CLI binary, verifies it boots the embedded
 * Fastify server, prints the tokenized URL on stdout, lands on the
 * correct initial hash route, and shuts down cleanly on SIGTERM.
 *
 * Per roadmap `unified-setup-and-settings-gui.md` § 2.5, the two
 * commands share the same server boot path — `settings` only differs
 * by the `#/settings` hash appended to the URL.
 */
import { describe, expect, it } from 'vitest';
import { execa, type ExecaChildProcess } from 'execa';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CLI = resolve(process.cwd(), 'dist/cli/agent-config.js');

interface BootResult {
    url: string;
    port: string;
    token: string;
    hash: string;
}

/**
 * Spawn the CLI, wait for the `agent-config UI on http://...` info line,
 * parse port + token + hash, then return the live process so the caller
 * can SIGTERM it.
 */
async function bootAndCapture(args: readonly string[]): Promise<{ proc: ExecaChildProcess; boot: BootResult }> {
    const proc = execa('node', [CLI, ...args], {
        reject: false,
        timeout: 15_000,
        env: { ...process.env, AGENT_CONFIG_LOG: 'info' },
    });
    if (proc.stdout === null) throw new Error('child stdout is null');

    let buffer = '';
    const boot = await new Promise<BootResult>((resolveBoot, rejectBoot) => {
        const onData = (chunk: Buffer | string): void => {
            buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
            const match = buffer.match(/http:\/\/127\.0\.0\.1:(\d+)\/\?token=([^\s#]+)(#[^\s]*)?/);
            if (match !== null) {
                proc.stdout?.off('data', onData);
                resolveBoot({
                    url: match[0],
                    port: match[1] ?? '',
                    token: match[2] ?? '',
                    hash: match[3] ?? '',
                });
            }
        };
        proc.stdout?.on('data', onData);
        const timeout = setTimeout(() => {
            proc.stdout?.off('data', onData);
            rejectBoot(new Error(`CLI did not print URL within 10s. Buffer: ${buffer.slice(0, 500)}`));
        }, 10_000);
        timeout.unref();
        proc.once('exit', () => { clearTimeout(timeout); });
    });

    return { proc, boot };
}

async function stop(proc: ExecaChildProcess): Promise<void> {
    if (proc.exitCode !== null) return;
    proc.kill('SIGTERM');
    try { await proc; } catch { /* exit code 0 via signal handler */ }
}

function makeUiDistStub(): string {
    const dir = mkdtempSync(join(tmpdir(), 'agent-config-ui-dist-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>stub</title>', { mode: 0o644 });
    return dir;
}

describe('compiled CLI — settings / ui:serve e2e', () => {
    it('dist/cli/agent-config.js exists (build artefact present)', () => {
        expect(existsSync(CLI)).toBe(true);
    });

    it('ui:serve --no-open --allow-headless prints a tokenized URL without a hash', async () => {
        const uiDist = makeUiDistStub();
        const { proc, boot } = await bootAndCapture([
            'ui:serve', '--no-open', '--allow-headless', '--ui-dist', uiDist,
        ]);
        try {
            expect(Number.parseInt(boot.port, 10)).toBeGreaterThanOrEqual(41000);
            expect(Number.parseInt(boot.port, 10)).toBeLessThanOrEqual(41999);
            expect(boot.token.length).toBeGreaterThan(8);
            expect(boot.hash).toBe('');
        } finally {
            await stop(proc);
        }
    });

    it('settings --no-open --allow-headless prints URL with #/settings hash', async () => {
        const uiDist = makeUiDistStub();
        const { proc, boot } = await bootAndCapture([
            'settings', '--no-open', '--allow-headless', '--ui-dist', uiDist,
        ]);
        try {
            expect(boot.hash).toBe('#/settings');
            expect(boot.token.length).toBeGreaterThan(8);
        } finally {
            await stop(proc);
        }
    });

    it('ui:serve honours --port when the requested port is free', async () => {
        const uiDist = makeUiDistStub();
        const requested = 41753;
        const { proc, boot } = await bootAndCapture([
            'ui:serve', '--no-open', '--allow-headless', '--ui-dist', uiDist,
            '--port', String(requested),
        ]);
        try {
            expect(boot.port).toBe(String(requested));
        } finally {
            await stop(proc);
        }
    });

    it('ui:serve refuses to start when dist/ui/index.html is missing (exit 1)', async () => {
        const emptyDir = mkdtempSync(join(tmpdir(), 'agent-config-ui-missing-'));
        const res = await execa('node', [CLI, 'ui:serve', '--no-open', '--allow-headless', '--ui-dist', emptyDir], {
            reject: false,
            timeout: 5_000,
        });
        expect(res.exitCode).toBe(1);
        expect(res.stderr).toContain('UI bundle not found');
    });

    it('settings refuses headless environment without --allow-headless (exit 2)', async () => {
        const uiDist = makeUiDistStub();
        const res = await execa('node', [CLI, 'settings', '--no-open', '--ui-dist', uiDist], {
            reject: false,
            timeout: 5_000,
            env: { ...process.env, SSH_CONNECTION: '1.2.3.4 22 5.6.7.8 22', DISPLAY: '' },
        });
        expect(res.exitCode).toBe(2);
        expect(res.stderr).toContain('Headless environment detected');
    });

    // road-to-unified-setup § B0 — `install` + `setup` share the same boot
    // path as `ui:serve`, only the initial wizard step differs. The hash
    // is identical (`#/wizard`); landing-step assertions live in the
    // server-side integration suite (tests/server/wizard.initialStep.test.ts).
    it('install --no-open --allow-headless boots with #/wizard hash', async () => {
        const uiDist = makeUiDistStub();
        const { proc, boot } = await bootAndCapture([
            'install', '--no-open', '--allow-headless', '--ui-dist', uiDist,
        ]);
        try {
            expect(boot.hash).toBe('#/wizard');
            expect(boot.token.length).toBeGreaterThan(8);
        } finally {
            await stop(proc);
        }
    });

    it('setup --no-open --allow-headless boots with #/wizard hash', async () => {
        const uiDist = makeUiDistStub();
        const { proc, boot } = await bootAndCapture([
            'setup', '--no-open', '--allow-headless', '--ui-dist', uiDist,
        ]);
        try {
            expect(boot.hash).toBe('#/wizard');
            expect(boot.token.length).toBeGreaterThan(8);
        } finally {
            await stop(proc);
        }
    });
});
