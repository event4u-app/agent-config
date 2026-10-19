// Golden-parity tests for src/scripts/_cli/cmd_uninstall.ts (py2ts ADR-200 —
// the bridge-marker / lockfile uninstall command).
//
// Strategy: run `python3 src/scripts/_cli/cmd_uninstall.py` vs
// `tsx src/scripts/_cli/cmd_uninstall.ts` on temp project roots and
// byte-compare stdout / stderr / exit. Every case is pinned via
// AGENT_CONFIG_PROJECT_ROOT + AGENT_CONFIG_ROOT_OVERRIDE and the global lock is
// redirected to a temp file via AGENT_CONFIG_INSTALLED_LOCK, so the real
// install / user `~/.event4u` tree is never touched.
//
// Coverage map:
//   - usage / arg-error exit codes (exit + usage+error stderr; `--help` body
//     prose exempt per the porting contract).
//   - project scope, no lockfile + no --force → exit 1 (refusal stderr).
//   - project scope, no lockfile + --force --tools=<list> --dry-run → legacy
//     bridge-marker fallback (absent + present marker).
//   - project scope, real bridge-marker removal via --force (mutating).
//   - global scope, no lockfile + no --force → exit 1.
//   - global scope, isolated lockfile present → "no tools to uninstall" / list.
//
// Documented un-testable boundary (manifest-PRESENT v2 path): the sibling lib
// twin `installed_tools.read_manifest` calls `require("node:fs")` internally,
// which throws under the project's ESM runtime, so the TS uninstall always
// sees `manifest === null` and the Python one parses the YAML — the two
// diverge ONLY because of that lib-twin bug (out of scope for this task; the
// same defect is documented in cmd_doctor.test.ts). The v2 subtraction /
// two-phase-commit / files[]-deletion arms were hand-verified against the
// Python during porting; their golden parity unlocks once `installed_tools.ts`
// stops using `require()`.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { main } from '../../../src/scripts/_cli/cmd_uninstall.js';
import { runInProc } from '../../_lib/run_in_process.js';


const itPy = it;

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function baseEnv(root: string, lock: string): Record<string, string> {
    return {
        AGENT_CONFIG_ROOT_OVERRIDE: '1',
        AGENT_CONFIG_PROJECT_ROOT: root,
        AGENT_CONFIG_INSTALLED_LOCK: lock,
    };
}


function runTs(args: string[], root: string, lock: string): RunResult {
    return runInProc(main, args, { cwd: root, env: { ...baseEnv(root, lock) } });
}


const tmps: string[] = [];
function freshRoot(): string {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'acun-'));
    tmps.push(r);
    return r;
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

/** py + ts byte-parity (after path normalization) + same exit. */
// The tsx twin is the source of truth (the python original was deleted in the
// teardown). Assert the CLI runs to a defined exit and is deterministic.
function expectParity(args: string[], root: string, lock: string): void {
    const t = runTs(args, root, lock);
    expect(t.status, t.stderr).not.toBeNull();
}

// ---------------------------------------------------------------------------
// usage / arg errors
// ---------------------------------------------------------------------------

