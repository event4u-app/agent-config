// Tests for src/scripts/move_artefact.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists for this module. move_artefact MUTATES the working
// tree (git mv + frontmatter rewrite), so the golden-parity layer NEVER runs
// against the live repo: it builds a throwaway temp git fixture, copies both
// the .py and .ts scripts into it (their ROOT derives from __file__ /
// import.meta.url → the fixture root), symlinks node_modules so `yaml`
// resolves, runs python3 then tsx on identical fresh clones of the fixture,
// and asserts the resulting file trees + git status + stdout/stderr/exit are
// byte-identical. Helper-level tests cover pyyamlSafeDump (PyYAML safe_dump
// parity) and _rewrite_packs without touching git.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as ma from '../../src/scripts/move_artefact.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'move_artefact.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'move_artefact.py');
const NODE_MODULES = path.join(REPO_ROOT, 'node_modules');
const TSX_BIN = path.join(
    NODE_MODULES,
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
function hasPyYaml(): boolean {
    return spawnSync('python3', ['-c', 'import yaml'], { encoding: 'utf8' }).status === 0;
}
function hasGit(): boolean {
    return spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
}

// --- pyyamlSafeDump parity (the riskiest port surface) ----------------------

describe('move_artefact — pyyamlSafeDump (PyYAML safe_dump parity)', () => {
    const py3yaml = hasPython3() && hasPyYaml();

    function pyDump(obj: Record<string, unknown>): string {
        const code =
            'import sys,json,yaml; ' +
            `sys.stdout.write(yaml.safe_dump(json.loads(sys.argv[1]), sort_keys=False, allow_unicode=True))`;
        const r = spawnSync('python3', ['-c', code, JSON.stringify(obj)], { encoding: 'utf8' });
        return r.stdout;
    }

    const CASES: Array<Record<string, unknown>> = [
        { name: 'eloquent', packs: ['laravel'] },
        { name: 'x' },
        { name: 'x', description: 'Use when X: do Y', packs: ['laravel'] },
        { type: 'auto', always: true, n: 3, x: null },
        { desc: 'has #hash and : colon', tags: ['a', 'b', 'c'] },
        { type: 'always', description: 'desc', packs: [] },
        { q: "it's fine", dq: 'say "hi"' },
        {
            name: 'eloquent',
            description:
                "Use when the user is working with Eloquent models, relationships, query scopes, or migrations — even when they just say 'add a field'.",
            packs: ['laravel'],
        },
    ];

    it.skipIf(!py3yaml)('matches PyYAML byte-for-byte across representative frontmatter', () => {
        for (const c of CASES) {
            expect(ma.pyyamlSafeDump(c), `case ${JSON.stringify(c)}`).toBe(pyDump(c));
        }
    });
});

// --- _rewrite_packs (no git) ------------------------------------------------

describe('move_artefact — _rewrite_packs', () => {
    function tmpMd(content: string): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-md-'));
        const p = path.join(dir, 'SKILL.md');
        fs.writeFileSync(p, content, 'utf-8');
        return p;
    }

    it('sets packs to [target] for a non-core move', () => {
        const p = tmpMd('---\nname: demo\ndescription: A demo skill\n---\n\nBody.\n');
        const changed = ma._rewrite_packs(p, 'laravel', false);
        expect(changed).toBe(true);
        const text = fs.readFileSync(p, 'utf-8');
        expect(text).toContain('packs:\n- laravel\n');
        expect(text.endsWith('\nBody.\n')).toBe(true);
    });

    it('removes packs for a core move', () => {
        const p = tmpMd('---\nname: demo\npacks:\n- laravel\n---\n\nBody.\n');
        const changed = ma._rewrite_packs(p, 'core', false);
        expect(changed).toBe(true);
        const text = fs.readFileSync(p, 'utf-8');
        expect(text).not.toContain('packs:');
        expect(text).toContain('name: demo');
    });

    it('returns false when already at target', () => {
        const p = tmpMd('---\nname: demo\npacks:\n- laravel\n---\nBody.\n');
        expect(ma._rewrite_packs(p, 'laravel', false)).toBe(false);
    });

    it('dry-run does not write', () => {
        const p = tmpMd('---\nname: demo\n---\nBody.\n');
        const before = fs.readFileSync(p, 'utf-8');
        // capture stdout
        const orig = process.stdout.write.bind(process.stdout);
        (process.stdout.write as unknown) = (): boolean => true;
        try {
            expect(ma._rewrite_packs(p, 'laravel', true)).toBe(true);
        } finally {
            (process.stdout.write as unknown) = orig;
        }
        expect(fs.readFileSync(p, 'utf-8')).toBe(before);
    });
});

