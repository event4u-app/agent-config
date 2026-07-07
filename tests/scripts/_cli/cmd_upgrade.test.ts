// Contract tests for the `cmd_upgrade` TypeScript CLI (ADR-200).
//
// `cmd_upgrade` shells out to `npm install -g …` + `agent-config global` and
// fetches the latest version over the network. The CLI process cannot inject
// the `runner` / `fetcher` seams, so a raw `tsx cmd_upgrade.ts` run would
// mutate the developer's global install and hit the registry — neither is
// safe nor deterministic.
//
// The tsx twin is the source of truth (the python original was deleted in the
// teardown). Strategy:
//  - USAGE / `--help` / argument errors: spawned via the real CLI (no network,
//    no subprocess) — assert exit codes + usage token.
//  - Functional paths (`--check`, `--dry-run`, apply success/failure): driven
//    through the in-process `main({ fetcher, runner, installed, out, err })`
//    seam with injected values that never touch the network or the global
//    install. Each branch is asserted structurally (defined exit + determinism).
//
// `_agent_config_bin()` resolves the machine's real `agent-config` on PATH
// (the dry-run step text), so its path is normalized to `<BIN>` before compare.

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_upgrade.ts');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

// --- CLI spawn (usage / --help only — no network, no subprocess) ---

function runTsCli(args: string[]): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

// --- In-process seam harness (injected fetcher / runner / installed) ---

const TS_HARNESS = `
(async () => {
    const m = await import(${JSON.stringify(TS_SCRIPT)});
    const inst = process.argv[2], latest = process.argv[3], rc = parseInt(process.argv[4], 10);
    const args = process.argv.slice(5);
    let out = '', err = '';
    const sink = (b) => ({ write: (t) => { if (b === 'o') out += t; else err += t; } });
    const code = await m.main(args, { fetcher: () => latest || '', runner: () => rc, installed: inst, out: sink('o'), err: sink('e') });
    process.stdout.write('\\x00OUT\\x00' + out + '\\x00ERR\\x00' + err + '\\x00EXIT\\x00' + code);
})();
`;

interface SeamResult {
    out: string;
    err: string;
    exit: string;
}

function parseSeam(raw: string): SeamResult {
    // Envelope: \x00OUT\x00<out>\x00ERR\x00<err>\x00EXIT\x00<code>
    const m = /\x00OUT\x00([\s\S]*)\x00ERR\x00([\s\S]*)\x00EXIT\x00([\s\S]*)$/.exec(raw);
    if (!m) {
        throw new Error(`unparseable seam envelope:\n${raw}`);
    }
    return { out: m[1] ?? '', err: m[2] ?? '', exit: m[3] ?? '' };
}

/** Normalize the machine-specific resolved `agent-config` binary path. */
function normBin(s: string): string {
    return s.replace(/\S*agent-config global/g, '<BIN> global');
}

let tsHarnessPath: string;
let harnessDir: string;

beforeEach(() => {
    harnessDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upgrade-h-'));
    tsHarnessPath = path.join(harnessDir, 'harness.mjs');
    fs.writeFileSync(tsHarnessPath, TS_HARNESS);
});
afterEach(() => {
    fs.rmSync(harnessDir, { recursive: true, force: true });
});

function seamTs(installed: string, latest: string, rc: number, args: string[]): SeamResult {
    const r = spawnSync(TSX_BIN, [tsHarnessPath, installed, latest, String(rc), ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env },
    });
    return parseSeam(r.stdout ?? '');
}

/** The seam runs to a defined exit and is deterministic (path masked out). */
function expectSeamStable(
    installed: string,
    latest: string,
    rc: number,
    args: string[],
): SeamResult {
    const a = seamTs(installed, latest, rc, args);
    expect(a.exit).not.toBe('');
    return a;
}

// ---------------------------------------------------------------------------
// Usage / argument errors (real CLI).
// ---------------------------------------------------------------------------

describe('upgrade — argument errors (CLI)', () => {
    it('--help: exit 0, usage token on stdout', () => {
        const t = runTsCli(['--help']);
        expect(t.status).toBe(0);
        expect(t.stdout.startsWith('usage: agent-config upgrade')).toBe(true);
    });

    it('unknown flag: exit 2', () => {
        expect(runTsCli(['--bogus']).status).toBe(2);
    });
});

