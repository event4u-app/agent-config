/**
 * The binary-eligibility predicate that reopened the `binary` class.
 *
 * `f573d628c` closed `binary` as a hard zero on 2026-09-07. This reopens it 24
 * hours later, which IS A WEAKENING of a control — authorised by an AI council
 * (2026-09-08, 2 seats, unanimous, deep tier), and still a weakening. The tests
 * below are what the weakening is traded for: every admission is re-derived
 * mechanically from the packed bytes, and each validated property has a
 * NEGATIVE test that proves the predicate refuses when it is violated.
 *
 * The mutations are DEFINED, never arbitrary. A generic `corrupt(bytes)` was
 * refuted by a council seat and is not used here: random corruption can land in
 * a custom section and leave a still-valid module, or hit padding and change
 * nothing, so a test built on it can pass while proving nothing. Each negative
 * test targets one property the predicate actually validates.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    definedInvalidHeaderMutation,
    definedUnsupportedAbiEntry,
    duplicatePaths,
    evaluateEntry,
    loadManifest,
    type PackedBinaryEntry,
    VERIFIABLE_KIND,
    wasmMagicAndVersionValid,
    wildcardGrants,
} from '../../src/scripts/_lib/packed_binary_predicate.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PHP = 'src/vendor/grammars/tree-sitter-php.wasm';

const manifest = loadManifest(REPO_ROOT);
const phpEntry = manifest.entries.find((e) => e.path === PHP) as PackedBinaryEntry;
const phpBytes = fs.readFileSync(path.join(REPO_ROOT, PHP));
/** The real loader's answer, taken once and reused — see the ABI test. */
const TRUE_PROBE = { abi: 14, grammar_id: 'php' };

function evaluate(over: Partial<Parameters<typeof evaluateEntry>[0]> = {}): ReturnType<typeof evaluateEntry> {
    return evaluateEntry({
        filePath: PHP,
        packedPaths: new Set([PHP]),
        manifest,
        bytes: phpBytes,
        probe: TRUE_PROBE,
        ...over,
    });
}

describe('the manifest itself', () => {
    it('names exactly the three vendored grammars, one row each', () => {
        expect(manifest.entries.map((e) => e.path).sort()).toEqual([
            'src/vendor/grammars/tree-sitter-javascript.wasm',
            'src/vendor/grammars/tree-sitter-php.wasm',
            'src/vendor/grammars/tree-sitter-typescript.wasm',
        ]);
        expect(duplicatePaths(manifest)).toEqual([]);
    });

    it('carries no wildcard or directory grant', () => {
        expect(wildcardGrants(manifest)).toEqual([]);
    });

    it('carries no archive entry — that class was NOT reopened', () => {
        // The collision produced evidence about grammars and none about
        // archives. A row of any other kind here would be the over-generalising
        // move in the opposite direction.
        for (const e of manifest.entries) expect(e.kind).toBe(VERIFIABLE_KIND);
    });
});

describe('the accepting control', () => {
    it('admits a grammar when every condition holds', () => {
        const v = evaluate();
        expect(v.failures).toEqual([]);
        expect(v.eligible).toBe(true);
    });
});

describe('negative: defined-invalid-header-mutation', () => {
    it('rejects bytes whose WASM magic was mutated', () => {
        const mutated = definedInvalidHeaderMutation(phpBytes);
        // The mutation is real: the validator must disagree with itself about
        // the original and the mutant, or the test proves nothing.
        expect(wasmMagicAndVersionValid(phpBytes)).toBe(true);
        expect(wasmMagicAndVersionValid(mutated)).toBe(false);

        const v = evaluate({ bytes: mutated });
        expect(v.eligible).toBe(false);
        expect(v.failures.join(' · ')).toContain('WASM magic or version invalid');
    });
});

describe('negative: defined-unsupported-abi-fixture', () => {
    it('rejects a manifest entry claiming an ABI the loader does not report', () => {
        // The ABI is not a byte at a fixed offset — it is what the loader
        // reports after parsing — so the DEFINED mutation is on the
        // expectation, which is where it can be stated exactly.
        const wrong = definedUnsupportedAbiEntry(phpEntry);
        expect(wrong.abi).not.toBe(phpEntry.abi);

        const v = evaluate({ manifest: { ...manifest, entries: [wrong] } });
        expect(v.eligible).toBe(false);
        expect(v.failures.join(' · ')).toContain('ABI mismatch');
    });
});

