/**
 * End-to-end smoke for the compiled TS CLI binary.
 *
 * Spawns `node dist/cli/agent-config.js` and asserts the documented
 * exit codes / stdout shape for the native subcommands. Bash
 * delegation is exercised via the `--version`/`--help` paths that the
 * shell handles natively before delegation kicks in.
 */
import { describe, expect, it } from 'vitest';
import { execa } from 'execa';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CLI = resolve(process.cwd(), 'dist/cli/agent-config.js');

function pkgVersion(): string {
    const raw = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8');
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version ?? '0.0.0';
}

describe('compiled CLI', () => {
    it('dist/cli/agent-config.js exists (build artefact present)', () => {
        expect(existsSync(CLI)).toBe(true);
    });

    it('--version prints package.json version', async () => {
        const res = await execa('node', [CLI, '--version'], { reject: false });
        expect(res.exitCode).toBe(0);
        expect(res.stdout.trim()).toBe(pkgVersion());
    });

    it('-V prints package.json version (short flag)', async () => {
        const res = await execa('node', [CLI, '-V'], { reject: false });
        expect(res.exitCode).toBe(0);
        expect(res.stdout.trim()).toBe(pkgVersion());
    });

    it('--help prints the TS-shell help banner', async () => {
        const res = await execa('node', [CLI, '--help'], { reject: false });
        expect(res.exitCode).toBe(0);
        expect(res.stdout).toContain('agent-config');
        expect(res.stdout).toContain('Native commands');
        expect(res.stdout).toContain('versions');
        expect(res.stdout).toContain('ui:serve');
    });

    it('bare invocation prints the help banner', async () => {
        const res = await execa('node', [CLI], { reject: false });
        expect(res.exitCode).toBe(0);
        expect(res.stdout).toContain('Native commands');
    });

    it('versions --offline returns 0 and prints the current version', async () => {
        const res = await execa('node', [CLI, 'versions', '--offline'], {
            reject: false,
            timeout: 5000,
        });
        expect(res.exitCode).toBe(0);
        expect(res.stdout).toContain(`current: ${pkgVersion()}`);
    });

    it('versions --offline --json emits machine-readable output', async () => {
        const res = await execa('node', [CLI, 'versions', '--offline', '--json'], {
            reject: false,
            timeout: 5000,
        });
        expect(res.exitCode).toBe(0);
        const parsed = JSON.parse(res.stdout) as { current: string; available: string[] };
        expect(parsed.current).toBe(pkgVersion());
        expect(Array.isArray(parsed.available)).toBe(true);
    });

    it('doctor-shell runs and prints the package_root line', async () => {
        const res = await execa('node', [CLI, 'doctor-shell'], {
            reject: false,
            timeout: 10_000,
        });
        // Exit code may be 0 (all checks pass) or 1 (python3 missing on CI).
        expect([0, 1]).toContain(res.exitCode);
        expect(res.stdout).toContain('package_root:');
        expect(res.stdout).toContain('consumer_root:');
    });

    // 6.0.0-C Step 5b — CLI command-discovery surface.
    it('commands ls --visible --json lists visible commands with routing metadata', async () => {
        const res = await execa('node', [CLI, 'commands', 'ls', '--visible', '--json'], {
            reject: false,
            timeout: 10_000,
        });
        expect(res.exitCode).toBe(0);
        const parsed = JSON.parse(res.stdout) as { commands: Array<{ name: string; tier: number; intent: string }> };
        expect(parsed.commands.length).toBeGreaterThan(0);
        // Every listed command is visible (tier 0/1) and carries an intent.
        for (const c of parsed.commands) {
            expect([0, 1]).toContain(c.tier);
            expect(typeof c.intent).toBe('string');
            expect(c.intent.length).toBeGreaterThan(0);
        }
    });

    it('commands explain <name> prints intent + routes_to', async () => {
        const res = await execa('node', [CLI, 'commands', 'explain', 'implement-ticket'], {
            reject: false,
            timeout: 10_000,
        });
        expect(res.exitCode).toBe(0);
        expect(res.stdout).toContain('/implement-ticket');
        expect(res.stdout).toContain('intent:');
        expect(res.stdout).toContain('routes_to:');
    });

    it('explain <command-name> is intercepted as a command explanation', async () => {
        const res = await execa('node', [CLI, 'explain', 'work'], {
            reject: false,
            timeout: 10_000,
        });
        expect(res.exitCode).toBe(0);
        expect(res.stdout).toContain('/work');
        expect(res.stdout).toContain('routes_to:');
    });

    it('commands explain <unknown> exits 1', async () => {
        const res = await execa('node', [CLI, 'commands', 'explain', 'no-such-command-xyz'], {
            reject: false,
            timeout: 10_000,
        });
        expect(res.exitCode).toBe(1);
    });
});
