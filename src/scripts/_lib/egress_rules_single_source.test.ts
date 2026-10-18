/**
 * The rule table is the only place a raw-key prefix is spelled (road-to-one-
 * detector-and-the-senders-we-own step 2.2). The gate is
 * `src/scripts/check_credential_spelling.ts`; this suite drives its exported
 * scanner over the real tree and over inline cases, so a regression shows in the
 * test job as well as in the gate's own CI step.
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { findSpellings, offendingLines } from '../check_credential_spelling.js';
import { CREDENTIAL_PREFIXES } from './egress_rules.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('one place spells a raw-key prefix', () => {
    it('the table declares prefixes', () => {
        expect(CREDENTIAL_PREFIXES.length).toBeGreaterThan(5);
    });

    it('the scanner refuses a second spelling (sensitivity)', () => {
        expect(offendingLines("const RE = /sk-ant-[A-Za-z0-9]{20,}/;")).toEqual([1]);
        expect(offendingLines("const P = ['ya29\\\\.', 'AIza'];")).toEqual([1]);
        expect(offendingLines('// sk-ant- in a comment\nconst task = "task-runner";')).toEqual([]);
        expect(offendingLines("const k = 'sk-x'; // not-a-credential-pattern:")).toEqual([1]);
        expect(offendingLines("const k = 'sk-x'; // not-a-credential-pattern: fake")).toEqual([]);
        // A quoted rule id names a row; a bare prefix beside it still counts.
        expect(offendingLines("prefixesOf('xai-api-key')")).toEqual([]);
        expect(offendingLines("const k = 'xai-' + v; // 'xai-api-key'")).toEqual([1]);
    });

    it('no file outside the table spells one', () => {
        const { hits, scanned } = findSpellings(ROOT);
        expect(scanned).toBeGreaterThan(100);
        expect(hits).toEqual([]);
    });
});