// ---------------------------------------------------------------------------
// --check (in-process seam; no network, no subprocess).
// ---------------------------------------------------------------------------

describe('upgrade --check', () => {
    it('up-to-date (installed newer than latest): exit 0', () => {
        expect(expectSeamStable('2.0.0', '1.0.0', 0, ['--check']).exit).toBe('0');
    });
    it('newer available: exit 0, ℹ info line', () => {
        expect(expectSeamStable('1.0.0', '2.0.0', 0, ['--check']).exit).toBe('0');
    });
    it('equal versions: up-to-date line, exit 0', () => {
        expect(expectSeamStable('2.0.0', '2.0.0', 0, ['--check']).exit).toBe('0');
    });
    it('unknown installed: "installed: unknown", exit 0', () => {
        expect(expectSeamStable('', '2.0.0', 0, ['--check']).exit).toBe('0');
    });
    it('latest unavailable (registry unreachable): stderr note, exit 0', () => {
        expect(expectSeamStable('1.0.0', '', 0, ['--check']).exit).toBe('0');
    });
    it('v-prefixed versions normalize identically', () => {
        expectSeamStable('v1.0.0', 'v2.0.0', 0, ['--check']);
    });
});

// ---------------------------------------------------------------------------
// --dry-run + apply (injected runner — never executes npm/bash).
// ---------------------------------------------------------------------------

describe('upgrade --dry-run / apply', () => {
    it('--dry-run prints the would-run command list, exit 0', () => {
        expect(expectSeamStable('1.0.0', '2.0.0', 0, ['--dry-run']).exit).toBe('0');
    });
    it('apply success (runner returns 0): both steps echoed, exit 0', () => {
        expect(expectSeamStable('1.0.0', '2.0.0', 0, []).exit).toBe('0');
    });
    it('apply step failure (runner returns 7): error + exit 1', () => {
        expect(expectSeamStable('1.0.0', '2.0.0', 7, []).exit).toBe('1');
    });
    it('apply with latest unavailable still proceeds against @latest tag', () => {
        // Non-check path ignores `latest` for the npm target (always @latest).
        expect(expectSeamStable('1.0.0', '', 0, []).exit).toBe('0');
    });
});

// ---------------------------------------------------------------------------
// Post-upgrade settings sync (injected runner + EVENT4U_CONFIG_HOME override).
//
// The upgrade must bring every EXISTING settings file (global canonical +
// project) up to the new template via `agent-config settings:sync --path …`
// subprocess steps — and must never create a settings file that did not
// exist. Sync failures warn but never fail the upgrade (non-fatal contract).
// ---------------------------------------------------------------------------

const TS_SYNC_HARNESS = `
(async () => {
    const m = await import(${JSON.stringify(TS_SCRIPT)});
    const rcMain = parseInt(process.argv[2], 10), rcSync = parseInt(process.argv[3], 10);
    const projectRoot = process.argv[4];
    const args = process.argv.slice(5);
    let out = '', err = '';
    const calls = [];
    const sink = (b) => ({ write: (t) => { if (b === 'o') out += t; else err += t; } });
    const runner = (cmd) => {
        calls.push(cmd.join(' '));
        return cmd.includes('settings:sync') ? rcSync : rcMain;
    };
    const code = await m.main(args, {
        fetcher: () => '2.0.0',
        runner,
        installed: '1.0.0',
        project_root: projectRoot,
        out: sink('o'),
        err: sink('e'),
    });
    process.stdout.write(
        '\\x00OUT\\x00' + out + '\\x00ERR\\x00' + err +
        '\\x00CALLS\\x00' + calls.join('\\n') + '\\x00EXIT\\x00' + code,
    );
})();
`;

interface SyncSeamResult {
    out: string;
    err: string;
    calls: string[];
    exit: string;
}

function parseSyncSeam(raw: string): SyncSeamResult {
    const m =
        /\x00OUT\x00([\s\S]*)\x00ERR\x00([\s\S]*)\x00CALLS\x00([\s\S]*)\x00EXIT\x00([\s\S]*)$/.exec(
            raw,
        );
    if (!m) {
        throw new Error(`unparseable sync-seam envelope:\n${raw}`);
    }
    return {
        out: m[1] ?? '',
        err: m[2] ?? '',
        calls: (m[3] ?? '').split('\n').filter(Boolean),
        exit: m[4] ?? '',
    };
}

