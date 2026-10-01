// Tests for src/scripts/measure_skill_ranker_baseline.ts — the labelled-corpus
// reader, the powered/underpowered verdict, and the per-pack census.
//
// What is worth guarding here is not "does it divide" but the three places a
// precision number can be quietly manufactured:
//
//   1. An UNLABELLED row counted as a miss. `expected_skills: []` is a
//      deliberate "no skill expectation", and folding those into the
//      denominator would drive every rate toward zero while looking rigorous.
//      A row with the key ABSENT is a different state again — a defect — and
//      the two must not collapse into one.
//   2. A point estimate quoted without its power. Below the floor the arm must
//      say so in a field a reader cannot drop by accident.
//   3. A pack floor satisfied by one prompt naming three of that pack's skills.
//      The census counts prompts per pack, never labels.
//
// Fixture-derived throughout: every expectation is computed from the constants
// written into the temp tree, so a change in the live corpus cannot make a stale
// number pass. The two live-tree assertions at the bottom are the exception and
// are deliberately about SHAPE (a floor, an emptiness) rather than a value.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import {
    MIN_POWERED_N,
    MIN_PROMPTS_PER_PACK,
    SEALED_MODULUS,
    type SliceName,
    allPacks,
    main,
    measureAccuracy,
    packCensus,
    packsBelow,
    packsForSkill,
    partitionBySlice,
    rankOptionsFor,
    readMatrixCases,
    readMatrixLabelledPrompts,
    readMatrixPrompts,
    sliceForId,
    sliceSizes,
} from '../../src/scripts/measure_skill_ranker_baseline';

const REPO = path.resolve(__dirname, '..', '..');

let root: string;

function write(rel: string, body: string): void {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
}

/** A skill whose description is the only thing a ranker could see. */
function skill(name: string, packs: string[], description: string): void {
    write(
        `src/skills/${name}/SKILL.md`,
        `---\nname: ${name}\ndescription: ${description}\npacks:\n${packs.map((p) => `  - ${p}\n`).join('')}---\n\n# ${name}\n`,
    );
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ranker-'));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('readMatrixCases — three label states, never two', () => {
    beforeEach(() => {
        write(
            'tests/eval/routing-matrix/alpha.yaml',
            [
                'rule: alpha',
                'positives:',
                '  - prompt: "labelled with one skill"',
                '    expected_skills: [docker]',
                '  - prompt: "deliberately unlabelled"',
                '    expected_skills: []',
                '  - prompt: "the key is missing entirely"',
                'near_misses:',
                '  - prompt: "labelled with two skills"',
                '    expected_skills: [docker, database]',
                '',
            ].join('\n'),
        );
    });

    it('distinguishes a present-but-empty list from an absent key', () => {
        const cases = readMatrixCases(root);
        expect(cases.map((c) => c.expected)).toEqual([['docker'], [], undefined, ['docker', 'database']]);
    });

    it('numbers ordinals per section, so a positive and a near-miss never share an id', () => {
        const ids = readMatrixCases(root).map((c) => `${c.rule}#${c.section}[${String(c.ordinal)}]`);
        expect(ids).toEqual([
            'alpha#positives[0]',
            'alpha#positives[1]',
            'alpha#positives[2]',
            'alpha#near_misses[0]',
        ]);
    });

    it('readMatrixPrompts returns EVERY prompt — the coverage arm has no label filter', () => {
        expect(readMatrixPrompts(root)).toHaveLength(4);
    });

    it('readMatrixLabelledPrompts keeps only the NON-EMPTY rows', () => {
        // The failing direction matters more than the passing one: if an empty
        // list reached the denominator, every rate would be diluted by rows that
        // were never a claim about anything.
        const labelled = readMatrixLabelledPrompts(root);
        expect(labelled.map((p) => p.id)).toEqual(['alpha#positives[0]', 'alpha#near_misses[0]']);
        expect(labelled.every((p) => p.expected.length > 0)).toBe(true);
    });
});

