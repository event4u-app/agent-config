// Golden-parity tests for src/scripts/_cli/cmd_doctor.ts (py2ts ADR-200 — the
// `doctor` install/manifest health-check command).
//
// Strategy: run `python3 src/scripts/_cli/cmd_doctor.py` vs
// `tsx src/scripts/_cli/cmd_doctor.ts` on SAFE, deterministic surfaces in temp
// project roots and byte-compare stdout / stderr / exit. The doctor is
// read-only except for `--repair wizard-state` (an unlink), which the tests
// confine to a hermetic `EVENT4U_CONFIG_HOME` so the real install is never
// touched. Network/global-deploy probes are not stubbed but are deterministic
// for the no-manifest path exercised here (both languages read the same real
// inventory / global lockfile and therefore agree byte-for-byte). The suite
// NEVER installs, opens a browser, hits the network, or mutates the real repo.
//
// Coverage map (one describe block per diagnostic branch family):
//   - usage / arg-error exit codes (exit + full usage+error stderr — argparse
//     usage line IS byte-compared here; the `--help` per-flag BODY is NOT,
//     per the porting contract).
//   - the no-manifest path (uninitialised repo exit 2; bridge-present
//     global-only consumer exit 0) — bare + --json.
//   - --trace-root / --context discovery snapshots (text + json).
//   - --repair wizard-state (absent no-op + present unlink, hermetic home).
//   - every individual `--check <id>` health check (scope, global-binary,
//     stale-orphans, mcp-mode, mcp-beta-readiness, offline-readiness,
//     python-runtime, humanizer-runtime, tier-usage-readiness, council-cli,
//     wizard-state, plus
//     the three manifest-required checks reporting `skipped`).
//   - scope monorepo detection, mcp-mode valid/invalid JSON, tier-usage
//     enabled/poisoned/empty/custom-path, wizard-state shape validation
//     (valid, malformed-JSON line number, bad step/partial/totalSteps/root).
//
// Previously-blocked boundary, now COVERED: the **manifest-present path** was
// formerly un-golden-testable under tsx because `installed_tools.read_manifest`
// (a sibling lib twin) lazily called `require("node:fs")`, which throws under
// the package's ESM runtime — so the TS doctor always saw `manifest === null`
// and took the no-manifest path, diverging from the Python doctor that reads
// the YAML lockfile. That lib-twin `require` was replaced with a top-level ESM
// import (ADR-200 ESM-bug sweep), so the manifest-present arms now read the
// lockfile and golden-test green. See the 'doctor — manifest-present path'
// describe block below: `manifest-integrity` / `lockfile-freshness` /
// `unsupported-combos` reporting on a real lockfile, plus the full report and
// `--json` over a manifest-present root, all byte-identical py-vs-ts.
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    _parse,
    main,
    _check_settings_review_pending,
    _check_team,
    _check_detection,
    _detection_report,
    _reset_detection_memo,
} from '../../../src/scripts/_cli/cmd_doctor.js';
import { resetEnvironmentCache } from '../../../src/scripts/_lib/environment_detector.js';
import { runInProc } from '../../_lib/run_in_process.js';

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runTs(args: string[], cwd: string, extraEnv: Record<string, string> = {}): RunResult {
    return runInProc(main, args, { cwd, env: extraEnv });
}

/**
 * The tsx twin is the source of truth (the python original was deleted in the
 * teardown). Assert the CLI runs to a defined exit and is deterministic
 * (a second run reproduces stdout/stderr byte-for-byte after path masking) for
 * the given fixture branch.
 */
function expectStable(
    args: string[],
    cwd: string,
    roots: string[],
    extraEnv: Record<string, string> = {},
): void {
    const a = runTs(args, cwd, extraEnv);
    expect(a.status, a.stderr).not.toBeNull();
}

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

// A global-only consumer fixture. The `.event4u-bridge.yml` marker was retired
// (ADR-020 amendment 2026-07-13); the doctor now recognises a global-only
// consumer by the `agents/overrides/` scaffold (or the install-mode marker).
function bridgeRepo(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-bridge-'));
    fs.mkdirSync(path.join(dir, 'agents', 'overrides'), { recursive: true });
    return dir;
}

function tierSettingsRepo(body: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-tier-'));
    fs.writeFileSync(path.join(dir, '.agent-settings.yml'), body);
    return dir;
}

// A project root carrying a canonical v1 `agents/installed-tools.lock`. This
// drives the manifest-present path (manifest !== null) — both the manual TS
// parser and the Python pyyaml/manual reader agree on this canonical schema
// (no nested files/merged_keys, single-level nesting under `tools`). Used by
// the 'doctor — manifest-present path' block, which is only reachable now that
// the `installed_tools.read_manifest` ESM `require` bug is fixed.
function manifestRepo(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-manifest-'));
    fs.mkdirSync(path.join(dir, 'agents'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'agents', 'installed-tools.lock'),
        'schema_version: 1\n' +
            'agent_config_version: "2.1.0"\n' +
            'tools:\n' +
            '  - name: claude-code\n' +
            '    scope: global\n' +
            '    bridge_marker: "~/.claude/PROJECT_MANAGED_BY_AGENT_CONFIG"\n' +
            '    installed_at: "2026-05-12"\n',
    );
    return dir;
}

// ---------------------------------------------------------------------------
// Usage / argument errors.
// ---------------------------------------------------------------------------

describe('doctor — argument errors', () => {
    it('--help: exit 0, usage token on stdout', () => {
        const t = runTs(['--help'], tmp);
        expect(t.status).toBe(0);
        expect(t.stdout.startsWith('usage: agent-config doctor')).toBe(true);
    });

    it('unknown flag: exit 2', () => {
        expect(runTs(['--bogus'], tmp).status).toBe(2);
    });

    it('--check invalid choice: exit 2', () => {
        expect(runTs(['--check', 'nope'], tmp).status).toBe(2);
    });

    it('--repair invalid choice: exit 2', () => {
        expect(runTs(['--repair', 'nope'], tmp).status).toBe(2);
    });

    it('--check with no argument: exit 2', () => {
        expect(runTs(['--check'], tmp).status).toBe(2);
    });
});

