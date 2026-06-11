// Tests for src/scripts/lint_roadmap_ci_steps.ts (py2ts Phase 4 / Wave 4b).
//
// Ports tests/test_lint_roadmap_ci_steps.py 1:1 (the `_scan` detection
// patterns + carve-out + acceptance-block suppression, and the
// `_read_local_auto_run` settings parsing via _setSettingsFileForTest) and
// adds a golden-parity layer that runs python3 vs tsx on the REAL REPO,
// byte-identical stdout + stderr + exit (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    _read_local_auto_run,
    _scan,
    _setSettingsFileForTest,
    SETTINGS_FILE,
} from '../../src/scripts/lint_roadmap_ci_steps.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_roadmap_ci_steps.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_roadmap_ci_steps.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

// --- _scan — detection patterns ---------------------------------------------

describe('lint_roadmap_ci_steps — _scan', () => {
    const literals = [
        'task ci',
        'task ci-fast',
        'task ci-strict',
        'make ci',
        'make test',
        'npm run check',
        'pnpm run check',
        'yarn check',
        'composer test',
        'vendor/bin/phpunit',
        'php artisan test',
    ];
    for (const literal of literals) {
        it(`detects CI literal in checkbox: ${literal}`, () => {
            const text = `## Phase 1\n\n- [ ] Run ${literal} before the boundary\n`;
            const hits = _scan(text);
            expect(hits.length).toBe(1);
            const label = hits[0]![1];
            expect(label.toLowerCase().includes(literal.split(' ')[0]!) || label.includes(literal)).toBe(
                true,
            );
        });
    }

    it('detects inside a fenced bash block', () => {
        const text = '## Phase 1\n\nRun the pipeline:\n\n```bash\ntask ci\n```\n';
        const hits = _scan(text);
        expect(hits.length).toBe(1);
        expect(hits[0]![1]).toContain('task ci');
    });

    it('ignores targeted phpstan / filtered test / pathful phpunit', () => {
        const text =
            '## Phase 1\n\n' +
            '- [ ] Run vendor/bin/phpstan analyse app/Modules/X\n' +
            '- [ ] Run php artisan test --filter=FooBar\n' +
            '- [ ] Run vendor/bin/phpunit tests/Unit/Foo.php\n';
        expect(_scan(text)).toEqual([]);
    });

    it('honours the carve-out marker', () => {
        const text =
            '## Phase 1\n\n' +
            '- [ ] Run task ci to verify new gate ' +
            '<!-- carve-out: new-gate-verification -->\n';
        expect(_scan(text)).toEqual([]);
    });

    it('ignores an acceptance-criteria block', () => {
        const text =
            '## Phase 1\n\n' +
            '- [ ] Do the work\n\n' +
            '## Acceptance criteria\n\n' +
            '- All quality gates pass (`task ci`)\n' +
            '- `make test` green\n';
        expect(_scan(text)).toEqual([]);
    });

    it('resumes detection after an acceptance block', () => {
        const text =
            '## Acceptance criteria\n\n' +
            '- `task ci` documented here\n\n' +
            '## Phase 2\n\n' +
            '- [ ] Run task ci again\n';
        const hits = _scan(text);
        expect(hits.length).toBe(1);
        expect(hits[0]![1]).toBe('task ci');
    });

    it('ignores prose outside a checkbox and fence', () => {
        const text =
            '## Context\n\n' +
            'Historically we ran `task ci` on every commit, but that burned tokens.\n';
        expect(_scan(text)).toEqual([]);
    });
});

// --- _read_local_auto_run — settings parsing --------------------------------

describe('lint_roadmap_ci_steps — _read_local_auto_run', () => {
    let tmp: string;
    const original = SETTINGS_FILE;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lrcs-'));
    });
    afterEach(() => {
        _setSettingsFileForTest(original);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('reads local_auto_run: false', () => {
        const settings = path.join(tmp, '.agent-settings.yml');
        fs.writeFileSync(
            settings,
            'quality:\n  local_auto_run: false\n  wait_for_remote_ci: false\n',
            'utf-8',
        );
        _setSettingsFileForTest(settings);
        expect(_read_local_auto_run()).toBe(false);
    });

    it('reads local_auto_run: true', () => {
        const settings = path.join(tmp, '.agent-settings.yml');
        fs.writeFileSync(settings, 'quality:\n  local_auto_run: true\n', 'utf-8');
        _setSettingsFileForTest(settings);
        expect(_read_local_auto_run()).toBe(true);
    });

    it('defaults to true when the file is missing', () => {
        _setSettingsFileForTest(path.join(tmp, 'missing.yml'));
        expect(_read_local_auto_run()).toBe(true);
    });

    it('defaults to true when the key is missing', () => {
        const settings = path.join(tmp, '.agent-settings.yml');
        fs.writeFileSync(settings, 'quality:\n  wait_for_remote_ci: false\n', 'utf-8');
        _setSettingsFileForTest(settings);
        expect(_read_local_auto_run()).toBe(true);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_roadmap_ci_steps — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    it('matches the default (no-flag) run byte-for-byte', () => {
        const py = runPy([]);
        const ts = runTs([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('matches --quiet byte-for-byte (real CI invocation)', () => {
        const py = runPy(['--quiet']);
        const ts = runTs(['--quiet']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
