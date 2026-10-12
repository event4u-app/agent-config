import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    REVIEWER_PATHS,
    SELF_SURFACE,
    classifyPaths,
    evaluate,
    requiresRatification,
} from '../../src/scripts/check_kernel_edit_ratified.js';
import { gatedFilesOf } from '../../src/scripts/_lib/ratification_subject.js';

/**
 * Step 4.1 — the review's own code is a gated surface.
 *
 * The gate watched itself, its reader, its policy, its workflow and the anchor,
 * and did not watch the modules that compute a record's `subject`, write the
 * record, ask the review's questions and derive its verdict. The reviewer was
 * therefore outside what it reviews, which is the shape ADR-268 § 4 forbids one
 * level up.
 *
 * Every case has a polarity partner. A test file that only proved the new reds
 * would certify a gate that reds on all of `src/scripts/ai_council/`, which is
 * precisely the over-reach the step rules out — an ordinary change to the
 * council's prompts or transports must stay ungated.
 */

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'revpath-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('the review mechanism is inside the gate', () => {
    it.each([...REVIEWER_PATHS])('%s needs a record', (p) => {
        expect(requiresRatification(classifyPaths([p]))).toBe(true);
    });

    it('names each of them a review-mechanism edit, not a rule edit', () => {
        for (const p of REVIEWER_PATHS) {
            const g = classifyPaths([p]);
            expect(g.self, p).toBe(true);
            expect(g.kernelRules, p).toEqual([]);
            expect(g.governanceHooks, p).toEqual([]);
        }
    });

    it('refuses a reviewer-module edit that carries no record', () => {
        const r = evaluate(['src/scripts/ai_council/modification_review.ts'], root, 2);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('the review mechanism itself');
    });
});

describe('the rest of the council stays ungated', () => {
    it.each([
        'src/scripts/ai_council/prompts.ts',
        'src/scripts/ai_council/stance_tally.ts',
        'src/scripts/ai_council/quorum.ts',
        'src/scripts/council_cli.ts',
    ])('%s is an ordinary change', (p) => {
        expect(requiresRatification(classifyPaths([p]))).toBe(false);
    });

    it('an ordinary council edit passes with no record at all', () => {
        const r = evaluate(['src/scripts/ai_council/prompts.ts'], root, 2);
        expect(r.exitCode, r.lines.join('\n')).toBe(0);
        expect(r.lines.join('\n')).toContain('nothing to ratify');
    });
});

describe('the reviewer paths are covered by the digest, not only by the refusal', () => {
    it('every reviewer path enters the gated set the digest is taken over', () => {
        // A path the gate reds on but the digest does not cover would be a path
        // a record could be bound to without covering — the gap step 2.1 closed
        // for the old surface and 4.1 must not reopen for the new one.
        for (const p of REVIEWER_PATHS) {
            expect([...gatedFilesOf([p])], p).toContain(p);
        }
    });

    it('SELF_SURFACE is the one list, with no path defined twice', () => {
        expect(new Set(SELF_SURFACE).size).toBe(SELF_SURFACE.length);
        for (const p of REVIEWER_PATHS) {
            expect(SELF_SURFACE).toContain(p);
        }
    });
});
