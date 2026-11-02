/**
 * `cloud_carry` — the agent-config hook matrix carried in a repository's
 * committed `.claude/settings.json`, live only in a cloud session
 * (road-to-host-inputs-the-installer-honours Phase 5.3).
 *
 * The commands are EXECUTED here, not only inspected: a carried command that
 * reads right and fires locally would double every hook beside the global
 * install, and one that stays quiet in the cloud when no dispatcher arrives
 * would turn the fail_closed guards off without a word.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    CLOUD_ONLY,
    CLOUD_BOOTSTRAP_FAILED,
    carriedMatrix,
    carryIntoRepo,
    repairCloudReach,
} from '../../src/scripts/_lib/cloud_carry.js';
import { MANAGED_SIGNATURE } from '../../src/scripts/_lib/claude_settings_hooks.js';
import { measureCloudReach, checkCloudReach } from '../../src/scripts/_lib/cloud_reach.js';

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST = path.join(ROOT, 'src', 'scripts', 'hook_manifest.yaml');
const dirs: string[] = [];

function tmp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    dirs.push(d);
    return d;
}

afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/** Run a carried command the way the host does: `sh -c`, payload on stdin. */
function run(command: string, env: Record<string, string>): { status: number | null; stdout: string; stderr: string } {
    const r = spawnSync('/bin/sh', ['-c', command], { env, input: '{}', encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function bareEnv(extra: Record<string, string> = {}): Record<string, string> {
    const home = tmp('carry-home-');
    const project = tmp('carry-project-');
    return { HOME: home, PATH: '/usr/bin:/bin', CLAUDE_PROJECT_DIR: project, ...extra };
}

function fakeBin(dir: string, name: string, body: string): void {
    const p = path.join(dir, name);
    fs.writeFileSync(p, `#!/bin/sh\n${body}\n`);
    fs.chmodSync(p, 0o755);
}

describe('carriedMatrix', () => {
    const carried = carriedMatrix(MANIFEST, '19.2.0');

    it('keeps every event managed and gates each on CLAUDE_CODE_REMOTE', () => {
        expect(Object.keys(carried).length).toBeGreaterThanOrEqual(3);
        for (const cmd of Object.values(carried)) {
            expect(cmd.startsWith(CLOUD_ONLY)).toBe(true);
            expect(cmd).toContain(MANAGED_SIGNATURE);
        }
    });

    it('pins the exact version on the SessionStart bootstrap and skips install scripts', () => {
        expect(carried['SessionStart']).toContain('npm i -g --ignore-scripts');
        expect(carried['SessionStart']).toContain('@event4u/agent-config@19.2.0 ');
        expect(carried['PreToolUse']).not.toContain('--ignore-scripts');
    });

    it.each(['19', 'latest', '1.2.3; rm -rf /', '1.2.3 $(id)', ''])('refuses a version that is not plain semver: %j', (v) => {
        expect(() => carriedMatrix(MANIFEST, v)).toThrow(/version/);
    });

    it('does nothing locally — no output, exit 0, so it never doubles the global hooks', () => {
        for (const cmd of Object.values(carried)) {
            const r = run(cmd, bareEnv());
            expect(r).toEqual({ status: 0, stdout: '', stderr: '' });
        }
    });

    it('refuses a tool call in the cloud when no dispatcher arrived — fail-closed as locally', () => {
        const r = run(carried['PreToolUse'] as string, bareEnv({ CLAUDE_CODE_REMOTE: 'true' }));
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('refused');
    });

    it('says so loudly at session start when the bootstrap install fails', () => {
        const bin = tmp('carry-bin-');
        fakeBin(bin, 'npm', 'exit 1');
        const r = run(carried['SessionStart'] as string, bareEnv({ CLAUDE_CODE_REMOTE: 'true', PATH: `${bin}:/usr/bin:/bin` }));
        expect(r.status).toBe(0);
        expect(r.stdout).toContain(CLOUD_BOOTSTRAP_FAILED);
        expect(r.stderr).toContain(CLOUD_BOOTSTRAP_FAILED);
    });

    it('installs, then dispatches through the freshly installed binary', () => {
        const bin = tmp('carry-bin-');
        const log = path.join(bin, 'npm.log');
        fakeBin(bin, 'npm', `echo "$@" > ${log}\ncat > ${bin}/agent-config <<'EOF'\n#!/bin/sh\necho "dispatched $*"\nEOF\nchmod +x ${bin}/agent-config`);
        const r = run(carried['SessionStart'] as string, bareEnv({ CLAUDE_CODE_REMOTE: 'true', PATH: `${bin}:/usr/bin:/bin` }));
        expect(fs.readFileSync(log, 'utf8')).toContain('i -g --ignore-scripts --no-audit --no-fund @event4u/agent-config@19.2.0');
        expect(r.stdout).toContain('dispatched dispatch:hook --platform claude --event session_start');
        expect(r.stdout).not.toContain(CLOUD_BOOTSTRAP_FAILED);
    });

    it('never installs over a dispatcher that is already there', () => {
        const bin = tmp('carry-bin-');
        const log = path.join(bin, 'npm.log');
        fakeBin(bin, 'npm', `touch ${log}`);
        fakeBin(bin, 'agent-config', 'echo present');
        run(carried['SessionStart'] as string, bareEnv({ CLAUDE_CODE_REMOTE: 'true', PATH: `${bin}:/usr/bin:/bin` }));
        expect(fs.existsSync(log)).toBe(false);
    });

    it('does not trust an agent-config committed inside the project', () => {
        const env = bareEnv({ CLAUDE_CODE_REMOTE: 'true' });
        const projBin = path.join(env['CLAUDE_PROJECT_DIR'] as string, 'bin');
        fs.mkdirSync(projBin);
        fakeBin(projBin, 'agent-config', 'echo hijacked; exit 0');
        const r = run(carried['PreToolUse'] as string, { ...env, PATH: `${projBin}:/usr/bin:/bin` });
        expect(r.stdout).not.toContain('hijacked');
        expect(r.status).toBe(2);
    });
});

describe('carryIntoRepo', () => {
    function repo(): string {
        const root = tmp('carry-repo-');
        execFileSync('git', ['init', '-q'], { cwd: root });
        return root;
    }

    it('writes the carried matrix, keeps user entries, and is idempotent', () => {
        const root = repo();
        const settings = path.join(root, '.claude', 'settings.json');
        fs.mkdirSync(path.dirname(settings));
        const user = { type: 'command', command: 'echo mine' };
        fs.writeFileSync(settings, JSON.stringify({ hooks: { PreToolUse: [{ hooks: [user] }] }, model: 'x' }));

        const first = carryIntoRepo(root, MANIFEST, '19.2.0');
        expect(first.changed).toBe(true);
        const data = JSON.parse(fs.readFileSync(settings, 'utf8'));
        expect(data.model).toBe('x');
        expect(data.hooks.PreToolUse[0].hooks[0]).toEqual(user);
        const session = data.hooks.SessionStart.at(-1).hooks[0];
        expect(session.command.startsWith(CLOUD_ONLY)).toBe(true);
        expect(session.timeout).toBeGreaterThanOrEqual(120);

        expect(carryIntoRepo(root, MANIFEST, '19.2.0').changed).toBe(false);
    });

    it('turns cloud-reach green once committed', () => {
        const root = repo();
        carryIntoRepo(root, MANIFEST, '19.2.0');
        execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'add', '.claude/settings.json'], { cwd: root });
        execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'carry'], { cwd: root });
        expect(measureCloudReach(root)?.managedHooks).toBeGreaterThanOrEqual(3);
        expect(checkCloudReach(root, { CLAUDE_CODE_REMOTE: 'true' }).status).toBe('ok');
    });
});

