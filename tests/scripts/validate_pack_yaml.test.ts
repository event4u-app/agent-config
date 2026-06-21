// Tests for src/scripts/validate_pack_yaml.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the pure helpers (_known_pack_ids, _slug_resolves, _load_allowlist)
// plus a golden-parity layer that runs python3 vs tsx on the REAL REPO
// (skipped without python3). The schema-SHAPE error prose is a documented
// divergence candidate (Python jsonschema wording); the parity contract is
// exit code + the reference-resolution messages, which on the real repo are
// all clean (exit 0).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as vpy from '../../src/scripts/validate_pack_yaml.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'validate_pack_yaml.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'validate_pack_yaml.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
function hasJsonschema(): boolean {
    return (
        spawnSync('python3', ['-c', 'import jsonschema'], { encoding: 'utf8' }).status === 0
    );
}

const py3 = hasPython3();
const js = py3 && hasJsonschema();

describe('validate_pack_yaml — behavioural spec', () => {
    it('_load_allowlist returns a set of "pack slug" keys (real repo)', () => {
        const allow = vpy._load_allowlist();
        expect(allow instanceof Set).toBe(true);
        for (const k of allow) {
            expect(typeof k).toBe('string');
        }
    });

    it('_known_pack_ids is non-empty and matches the Python set on the real repo', () => {
        const ids = vpy._known_pack_ids();
        expect(ids.size).toBeGreaterThan(0);
        if (py3) {
            const out = spawnSync(
                'python3',
                [
                    '-c',
                    "import sys; sys.path.insert(0,'src/scripts'); " +
                        'import validate_pack_yaml as v; ' +
                        'import json; print(json.dumps(sorted(v._known_pack_ids())))',
                ],
                { cwd: REPO_ROOT, encoding: 'utf8' },
            );
            const pyIds = JSON.parse(out.stdout) as string[];
            expect([...ids].sort()).toEqual(pyIds);
        }
    });

    it('_slug_resolves true for a real skill, false for nonsense', () => {
        const cwd = process.cwd();
        try {
            process.chdir(REPO_ROOT);
            // `laravel` ships as a skill in the real repo.
            expect(vpy._slug_resolves('laravel', 'skills')).toBe(true);
            expect(vpy._slug_resolves('__no_such_artefact_xyz__', 'skills')).toBe(false);
        } finally {
            process.chdir(cwd);
        }
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

describe.skipIf(!js)('validate_pack_yaml — golden parity (python3 vs tsx)', () => {
    it('matches exit code + stdout on the real (all-valid) manifests', () => {
        const py = spawnSync('python3', [PY_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        // Real repo manifests are all valid → exit 0, no schema-error prose.
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });
});