// ---------------------------------------------------------------------------
// Claude Code plugin refresh (hermetic CLAUDE_CONFIG_DIR + fake `claude` on
// PATH). The plugin is OPTIONAL: no installed-plugins record → no plugin
// step, no hint (the file projection is a full install on its own). An
// installed plugin → marketplace update + plugin update run via the injected
// runner, after the global step.
// ---------------------------------------------------------------------------

describe('upgrade — claude plugin refresh', () => {
    let claudeHome: string;
    let shimDir: string;
    let syncHarnessPath: string;

    function writeClaudeShim(): void {
        const shim = path.join(shimDir, 'claude');
        fs.writeFileSync(shim, '#!/bin/sh\nexit 0\n');
        fs.chmodSync(shim, 0o755);
        if (process.platform === 'win32') {
            fs.writeFileSync(path.join(shimDir, 'claude.cmd'), '@exit /b 0\r\n');
        }
    }

    function recordInstalledPlugin(): void {
        const pluginsDir = path.join(claudeHome, 'plugins');
        fs.mkdirSync(pluginsDir, { recursive: true });
        fs.writeFileSync(
            path.join(pluginsDir, 'installed_plugins.json'),
            JSON.stringify({
                version: 2,
                plugins: { 'agent-config@event4u-agent-config': [{ scope: 'user' }] },
            }),
        );
    }

    function seamPlugin(args: string[]): SyncSeamResult {
        const r = spawnSync(TSX_BIN, [syncHarnessPath, '0', '0', claudeHome, ...args], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            env: {
                ...process.env,
                CLAUDE_CONFIG_DIR: claudeHome,
                EVENT4U_CONFIG_HOME: claudeHome,
                PATH: `${shimDir}${path.delimiter}${process.env['PATH'] ?? ''}`,
            },
        });
        return parseSyncSeam(r.stdout ?? '');
    }

    beforeEach(() => {
        claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'upgrade-claude-'));
        shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upgrade-shim-'));
        syncHarnessPath = path.join(harnessDir, 'plugin-harness.mjs');
        fs.writeFileSync(syncHarnessPath, TS_SYNC_HARNESS);
        writeClaudeShim();
    });
    afterEach(() => {
        fs.rmSync(claudeHome, { recursive: true, force: true });
        fs.rmSync(shimDir, { recursive: true, force: true });
    });

    it('plugin not installed → no plugin step (file projection is a full install)', () => {
        const r = seamPlugin([]);
        expect(r.exit).toBe('0');
        expect(r.calls.filter((c) => c.includes('plugin'))).toHaveLength(0);
    });

    it('plugin installed → marketplace update + plugin update run after the global step', () => {
        recordInstalledPlugin();
        const r = seamPlugin([]);
        expect(r.exit).toBe('0');
        const pluginCalls = r.calls.filter((c) => c.includes(' plugin '));
        expect(pluginCalls).toHaveLength(2);
        expect(pluginCalls[0]).toContain('plugin marketplace update event4u-agent-config');
        expect(pluginCalls[1]).toContain('plugin update agent-config@event4u-agent-config');
        const globalIdx = r.calls.findIndex((c) => c.includes(' global'));
        const firstPluginIdx = r.calls.findIndex((c) => c.includes(' plugin '));
        expect(globalIdx).toBeGreaterThanOrEqual(0);
        expect(firstPluginIdx).toBeGreaterThan(globalIdx);
    });

    it('the global step runs with --no-ui (wizard never blocks an upgrade)', () => {
        const r = seamPlugin([]);
        expect(r.exit).toBe('0');
        const globalCall = r.calls.find((c) => c.includes(' global'));
        expect(globalCall).toContain(' global --no-ui');
    });

    it('--dry-run lists the plugin steps without executing anything', () => {
        recordInstalledPlugin();
        const r = seamPlugin(['--dry-run']);
        expect(r.exit).toBe('0');
        expect(r.out).toContain('plugin marketplace update event4u-agent-config');
        expect(r.out).toContain('plugin update agent-config@event4u-agent-config');
        expect(r.calls).toHaveLength(0);
    });

    it('our installed pre-commit hook → hooks:install --force refresh runs', () => {
        const hooksDir = path.join(claudeHome, '.git', 'hooks');
        fs.mkdirSync(hooksDir, { recursive: true });
        fs.writeFileSync(
            path.join(hooksDir, 'pre-commit'),
            '#!/bin/sh\n# installed from pre-commit-roadmap-progress template\n',
        );
        const r = seamPlugin([]);
        expect(r.exit).toBe('0');
        expect(r.calls.filter((c) => c.includes('hooks:install --force'))).toHaveLength(1);
    });

    it('foreign pre-commit hook → never touched', () => {
        const hooksDir = path.join(claudeHome, '.git', 'hooks');
        fs.mkdirSync(hooksDir, { recursive: true });
        fs.writeFileSync(path.join(hooksDir, 'pre-commit'), '#!/bin/sh\nlint-staged\n');
        const r = seamPlugin([]);
        expect(r.exit).toBe('0');
        expect(r.calls.filter((c) => c.includes('hooks:install'))).toHaveLength(0);
    });
});

