// Tests for src/scripts/check_release_published.ts (py2ts Phase 4 / Wave 4c).
//
// 1:1 port of tests/test_check_release_published.py. The Python suite
// monkeypatches the module-level _package_version / _package_name /
// _tag_exists / _on_main / _npm_latest helpers; the TS twin exposes the
// same surface via an injectable `Hooks` bag passed to main(). A
// golden-parity layer runs python3 vs tsx on the REAL REPO (no flags →
// warn-only, exit 0) when python3 is present.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as c from '../../src/scripts/check_release_published.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_release_published.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_release_published.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function stub(opts: {
    version: string;
    tagged: boolean;
    npm_latest?: string | null;
    on_main?: boolean;
    name?: string;
}): c.Hooks {
    const { version, tagged, npm_latest = null, on_main = true, name = '@event4u/agent-config' } =
        opts;
    return {
        _package_version: () => version,
        _package_name: () => name,
        _tag_exists: () => tagged,
        _on_main: () => on_main,
        _npm_latest: () => npm_latest,
    };
}

describe('check_release_published.main — exit codes (1:1 port)', () => {
    it('pass when tagged', () => {
        expect(c.main(['--strict'], stub({ version: '5.8.0', tagged: true }))).toBe(0);
    });

    it('strict fails when untagged', () => {
        expect(c.main(['--strict'], stub({ version: '5.8.0', tagged: false }))).toBe(1);
    });

    it('warn-only never fails', () => {
        expect(c.main([], stub({ version: '5.8.0', tagged: false }))).toBe(0);
    });

    it('npm lag fails strict', () => {
        expect(
            c.main(
                ['--strict', '--check-npm'],
                stub({ version: '5.8.0', tagged: true, npm_latest: '5.7.0' }),
            ),
        ).toBe(1);
    });

    it('npm in sync passes', () => {
        expect(
            c.main(
                ['--strict', '--check-npm'],
                stub({ version: '5.8.0', tagged: true, npm_latest: '5.8.0' }),
            ),
        ).toBe(0);
    });

    it('npm unreadable is warned not failed', () => {
        expect(
            c.main(
                ['--strict', '--check-npm'],
                stub({ version: '5.8.0', tagged: true, npm_latest: null }),
            ),
        ).toBe(0);
    });

    it('require-main no-ops off main', () => {
        expect(
            c.main(
                ['--strict', '--require-main'],
                stub({ version: '5.8.0', tagged: false, on_main: false }),
            ),
        ).toBe(0);
    });

    it('require-main enforces on main', () => {
        expect(
            c.main(
                ['--strict', '--require-main'],
                stub({ version: '5.8.0', tagged: false, on_main: true }),
            ),
        ).toBe(1);
    });

    it('non-semver version errors (exit 3)', () => {
        expect(c.main(['--strict'], stub({ version: 'not-a-version', tagged: true }))).toBe(3);
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('check_release_published — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function expectMatch(args: readonly string[]) {
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    }

    // Default (warn-only) on the real repo — uses real git/package.json.
    it('default warn-only matches', () => {
        expectMatch([]);
    });

    it('--strict --require-main matches', () => {
        expectMatch(['--strict', '--require-main']);
    });
});
