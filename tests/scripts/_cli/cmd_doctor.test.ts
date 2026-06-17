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
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_doctor.py');
// Resolve TSX_BIN to an ABSOLUTE path: golden-parity runs spawn with cwd set
// to a temp dir, and a relative binary path would resolve against that cwd
// (→ ENOENT → status:null). The env override is honored but absolutized.
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runPy(args: string[], cwd: string, extraEnv: Record<string, string> = {}): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, PYTHONPATH: path.join(REPO_ROOT, 'src'), ...extraEnv },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
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
 * Normalize machine-specific tmp paths so the differential stays stable.
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

/** Assert py and ts agree byte-for-byte (after path normalization) + same exit. */
function expectParity(
    args: string[],
    cwd: string,
    roots: string[],
    extraEnv: Record<string, string> = {},
): void {
    const p = runPy(args, cwd, extraEnv);
    const t = runTs(args, cwd, extraEnv);
    expect(t.status).toBe(p.status);
    expect(norm(t.stdout, roots)).toBe(norm(p.stdout, roots));
    expect(norm(t.stderr, roots)).toBe(norm(p.stderr, roots));
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

describe.skipIf(!py3)('doctor — argument errors', () => {
    it('--help: exit 0, usage token on stdout', () => {
        const p = runPy(['--help'], tmp);
        const t = runTs(['--help'], tmp);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(0);
        // The usage line is byte-stable; the per-flag body re-wraps to terminal
        // width (documented divergence) — assert the usage token + first line.
        expect(t.stdout.startsWith('usage: agent-config doctor')).toBe(true);
    });

    it('unknown flag: exit 2 + byte-identical usage+error stderr', () => {
        const p = runPy(['--bogus'], tmp);
        const t = runTs(['--bogus'], tmp);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
    });

    it('--check invalid choice: exit 2 + byte-identical stderr', () => {
        const p = runPy(['--check', 'nope'], tmp);
        const t = runTs(['--check', 'nope'], tmp);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
    });

    it('--repair invalid choice: exit 2 + byte-identical stderr', () => {
        const p = runPy(['--repair', 'nope'], tmp);
        const t = runTs(['--repair', 'nope'], tmp);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
    });

    it('--check with no argument: exit 2 + byte-identical stderr', () => {
        const p = runPy(['--check'], tmp);
        const t = runTs(['--check'], tmp);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
    });
});

// ---------------------------------------------------------------------------
// No-manifest path (full report).
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('doctor — no-manifest report', () => {
    it('uninitialised repo (no lockfile, no bridge): exit 2, byte-identical', () => {
        expectParity([], tmp, [tmp]);
    });

    it('uninitialised repo --json: byte-identical, exit 2', () => {
        expectParity(['--json'], tmp, [tmp]);
    });

    it('bridge-present global-only consumer: exit 0, byte-identical', () => {
        const b = bridgeRepo();
        try {
            expectParity([], b, [b]);
        } finally {
            fs.rmSync(b, { recursive: true, force: true });
        }
    });

    it('bridge-present --json: byte-identical, exit 0', () => {
        const b = bridgeRepo();
        try {
            expectParity(['--json'], b, [b]);
        } finally {
            fs.rmSync(b, { recursive: true, force: true });
        }
    });
});

// ---------------------------------------------------------------------------
// Discovery snapshots.
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('doctor — discovery snapshots', () => {
    it('--trace-root text: byte-identical', () => {
        expectParity(['--trace-root'], tmp, [tmp]);
    });
    it('--trace-root --json: byte-identical', () => {
        expectParity(['--trace-root', '--json'], tmp, [tmp]);
    });
    it('--context text: byte-identical', () => {
        expectParity(['--context'], tmp, [tmp]);
    });
    it('--context --json: byte-identical', () => {
        expectParity(['--context', '--json'], tmp, [tmp]);
    });
});

// ---------------------------------------------------------------------------
// --repair wizard-state (hermetic global home).
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('doctor — repair wizard-state', () => {
    it('absent: idempotent no-op, exit 0, byte-identical (text + json)', () => {
        // Separate hermetic homes per language so neither sees the other's run.
        const homePy = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-h-'));
        const homeTs = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-h-'));
        try {
            const p = runPy(['--repair', 'wizard-state'], tmp, { EVENT4U_CONFIG_HOME: homePy });
            const t = runTs(['--repair', 'wizard-state'], tmp, { EVENT4U_CONFIG_HOME: homeTs });
            expect(t.status).toBe(p.status);
            expect(p.status).toBe(0);
            expect(norm(t.stdout, [homeTs, homePy])).toBe(norm(p.stdout, [homePy, homeTs]));
            expect(t.stderr).toBe(p.stderr);
        } finally {
            fs.rmSync(homePy, { recursive: true, force: true });
            fs.rmSync(homeTs, { recursive: true, force: true });
        }
    });

    it('present: removes the file + identical message + exit 0', () => {
        const seed = (home: string): void => {
            const stateDir = path.join(home, 'state');
            fs.mkdirSync(stateDir, { recursive: true });
            fs.writeFileSync(
                path.join(stateDir, 'wizard-state.json'),
                JSON.stringify({ step: 1, partial: {} }),
            );
        };
        const homePy = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-h-'));
        const homeTs = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-h-'));
        try {
            seed(homePy);
            seed(homeTs);
            const p = runPy(['--repair', 'wizard-state'], tmp, { EVENT4U_CONFIG_HOME: homePy });
            const t = runTs(['--repair', 'wizard-state'], tmp, { EVENT4U_CONFIG_HOME: homeTs });
            expect(t.status).toBe(p.status);
            expect(p.status).toBe(0);
            expect(norm(t.stdout, [homeTs, homePy])).toBe(norm(p.stdout, [homePy, homeTs]));
            // Both unlinked their own state file.
            expect(fs.existsSync(path.join(homePy, 'state', 'wizard-state.json'))).toBe(false);
            expect(fs.existsSync(path.join(homeTs, 'state', 'wizard-state.json'))).toBe(false);
        } finally {
            fs.rmSync(homePy, { recursive: true, force: true });
            fs.rmSync(homeTs, { recursive: true, force: true });
        }
    });

    it('present --json: byte-identical payload + exit 0', () => {
        const seed = (home: string): void => {
            const stateDir = path.join(home, 'state');
            fs.mkdirSync(stateDir, { recursive: true });
            fs.writeFileSync(path.join(stateDir, 'wizard-state.json'), '{"step":0,"partial":{}}');
        };
        const homePy = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-h-'));
        const homeTs = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-h-'));
        try {
            seed(homePy);
            seed(homeTs);
            const p = runPy(['--repair', 'wizard-state', '--json'], tmp, {
                EVENT4U_CONFIG_HOME: homePy,
            });
            const t = runTs(['--repair', 'wizard-state', '--json'], tmp, {
                EVENT4U_CONFIG_HOME: homeTs,
            });
            expect(t.status).toBe(p.status);
            expect(p.status).toBe(0);
            expect(norm(t.stdout, [homeTs, homePy])).toBe(norm(p.stdout, [homePy, homeTs]));
        } finally {
            fs.rmSync(homePy, { recursive: true, force: true });
            fs.rmSync(homeTs, { recursive: true, force: true });
        }
    });
});

// ---------------------------------------------------------------------------
// Individual --check ids (no-manifest path: globals run, manifest-required
// report `skipped`).
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('doctor — individual checks', () => {
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
            expectParity(['--check', cid], tmp, [tmp]);
        });
    }
});

