// Golden-parity tests for work_engine/directives/backend/index.ts vs
// directives/backend/__init__.py (ADR-096 py2ts Phase 1 — work_engine
// TOP/integration layer).
//
// The wiring module exposes DIRECTIVE_SET_NAME, SUPPORTED_KINDS, get_steps(),
// and all_ambiguities(). get_steps() returns callables (not JSON-comparable),
// so parity is on the *step-name order* and the all_ambiguities() structure
// (per-step ambiguity code lists). The Python package is imported via
// sys.path + import_module (siblings exist as .py until the Phase-12 sweep).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    DIRECTIVE_SET_NAME,
    SUPPORTED_KINDS,
    all_ambiguities,
    get_steps,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/index.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SCRIPTS_ROOT = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/** Emit `{name, kinds, step_order, ambiguities}` for the backend set on py3. */
function pySummary(): string {
    const code = [
        'import sys, json',
        `sys.path.insert(0, ${JSON.stringify(SCRIPTS_ROOT)})`,
        'm = __import__("work_engine.directives.backend", fromlist=["x"])',
        'amb = {k: [a.get("code") for a in v] for k, v in m.all_ambiguities().items()}',
        'out = {',
        '  "name": m.DIRECTIVE_SET_NAME,',
        '  "kinds": list(m.SUPPORTED_KINDS),',
        '  "step_order": list(m.get_steps().keys()),',
        '  "ambiguities": amb,',
        '}',
        'sys.stdout.write(json.dumps(out, indent=2, ensure_ascii=False, sort_keys=True))',
    ].join('\n');
    const r = spawnSync('python3', ['-c', code], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout;
}

function tsSummary(): string {
    const amb: Record<string, Array<string | undefined>> = {};
    for (const [k, v] of Object.entries(all_ambiguities())) {
        amb[k] = v.map((a) => a['code']);
    }
    const out = {
        name: DIRECTIVE_SET_NAME,
        kinds: [...SUPPORTED_KINDS],
        step_order: [...get_steps().keys()],
        ambiguities: amb,
    };
    // sort_keys parity: re-serialise with sorted keys.
    return JSON.stringify(_sortKeys(out), null, 2);
}

function _sortKeys(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(_sortKeys);
    }
    if (value && typeof value === 'object') {
        const sorted: Record<string, unknown> = {};
        for (const k of Object.keys(value as Record<string, unknown>).sort()) {
            sorted[k] = _sortKeys((value as Record<string, unknown>)[k]);
        }
        return sorted;
    }
    return value;
}

const py = hasPython3();
const describeParity = py ? describe : describe.skip;

describe('directives/backend index — shape', () => {
    it('DIRECTIVE_SET_NAME + SUPPORTED_KINDS', () => {
        expect(DIRECTIVE_SET_NAME).toBe('backend');
        expect([...SUPPORTED_KINDS]).toEqual(['ticket', 'prompt']);
    });

    it('get_steps walks the canonical eight-step order', () => {
        expect([...get_steps().keys()]).toEqual([
            'refine', 'memory', 'analyze', 'plan', 'implement', 'test', 'verify', 'report',
        ]);
    });

    it('every step maps to a callable', () => {
        for (const handler of get_steps().values()) {
            expect(typeof handler).toBe('function');
        }
    });
});

describeParity('directives/backend index — golden parity', () => {
    it('matches python3 (name + kinds + order + ambiguity codes)', () => {
        expect(tsSummary()).toBe(pySummary());
    });
});
