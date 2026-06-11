// Tests for src/scripts/validate_decision_engine.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists for the validator itself (the underlying
// work_engine.scoring.decision_engine.parse has its own Python tests, not in
// this batch's scope). Focused differential suite over the inlined parse()
// port + any_gate_active, plus golden parity on the REAL REPO (skipped
// without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/validate_decision_engine.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'validate_decision_engine.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'validate_decision_engine.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('validate_decision_engine — parse', () => {
    it('null / empty block → defaults (no gate active)', () => {
        const s = mod.parse(null);
        expect(s.min_confidence).toBe('off');
        expect(s.block_on_risk).toBe('off');
        expect(s.require_memory_hits).toBe(false);
        expect(mod.any_gate_active(s)).toBe(false);
    });

    it('YAML-1.1 off (boolean false) coerces to the off sentinel', () => {
        const s = mod.parse({ min_confidence: false, block_on_risk: false });
        expect(s.min_confidence).toBe('off');
        expect(s.block_on_risk).toBe('off');
        expect(mod.any_gate_active(s)).toBe(false);
    });

    it('a configured floor activates a gate', () => {
        const s = mod.parse({ min_confidence: 'high' });
        expect(s.min_confidence).toBe('high');
        expect(mod.any_gate_active(s)).toBe(true);
    });

    it('require_memory_hits true activates a gate', () => {
        expect(mod.any_gate_active(mod.parse({ require_memory_hits: true }))).toBe(true);
    });

    it('unknown key raises a config error', () => {
        expect(() => mod.parse({ nope: 1 })).toThrow(mod.DecisionEngineConfigError);
        try {
            mod.parse({ nope: 1 });
        } catch (e) {
            expect((e as Error).message).toContain('unknown key(s): nope');
        }
    });

    it('boolean True is not a valid level', () => {
        expect(() => mod.parse({ min_confidence: true })).toThrow(mod.DecisionEngineConfigError);
    });

    it('invalid enum value raises with the value repr', () => {
        try {
            mod.parse({ on_block: 'explode' });
            throw new Error('should have thrown');
        } catch (e) {
            expect((e as Error).message).toContain("invalid value 'explode'");
            expect((e as Error).message).toContain('Allowed: ask, stop, warn');
        }
    });

    it('non-mapping block raises', () => {
        expect(() => mod.parse([1, 2])).toThrow(mod.DecisionEngineConfigError);
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('validate_decision_engine — golden parity (python3 vs tsx)', () => {
    it('matches byte-for-byte on the real repo', () => {
        const py = spawnSync('python3', [PY_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