describe('the pack census', () => {
    beforeEach(() => {
        skill('docker', ['engineering-base'], 'Containers.');
        skill('database', ['engineering-base'], 'Schemas.');
        skill('laravel', ['laravel', 'php'], 'Laravel work.');
        skill('lonely', ['quiet-pack'], 'Nothing points here.');
    });

    it('reads a skill own packs, and a multi-pack skill belongs to each', () => {
        expect(packsForSkill(path.join(root, 'src', 'skills'), 'laravel')).toEqual(['laravel', 'php']);
    });

    it('the census DOMAIN is every declared pack, so an uncovered pack reports zero rather than vanishing', () => {
        expect(allPacks(path.join(root, 'src', 'skills'))).toEqual([
            'engineering-base',
            'laravel',
            'php',
            'quiet-pack',
        ]);
        const census = packCensus([], path.join(root, 'src', 'skills'));
        expect(census).toEqual({ 'engineering-base': 0, laravel: 0, php: 0, 'quiet-pack': 0 });
    });

    it('counts a prompt ONCE per pack however many of that pack skills it expects', () => {
        // The defect this refuses: one prompt naming docker AND database would
        // otherwise score 2 for engineering-base and satisfy a floor of 3 with
        // two prompts instead of three.
        const census = packCensus(
            [{ id: 'a', corpus: 'x', prompt: 'p', expected: ['docker', 'database'] }],
            path.join(root, 'src', 'skills'),
        );
        expect(census['engineering-base']).toBe(1);
    });

    it('a multi-pack skill credits every pack it declares', () => {
        const census = packCensus(
            [{ id: 'a', corpus: 'x', prompt: 'p', expected: ['laravel'] }],
            path.join(root, 'src', 'skills'),
        );
        expect(census).toMatchObject({ laravel: 1, php: 1, 'engineering-base': 0 });
    });

    it('an expected skill that does not exist credits no pack at all', () => {
        const census = packCensus(
            [{ id: 'a', corpus: 'x', prompt: 'p', expected: ['no-such-skill'] }],
            path.join(root, 'src', 'skills'),
        );
        expect(Object.values(census).every((n) => n === 0)).toBe(true);
    });

    it('packsBelow names the packs under the floor, sorted', () => {
        expect(packsBelow({ b: 3, a: 2, c: 0 }, 3)).toEqual(['a', 'c']);
        expect(packsBelow({ b: 3, a: 4 }, 3)).toEqual([]);
    });
});

describe('the powered verdict', () => {
    function matrixOf(n: number): void {
        skill('docker', ['engineering-base'], 'Containers and images.');
        const lines = ['rule: alpha', 'positives:'];
        for (let i = 0; i < n; i += 1) {
            lines.push(`  - prompt: "containers and images question number ${String(i)}"`);
            lines.push('    expected_skills: [docker]');
        }
        write('tests/eval/routing-matrix/alpha.yaml', `${lines.join('\n')}\n`);
    }

    const arm = (): ReturnType<typeof measureAccuracy> =>
        measureAccuracy({
            corpus: 'routing-matrix',
            repo: root,
            skillsDir: path.join(root, 'src', 'skills'),
            rankOpts: {},
        });

    it(`reports underpowered one row BELOW the floor of ${String(MIN_POWERED_N)}`, () => {
        matrixOf(MIN_POWERED_N - 1);
        const a = arm();
        expect(a.corpus_prompts).toBe(MIN_POWERED_N - 1);
        expect(a.verdict).toBe('underpowered');
    });

    it('flips to measured exactly AT the floor — the boundary is inclusive', () => {
        matrixOf(MIN_POWERED_N);
        expect(arm().verdict).toBe('measured');
    });

    it('still prints a point estimate and an interval while underpowered', () => {
        // Suppressing the number would replace a wide measurement with none.
        matrixOf(10);
        const a = arm();
        expect(a.verdict).toBe('underpowered');
        expect(a.top1).toBeGreaterThanOrEqual(0);
        expect(a.top1_ci95.lower).toBeLessThanOrEqual(a.top1);
        expect(a.top1_ci95.upper).toBeGreaterThanOrEqual(a.top1);
    });

    it('brackets both rates, and top-3 is never below top-1', () => {
        matrixOf(20);
        const a = arm();
        expect(a.top3).toBeGreaterThanOrEqual(a.top1);
        expect(a.top3_ci95.lower).toBeLessThanOrEqual(a.top3);
        expect(a.top3_ci95.upper).toBeGreaterThanOrEqual(a.top3);
    });

    it('an EMPTY corpus reports the whole range, not a measured zero', () => {
        skill('docker', ['engineering-base'], 'Containers.');
        write('tests/eval/routing-matrix/alpha.yaml', 'rule: alpha\npositives: []\n');
        const a = arm();
        expect(a.corpus_prompts).toBe(0);
        expect(a.top1_ci95).toEqual({ lower: 0, upper: 1 });
    });
});

