// Tests for src/scripts/_lib/knowledge_global.ts — the file-first global
// knowledge-card lib (store path, config, origin-tier, provenance).
//
// 1:1 golden-parity port (ADR-200): each case spawns python3 + tsx on
// identical inputs and asserts byte-identical stdout / stderr / exit. The
// argparse `--help` / error usage-prose is NOT byte-compared (prog-name +
// terminal-width wrapping differ by construction); only exit codes are.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN =
    process.env['TSX_BIN'] ??
    join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', '_lib', 'knowledge_global.ts');
const PY_SCRIPT = join(REPO_ROOT, 'src', 'scripts', '_lib', 'knowledge_global.py');

interface RunResult {
    readonly status: number;
    readonly stdout: string;
    readonly stderr: string;
}

function pythonAvailable(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = pythonAvailable();

let home: string;
beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'kg-home-'));
});
afterEach(() => {
    rmSync(home, { recursive: true, force: true });
});

function env(): NodeJS.ProcessEnv {
    return { ...process.env, EVENT4U_CONFIG_HOME: home };
}

function runTs(args: readonly string[]): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8', env: env() });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}
function runPy(args: readonly string[]): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...env(), PYTHONPATH: join(REPO_ROOT, 'src') },
    });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

/** Replace the resolved $HOME store path so the two runs are comparable. */
function normHome(s: string): string {
    return s.split(home).join('<HOME>');
}

describe('knowledge_global.ts — classify', () => {
    const cases: string[] = [
        'https://github.com/foo/bar',
        'https://api.stripe.com/v1/charges',
        'https://registry.npmjs.org/express',
        'https://docs.aws.amazon.com/x', // amazonaws.com is vendor, this host is docs.aws.amazon.com
        'postgres://localhost:5432/db',
        'app/Models/User.php',
        'https://10.0.0.1/internal',
        'https://192.168.1.5/admin',
        'db.internal/schema',
        'service.local',
        '',
        'unknown.example.org/page',
        'file:///etc/hosts',
        'C:\\\\Users\\\\x',
        'https://gitlab.com/g/p',
        'https://sub.openai.com/v1',
    ];
    for (const src of cases) {
        it(`classify ${JSON.stringify(src)}`, () => {
            const ts = runTs(['classify', src]);
            expect(ts.status).toBe(0);
            if (HAVE_PYTHON) {
                const py = runPy(['classify', src]);
                expect(ts.stdout).toBe(py.stdout);
                expect(ts.stderr).toBe(py.stderr);
                expect(ts.status).toBe(py.status);
            }
        });
    }
});

describe('knowledge_global.ts — store-path + config', () => {
    it('store-path matches (normalized)', () => {
        const ts = runTs(['store-path']);
        expect(ts.status).toBe(0);
        expect(ts.stdout.trim().endsWith(join('knowledge'))).toBe(true);
        if (HAVE_PYTHON) {
            const py = runPy(['store-path']);
            expect(normHome(ts.stdout)).toBe(normHome(py.stdout));
            expect(ts.status).toBe(py.status);
        }
    });

    it('config emits sorted-key JSON defaults', () => {
        const ts = runTs(['config']);
        expect(ts.status).toBe(0);
        // The default config is sharing-ON for the safe tiers.
        expect(ts.stdout).toContain('"enabled": true');
        expect(ts.stdout).toContain('"auto_promote_threshold": 2');
        if (HAVE_PYTHON) {
            const py = runPy(['config']);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        }
    });
});

describe('knowledge_global.ts — usage / edge', () => {
    it('no subcommand → help to stdout, exit 1', () => {
        const ts = runTs([]);
        expect(ts.status).toBe(1);
        expect(ts.stdout).toContain('usage:');
        if (HAVE_PYTHON) {
            // Exit code parity only — argparse help prose differs (prog name).
            expect(ts.status).toBe(runPy([]).status);
        }
    });

    it('unknown subcommand → argparse error, exit 2', () => {
        const ts = runTs(['bogus']);
        expect(ts.status).toBe(2);
        expect(ts.stderr).toContain('error:');
        if (HAVE_PYTHON) {
            expect(ts.status).toBe(runPy(['bogus']).status);
        }
    });

    it('classify with no source → required-arg error, exit 2', () => {
        const ts = runTs(['classify']);
        expect(ts.status).toBe(2);
        if (HAVE_PYTHON) {
            expect(ts.status).toBe(runPy(['classify']).status);
        }
    });
});
