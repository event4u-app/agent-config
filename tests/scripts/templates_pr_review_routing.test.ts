// Tests for src/agent-src/templates/scripts/pr_review_routing.ts (ADR-094).
//
// Template-only script. Golden-parity suite: python3 vs tsx on throwaway git
// fixtures, byte-identical stdout / stderr / exit + the two written files.
// argparse --help is NOT byte-compared. The staleness branch is exercised
// with a > 6-month-old `updated:` date so the wall-clock comparison is
// deterministic (both interpreters read the same fixed past date).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import * as prr from '../../src/agent-src/templates/scripts/pr_review_routing.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'pr_review_routing.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'pr_review_routing.py');
const TSX_BIN = process.env.TSX_BIN
    ? path.resolve(REPO_ROOT, process.env.TSX_BIN)
    : path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-route-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop();
        if (d && fs.existsSync(d)) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

function git(cwd: string, ...args: string[]): void {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
    }
}

function makeRepo(files: Record<string, string>): { dir: string; base: string; head: string } {
    const dir = mkTmp();
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 't@t.t');
    git(dir, 'config', 'user.name', 't');
    for (const [rel, body] of Object.entries(files)) {
        const full = path.join(dir, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, body);
    }
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'base');
    const base = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
    for (const rel of Object.keys(files)) {
        fs.appendFileSync(path.join(dir, rel), 'change\n');
    }
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'change');
    const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
    return { dir, base, head };
}

interface Run {
    status: number | null;
    stdout: string;
    stderr: string;
    report: string;
    level: string;
}

function runScript(bin: string, script: string, cwd: string, args: string[], tag: string): Run {
    const outRel = `${tag}-routing.md`;
    const lvlRel = `${tag}-level.txt`;
    const r = spawnSync(bin, [script, ...args, '--output', outRel, '--level-file', lvlRel], {
        cwd,
        encoding: 'utf8',
    });
    const readOr = (rel: string): string => {
        try {
            return fs.readFileSync(path.join(cwd, rel), 'utf8');
        } catch {
            return ' MISSING ';
        }
    };
    return {
        status: r.status,
        stdout: r.stdout,
        stderr: r.stderr,
        report: readOr(outRel),
        level: readOr(lvlRel),
    };
}

function assertParity(dir: string, base: string, head: string, extra: string[] = []): void {
    const args = ['--base', base, '--head', head, ...extra];
    const py = runScript('python3', PY_SCRIPT, dir, args, 'py');
    const ts = runScript(TSX_BIN, TS_SCRIPT, dir, args, 'ts');
    expect(ts.status).toBe(py.status);
    expect(ts.stdout).toBe(py.stdout);
    expect(ts.stderr).toBe(py.stderr);
    expect(ts.report).toBe(py.report);
    expect(ts.level).toBe(py.level);
}

const OWN_YML = [
    'version: 1',
    'updated: 2020-01-01',
    'defaults:',
    '  roles: [generalist]',
    'entries:',
    '  - paths: ["app/auth/**"]',
    '    roles: [security-reviewer, backend]',
    '    focus: auth',
    '    risk: high',
    '  - paths: ["db/migrations/**"]',
    '    roles: [dba]',
    '    focus: schema',
    '',
].join('\n');

const PAT_YML = [
    'version: 1',
    'patterns:',
    '  - id: auth-bypass',
    '    label: Auth bypass regression',
    '    severity: high',
    '    required_test: tests/auth_test.php',
    '    references: [PROJ-1, PROJ-2]',
    '    paths: ["app/auth/**"]',
    '  - id: route-leak',
    '    severity: medium',
    '    paths: ["app/routes/**"]',
    '',
].join('\n');

describe('pr_review_routing — pure helpers', () => {
    it('overall_level rises to the highest matched severity', () => {
        expect(prr.overall_level([])).toBe('low');
        expect(prr.overall_level([{ id: 'a', label: 'a', severity: 'medium', required_test: '', references: [], matched_files: ['x'] }])).toBe('medium');
        expect(prr.overall_level([{ id: 'a', label: 'a', severity: 'high', required_test: '', references: [], matched_files: ['x'] }])).toBe('high');
    });

    it('_merge_roles orders by file-hit count then role name, sorted notes/files', () => {
        const hits = [
            { path: 'a.php', roles: ['backend'], focus: 'x', risk: null },
            { path: 'b.php', roles: ['backend', 'security'], focus: 'y', risk: null },
        ];
        const merged = prr._merge_roles(hits, []);
        // backend touches 2 files, security touches 1 → backend first.
        expect(merged[0]![0]).toBe('backend');
        expect(merged[0]![2]).toEqual(['a.php', 'b.php']);
        expect(merged[0]![1]).toEqual(['x', 'y']);
        expect(merged[1]![0]).toBe('security');
    });

    it('_merge_roles falls back to default roles when no ownership hit', () => {
        const merged = prr._merge_roles([], ['generalist', 'reviewer']);
        expect(merged.map((m) => m[0])).toEqual(['generalist', 'reviewer']);
    });
});

describe.runIf(hasPython3())('pr_review_routing — golden parity (python3 vs tsx)', () => {
    it('no config files — generic fallback block', () => {
        const { dir, base, head } = makeRepo({ 'app/auth/login.php': 'a\n', 'app/routes/web.php': 'b\n' });
        assertParity(dir, base, head);
    });

    it('ownership + patterns + stale map (deterministic past date)', () => {
        const { dir, base, head } = makeRepo({
            'app/auth/login.php': 'a\n',
            'app/routes/web.php': 'b\n',
            'db/migrations/001.php': 'c\n',
        });
        fs.writeFileSync(path.join(dir, 'own.yml'), OWN_YML);
        fs.writeFileSync(path.join(dir, 'pat.yml'), PAT_YML);
        assertParity(dir, base, head, ['--ownership-map', 'own.yml', '--patterns', 'pat.yml']);
    });

    it('ownership only — fallback roles, no historical patterns', () => {
        const { dir, base, head } = makeRepo({ 'src/x.ts': 'a\n' });
        fs.writeFileSync(path.join(dir, 'own.yml'), OWN_YML);
        assertParity(dir, base, head, ['--ownership-map', 'own.yml']);
    });

    it('auto-discovers .github/ then agents/ candidates', () => {
        const { dir, base, head } = makeRepo({ 'app/auth/login.php': 'a\n' });
        fs.mkdirSync(path.join(dir, 'agents'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'agents/ownership-map.yml'), OWN_YML);
        fs.writeFileSync(path.join(dir, 'agents/historical-bug-patterns.yml'), PAT_YML);
        assertParity(dir, base, head);
    });

    it('unsupported version → byte-identical error + exit 3', () => {
        const { dir, base, head } = makeRepo({ 'app/auth/login.php': 'a\n' });
        fs.writeFileSync(path.join(dir, 'bad.yml'), 'version: 2\n');
        const args = ['--base', base, '--head', head, '--ownership-map', 'bad.yml'];
        const py = runScript('python3', PY_SCRIPT, dir, args, 'py');
        const ts = runScript(TSX_BIN, TS_SCRIPT, dir, args, 'ts');
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(3);
        expect(ts.stderr).toBe(py.stderr);
    });
});