describe('the CLI refuses an unknown corpus rather than silently defaulting', () => {
    it('exits 2 on a corpus name outside the closed set', () => {
        expect(main(['--corpus', 'whatever-i-like'])).toBe(2);
    });

    it('exits 2 when --corpus is given with nothing after it', () => {
        expect(main(['--corpus'])).toBe(2);
    });
});

// The live corpus, asserted as a FLOOR and an EMPTINESS and never as a value:
// a hit rate is a measurement, and pinning one here would turn a report into a
// gate that fails whenever the ranker changes in either direction.
describe('the live routing matrix carries its labels', () => {
    const live = (): ReturnType<typeof measureAccuracy> =>
        measureAccuracy({
            corpus: 'routing-matrix',
            repo: REPO,
            skillsDir: path.join(REPO, 'src', 'skills'),
            rankOpts: {},
        });

    it('every case carries an expected_skills key — an absent key is a defect, not a label', () => {
        const missing = readMatrixCases(REPO).filter((c) => c.expected === undefined);
        expect(
            missing.map((c) => `${c.rule}#${c.section}[${String(c.ordinal)}]`),
            'cases with no expected_skills key',
        ).toEqual([]);
    });

    // 60 s, not the 10 s default. This test runs the gate's `main()` over the
    // REAL repo IN-PROCESS — no subprocess, so the cost is the whole-tree walk
    // itself. Vitest 5 raised the default worker count the 10 s was calibrated
    // under, and every one of the 18 CI failures on that upgrade was a timeout,
    // never an assertion. Targeted rather than a global raise: the 10 s default
    // still guards ~24k fast tests, and a real hang here still fails.
    it(`carries at least ${String(MIN_POWERED_N)} labelled rows, so the arm reports measured`, () => {
        const a = live();
        expect(a.corpus_prompts).toBeGreaterThanOrEqual(MIN_POWERED_N);
        expect(a.verdict).toBe('measured');
    }, 60_000);

    // 60 s, not the 10 s default. This test runs the gate's `main()` over the
    // REAL repo IN-PROCESS — no subprocess, so the cost is the whole-tree walk
    // itself. Vitest 5 raised the default worker count the 10 s was calibrated
    // under, and every one of the 18 CI failures on that upgrade was a timeout,
    // never an assertion. Targeted rather than a global raise: the 10 s default
    // still guards ~24k fast tests, and a real hang here still fails.
    it(`gives every declared pack at least ${String(MIN_PROMPTS_PER_PACK)} labelled prompts`, () => {
        const a = live();
        expect(a.packs_below_floor, 'packs under the per-pack floor').toEqual([]);
        expect(a.packs_total).toBeGreaterThan(0);
    }, 60_000);

    it('the line reader and a real YAML parse agree, case for case', () => {
        // Two readers over one corpus is a blind spot, not a redundancy. The
        // line reader only matches a double-quoted single-line `prompt:`; a
        // single-quoted or folded prompt would be dropped silently, and because
        // `missing_label_key` is computed with the SAME reader, a dropped case
        // can never be reported as unlabelled. The other reader
        // (`routing_matrix.test.ts`) would accept it and stay green. This pins
        // the two together so the divergence is a red test rather than a hole.
        const dir = path.join(REPO, 'tests', 'eval', 'routing-matrix');
        interface Case { prompt: string; expected_skills?: string[] }
        let cases = 0;
        let labelled = 0;
        let empty = 0;
        let missing = 0;
        for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.yaml'))) {
            const doc = parseYaml(fs.readFileSync(path.join(dir, f), 'utf-8')) as {
                positives?: Case[];
                near_misses?: Case[];
            };
            for (const c of [...(doc.positives ?? []), ...(doc.near_misses ?? [])]) {
                cases += 1;
                if (c.expected_skills === undefined) missing += 1;
                else if (c.expected_skills.length > 0) labelled += 1;
                else empty += 1;
            }
        }
        const read = readMatrixCases(REPO);
        expect(read.length, 'case count').toBe(cases);
        expect(read.filter((c) => (c.expected?.length ?? 0) > 0).length, 'labelled').toBe(labelled);
        expect(read.filter((c) => c.expected?.length === 0).length, 'deliberately empty').toBe(empty);
        expect(read.filter((c) => c.expected === undefined).length, 'missing key').toBe(missing);
    });

    it('labels only skills that exist — a label naming nothing can never be hit', () => {
        const dir = path.join(REPO, 'src', 'skills');
        const known = new Set(
            fs
                .readdirSync(dir, { withFileTypes: true })
                .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'SKILL.md')))
                .map((e) => e.name),
        );
        const unknown = new Set<string>();
        for (const p of readMatrixLabelledPrompts(REPO)) {
            for (const s of p.expected) if (!known.has(s)) unknown.add(s);
        }
        expect([...unknown].sort(), 'expected_skills naming no shipped skill').toEqual([]);
    });
});

