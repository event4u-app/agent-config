// Tests for src/scripts/lint_agent_skill_names.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the public helpers (_frontmatter_name, _spec_violation) plus a
// golden-parity layer that runs python3 vs tsx on the REAL REPO across the
// real CI args (default + --quiet), asserting byte-identical
// stdout/stderr/exit. Golden parity is skipped without python3.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_agent_skill_names.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_agent_skill_names.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_agent_skill_names.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_agent_skill_names — behavioural spec', () => {
    // --- _frontmatter_name ---
    it('extracts a quoted name from frontmatter', () => {
        expect(mod._frontmatter_name('---\nname: "foo-bar"\ndescription: x\n---\nbody')).toBe(
            'foo-bar',
        );
    });

    it('extracts a single-quoted name', () => {
        expect(mod._frontmatter_name("---\nname: 'baz'\n---\n")).toBe('baz');
    });

    it('returns null when there is no opening fence', () => {
        expect(mod._frontmatter_name('no fence\nname: x\n')).toBeNull();
    });

    it('returns null when name is absent', () => {
        expect(mod._frontmatter_name('---\ndescription: x\n---\n')).toBeNull();
    });

    // --- _spec_violation ---
    it('passes a valid hyphen slug', () => {
        expect(mod._spec_violation('code-refactoring')).toBeNull();
        expect(mod._spec_violation('a1')).toBeNull();
    });

    it('flags an over-long name', () => {
        const long = 'a'.repeat(65);
        expect(mod._spec_violation(long)).toBe('longer than 64 chars');
    });

    it('flags a colon-namespaced name', () => {
        const v = mod._spec_violation('council:default');
        expect(v).not.toBeNull();
        expect(v).toContain('lowercase letters');
    });

    it('flags leading/trailing/double hyphens and uppercase', () => {
        expect(mod._spec_violation('-foo')).not.toBeNull();
        expect(mod._spec_violation('foo-')).not.toBeNull();
        expect(mod._spec_violation('foo--bar')).not.toBeNull();
        expect(mod._spec_violation('Foo')).not.toBeNull();
    });

    // --- check helpers run against the real repo without throwing ---
    it('check_commands + check_skills return arrays on the real repo', () => {
        expect(Array.isArray(mod.check_commands())).toBe(true);
        expect(Array.isArray(mod.check_skills())).toBe(true);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_agent_skill_names — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    it('matches the default run byte-for-byte', () => {
        const py = runPy([]);
        const ts = runTs([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('matches the --quiet run byte-for-byte', () => {
        const py = runPy(['--quiet']);
        const ts = runTs(['--quiet']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('--help exits 0 and prints a usage line (not a parity contract)', () => {
        const ts = runTs(['--help']);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toContain('usage:');
    });
});
