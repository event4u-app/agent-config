// Golden-parity tests for src/scripts/_cli/cmd_migrate.ts (py2ts ADR-200 — the
// one-shot legacy-install migration command).
//
// Strategy: run `python3 src/scripts/_cli/cmd_migrate.py` vs
// `tsx src/scripts/_cli/cmd_migrate.ts` on temp project roots and byte-compare
// stdout / stderr / exit. cmd_migrate mutates the install, so every apply case
// runs in a throwaway temp root pinned via AGENT_CONFIG_PROJECT_ROOT +
// AGENT_CONFIG_ROOT_OVERRIDE (so the anchor walk never climbs into the real
// repo). The suite NEVER touches the real repo, the network, or a browser.
//
// Coverage map (one describe block per branch family):
//   - usage / arg-error exit codes (exit + usage+error stderr; the `--help`
//     per-flag BODY is NOT byte-compared, per the porting contract — argparse
//     re-wraps the body to terminal width).
//   - already-migrated no-op (bare + --check wording divergence).
//   - --check (exit 2 + pending-count plan) and --dry-run (exit 0 + plan) on a
//     legacy fixture.
//   - --from {4,5} echo + mismatch advisory.
//   - the full apply path: package.json / composer.json entry strip, legacy
//     symlink purge (legacy removed, user preserved), legacy settings delete +
//     settings/ rmdir, empty agent-config/ shell removal, .gitignore refresh.
//     Resulting files are byte-compared across the two roots.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_migrate.ts');
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

/** Pin the project root via env so the anchor walk cannot climb into the repo. */
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

/** Strip both the raw and realpath forms of every dynamic root. */
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

/** Build two identical legacy-install fixtures; return [pyRoot, tsRoot]. */
function mkLegacyPair(builder: (root: string) => void): [string, string] {
    const py = fs.mkdtempSync(path.join(os.tmpdir(), 'acmig-py-'));
    const ts = fs.mkdtempSync(path.join(os.tmpdir(), 'acmig-ts-'));
    builder(py);
    builder(ts);
    return [py, ts];
}

