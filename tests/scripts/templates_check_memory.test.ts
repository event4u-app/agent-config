// Golden-parity tests for src/agent-src/templates/scripts/check_memory.ts.
//
// CONSUMER-shipped template twin. The template `.py` is the leaner consumer
// surface — NO `--shadow-report`, NO priority / date-discipline / critical-stale
// / tier-0-inflation checks (those are dev-side-only). Tests differential python3
// vs tsx on the template files. The scanned root is taken from `--path`, and
// `str(Path)` of relative roots is CWD-relative, so both processes run with `cwd`
// set to a tmp fixture tree and a relative `--path agents/memory`. ADR-094 parity
// contract: byte-identical stdout/stderr/exit. argparse prog token
// (check_memory.py vs check_memory) is filename-derived, not parity.
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
const TS_SCRIPT = join(DIR, 'check_memory.ts');
const PY_SCRIPT = join(DIR, 'check_memory.py');

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
    return s.replace(/check_memory\.py/g, 'check_memory').trimEnd();
}
// Python argparse prefixes a `usage:` block whose line-wrapping is
// terminal-width-dependent — NOT a stable parity contract. The byte-identical
// contract is the trailing `<prog>: error: <msg>` line.
function errorLine(stderr: string): string {
    const lines = normProg(stderr).split('\n');
    const found = lines.find((l) => /^check_memory: error:/.test(l));
    return found ?? normProg(stderr);
}

const REQUIRED = [
    'id: own-1',
    'status: active',
    'confidence: high',
    'source:',
    '  - ADR-1',
    'owner: team',
    'last_validated: 2026-01-01',
    'review_after_days: 180',
];

describe.skipIf(!HAVE_PYTHON)('templates/check_memory — golden parity', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = mkdtempSync(join(tmpdir(), 'tpl-cm-'));
        mkdirSync(join(tmp, 'agents', 'memory', 'ownership'), { recursive: true });
    });
    afterEach(() => {
        rmSync(tmp, { recursive: true, force: true });
    });

    function writeYml(rel: string, body: string): void {
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

    it('missing path parity (info, exit 0)', () => {
        bothEqual(['--path', 'agents/memory/nope']);
    });

    it('missing path JSON parity', () => {
        bothEqual(['--path', 'agents/memory/nope', '--format', 'json']);
    });

    it('valid entries parity (clean)', () => {
        writeYml('domain-invariants/d.yml', `entries:\n  - ${REQUIRED.join('\n    ')}\n`);
        bothEqual(['--path', 'agents/memory']);
    });

    it('missing required fields parity (errors, sorted)', () => {
        writeYml('domain-invariants/bad.yml', 'entries:\n  - id: x\n    status: active\n');
        bothEqual(['--path', 'agents/memory']);
    });

    it('redaction leak parity (inline credential + internal ip)', () => {
        writeYml(
            'incident-learnings/leak.yml',
            ['entries:', '  - id: y', '    note: "api_key=ABCDEFGH12345678"', '    host: 10.0.0.5'].join('\n') + '\n',
        );
        bothEqual(['--path', 'agents/memory']);
    });

    it('unknown memory type parity (warning)', () => {
        writeYml('weird-type/w.yml', 'entries: []\n');
        bothEqual(['--path', 'agents/memory']);
    });

    it('duplicate id parity (error)', () => {
        writeYml(
            'product-rules/dup.yml',
            `entries:\n  - ${REQUIRED.join('\n    ')}\n  - ${REQUIRED.join('\n    ')}\n`,
        );
        bothEqual(['--path', 'agents/memory']);
    });

    it('missing top-level entries parity (error)', () => {
        writeYml('architecture-decisions/noentries.yml', 'id: z\nfoo: bar\n');
        bothEqual(['--path', 'agents/memory']);
    });

    it('stale entry parity (info)', () => {
        writeYml(
            'domain-invariants/stale.yml',
            [
                'entries:',
                '  - id: old-1',
                '    status: active',
                '    confidence: high',
                '    source:',
                '      - ADR-1',
                '    owner: team',
                '    last_validated: 2000-01-01',
                '    review_after_days: 1',
            ].join('\n') + '\n',
        );
        bothEqual(['--path', 'agents/memory']);
    });

    it('JSON format parity over mixed findings', () => {
        writeYml('domain-invariants/bad.yml', 'entries:\n  - id: x\n    status: nope\n');
        bothEqual(['--path', 'agents/memory', '--format', 'json']);
    });

    it('unrecognized arg parity (exit 2)', () => {
        const ts = runTs(['--bogus'], tmp);
        const py = runPy(['--bogus'], tmp);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
        expect(errorLine(ts.stderr)).toBe(errorLine(py.stderr));
    });

    it('invalid --format choice parity (exit 2)', () => {
        const ts = runTs(['--format', 'xml'], tmp);
        const py = runPy(['--format', 'xml'], tmp);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
        expect(errorLine(ts.stderr)).toBe(errorLine(py.stderr));
    });
});
