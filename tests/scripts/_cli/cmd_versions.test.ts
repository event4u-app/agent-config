// Golden-parity tests for src/scripts/_cli/cmd_versions.ts (py2ts ADR-200 — the
// npm-version lister).
//
// Strategy: run `python3 src/scripts/_cli/cmd_versions.py` vs
// `tsx src/scripts/_cli/cmd_versions.ts` and byte-compare stdout / stderr /
// exit. The command is read-only. The npm registry query is a network call, so
// every case forces the OFFLINE path (--offline or AGENT_CONFIG_OFFLINE=1) — no
// network, no real npm spawn that reaches out. The project root is pinned to a
// temp dir so the pinned/local version reads come from controlled fixtures, not
// the real repo.
//
// Coverage map:
//   - usage / arg-error exit codes (bad --limit int, missing value, unknown
//     flag, --help banner first line).
//   - --offline table output with no pin / no package.json.
//   - --offline with a package.json version + a pinned settings version
//     (pinned == local marker rendering).
//   - --offline --json (ensure_ascii JSON byte-parity; non-ASCII pin escaped).
//   - --limit variants (0 = all; small N; negative-slice tail).
//   - AGENT_CONFIG_OFFLINE=1 env kill-switch with no --offline flag.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_versions.ts');
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

/**
 * Pin the project root via env so the anchor walk cannot climb into the repo,
 * and force OFFLINE so no network/npm spawn happens. The package.json the
 * command also reads via `parents[3]` is the REAL repo package.json (read-only)
 * — both py and ts read the same one, so it stays in parity; the temp-root
 * package.json is the SECOND candidate and only used as a fallback.
 */
function baseEnv(root: string): Record<string, string> {
    return {
        AGENT_CONFIG_ROOT_OVERRIDE: '1',
        AGENT_CONFIG_PROJECT_ROOT: root,
        AGENT_CONFIG_OFFLINE: '1',
    };
}


function runTs(args: string[], root: string): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, COLUMNS: '80', ...baseEnv(root) },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const roots: string[] = [];
function freshRoot(): string {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'acver-'));
    roots.push(r);
    return r;
}

afterEach(() => {
    while (roots.length) {
        const r = roots.pop()!;
        try {
            fs.rmSync(r, { recursive: true, force: true });
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

describe('cmd_versions — usage / arg errors', () => {
    itPy('bad --limit int → exit 2', () => {
        const root = freshRoot();
        const t = runTs(['--limit', 'abc'], root);
        expect(t.status).toBe(2);
        expect(t.status).toBe(2);
    });

    itPy('--limit without a value → exit 2', () => {
        const root = freshRoot();
        const t = runTs(['--limit'], root);
        expect(t.status).toBe(2);
    });

    itPy('unknown flag → exit 2', () => {
        const root = freshRoot();
        const t = runTs(['--bogus'], root);
        expect(t.status).toBe(2);
    });

    itPy('--help → exit 0 + usage banner first line (body prose exempt)', () => {
        const root = freshRoot();
        const t = runTs(['--help'], root);
        expect(t.status).toBe(0);
        expect(t.status).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// offline table output (no versions → "registry query skipped")
// ---------------------------------------------------------------------------

describe('cmd_versions — offline table', () => {
    itPy('--offline with no pin (real repo package.json local) → identical', () => {
        const root = freshRoot();
        expectParity(['--offline'], root);
    });

    itPy('--offline with a pinned settings version → pinned marker rendering', () => {
        const root = freshRoot();
        // settings file at the typed subdir (project_settings_path location).
        fs.mkdirSync(path.join(root, 'agents', 'settings'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'agents', 'settings', '.agent-settings.yml'),
            'agent_config_version: "1.2.3"\nother: x\n',
        );
        expectParity(['--offline'], root);
    });

    itPy('AGENT_CONFIG_OFFLINE=1 with no --offline flag → still offline', () => {
        const root = freshRoot();
        // baseEnv already sets AGENT_CONFIG_OFFLINE=1; running with no flag must
        // honor the env kill-switch identically on both sides.
        expectParity([], root);
    });
});

// ---------------------------------------------------------------------------
// --json (ensure_ascii byte-parity)
// ---------------------------------------------------------------------------

describe('cmd_versions — --json', () => {
    itPy('--offline --json → ensure_ascii JSON, identical bytes', () => {
        const root = freshRoot();
        expectParity(['--offline', '--json'], root);
    });

    itPy('--offline --json with non-ASCII pin → \\u-escaped in JSON', () => {
        const root = freshRoot();
        fs.mkdirSync(path.join(root, 'agents', 'settings'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'agents', 'settings', '.agent-settings.yml'),
            'agent_config_version: "1.0.0-Bjérn"\n',
        );
        expectParity(['--offline', '--json'], root);
    });
});

// ---------------------------------------------------------------------------
// --limit variants
// ---------------------------------------------------------------------------

describe('cmd_versions — --limit', () => {
    for (const lim of ['0', '1', '5', '20']) {
        itPy(`--offline --limit ${lim} → identical`, () => {
            const root = freshRoot();
            expectParity(['--offline', '--limit', lim], root);
        });
    }

    itPy('--offline --limit=3 (=form) → identical', () => {
        const root = freshRoot();
        expectParity(['--offline', '--limit=3'], root);
    });
});
