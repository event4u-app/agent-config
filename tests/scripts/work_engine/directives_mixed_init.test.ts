// Golden-parity tests for work_engine/directives/mixed/index.ts vs
// directives/mixed/__init__.py (ADR-096 py2ts Phase 1 — work_engine
// TOP/integration layer). The mixed set reuses five backend handlers by
// reference; parity is on name / roadmap / kinds / step-order / ambiguity-code
// structure.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    DIRECTIVE_SET_NAME,
    ROADMAP,
    SUPPORTED_KINDS,
    all_ambiguities,
    get_steps,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/mixed/index.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SCRIPTS_ROOT = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function pySummary(): string {
    const code = [
        'import sys, json',
        `sys.path.insert(0, ${JSON.stringify(SCRIPTS_ROOT)})`,
        'm = __import__("work_engine.directives.mixed", fromlist=["x"])',
        'amb = {k: [a.get("code") for a in v] for k, v in m.all_ambiguities().items()}',
        'out = {"name": m.DIRECTIVE_SET_NAME, "roadmap": m.ROADMAP, "kinds": list(m.SUPPORTED_KINDS), "step_order": list(m.get_steps().keys()), "ambiguities": amb}',
        'sys.stdout.write(json.dumps(out, indent=2, ensure_ascii=False, sort_keys=True))',
    ].join('\n');
    const r = spawnSync('python3', ['-c', code], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout;
}

function _sortKeys(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(_sortKeys);
    if (value && typeof value === 'object') {
        const sorted: Record<string, unknown> = {};
        for (const k of Object.keys(value as Record<string, unknown>).sort()) {
            sorted[k] = _sortKeys((value as Record<string, unknown>)[k]);
        }
        return sorted;
    }
    return value;
}

function tsSummary(): string {
    const amb: Record<string, Array<string | undefined>> = {};
    for (const [k, v] of Object.entries(all_ambiguities())) amb[k] = v.map((a) => a['code']);
    return JSON.stringify(
        _sortKeys({ name: DIRECTIVE_SET_NAME, roadmap: ROADMAP, kinds: [...SUPPORTED_KINDS], step_order: [...get_steps().keys()], ambiguities: amb }),
        null,
        2,
    );
}

const py = hasPython3();
const describeParity = py ? describe : describe.skip;

describe('directives/mixed index — shape', () => {
    it('name / roadmap / kinds', () => {
        expect(DIRECTIVE_SET_NAME).toBe('mixed');
        expect(ROADMAP).toBe('agents/roadmaps/road-to-product-ui-track.md');
        expect([...SUPPORTED_KINDS]).toEqual(['ticket', 'prompt']);
    });
    it('get_steps order', () => {
        expect([...get_steps().keys()]).toEqual([
            'refine', 'memory', 'analyze', 'plan', 'implement', 'test', 'verify', 'report',
        ]);
    });
    it('all callables', () => {
        for (const h of get_steps().values()) expect(typeof h).toBe('function');
    });
});

describeParity('directives/mixed index — golden parity', () => {
    it('matches python3', () => {
        expect(tsSummary()).toBe(pySummary());
    });
});
