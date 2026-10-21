import { describe, expect, it } from 'vitest';

import { mentions_as_code } from '../../src/scripts/check_enforcement_coverage.js';

// The regex this function used until 2026-10-21, kept as the oracle: the linear
// rewrite must answer exactly what it answered, on any input.
const oracle = (haystack: string, base: string, stem: string): boolean =>
    [base, stem].some((needle) => {
        const q = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`['"\`][^'"\`]*${q}[^'"\`]*['"\`]`).test(haystack);
    });

const ALPHABET = ['a', 'b', '_', '.', '/', ' ', '\n', "'", '"', '`', 'ts', 'lint_x', 'lint_x.ts'];

// Deterministic PRNG so a failure reproduces.
function* rng(seed: number): Generator<number> {
    let s = seed;
    for (;;) {
        s = (s * 1103515245 + 12345) % 2 ** 31;
        yield s / 2 ** 31;
    }
}

describe('mentions_as_code — linear rewrite answers exactly what the regex answered', () => {
    it('agrees with the regex oracle on 20 000 random haystacks', () => {
        const r = rng(42);
        const next = (): number => r.next().value as number;
        for (let i = 0; i < 20_000; i++) {
            const len = Math.floor(next() * 14);
            const h = Array.from({ length: len }, () => ALPHABET[Math.floor(next() * ALPHABET.length)]).join('');
            expect(mentions_as_code(h, 'lint_x.ts', 'lint_x'), JSON.stringify(h)).toBe(oracle(h, 'lint_x.ts', 'lint_x'));
        }
    });

    it('agrees on the boundary shapes', () => {
        for (const h of ["'lint_x'", "lint_x'", "'lint_x", "'a' lint_x 'b'", "`lint_x.ts`", '"x"\nlint_x\n"y"', '', "''"]) {
            expect(mentions_as_code(h, 'lint_x.ts', 'lint_x'), h).toBe(oracle(h, 'lint_x.ts', 'lint_x'));
        }
    });

    it('treats regex metacharacters in a name literally', () => {
        expect(mentions_as_code("'a.b'", 'a+b.ts', 'a+b')).toBe(false);
        expect(mentions_as_code("'a+b'", 'a+b.ts', 'a+b')).toBe(true);
    });
});
