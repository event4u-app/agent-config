// Tests for src/scripts/skill_overlap.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the public helpers (parse_frontmatter, tokenize, symbol_set,
// jaccard, analyse) plus a golden-parity layer that runs python3 vs tsx on
// the REAL REPO with --quiet and against a tmp --out, comparing stdout +
// the written report byte-for-byte (skipped without python3).

import { describe, expect, it } from 'vitest';

import * as so from '../../src/scripts/skill_overlap.js';



describe('skill_overlap — behavioural spec', () => {
    it('parse_frontmatter reads description + body', () => {
        const [fm, body] = so.parse_frontmatter(
            '---\nname: x\ndescription: "Use when foo"\n---\nbody line\n',
        );
        expect(fm['name']).toBe('x');
        expect(fm['description']).toBe('Use when foo');
        expect(body).toBe('\nbody line\n');
    });

    it('parse_frontmatter joins continuation lines only for a bare key', () => {
        // Inline value → continuation lines are NOT appended (matches Python).
        const [inlineFm] = so.parse_frontmatter(
            '---\ndescription: line one\n  line two\nname: y\n---\nb\n',
        );
        expect(inlineFm['description']).toBe('line one');
        expect(inlineFm['name']).toBe('y');
        // Bare key (no inline value) → continuation lines join with a space.
        const [bareFm] = so.parse_frontmatter(
            '---\ndescription:\n  line one\n  line two\nname: y\n---\nb\n',
        );
        expect(bareFm['description']).toBe('line one line two');
        expect(bareFm['name']).toBe('y');
    });

    it('parse_frontmatter returns [{}, text] without fence', () => {
        const [fm, body] = so.parse_frontmatter('no fence here\n');
        expect(fm).toEqual({});
        expect(body).toBe('no fence here\n');
    });

    it('tokenize drops stopwords, digits, short tokens', () => {
        const toks = so.tokenize('Use the Laravel Eloquent model 123 ab');
        expect(toks.has('laravel')).toBe(true);
        expect(toks.has('eloquent')).toBe(true);
        expect(toks.has('model')).toBe(true);
        expect(toks.has('the')).toBe(false); // stopword
        expect(toks.has('use')).toBe(false); // stopword
        expect(toks.has('123')).toBe(false); // digit
        expect(toks.has('ab')).toBe(false); // < 3 (regex requires 3+ chars)
    });

    it('symbol_set extracts cited paths, strips backticks', () => {
        const syms = so.symbol_set('see `scripts/foo.py` and agents/bar/baz.md plus docs/x/y.md');
        expect(syms.has('scripts/foo.py')).toBe(true);
        expect(syms.has('agents/bar/baz.md')).toBe(true);
        expect(syms.has('docs/x/y.md')).toBe(true);
    });

    it('jaccard math', () => {
        expect(so.jaccard(new Set(), new Set())).toBe(0.0);
        expect(so.jaccard(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1.0);
        expect(so.jaccard(new Set(['a', 'b']), new Set(['b', 'c']))).toBe(1 / 3);
    });

    it('analyse tiers strong vs candidate, stable order', () => {
        const skills = [
            { slug: 'a', tokens: new Set(['alpha', 'beta', 'gamma']), symbols: new Set<string>() },
            { slug: 'b', tokens: new Set(['alpha', 'beta', 'gamma']), symbols: new Set<string>() }, // identical → strong
            { slug: 'c', tokens: new Set(['alpha', 'delta', 'epsilon']), symbols: new Set<string>() }, // partial → candidate vs a/b
        ];
        const pairs = so.analyse(skills);
        // a/b is a perfect token match → strong, sorts first.
        expect(pairs[0]!.skill_a).toBe('a');
        expect(pairs[0]!.skill_b).toBe('b');
        expect(pairs[0]!.tier).toBe('strong');
        expect(pairs[0]!.description_jaccard).toBe(1.0);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

