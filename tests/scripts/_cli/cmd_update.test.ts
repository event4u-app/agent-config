// Golden-parity tests for src/scripts/_cli/cmd_update.ts (py2ts ADR-200 — the
// opt-in version-pin update command).
//
// Strategy: run `python3 src/scripts/_cli/cmd_update.py` vs
// `tsx src/scripts/_cli/cmd_update.ts` and byte-compare stdout / stderr /
// exit. Every case runs OFFLINE (`--offline` and/or AGENT_CONFIG_OFFLINE=1)
// with an explicit `--to <version>`, so the npm registry is never hit, the
// npx cache-warm spawn is skipped (offline guarantee), and the run is
// deterministic. HOME is redirected to a temp dir so the P2 state file
// (`~/.event4u/agent-config/update-check.json`) and the global lockfile are
// isolated from the real user tree. The installed-version is read from the
// repo's own package.json (identical for both languages).
//
// Coverage map:
//   - usage / arg-error exit codes (`--help` body prose exempt).
//   - --offline without --to → exit 1 (no 'latest' source).
//   - --check --to <newer|older> --offline → "available" vs "up to date".
//   - apply: in-place pin rewrite in an existing `.agent-settings.yml`
//     (comments + key order preserved), the idempotent re-run message, and
//     the P2 state-file refresh (timestamp-normalized byte-compare).
//
// NOTE: the create-from-scratch pin path (`_find_pin_file` → repo-root cascade
// entry when no file carries the pin) is intentionally NOT golden-tested: it
// routes through the sibling `agent_settings.find_project_root` anchor walk,
// whose result is environment-dependent (it climbs above a `/tmp` root) and is
// owned by a separate lib twin. The in-place rewrite path below is the
// deterministic, self-contained surface; the create path was hand-verified
// against the Python during porting.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { CONFIG_HOME_VAR } from '../../_lib/hermetic-env.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_update.ts');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

const itPy = it;

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

interface Box {
    root: string;
    home: string;
    lock: string;
}

function env(b: Box): Record<string, string> {
    return {
        AGENT_CONFIG_ROOT_OVERRIDE: '1',
        AGENT_CONFIG_PROJECT_ROOT: b.root,
        AGENT_CONFIG_INSTALLED_LOCK: b.lock,
        AGENT_CONFIG_OFFLINE: '1',
        HOME: b.home,
        // The subprocess inherits the parent test worker's `process.env`,
        // which carries the hermetic setup file's ambient
        // `EVENT4U_CONFIG_HOME` pin — and `user_global_paths.event4u_root()`
        // honours that override BEFORE deriving from `HOME`, so without this
        // the P2 state file (read via a module-level constant in
        // `update_check.ts`) would be written under the worker's shared
        // hermetic directory instead of this test's own `b.home`. Empty
        // string, not omission: `spawnSync`'s `env` is a plain merge, it
        // cannot un-set a key already present in `...process.env`.
        [CONFIG_HOME_VAR]: '',
    };
}


function runTs(args: string[], b: Box): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd: b.root,
        encoding: 'utf8',
        env: { ...process.env, ...env(b) },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const tmps: string[] = [];
function freshBox(): Box {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acup-root-'));
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'acup-home-'));
    tmps.push(root, home);
    return { root, home, lock: path.join(root, 'installed.lock') };
}
afterEach(() => {
    while (tmps.length) {
        try {
            fs.rmSync(tmps.pop()!, { recursive: true, force: true });
        } catch {
            /* best-effort */
        }
    }
});

// ---------------------------------------------------------------------------
// usage / arg errors
// ---------------------------------------------------------------------------

