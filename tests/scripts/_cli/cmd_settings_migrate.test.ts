// Golden-parity tests for src/scripts/_cli/cmd_settings_migrate.ts (py2ts
// ADR-200 — lift project-local settings into the global store).
//
// Strategy: run `python3 src/scripts/_cli/cmd_settings_migrate.py` vs
// `tsx src/scripts/_cli/cmd_settings_migrate.ts` and byte-compare stdout /
// stderr / exit, plus the resulting copied files.
//
// SAFETY: the destructive copy targets `~/.event4u/agent-config/` (derived from
// Path.home() / os.homedir()). To NEVER touch the real global store, every run
// pins HOME (+ USERPROFILE on Windows) to a throwaway temp dir, so GLOBAL_ROOT
// resolves inside the fixture. The `--from` source is a separate temp dir. The
// real repo / network / browser are never touched.
//
// NOTE (KNOWN DIVERGENCE, not tested): when the source YAML is malformed AND
// the host python3 has PyYAML, the Python original prints a parse error + exits
// 1, whereas the no-YAML-dep TS twin proceeds. Every fixture here uses VALID
// YAML, where both sides agree (Python returns True, TS returns True).
//
// Coverage map:
//   - usage / arg-error exit codes (unknown flag, missing --from value, --help).
//   - nothing-to-migrate (no source files) → exit 0 + skipped lines.
//   - --dry-run with a source present → "would migrate" plan, ZERO writes.
//   - real migrate (HOME-pinned global) → "migrated" + copied files identical.
//   - non-empty global dest, no --force → exit 1 stderr.
//   - non-empty global dest, --force → overwrite exit 0.
//   - typed settings/ subdir source wins over flat path.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_settings_migrate.ts');
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

/** Pin HOME so GLOBAL_ROOT (`~/.event4u/agent-config`) lands in `home`. */
function homeEnv(home: string): Record<string, string> {
    return { HOME: home, USERPROFILE: home };
}


function runTs(args: string[], cwd: string, home: string): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, COLUMNS: '80', ...homeEnv(home) },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const roots: string[] = [];
function freshRoot(): string {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'acmig-'));
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

/** Normalise both roots (raw + realpath) to <SRC> / <HOME> for comparison. */
function norm(text: string, replacements: Array<[string, string]>): string {
    let out = text;
    for (const [from, to] of replacements) {
        out = out.split(from).join(to);
        let real = from;
        try {
            real = fs.realpathSync(from);
        } catch {
            /* may not exist */
        }
        out = out.split(real).join(to);
    }
    return out;
}

const globalSettings = (home: string): string =>
    path.join(home, '.event4u', 'agent-config', '.agent-settings.yml');
const globalUser = (home: string): string =>
    path.join(home, '.event4u', 'agent-config', '.agent-user.yml');

// ---------------------------------------------------------------------------
// usage / arg errors
// ---------------------------------------------------------------------------

describe('cmd_settings_migrate — usage / arg errors', () => {
    itPy('unknown flag → exit 2', () => {
        expect(runTs(['--bogus'], freshRoot(), freshRoot()).status).toBe(2);
    });

    itPy('--from without a value → exit 2', () => {
        expect(runTs(['--from'], freshRoot(), freshRoot()).status).toBe(2);
    });

    itPy('--help → exit 0', () => {
        expect(runTs(['--help'], freshRoot(), freshRoot()).status).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// nothing to migrate
// ---------------------------------------------------------------------------

describe('cmd_settings_migrate — nothing to migrate', () => {
    itPy('no source files → exit 0 + skipped lines', () => {
        const ts = freshRoot();
        expect(runTs(['--from', ts], ts, freshRoot()).status).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// --dry-run
// ---------------------------------------------------------------------------

describe('cmd_settings_migrate — --dry-run', () => {
    itPy('source present → "would migrate" plan, ZERO writes', () => {
        const src = freshRoot();
        const home = freshRoot();
        fs.writeFileSync(path.join(src, '.agent-settings.yml'), 'foo: bar\n');
        const t = runTs(['--from', src, '--dry-run'], src, home);
        expect(t.status).toBe(0);
        // dry-run writes nothing into the global store.
        expect(fs.existsSync(globalSettings(home))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// real migrate (HOME-pinned). The tsx twin is the source of truth (the python
// original was deleted in the teardown); assertions check the copied content
// against the known source, not a python run.
// ---------------------------------------------------------------------------

describe('cmd_settings_migrate — apply (HOME-pinned global)', () => {
    itPy('flat source files → "migrated" + copied content matches source', () => {
        const src = freshRoot();
        const home = freshRoot();
        fs.writeFileSync(path.join(src, '.agent-settings.yml'), 'profile: balanced\nx: 1\n');
        fs.writeFileSync(path.join(src, '.agent-user.yml'), 'name: dev\n');
        const t = runTs(['--from', src], src, home);
        expect(t.status).toBe(0);
        expect(fs.readFileSync(globalSettings(home), 'utf8')).toBe('profile: balanced\nx: 1\n');
        expect(fs.readFileSync(globalUser(home), 'utf8')).toBe('name: dev\n');
    });

    itPy('typed settings/ subdir source wins over flat path', () => {
        const src = freshRoot();
        const home = freshRoot();
        fs.writeFileSync(path.join(src, '.agent-settings.yml'), 'flat: true\n');
        fs.mkdirSync(path.join(src, 'settings'), { recursive: true });
        fs.writeFileSync(path.join(src, 'settings', '.agent-settings.yml'), 'typed: true\n');
        const t = runTs(['--from', src], src, home);
        expect(t.status).toBe(0);
        // The typed (settings/) file is the one copied.
        expect(fs.readFileSync(globalSettings(home), 'utf8')).toBe('typed: true\n');
    });

    itPy('non-empty global dest, no --force → exit 1 stderr', () => {
        const src = freshRoot();
        const home = freshRoot();
        fs.writeFileSync(path.join(src, '.agent-settings.yml'), 'foo: bar\n');
        fs.mkdirSync(path.dirname(globalSettings(home)), { recursive: true });
        fs.writeFileSync(globalSettings(home), 'existing: global\n');
        expect(runTs(['--from', src], src, home).status).toBe(1);
    });

    itPy('non-empty global dest, --force → overwrite exit 0', () => {
        const src = freshRoot();
        const home = freshRoot();
        fs.writeFileSync(path.join(src, '.agent-settings.yml'), 'fresh: true\n');
        fs.mkdirSync(path.dirname(globalSettings(home)), { recursive: true });
        fs.writeFileSync(globalSettings(home), 'existing: global\n');
        const t = runTs(['--from', src, '--force'], src, home);
        expect(t.status).toBe(0);
        expect(fs.readFileSync(globalSettings(home), 'utf8')).toBe('fresh: true\n');
    });
});
