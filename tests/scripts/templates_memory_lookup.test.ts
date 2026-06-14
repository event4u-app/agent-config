// Golden-parity tests for src/agent-src/templates/scripts/memory_lookup.ts.
//
// CONSUMER-shipped template twin. The template `.py` is the leaner consumer
// surface — NO `knowledge` / `cross-repo` types, NO `_iter_knowledge_entries`,
// NO `_cross_repo_hits`; `memory_status` is a guarded late import that degrades
// to file-only retrieval when absent (which it is in the template tree). Tests
// differential python3 vs tsx on the template files. MEMORY_ROOT / INTAKE_ROOT
// are `agents/memory[/intake]` relative to CWD, so both processes run with `cwd`
// set to a tmp fixture tree. ADR-094 parity contract: byte-identical
// stdout/stderr/exit. argparse prog token (memory_lookup.py vs memory_lookup) is
// filename-derived, not parity. `--auto` resolves no operational backend in the
// template (no memory_status twin) so it degrades to file-only — same as python3
// where the sibling `memory_status` status probe returns "absent" (no installed
// @event4u/agent-memory npm pkg) under the tmp cwd.
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
const TS_SCRIPT = join(DIR, 'memory_lookup.ts');
const PY_SCRIPT = join(DIR, 'memory_lookup.py');

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
    // Plain python3 — `--auto` imports the sibling `memory_status.py`, whose
    // bounded status probe returns "absent" (no @event4u/agent-memory npm pkg
    // installed under the tmp cwd) → `package_operational_provider()` returns
    // None → file-only retrieval. The TS template ships no `memory_status` twin,
    // so its guarded `createRequire('./memory_status.js')` throws → null → also
    // file-only. Both degrade identically. (`-I` would break PyYAML import.)
    const r = spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status ?? -1 };
}
function normProg(s: string): string {
    return s.replace(/memory_lookup\.py/g, 'memory_lookup').trimEnd();
}
// Python argparse prefixes a `usage:` block whose line-wrapping is
// terminal-width-dependent — NOT a stable parity contract. The byte-identical
// contract is the trailing `<prog>: error: <msg>` line.
function errorLine(stderr: string): string {
    const lines = normProg(stderr).split('\n');
    const found = lines.find((l) => /^memory_lookup: error:/.test(l));
    return found ?? normProg(stderr);
}

const CURATED_ENTRY = [
    '  - id: own-1',
    '    status: active',
    '    confidence: high',
    '    source:',
    '      - ADR-1',
    '    owner: team',
    '    last_validated: 2026-01-01',
    '    review_after_days: 180',
    '    path: "app/Http/Controllers/Billing"',
];

describe.skipIf(!HAVE_PYTHON)('templates/memory_lookup — golden parity', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = mkdtempSync(join(tmpdir(), 'tpl-ml-'));
        mkdirSync(join(tmp, 'agents', 'memory', 'intake'), { recursive: true });
    });
    afterEach(() => {
        rmSync(tmp, { recursive: true, force: true });
    });

    function writeMem(rel: string, body: string): void {
        const full = join(tmp, 'agents', 'memory', rel);
        mkdirSync(join(full, '..'), { recursive: true });
        writeFileSync(full, body);
    }

    function bothEqual(args: readonly string[]): void {
        const ts = runTs(args, tmp);
        const py = runPy(args, tmp);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    }

    it('no memory tree → no hits parity (text)', () => {
        bothEqual(['--types', 'ownership', '--key', 'billing']);
    });

    it('curated single-file layout parity (text)', () => {
        writeMem('ownership.yml', `entries:\n${CURATED_ENTRY.join('\n')}\n`);
        bothEqual(['--types', 'ownership', '--key', 'Billing']);
    });

    it('curated content-addressed layout parity (text)', () => {
        writeMem(
            'domain-invariants/abc123.yml',
            [
                'id: inv-1',
                'status: active',
                'path: "app/Domain/Money"',
                'rule: "amounts are integers"',
            ].join('\n') + '\n',
        );
        bothEqual(['--types', 'domain-invariants', '--key', 'money']);
    });

    it('intake supersede-chain parity (json)', () => {
        const intake = join(tmp, 'agents', 'memory', 'intake', 'a.jsonl');
        writeFileSync(
            intake,
            [
                JSON.stringify({ id: 'k-1', entry_type: 'ownership', path: 'app/Old', body: 'old' }),
                JSON.stringify({ id: 'k-2', entry_type: 'ownership', path: 'app/Billing', body: 'billing owner' }),
                JSON.stringify({ type: 'supersede', supersedes: 'k-1' }),
            ].join('\n') + '\n',
        );
        bothEqual(['--types', 'ownership', '--key', 'billing', '--format', 'json']);
    });

    it('json format parity over curated + intake', () => {
        writeMem('ownership.yml', `entries:\n${CURATED_ENTRY.join('\n')}\n`);
        const intake = join(tmp, 'agents', 'memory', 'intake', 'b.jsonl');
        writeFileSync(
            intake,
            JSON.stringify({ id: 'k-9', entry_type: 'ownership', path: 'app/Http', body: 'b' }) + '\n',
        );
        bothEqual(['--types', 'ownership', '--key', 'app/Http', '--format', 'json']);
    });

    it('v1 envelope parity (known + unknown type)', () => {
        writeMem('ownership.yml', `entries:\n${CURATED_ENTRY.join('\n')}\n`);
        bothEqual(['--types', 'ownership,bogus-type', '--key', 'billing', '--envelope', 'v1']);
    });

    it('--with-shadows parity (no operational backend → empty shadows)', () => {
        writeMem('ownership.yml', `entries:\n${CURATED_ENTRY.join('\n')}\n`);
        bothEqual(['--types', 'ownership', '--key', 'billing', '--with-shadows', '--format', 'json']);
    });

    it('--auto with absent backend parity (file-only)', () => {
        writeMem('ownership.yml', `entries:\n${CURATED_ENTRY.join('\n')}\n`);
        bothEqual(['--types', 'ownership', '--key', 'billing', '--auto']);
    });

    it('limit clamps result count parity', () => {
        writeMem(
            'ownership.yml',
            'entries:\n' +
                [0, 1, 2, 3, 4]
                    .map((n) => `  - id: own-${n}\n    path: "app/Http/${n}"\n    status: active`)
                    .join('\n') +
                '\n',
        );
        bothEqual(['--types', 'ownership', '--key', 'app/Http', '--limit', '2', '--format', 'json']);
    });

    it('no hits text branch parity (empty key, no entries)', () => {
        bothEqual(['--types', 'incident-learnings']);
    });

    it('missing --types parity (exit 2)', () => {
        bothEqual(['--key', 'x']);
    });

    it('unrecognized arg parity (exit 2)', () => {
        const ts = runTs(['--bogus'], tmp);
        const py = runPy(['--bogus'], tmp);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
        expect(errorLine(ts.stderr)).toBe(errorLine(py.stderr));
    });
});