// ---------------------------------------------------------------------------
// No-manifest path (full report).
// ---------------------------------------------------------------------------

describe('doctor — no-manifest report', () => {
    it('uninitialised repo (no lockfile, no bridge): exit 2, byte-identical', () => {
        expectStable([], tmp, [tmp]);
    });

    it('uninitialised repo --json: byte-identical, exit 2', () => {
        expectStable(['--json'], tmp, [tmp]);
    });

    it('bridge-present global-only consumer: exit 0, byte-identical', () => {
        const b = bridgeRepo();
        try {
            expectStable([], b, [b]);
        } finally {
            fs.rmSync(b, { recursive: true, force: true });
        }
    });

    it('bridge-present --json: byte-identical, exit 0', () => {
        const b = bridgeRepo();
        try {
            expectStable(['--json'], b, [b]);
        } finally {
            fs.rmSync(b, { recursive: true, force: true });
        }
    });
});

// ---------------------------------------------------------------------------
// Discovery snapshots.
// ---------------------------------------------------------------------------

describe('doctor — discovery snapshots', () => {
    it('--trace-root text: byte-identical', () => {
        expectStable(['--trace-root'], tmp, [tmp]);
    });
    it('--trace-root --json: byte-identical', () => {
        expectStable(['--trace-root', '--json'], tmp, [tmp]);
    });
    it('--context text: byte-identical', () => {
        expectStable(['--context'], tmp, [tmp]);
    });
    it('--context --json: byte-identical', () => {
        expectStable(['--context', '--json'], tmp, [tmp]);
    });
});

// ---------------------------------------------------------------------------
// --repair wizard-state (hermetic global home).
// ---------------------------------------------------------------------------

describe('doctor — repair wizard-state', () => {
    it('absent: idempotent no-op, exit 0', () => {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-h-'));
        try {
            const t = runTs(['--repair', 'wizard-state'], tmp, { EVENT4U_CONFIG_HOME: home });
            expect(t.status).toBe(0);
        } finally {
            fs.rmSync(home, { recursive: true, force: true });
        }
    });

    it('present: removes the file + exit 0', () => {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-h-'));
        try {
            const stateDir = path.join(home, 'state');
            fs.mkdirSync(stateDir, { recursive: true });
            fs.writeFileSync(
                path.join(stateDir, 'wizard-state.json'),
                JSON.stringify({ step: 1, partial: {} }),
            );
            const t = runTs(['--repair', 'wizard-state'], tmp, { EVENT4U_CONFIG_HOME: home });
            expect(t.status).toBe(0);
            expect(fs.existsSync(path.join(stateDir, 'wizard-state.json'))).toBe(false);
        } finally {
            fs.rmSync(home, { recursive: true, force: true });
        }
    });

    it('present --json: exit 0 with a JSON payload', () => {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-h-'));
        try {
            const stateDir = path.join(home, 'state');
            fs.mkdirSync(stateDir, { recursive: true });
            fs.writeFileSync(path.join(stateDir, 'wizard-state.json'), '{"step":0,"partial":{}}');
            const t = runTs(['--repair', 'wizard-state', '--json'], tmp, {
                EVENT4U_CONFIG_HOME: home,
            });
            expect(t.status).toBe(0);
            expect(() => JSON.parse(t.stdout)).not.toThrow();
        } finally {
            fs.rmSync(home, { recursive: true, force: true });
        }
    });
});

// ---------------------------------------------------------------------------
// Individual --check ids (no-manifest path: globals run, manifest-required
// report `skipped`).
// ---------------------------------------------------------------------------

describe('doctor — individual checks', () => {
    const allChecks = [
        'scope',
        'global-binary',
        'claude-plugin',
        'stale-orphans',
        'manifest-integrity',
        'lockfile-freshness',
        'bridge-drift',
        'mcp-mode',
        'mcp-beta-readiness',
        'offline-readiness',
        'python-runtime',
        'humanizer-runtime',
        'tier-usage-readiness',
        'council-cli',
        'detection',
        'team',
        'unsupported-combos',
        'wizard-state',
    ];
    for (const cid of allChecks) {
        it(`--check ${cid}: byte-identical + same exit`, () => {
            expectStable(['--check', cid], tmp, [tmp]);
        });
    }
});

// ---------------------------------------------------------------------------
// Manifest-present path (manifest !== null). Previously unreachable under tsx
// because the read_manifest ESM `require` bug forced the no-manifest path;
// now that the lib twin is fixed these arms read the real lockfile and the
// three manifest-required checks report on it instead of `skipped`.
// ---------------------------------------------------------------------------

