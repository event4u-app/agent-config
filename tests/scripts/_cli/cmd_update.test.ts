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

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_update.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_update.py');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();
const itPy = py3 ? it : it.skip;

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
    };
}

function runPy(args: string[], b: Box): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        cwd: b.root,
        encoding: 'utf8',
        env: { ...process.env, PYTHONPATH: path.join(REPO_ROOT, 'src'), ...env(b) },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[], b: Box): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd: b.root,
        encoding: 'utf8',
        env: { ...process.env, ...env(b) },
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
        const p = runPy(['--bogus'], b);
        const t = runTs(['--bogus'], b);
        expect(t.status).toBe(2);
        expect(p.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
    });

    itPy('--help → exit 0 (usage banner first line; body prose exempt)', () => {
        const b = freshBox();
        const p = runPy(['--help'], b);
        const t = runTs(['--help'], b);
        expect(t.status).toBe(0);
        expect(p.status).toBe(0);
        expect(t.stdout.split('\n')[0]).toBe(p.stdout.split('\n')[0]);
    });
});

// ---------------------------------------------------------------------------
// offline guard
// ---------------------------------------------------------------------------

describe('cmd_update — offline guard', () => {
    itPy('offline without --to → exit 1 (no latest source)', () => {
        const b = freshBox();
        const p = runPy([], b); // AGENT_CONFIG_OFFLINE=1 is set in env()
        const t = runTs([], b);
        expect(t.status).toBe(1);
        expect(p.status).toBe(1);
        expect(t.stderr).toBe(p.stderr);
        expect(t.stdout).toBe(p.stdout);
    });
});

// ---------------------------------------------------------------------------
// --check
// ---------------------------------------------------------------------------

describe('cmd_update — --check', () => {
    itPy('--check --to <newer> --offline → "available" message', () => {
        const b = freshBox();
        const p = runPy(['--check', '--to', '99.0.0', '--offline'], b);
        const t = runTs(['--check', '--to', '99.0.0', '--offline'], b);
        expect(t.status).toBe(0);
        expect(p.status).toBe(0);
        expect(t.stdout).toBe(p.stdout);
    });

    itPy('--check --to <older> --offline → "up to date" message', () => {
        const b = freshBox();
        const p = runPy(['--check', '--to', '0.0.1', '--offline'], b);
        const t = runTs(['--check', '--to', '0.0.1', '--offline'], b);
        expect(t.status).toBe(0);
        expect(t.stdout).toBe(p.stdout);
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
        const py = freshBox();
        const ts = freshBox();
        seedSettings(py.root);
        seedSettings(ts.root);
        const p = runPy(['--to', '7.2.0', '--offline'], py);
        const t = runTs(['--to', '7.2.0', '--offline'], ts);
        expect(t.status).toBe(p.status);
        expect(norm(t.stdout, [py.root, ts.root])).toBe(norm(p.stdout, [py.root, ts.root]));
        // Pin file rewritten identically (line 3 in place, comments preserved).
        expect(fs.readFileSync(path.join(ts.root, '.agent-settings.yml'), 'utf8')).toBe(
            fs.readFileSync(path.join(py.root, '.agent-settings.yml'), 'utf8'),
        );
        expect(fs.readFileSync(path.join(ts.root, '.agent-settings.yml'), 'utf8')).toContain(
            'agent_config_version: "7.2.0"',
        );
    });

    itPy('idempotent re-run → "already pins to" message', () => {
        const py = freshBox();
        const ts = freshBox();
        for (const b of [py, ts]) {
            fs.writeFileSync(
                path.join(b.root, '.agent-settings.yml'),
                'agent_config_version: "7.2.0"\n',
            );
        }
        const p = runPy(['--to', '7.2.0', '--offline'], py);
        const t = runTs(['--to', '7.2.0', '--offline'], ts);
        expect(t.status).toBe(p.status);
        expect(norm(t.stdout, [py.root, ts.root])).toBe(norm(p.stdout, [py.root, ts.root]));
        expect(t.stdout).toContain('already pins to 7.2.0');
    });

    itPy('refreshes the P2 state file identically (timestamp-normalized)', () => {
        const py = freshBox();
        const ts = freshBox();
        seedSettings(py.root);
        seedSettings(ts.root);
        runPy(['--to', '8.3.0', '--offline'], py);
        runTs(['--to', '8.3.0', '--offline'], ts);
        const pState = path.join(py.home, '.event4u', 'agent-config', 'update-check.json');
        const tState = path.join(ts.home, '.event4u', 'agent-config', 'update-check.json');
        expect(fs.existsSync(pState)).toBe(true);
        expect(fs.existsSync(tState)).toBe(true);
        const stripTs = (s: string): string =>
            s.replace(/"last_check_utc": "[^"]*"/, '"last_check_utc": "<TS>"');
        expect(stripTs(fs.readFileSync(tState, 'utf8'))).toBe(
            stripTs(fs.readFileSync(pState, 'utf8')),
        );
    });
});