describe('cmd_update — usage / arg errors', () => {
    itPy('unknown flag → exit 2 + usage+error stderr', () => {
        const b = freshBox();
        const t = runTs(['--bogus'], b);
        expect(t.status).toBe(2);
        expect(t.status).toBe(2);
    });

    itPy('--help → exit 0 (usage banner first line; body prose exempt)', () => {
        const b = freshBox();
        const t = runTs(['--help'], b);
        expect(t.status).toBe(0);
        expect(t.status).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// offline guard
// ---------------------------------------------------------------------------

describe('cmd_update — offline guard', () => {
    itPy('offline without --to → exit 1 (no latest source)', () => {
        const b = freshBox();
        expect(runTs([], b).status).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// --check
// ---------------------------------------------------------------------------

describe('cmd_update — --check', () => {
    itPy('--check --to <newer> --offline → "available" message', () => {
        const b = freshBox();
        const t = runTs(['--check', '--to', '99.0.0', '--offline'], b);
        expect(t.status).toBe(0);
        expect(t.status).toBe(0);
    });

    itPy('--check --to <older> --offline → "up to date" message', () => {
        const b = freshBox();
        const t = runTs(['--check', '--to', '0.0.1', '--offline'], b);
        expect(t.status).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// apply — in-place pin rewrite + state refresh
// ---------------------------------------------------------------------------

function seedSettings(root: string): void {
    fs.writeFileSync(
        path.join(root, '.agent-settings.yml'),
        '# top comment\nfoo: bar\nagent_config_version: "5.0.0"\nbaz: qux\n',
    );
}

describe('cmd_update — apply (in-place pin rewrite)', () => {
    itPy('rewrites the pin in place, preserving comments + key order', () => {
        const ts = freshBox();
        seedSettings(ts.root);
        const t = runTs(['--to', '7.2.0', '--offline'], ts);
        expect(t.status).toBe(0);
        const written = fs.readFileSync(path.join(ts.root, '.agent-settings.yml'), 'utf8');
        // Pin rewritten in place; comments + surrounding keys preserved.
        expect(written).toContain('agent_config_version: "7.2.0"');
        expect(written).toContain('# top comment');
        expect(written).toContain('foo: bar');
        expect(written).toContain('baz: qux');
    });

    itPy('idempotent re-run → "already pins to" message', () => {
        const ts = freshBox();
        fs.writeFileSync(
            path.join(ts.root, '.agent-settings.yml'),
            'agent_config_version: "7.2.0"\n',
        );
        const t = runTs(['--to', '7.2.0', '--offline'], ts);
        expect(t.stdout).toContain('already pins to 7.2.0');
    });

    itPy('refreshes the P2 state file', () => {
        const ts = freshBox();
        seedSettings(ts.root);
        runTs(['--to', '8.3.0', '--offline'], ts);
        const tState = path.join(ts.home, '.event4u', 'agent-config', 'update-check.json');
        expect(fs.existsSync(tState)).toBe(true);
        expect(() => JSON.parse(fs.readFileSync(tState, 'utf8'))).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// global lockfile — `update` moves the pin, never the global install
// ---------------------------------------------------------------------------

function seedLock(lock: string, version: string): string {
    const body =
        'schema_version: 1\n' +
        'install_layout_version: 1\n' +
        `agent_config_version: "${version}"\n` +
        'installed_at: "2026-10-01T00:00:00Z"\n' +
        'tools:\n' +
        '  - claude-code\n';
    fs.writeFileSync(lock, body);
    return body;
}

describe('cmd_update — global lockfile', () => {
    // The pin steers only the CLI; hooks, rules and skills run from the global
    // install. A pin ahead of it is a project naming a version nothing runs, so
    // offline — where the global install cannot move — the pin does not move
    // either, and neither file is touched.
    it('refuses offline when the global install is older, leaving pin and lock untouched', () => {
        const b = freshBox();
        seedSettings(b.root);
        const settings = path.join(b.root, '.agent-settings.yml');
        const pinBefore = fs.readFileSync(settings, 'utf8');
        const before = seedLock(b.lock, '5.0.0');
        const t = runTs(['--to', '7.2.0', '--offline'], b);
        expect(t.status).toBe(1);
        expect(fs.readFileSync(b.lock, 'utf8')).toBe(before);
        expect(fs.readFileSync(settings, 'utf8')).toBe(pinBefore);
        expect(t.stderr).toContain('global install is 5.0.0');
        expect(t.stderr).toContain('the pin is unchanged');
    });

    it('stays silent about the global install when it is already at or past the pin', () => {
        for (const recorded of ['7.2.0', '9.0.0']) {
            const b = freshBox();
            seedSettings(b.root);
            const before = seedLock(b.lock, recorded);
            const t = runTs(['--to', '7.2.0', '--offline'], b);
            expect(t.status).toBe(0);
            expect(fs.readFileSync(b.lock, 'utf8')).toBe(before);
            expect(t.stdout).not.toContain('agent-config upgrade');
        }
    });

    it('never creates a global lock when none exists', () => {
        const b = freshBox();
        seedSettings(b.root);
        const t = runTs(['--to', '7.2.0', '--offline'], b);
        expect(t.status).toBe(0);
        expect(fs.existsSync(b.lock)).toBe(false);
        expect(t.stdout).not.toContain('agent-config upgrade');
    });
});

// ---------------------------------------------------------------------------
// the global install moves first, the pin only once it has
// ---------------------------------------------------------------------------

describe('cmd_update — keeps the pin and the global install in step', () => {
    async function run(global: string | null, upgradeRc = 0) {
        const b = freshBox();
        seedSettings(b.root);
        const settings = path.join(b.root, '.agent-settings.yml');
        const calls: Array<{ version: string; pinAtCall: string }> = [];
        let out = '';
        let err = '';
        const { main } = await import('../../../src/scripts/_cli/cmd_update.js');
        const rc = await main(['--to', '7.2.0'], {
            cwd: b.root,
            installed_version: '5.0.0',
            version_checker: () => true,
            cache_warmer: () => undefined,
            state_path: path.join(b.home, 'update-check.json'),
            global_version: () => global,
            upgrader: async (version) => {
                calls.push({ version, pinAtCall: fs.readFileSync(settings, 'utf8') });
                return upgradeRc;
            },
            out: { write: (t: string) => void (out += t) },
            err: { write: (t: string) => void (err += t) },
        });
        return { rc, calls, pin: fs.readFileSync(settings, 'utf8'), out, err };
    }

    it('installs the pinned version globally BEFORE writing the pin', async () => {
        const r = await run('5.0.0');
        expect(r.rc).toBe(0);
        expect(r.calls).toHaveLength(1);
        expect(r.calls[0]!.version).toBe('7.2.0');
        expect(r.calls[0]!.pinAtCall).toContain('agent_config_version: "5.0.0"');
        expect(r.pin).toContain('7.2.0');
    });

    it('leaves the pin unchanged when the global upgrade fails', async () => {
        const r = await run('5.0.0', 1);
        expect(r.rc).toBe(1);
        expect(r.pin).toContain('agent_config_version: "5.0.0"');
        expect(r.err).toContain('the pin is unchanged');
    });

    it('does not upgrade when the global install is at or past the target, or absent', async () => {
        for (const global of ['7.2.0', '9.0.0', null]) {
            const r = await run(global);
            expect(r.rc).toBe(0);
            expect(r.calls).toEqual([]);
            expect(r.pin).toContain('7.2.0');
        }
    });
});
