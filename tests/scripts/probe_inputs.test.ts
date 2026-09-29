/**
 * `probe_inputs` — the digests that let a conformance artefact say what it read.
 *
 * Phase 1 and Phase 2 of `road-to-probe-evidence-that-knows-its-inputs`. The
 * probe writes these; the design-pass reader recomputes them. Both sides import
 * this module, so the two can only disagree if this file is wrong.
 *
 * THE ASSERTION THAT MATTERS MOST is the mtime one. Decision D1 of the roadmap
 * chose content digests over the mtime rule the reader already applies to the
 * audit artefact, precisely so a checkout or a `touch` does NOT report movement.
 * A test that only proved "an edit moves the digest" would pass for an mtime
 * implementation too, and would therefore measure nothing about the decision.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    INPUTS_SCHEMA,
    INPUT_KEYS,
    PROBE_VERSION,
    collectInputs,
    compareInputs,
    declarationsPathFor,
} from '../../src/scripts/_lib/probe_inputs.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const FIXTURE = path.join(ROOT, 'tests', 'design-artifacts', 'fixtures', 'ui-conformance');
const REFERENCE = path.join(FIXTURE, 'reference', 'index.html');
const TARGET = path.join(FIXTURE, 'variant-defects', 'index.html');

/** A throwaway copy of the fixture, so a mutation test never edits the tree. */
function fixtureCopy(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-inputs-'));
    for (const variant of ['reference', 'variant-defects']) {
        fs.cpSync(path.join(FIXTURE, variant), path.join(dir, variant), { recursive: true });
    }
    return dir;
}
const idx = (root: string, variant: string): string => path.join(root, variant, 'index.html');
const collect = (root: string) => collectInputs(idx(root, 'variant-defects'), idx(root, 'reference'));