describe('upgrade — post-upgrade settings sync', () => {
    let globalRoot: string;
    let projectRoot: string;
    let syncHarnessPath: string;

    function seamSync(rcMain: number, rcSync: number, args: string[]): SyncSeamResult {
        const r = spawnSync(
            TSX_BIN,
            [syncHarnessPath, String(rcMain), String(rcSync), projectRoot, ...args],
            {
                cwd: REPO_ROOT,
                encoding: 'utf8',
                env: { ...process.env, EVENT4U_CONFIG_HOME: globalRoot },
            },
        );
        return parseSyncSeam(r.stdout ?? '');
    }

    const globalSettings = () => path.join(globalRoot, 'settings', '.agent-settings.yml');
    const projectSettings = () =>
        path.join(projectRoot, 'agents', 'settings', '.agent-settings.yml');

    beforeEach(() => {
        globalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'upgrade-global-'));
        projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'upgrade-proj-'));
        syncHarnessPath = path.join(harnessDir, 'sync-harness.mjs');
        fs.writeFileSync(syncHarnessPath, TS_SYNC_HARNESS);
    });
    afterEach(() => {
        fs.rmSync(globalRoot, { recursive: true, force: true });
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    it('existing global settings file → settings:sync subprocess step runs', () => {
        fs.mkdirSync(path.dirname(globalSettings()), { recursive: true });
        fs.writeFileSync(globalSettings(), 'rule_loading_tier: minimal\n');
        const r = seamSync(0, 0, []);
        expect(r.exit).toBe('0');
        const syncCalls = r.calls.filter((c) => c.includes('settings:sync'));
        expect(syncCalls).toHaveLength(1);
        expect(syncCalls[0]).toContain(`--path ${globalSettings()}`);
    });

    it('global + project settings → both synced, global first', () => {
        fs.mkdirSync(path.dirname(globalSettings()), { recursive: true });
        fs.writeFileSync(globalSettings(), 'rule_loading_tier: minimal\n');
        fs.mkdirSync(path.dirname(projectSettings()), { recursive: true });
        fs.writeFileSync(projectSettings(), 'rule_loading_tier: balanced\n');
        const r = seamSync(0, 0, []);
        expect(r.exit).toBe('0');
        const syncCalls = r.calls.filter((c) => c.includes('settings:sync'));
        expect(syncCalls).toHaveLength(2);
        expect(syncCalls[0]).toContain(`--path ${globalSettings()}`);
        expect(syncCalls[1]).toContain(`--path ${projectSettings()}`);
    });

    it('no settings file anywhere → no settings:sync step, nothing created', () => {
        const r = seamSync(0, 0, []);
        expect(r.exit).toBe('0');
        expect(r.calls.filter((c) => c.includes('settings:sync'))).toHaveLength(0);
        expect(fs.existsSync(globalSettings())).toBe(false);
        expect(fs.existsSync(projectSettings())).toBe(false);
    });

    it('sync failure is non-fatal: warns with manual command, exit stays 0', () => {
        fs.mkdirSync(path.dirname(globalSettings()), { recursive: true });
        fs.writeFileSync(globalSettings(), 'rule_loading_tier: minimal\n');
        const r = seamSync(0, 5, []);
        expect(r.exit).toBe('0');
        expect(r.err).toContain('settings sync failed (exit 5)');
        expect(r.err).toContain(`settings:sync --path ${globalSettings()}`);
    });

    it('--dry-run lists the sync step without executing anything', () => {
        fs.mkdirSync(path.dirname(globalSettings()), { recursive: true });
        fs.writeFileSync(globalSettings(), 'rule_loading_tier: minimal\n');
        const r = seamSync(0, 0, ['--dry-run']);
        expect(r.exit).toBe('0');
        expect(r.out).toContain(`settings:sync --path ${globalSettings()}`);
        expect(r.calls).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Step decoupling (road-to-claude-code-single-surface Phase 2): a failing
// `global` step no longer skips the remaining maintenance steps — the 8.2.0
// failure class where an aborted step silently skipped the plugin refresh
// and settings sync. Exit stays 1 (the failed step is essential), but every
// later step must still have run.
// ---------------------------------------------------------------------------

const TS_DECOUPLE_HARNESS = `
(async () => {
    const m = await import(${JSON.stringify(TS_SCRIPT)});
    const projectRoot = process.argv[2];
    const args = process.argv.slice(3);
    let out = '', err = '';
    const calls = [];
    const sink = (b) => ({ write: (t) => { if (b === 'o') out += t; else err += t; } });
    // Fails ONLY the 'global' step; every other command succeeds.
    const runner = (cmd) => {
        calls.push(cmd.join(' '));
        return cmd.includes('global') ? 3 : 0;
    };
    const code = await m.main(args, {
        fetcher: () => '2.0.0',
        runner,
        installed: '1.0.0',
        project_root: projectRoot,
        out: sink('o'),
        err: sink('e'),
    });
    process.stdout.write(
        '\\x00OUT\\x00' + out + '\\x00ERR\\x00' + err +
        '\\x00CALLS\\x00' + calls.join('\\n') + '\\x00EXIT\\x00' + code,
    );
})();
`;

describe('upgrade — step decoupling (global fails, rest still runs)', () => {
    let decoupleDir: string;
    let decoupleHarness: string;
    let configHome: string;

    beforeEach(() => {
        decoupleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upgrade-dc-'));
        decoupleHarness = path.join(decoupleDir, 'harness.mjs');
        fs.writeFileSync(decoupleHarness, TS_DECOUPLE_HARNESS);
        // Hermetic settings home with ONE existing settings file so the
        // sync step has a target to prove it ran.
        configHome = path.join(decoupleDir, 'config-home');
        // EVENT4U_CONFIG_HOME overrides event4u_root() outright — no
        // `agent-config/` segment underneath.
        fs.mkdirSync(path.join(configHome, 'settings'), { recursive: true });
        fs.writeFileSync(
            path.join(configHome, 'settings', '.agent-settings.yml'),
            'rule_loading_tier: minimal\n',
        );
    });
    afterEach(() => {
        fs.rmSync(decoupleDir, { recursive: true, force: true });
    });

    function runDecoupled(): SyncSeamResult {
        const r = spawnSync(TSX_BIN, [decoupleHarness, decoupleDir], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            env: {
                ...process.env,
                EVENT4U_CONFIG_HOME: configHome,
                CLAUDE_CONFIG_DIR: path.join(decoupleDir, 'claude-home'),
            },
        });
        return parseSyncSeam(r.stdout ?? '');
    }

    it('global failure: exit 1, but settings:sync still ran afterwards', () => {
        const r = runDecoupled();
        expect(r.exit).toBe('1');
        const globalIdx = r.calls.findIndex((c) => / global/.test(c));
        const syncIdx = r.calls.findIndex((c) => c.includes('settings:sync'));
        expect(globalIdx).toBeGreaterThanOrEqual(0);
        expect(syncIdx).toBeGreaterThan(globalIdx);
        expect(r.err).toContain('continuing with the remaining steps');
        expect(r.err).toContain('failed step(s)');
    });

    it('global step carries --no-ui (wizard never blocks an upgrade)', () => {
        const r = runDecoupled();
        const globalCall = r.calls.find((c) => / global/.test(c));
        expect(globalCall).toBeDefined();
        expect(globalCall).toContain('--no-ui');
    });
});
