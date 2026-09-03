/**
 * The situational-awareness observation record, and the premise comparison the
 * continuation ladder's seventh rung is decided by.
 *
 * `road-to-wired-instruments` Phase 2.1. Both directions are pinned on purpose:
 * a drift detector that never fires and one that fires on everything fail the
 * same way — the operator switches it off — and only one of the two is visible
 * from an assertion that the happy path passes.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    observationFile,
    premiseMoved,
    readContextObservation,
    recordContextObservation,
} from '../../src/scripts/_lib/context_observation.js';

let root = '';
beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-obs-'));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('recordContextObservation / readContextObservation', () => {
    it('round-trips a reading', () => {
        expect(recordContextObservation(root, 'road-to-x', 'fp-1')).toBe(true);
        const obs = readContextObservation(root);
        expect(obs?.fingerprint).toBe('fp-1');
        expect(obs?.roadmap).toBe('road-to-x');
        expect(obs?.schema_version).toBe(1);
    });

    it('the newest write wins — the file is one repository-wide slot', () => {
        recordContextObservation(root, 'road-to-x', 'fp-1');
        recordContextObservation(root, '', 'fp-2');
        // An UNSCOPED probe must be able to overwrite a scoped one: the
        // fingerprint is a fact about the repository, not about the roadmap the
        // probe happened to be pointed at. Keying it per roadmap would lose
        // exactly this reading.
        expect(readContextObservation(root)?.fingerprint).toBe('fp-2');
    });

    it('an empty fingerprint is refused rather than recorded as a reading', () => {
        expect(recordContextObservation(root, 'road-to-x', '   ')).toBe(false);
        expect(readContextObservation(root)).toBeNull();
    });

    it('an absent file reads as null, not as an exception', () => {
        expect(readContextObservation(root)).toBeNull();
    });

    it('a corrupt file reads as null, not as an exception', () => {
        const f = observationFile(root);
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, '{ not json', 'utf-8');
        expect(readContextObservation(root)).toBeNull();
    });

    it('a well-formed file missing the fingerprint reads as null', () => {
        const f = observationFile(root);
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, JSON.stringify({ schema_version: 1, at: 'x' }), 'utf-8');
        expect(readContextObservation(root)).toBeNull();
    });
});

describe('premiseMoved — an unknown is never a disagreement', () => {
    it('two known, differing fingerprints have moved', () => {
        expect(premiseMoved('a', 'b')).toBe(true);
    });

    it('two known, equal fingerprints have not', () => {
        expect(premiseMoved('a', 'a')).toBe(false);
    });

    // The four ways a side can be unknown. Each is its own row because a
    // detector that read any one of them as "moved" would halt a healthy run,
    // and one false alarm on a rung that ENDS a run costs more than a missed
    // one: it teaches the operator to disable the rung.
    it.each([
        ['claimed null', null, 'b'],
        ['claimed undefined', undefined, 'b'],
        ['claimed empty', '', 'b'],
        ['observed null', 'a', null],
        ['observed undefined', 'a', undefined],
        ['observed empty', 'a', ''],
        ['both unknown', null, null],
    ] as const)('%s → not moved', (_label, claimed, observed) => {
        expect(premiseMoved(claimed, observed)).toBe(false);
    });
});
