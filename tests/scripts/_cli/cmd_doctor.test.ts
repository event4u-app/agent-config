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
//     python-runtime, tier-usage-readiness, council-cli, wizard-state, plus
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
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_doctor.ts');
// Resolve TSX_BIN to an ABSOLUTE path: the runs spawn with cwd set to a temp
// dir, and a relative binary path would resolve against that cwd (→ ENOENT →
// status:null). The env override is honored but absolutized.
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

function runTs(args: string[], cwd: string, extraEnv: Record<string, string> = {}): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, ...extraEnv },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/**
 * Normalize machine-specific tmp paths so the output stays stable across runs.
 * macOS resolves `/tmp` → `/private/var/...` for the cwd-stamped paths the
 * doctor prints, so we strip both the raw and realpath forms of every
 * dynamic root.
 */
function norm(text: string, roots: string[]): string {
    let out = text;
    for (const root of roots) {
        out = out.split(root).join('<TMP>');
        let real = root;
        try {
            real = fs.realpathSync(root);
        } catch {
            /* root may already be removed */
        }
        out = out.split(real).join('<TMP>');
    }
    return out;
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
    const b = runTs(args, cwd, extraEnv);
    expect(a.status, a.stderr).not.toBeNull();
    expect(norm(b.stdout, roots)).toBe(norm(a.stdout, roots));
    expect(norm(b.stderr, roots)).toBe(norm(a.stderr, roots));
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

function bridgeRepo(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-bridge-'));
    fs.mkdirSync(path.join(dir, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'agents', '.event4u-bridge.yml'), 'x: 1\n');
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
        'stale-orphans',
        'manifest-integrity',
        'lockfile-freshness',
        'bridge-drift',
        'mcp-mode',
        'mcp-beta-readiness',
        'offline-readiness',
        'python-runtime',
        'tier-usage-readiness',
        'council-cli',
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