describe('negative: defined-grammar-payload-substitution', () => {
    it('rejects bytes whose sha256 does not match the manifest', () => {
        // The payload property, targeted by substituting a DIFFERENT real
        // grammar: still valid WASM, still a real grammar, wrong one. Arbitrary
        // corruption could not make this point — it would fail the header check
        // first and never reach the digest.
        const other = fs.readFileSync(path.join(REPO_ROOT, 'src/vendor/grammars/tree-sitter-javascript.wasm'));
        expect(wasmMagicAndVersionValid(other)).toBe(true);

        const v = evaluate({ bytes: other, probe: { abi: 14, grammar_id: 'javascript' } });
        expect(v.eligible).toBe(false);
        const joined = v.failures.join(' · ');
        expect(joined).toContain('sha256 mismatch');
        expect(joined).toContain('grammar_id mismatch');
    });

    it('rejects a size that disagrees with the bytes', () => {
        const v = evaluate({ manifest: { ...manifest, entries: [{ ...phpEntry, size: phpEntry.size - 1 }] } });
        expect(v.eligible).toBe(false);
        expect(v.failures.join(' · ')).toContain('size mismatch');
    });
});

describe('negative: the structural conditions', () => {
    it('rejects a path with no manifest entry', () => {
        const v = evaluateEntry({
            filePath: 'src/vendor/grammars/unlisted.wasm',
            packedPaths: new Set(['src/vendor/grammars/unlisted.wasm']),
            manifest,
            bytes: phpBytes,
            probe: TRUE_PROBE,
        });
        expect(v.eligible).toBe(false);
        expect(v.failures.join(' · ')).toContain('no manifest entry');
    });

    it('rejects a wildcard grant anywhere in the manifest', () => {
        const wild = { ...manifest, entries: [...manifest.entries, { ...phpEntry, path: 'src/vendor/grammars/*' }] };
        const v = evaluate({ manifest: wild });
        expect(v.eligible).toBe(false);
        expect(v.failures.join(' · ')).toContain('wildcard or directory grants');
    });

    it('rejects a duplicate row for the same path', () => {
        const dup = { ...manifest, entries: [...manifest.entries, { ...phpEntry }] };
        expect(duplicatePaths(dup)).toEqual([PHP]);
        const v = evaluate({ manifest: dup });
        expect(v.eligible).toBe(false);
        expect(v.failures.join(' · ')).toContain('more than one manifest entry');
    });

    it('rejects a file that is not in the packed tarball', () => {
        const v = evaluate({ packedPaths: new Set<string>() });
        expect(v.eligible).toBe(false);
        expect(v.failures.join(' · ')).toContain('not in the packed tarball');
    });

    it('rejects a kind the predicate cannot verify', () => {
        const v = evaluate({ manifest: { ...manifest, entries: [{ ...phpEntry, kind: 'opaque-blob' }] } });
        expect(v.eligible).toBe(false);
        expect(v.failures.join(' · ')).toContain(`kind is not ${VERIFIABLE_KIND}`);
    });

    it('rejects when the production loader could not answer', () => {
        // An unverifiable binary is not an eligible one. `null` must fail 8 and
        // 9 rather than pass them by absence.
        const v = evaluate({ probe: null });
        expect(v.eligible).toBe(false);
        expect(v.failures.join(' · ')).toContain('production loader could not read');
    });
});

describe('the manifest agrees with the bytes on disk', () => {
    it('every entry hashes, sizes and validates as WASM', () => {
        for (const e of manifest.entries) {
            const bytes = fs.readFileSync(path.join(REPO_ROOT, e.path));
            expect(createHash('sha256').update(bytes).digest('hex'), e.path).toBe(e.sha256);
            expect(bytes.length, e.path).toBe(e.size);
            expect(wasmMagicAndVersionValid(bytes), e.path).toBe(true);
        }
    });
});

describe('the manifest agrees with the PRODUCTION loader', () => {
    it('every entry reports the manifest grammar_id and ABI through the engine', async () => {
        // The condition the CI wiring exists for. `packed_binary_predicate` is
        // pure and takes the probe by injection, so without this the manifest
        // could drift from the loader and every unit test above would still
        // pass — the drift would only surface in the gate, on a branch that
        // touched something else.
        const { probeGrammarFile } = await import('../../src/scripts/code_graph/loader.js');
        for (const e of manifest.entries) {
            const probe = await probeGrammarFile(path.join(REPO_ROOT, e.path));
            expect(probe.grammar_id, e.path).toBe(e.grammar_id);
            expect(probe.abi, e.path).toBe(e.abi);
        }
    }, 120_000);
});
