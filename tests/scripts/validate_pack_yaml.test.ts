// Tests for src/scripts/validate_pack_yaml.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists → a behavioural spec over the pure helpers
// (_known_pack_ids, _slug_resolves, _load_allowlist) plus a CLI contract on the
// REAL REPO. The tsx twin is the source of truth (the python original was
// deleted in the teardown). The real-repo manifests are all valid → the CLI
// exits 0; the contract asserts that + determinism.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as vpy from '../../src/scripts/validate_pack_yaml.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'validate_pack_yaml.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function runTs() {
    return spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('validate_pack_yaml — behavioural spec', () => {
    it('_load_allowlist returns a set of "pack slug" keys (real repo)', () => {
        const allow = vpy._load_allowlist();
        expect(allow instanceof Set).toBe(true);
        for (const k of allow) {
            expect(typeof k).toBe('string');
        }
    });

    it('_known_pack_ids is non-empty on the real repo', () => {
        expect(vpy._known_pack_ids().size).toBeGreaterThan(0);
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

describe('validate_pack_yaml — CLI contract', () => {
    it('validates the real (all-valid) manifests deterministically (exit 0)', () => {
        const a = runTs();
        expect(a.status, a.stderr).toBe(0);
        expect(runTs().stdout).toBe(a.stdout);
    });
});
