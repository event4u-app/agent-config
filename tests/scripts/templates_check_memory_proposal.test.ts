// Golden-parity tests for src/agent-src/templates/scripts/check_memory_proposal.ts.
//
// CONSUMER-shipped template twin. The template `.py` differs from the dev-side
// only by lacking the `--quiet` flag, so this twin drops `--quiet` and its
// gate-passed line always prints. Tests differential python3 vs tsx on the
// template files. INTAKE_ROOT is `agents/memory/intake` relative to CWD, so both
// processes run with `cwd` set to a tmp fixture tree. ADR-094 parity contract:
// byte-identical stdout/stderr/exit. argparse prog token (check_memory_proposal.py
// vs check_memory_proposal) is filename-derived, not parity — normalized away.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN =
    process.env['TSX_BIN'] !== undefined
        ? resolve(REPO_ROOT, process.env['TSX_BIN'])
        : join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const DIR = join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const TS_SCRIPT = join(DIR, 'check_memory_proposal.ts');
const PY_SCRIPT = join(DIR, 'check_memory_proposal.py');

function pythonAvailable(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = pythonAvailable();

interface Run {
    stdout: string;
    stderr: string;
    status: number;
}
function runTs(args: readonly string[], cwd: string): Run {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status ?? -1 };
}
function runPy(args: readonly string[], cwd: string): Run {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status ?? -1 };
}
function normProg(s: string): string {
    return s.replace(/check_memory_proposal\.py/g, 'check_memory_proposal').trimEnd();
}
// Python argparse prefixes a `usage:` block whose line-wrapping is
// terminal-width-dependent (COLUMNS / shutil.get_terminal_size) — NOT a stable
// parity contract, like the filename-derived prog token. The byte-identical
// contract is the trailing `<prog>: error: <msg>` line; extract just that.
function errorLine(stderr: string): string {
    const lines = normProg(stderr).split('\n');
    const found = lines.find((l) => /^check_memory_proposal: error:/.test(l));
    return found ?? normProg(stderr);
}

describe.skipIf(!HAVE_PYTHON)('templates/check_memory_proposal — golden parity', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = mkdtempSync(join(tmpdir(), 'tpl-cmp-'));
        mkdirSync(join(tmp, 'agents', 'memory', 'intake'), { recursive: true });
    });
    afterEach(() => {
        rmSync(tmp, { recursive: true, force: true });
    });

    function bothEqual(args: readonly string[]): void {
        const ts = runTs(args, tmp);
        const py = runPy(args, tmp);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    }

    it('--proposal gate pass parity (line always prints — no --quiet)', () => {
        const p = join(tmp, 'p.yml');
        writeFileSync(
            p,
            [
                'id: sig-1',
                'entry_type: ownership',
                'path: app/Http',
                'body: x',
                'future_decisions:',
                '  - {decision: a, expected_by: 2026-01-01, owner: me}',
                '  - {decision: b, expected_by: 2026-01-02, owner: me}',
                '  - {decision: c, expected_by: 2026-01-03, owner: me}',
            ].join('\n') + '\n',
        );
        bothEqual(['--proposal', 'p.yml']);
    });

    it('--proposal gate fail parity (missing fields + bad type + weak fds)', () => {
        const p = join(tmp, 'bad.yml');
        writeFileSync(p, ['id: x', 'entry_type: not-a-type', 'body: y'].join('\n') + '\n');
        bothEqual(['--proposal', 'bad.yml']);
    });

    it('--proposal gate fail JSON parity', () => {
        const p = join(tmp, 'bad.yml');
        writeFileSync(p, ['id: x', 'entry_type: bogus'].join('\n') + '\n');
        bothEqual(['--proposal', 'bad.yml', '--format', 'json']);
    });

    it('--proposal non-mapping parity (exit 1)', () => {
        const p = join(tmp, 'list.yml');
        writeFileSync(p, '- a\n- b\n');
        const ts = runTs(['--proposal', 'list.yml'], tmp);
        const py = runPy(['--proposal', 'list.yml'], tmp);
        // stderr contains the absolute proposal path; normalize CWD-relative.
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(1);
    });

    it('--intake-id found parity (pattern via ≥2 sibling paths)', () => {
        const intake = join(tmp, 'agents', 'memory', 'intake', 'a.jsonl');
        writeFileSync(
            intake,
            [
                JSON.stringify({ id: 'i-1', entry_type: 'ownership', path: 'app/A', body: 'shared' }),
                JSON.stringify({ id: 'i-2', entry_type: 'ownership', path: 'app/B', body: 'shared' }),
            ].join('\n') + '\n',
        );
        bothEqual(['--intake-id', 'i-1']);
    });

    it('--intake-id not-found parity (exit 1)', () => {
        bothEqual(['--intake-id', 'does-not-exist']);
    });

    it('mutually-exclusive args parity (exit 2)', () => {
        const p = join(tmp, 'p.yml');
        writeFileSync(p, 'id: x\n');
        const ts = runTs(['--proposal', 'p.yml', '--intake-id', 'z'], tmp);
        const py = runPy(['--proposal', 'p.yml', '--intake-id', 'z'], tmp);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
        expect(errorLine(ts.stderr)).toBe(errorLine(py.stderr));
    });

    it('no required group parity (exit 2)', () => {
        const ts = runTs([], tmp);
        const py = runPy([], tmp);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
        expect(errorLine(ts.stderr)).toBe(errorLine(py.stderr));
    });
});
