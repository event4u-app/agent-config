// Tests for src/scripts/check_update_banner.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists. Focused spec over _read_installed_version /
// _read_settings_flag / main (best-effort, always exit 0, banner→stderr
// only on a TTY) plus golden parity (python3 vs tsx) on the REAL REPO.
// In a non-TTY test runner check_for_update returns null early, so both
// implementations emit nothing and exit 0.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as cub from '../../src/scripts/check_update_banner.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_update_banner.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_update_banner.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('check_update_banner — helpers', () => {
    it('_read_installed_version reads package.json version', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cub-'));
        try {
            fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ version: '1.2.3' }));
            expect(cub._read_installed_version(tmp)).toBe('1.2.3');
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('_read_installed_version returns empty on missing / bad package.json', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cub-'));
        try {
            expect(cub._read_installed_version(tmp)).toBe('');
            fs.writeFileSync(path.join(tmp, 'package.json'), '{ not json');
            expect(cub._read_installed_version(tmp)).toBe('');
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('_read_settings_flag is true for an empty project (default)', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cub-'));
        try {
            expect(cub._read_settings_flag(tmp)).toBe(true);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('main exits 0 with no installed version', async () => {
        // Empty cwd, no --installed-version override; ROOT package.json exists
        // so installed resolves — but non-TTY means no banner; exit 0 regardless.
        const code = await cub.main(['--cwd', os.tmpdir()]);
        expect(code).toBe(0);
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('check_update_banner — golden parity (python3 vs tsx)', () => {
    function expectMatch(args: readonly string[]) {
        // CI=1 short-circuits the update check identically in both; force a
        // deterministic non-checking environment so neither hits the network.
        const env = { ...process.env, CI: '1', AGENT_CONFIG_NO_UPDATE_CHECK: '1' };
        const py = spawnSync('python3', [PY_SCRIPT, ...args], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            env,
        });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            env,
        });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    }

    it('default matches byte-for-byte (no banner under CI)', () => {
        expectMatch([]);
    });

    it('--installed-version matches byte-for-byte', () => {
        expectMatch(['--installed-version', '0.0.1']);
    });

    it('--help exits 0 with a usage/doc line', () => {
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--help'], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts.status).toBe(0);
        expect(ts.stdout.length).toBeGreaterThan(0);
    });
});