// ---------------------------------------------------------------------------
// Manifest-present path (manifest !== null). Previously unreachable under tsx
// because the read_manifest ESM `require` bug forced the no-manifest path;
// now that the lib twin is fixed these arms read the real lockfile and the
// three manifest-required checks report on it instead of `skipped`.
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('doctor — manifest-present path', () => {
    for (const cid of ['manifest-integrity', 'lockfile-freshness', 'unsupported-combos']) {
        it(`--check ${cid} on a real lockfile: byte-identical + same exit`, () => {
            const dir = manifestRepo();
            try {
                expectParity(['--check', cid, '--project', dir], dir, [dir]);
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });
    }

    it('full report over a manifest-present root: byte-identical + same exit', () => {
        const dir = manifestRepo();
        try {
            expectParity(['--project', dir], dir, [dir]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('--json over a manifest-present root: byte-identical + same exit', () => {
        const dir = manifestRepo();
        try {
            expectParity(['--json', '--project', dir], dir, [dir]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

// ---------------------------------------------------------------------------
// scope detection.
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('doctor — scope check', () => {
    it('pnpm-workspace.yaml → monorepo warn', () => {
        fs.writeFileSync(path.join(tmp, 'pnpm-workspace.yaml'), 'packages: []\n');
        expectParity(['--check', 'scope'], tmp, [tmp]);
    });
    it('lerna.json → monorepo warn', () => {
        fs.writeFileSync(path.join(tmp, 'lerna.json'), '{}');
        expectParity(['--check', 'scope'], tmp, [tmp]);
    });
    it('package.json with workspaces → monorepo warn', () => {
        fs.writeFileSync(path.join(tmp, 'package.json'), '{"workspaces":["a"]}');
        expectParity(['--check', 'scope'], tmp, [tmp]);
    });
    it('package.json without workspaces → standalone ok', () => {
        fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"x"}');
        expectParity(['--check', 'scope'], tmp, [tmp]);
    });
});

// ---------------------------------------------------------------------------
// mcp-mode check.
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('doctor — mcp-mode check', () => {
    it('valid root mcp.json → ok detected', () => {
        fs.writeFileSync(path.join(tmp, 'mcp.json'), '{"servers":{}}');
        expectParity(['--check', 'mcp-mode'], tmp, [tmp]);
    });
    it('invalid mcp.json → warn', () => {
        fs.writeFileSync(path.join(tmp, 'mcp.json'), 'not json');
        expectParity(['--check', 'mcp-mode'], tmp, [tmp]);
    });
    it('valid .cursor/mcp.json → ok detected', () => {
        fs.mkdirSync(path.join(tmp, '.cursor'), { recursive: true });
        fs.writeFileSync(path.join(tmp, '.cursor', 'mcp.json'), '{}');
        expectParity(['--check', 'mcp-mode'], tmp, [tmp]);
    });
});

// ---------------------------------------------------------------------------
// tier-usage-readiness check.
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('doctor — tier-usage-readiness check', () => {
    const ENABLED = 'telemetry:\n  tier_usage:\n    enabled: true\n';

    it('disabled (no settings) → warn', () => {
        expectParity(['--check', 'tier-usage-readiness'], tmp, [tmp]);
    });

    it('enabled, no log → warn (no signal)', () => {
        const dir = tierSettingsRepo(ENABLED);
        try {
            expectParity(['--check', 'tier-usage-readiness'], dir, [dir]);
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
            expectParity(['--check', 'tier-usage-readiness'], dir, [dir]);
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
            expectParity(['--check', 'tier-usage-readiness'], dir, [dir]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('enabled, blank-line-only log → warn (empty)', () => {
        const dir = tierSettingsRepo(ENABLED);
        try {
            fs.writeFileSync(path.join(dir, '.agent-tier-usage.jsonl'), '\n\n');
            expectParity(['--check', 'tier-usage-readiness'], dir, [dir]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('enabled, custom output path, no log → warn', () => {
        const dir = tierSettingsRepo(
            'telemetry:\n  tier_usage:\n    enabled: true\n    output:\n      path: custom/usage.jsonl\n',
        );
        try {
            expectParity(['--check', 'tier-usage-readiness'], dir, [dir]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

// ---------------------------------------------------------------------------
// wizard-state check shape validation (hermetic home).
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('doctor — wizard-state check', () => {
    function withState(content: string | null): { home: string } {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-h-'));
        if (content !== null) {
            const stateDir = path.join(home, 'state');
            fs.mkdirSync(stateDir, { recursive: true });
            fs.writeFileSync(path.join(stateDir, 'wizard-state.json'), content);
        }
        return { home };
    }

    // Both languages read their own hermetic home; we seed identical content
    // in two homes and normalize both home paths out of the output.
    function parityWithState(content: string | null): void {
        const py = withState(content);
        const ts = withState(content);
        try {
            const p = runPy(['--check', 'wizard-state'], tmp, { EVENT4U_CONFIG_HOME: py.home });
            const t = runTs(['--check', 'wizard-state'], tmp, { EVENT4U_CONFIG_HOME: ts.home });
            expect(t.status).toBe(p.status);
            expect(norm(t.stdout, [ts.home, py.home, tmp])).toBe(
                norm(p.stdout, [py.home, ts.home, tmp]),
            );
            expect(norm(t.stderr, [ts.home, py.home, tmp])).toBe(
                norm(p.stderr, [py.home, ts.home, tmp]),
            );
        } finally {
            fs.rmSync(py.home, { recursive: true, force: true });
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
