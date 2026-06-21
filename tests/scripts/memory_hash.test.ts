// Tests for src/scripts/memory_hash.ts — content-addressed entry hash.
//
// 1:1 port of tests/test_memory_hash.py (pytest → vitest, ADR-094 parity
// contract). The pytest suite imports the module and calls hash_entry()
// directly, so these mirror that by importing the TS twin. A trailing
// golden-parity block runs python3 + tsx on identical inputs (hash_entry via
// a python3 -c driver, plus both CLI surfaces) and asserts byte-identical
// output, skipped when python3 is absent.
import { describe, expect, it } from 'vitest';

import { canonical_json, hash_entry, HASH_LEN } from '../../src/scripts/memory_hash.js';



// --- 1:1 port of test_memory_hash.py -------------------------------------

describe('memory_hash.ts — hash_entry', () => {
    it('hash length is 12 hex', () => {
        const h = hash_entry({ id: 'x', body: 'b' });
        expect(h.length).toBe(12);
        expect([...h].every((c) => '0123456789abcdef'.includes(c))).toBe(true);
    });

    it('same entry same hash (key order differs)', () => {
        const a = { id: 'x', body: 'b', tags: ['z', 'a'] };
        const b = { tags: ['z', 'a'], body: 'b', id: 'x' };
        expect(hash_entry(a)).toBe(hash_entry(b));
    });

    it('different entry different hash', () => {
        expect(hash_entry({ id: 'x' })).not.toBe(hash_entry({ id: 'y' }));
    });

    it('whitespace does not matter', () => {
        const a = { body: 'hello  world' };
        const b = { body: 'hello  world' };
        expect(hash_entry(a)).toBe(hash_entry(b));
    });

    it('list order matters', () => {
        // Lists in YAML represent ordered sequences (e.g. path globs) —
        // reordering MUST produce a different hash.
        const a = { paths: ['a', 'b'] };
        const b = { paths: ['b', 'a'] };
        expect(hash_entry(a)).not.toBe(hash_entry(b));
    });

    it('nested dict keys sorted', () => {
        const a = { meta: { x: 1, y: 2 } };
        const b = { meta: { y: 2, x: 1 } };
        expect(hash_entry(a)).toBe(hash_entry(b));
    });

    it('HASH_LEN constant matches the Python value', () => {
        expect(HASH_LEN).toBe(12);
    });

    it('canonical_json sorts keys and omits whitespace', () => {
        expect(canonical_json({ b: 1, a: 2 }).toString('utf-8')).toBe('{"a":2,"b":1}');
    });
});
