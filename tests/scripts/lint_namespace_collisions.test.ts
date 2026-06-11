// Tests for src/scripts/lint_namespace_collisions.ts (py2ts Phase 4 / Wave 4b).
//
// No tests/test_lint_namespace_collisions.py exists. This is a focused
// differential suite over the exported pure helpers (_normalize, _category,
// _artefact_name, _NAMESPACE) plus a golden-parity layer running python3 vs
// tsx on the REAL REPO (the linter's real CI invocation), skipped without
// python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as nc from '../../src/scripts/lint_namespace_collisions.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_namespace_collisions.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_namespace_collisions.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_namespace_collisions._normalize', () => {
    it('lowercases and maps _ and : to -', () => {
        expect(nc._normalize('Foo_Bar:Baz')).toBe('foo-bar-baz');
    });
    it('trims surrounding whitespace', () => {
        expect(nc._normalize('  spaced  ')).toBe('spaced');
    });
});

describe('lint_namespace_collisions._category', () => {
    it('recognises skills / rules / commands tops', () => {
        expect(nc._category('skills/foo/SKILL.md')).toBe('skills');
        expect(nc._category('rules/foo.md')).toBe('rules');
        expect(nc._category('commands/foo.md')).toBe('commands');
    });
    it('returns null for any other top dir', () => {
        expect(nc._category('personas/foo.md')).toBeNull();
    });
});

describe('lint_namespace_collisions._NAMESPACE', () => {
    it('folds skills + rules into the shared library namespace', () => {
        expect(nc._NAMESPACE['skills']).toBe('library');
        expect(nc._NAMESPACE['rules']).toBe('library');
        expect(nc._NAMESPACE['commands']).toBe('commands');
    });
});

describe('lint_namespace_collisions._artefact_name', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('skill name comes from the dir under skills/', () => {
        expect(nc._artefact_name('skills/my-skill/SKILL.md', '/dev/null', 'skills')).toBe(
            'my-skill',
        );
    });
    it('rule name is the file stem', () => {
        expect(nc._artefact_name('rules/my-rule.md', '/dev/null', 'rules')).toBe('my-rule');
    });
    it('command prefers the frontmatter name, else the path slug', () => {
        const withName = path.join(tmp, 'cmd.md');
        fs.writeFileSync(withName, '---\nname: do-thing\n---\nbody\n');
        expect(nc._artefact_name('commands/cmd.md', withName, 'commands')).toBe('do-thing');

        const noName = path.join(tmp, 'plain.md');
        fs.writeFileSync(noName, '# no frontmatter\n');
        expect(nc._artefact_name('commands/plain.md', noName, 'commands')).toBe('plain');
    });
});

// --- Golden parity on the REAL REPO ----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_namespace_collisions — golden parity (python3 vs tsx)', () => {
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

    it('default run (real CI invocation) matches byte-for-byte', () => same([]));
});
