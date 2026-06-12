// Tests for src/scripts/hooks/envelope.ts (py2ts Phase 6 — hooks core).
//
// No dedicated pytest suite targets envelope.py directly (it is exercised
// transitively by the chat-history / minimal-safe-diff hook suites). This
// file covers the full exported surface as unit tests, plus a differential
// golden-parity layer (python3 -c driver vs the TS functions) over unwrap /
// looks_like_envelope / envelope_field. Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    envelope_field,
    ENVELOPE_KEYS,
    looks_like_envelope,
    unwrap,
} from '../../../src/scripts/hooks/envelope.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const PY = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'envelope.py');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('envelope — looks_like_envelope', () => {
    it('true when all four envelope keys present at top level', () => {
        expect(
            looks_like_envelope({ schema_version: 1, platform: 'a', event: 'stop', payload: {} }),
        ).toBe(true);
    });
    it('false for non-dict', () => {
        expect(looks_like_envelope('x')).toBe(false);
        expect(looks_like_envelope(null)).toBe(false);
        expect(looks_like_envelope([1, 2])).toBe(false);
    });
    it('false when a required key is missing', () => {
        expect(looks_like_envelope({ schema_version: 1, platform: 'a', event: 'stop' })).toBe(false);
    });
    it('payload carrying schema_version does not trigger', () => {
        // Only top-level keys count.
        expect(looks_like_envelope({ payload: { schema_version: 1, platform: 'a', event: 'x' } })).toBe(
            false,
        );
    });
    it('ENVELOPE_KEYS matches the contract', () => {
        expect([...ENVELOPE_KEYS]).toEqual(['schema_version', 'platform', 'event', 'payload']);
    });
});

describe('envelope — unwrap', () => {
    it('empty / whitespace stdin yields empty triple', () => {
        expect(unwrap('')).toEqual([{}, {}, 'generic']);
        expect(unwrap('   ')).toEqual([{}, {}, 'generic']);
        expect(unwrap(null)).toEqual([{}, {}, 'generic']);
        expect(unwrap(undefined)).toEqual([{}, {}, 'generic']);
    });
    it('non-JSON stdin yields empty triple with default platform', () => {
        expect(unwrap('{not json', 'claude')).toEqual([{}, {}, 'claude']);
    });
    it('full envelope returned as-is with payload + platform extracted', () => {
        const env = {
            schema_version: 1,
            platform: 'augment',
            event: 'stop',
            payload: { session_id: 'x' },
        };
        const [e, p, plat] = unwrap(JSON.stringify(env));
        expect(e).toEqual(env);
        expect(p).toEqual({ session_id: 'x' });
        expect(plat).toBe('augment');
    });
    it('envelope with non-dict payload coerces payload to {}', () => {
        const env = { schema_version: 1, platform: 'augment', event: 'stop', payload: 'oops' };
        const [, p] = unwrap(JSON.stringify(env));
        expect(p).toEqual({});
    });
    it('envelope with falsy platform falls back to default', () => {
        const env = { schema_version: 1, platform: '', event: 'stop', payload: {} };
        const [, , plat] = unwrap(JSON.stringify(env), 'cline');
        expect(plat).toBe('cline');
    });
    it('legacy raw dict payload synthesises a minimal envelope', () => {
        const [e, p, plat] = unwrap('{"session_id": "raw-1", "tool_name": "view"}', 'cursor');
        expect(p).toEqual({ session_id: 'raw-1', tool_name: 'view' });
        expect(plat).toBe('cursor');
        expect(e).toEqual({
            schema_version: 1,
            platform: 'cursor',
            event: '',
            native_event: '',
            session_id: '',
            workspace_root: '',
            payload: { session_id: 'raw-1', tool_name: 'view' },
            settings: {},
        });
    });
    it('legacy non-dict JSON (array) synthesises empty payload', () => {
        const [e, p] = unwrap('[1, 2, 3]');
        expect(p).toEqual({});
        expect(e['payload']).toEqual({});
    });
});

