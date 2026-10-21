// `init --tools claude-code --scope global --dry-run` printed
// `Target: ~/.npm/_npx/<hash>` and `Synced .augment/`, while the real global
// install wrote `~/.claude/`. Two defects compounded:
//   - `--scope global` set SCOPE but neither GLOBAL nor SKIP_SYNC, although the
//     wrapper documented it as "same as --global", so the PROJECT payload sync
//     still ran — and under npx its target auto-detect lands in the npx cache;
//   - on --dry-run the wrapper skipped the bridge stage wholesale, so the one
//     stage that knows the global plan never reported it.
// These run the real wrapper against a fake HOME and assert on its plan.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const WRAPPER = path.join(REPO_ROOT, 'src', 'scripts', 'install');

let tmp: string;
let home: string;
let cwd: string;

function install(...args: string[]) {
    return spawnSync('bash', [WRAPPER, '--no-ui', ...args], {
        cwd,
        encoding: 'utf-8',
        env: {
            PATH: process.env.PATH ?? '/usr/bin:/bin',
            HOME: home,
            EVENT4U_CONFIG_HOME: path.join(home, '.event4u', 'agent-config'),
            CI: '1',
            AGENT_CONFIG_NO_UI: '1',
        },
        timeout: 120000,
    });
}

/** Everything under HOME and cwd, so "no writes" is checked rather than claimed. */
function snapshot(): string[] {
    const out: string[] = [];
    const walk = (d: string): void => {
        if (!existsSync(d)) return;
        for (const e of readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            out.push(path.relative(tmp, p));
            if (e.isDirectory()) walk(p);
        }
    };
    walk(tmp);
    return out.sort();
}

beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), 'dry-run-'));
    home = path.join(tmp, 'home');
    cwd = path.join(tmp, 'somewhere');
    mkdirSync(home, { recursive: true });
    mkdirSync(cwd, { recursive: true });
});
afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
});

describe('a global dry-run shows the global plan', () => {
    for (const flags of [['--scope', 'global'], ['--scope=global'], ['--global']]) {
        it(`${flags.join(' ')} skips the project payload sync and says so`, () => {
            const res = install(...flags, '--tools', 'claude-code', '--dry-run');
            const out = res.stdout + res.stderr;
            expect(res.status, out).toBe(0);
            expect(out).not.toContain('Synced .augment');
            expect(out).toMatch(/payload sync.*skipped/i);
        });
    }

    it('names the Claude Code anchor, not the npx cache or the cwd', () => {
        const res = install('--scope', 'global', '--tools', 'claude-code', '--dry-run');
        const out = res.stdout + res.stderr;
        expect(out).toContain('claude-code');
        expect(out).toContain(path.join(home, '.claude'));
        expect(out).not.toContain('_npx');
    });

    it('lists only the selected tool', () => {
        const out = (r => r.stdout + r.stderr)(install('--scope', 'global', '--tools', 'claude-code', '--dry-run'));
        expect(out).not.toMatch(/\bcursor\b.*\.cursor/);
        expect(out).not.toMatch(/\baugment\b.*\.augment/);
    });

    it('writes nothing at all', () => {
        const before = snapshot();
        install('--scope', 'global', '--tools', 'claude-code', '--dry-run');
        expect(snapshot()).toEqual(before);
    });
});
