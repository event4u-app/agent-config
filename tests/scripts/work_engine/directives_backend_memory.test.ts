// Golden-parity tests for work_engine/directives/backend/memory.ts vs
// memory.py (ADR-094 py2ts Phase 1 — backend directive set).
//
// `memory.py` imports `...delivery_state` and lazily imports `memory_lookup`
// (so tests can monkeypatch `memory_lookup.retrieve`). The TS twin mirrors the
// lazy seam with `_setRetrieve`. To make retrieval deterministic and to assert
// the key-derivation contract (files → title tokens → AC tokens, stopword-
// filtered, deduped, lower-cased), the fake `retrieve` echoes the exact keys it
// receives back as a single hit. Both engines then expose `state.memory` as
// canonical JSON for a byte-exact compare; the echoed keys prove the tokeniser
// matched (Python `re` vs JS regex). The MAX_HITS cap is exercised with a fake
// returning >12 hits. No real filesystem access → fully deterministic.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
    AMBIGUITIES,
    MAX_HITS,
    MEMORY_TYPES,
    _setRetrieve,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/memory.js';
import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SCRIPTS_ROOT = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/**
 * Python driver: monkeypatch `memory_lookup.retrieve` with a fake whose
 * behaviour is selected by `mode`, run `memory.run`, emit `state.memory` JSON.
 *
 * - `echo` : returns a single dict hit carrying the received `types`/`keys`.
 * - `cap`  : returns 20 dict hits so the MAX_HITS truncation is observable.
 */
function runPy(stateJson: string, mode: string): string {
    const code = [
        'import sys, json, importlib',
        `sys.path.insert(0, ${JSON.stringify(SCRIPTS_ROOT)})`,
        'import memory_lookup',
        'mode = sys.argv[2]',
        'def fake(types, keys, limit):',
        '    if mode == "cap":',
        '        return [{"id": "h%d" % i, "type": "historical-patterns", "n": i} for i in range(20)]',
        '    return [{"types": list(types), "keys": list(keys), "limit": limit}]',
        'memory_lookup.retrieve = fake',
        'mod = importlib.import_module("work_engine.directives.backend.memory")',
        'from work_engine.delivery_state import DeliveryState',
        'payload = json.loads(sys.argv[1])',
        'st = DeliveryState(**payload)',
        'r = mod.run(st)',
        'out = {"outcome": r.outcome.value, "memory": st.memory}',
        'sys.stdout.write(json.dumps(out, indent=2, ensure_ascii=False))',
    ].join('\n');
    const r = spawnSync('python3', ['-c', code, stateJson, mode], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout;
}

type Mode = 'echo' | 'cap';

function tsFake(mode: Mode) {
    return (types: string[], keys: string[], limit: number): unknown => {
        if (mode === 'cap') {
            return Array.from({ length: 20 }, (_v, i) => ({ id: `h${i}`, type: 'historical-patterns', n: i }));
        }
        return [{ types: [...types], keys: [...keys], limit }];
    };
}

function runTs(state: ConstructorParameters<typeof DeliveryState>[0], mode: Mode): string {
    _setRetrieve(tsFake(mode));
    const st = new DeliveryState(state);
    const r = run(st);
    return JSON.stringify({ outcome: r.outcome, memory: st.memory }, null, 2);
}

function pyFixture(state: ConstructorParameters<typeof DeliveryState>[0]): string {
    return JSON.stringify(state);
}

const py = hasPython3();
const describeParity = py ? describe : describe.skip;

afterEach(() => {
    _setRetrieve(null);
});

describe('directives/backend/memory — constants', () => {
    it('exposes the four memory types and the 12-hit cap', () => {
        expect([...MEMORY_TYPES]).toEqual([
            'domain-invariants',
            'architecture-decisions',
            'incident-learnings',
            'historical-patterns',
        ]);
        expect(MAX_HITS).toBe(12);
        expect(AMBIGUITIES).toEqual([]);
    });
});

describeParity('directives/backend/memory — golden parity (ts == py)', () => {
    const echoCases: Array<[string, ConstructorParameters<typeof DeliveryState>[0]]> = [
        [
            'files + title + AC keys derived, deduped, stopword-filtered',
            {
                ticket: {
                    id: 'M-1',
                    files: ['app/Service.ts', 'app/Service.ts'],
                    title: 'Add OAuth2 login-flow to the v2 API',
                    acceptance_criteria: ['The user must be able to log in', 'Token refresh works'],
                },
            },
        ],
        ['empty ticket → no keys', { ticket: {} }],
        ['title only, short words (<3 chars) dropped', { ticket: { id: 'M-2', title: 'a be the API v2' } }],
        ['non-string title ignored', { ticket: { id: 'M-3', title: 12345 } }],
        ['files non-list ignored, AC drives keys', { ticket: { id: 'M-4', files: 'not-a-list', acceptance_criteria: ['Refactor the parser module'] } }],
        ['hyphen + underscore words kept whole', { ticket: { id: 'M-5', title: 'rename build_step and login-flow' } }],
    ];

    it.each(echoCases)('echo: %s', (_label, state) => {
        expect(runTs(state, 'echo')).toBe(runPy(pyFixture(state), 'echo'));
    });

    it('cap: >12 hits truncated to MAX_HITS', () => {
        const state = { ticket: { id: 'M-CAP', title: 'cap test' } };
        expect(runTs(state, 'cap')).toBe(runPy(pyFixture(state), 'cap'));
    });
});
