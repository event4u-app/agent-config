// Tests for src/scripts/hooks/bundle_integrity.ts — step 3.1 of
// road-to-a-kernel-that-guards-its-plumbing.
//
// Both polarities throughout, because the two ways this can be wrong point in
// opposite directions and only one of them is loud. A check that never refuses
// is a check nobody notices is broken; a check that refuses when it cannot
// verify wedges every consumer whose package predates the sidecar. So every
// refusal case here is paired with the allow that bounds it, and the
// `unverifiable` cases are asserted to ALLOW rather than merely "not throw".
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    hashFile,
    parseSidecar,
    readStamp,
    sidecarPathFor,
    stampMatches,
    stampOf,
    verifyBundle,
    verifyBundleCached,
    writeStamp,
} from '../../../src/scripts/hooks/bundle_integrity.js';

let dir: string;
let bundle: string;
let sidecar: string;

const BODY = 'console.log("pretend this is 1.5 MB of dispatcher");\n';

const writeSidecarFor = (text: string): void => {
    const d = createHash('sha256').update(Buffer.from(text)).digest('hex');
    fs.writeFileSync(sidecar, `${d}  dispatch.js\n`, 'utf-8');
};

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-bundle-integrity-'));
    bundle = path.join(dir, 'dispatch.js');
    sidecar = path.join(dir, 'dispatch.sha256');
    fs.writeFileSync(bundle, BODY, 'utf-8');
    writeSidecarFor(BODY);
});

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('sidecarPathFor', () => {
    it('drops the .js — the spelling the roadmap step named', () => {
        expect(sidecarPathFor('/a/dist/hooks/dispatch.js')).toBe('/a/dist/hooks/dispatch.sha256');
    });
});

describe('parseSidecar', () => {
    it('reads the shasum two-space form', () => {
        expect(parseSidecar(`${'a'.repeat(64)}  dispatch.js\n`)).toBe('a'.repeat(64));
    });

    it('tolerates a single space and a missing newline', () => {
        expect(parseSidecar(`${'b'.repeat(64)} dispatch.js`)).toBe('b'.repeat(64));
    });

    it('refuses a short, long or non-hex digest rather than half-matching one', () => {
        expect(parseSidecar(`${'a'.repeat(63)}  x`)).toBeNull();
        expect(parseSidecar(`${'z'.repeat(64)}  x`)).toBeNull();
        expect(parseSidecar('')).toBeNull();
    });
});

describe('verifyBundle — the three verdicts', () => {
    it('ok when the bundle hashes to the sidecar', () => {
        const v = verifyBundle(bundle);
        expect(v.state).toBe('ok');
    });

    it('mismatch when one byte changes, and it names both digests', () => {
        fs.appendFileSync(bundle, '\n');
        const v = verifyBundle(bundle);
        expect(v.state).toBe('mismatch');
        if (v.state !== 'mismatch') throw new Error('unreachable');
        expect(v.expected).not.toBe(v.actual);
        expect(v.actual).toBe(hashFile(bundle));
    });

    it('mismatch clears on a rebuild', () => {
        fs.appendFileSync(bundle, '\n');
        expect(verifyBundle(bundle).state).toBe('mismatch');
        writeSidecarFor(fs.readFileSync(bundle, 'utf-8'));
        expect(verifyBundle(bundle).state).toBe('ok');
    });

    it('unverifiable — not mismatch — when the sidecar is absent', () => {
        fs.rmSync(sidecar);
        const v = verifyBundle(bundle);
        // The distinction is the whole safety argument: an absent control is
        // not a tripped control, and the caller allows on `unverifiable`.
        expect(v.state).toBe('unverifiable');
        expect(v.state).not.toBe('mismatch');
    });

    it('unverifiable when the sidecar is malformed', () => {
        fs.writeFileSync(sidecar, 'not a digest\n', 'utf-8');
        expect(verifyBundle(bundle).state).toBe('unverifiable');
    });

    it('unverifiable when the bundle itself is missing', () => {
        fs.rmSync(bundle);
        expect(verifyBundle(bundle).state).toBe('unverifiable');
    });
});

describe('the stamp cache', () => {
    it('hashes once, then answers from the stamp', () => {
        const first = verifyBundleCached(bundle, dir);
        expect(first.verdict.state).toBe('ok');
        expect(first.hashed).toBe(true);
        const second = verifyBundleCached(bundle, dir);
        expect(second.verdict.state).toBe('ok');
        // The assertion that makes this a cache test rather than a repeat of
        // the one above.
        expect(second.hashed).toBe(false);
    });

    it('re-hashes when the file changes under the stamp', () => {
        verifyBundleCached(bundle, dir);
        fs.appendFileSync(bundle, '// edited\n');
        const after = verifyBundleCached(bundle, dir);
        expect(after.hashed).toBe(true);
        expect(after.verdict.state).toBe('mismatch');
    });

    it('does NOT cache a mismatch, so a rebuild clears it without a stale refusal', () => {
        fs.appendFileSync(bundle, '// edited\n');
        expect(verifyBundleCached(bundle, dir).verdict.state).toBe('mismatch');
        writeSidecarFor(fs.readFileSync(bundle, 'utf-8'));
        const fixed = verifyBundleCached(bundle, dir);
        expect(fixed.verdict.state).toBe('ok');
        expect(fixed.hashed).toBe(true);
    });

    it('keys the cache per bundle path, so two bundles do not share a stamp', () => {
        const other = path.join(dir, 'other.js');
        fs.writeFileSync(other, 'different content\n', 'utf-8');
        verifyBundleCached(bundle, dir);
        // A second bundle with no sidecar of its own must not inherit the
        // first one's `ok`.
        expect(verifyBundleCached(other, dir).verdict.state).toBe('unverifiable');
    });

    it('falls back to verifying when the cache directory is unwritable', () => {
        const nowhere = path.join(dir, 'no', 'such', 'dir');
        const r = verifyBundleCached(bundle, nowhere);
        // Slower, never wrong.
        expect(r.verdict.state).toBe('ok');
        expect(r.hashed).toBe(true);
    });
});

describe('stamp helpers', () => {
    it('stampMatches is false for a missing stamp and for a changed file', () => {
        expect(stampMatches(bundle, null)).toBe(false);
        const st = stampOf(bundle, 'irrelevant');
        expect(stampMatches(bundle, st)).toBe(true);
        fs.appendFileSync(bundle, 'x');
        expect(stampMatches(bundle, st)).toBe(false);
    });

    it('stampMatches is false when the file vanished, rather than throwing', () => {
        const st = stampOf(bundle, 'irrelevant');
        fs.rmSync(bundle);
        expect(stampMatches(bundle, st)).toBe(false);
    });

    it('readStamp rejects a partial record instead of trusting it', () => {
        const p = path.join(dir, 'stamp.json');
        fs.writeFileSync(p, JSON.stringify({ sha: 'a', size: 1 }), 'utf-8');
        expect(readStamp(p)).toBeNull();
        fs.writeFileSync(p, 'not json', 'utf-8');
        expect(readStamp(p)).toBeNull();
        writeStamp(p, { sha: 'a', size: 1, mtimeMs: 2 });
        expect(readStamp(p)).toEqual({ sha: 'a', size: 1, mtimeMs: 2 });
    });
});
