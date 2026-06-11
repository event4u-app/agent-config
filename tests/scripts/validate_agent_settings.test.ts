// Tests for src/scripts/validate_agent_settings.ts (py2ts Phase 4 / Wave 4c).
//
// Ports tests/test_validate_agent_settings.py over the shared schema: the
// enum contract (all valid tiers accepted), out-of-enum rejection at the
// right field path, and the legacy `cost_profile` tolerance (shipped
// reality — additionalProperties: true). The Python suite's final subtest
// (`install.LEGACY_RENAME_MAP['cost_profile'] == 'rule_loading_tier'`) reaches
// into the Python install module; it is asserted here against the install.py
// source line (the alias map is Python-side and not part of this twin's
// surface). Plus golden parity (python3 vs tsx) on the real repo.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { SCHEMA_PATH, _iter_errors } from '../../src/scripts/validate_agent_settings.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'validate_agent_settings.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'validate_agent_settings.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const SCHEMA = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'));
const VALID_TIERS = ['minimal', 'balanced', 'full', 'custom'] as const;

function errors(doc: Record<string, unknown>) {
    return _iter_errors(doc, SCHEMA, []);
}

describe('validate_agent_settings — schema enum contract', () => {
    it('accepts every valid rule_loading_tier', () => {
        for (const tier of VALID_TIERS) {
            expect(errors({ rule_loading_tier: tier })).toEqual([]);
        }
    });

    it('rejects an out-of-enum rule_loading_tier and names the field', () => {
        const errs = errors({ rule_loading_tier: 'lean' });
        expect(errs.length).toBeGreaterThan(0);
        expect(errs[0]!.path).toEqual(['rule_loading_tier']);
        // The message names the allowed values (actionable for the user).
        expect(VALID_TIERS.some((t) => errs[0]!.message.includes(t))).toBe(true);
    });

    it('tolerates the legacy cost_profile key (shipped reality)', () => {
        expect(errors({ cost_profile: 'minimal' })).toEqual([]);
    });

    it('enforces nested enums (memory.cadence, model.auto_switch, worktrees.mode)', () => {
        expect(errors({ memory: { cadence: 'always' } })).toEqual([]);
        expect(errors({ memory: { cadence: 'bogus' } })[0]!.path).toEqual(['memory', 'cadence']);
        expect(errors({ model: { auto_switch: 'suggest' } })).toEqual([]);
        expect(errors({ worktrees: { mode: 'ask' } })).toEqual([]);
    });
});

describe('validate_agent_settings — alias map (Python install source)', () => {
    it('install.py maps cost_profile → rule_loading_tier', () => {
        // The alias map lives in the Python installer (not this twin). Pin the
        // source line so the contract the Python test asserts stays visible.
        const install = fs.readFileSync(path.join(REPO_ROOT, 'src', 'scripts', 'install.py'), 'utf-8');
        expect(install).toMatch(/["']cost_profile["']\s*:\s*["']rule_loading_tier["']/);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('validate_agent_settings — golden parity (python3 vs tsx)', () => {
    it('matches the clean-repo run byte-for-byte', () => {
        const py = spawnSync('python3', [PY_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
