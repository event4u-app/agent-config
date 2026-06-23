
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import { _CLIError } from '../../../src/agent-src/templates/scripts/work_engine/errors.js';
import { WorkState, from_dict } from '../../../src/agent-src/templates/scripts/work_engine/state.js';
import {
    _load,
    _save,
    _sync_back,
    _to_delivery,
    _to_v0_dict,
    migrate_payload,
} from '../../../src/agent-src/templates/scripts/work_engine/state_io.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'state-io-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop();
        if (d && fs.existsSync(d)) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

// A representative v1 payload (canonical envelope) and a v0 payload (flat).
const V1_PAYLOAD = {
    version: 1,
    input: { kind: 'ticket', data: { title: 'Fix the café login', id: 7 } },
    intent: 'backend-coding',
    directive_set: 'backend',
    persona: 'qa',
    memory: [{ id: 'r1' }],
    plan: 'do the thing',
    changes: [{ file: 'a.py' }],
    tests: null,
    verify: { claims: 2, first_try_passes: 2 },
    outcomes: { plan: 'success' },
    questions: [],
    report: 'done',
};

const V0_PAYLOAD = {
    ticket: { title: 'Legacy ticket', id: 3 },
    persona: 'advisory',
    memory: [],
    plan: null,
    changes: [],
    tests: null,
    verify: null,
    outcomes: {},
    questions: ['q1'],
    report: '',
};

describe('state_io — migrate_payload', () => {
    it('v1 payload returned deep-copied unchanged', () => {
        const out = migrate_payload(V1_PAYLOAD);
        expect(out).toEqual(V1_PAYLOAD);
        expect(out).not.toBe(V1_PAYLOAD);
    });
    it('v0 payload wrapped into v1 envelope', () => {
        const out = migrate_payload(V0_PAYLOAD) as Record<string, unknown>;
        expect(out['version']).toBe(1);
        expect(out['input']).toEqual({ kind: 'ticket', data: { title: 'Legacy ticket', id: 3 } });
        expect(out['intent']).toBe('backend-coding');
        expect(out['directive_set']).toBe('backend');
        expect(out['persona']).toBe('advisory');
        expect(out['questions']).toEqual(['q1']);
    });
    it('non-dict → SchemaError', () => {
        expect(() => migrate_payload(42 as unknown as never)).toThrow(/v0 state must be a JSON object/);
    });
    it('missing ticket → SchemaError listing keys', () => {
        expect(() => migrate_payload({ foo: 1 } as never)).toThrow(
            /v0 state must carry a 'ticket' key; got keys: \['foo'\]/,
        );
    });
    it('higher version → SchemaError', () => {
        expect(() => migrate_payload({ version: 2 } as never)).toThrow(
            /cannot migrate from version 2/,
        );
    });
});

describe('state_io — _save round-trips', () => {
    it('v1 save is byte-identical JSON + trailing newline', () => {
        const work = from_dict(V1_PAYLOAD);
        const f = path.join(mkTmp(), 'sub', '.work-state.json');
        _save(f, work, 'v1');
        const bytes = fs.readFileSync(f, 'utf-8');
        expect(bytes.endsWith('\n')).toBe(true);
        // re-load round-trips
        const [reloaded] = _load(f);
        expect(reloaded).toBeInstanceOf(WorkState);
    });

    it('v0 save emits the legacy flat shape', () => {
        const work = from_dict(V1_PAYLOAD);
        const f = path.join(mkTmp(), '.work-state.json');
        _save(f, work, 'v0');
        const obj = JSON.parse(fs.readFileSync(f, 'utf-8'));
        expect(Object.keys(obj)).toEqual([
            'ticket',
            'persona',
            'memory',
            'plan',
            'changes',
            'tests',
            'verify',
            'outcomes',
            'questions',
            'report',
        ]);
        expect(obj.ticket).toEqual({ title: 'Fix the café login', id: 7 });
    });
});

describe('state_io — _to_delivery / _sync_back', () => {
    it('projects WorkState → DeliveryState and mirrors back', () => {
        const work = from_dict(V1_PAYLOAD);
        const delivery = _to_delivery(work);
        expect(delivery).toBeInstanceOf(DeliveryState);
        expect(delivery.ticket).toEqual({ title: 'Fix the café login', id: 7 });
        expect(delivery.persona).toBe('qa');
        // mutate the delivery, sync back
        delivery.report = 'updated';
        delivery.plan = 'new plan';
        _sync_back(work, delivery);
        expect(work.report).toBe('updated');
        expect(work.plan).toBe('new plan');
        expect(work.input.data).toEqual({ title: 'Fix the café login', id: 7 });
    });
});

describe('state_io — _load', () => {
    it('loads v1 file and tags v1', () => {
        const f = path.join(mkTmp(), '.work-state.json');
        fs.writeFileSync(f, JSON.stringify(V1_PAYLOAD), 'utf-8');
        const [work, fmt] = _load(f);
        expect(fmt).toBe('v1');
        expect(work.persona).toBe('qa');
    });
    it('loads + migrates v0 file, tags v0', () => {
        const f = path.join(mkTmp(), '.work-state.json');
        fs.writeFileSync(f, JSON.stringify(V0_PAYLOAD), 'utf-8');
        const [work, fmt] = _load(f);
        expect(fmt).toBe('v0');
        expect(work.input.data).toEqual({ title: 'Legacy ticket', id: 3 });
    });
    it('non-object JSON → _CLIError', () => {
        const f = path.join(mkTmp(), '.work-state.json');
        fs.writeFileSync(f, '[]', 'utf-8');
        expect(() => _load(f)).toThrow(_CLIError);
        expect(() => _load(f)).toThrow(/must carry a JSON object; got list/);
    });
    it('unsupported version → _CLIError', () => {
        const f = path.join(mkTmp(), '.work-state.json');
        fs.writeFileSync(f, JSON.stringify({ version: 99, input: {} }), 'utf-8');
        expect(() => _load(f)).toThrow(/unsupported version 99/);
    });
    it('neither shape → _CLIError', () => {
        const f = path.join(mkTmp(), '.work-state.json');
        fs.writeFileSync(f, JSON.stringify({ foo: 1 }), 'utf-8');
        expect(() => _load(f)).toThrow(/missing 'ticket' \(v0\) or 'version' \(v1\)/);
    });
    it('invalid JSON → _CLIError', () => {
        const f = path.join(mkTmp(), '.work-state.json');
        fs.writeFileSync(f, '{not json', 'utf-8');
        expect(() => _load(f)).toThrow(/Invalid JSON in/);
    });
});

describe('state_io — _to_v0_dict', () => {
    it('flat shape in declaration order', () => {
        const work = from_dict(V1_PAYLOAD);
        const v0 = _to_v0_dict(work);
        expect(Object.keys(v0)).toEqual([
            'ticket',
            'persona',
            'memory',
            'plan',
            'changes',
            'tests',
            'verify',
            'outcomes',
            'questions',
            'report',
        ]);
    });
});