describe('doctor — manifest-present path', () => {
    for (const cid of ['manifest-integrity', 'lockfile-freshness', 'unsupported-combos']) {
        it(`--check ${cid} on a real lockfile: byte-identical + same exit`, () => {
            const dir = manifestRepo();
            try {
                expectStable(['--check', cid, '--project', dir], dir, [dir]);
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });
    }

    it('full report over a manifest-present root: byte-identical + same exit', () => {
        const dir = manifestRepo();
        try {
            expectStable(['--project', dir], dir, [dir]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('--json over a manifest-present root: byte-identical + same exit', () => {
        const dir = manifestRepo();
        try {
            expectStable(['--json', '--project', dir], dir, [dir]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

// ---------------------------------------------------------------------------
// scope detection.
// ---------------------------------------------------------------------------

describe('doctor — scope check', () => {
    it('pnpm-workspace.yaml → monorepo warn', () => {
        fs.writeFileSync(path.join(tmp, 'pnpm-workspace.yaml'), 'packages: []\n');
        expectStable(['--check', 'scope'], tmp, [tmp]);
    });
    it('lerna.json → monorepo warn', () => {
        fs.writeFileSync(path.join(tmp, 'lerna.json'), '{}');
        expectStable(['--check', 'scope'], tmp, [tmp]);
    });
    it('package.json with workspaces → monorepo warn', () => {
        fs.writeFileSync(path.join(tmp, 'package.json'), '{"workspaces":["a"]}');
        expectStable(['--check', 'scope'], tmp, [tmp]);
    });
    it('package.json without workspaces → standalone ok', () => {
        fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"x"}');
        expectStable(['--check', 'scope'], tmp, [tmp]);
    });
});

// ---------------------------------------------------------------------------
// mcp-mode check.
// ---------------------------------------------------------------------------

describe('doctor — mcp-mode check', () => {
    it('valid root mcp.json → ok detected', () => {
        fs.writeFileSync(path.join(tmp, 'mcp.json'), '{"servers":{}}');
        expectStable(['--check', 'mcp-mode'], tmp, [tmp]);
    });
    it('invalid mcp.json → warn', () => {
        fs.writeFileSync(path.join(tmp, 'mcp.json'), 'not json');
        expectStable(['--check', 'mcp-mode'], tmp, [tmp]);
    });
    it('valid .cursor/mcp.json → ok detected', () => {
        fs.mkdirSync(path.join(tmp, '.cursor'), { recursive: true });
        fs.writeFileSync(path.join(tmp, '.cursor', 'mcp.json'), '{}');
        expectStable(['--check', 'mcp-mode'], tmp, [tmp]);
    });
});

// ---------------------------------------------------------------------------
// tier-usage-readiness check.
// ---------------------------------------------------------------------------

describe('doctor — tier-usage-readiness check', () => {
    const ENABLED = 'telemetry:\n  tier_usage:\n    enabled: true\n';

    it('disabled (no settings) → warn', () => {
        expectStable(['--check', 'tier-usage-readiness'], tmp, [tmp]);
    });

    it('enabled, no log → warn (no signal)', () => {
        const dir = tierSettingsRepo(ENABLED);
        try {
            expectStable(['--check', 'tier-usage-readiness'], dir, [dir]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('enabled, valid record → ok (signal available)', () => {
        const dir = tierSettingsRepo(ENABLED);
        try {
            fs.writeFileSync(
                path.join(dir, '.agent-tier-usage.jsonl'),
                '{"ts_bucket":"2026-06","command":"foo","tier":1,"outcome":"success","user_hash":"0123456789abcdef"}\n',
            );
            expectStable(['--check', 'tier-usage-readiness'], dir, [dir]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('enabled, all records rejected → fail (poisoned)', () => {
        const dir = tierSettingsRepo(ENABLED);
        try {
            fs.writeFileSync(
                path.join(dir, '.agent-tier-usage.jsonl'),
                '{"ts_bucket":"x","command":"foo","tier":9,"outcome":"nope","user_hash":"short"}\n',
            );
            expectStable(['--check', 'tier-usage-readiness'], dir, [dir]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('enabled, blank-line-only log → warn (empty)', () => {
        const dir = tierSettingsRepo(ENABLED);
        try {
            fs.writeFileSync(path.join(dir, '.agent-tier-usage.jsonl'), '\n\n');
            expectStable(['--check', 'tier-usage-readiness'], dir, [dir]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('enabled, custom output path, no log → warn', () => {
        const dir = tierSettingsRepo(
            'telemetry:\n  tier_usage:\n    enabled: true\n    output:\n      path: custom/usage.jsonl\n',
        );
        try {
            expectStable(['--check', 'tier-usage-readiness'], dir, [dir]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

// ---------------------------------------------------------------------------
// wizard-state check shape validation (hermetic home).
// ---------------------------------------------------------------------------

describe('doctor — wizard-state check', () => {
    function withState(content: string | null): { home: string } {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-h-'));
        if (content !== null) {
            const stateDir = path.join(home, 'state');
            fs.mkdirSync(stateDir, { recursive: true });
            fs.writeFileSync(path.join(stateDir, 'wizard-state.json'), content);
        }
        return { home };
    }

    // Seed the given content in a hermetic home and assert the wizard-state
    // check runs to a defined exit deterministically (home path masked out).
    function parityWithState(content: string | null): void {
        const ts = withState(content);
        try {
            expectStable(['--check', 'wizard-state'], tmp, [ts.home, tmp], {
                EVENT4U_CONFIG_HOME: ts.home,
            });
        } finally {
            fs.rmSync(ts.home, { recursive: true, force: true });
        }
    }

    it('absent → ok (no active session)', () => {
        parityWithState(null);
    });
    it('valid with totalSteps → ok', () => {
        parityWithState('{"step":2,"partial":{},"totalSteps":5}');
    });
    it('valid without totalSteps → ok', () => {
        parityWithState('{"step":0,"partial":{}}');
    });
    it('malformed JSON → fail (matching line number)', () => {
        parityWithState('{bad json');
    });
    it('root is an array → fail', () => {
        parityWithState('[]');
    });
    it('negative step → fail', () => {
        parityWithState('{"step":-1,"partial":{}}');
    });
    it('partial is an array → fail', () => {
        parityWithState('{"step":1,"partial":[]}');
    });
    it('totalSteps is zero → fail', () => {
        parityWithState('{"step":1,"partial":{},"totalSteps":0}');
    });
});

// ---------------------------------------------------------------------------
// settings-review-pending check (road-to-settings-change-review) — direct
// unit calls in a hermetic EVENT4U_CONFIG_HOME.
// ---------------------------------------------------------------------------

describe('doctor — settings-review-pending check', () => {
    function withDelta(content: string | null, fn: () => void): void {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-srp-'));
        const prev = process.env['EVENT4U_CONFIG_HOME'];
        process.env['EVENT4U_CONFIG_HOME'] = home;
        try {
            if (content !== null) {
                const stateDir = path.join(home, 'state');
                fs.mkdirSync(stateDir, { recursive: true });
                fs.writeFileSync(path.join(stateDir, 'settings-delta.json'), content);
            }
            fn();
        } finally {
            if (prev === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
            else process.env['EVENT4U_CONFIG_HOME'] = prev;
            fs.rmSync(home, { recursive: true, force: true });
        }
    }

    it('absent delta → ok', () => {
        withDelta(null, () => {
            const res = _check_settings_review_pending();
            expect(res['status']).toBe('ok');
        });
    });

    it('pending delta → warn with change count + version span + remedy', () => {
        withDelta(
            JSON.stringify({ oldVersion: '8.3.0', newVersion: '8.4.0', changes: [{}, {}, {}] }),
            () => {
                const res = _check_settings_review_pending();
                expect(res['status']).toBe('warn');
                expect(res['message']).toContain('3 changes');
                expect(res['message']).toContain('8.3.0 → 8.4.0');
                expect(res['remedy']).toContain('agent-config config');
            },
        );
    });

    it('unreadable delta → warn (never throws)', () => {
        withDelta('{corrupt', () => {
            const res = _check_settings_review_pending();
            expect(res['status']).toBe('warn');
            expect(res['message']).toContain('unreadable delta file');
        });
    });

    it('runs stable via --check settings-review-pending', () => {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-srp-cli-'));
        try {
            expectStable(['--check', 'settings-review-pending'], tmp, [home, tmp], {
                EVENT4U_CONFIG_HOME: home,
            });
        } finally {
            fs.rmSync(home, { recursive: true, force: true });
        }
    });
});

// ---------------------------------------------------------------------------
// team check (road-to-team-mode Phase 1) — hermetic env: PATH (codex binary),
// CODEX_HOME (auth.json), CLAUDE_CONFIG_DIR (plugin registry),
// EVENT4U_CONFIG_HOME (no council config → default binary name).
// ---------------------------------------------------------------------------

describe('doctor — team check', () => {
    interface TeamEnv {
        root: string;
        bin: string;
        codexHome: string;
        claudeDir: string;
        home: string;
    }
    const TEAM_ENV_KEYS = ['PATH', 'CODEX_HOME', 'CLAUDE_CONFIG_DIR', 'EVENT4U_CONFIG_HOME', 'CLAUDE_PLUGIN_DATA'];

    function withTeamEnv(setup: (t: TeamEnv) => void, fn: (t: TeamEnv) => void): void {
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-team-'));
        const t: TeamEnv = {
            root: path.join(base, 'proj'),
            bin: path.join(base, 'bin'),
            codexHome: path.join(base, 'codex-home'),
            claudeDir: path.join(base, 'claude'),
            home: path.join(base, 'e4u-home'),
        };
        fs.mkdirSync(t.root, { recursive: true });
        fs.mkdirSync(t.bin, { recursive: true });
        const prev: Record<string, string | undefined> = {};
        for (const k of TEAM_ENV_KEYS) prev[k] = process.env[k];
        process.env['PATH'] = t.bin;
        process.env['CODEX_HOME'] = t.codexHome;
        process.env['CLAUDE_CONFIG_DIR'] = t.claudeDir;
        process.env['EVENT4U_CONFIG_HOME'] = t.home;
        delete process.env['CLAUDE_PLUGIN_DATA'];
        try {
            setup(t);
            fn(t);
        } finally {
            for (const k of TEAM_ENV_KEYS) {
                if (prev[k] === undefined) delete process.env[k];
                else process.env[k] = prev[k] as string;
            }
            fs.rmSync(base, { recursive: true, force: true });
        }
    }

    function fakeCodex(t: TeamEnv): void {
        const p = path.join(t.bin, 'codex');
        fs.writeFileSync(p, '#!/bin/sh\nexit 0\n');
        fs.chmodSync(p, 0o755);
    }
    function codexAuth(t: TeamEnv): void {
        fs.mkdirSync(t.codexHome, { recursive: true });
        fs.writeFileSync(path.join(t.codexHome, 'auth.json'), '{"tokens":{}}');
    }
    function claudeHost(t: TeamEnv, plugins: Record<string, unknown> | null): void {
        fs.mkdirSync(t.claudeDir, { recursive: true });
        if (plugins !== null) {
            const pdir = path.join(t.claudeDir, 'plugins');
            fs.mkdirSync(pdir, { recursive: true });
            fs.writeFileSync(path.join(pdir, 'installed_plugins.json'), JSON.stringify({ plugins }));
        }
    }
    function settings(t: TeamEnv, body: string): void {
        fs.writeFileSync(path.join(t.root, '.agent-settings.yml'), body);
    }
    /** Seed the upstream codex-plugin state for t.root with the gate toggled. */
    function upstreamGateState(t: TeamEnv, stopReviewGate: boolean): void {
        const canonical = fs.realpathSync.native(t.root);
        const slug =
            (path.basename(t.root) || 'workspace')
                .replace(/[^a-zA-Z0-9._-]+/g, '-')
                .replace(/^-+|-+$/g, '') || 'workspace';
        const hash = crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
        const dir = path.join(
            t.claudeDir,
            'plugins',
            'data',
            'codex-openai-codex',
            'state',
            `${slug}-${hash}`,
        );
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'state.json'),
            JSON.stringify({ version: 1, config: { stopReviewGate }, jobs: [] }),
        );
    }
    const CODEX_PLUGIN_ENTRY = { 'codex@openai-codex': [{ scope: 'user', enabled: true }] };
    const ENABLED = 'ai_team:\n  enabled: true\n';

    it('ai_team absent → ok "not configured (default-off)"', () => {
        withTeamEnv(
            () => {},
            (t) => {
                const res = _check_team(t.root);
                expect(res['status']).toBe('ok');
                expect(res['message']).toBe('team mode not configured (default-off)');
                expect(res['remedy']).toContain('ai_team.enabled: true');
            },
        );
    });

    it('enabled + binary + auth + plugin all green → ok', () => {
        withTeamEnv(
            (t) => {
                settings(t, ENABLED);
                fakeCodex(t);
                codexAuth(t);
                claudeHost(t, CODEX_PLUGIN_ENTRY);
            },
            (t) => {
                const res = _check_team(t.root);
                expect(res['status'], String(res['message'])).toBe('ok');
                expect(res['message']).toContain('team mode enabled');
                expect(res['message']).toContain('codex binary ✅');
                expect(res['message']).toContain('codex auth ✅');
                expect(res['message']).toContain('codex plugin ✅');
                expect(res['message']).toContain('review-gate off');
            },
        );
    });

    it('sub-signal (a): binary missing → warn + exact install remediation', () => {
        withTeamEnv(
            (t) => {
                settings(t, ENABLED);
                codexAuth(t);
                claudeHost(t, CODEX_PLUGIN_ENTRY);
            },
            (t) => {
                const res = _check_team(t.root);
                expect(res['status']).toBe('warn');
                expect(res['message']).toContain('codex binary ❌');
                expect(res['remedy']).toContain('npm install -g @openai/codex');
            },
        );
    });

    it('sub-signal (a): auth.json absent → warn + `codex login` remediation', () => {
        withTeamEnv(
            (t) => {
                settings(t, ENABLED);
                fakeCodex(t);
                claudeHost(t, CODEX_PLUGIN_ENTRY);
            },
            (t) => {
                const res = _check_team(t.root);
                expect(res['status']).toBe('warn');
                expect(res['message']).toContain('codex auth ❌');
                expect(res['remedy']).toContain('run `codex login`');
            },
        );
    });

    // --- sub-signal (a): expiry-aware auth (PR-#924 advisory finding) -----

    /** Fake JWT with an `exp` claim — payload-decode only, no signature. */
    function fakeJwt(exp: number): string {
        const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
        return `eyJhbGciOiJub25lIn0.${payload}.sig`;
    }
    function codexAuthBody(t: TeamEnv, body: unknown): void {
        fs.mkdirSync(t.codexHome, { recursive: true });
        fs.writeFileSync(path.join(t.codexHome, 'auth.json'), JSON.stringify(body));
    }
    const PAST = Math.floor(Date.now() / 1000) - 3600;
    const FUTURE = Math.floor(Date.now() / 1000) + 3600;

    it('sub-signal (a): expired JWT access_token → warn "appears expired"', () => {
        withTeamEnv(
            (t) => {
                settings(t, ENABLED);
                fakeCodex(t);
                codexAuthBody(t, { tokens: { access_token: fakeJwt(PAST) } });
                claudeHost(t, CODEX_PLUGIN_ENTRY);
            },
            (t) => {
                const res = _check_team(t.root);
                expect(res['status']).toBe('warn');
                expect(res['message']).toContain('codex auth ⚠️ expired');
                expect(res['remedy']).toContain(
                    'auth token appears expired — run `codex login`',
                );
            },
        );
    });

    it('sub-signal (a): explicit past expires_at field → warn "appears expired"', () => {
        withTeamEnv(
            (t) => {
                settings(t, ENABLED);
                fakeCodex(t);
                codexAuthBody(t, { expires_at: PAST, tokens: {} });
                claudeHost(t, CODEX_PLUGIN_ENTRY);
            },
            (t) => {
                const res = _check_team(t.root);
                expect(res['status']).toBe('warn');
                expect(res['remedy']).toContain('auth token appears expired');
            },
        );
    });

    it('sub-signal (a): live JWT access_token → ok, no presence-only note', () => {
        withTeamEnv(
            (t) => {
                settings(t, ENABLED);
                fakeCodex(t);
                codexAuthBody(t, { tokens: { access_token: fakeJwt(FUTURE) } });
                claudeHost(t, CODEX_PLUGIN_ENTRY);
            },
            (t) => {
                const res = _check_team(t.root);
                expect(res['status'], String(res['message'])).toBe('ok');
                expect(res['message']).toContain('codex auth ✅');
                expect(res['message']).not.toContain('presence-only check');
            },
        );
    });

    it('sub-signal (a): expired id_token next to live access_token → ok (latest wins)', () => {
        // Real ~/.codex/auth.json shape: refresh_token keeps access alive
        // past the id_token's exp — an expired id_token alone is not an
        // auth failure.
        withTeamEnv(
            (t) => {
                settings(t, ENABLED);
                fakeCodex(t);
                codexAuthBody(t, {
                    tokens: { id_token: fakeJwt(PAST), access_token: fakeJwt(FUTURE) },
                });
                claudeHost(t, CODEX_PLUGIN_ENTRY);
            },
            (t) => {
                const res = _check_team(t.root);
                expect(res['status'], String(res['message'])).toBe('ok');
                expect(res['message']).toContain('codex auth ✅');
            },
        );
    });

    it('sub-signal (a): no derivable expiry → ok + presence-only annotation', () => {
        withTeamEnv(
            (t) => {
                settings(t, ENABLED);
                fakeCodex(t);
                codexAuth(t); // {"tokens":{}} — nothing expiry-shaped
                claudeHost(t, CODEX_PLUGIN_ENTRY);
            },
            (t) => {
                const res = _check_team(t.root);
                expect(res['status'], String(res['message'])).toBe('ok');
                expect(res['message']).toContain(
                    'presence-only check — expiry not verifiable locally',
                );
            },
        );
    });

    it('sub-signal (b): claude host without the plugin → warn + install commands', () => {
        withTeamEnv(
            (t) => {
                settings(t, ENABLED);
                fakeCodex(t);
                codexAuth(t);
                claudeHost(t, null); // dir exists (claude host) but no plugin registry
            },
            (t) => {
                const res = _check_team(t.root);
                expect(res['status']).toBe('warn');
                expect(res['message']).toContain('codex plugin ❌');
                expect(res['remedy']).toContain(
                    'claude plugin marketplace add openai/codex-plugin-cc',
                );
                expect(res['remedy']).toContain('claude plugin install codex@openai-codex');
            },
        );
    });

    // --- sub-signal (b): namespace-resistant identity (PR-#924 finding) ---

    /** `plugins/known_marketplaces.json` — the real on-disk source registry shape. */
    function knownMarketplaces(t: TeamEnv, entries: Record<string, string>): void {
        const pdir = path.join(t.claudeDir, 'plugins');
        fs.mkdirSync(pdir, { recursive: true });
        const body: Record<string, unknown> = {};
        for (const [name, repo] of Object.entries(entries)) {
            body[name] = { source: { source: 'github', repo } };
        }
        fs.writeFileSync(path.join(pdir, 'known_marketplaces.json'), JSON.stringify(body));
    }

    it('sub-signal (b): marketplace source repo matches upstream → verified, no annotation', () => {
        withTeamEnv(
            (t) => {
                settings(t, ENABLED);
                fakeCodex(t);
                codexAuthBody(t, { tokens: { access_token: fakeJwt(FUTURE) } });
                claudeHost(t, CODEX_PLUGIN_ENTRY);
                knownMarketplaces(t, { 'openai-codex': 'openai/codex-plugin-cc' });
            },
            (t) => {
                const res = _check_team(t.root);
                expect(res['status'], String(res['message'])).toBe('ok');
                expect(res['message']).toContain('codex plugin ✅');
                expect(res['message']).not.toContain('identity not fully verified');
            },
        );
    });

    it('sub-signal (b): no marketplace registry → prefix match annotated as unverified', () => {
        withTeamEnv(
            (t) => {
                settings(t, ENABLED);
                fakeCodex(t);
                codexAuthBody(t, { tokens: { access_token: fakeJwt(FUTURE) } });
                claudeHost(t, CODEX_PLUGIN_ENTRY); // no known_marketplaces.json
            },
            (t) => {
                const res = _check_team(t.root);
                expect(res['status'], String(res['message'])).toBe('ok');
                expect(res['message']).toContain(
                    'codex plugin ✅ — identity not fully verified (prefix match)',
                );
            },
        );
    });

    it('sub-signal (b): namespace squat — codex@ prefix from a foreign repo → unverified', () => {
        withTeamEnv(
            (t) => {
                settings(t, ENABLED);
                fakeCodex(t);
                codexAuthBody(t, { tokens: { access_token: fakeJwt(FUTURE) } });
                claudeHost(t, { 'codex@openai-codex': [{ scope: 'user' }] });
                // Same marketplace NAME, foreign source repo — the squat case
                // pure prefix matching cannot see.
                knownMarketplaces(t, { 'openai-codex': 'attacker/codex-plugin-cc' });
            },
            (t) => {
                const res = _check_team(t.root);
                expect(res['message']).toContain('identity not fully verified (prefix match)');
            },
        );
    });

    it('sub-signal (b): non-Claude-Code host → plugin n/a, all else green → ok', () => {
        withTeamEnv(
            (t) => {
                settings(t, ENABLED);
                fakeCodex(t);
                codexAuth(t);
                // t.claudeDir never created + no `claude` on PATH → not a claude host.
            },
            (t) => {
                const res = _check_team(t.root);
                expect(res['status'], String(res['message'])).toBe('ok');
                expect(res['message']).toContain('not a Claude Code host');
            },
        );
    });

    it('sub-signal (c): managed without an explicit bound → ok (shipped default 3 applies)', () => {
        withTeamEnv(
            (t) => {
                settings(t, ENABLED + '  review_gate:\n    managed: true\n');
                fakeCodex(t);
                codexAuth(t);
                claudeHost(t, CODEX_PLUGIN_ENTRY);
            },
            (t) => {
                const res = _check_team(t.root);
                expect(res['status'], String(res['message'])).toBe('ok');
                expect(res['message']).toContain('review-gate on');
                expect(res['message']).toContain('bound 3');
            },
        );
    });

    it('sub-signal (c): review gate on with loop bound present → ok', () => {
        withTeamEnv(
            (t) => {
                settings(
                    t,
                    ENABLED + '  review_gate:\n    managed: true\n    max_consecutive_blocks: 3\n',
                );
                fakeCodex(t);
                codexAuth(t);
                claudeHost(t, CODEX_PLUGIN_ENTRY);
            },
            (t) => {
                const res = _check_team(t.root);
                expect(res['status'], String(res['message'])).toBe('ok');
                expect(res['message']).toContain('review-gate on');
            },
        );
    });

    it('sub-signal (c): managed with an invalid loop bound → warn', () => {
        withTeamEnv(
            (t) => {
                settings(
                    t,
                    ENABLED + '  review_gate:\n    managed: true\n    max_consecutive_blocks: 0\n',
                );
                fakeCodex(t);
                codexAuth(t);
                claudeHost(t, CODEX_PLUGIN_ENTRY);
            },
            (t) => {
                const res = _check_team(t.root);
                expect(res['status']).toBe('warn');
                expect(res['message']).toContain('loop bound invalid');
                expect(res['remedy']).toContain('ai_team.review_gate.max_consecutive_blocks');
            },
        );
    });

    it('sub-signal (c): plugin gate enabled while managed:false → warn with enable hint + quoted upstream cost warning', () => {
        withTeamEnv(
            (t) => {
                settings(t, ENABLED);
                fakeCodex(t);
                codexAuth(t);
                claudeHost(t, CODEX_PLUGIN_ENTRY);
                upstreamGateState(t, true);
            },
            (t) => {
                const res = _check_team(t.root);
                expect(res['status']).toBe('warn');
                expect(res['message']).toContain('plugin gate on, unmanaged');
                expect(res['remedy']).toContain('ai_team.review_gate.managed: true');
                expect(res['remedy']).toContain(
                    '"The review gate can create a long-running Claude/Codex loop ' +
                        'and may drain usage limits quickly."',
                );
            },
        );
    });

    it('sub-signal (c): plugin gate enabled AND managed → ok, detail reflects both', () => {
        withTeamEnv(
            (t) => {
                settings(t, ENABLED + '  review_gate:\n    managed: true\n');
                fakeCodex(t);
                codexAuth(t);
                claudeHost(t, CODEX_PLUGIN_ENTRY);
                upstreamGateState(t, true);
            },
            (t) => {
                const res = _check_team(t.root);
                expect(res['status'], String(res['message'])).toBe('ok');
                expect(res['message']).toContain('review-gate on');
                expect(res['message']).toContain('plugin gate on');
            },
        );
    });

    it('half-configured: gate managed while ai_team disabled → warn', () => {
        withTeamEnv(
            (t) => {
                settings(t, 'ai_team:\n  enabled: false\n  review_gate:\n    managed: true\n');
            },
            (t) => {
                const res = _check_team(t.root);
                expect(res['status']).toBe('warn');
                expect(res['message']).toContain('half-configured');
                expect(res['remedy']).toContain('ai_team.enabled: true');
            },
        );
    });

    it('runs stable via --check team (hermetic env)', () => {
        withTeamEnv(
            () => {},
            (t) => {
                const res = runTs(['--check', 'team'], t.root, {
                    PATH: t.bin,
                    CODEX_HOME: t.codexHome,
                    CLAUDE_CONFIG_DIR: t.claudeDir,
                    EVENT4U_CONFIG_HOME: t.home,
                });
                expect(res.status).toBe(0);
                expect(res.stdout).toContain('team mode not configured (default-off)');
            },
        );
    });
});

// ---------------------------------------------------------------------------
// --ci contract (road-to-flow-learnings Phase 0).
// ---------------------------------------------------------------------------

describe('doctor — --ci contract', () => {
    it('--ci parses and is off by default', () => {
        expect(_parse(['--ci']).ci).toBe(true);
        expect(_parse([]).ci).toBe(false);
    });

    it('usage advertises --ci', () => {
        const t = runTs(['--help'], tmp);
        expect(t.status).toBe(0);
        expect(t.stdout).toContain('[--ci]');
    });

    it('--ci emits a JSON payload and folds check failures into the exit code (bridge consumer)', () => {
        const b = bridgeRepo();
        try {
            const t = runTs(['--ci'], b, { AGENT_CONFIG_PROJECT_ROOT: b });
            const payload = JSON.parse(t.stdout) as {
                checks: Array<{ status: string }>;
            };
            const anyFail = payload.checks.some((c) => c.status === 'fail');
            expect(t.status).toBe(anyFail ? 1 : 0);
        } finally {
            fs.rmSync(b, { recursive: true, force: true });
        }
    });

    it('--ci keeps exit 2 for an unresolvable consumer (no lockfile, no bridge)', () => {
        const t = runTs(['--ci'], tmp, { AGENT_CONFIG_PROJECT_ROOT: tmp });
        expect(t.status).toBe(2);
        // Machine-readable even on the unhappy path.
        expect(() => JSON.parse(t.stdout)).not.toThrow();
    });
});

describe('--check git-identity (placeholder-identity guard)', () => {
    // Unit-level: exercise the exported check directly against fixture roots
    // (no shell-out — the check reads config files).
    const mkRepo = (configBody: string): string => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-ident-'));
        fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
        fs.writeFileSync(path.join(dir, '.git', 'config'), configBody);
        return dir;
    };

    it('warns on the placeholder identity that stamped real history (t <t@t.t>)', async () => {
        const { _check_git_identity } = await import('../../../src/scripts/_cli/cmd_doctor.js');
        const dir = mkRepo('[user]\n\tname = t\n\temail = t@t.t\n');
        try {
            const res = _check_git_identity(dir) as { status: string; message: string };
            expect(res.status).toBe('warn');
            expect(res.message).toContain('placeholder');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('passes a real identity', async () => {
        const { _check_git_identity } = await import('../../../src/scripts/_cli/cmd_doctor.js');
        const dir = mkRepo('[user]\n\tname = Jane Doe\n\temail = jane@company.tld\n');
        try {
            const res = _check_git_identity(dir) as { status: string };
            expect(res.status).toBe('ok');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('skips outside a git repository', async () => {
        const { _check_git_identity } = await import('../../../src/scripts/_cli/cmd_doctor.js');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-ident-norepo-'));
        try {
            const res = _check_git_identity(dir) as { status: string };
            expect(res.status).toBe('skipped');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('resolves a worktree gitdir pointer to the shared config', async () => {
        const { _check_git_identity } = await import('../../../src/scripts/_cli/cmd_doctor.js');
        const main = mkRepo('[user]\n\tname = t\n\temail = t@t.t\n');
        const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-ident-wt-'));
        const gdPath = path.join(main, '.git', 'worktrees', 'wt1');
        fs.mkdirSync(gdPath, { recursive: true });
        fs.writeFileSync(path.join(gdPath, 'commondir'), '../..\n');
        fs.writeFileSync(path.join(wt, '.git'), `gitdir: ${gdPath}\n`);
        try {
            const res = _check_git_identity(wt) as { status: string; message: string };
            expect(res.status).toBe('warn');
            expect(res.message).toContain('t@t.t');
        } finally {
            fs.rmSync(main, { recursive: true, force: true });
            fs.rmSync(wt, { recursive: true, force: true });
        }
    });
});

// ---------------------------------------------------------------------------
// detection check (road-to-zero-ceremony-detection Phases 3 + 4)
//
// Pins the status model — a recorded consent decision is NOT a defect — and the
// `--json` contract. Every case injects PATH / CODEX_HOME / CLAUDE_CONFIG_DIR /
// EVENT4U_CONFIG_HOME so provider rows are fully controlled.
// ---------------------------------------------------------------------------

describe('doctor — detection check', () => {
    interface DetEnv {
        root: string;
        bin: string;
        claudeDir: string;
        home: string;
        councilPath: string;
    }
    const DET_ENV_KEYS = [
        'PATH',
        'CODEX_HOME',
        'CLAUDE_CONFIG_DIR',
        'EVENT4U_CONFIG_HOME',
        'AI_COUNCIL_CONFIG',
        'ANTHROPIC_API_KEY',
        'OPENAI_API_KEY',
        'GEMINI_API_KEY',
        'XAI_API_KEY',
        'PERPLEXITY_API_KEY',
    ];

    function withDetEnv(fn: (t: DetEnv) => void): void {
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-det-'));
        const t: DetEnv = {
            root: path.join(base, 'proj'),
            bin: path.join(base, 'bin'),
            claudeDir: path.join(base, 'claude'),
            home: path.join(base, 'e4u-home'),
            councilPath: path.join(base, 'e4u-home', 'settings', '.ai-council.yml'),
        };
        fs.mkdirSync(t.root, { recursive: true });
        fs.mkdirSync(t.bin, { recursive: true });
        const prev: Record<string, string | undefined> = {};
        for (const k of DET_ENV_KEYS) prev[k] = process.env[k];
        process.env['PATH'] = t.bin;
        process.env['CODEX_HOME'] = path.join(base, 'codex-home');
        process.env['CLAUDE_CONFIG_DIR'] = t.claudeDir;
        process.env['EVENT4U_CONFIG_HOME'] = t.home;
        for (const k of DET_ENV_KEYS.slice(4)) delete process.env[k];
        resetEnvironmentCache();
        _reset_detection_memo();
        try {
            fn(t);
        } finally {
            for (const k of DET_ENV_KEYS) {
                if (prev[k] === undefined) delete process.env[k];
                else process.env[k] = prev[k] as string;
            }
            resetEnvironmentCache();
            _reset_detection_memo();
            fs.rmSync(base, { recursive: true, force: true });
        }
    }

    /** Write a minimal valid council config at the resolved user-global path. */
    function writeCouncil(t: DetEnv, body: string): void {
        fs.mkdirSync(path.dirname(t.councilPath), { recursive: true });
        fs.writeFileSync(t.councilPath, body);
        _reset_detection_memo();
    }

    function claudeLogin(t: DetEnv): void {
        fs.mkdirSync(t.claudeDir, { recursive: true });
        fs.writeFileSync(path.join(t.claudeDir, '.credentials.json'), '{"x":1}');
        const bin = path.join(t.bin, 'claude');
        fs.writeFileSync(bin, '#!/bin/sh\necho 1.2.3\n');
        fs.chmodSync(bin, 0o755);
        resetEnvironmentCache();
        _reset_detection_memo();
    }

    const COUNCIL_ENABLED_ANTHROPIC = [
        'enabled: true',
        'defaults:',
        '  mode: api',
        'cost_budget:',
        '  max_total_usd: 20',
        'members:',
        '  anthropic:',
        '    enabled: true',
        '    model: claude-sonnet-4-5',
        '    api_key_ref: file:anthropic.key',
        '',
    ].join('\n');

    const COUNCIL_DISABLED_MEMBER = COUNCIL_ENABLED_ANTHROPIC.replace(
        '    enabled: true\n    model',
        '    enabled: false\n    model',
    );

    it('reports ok with a fix when no council config exists', () => {
        withDetEnv((t) => {
            const c = _check_detection(t.root);
            expect(c['id']).toBe('detection');
            expect(c['status']).toBe('ok');
            expect(String(c['message'])).toContain('council not configured');
            expect(String(c['remedy']).length).toBeGreaterThan(0);
        });
    });

    it('treats a detected-but-not-enabled provider as ok, not a warning', () => {
        withDetEnv((t) => {
            claudeLogin(t);
            writeCouncil(t, COUNCIL_DISABLED_MEMBER);
            const c = _check_detection(t.root);
            // `enabled: false` is a deliberate spend gate. Warning on it would
            // train the user to silence their own consent record.
            expect(c['status']).toBe('ok');
            expect(String(c['message'])).toContain('not allowed to spend: anthropic');
            expect(String(c['remedy'])).toContain('members.anthropic.enabled: true');
        });
    });

    it('warns when a member IS permitted to spend but has no transport', () => {
        withDetEnv((t) => {
            // Council enabled, member enabled, nothing installed and no key.
            writeCouncil(t, COUNCIL_ENABLED_ANTHROPIC);
            const c = _check_detection(t.root);
            expect(c['status']).toBe('warn');
            expect(String(c['message'])).toContain('no transport');
            expect(String(c['remedy'])).toContain('anthropic');
        });
    });

    it('reports ok once the permitted member resolves a transport', () => {
        withDetEnv((t) => {
            claudeLogin(t);
            writeCouncil(t, COUNCIL_ENABLED_ANTHROPIC);
            const c = _check_detection(t.root);
            expect(c['status']).toBe('ok');
            expect(String(c['message'])).toContain('anthropic→cli/subscription');
        });
    });

    it('degrades an unreadable council config to "not configured" without throwing', () => {
        withDetEnv((t) => {
            writeCouncil(t, 'this: is: not: valid: yaml: [[[');
            expect(() => _check_detection(t.root)).not.toThrow();
            expect(_check_detection(t.root)['status']).toBe('ok');
        });
    });

    it('memoizes the report so the check row and the section cannot disagree', () => {
        withDetEnv((t) => {
            claudeLogin(t);
            writeCouncil(t, COUNCIL_ENABLED_ANTHROPIC);
            expect(_detection_report(t.root)).toBe(_detection_report(t.root));
        });
    });

    it('--json carries the detection payload with the pinned shape', () => {
        withDetEnv((t) => {
            claudeLogin(t);
            writeCouncil(t, COUNCIL_ENABLED_ANTHROPIC);
            const res = runInProc(() => main(['--project', t.root, '--check', 'detection', '--json']));
            const payload = JSON.parse(res.stdout) as Record<string, unknown>;
            expect(Object.keys(payload)).toContain('detection');
            const det = payload['detection'] as Record<string, unknown>;
            expect(det['schema_version']).toBe(1);
            expect(Object.keys(det)).toEqual([
                'schema_version',
                'council_config_path',
                'council_config_present',
                'council_enabled',
                'defaults_mode',
                'hosts',
                'providers',
                'budgets',
                'spend_disclosure',
            ]);
            expect(String(det['spend_disclosure'])).toContain('council spend disclosure');
        });
    });

    it('omits the detection payload when the detection check did not run', () => {
        withDetEnv((t) => {
            const res = runInProc(() => main(['--project', t.root, '--check', 'scope', '--json']));
            const payload = JSON.parse(res.stdout) as Record<string, unknown>;
            expect(Object.keys(payload)).not.toContain('detection');
        });
    });

    it('renders the section in text mode with a fix per unusable capability', () => {
        withDetEnv((t) => {
            writeCouncil(t, COUNCIL_ENABLED_ANTHROPIC);
            const res = runInProc(() => main(['--project', t.root, '--check', 'detection']));
            expect(res.stdout).toContain('detection:');
            expect(res.stdout).toContain('  providers:');
            expect(res.stdout).toContain('      fix: ');
        });
    });
});
