// Tests for src/scripts/new_skill.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists, so this is a focused differential suite:
//   - the no-`packages/` exit-2 path is deterministic on the real repo →
//     byte-identical stdout/stderr/exit (python3 vs tsx).
//   - the `_frontmatter` / `_body` builders are unit-checked against the exact
//     `yaml.safe_dump(sort_keys=False, allow_unicode=True)` byte output.
//   - the SCAFFOLD path is golden-compared by creating a temporary `packages/`
//     tree IN the repo (the script hardcodes ROOT from its own path), running
//     python3 then tsx, comparing the scaffolded file bytes + console output,
//     and asserting NO git drift is left behind.
// Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as ns from '../../src/scripts/new_skill.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'new_skill.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'new_skill.py');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('new_skill — frontmatter / body builders (byte-exact PyYAML shape)', () => {
    it('core pack drops the empty `packs` list', () => {
        const fm = ns._frontmatter('my-skill', 'Use when X.', ['engineering'], 'core');
        expect(fm).toBe(
            '---\nname: my-skill\ndescription: Use when X.\nsource: package\n' +
                'workspaces:\n- engineering\nlifecycle: active\n' +
                'trust:\n  level: professional\n  confidence: medium\n  human_review_required: false\n' +
                'install:\n  default: false\n  removable: true\n---\n',
        );
    });
    it('non-core pack keeps a single-item `packs` list', () => {
        const fm = ns._frontmatter('my-skill', 'Use when X.', ['engineering', 'backend'], 'laravel');
        expect(fm).toBe(
            '---\nname: my-skill\ndescription: Use when X.\nsource: package\n' +
                'workspaces:\n- engineering\n- backend\npacks:\n- laravel\nlifecycle: active\n' +
                'trust:\n  level: professional\n  confidence: medium\n  human_review_required: false\n' +
                'install:\n  default: false\n  removable: true\n---\n',
        );
    });
    it('passes unicode through verbatim (allow_unicode)', () => {
        const fm = ns._frontmatter('café', 'Üse — when Ä.', ['eng'], 'core');
        expect(fm).toContain('name: café\n');
        expect(fm).toContain('description: Üse — when Ä.\n');
    });
    it('skill body shape', () => {
        expect(ns._body('skill', 'x', 'D.')).toBe(
            '\n# x\n\n## When to use\n\nD.\n\n## Procedure\n\n' +
                '1. _TODO: replace with the real step-by-step._\n\n' +
                '## Examples\n\n_TODO: copy-pasteable example._\n',
        );
    });
    it('rule body shape', () => {
        expect(ns._body('rule', 'x', 'D.')).toBe('\n# x\n\nD.\n\n## Iron Law\n\n```\nTODO\n```\n');
    });
    it('command body shape', () => {
        expect(ns._body('command', 'x', 'D.')).toBe('\n# x\n\nD.\n\n## Steps\n\n1. _TODO_\n');
    });
});

describe.runIf(hasPython3())('new_skill — golden parity (python3 vs tsx)', () => {
    it('no-packages tree → exit 2 byte-identical', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--name', 'foo'], { encoding: 'utf8', cwd: REPO_ROOT, input: '' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--name', 'foo'], { encoding: 'utf8', cwd: REPO_ROOT, input: '' });
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('bad name / bad pack error paths byte-identical', () => {
        // These only fire once a packages/ tree exists; create a minimal one.
        const pkgRoot = path.join(REPO_ROOT, 'packages');
        const created = !fs.existsSync(pkgRoot);
        fs.mkdirSync(path.join(pkgRoot, 'core', '.agent-src.uncondensed'), { recursive: true });
        fs.mkdirSync(path.join(pkgRoot, 'pack-laravel', '.agent-src.uncondensed'), { recursive: true });
        try {
            for (const args of [['--name', 'Bad Name'], ['--pack', 'nope', '--name', 'x']]) {
                const py = spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT, input: '' });
                const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT, input: '' });
                expect(ts.status).toBe(py.status);
                expect(ts.stdout).toBe(py.stdout);
                expect(ts.stderr).toBe(py.stderr);
            }
        } finally {
            if (created) {
                fs.rmSync(pkgRoot, { recursive: true, force: true });
            }
        }
    });

    it('scaffold byte-identical (skill/rule/command + workspace override) with zero drift', () => {
        const pkgRoot = path.join(REPO_ROOT, 'packages');
        if (fs.existsSync(pkgRoot)) {
            // A real packages/ tree exists — do not disturb it; skip the destructive scaffold check.
            return;
        }
        const cases: Array<{ args: string[]; rel: string }> = [
            { args: ['--pack', 'core', '--type', 'skill', '--name', 'demo-skill', '--description', 'Use when demo.'], rel: 'core/.agent-src.uncondensed/skills/demo-skill/SKILL.md' },
            { args: ['--pack', 'laravel', '--type', 'rule', '--name', 'my-rule', '--description', 'Use when X.'], rel: 'pack-laravel/.agent-src.uncondensed/rules/my-rule.md' },
            { args: ['--pack', 'core', '--type', 'command', '--name', 'my-cmd'], rel: 'core/.agent-src.uncondensed/commands/my-cmd.md' },
            { args: ['--pack', 'laravel', '--type', 'skill', '--name', 'ws-skill', '--description', 'D.', '--workspace', 'eng', '--workspace', 'backend'], rel: 'pack-laravel/.agent-src.uncondensed/skills/ws-skill/SKILL.md' },
        ];
        for (const c of cases) {
            const fresh = (): void => {
                fs.rmSync(pkgRoot, { recursive: true, force: true });
                fs.mkdirSync(path.join(pkgRoot, 'core', '.agent-src.uncondensed'), { recursive: true });
                fs.mkdirSync(path.join(pkgRoot, 'pack-laravel', '.agent-src.uncondensed'), { recursive: true });
            };
            try {
                fresh();
                const py = spawnSync('python3', [PY_SCRIPT, ...c.args], { encoding: 'utf8', cwd: REPO_ROOT, input: '' });
                const pyFile = fs.readFileSync(path.join(pkgRoot, c.rel), 'utf-8');
                fresh();
                const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...c.args], { encoding: 'utf8', cwd: REPO_ROOT, input: '' });
                const tsFile = fs.readFileSync(path.join(pkgRoot, c.rel), 'utf-8');
                expect(ts.status).toBe(py.status);
                expect(ts.stdout).toBe(py.stdout);
                expect(ts.stderr).toBe(py.stderr);
                expect(tsFile).toBe(pyFile);
            } finally {
                fs.rmSync(pkgRoot, { recursive: true, force: true });
            }
        }
        // No git drift introduced (packages/ removed entirely).
        const status = spawnSync('git', ['status', '--porcelain', 'packages'], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(status.stdout.trim()).toBe('');
    });
});

// Module-level reference so an unused-import lint never trips.
void ns._setConfigForTest;
afterEach(() => {
    /* no shared state mutated by these tests */
});
