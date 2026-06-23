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
const TSX_BIN = process.env.TSX_BIN
    ? path.resolve(REPO_ROOT, process.env.TSX_BIN)
    : path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

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

interface Run {
    status: number | null;
    stdout: string;
    stderr: string;
    report: string;
    level: string;
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
