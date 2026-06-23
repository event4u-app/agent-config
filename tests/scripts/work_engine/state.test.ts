
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    DEFAULT_DIRECTIVE_SET,
    DEFAULT_INTENT,
    Input,
    KNOWN_DIRECTIVE_SETS,
    KNOWN_INPUT_KINDS,
    SCHEMA_VERSION,
    SchemaError,
    dump,
    from_dict,
    load,
    to_dict,
} from '../../../src/agent-src/templates/scripts/work_engine/state.js';

// tests/scripts/work_engine/state.test.ts → four levels up is the repo root.
const REPO_ROOT = path.resolve(
    fileURLToPath(import.meta.url),
    '..',
    '..',
    '..',
    '..',
);

const STATE_PY = path.join(
    REPO_ROOT,
    'src',
    'agent-src',
    'templates',
    'scripts',
    'work_engine',
    'state.py',
);

/** TS twin: from_dict then JSON.stringify(to_dict, null, 2) — `state.dump`'s body. */
function tsSerialize(fixtureJson: string): string {
    const payload = JSON.parse(fixtureJson);
    return JSON.stringify(to_dict(from_dict(payload)), null, 2);
}

/** TS twin: from_dict, capture the SchemaError message. */
function tsErrorMessage(fixtureJson: string): string {
    const payload = JSON.parse(fixtureJson);
    try {
        from_dict(payload);
        return '__NO_ERROR__';
    } catch (exc) {
        return (exc as Error).message;
    }
}

// ── Fixtures ────────────────────────────────────────────────────────────
//
// NOTE: fixtures deliberately avoid integer-valued floats (e.g. `1.0`). JSON
// carries no float/int tag, so `1.0` collapses to the JS number `1` on parse —
// CPython's reader keeps it a float and re-emits `1.0`. That divergence is a
// property of the JSON-round-trip, identical for any TS reader, and the
// Python `state.dump` path is fed JSON-parsed values too; it is not a twin
// defect. `mtime` uses a genuine non-integer float (`2.5`) to prove real
// floats round-trip on both sides.

const FRESH_TICKET = JSON.stringify({
    version: 1,
    input: { kind: 'ticket', data: { id: 'T-1', title: 'Build it' } },
});

const FULL_ENVELOPE = JSON.stringify({
    version: 1,
    input: {
        kind: 'prompt',
        data: { raw: 'improve the dashboard', assumptions: ['a', 'b'] },
    },
    intent: 'ui-improve',
    directive_set: 'ui',
    stack: { frontend: 'react', mtime: 2.5 },
    ui_audit: {
        greenfield: true,
        greenfield_decision: 'scaffold',
        a11y_baseline: [{ rule: 'color-contrast' }],
        components_found: ['Button', 'Card'],
    },
    ui_design: { design_confirmed: true, layout: 'grid' },
    ui_review: {
        findings: [{ severity: 'minor', text: 'x' }],
        review_clean: false,
        a11y: {
            violations: [{ id: 'v1' }],
            severity_floor: 'serious',
            accepted_violations: [],
        },
        preview: { render_ok: true },
    },
    ui_polish: { rounds: 2, applied: ['fix-a'], extension_used: false },
    contract: {
        data_model: [{ entity: 'User' }],
        api_surface: [{ path: '/users' }],
        contract_confirmed: true,
    },
    stitch: {
        scenarios: [{ name: 'login' }],
        verdict: 'success',
        integration_confirmed: true,
    },
    halts: [
        { reason: 'ambiguous AC', surface: ['line 1', 'line 2'], step: 'plan' },
    ],
    persona: 'frontend-lead',
    memory: [{ note: 'prior run' }],
    plan: { steps: ['s1', 's2'] },
    changes: [{ file: 'a.ts' }],
    tests: { added: 3 },
    verify: { passed: true },
    outcomes: { plan: 'success', apply: 'partial' },
    questions: ['Which layout?'],
    report: 'done',
});

// Unknown top-level keys are tolerated + dropped; non-ASCII left verbatim.
const TOLERANT_AND_UNICODE = JSON.stringify({
    version: 1,
    input: { kind: 'file', data: { path: 'src/Héllo.tsx' } },
    future_field: { ignored: true },
    report: 'café — naïve façade ☕',
    extension_used: 'leaked-but-not-a-field',
});

// `rounds` at the extension ceiling (3) only valid when extension_used is true.
const POLISH_EXTENSION = JSON.stringify({
    version: 1,
    input: { kind: 'ticket', data: {} },
    ui_polish: { rounds: 3, extension_used: true, applied: [] },
});

const EMPTY_DICT_GATES = JSON.stringify({
    version: 1,
    input: { kind: 'ticket', data: {} },
    ui_audit: {},
    ui_design: {},
    ui_review: {},
    ui_polish: {},
    contract: {},
    stitch: {},
});

describe('work_engine/state — TS-side unit checks (no python3 needed)', () => {
    it('module constants match the schema', () => {
        expect(SCHEMA_VERSION).toBe(1);
        expect(DEFAULT_INTENT).toBe('backend-coding');
        expect(DEFAULT_DIRECTIVE_SET).toBe('backend');
        expect([...KNOWN_INPUT_KINDS].sort()).toEqual([
            'diff',
            'file',
            'prompt',
            'ticket',
        ]);
        expect([...KNOWN_DIRECTIVE_SETS].sort()).toEqual([
            'backend',
            'mixed',
            'ui',
            'ui-trivial',
        ]);
    });

    it('Input default data is a fresh empty object per instance', () => {
        const a = new Input('ticket');
        const b = new Input('ticket');
        (a.data as Record<string, unknown>)['x'] = 1;
        expect(Object.keys(b.data)).toHaveLength(0);
    });

    it('round-trip from_dict → to_dict → from_dict is stable', () => {
        const first = to_dict(from_dict(JSON.parse(FULL_ENVELOPE)));
        const second = to_dict(from_dict(first as never));
        expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    });

    it('to_dict validates a mutated in-memory state before serialising', () => {
        const st = from_dict(JSON.parse(FRESH_TICKET));
        st.directive_set = 'sideways';
        expect(() => to_dict(st)).toThrow(SchemaError);
    });

    it('to_dict re-validates version drift', () => {
        const st = from_dict(JSON.parse(FRESH_TICKET));
        st.version = 99;
        expect(() => to_dict(st)).toThrow(/version must be 1; got 99/);
    });

    it('load() round-trips a dumped file', () => {
        const tmpDir = fs_mkdtemp();
        const out = path.join(tmpDir, 'state.json');
        const original = from_dict(JSON.parse(FULL_ENVELOPE));
        dump(original, out);
        const reread = load(out);
        expect(JSON.stringify(to_dict(reread))).toBe(
            JSON.stringify(to_dict(original)),
        );
    });
});

// ── tiny fs helpers (kept local to avoid a shared-rig dependency) ───────
import * as fs from 'node:fs';
import * as os from 'node:os';

function fs_mkdtemp(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'we-state-'));
}
function fs_readFile(p: string): string {
    return fs.readFileSync(p, 'utf-8');
}