describe('repairCloudReach', () => {
    it('carries once, then reports a no-op', () => {
        const root = tmp('carry-repair-');
        const first = repairCloudReach(root, ROOT, '19.2.0');
        expect(first.code).toBe(0);
        expect(first.payload['action']).toBe('carried');
        expect(first.lines.join('\n')).toContain('Review and commit');
        expect(repairCloudReach(root, ROOT, '19.2.0').payload['action']).toBe('noop');
    });

    it('doctor glue: JSON to stdout when asked, failure lines to stderr otherwise', () => {
        const script = (version: string, json: boolean): string =>
            `import { runCloudReachRepair } from ${JSON.stringify(path.join(ROOT, 'src/scripts/_lib/cloud_carry.ts'))};` +
            `process.exitCode = runCloudReachRepair(${JSON.stringify(tmp('carry-glue-'))}, ${JSON.stringify(ROOT)}, ${version}, ${json ? '(p) => "JSON:" + p.action' : 'null'});`;
        const tsx = path.join(ROOT, 'node_modules', '.bin', 'tsx');
        const ok = spawnSync(tsx, ['-e', script('"19.2.0"', true)], { encoding: 'utf8' });
        expect([ok.status, ok.stdout.trim(), ok.stderr]).toEqual([0, 'JSON:carried', '']);
        const bad = spawnSync(tsx, ['-e', script('null', false)], { encoding: 'utf8' });
        expect(bad.status).toBe(2);
        expect(bad.stdout).toBe('');
        expect(bad.stderr).toContain('could not carry hooks');
    });

    it('refuses without a readable version and writes nothing', () => {
        const root = tmp('carry-repair-');
        const r = repairCloudReach(root, ROOT, null);
        expect(r.code).toBe(2);
        expect(fs.existsSync(path.join(root, '.claude', 'settings.json'))).toBe(false);
    });
});
