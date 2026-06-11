// Tests for src/scripts/check_template_pin_drift.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists. Focused spec over _read_package_version /
// _read_template_pin / _template_files, plus golden parity (python3 vs tsx)
// on the REAL REPO for the default and --allow-empty invocations.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as ctpd from '../../src/scripts/check_template_pin_drift.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_template_pin_drift.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_template_pin_drift.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('check_template_pin_drift — helpers', () => {
    it('_read_package_version returns the repo version (string)', () => {
        const v = ctpd._read_package_version();
        expect(typeof v).toBe('string');
        expect((v ?? '').length).toBeGreaterThan(0);
    });

    it('_template_files always includes the dist/agent-src twin', () => {
        const files = ctpd._template_files();
        expect(files.length).toBeGreaterThanOrEqual(1);
        expect(
            files.some((f) =>
                f
                    .split(path.sep)
                    .join('/')
                    .includes('dist/agent-src/templates/agents/agent-project-settings.example.yml'),
            ),
        ).toBe(true);
    });

    it('_read_template_pin reads agent_config_version', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctpd-'));
        try {
            const f = path.join(tmp, 't.yml');
            fs.writeFileSync(f, 'foo: bar\nagent_config_version: "9.9.9"\n');
            expect(ctpd._read_template_pin(f)).toBe('9.9.9');
            const f2 = path.join(tmp, 't2.yml');
            fs.writeFileSync(f2, 'foo: bar\n');
            expect(ctpd._read_template_pin(f2)).toBeNull();
            const f3 = path.join(tmp, 't3.yml');
            fs.writeFileSync(f3, 'agent_config_version:\n');
            expect(ctpd._read_template_pin(f3)).toBe('');
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('check_template_pin_drift — golden parity (python3 vs tsx)', () => {
    function expectMatch(args: readonly string[]) {
        const py = spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    }

    it('default matches byte-for-byte', () => {
        expectMatch([]);
    });

    it('--allow-empty matches byte-for-byte', () => {
        expectMatch(['--allow-empty']);
    });
});