describe('1.1 — the artefact records what it read', () => {
    it('two collections over unchanged inputs produce identical digests', () => {
        const a = collectInputs(TARGET, REFERENCE);
        const b = collectInputs(TARGET, REFERENCE);
        expect(a).toStrictEqual(b);
        expect(a.schema).toBe(INPUTS_SCHEMA);
        expect(a.probe).toBe(PROBE_VERSION);
        for (const key of INPUT_KEYS) {
            expect(a[key].digest, `${key} must carry a digest`).toMatch(/^sha256:[0-9a-f]{64}$/);
        }
    });

    it('changing one byte of the target CSS moves the target digest and nothing else', () => {
        const root = fixtureCopy();
        try {
            const before = collect(root);
            const css = path.join(root, 'variant-defects', 'styles.css');
            fs.writeFileSync(css, `${fs.readFileSync(css, 'utf-8')} `);
            const after = collect(root);

            expect(after.target.digest).not.toBe(before.target.digest);
            // "and nothing else" — the two inputs the edit did not touch.
            expect(after.reference.digest).toBe(before.reference.digest);
            expect(after.declarations.digest).toBe(before.declarations.digest);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('the target digest covers the whole surface, not just its entry file', () => {
        // The entry document is index.html and the styles live beside it. A
        // digest of index.html alone would be blind to exactly the edit a UI
        // turn most often makes, which is why the record is a tree digest.
        const root = fixtureCopy();
        try {
            const before = collect(root);
            const js = path.join(root, 'variant-defects', 'app.js');
            fs.writeFileSync(js, `${fs.readFileSync(js, 'utf-8')}\n// edited\n`);
            expect(collect(root).target.digest).not.toBe(before.target.digest);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('a touch that changes no byte does NOT move a digest — decision D1', () => {
        const root = fixtureCopy();
        try {
            const before = collect(root);
            const css = path.join(root, 'variant-defects', 'styles.css');
            const future = new Date(Date.now() + 60_000);
            fs.utimesSync(css, future, future);
            expect(collect(root).target.digest).toBe(before.target.digest);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('the declarations path has ONE definition, shared with the probe', () => {
        expect(declarationsPathFor(TARGET)).toBe(
            path.join(FIXTURE, 'variant-defects', 'conformance.declared.json'),
        );
    });
});

describe('1.2 — an input the probe could not read is absent, never omitted', () => {
    it('a missing declarations file is recorded with an explicit absent marker', () => {
        const root = fixtureCopy();
        try {
            fs.rmSync(path.join(root, 'variant-defects', 'conformance.declared.json'));
            const inputs = collect(root);

            // A silently missing key fails here: the key must be PRESENT.
            expect(Object.keys(inputs)).toEqual(expect.arrayContaining([...INPUT_KEYS]));
            expect(inputs.declarations.state).toBe('absent');
            expect(inputs.declarations.digest).toBeNull();
            expect(inputs.declarations.reason).toBeTruthy();
            // …and the inputs the run could read are unaffected.
            expect(inputs.target.state).toBe('read');
            expect(inputs.reference.state).toBe('read');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('a reference that was never supplied is absent with a reason, not null', () => {
        const inputs = collectInputs(TARGET, null);
        expect(inputs.reference.state).toBe('absent');
        expect(inputs.reference.path).toBeNull();
        expect(inputs.reference.reason).toBeTruthy();
        expect(inputs.reference.digest).toBeNull();
    });

    it('a target directory that does not exist is absent, and collection still completes', () => {
        const inputs = collectInputs('/nonexistent/surface/index.html', null);
        expect(inputs.target.state).toBe('absent');
        expect(inputs.target.reason).toBeTruthy();
        expect(inputs.declarations.state).toBe('absent');
    });
});

describe('2.x — comparison is a file-hash question and answers three ways', () => {
    const same = (p: string): string => p;

    it('unchanged inputs compare unchanged', () => {
        const c = compareInputs(collectInputs(TARGET, REFERENCE), same);
        expect(c.verdict).toBe('unchanged');
        expect(c.moved).toEqual([]);
    });

    it('an edited input compares moved, and names which one', () => {
        const root = fixtureCopy();
        try {
            const recorded = collect(root);
            const css = path.join(root, 'variant-defects', 'styles.css');
            fs.writeFileSync(css, `${fs.readFileSync(css, 'utf-8')}\n/* moved */\n`);
            const c = compareInputs(recorded, same);
            expect(c.verdict).toBe('moved');
            expect(c.moved).toEqual(['target']);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('an input recorded absent that has since APPEARED is movement too', () => {
        const root = fixtureCopy();
        try {
            const decl = path.join(root, 'variant-defects', 'conformance.declared.json');
            const body = fs.readFileSync(decl, 'utf-8');
            fs.rmSync(decl);
            const recorded = collect(root);
            expect(recorded.declarations.state).toBe('absent');
            fs.writeFileSync(decl, body);
            const c = compareInputs(recorded, same);
            expect(c.verdict).toBe('moved');
            expect(c.moved).toEqual(['declarations']);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('an input that was never supplied stays absent and is not movement', () => {
        const c = compareInputs(collectInputs(TARGET, null), same);
        expect(c.verdict).toBe('unchanged');
    });

    it('no inputs block at all is unknown — never stale, never fresh', () => {
        const c = compareInputs(undefined, same);
        // `reason` lives only on the `unknown` arm of the union, and an
        // `expect` does not narrow it. Throwing on the wrong verdict narrows
        // AND fails loudly — an `if` would let the reason assertion be skipped
        // silently on a regression, which is the opposite of what it is for.
        if (c.verdict !== 'unknown') throw new Error(`expected unknown, got ${c.verdict}`);
        expect(c.reason).toBeTruthy();
    });

    it('a schema this reader does not know is unknown, not a guess', () => {
        const recorded = { ...collectInputs(TARGET, REFERENCE), schema: 'ui-conformance-inputs/v9' };
        expect(compareInputs(recorded, same).verdict).toBe('unknown');
    });

    it('an artefact from a different probe build is unknown — the version is load-bearing', () => {
        const recorded = { ...collectInputs(TARGET, REFERENCE), probe: 'ui-conformance-probe/v0' };
        expect(compareInputs(recorded, same).verdict).toBe('unknown');
    });

    it('a malformed record is unknown rather than an exception', () => {
        const recorded = { schema: INPUTS_SCHEMA, probe: PROBE_VERSION, target: 'not-a-record' };
        expect(compareInputs(recorded, same).verdict).toBe('unknown');
    });
});