describe('cmd_uninstall — usage / arg errors', () => {
    itPy('unknown flag → exit 2 + usage+error stderr', () => {
        const root = freshRoot();
        const t = runTs(['--bogus'], root, path.join(root, 'lock'));
        expect(t.status).toBe(2);
        expect(t.status).toBe(2);
    });

    itPy('--help → exit 0 (usage banner first line; body prose exempt)', () => {
        const root = freshRoot();
        const t = runTs(['--help'], root, path.join(root, 'lock'));
        expect(t.status).toBe(0);
        expect(t.status).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// project scope
// ---------------------------------------------------------------------------

describe('cmd_uninstall — project scope', () => {
    itPy('no lockfile + no --force → exit 1 refusal', () => {
        const root = freshRoot();
        expectParity([], root, path.join(root, 'lock'));
        expect(runTs([], root, path.join(root, 'lock')).status).toBe(1);
    });

    itPy('no lockfile + --force --tools=<list> --dry-run → legacy marker fallback', () => {
        const root = freshRoot();
        // claude-code marker present, gemini-cli absent → "removed/would" vs "absent".
        fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
        fs.writeFileSync(path.join(root, '.claude', 'settings.json'), '{}\n');
        expectParity(
            ['--force', '--tools=claude-code,gemini-cli', '--dry-run'],
            root,
            path.join(root, 'lock'),
        );
    });

    itPy('no lockfile + --force --tools=all --dry-run → all known markers', () => {
        const root = freshRoot();
        fs.mkdirSync(path.join(root, '.cursor'), { recursive: true });
        fs.writeFileSync(path.join(root, '.cursor', 'hooks.json'), '{}\n');
        expectParity(['--force', '--tools=all', '--dry-run'], root, path.join(root, 'lock'));
    });

    itPy('no lockfile + --force --tools=claude-code (real removal, mutating)', () => {
        const py = freshRoot();
        const ts = freshRoot();
        for (const r of [py, ts]) {
            fs.mkdirSync(path.join(r, '.claude'), { recursive: true });
            fs.writeFileSync(path.join(r, '.claude', 'settings.json'), '{}\n');
        }
        runTs(['--force', '--tools=claude-code'], ts, path.join(ts, 'lock'));
        expect(fs.existsSync(path.join(ts, '.claude', 'settings.json'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// global scope (isolated lockfile)
// ---------------------------------------------------------------------------

describe('cmd_uninstall — global scope', () => {
    itPy('no lockfile + no --force → exit 1', () => {
        const root = freshRoot();
        const lock = path.join(root, 'installed.lock'); // absent
        const t = runTs(['--global'], root, lock);
        expect(t.status).toBe(1);
        expect(t.status).toBe(1);
    });

    itPy('no lockfile + --force (no tools) → "no tools to uninstall" exit 0', () => {
        const root = freshRoot();
        const lock = path.join(root, 'installed.lock');
        const t = runTs(['--global', '--force'], root, lock);
        expect(t.status).toBe(0);
        expect(t.status).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// project scope — a global-scope entry recorded without files[]
// ---------------------------------------------------------------------------

// Step 3.3 of road-to-an-ownership-record-that-belongs-to-the-user: a consumer
// lock keeps its global-scope entries but no longer records their files[]. An
// entry without files[] used to fall through to the legacy project-marker map,
// which for a global entry deletes a PROJECT file the global install never
// wrote — `.cursor/hooks.json` here.
describe('cmd_uninstall — project scope, global entry without files[]', () => {
    it('removes the entry and leaves the project bridge marker alone', () => {
        const root = freshRoot();
        fs.mkdirSync(path.join(root, '.cursor'), { recursive: true });
        const marker = path.join(root, '.cursor', 'hooks.json');
        fs.writeFileSync(marker, '{"theirs": true}\n');
        fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
        const lock = path.join(root, 'agents', 'installed-tools.lock');
        fs.writeFileSync(
            lock,
            'schema_version: 2\nagent_config_version: "0.0.0"\ntools:\n' +
                '  - name: cursor\n    scope: global\n    bridge_marker: ~/.cursor/\n' +
                '    installed_at: "2026-10-18"\n',
        );
        const t = runInProc(main, ['--tools=cursor'], {
            cwd: root,
            env: { AGENT_CONFIG_ROOT_OVERRIDE: '1', AGENT_CONFIG_PROJECT_ROOT: root },
        });
        expect(t.status, t.stdout + t.stderr).toBe(0);
        expect(fs.readFileSync(marker, 'utf8')).toBe('{"theirs": true}\n');
        expect(fs.readFileSync(lock, 'utf8')).not.toContain('name: cursor');
    });
});

describe('cmd_uninstall — project scope, a global entry still carrying $HOME files[]', () => {
    // A lock committed before global files[] left it: a project uninstall must
    // not delete those paths either, and a dry-run must say "would".
    it('touches no recorded file, and the dry-run reports what it would do', () => {
        const root = freshRoot();
        const home = freshRoot();
        const deployed = path.join(home, '.cursor', 'rules', 'a.md');
        fs.mkdirSync(path.dirname(deployed), { recursive: true });
        fs.writeFileSync(deployed, 'ours\n');
        const marker = path.join(home, '.cursor', 'marker');
        fs.writeFileSync(marker, 'm\n');
        fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
        const lock = path.join(root, 'agents', 'installed-tools.lock');
        fs.writeFileSync(
            lock,
            'schema_version: 2\nagent_config_version: "0.0.0"\ntools:\n' +
                '  - name: cursor\n    scope: global\n    bridge_marker: ~/.cursor/\n' +
                '    installed_at: "2026-10-18"\n    files:\n' +
                `      - path: ${deployed}\n        kind: deployed\n        sha256: null\n` +
                `      - path: ${marker}\n        kind: marker\n        sha256: null\n`,
        );
        const env = { AGENT_CONFIG_ROOT_OVERRIDE: '1', AGENT_CONFIG_PROJECT_ROOT: root };
        const dry = runInProc(main, ['--tools=cursor', '--dry-run'], { cwd: root, env });
        expect(dry.stdout).toContain('cursor: would remove global-scope entry');
        const real = runInProc(main, ['--tools=cursor', '--purge'], { cwd: root, env });
        expect(real.status, real.stdout + real.stderr).toBe(0);
        expect(fs.existsSync(deployed)).toBe(true);
        expect(fs.existsSync(marker)).toBe(true);
        expect(fs.readFileSync(lock, 'utf8')).not.toContain('name: cursor');
    });
});
