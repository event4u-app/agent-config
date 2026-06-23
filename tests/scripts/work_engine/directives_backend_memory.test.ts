// Intent tests for work_engine/directives/backend/memory.ts (ADR-094 py2ts
// Phase 1 — backend directive set).
//
// Was a python3-vs-tsx golden-parity rig; the `.py` original is gone, so this
// now asserts the tsx module's own contract directly. `memory.ts` lazily
// resolves `memory_lookup.retrieve` via the `_setRetrieve` seam, so retrieval
// is made deterministic with a fake. To assert the key-derivation contract
// (files → title tokens → AC tokens, stopword-filtered, deduped, lower-cased)
// the `echo` fake echoes the exact keys it receives back as a single hit; the
// echoed keys then prove the tokeniser matched. The MAX_HITS cap is exercised
// with a `cap` fake returning >12 hits. `run()` is exercised in-process and
// `{outcome, memory}` is snapshotted. No real filesystem access → deterministic.
import { afterEach, describe, expect, it } from 'vitest';

import {
    AMBIGUITIES,
    MAX_HITS,
    MEMORY_TYPES,
    _setRetrieve,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/memory.js';
import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';

type Mode = 'echo' | 'cap';

function tsFake(mode: Mode) {
    return (types: string[], keys: string[], limit: number): unknown => {
        if (mode === 'cap') {
            return Array.from({ length: 20 }, (_v, i) => ({ id: `h${i}`, type: 'historical-patterns', n: i }));
        }
        return [{ types: [...types], keys: [...keys], limit }];
    };
}

function runTs(state: ConstructorParameters<typeof DeliveryState>[0], mode: Mode): { outcome: string; memory: unknown } {
    _setRetrieve(tsFake(mode));
    const st = new DeliveryState(state);
    const r = run(st);
    return { outcome: r.outcome, memory: st.memory };
}

afterEach(() => {
    _setRetrieve(null);
});

describe('directives/backend/memory — constants', () => {
    it('exposes the three memory types and the 12-hit cap', () => {
        expect([...MEMORY_TYPES]).toEqual([
            'domain-invariants',
            'incident-learnings',
            'historical-patterns',
        ]);
        expect(MAX_HITS).toBe(12);
        expect(AMBIGUITIES).toEqual([]);
    });
});

describe('directives/backend/memory — run() contract', () => {
    it('echo: files + title + AC keys derived, deduped, stopword-filtered', () => {
        expect(
            runTs(
                {
                    ticket: {
                        id: 'M-1',
                        files: ['app/Service.ts', 'app/Service.ts'],
                        title: 'Add OAuth2 login-flow to the v2 API',
                        acceptance_criteria: ['The user must be able to log in', 'Token refresh works'],
                    },
                },
                'echo',
            ),
        ).toMatchInlineSnapshot(`
          {
            "memory": [
              {
                "keys": [
                  "app/Service.ts",
                  "add",
                  "oauth2",
                  "login-flow",
                  "api",
                  "able",
                  "log",
                  "token",
                  "refresh",
                  "works",
                ],
                "limit": 12,
                "types": [
                  "domain-invariants",
                  "incident-learnings",
                  "historical-patterns",
                ],
              },
            ],
            "outcome": "success",
          }
        `);
    });

    it('echo: empty ticket → no keys', () => {
        expect(runTs({ ticket: {} }, 'echo')).toMatchInlineSnapshot(`
          {
            "memory": [
              {
                "keys": [],
                "limit": 12,
                "types": [
                  "domain-invariants",
                  "incident-learnings",
                  "historical-patterns",
                ],
              },
            ],
            "outcome": "success",
          }
        `);
    });

    it('echo: title only, short words (<3 chars) dropped', () => {
        expect(runTs({ ticket: { id: 'M-2', title: 'a be the API v2' } }, 'echo')).toMatchInlineSnapshot(`
          {
            "memory": [
              {
                "keys": [
                  "api",
                ],
                "limit": 12,
                "types": [
                  "domain-invariants",
                  "incident-learnings",
                  "historical-patterns",
                ],
              },
            ],
            "outcome": "success",
          }
        `);
    });

    it('echo: non-string title ignored', () => {
        expect(runTs({ ticket: { id: 'M-3', title: 12345 } }, 'echo')).toMatchInlineSnapshot(`
          {
            "memory": [
              {
                "keys": [],
                "limit": 12,
                "types": [
                  "domain-invariants",
                  "incident-learnings",
                  "historical-patterns",
                ],
              },
            ],
            "outcome": "success",
          }
        `);
    });

    it('echo: files non-list ignored, AC drives keys', () => {
        expect(
            runTs(
                { ticket: { id: 'M-4', files: 'not-a-list', acceptance_criteria: ['Refactor the parser module'] } },
                'echo',
            ),
        ).toMatchInlineSnapshot(`
          {
            "memory": [
              {
                "keys": [
                  "refactor",
                  "parser",
                  "module",
                ],
                "limit": 12,
                "types": [
                  "domain-invariants",
                  "incident-learnings",
                  "historical-patterns",
                ],
              },
            ],
            "outcome": "success",
          }
        `);
    });

    it('echo: hyphen + underscore words kept whole', () => {
        expect(
            runTs({ ticket: { id: 'M-5', title: 'rename build_step and login-flow' } }, 'echo'),
        ).toMatchInlineSnapshot(`
          {
            "memory": [
              {
                "keys": [
                  "rename",
                  "build_step",
                  "login-flow",
                ],
                "limit": 12,
                "types": [
                  "domain-invariants",
                  "incident-learnings",
                  "historical-patterns",
                ],
              },
            ],
            "outcome": "success",
          }
        `);
    });

    it('cap: >12 hits truncated to MAX_HITS', () => {
        expect(runTs({ ticket: { id: 'M-CAP', title: 'cap test' } }, 'cap')).toMatchInlineSnapshot(`
          {
            "memory": [
              {
                "id": "h0",
                "n": 0,
                "type": "historical-patterns",
              },
              {
                "id": "h1",
                "n": 1,
                "type": "historical-patterns",
              },
              {
                "id": "h2",
                "n": 2,
                "type": "historical-patterns",
              },
              {
                "id": "h3",
                "n": 3,
                "type": "historical-patterns",
              },
              {
                "id": "h4",
                "n": 4,
                "type": "historical-patterns",
              },
              {
                "id": "h5",
                "n": 5,
                "type": "historical-patterns",
              },
              {
                "id": "h6",
                "n": 6,
                "type": "historical-patterns",
              },
              {
                "id": "h7",
                "n": 7,
                "type": "historical-patterns",
              },
              {
                "id": "h8",
                "n": 8,
                "type": "historical-patterns",
              },
              {
                "id": "h9",
                "n": 9,
                "type": "historical-patterns",
              },
              {
                "id": "h10",
                "n": 10,
                "type": "historical-patterns",
              },
              {
                "id": "h11",
                "n": 11,
                "type": "historical-patterns",
              },
            ],
            "outcome": "success",
          }
        `);
    });
});