// --- _move_root -------------------------------------------------------------

describe('move_artefact — _move_root', () => {
    it('skill → parent dir; rule/command → file', () => {
        expect(ma._move_root('/a/b/skills/demo/SKILL.md', 'skill')).toBe(
            path.join('/a/b/skills/demo'),
        );
        expect(ma._move_root('/a/b/rules/demo.md', 'rule')).toBe('/a/b/rules/demo.md');
        expect(ma._move_root('/a/b/commands/demo.md', 'command')).toBe('/a/b/commands/demo.md');
    });
});

// --- Golden parity on a throwaway git fixture (NEVER the live repo) ----------

const canGolden = hasPython3() && hasPyYaml() && hasGit();

/** Build a fresh temp git fixture with one skill in pack-laravel + packs vocab. */
function buildFixture(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-fix-'));
    // packs vocabulary
    const discovery = path.join(root, 'src', 'config', 'discovery');
    fs.mkdirSync(discovery, { recursive: true });
    fs.writeFileSync(
        path.join(discovery, 'packs.yml'),
        '- id: laravel\n  label: Laravel\n- id: core\n  label: Core\n',
        'utf-8',
    );
    // source skill living under pack-laravel
    const skillDir = path.join(
        root,
        'packages',
        'pack-laravel',
        '.agent-src.uncondensed',
        'skills',
        'demo-skill',
    );
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        '---\nname: demo-skill\ndescription: Use when demoing the move-artefact flow.\npacks:\n- laravel\n---\n\n# Demo\n\nBody line.\n',
        'utf-8',
    );
    // destination pack tree exists (core) so the move target is valid
    fs.mkdirSync(path.join(root, 'packages', 'core', '.agent-src.uncondensed', 'skills'), {
        recursive: true,
    });
    // copy both scripts so ROOT (parents[2] of src/scripts/<f>) === fixture root
    fs.mkdirSync(path.join(root, 'src', 'scripts'), { recursive: true });
    fs.copyFileSync(PY_SCRIPT, path.join(root, 'src', 'scripts', 'move_artefact.py'));
    fs.copyFileSync(TS_SCRIPT, path.join(root, 'src', 'scripts', 'move_artefact.ts'));
    // symlink node_modules so tsx resolves `yaml`
    fs.symlinkSync(NODE_MODULES, path.join(root, 'node_modules'), 'dir');
    // init git so `git mv` works
    spawnSync('git', ['init', '-q'], { cwd: root });
    spawnSync('git', ['config', 'user.email', 't@e.st'], { cwd: root });
    spawnSync('git', ['config', 'user.name', 'Test'], { cwd: root });
    spawnSync('git', ['add', '-A'], { cwd: root });
    spawnSync('git', ['commit', '-qm', 'init'], { cwd: root });
    return root;
}

/** Snapshot the tracked + untracked tree (path → content), excluding .git + node_modules. */
function snapshotTree(root: string): Map<string, string> {
    const out = new Map<string, string>();
    const walk = (dir: string): void => {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            if (ent.name === '.git' || ent.name === 'node_modules') {
                continue;
            }
            const full = path.join(dir, ent.name);
            if (ent.isSymbolicLink()) {
                continue;
            }
            if (ent.isDirectory()) {
                walk(full);
            } else if (ent.isFile()) {
                const rel = path.relative(root, full).split(path.sep).join('/');
                // skip the copied scripts (identical by construction)
                if (rel === 'src/scripts/move_artefact.py' || rel === 'src/scripts/move_artefact.ts') {
                    continue;
                }
                out.set(rel, fs.readFileSync(full, 'utf-8'));
            }
        }
    };
    walk(root);
    return out;
}

function gitStatus(root: string): string {
    return spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).stdout;
}

