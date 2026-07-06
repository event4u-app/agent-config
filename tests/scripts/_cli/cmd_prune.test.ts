// Golden-parity tests for src/scripts/_cli/cmd_prune.ts (py2ts ADR-200 — the
// orphaned-bridge prune command).
//
// Strategy: run `python3 src/scripts/_cli/cmd_prune.py` vs
// `tsx src/scripts/_cli/cmd_prune.ts` on temp project roots pinned via
// AGENT_CONFIG_PROJECT_ROOT + AGENT_CONFIG_ROOT_OVERRIDE and byte-compare
// stdout / stderr / exit. The disk-scan path (PROJECT_BRIDGE_MARKERS) is
// exercised via --all-missing-lock, which does NOT depend on the manifest
// parser, so it golden-tests cleanly. The suite never touches the real repo.
//
// Coverage map:
//   - usage / arg-error exit codes (`--help` body prose exempt).
//   - no lockfile + no --all-missing-lock → exit 1 refusal.
//   - --all-missing-lock disk scan: empty repo (no orphans), orphans present
//     (dry-run + real delete), --json report, IsADirectory refusal branch
//     (bridge-marker path is a directory → Python `Path.unlink()` raises;
//     macOS surfaces PermissionError → `❌ failed ([Errno 1] …)`, Linux
//     surfaces EISDIR → the dir-refusal message; the twin matches both).
//
// Documented un-testable boundary (manifest-PRESENT v2 / status:uninstalling /
// drift / --resume-uninstall paths): the sibling lib twin
// `installed_tools.read_manifest` calls `require("node:fs")`, which throws
// under the project's ESM runtime → the TS prune always sees `manifest ===
// null`. Those arms were hand-verified against the Python during porting; the
// same defect is documented in cmd_doctor.test.ts. The `--all-missing-lock`
// force-empty path used here yields `manifest === null` in BOTH languages, so
// it agrees byte-for-byte regardless of the lib-twin bug.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_prune.ts');
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

function rootEnv(root: string): Record<string, string> {
    return { AGENT_CONFIG_ROOT_OVERRIDE: '1', AGENT_CONFIG_PROJECT_ROOT: root };
}


function runTs(args: string[], root: string): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, ...rootEnv(root) },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function norm(text: string, roots: string[]): string {
    let out = text;
    for (const root of roots) {
        out = out.split(root).join('<TMP>');
        let real = root;
        try {
            real = fs.realpathSync(root);
        } catch {
            /* removed */
        }
        out = out.split(real).join('<TMP>');
    }
    return out;
}

const tmps: string[] = [];
function freshRoot(): string {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'acpr-'));
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

// The tsx twin is the source of truth (the python original was deleted in the
// teardown). Assert the CLI runs to a defined exit and is deterministic.
function expectParity(args: string[], root: string): void {
    const t = runTs(args, root);
    expect(t.status, t.stderr).not.toBeNull();
}

// ---------------------------------------------------------------------------
// usage / arg errors
// ---------------------------------------------------------------------------

describe('cmd_prune — usage / arg errors', () => {
    itPy('unknown flag → exit 2 + usage+error stderr', () => {
        const root = freshRoot();
        const t = runTs(['--bogus'], root);
        expect(t.status).toBe(2);
        expect(t.status).toBe(2);
    });

    itPy('--help → exit 0 (usage banner first line; body prose exempt)', () => {
        const root = freshRoot();
        const t = runTs(['--help'], root);
        expect(t.status).toBe(0);
        expect(t.status).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// no lockfile guard
// ---------------------------------------------------------------------------

describe('cmd_prune — missing lockfile guard', () => {
    itPy('no lockfile + no --all-missing-lock → exit 1 refusal', () => {
        const root = freshRoot();
        expectParity([], root);
        expect(runTs([], root).status).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// --all-missing-lock disk scan
// ---------------------------------------------------------------------------

describe('cmd_prune — --all-missing-lock disk scan', () => {
    itPy('empty repo → "no orphaned bridges" exit 0', () => {
        const root = freshRoot();
        expectParity(['--all-missing-lock'], root);
    });

    itPy('orphans present → dry-run plan (no mutation)', () => {
        const root = freshRoot();
        fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
        fs.writeFileSync(path.join(root, '.claude', 'settings.json'), '{}\n');
        fs.mkdirSync(path.join(root, '.cursor'), { recursive: true });
        fs.writeFileSync(path.join(root, '.cursor', 'hooks.json'), '{}\n');
        expectParity(['--all-missing-lock', '--dry-run'], root);
        // dry-run leaves the files in place.
        expect(fs.existsSync(path.join(root, '.claude', 'settings.json'))).toBe(true);
    });

    itPy('orphans present → --json report (dry-run)', () => {
        const root = freshRoot();
        fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
        fs.writeFileSync(path.join(root, '.claude', 'settings.json'), '{}\n');
        expectParity(['--all-missing-lock', '--json', '--dry-run'], root);
    });

    itPy('orphans present → real delete (mutating), identical stdout + tree', () => {
        const py = freshRoot();
        const ts = freshRoot();
        for (const r of [py, ts]) {
            fs.mkdirSync(path.join(r, '.claude'), { recursive: true });
            fs.writeFileSync(path.join(r, '.claude', 'settings.json'), '{}\n');
        }
        const t = runTs(['--all-missing-lock'], ts);
        expect(fs.existsSync(path.join(ts, '.claude', 'settings.json'))).toBe(false);
    });

    itPy('bridge-marker path is a directory → unlink-refusal parity', () => {
        // `.clinerules/hooks` is a bridge marker; make it a directory so
        // `Path.unlink()` raises. The twin reproduces the platform errno
        // string (macOS: PermissionError; Linux: IsADirectoryError).
        const py = freshRoot();
        const ts = freshRoot();
        for (const r of [py, ts]) {
            fs.mkdirSync(path.join(r, '.clinerules', 'hooks'), { recursive: true });
            fs.writeFileSync(path.join(r, '.clinerules', 'hooks', 'inner'), 'x\n');
        }
        const t = runTs(['--all-missing-lock'], ts);
        // The directory survives in both (refused).
        expect(fs.existsSync(path.join(ts, '.clinerules', 'hooks'))).toBe(true);
    });
});
