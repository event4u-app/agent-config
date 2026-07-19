// Tests for src/scripts/lint_originality.ts — the anti-reskin gate wiring.
//
// Unit layer over the pure helpers, plus two integration checks against the
// REAL corpus: a clean full audit exits 0, and a verbatim re-skin of an
// existing skill (written into a temp skill dir, removed in finally) is caught.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { FAIL, ROOT, WARN, _boilerplateSet, _dfFloor, main, overlap } from '../../src/scripts/lint_originality.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const art = (shingles: string[]): any => ({ cls: 'skill', relpath: 'x', label: 'x', shingles: new Set(shingles) });

describe('lint_originality — thresholds', () => {
    it('calibrated defaults: FAIL 60 above the legit floor, WARN 40', () => {
        expect(FAIL).toBe(60);
        expect(WARN).toBe(40);
        expect(FAIL).toBeGreaterThan(WARN);
    });
});

describe('lint_originality — _dfFloor', () => {
    it('is max(4, 3% of class size)', () => {
        expect(_dfFloor(10)).toBe(4); // 0.3 → rounded 0, floored to 4
        expect(_dfFloor(100)).toBe(4); // 3 → floored to 4
        expect(_dfFloor(200)).toBe(6);
        expect(_dfFloor(1000)).toBe(30);
    });
});

describe('lint_originality — _boilerplateSet', () => {
    it('flags shingles recurring in >= floor artifacts, keeps rare ones', () => {
        // 5 artifacts (floor = 4): "shared" appears in 4, "rare" in 2.
        const arts = [
            art(['shared', 'a1']),
            art(['shared', 'a2']),
            art(['shared', 'rare']),
            art(['shared', 'rare']),
            art(['unique']),
        ];
        const boiler = _boilerplateSet(arts);
        expect(boiler.has('shared')).toBe(true); // DF 4 >= floor 4
        expect(boiler.has('rare')).toBe(false); // DF 2 < floor — a re-skin pair survives
        expect(boiler.has('unique')).toBe(false);
    });
});

describe('lint_originality — overlap (containment)', () => {
    it('identical shingle sets score 100, disjoint score 0', () => {
        expect(overlap(art(['a', 'b', 'c']), art(['a', 'b', 'c']))).toBe(100);
        expect(overlap(art(['a', 'b']), art(['x', 'y']))).toBe(0);
    });
    it('containment uses the smaller set as denominator', () => {
        // small={a,b} fully inside large={a,b,c,d} → 100%.
        expect(overlap(art(['a', 'b']), art(['a', 'b', 'c', 'd']))).toBe(100);
    });
    it('empty set scores 0, never NaN', () => {
        expect(overlap(art([]), art(['a']))).toBe(0);
    });
});

describe('lint_originality — integration against the real corpus', () => {
    const FIXTURE_DIR = path.join(ROOT, 'src', 'skills', '__origtest_reskin_fixture');
    const FIXTURE = path.join(FIXTURE_DIR, 'SKILL.md');

    afterEach(() => {
        fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
    });

    it('full audit of the shipped corpus exits 0 (no re-skin present)', () => {
        expect(main(['--quiet'])).toBe(0);
    });

    it('a changed real skill does not flag itself (self-exclusion)', () => {
        // api-design is a real, unique skill; comparing it vs the corpus that
        // contains it must not fail on a self-match.
        expect(main(['--changed', 'src/skills/api-design/SKILL.md', '--quiet'])).toBe(1 - 1);
    });

    it('catches a verbatim re-skin of an existing skill (exit 1)', () => {
        const original = fs.readFileSync(path.join(ROOT, 'src', 'skills', 'api-design', 'SKILL.md'), 'utf-8');
        // A re-skin: the same body with framework nouns swapped — the engine
        // neutralizes those, so it still scores as a near-copy.
        const reskin = original
            .replace(/Laravel/g, 'Symfony')
            .replace(/\bREST\b/g, 'gRPC');
        fs.mkdirSync(FIXTURE_DIR, { recursive: true });
        fs.writeFileSync(FIXTURE, reskin, 'utf-8');
        expect(main(['--changed', 'src/skills/__origtest_reskin_fixture/SKILL.md', '--quiet'])).toBe(1);
    });
});
