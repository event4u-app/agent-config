// The freeze primitive's first consumer — road-to-wired-instruments Phase 3.
//
// `experiment_freeze.ts` shipped with a green suite and no importer outside its
// own test. Two things are checked here, and they are different claims:
//
//   1. BEHAVIOUR — a record file rewritten between two `buildRunSpec` calls
//      makes `assertUnchanged` throw `ExperimentDriftError` naming `corpus`.
//      This is the drift fixture; it exercises the real filesystem read the
//      runner uses, not a hand-built spec pair.
//
//   2. WIRING — `evolution_lab.ts` freezes before the clone loop, asserts after
//      it, and maps the abort onto a non-zero process exit. Without this the
//      behaviour test above would keep passing over a primitive nothing calls,
//      which is exactly the state this phase exists to leave. Removing the
//      binding from the runner turns these red.

import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    buildRunSpec,
    evaluatorIdentity,
    recordSetDigest,
    taskIdentity,
} from '../../src/scripts/_lib/experiment_binding.js';
import {
    ExperimentDriftError,
    assertUnchanged,
    freeze,
} from '../../src/scripts/_lib/experiment_freeze.js';
import { EXIT_GUARD_ABORT } from '../../src/scripts/evolution_lab.js';

const BASELINE = 'baseline-shape-fixed-for-this-test';

let dir: string;
let recordA: string;
let recordB: string;

const read = (p: string): string => readFileSync(p, 'utf-8');

beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'experiment-binding-'));
    recordA = join(dir, 'candidate-a.json');
    recordB = join(dir, 'candidate-b.json');
    writeFileSync(recordA, JSON.stringify({ id: 'a', subject: 'src/rules/one.md' }), 'utf-8');
    writeFileSync(recordB, JSON.stringify({ id: 'b', subject: 'src/rules/two.md' }), 'utf-8');
});

afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
});

describe('the drift fixture', () => {
    it('a record rewritten mid-run aborts, naming the corpus', () => {
        const files = [recordA, recordB];
        const frozenSpec = buildRunSpec(files, read, BASELINE);
        const digest = freeze(frozenSpec);

        // The window the binding closes: the runner clones from one read and
        // evaluates from a second one. Between them, the file moves.
        writeFileSync(recordA, JSON.stringify({ id: 'a', subject: 'src/rules/OTHER.md' }), 'utf-8');

        let caught: unknown;
        try {
            assertUnchanged(digest, frozenSpec, buildRunSpec(files, read, BASELINE));
        } catch (e) {
            caught = e;
        }
        expect(caught).toBeInstanceOf(ExperimentDriftError);
        expect((caught as ExperimentDriftError).changed).toEqual(['corpus']);

        // Restore, so the negative case below reads the set it was frozen on.
        writeFileSync(recordA, JSON.stringify({ id: 'a', subject: 'src/rules/one.md' }), 'utf-8');
    });

    it('an unchanged record set does NOT abort', () => {
        // The other polarity. A guard that fires on an untouched run gets
        // switched off the first week, so the negative case is not optional.
        const files = [recordA, recordB];
        const spec = buildRunSpec(files, read, BASELINE);
        expect(() => assertUnchanged(freeze(spec), spec, buildRunSpec(files, read, BASELINE))).not.toThrow();
    });

    it('enumeration order is not drift', () => {
        const forward = buildRunSpec([recordA, recordB], read, BASELINE);
        const backward = buildRunSpec([recordB, recordA], read, BASELINE);
        expect(freeze(forward)).toBe(freeze(backward));
    });

    it('the corpus digest is over content, not paths alone', () => {
        const before = recordSetDigest([['p', 'one']]);
        const after = recordSetDigest([['p', 'two']]);
        expect(before).not.toBe(after);
    });

    it('the evaluator identity keeps stage ORDER and the task identity does not', () => {
        // Order is part of the evaluator: the cascade's economic claim is that a
        // cheap stage aborts before an expensive one. The evidence fields are a
        // set, so their declaration order is not a property of the task.
        expect(evaluatorIdentity()).toMatch(/^evaluation-cascade:schema-validity>/);
        const fields = taskIdentity().replace('promotion-evidence:', '').split('+');
        expect(fields).toEqual([...fields].sort());
    });
});

describe('the binding is wired into the runner', () => {
    const source = readFileSync(
        resolve(process.cwd(), 'src/scripts/evolution_lab.ts'),
        'utf-8',
    );

    it('evolution_lab imports the freeze primitive', () => {
        expect(source).toMatch(/from '\.\/_lib\/experiment_freeze\.js'/);
        expect(source).toMatch(/from '\.\/_lib\/experiment_binding\.js'/);
    });

    it('it freezes once and re-derives the spec for the assertion', () => {
        // Two `buildRunSpec` call sites: one before the clone loop, one after.
        // A single call site is a freeze that is never compared against anything.
        const calls = source.match(/buildRunSpec\(/g) ?? [];
        expect(calls.length).toBeGreaterThanOrEqual(2);
        expect(source).toMatch(/assertUnchanged\(frozenDigest, frozenSpec, buildRunSpec\(/);
    });

    it('the freeze happens BEFORE the clone loop', () => {
        const frozenAt = source.indexOf('frozenDigest = freeze(');
        const loopAt = source.indexOf('for (const f of ordered) {');
        const assertedAt = source.indexOf('assertUnchanged(frozenDigest');
        expect(frozenAt).toBeGreaterThan(-1);
        expect(loopAt).toBeGreaterThan(-1);
        expect(assertedAt).toBeGreaterThan(-1);
        expect(frozenAt).toBeLessThan(loopAt);
        expect(loopAt).toBeLessThan(assertedAt);
    });

    it('a drift abort becomes a non-zero process exit, not a logged verdict', () => {
        // The guard-call-site conversion this repo already demanded of the
        // budget and holdout guards: a throw nothing turns into an exit code is
        // a unit-tested library, not an integrated one.
        expect(source).toMatch(/e instanceof ExperimentDriftError/);
        expect(EXIT_GUARD_ABORT).toBe(4);
    });
});