// The held-out partition (road-to-a-ranker-that-routes 1.2). Every property
// below is about the SEAL, not about the split ratio: a partition that is not
// deterministic, not disjoint, or not stable under corpus growth cannot carry a
// lift claim, because the slice a number was read on would not be the slice a
// later reader reproduces.
describe('holdout — the sealed slice is a function of the id and nothing else', () => {
    const ids = Array.from({ length: 2000 }, (_, i) => `rule-${String(i % 97)}#positives[${String(i)}]`);

    it('is deterministic — the same id lands in the same slice every call', () => {
        // Against a snapshot taken first, not against a second call in the same
        // expression: `expect(f(x)).toBe(f(x))` is a self-comparison of a pure
        // function and cannot fail, which is the shape this file's other
        // comments condemn.
        const sample = ids.slice(0, 200);
        const first = sample.map(sliceForId);
        const interleaved = ids.slice(200, 400).map(sliceForId);
        expect(interleaved).toHaveLength(200);
        expect(sample.map(sliceForId)).toEqual(first);
    });

    it('assigns every id to exactly one of the two slices', () => {
        // Two halves: the IMAGE is both labels, so neither slice is empty; and
        // the assignment is in the closed set, so nothing returns a third value
        // or undefined. An earlier version asserted only the image, which would
        // pass for a function that returned both — and the version after it
        // "fixed" that with `expect(x === 'a' ? 'b' : 'a').not.toBe(x)`, which
        // compares a value to its own negation and cannot fail either.
        expect(new Set(ids.map(sliceForId))).toEqual(new Set(['tuning', 'sealed']));
        const labels = new Set(ids.map(sliceForId));
        expect([...labels].sort()).toEqual(['sealed', 'tuning']);
        expect(ids.every((id) => (['tuning', 'sealed'] as string[]).includes(sliceForId(id)))).toBe(true);
    });

    it('is stable when a section is APPENDED to, and moves rows when one is INSERTED into', () => {
        // The real matrix id is `rule#section[ordinal]` and the ordinal is
        // POSITIONAL, so this is the limitation the docblock now states instead
        // of denying. Written against the real id shape rather than synthetic
        // ids, because an earlier version of this suite asserted that a pure
        // function of a string is stable — which cannot fail.
        const section = (count: number): string[] =>
            Array.from({ length: count }, (_, i) => `alpha#positives[${String(i)}]`);

        // APPEND: ids 0..39 survive verbatim when the section grows to 45, so
        // the partition of the first 40 is unchanged. Compared as two computed
        // maps rather than id-against-itself.
        const before = section(40);
        const appended = section(45);
        const sliceOf = (list: string[]): Record<string, string> =>
            Object.fromEntries(list.map((id) => [id, sliceForId(id)]));
        const beforeMap = sliceOf(before);
        const appendedMap = sliceOf(appended);
        for (const id of before) {
            expect(appendedMap[id], `${id} changed slice on an append`).toBe(beforeMap[id]);
        }

        // INSERT at position 0: every row's ordinal shifts by one, so each row's
        // slice is now read off a DIFFERENT id. Some must move, or the seal
        // would be stable in a way this corpus cannot deliver.
        const renumbered = before.map((_, i) => `alpha#positives[${String(i + 1)}]`);
        const moved = before.filter((id, i) => beforeMap[id] !== sliceForId(renumbered[i] as string));
        expect(moved.length, 'a mid-section insert must be shown to move rows').toBeGreaterThan(0);
    });

    it('partitions disjointly and exhaustively, and `all` is the identity', () => {
        const rows = ids.map((id) => ({ id }));
        const tuning = partitionBySlice(rows, 'tuning');
        const sealed = partitionBySlice(rows, 'sealed');
        expect(tuning.length + sealed.length).toBe(rows.length);
        expect(partitionBySlice(rows, 'all')).toHaveLength(rows.length);
        const inSealed = new Set(sealed.map((r) => r.id));
        expect(
            tuning.some((r) => inSealed.has(r.id)),
            'a row in both slices',
        ).toBe(false);
    });

    it('is independent of the order the rows arrive in', () => {
        const rows = ids.map((id) => ({ id }));
        const forward = partitionBySlice(rows, 'sealed')
            .map((r) => r.id)
            .sort();
        const backward = partitionBySlice([...rows].reverse(), 'sealed')
            .map((r) => r.id)
            .sort();
        expect(backward).toEqual(forward);
    });

    it('keeps a row on its own side of the seal when the corpus grows', () => {
        // The defect this refuses: a share applied to a shuffled list would move
        // rows across the boundary the moment a prompt is added, so a sealed
        // reading would silently stop being held out from the earlier tuning.
        const before = new Set(
            partitionBySlice(
                ids.slice(0, 1000).map((id) => ({ id })),
                'sealed',
            ).map((r) => r.id),
        );
        const after = new Set(
            partitionBySlice(
                ids.map((id) => ({ id })),
                'sealed',
            ).map((r) => r.id),
        );
        for (const id of before) expect(after.has(id), `${id} changed slice`).toBe(true);
    });

    it(`holds roughly one row in ${String(SEALED_MODULUS)} back, measured rather than assumed`, () => {
        // A floor and a ceiling, not a value: the hash is not a shuffle and the
        // exact count is a property of the ids, so pinning it would make any new
        // fixture a red test.
        const share = ids.filter((id) => sliceForId(id) === 'sealed').length / ids.length;
        expect(share).toBeGreaterThan(0.1);
        expect(share).toBeLessThan(0.3);
    });

    it('reports the sizes of BOTH slices whichever one was read', () => {
        const sizes = sliceSizes(ids.map((id) => ({ id })));
        expect(sizes.all).toBe(ids.length);
        expect(sizes.tuning + sizes.sealed).toBe(sizes.all);
        expect(sizes.sealed_modulus).toBe(SEALED_MODULUS);
    });

    it('the CLI refuses an unknown slice rather than silently reading the whole corpus', () => {
        expect(main(['--slice', 'the-good-half'])).toBe(2);
        expect(main(['--slice'])).toBe(2);
    });

    it('an unknown --ranker is refused, never resolved to the baseline', () => {
        // The failure this refuses: every consumer echoes the requested label
        // into its output, so resolving a typo to `{}` published a keyword-v1
        // number under another configuration's name.
        expect(() => rankOptionsFor('keyword-v3')).toThrow(/unknown --ranker/);
        expect(main(['--ranker', 'keyword-v3'])).toBe(2);
        expect(rankOptionsFor('idf')).toEqual({ idfWeighting: true });
    });

    it('a sliced arm names its slice and both sizes, over a fixture corpus', () => {
        skill('docker', ['engineering-base'], 'Containers and images.');
        const lines = ['rule: alpha', 'positives:'];
        for (let i = 0; i < 200; i += 1) {
            lines.push(`  - prompt: "containers and images question number ${String(i)}"`);
            lines.push('    expected_skills: [docker]');
        }
        write('tests/eval/routing-matrix/alpha.yaml', `${lines.join('\n')}\n`);
        const arm = (s: SliceName): ReturnType<typeof measureAccuracy> =>
            measureAccuracy({
                corpus: 'routing-matrix',
                repo: root,
                skillsDir: path.join(root, 'src', 'skills'),
                rankOpts: {},
                slice: s,
            });
        const whole = arm('all');
        const tuning = arm('tuning');
        const sealed = arm('sealed');
        expect(whole.slice).toBe('all');
        expect(tuning.slice).toBe('tuning');
        expect(sealed.slice).toBe('sealed');
        expect(tuning.corpus_prompts + sealed.corpus_prompts).toBe(whole.corpus_prompts);
        // The sizes block describes the FULL corpus in every arm, so a reader of
        // a sealed-only report can see what it was held out from.
        expect(sealed.slice_sizes.all).toBe(whole.corpus_prompts);
        expect(sealed.slice_sizes.sealed).toBe(sealed.corpus_prompts);
    });
});
