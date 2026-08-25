// Tests for src/scripts/check_routing_coverage.ts — the two coverage ratchets.
//
// The property worth guarding is not "does it count" but "does it count the
// right denominator". A ratio falls two ways — a corpus case removed, or units
// added without cases — and a count ratchet would call the second one progress.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    SEED_REL,
    evaluate,
    main,
    measureRules,
    measureSkills,
    r4,
    readSeed,
} from '../../src/scripts/check_routing_coverage';

const REPO = path.resolve(__dirname, '..', '..');

let root: string;

function write(rel: string, body: string): void {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
}

/** A tree with 4 routed rules (2 covered) and 4 skills (1 covered). */
function fixture(seed = { rules: 0.5, skills: 0.25 }): void {
    write(
        'dist/router.json',
        JSON.stringify({
            tier_1: [{ id: 'alpha' }, { id: 'beta' }],
            tier_2: [{ id: 'gamma' }, { id: 'delta' }],
        }),
    );
    write('tests/eval/routing-matrix/alpha.yaml', 'cases: []\n');
    write('tests/eval/routing-matrix/gamma.yaml', 'cases: []\n');
    for (const s of ['s1', 's2', 's3', 's4']) write(`src/skills/${s}/SKILL.md`, `---\nname: ${s}\n---\n`);
    write('src/skills/s1/evals/triggers.json', '{}');
    write(SEED_REL, JSON.stringify({ seed }));
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'rcov-'));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('the denominator is routed UNITS, not corpus files', () => {
    it('counts the intersection, so a fixture naming no routed rule cannot lift the ratio', () => {
        fixture();
        expect(measureRules(root)).toMatchObject({ cases: 2, units: 4, ratio: 0.5 });
        // A fixture for a rule that is not routed at all: the file count rises,
        // coverage must not.
        write('tests/eval/routing-matrix/not-a-routed-rule.yaml', 'cases: []\n');
        expect(measureRules(root)).toMatchObject({ cases: 2, units: 4, ratio: 0.5 });
    });

    it('a skill without SKILL.md is not a routed unit', () => {
        fixture();
        fs.mkdirSync(path.join(root, 'src/skills/not-a-skill'), { recursive: true });
        expect(measureSkills(root).units).toBe(4);
    });

    it('adding units WITHOUT cases lowers the ratio — the count-ratchet blind spot', () => {
        // The reason this is a ratio: every count rises here and coverage falls.
        fixture();
        const before = evaluate(root);
        expect(before.fallen).toEqual([]);
        for (const s of ['s5', 's6', 's7', 's8']) write(`src/skills/${s}/SKILL.md`, `---\nname: ${s}\n---\n`);
        const after = evaluate(root);
        expect(after.readings.find((x) => x.scope === 'skills')!.cases).toBe(1); // unchanged
        expect(after.readings.find((x) => x.scope === 'skills')!.units).toBe(8); // rose
        expect(after.fallen).toEqual(['skills']);
    });
});

describe('the ratchet fails only on a decrease', () => {
    it('is green at seed and green above it', () => {
        fixture();
        expect(evaluate(root).fallen).toEqual([]);
        write('tests/eval/routing-matrix/beta.yaml', 'cases: []\n');
        expect(evaluate(root).fallen).toEqual([]);
    });

    it('reds when a corpus case is removed, and greens when restored', () => {
        fixture();
        fs.rmSync(path.join(root, 'tests/eval/routing-matrix/alpha.yaml'));
        expect(evaluate(root).fallen).toEqual(['rules']);
        write('tests/eval/routing-matrix/alpha.yaml', 'cases: []\n');
        expect(evaluate(root).fallen).toEqual([]);
    });

    it('names BOTH scopes when both fall, never just the first', () => {
        fixture();
        fs.rmSync(path.join(root, 'tests/eval/routing-matrix/alpha.yaml'));
        fs.rmSync(path.join(root, 'src/skills/s1/evals/triggers.json'));
        expect(evaluate(root).fallen.sort()).toEqual(['rules', 'skills']);
    });
});

describe('display and verdict share one rounding', () => {
    it('r4 rounds to the comparison precision', () => {
        expect(r4(0.895238095)).toBe(0.8952);
        expect(r4(0.254180602)).toBe(0.2542);
    });

    it('a ratio equal to seed after rounding is NOT a fall', () => {
        // The defect this guards: the first version compared the raw float in
        // the row and the rounded value in the verdict, so rules printed `↑` and
        // skills printed `❌` while the summary correctly said green. A gate
        // whose rows contradict its verdict is worse than one that is wrong.
        fixture({ rules: 0.5, skills: 0.25 });
        const v = evaluate(root);
        for (const r of v.readings) expect(r4(r.ratio)).toBe(r4(v.seed[r.scope]));
        expect(v.fallen).toEqual([]);
    });
});

describe('a missing input is a dead scope, never a pass', () => {
    it('no seed file is exit 2 — a ratchet with no seed passes every tree', () => {
        fixture();
        fs.rmSync(path.join(root, SEED_REL));
        expect(main([], root)).toBe(2);
    });

    it('a seed missing one scope is exit 2, not a half-checked run', () => {
        fixture();
        write(SEED_REL, JSON.stringify({ seed: { rules: 0.5 } }));
        expect(main([], root)).toBe(2);
    });

    it('an unreadable router is exit 2, not coverage zero', () => {
        fixture();
        fs.rmSync(path.join(root, 'dist/router.json'));
        expect(main([], root)).toBe(2);
    });
});

describe('the live tree', () => {
    it('is at seed in both scopes', () => {
        const v = evaluate(REPO);
        expect(v.fallen).toEqual([]);
    });

    it('the seeds are the measured values, and the two scopes differ sharply', () => {
        // The gap IS the roadmap's defect D1: the rules surface is ~90 % covered
        // by a gating corpus, the skills surface — which production routes on —
        // is 25 %, covered only by an advisory harness.
        const s = readSeed(REPO);
        expect(s.rules).toBeCloseTo(0.8952, 4);
        expect(s.skills).toBeCloseTo(0.2542, 4);
        expect(s.rules - s.skills).toBeGreaterThan(0.6);
    });

    it('measures 105 routed rules and 299 routed skills', () => {
        expect(measureRules(REPO).units).toBe(105);
        expect(measureSkills(REPO).units).toBe(299);
    });
});
