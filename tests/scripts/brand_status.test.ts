/**
 * `brand:status` — the probe from `road-to-capability-answerability` 2.4.
 *
 * Two properties matter and both are asserted. The probe must search the SAME
 * paths the real resolver searches — a probe with its own copy of the list is a
 * second answer waiting to disagree — and it must distinguish "no brand" from
 * "a brand file nothing can read", because those need opposite actions.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
    findBrandTokens,
    findDottedNearMisses,
    parseArgv,
    runBrandStatus,
} from '../../src/scripts/_cli/cmd_brand_status.js';
import { BRAND_TOKEN_PATHS } from '../../src/agent-src/templates/scripts/work_engine/directives/ui/scaffold.js';

function scratch(): string {
    return mkdtempSync(join(tmpdir(), 'brand-status-'));
}

function writeAt(root: string, rel: string): void {
    mkdirSync(join(root, dirname(rel)), { recursive: true });
    writeFileSync(join(root, rel), '{}', 'utf-8');
}

describe('brand:status argv', () => {
    it('accepts nothing and --json only', () => {
        expect(parseArgv([]).ok).toBe(true);
        expect(parseArgv(['--json'])).toMatchObject({ ok: true, json: true });
        expect(parseArgv(['x']).ok).toBe(false);
    });
});

describe('brand token discovery', () => {
    it('finds a tokens file at every canonical path the resolver searches', () => {
        // Iterating BRAND_TOKEN_PATHS rather than naming paths keeps this test
        // correct when the resolver's list changes — which is the same reason
        // the probe imports the list instead of copying it.
        for (const rel of BRAND_TOKEN_PATHS) {
            const root = scratch();
            writeAt(root, rel);
            expect(findBrandTokens(root)).toBe(rel);
        }
    });

    it('returns null when no canonical path holds a file', () => {
        expect(findBrandTokens(scratch())).toBeNull();
    });

    it('honours the resolver precedence: first hit wins', () => {
        const root = scratch();
        const [first, second] = BRAND_TOKEN_PATHS;
        writeAt(root, second as string);
        writeAt(root, first as string);
        expect(findBrandTokens(root)).toBe(first);
    });
});

describe('dot-prefixed near-misses', () => {
    it('reports a .tokens.json that the resolver can never find', () => {
        const root = scratch();
        writeAt(root, '.tokens.json');

        expect(findBrandTokens(root)).toBeNull();
        expect(findDottedNearMisses(root)).toContain('.tokens.json');

        const text = runBrandStatus({ cwd: root, json: false }).out.join('\n');
        // The two facts must not collapse into one: no brand layer AND a file
        // that looks authored. Reporting only the first sends the user to
        // create a second file; reporting only the second hides the real state.
        expect(text).toContain('brand layer   none');
        expect(text).toContain('is NOT read by anything');
    });

    it('stays quiet when there is no near-miss', () => {
        const root = scratch();
        writeAt(root, BRAND_TOKEN_PATHS[0] as string);
        const result = runBrandStatus({ cwd: root, json: true });
        const payload = JSON.parse(result.out.join('\n')) as {
            brand_layer_present: boolean;
            dotted_near_misses: string[];
        };
        expect(payload.brand_layer_present).toBe(true);
        expect(payload.dotted_near_misses).toEqual([]);
    });

    it('treats absence as an answer, never as a failure', () => {
        // Greenfield is a legitimate state under brand-source-of-truth, so the
        // verb must not exit non-zero on it.
        expect(runBrandStatus({ cwd: scratch(), json: false }).code).toBe(0);
    });
});