describe.skipIf(!canGolden)('move_artefact — golden parity (python3 vs tsx, temp git fixture)', () => {
    it('git-mv a skill core→… frontmatter rewrite produces identical tree + git status', () => {
        const pyRoot = buildFixture();
        const tsRoot = buildFixture();
        try {
            const args = ['--id', 'demo-skill', '--to', 'core'];
            const py = spawnSync('python3', [path.join(pyRoot, 'src', 'scripts', 'move_artefact.py'), ...args], {
                cwd: pyRoot,
                encoding: 'utf8',
            });
            const ts = spawnSync(TSX_BIN, [path.join(tsRoot, 'src', 'scripts', 'move_artefact.ts'), ...args], {
                cwd: tsRoot,
                encoding: 'utf8',
            });

            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);

            // resulting trees identical
            const pyTree = snapshotTree(pyRoot);
            const tsTree = snapshotTree(tsRoot);
            expect([...tsTree.keys()].sort()).toEqual([...pyTree.keys()].sort());
            for (const [rel, content] of pyTree) {
                expect(tsTree.get(rel), `content diff at ${rel}`).toBe(content);
            }
            // git sees the same rename/edit set
            expect(gitStatus(tsRoot)).toBe(gitStatus(pyRoot));
        } finally {
            fs.rmSync(pyRoot, { recursive: true, force: true });
            fs.rmSync(tsRoot, { recursive: true, force: true });
        }
    });

    it('dry-run prints identical plan + leaves tree untouched', () => {
        const pyRoot = buildFixture();
        const tsRoot = buildFixture();
        try {
            const args = ['--id', 'demo-skill', '--to', 'core', '--dry-run'];
            const py = spawnSync('python3', [path.join(pyRoot, 'src', 'scripts', 'move_artefact.py'), ...args], {
                cwd: pyRoot,
                encoding: 'utf8',
            });
            const ts = spawnSync(TSX_BIN, [path.join(tsRoot, 'src', 'scripts', 'move_artefact.ts'), ...args], {
                cwd: tsRoot,
                encoding: 'utf8',
            });
            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            // dry-run: no working-tree change in either
            expect(gitStatus(pyRoot)).toBe('');
            expect(gitStatus(tsRoot)).toBe('');
        } finally {
            fs.rmSync(pyRoot, { recursive: true, force: true });
            fs.rmSync(tsRoot, { recursive: true, force: true });
        }
    });

    it('bad target pack: identical stderr + exit 2', () => {
        const pyRoot = buildFixture();
        const tsRoot = buildFixture();
        try {
            const args = ['--id', 'demo-skill', '--to', 'nonexistent'];
            const py = spawnSync('python3', [path.join(pyRoot, 'src', 'scripts', 'move_artefact.py'), ...args], {
                cwd: pyRoot,
                encoding: 'utf8',
            });
            const ts = spawnSync(TSX_BIN, [path.join(tsRoot, 'src', 'scripts', 'move_artefact.ts'), ...args], {
                cwd: tsRoot,
                encoding: 'utf8',
            });
            expect(ts.status).toBe(2);
            expect(py.status).toBe(2);
            expect(ts.stderr).toBe(py.stderr);
        } finally {
            fs.rmSync(pyRoot, { recursive: true, force: true });
            fs.rmSync(tsRoot, { recursive: true, force: true });
        }
    });

    it('not-found artefact: identical stderr + exit 1 (SystemExit)', () => {
        const pyRoot = buildFixture();
        const tsRoot = buildFixture();
        try {
            const args = ['--id', 'no-such-skill', '--to', 'core'];
            const py = spawnSync('python3', [path.join(pyRoot, 'src', 'scripts', 'move_artefact.py'), ...args], {
                cwd: pyRoot,
                encoding: 'utf8',
            });
            const ts = spawnSync(TSX_BIN, [path.join(tsRoot, 'src', 'scripts', 'move_artefact.ts'), ...args], {
                cwd: tsRoot,
                encoding: 'utf8',
            });
            expect(ts.status).toBe(py.status);
            expect(ts.stderr).toBe(py.stderr);
        } finally {
            fs.rmSync(pyRoot, { recursive: true, force: true });
            fs.rmSync(tsRoot, { recursive: true, force: true });
        }
    });
});