describe('envelope — envelope_field', () => {
    it('returns the value when present', () => {
        expect(envelope_field({ a: 1 }, 'a')).toBe(1);
    });
    it('returns default for missing key', () => {
        expect(envelope_field({ a: 1 }, 'b')).toBe('');
        expect(envelope_field({ a: 1 }, 'b', 'fallback')).toBe('fallback');
    });
    it('null value returns default', () => {
        expect(envelope_field({ a: null }, 'a', 'd')).toBe('d');
    });
    it('non-dict envelope returns default', () => {
        // @ts-expect-error — exercising the runtime guard with a bad type.
        expect(envelope_field('nope', 'a', 'd')).toBe('d');
        expect(envelope_field(null, 'a', 'd')).toBe('d');
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('envelope — golden parity (python3 vs TS)', () => {
    const DRIVER = `
import json, sys
sys.path.insert(0, sys.argv[1])
import envelope as e
cases = json.loads(sys.argv[2])
out = []
for c in cases:
    fn = c["fn"]
    if fn == "unwrap":
        env, payload, plat = e.unwrap(c["text"], c.get("default", "generic"))
        out.append([env, payload, plat])
    elif fn == "looks_like_envelope":
        out.append(e.looks_like_envelope(c["obj"]))
    elif fn == "envelope_field":
        out.append(e.envelope_field(c["env"], c["key"], c.get("default", "")))
print(json.dumps(out))
`;
    const HOOKS_DIR = path.dirname(PY);

    function runPy(cases: unknown[]): unknown {
        const r = spawnSync('python3', ['-c', DRIVER, HOOKS_DIR, JSON.stringify(cases)], {
            encoding: 'utf8',
        });
        expect(r.status, r.stderr).toBe(0);
        return JSON.parse(r.stdout);
    }

    it('unwrap matches across representative inputs', () => {
        const texts: Array<[string, string]> = [
            ['', 'generic'],
            ['   ', 'augment'],
            ['{not json', 'claude'],
            ['{"session_id": "raw-1", "tool_name": "view"}', 'cursor'],
            ['[1, 2, 3]', 'generic'],
            [
                JSON.stringify({ schema_version: 1, platform: 'augment', event: 'stop', payload: { a: 1 } }),
                'generic',
            ],
            [
                JSON.stringify({ schema_version: 1, platform: '', event: 'stop', payload: 'bad' }),
                'cline',
            ],
        ];
        const cases = texts.map(([text, def]) => ({ fn: 'unwrap', text, default: def }));
        const pyOut = runPy(cases) as Array<[unknown, unknown, string]>;
        const tsOut = texts.map(([text, def]) => {
            const [e, p, plat] = unwrap(text, def);
            return [e, p, plat];
        });
        expect(tsOut).toEqual(pyOut);
    });

    it('looks_like_envelope matches', () => {
        const objs = [
            { schema_version: 1, platform: 'a', event: 'x', payload: {} },
            { schema_version: 1, platform: 'a', event: 'x' },
            'string',
            null,
            [1, 2],
            { payload: { schema_version: 1, platform: 'a', event: 'x' } },
        ];
        const cases = objs.map((obj) => ({ fn: 'looks_like_envelope', obj }));
        const pyOut = runPy(cases) as boolean[];
        const tsOut = objs.map((o) => looks_like_envelope(o));
        expect(tsOut).toEqual(pyOut);
    });

    it('envelope_field matches', () => {
        const cases = [
            { fn: 'envelope_field', env: { a: 1 }, key: 'a', default: '' },
            { fn: 'envelope_field', env: { a: 1 }, key: 'b', default: 'fb' },
            { fn: 'envelope_field', env: { a: null }, key: 'a', default: 'd' },
        ];
        const pyOut = runPy(cases) as unknown[];
        const tsOut = [
            envelope_field({ a: 1 }, 'a', ''),
            envelope_field({ a: 1 }, 'b', 'fb'),
            envelope_field({ a: null }, 'a', 'd'),
        ];
        expect(tsOut).toEqual(pyOut);
    });
});