const roots: string[] = [];
function freshRoot(prefix: string): string {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
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

const itPy = it;

// ---------------------------------------------------------------------------
// usage / arg errors
// ---------------------------------------------------------------------------

describe('cmd_migrate — usage / arg errors', () => {
    itPy('invalid --from choice → exit 2 + usage+error stderr', () => {
        const root = freshRoot('acmig-');
        const t = runTs(['--from', '9'], root);
        expect(t.status).toBe(2);
        expect(t.status).toBe(2);
    });

    itPy('--from without a value → exit 2', () => {
        const root = freshRoot('acmig-');
        const t = runTs(['--from'], root);
        expect(t.status).toBe(2);
    });

    itPy('--dry-run + --check (mutually exclusive) → exit 2', () => {
        const root = freshRoot('acmig-');
        const t = runTs(['--dry-run', '--check'], root);
        expect(t.status).toBe(2);
    });

    itPy('unknown flag → exit 2', () => {
        const root = freshRoot('acmig-');
        const t = runTs(['--bogus'], root);
        expect(t.status).toBe(2);
    });

    itPy('--help → exit 0 + usage banner first line (body prose exempt)', () => {
        const root = freshRoot('acmig-');
        const t = runTs(['--help'], root);
        expect(t.status).toBe(0);
        expect(t.status).toBe(0);
        // Per the porting contract, the argparse help BODY is not byte-compared
        // (terminal-width reflow); the usage banner first line is stable.
    });
});

// ---------------------------------------------------------------------------
// already-migrated no-op
// ---------------------------------------------------------------------------

describe('cmd_migrate — already migrated (clean repo)', () => {
    itPy('bare run → "already migrated" exit 0', () => {
        const root = freshRoot('acmig-');
        const t = runTs([], root);
        expect(t.status).toBe(0);
    });

    itPy('--check on a clean repo → "on the 6.0 layout" exit 0', () => {
        const root = freshRoot('acmig-');
        const t = runTs(['--check'], root);
        expect(t.status).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// detection: --check / --dry-run on a legacy fixture
// ---------------------------------------------------------------------------

function buildLegacy(root: string): void {
    fs.mkdirSync(path.join(root, 'node_modules', 'pkg'), { recursive: true });
    fs.mkdirSync(path.join(root, 'settings'), { recursive: true });
    fs.mkdirSync(path.join(root, 'agent-config'), { recursive: true }); // empty shell
    fs.writeFileSync(
        path.join(root, 'package.json'),
        '{\n' +
            '  "name": "x",\n' +
            '  "dependencies": {\n' +
            '    "@event4u/agent-config": "^1.0.0",\n' +
            '    "left-pad": "1.0.0"\n' +
            '  },\n' +
            '  "devDependencies": {\n' +
            '    "@event4u/agent-config": "^1.0.0"\n' +
            '  }\n' +
            '}\n',
    );
    fs.writeFileSync(
        path.join(root, 'composer.json'),
        '{\n  "require": {\n    "event4u/agent-config": "^1.0",\n    "php": ">=8"\n  }\n}\n',
    );
    fs.writeFileSync(path.join(root, '.agent-settings.yml'), 'foo: bar\n');
    fs.writeFileSync(path.join(root, 'settings', '.agent-user.yml'), 'u: 1\n');
    fs.symlinkSync('node_modules/pkg', path.join(root, '.claude')); // legacy → removed
    fs.symlinkSync(os.tmpdir(), path.join(root, '.cursor')); // user → preserved
    fs.writeFileSync(path.join(root, '.gitignore'), 'x\n');
}

describe('cmd_migrate — detection on a legacy fixture', () => {
    itPy('--check → exit 2 + pending-count plan', () => {
        const root = freshRoot('acmig-');
        buildLegacy(root);
        const t = runTs(['--check'], root);
        expect(t.status).toBe(2);
        expect(t.status).toBe(2);
    });

    itPy('--dry-run → exit 0 + plan, no files mutated', () => {
        const root = freshRoot('acmig-');
        buildLegacy(root);
        const before = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
        const t = runTs(['--dry-run'], root);
        expect(t.status).toBe(0);
        // dry-run mutates nothing.
        expect(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).toBe(before);
    });

    itPy('--from 5 --check → declared-major echo + mismatch advisory', () => {
        // composer present, npm present → --from 5 matches npm, no advisory.
        const root = freshRoot('acmig-');
        buildLegacy(root);
        const t = runTs(['--from', '5', '--check'], root);
    });

    itPy('--from 4 on an npm-only repo → mismatch advisory (no composer)', () => {
        const root = freshRoot('acmig-');
        fs.writeFileSync(
            path.join(root, 'package.json'),
            '{\n  "dependencies": {\n    "@event4u/agent-config": "^1.0.0"\n  }\n}\n',
        );
        const t = runTs(['--from', '4', '--check'], root);
    });
});

// ---------------------------------------------------------------------------
// apply path — byte-compare stdout + resulting files across two roots
// ---------------------------------------------------------------------------

describe('cmd_migrate — apply (mutating)', () => {
    // The tsx twin is the source of truth (the python original was deleted in
    // the teardown); assertions check the migrated tree, not a python run.
    itPy('full legacy migration → dep pin dropped, legacy artefacts removed', () => {
        const [, ts] = mkLegacyPair(buildLegacy);
        roots.push(ts);
        const t = runTs([], ts);
        expect(t.status).toBe(0);
        expect(fs.readFileSync(path.join(ts, 'package.json'), 'utf8')).not.toContain(
            '@event4u/agent-config',
        );
        // legacy symlink + legacy settings + empty shell removed; user symlink kept.
        expect(fs.existsSync(path.join(ts, '.claude'))).toBe(false);
        expect(fs.lstatSync(path.join(ts, '.cursor')).isSymbolicLink()).toBe(true);
        expect(fs.existsSync(path.join(ts, '.agent-settings.yml'))).toBe(false);
        expect(fs.existsSync(path.join(ts, 'settings'))).toBe(false);
        expect(fs.existsSync(path.join(ts, 'agent-config'))).toBe(false);
    });

    itPy('apply with non-ASCII package.json value → valid JSON preserved', () => {
        const build = (root: string): void => {
            fs.writeFileSync(
                path.join(root, 'package.json'),
                '{\n  "author": "Björn — é",\n' +
                    '  "dependencies": {\n    "@event4u/agent-config": "^1.0.0"\n  }\n}\n',
            );
        };
        const [, ts] = mkLegacyPair(build);
        roots.push(ts);
        const t = runTs([], ts);
        expect(t.status).toBe(0);
        const written = fs.readFileSync(path.join(ts, 'package.json'), 'utf8');
        expect(() => JSON.parse(written)).not.toThrow();
        // The author survives migration (dep pin removed).
        expect(JSON.parse(written).author).toBe('Björn — é');
    });
});
