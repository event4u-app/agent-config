// Tests for src/scripts/lint_load_context.ts (py2ts Phase 4 / Wave 4b).
//
// tests/test_load_context.py does NOT exercise this module — it pins a rule
// frontmatter contract via _lib.agent_src. So this is a focused differential
// suite over the linter's public helpers (find_cycles, cap_for, resolve_entry,
// parse_frontmatter) plus a golden-parity layer running python3 vs tsx on the
// REAL REPO (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as lc from '../../src/scripts/lint_load_context.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_load_context.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_load_context.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_load_context.find_cycles', () => {
    it('finds no cycle in an acyclic graph', () => {
        expect(lc.find_cycles({ a: ['b'], b: ['c'], c: [] })).toEqual([]);
    });
    it('detects a direct self-loop', () => {
        const cycles = lc.find_cycles({ a: ['a'] });
        expect(cycles).toEqual([['a', 'a']]);
    });
    it('detects a two-node cycle', () => {
        const cycles = lc.find_cycles({ a: ['b'], b: ['a'] });
        expect(cycles).toEqual([['a', 'b', 'a']]);
    });
    it('handles a dangling edge to an undeclared node', () => {
        // graph.get(node, []) → [] for missing nodes; no crash, no cycle.
        expect(lc.find_cycles({ a: ['ghost'] })).toEqual([]);
    });
});

describe('lint_load_context.cap_for', () => {
    it('returns the safety cap for hard-floor rules', () => {
        expect(lc.cap_for('non-destructive-by-default.md', {})).toBe(lc.CAP_SAFETY);
        expect(lc.cap_for('security-sensitive-stop.md', {})).toBe(lc.CAP_SAFETY);
    });
    it('returns the always cap for type: always', () => {
        expect(lc.cap_for('some-rule.md', { type: 'always' })).toBe(lc.CAP_ALWAYS);
    });
    it('returns the auto cap for type: auto and as the default', () => {
        expect(lc.cap_for('some-rule.md', { type: 'auto' })).toBe(lc.CAP_AUTO);
        expect(lc.cap_for('some-rule.md', {})).toBe(lc.CAP_AUTO);
    });
    it('strips quotes off the type value', () => {
        expect(lc.cap_for('some-rule.md', { type: '"always"' })).toBe(lc.CAP_ALWAYS);
    });
});

describe('lint_load_context.resolve_entry', () => {
    it('resolves logical names under the source root', () => {
        const p = lc.resolve_entry('contexts/area/file.md');
        expect(p.endsWith(path.join('.agent-src.uncondensed', 'contexts', 'area', 'file.md'))).toBe(
            true,
        );
    });
    it('resolves other prefixes repo-root-relative', () => {
        const p = lc.resolve_entry('agents/settings/contexts/x.md');
        expect(p.endsWith(path.join('agents', 'settings', 'contexts', 'x.md'))).toBe(true);
    });
});

describe('lint_load_context.parse_frontmatter', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('parses a YAML frontmatter block to an object', () => {
        const p = path.join(tmp, 'r.md');
        fs.writeFileSync(p, '---\ntype: always\nload_context:\n  - contexts/a/b.md\n---\nbody\n');
        const fm = lc.parse_frontmatter(p);
        expect(fm['type']).toBe('always');
        expect(fm['load_context']).toEqual(['contexts/a/b.md']);
    });
    it('returns {} when there is no frontmatter', () => {
        const p = path.join(tmp, 'r.md');
        fs.writeFileSync(p, 'no frontmatter here\n');
        expect(lc.parse_frontmatter(p)).toEqual({});
    });
    it('returns {} for a list-typed frontmatter document', () => {
        const p = path.join(tmp, 'r.md');
        fs.writeFileSync(p, '---\n- a\n- b\n---\n');
        expect(lc.parse_frontmatter(p)).toEqual({});
    });
});

// --- Golden parity on the REAL REPO ----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_load_context — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function same(args: readonly string[]): void {
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    }

    it('default run matches byte-for-byte', () => same([]));
    it('--quiet matches byte-for-byte', () => same(['--quiet']));
});
