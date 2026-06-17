// Tests for src/scripts/_lib/knowledge_global_redaction.ts — the write-time
// redaction + tier gate. Security-sensitive: the redaction patterns are a
// privacy gate, so the clean path AND each forbidden-content class are
// golden-parity byte-compared against the Python original (stdout + exit).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN =
    process.env['TSX_BIN'] ??
    join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', '_lib', 'knowledge_global_redaction.ts');
const PY_SCRIPT = join(REPO_ROOT, 'src', 'scripts', '_lib', 'knowledge_global_redaction.py');

interface RunResult {
    readonly status: number;
    readonly stdout: string;
    readonly stderr: string;
}

function pythonAvailable(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = pythonAvailable();

let tmp: string;
beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'kgr-'));
});
afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
});

function write(name: string, body: string): string {
    const p = join(tmp, name);
    writeFileSync(p, body, 'utf-8');
    return p;
}

function runTs(args: readonly string[]): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}
function runPy(args: readonly string[]): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, PYTHONPATH: join(REPO_ROOT, 'src') },
    });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

/** Both implementations on the same card+tier — byte-identical contract. */
function bothMatch(file: string, tier: string): void {
    const ts = runTs([file, '--tier', tier]);
    if (HAVE_PYTHON) {
        const py = runPy([file, '--tier', tier]);
        expect(ts.stdout, `stdout ${file} ${tier}`).toBe(py.stdout);
        expect(ts.stderr, `stderr ${file} ${tier}`).toBe(py.stderr);
        expect(ts.status, `exit ${file} ${tier}`).toBe(py.status);
    }
}

describe('knowledge_global_redaction.ts — clean path', () => {
    it('clean public card is eligible (exit 0)', () => {
        const f = write('clean.md', '---\ntier: public\n---\n# Stripe webhooks\nUse the events endpoint.\n');
        const ts = runTs([f, '--tier', 'public']);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toContain('global-share eligible');
        bothMatch(f, 'public');
    });
});

describe('knowledge_global_redaction.ts — forbidden-content classes', () => {
    it('email → blocked (exit 1)', () => {
        const f = write('email.md', 'Contact alice@example.com about the API.\n');
        const ts = runTs([f, '--tier', 'public']);
        expect(ts.status).toBe(1);
        expect(ts.stdout).toContain('email:');
        bothMatch(f, 'public');
    });

    it('project path → blocked', () => {
        const f = write('path.md', 'See /Users/bob/secret/config.json for the value\n');
        expect(runTs([f, '--tier', 'vendor']).status).toBe(1);
        bothMatch(f, 'vendor');
    });

    it('internal hostname → blocked', () => {
        const f = write('host.md', 'Connect to db.internal for data\n');
        expect(runTs([f, '--tier', 'public']).status).toBe(1);
        bothMatch(f, 'public');
    });

    it('monetary amount → blocked', () => {
        const f = write('money.md', 'Costs $1,234 per month and USD 500 extra\n');
        expect(runTs([f, '--tier', 'vendor']).status).toBe(1);
        bothMatch(f, 'vendor');
    });

    it('inline api_key secret → blocked', () => {
        const f = write('secret.md', 'config: api_key=ABCDEF0123456789abcdef\n');
        expect(runTs([f, '--tier', 'public']).status).toBe(1);
        bothMatch(f, 'public');
    });

    it('long code excerpt → blocked', () => {
        const f = write(
            'code.md',
            'Run `this is a very long inline code excerpt over forty chars indeed`\n',
        );
        expect(runTs([f, '--tier', 'public']).status).toBe(1);
        bothMatch(f, 'public');
    });

    it('multiple violations in one card → all surfaced', () => {
        const f = write(
            'multi.md',
            'Email alice@example.com, path /home/x/y, host api.local, cost €99\n',
        );
        expect(runTs([f, '--tier', 'public']).status).toBe(1);
        bothMatch(f, 'public');
    });
});

describe('knowledge_global_redaction.ts — tier gate', () => {
    it('proprietary tier → blocked manual-only (exit 1)', () => {
        const f = write('clean2.md', 'nothing sensitive here at all\n');
        const ts = runTs([f, '--tier', 'proprietary']);
        expect(ts.status).toBe(1);
        expect(ts.stdout).toContain('proprietary tier');
        bothMatch(f, 'proprietary');
    });
});

describe('knowledge_global_redaction.ts — usage', () => {
    it('missing --tier → exit 2', () => {
        const f = write('x.md', 'hello\n');
        const ts = runTs([f]);
        expect(ts.status).toBe(2);
        if (HAVE_PYTHON) {
            expect(ts.status).toBe(runPy([f]).status);
        }
    });

    it('invalid --tier choice → exit 2', () => {
        const f = write('x.md', 'hello\n');
        const ts = runTs([f, '--tier', 'bogus']);
        expect(ts.status).toBe(2);
        if (HAVE_PYTHON) {
            expect(ts.status).toBe(runPy([f, '--tier', 'bogus']).status);
        }
    });
});
