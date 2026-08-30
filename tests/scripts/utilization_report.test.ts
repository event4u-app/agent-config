// U1 — loaded-vs-fired utilization report (verdict logic + floor honesty).
import { expect, test } from 'vitest';

import {
    MIN_SESSIONS,
    decide,
} from '../../src/scripts/utilization_report.js';

const EXEMPT = { kernel: new Set(['commit-policy']), safety_floors: new Set(['finance-safety-floor']) };

test('D1: loaded-never-consulted above the session floor → REAP', () => {
    const v = decide({ kind: 'skills', id: 'dead-skill', loaded: 12, consulted: 0, applied: 0 }, EXEMPT, MIN_SESSIONS);
    expect(v.verdict).toBe('REAP');
    expect(v.rule).toBe('D1');
});

test('D1 exemption: kernel + safety floors never REAP', () => {
    expect(decide({ kind: 'rules', id: 'commit-policy', loaded: 12, consulted: 0, applied: 0 }, EXEMPT, MIN_SESSIONS).verdict).toBe('KEEP');
    expect(decide({ kind: 'rules', id: 'finance-safety-floor', loaded: 12, consulted: 0, applied: 0 }, EXEMPT, MIN_SESSIONS).verdict).toBe('KEEP');
});

test('D2: consulted>=5 with applied-ratio <10% → REVIEW (trigger queue, not deletion)', () => {
    const v = decide({ kind: 'rules', id: 'noisy-rule', loaded: 20, consulted: 10, applied: 0 }, EXEMPT, MIN_SESSIONS);
    expect(v.verdict).toBe('REVIEW');
    expect(v.rule).toBe('D2');
});

test('session floor: below MIN_SESSIONS no negative verdict is allowed', () => {
    const v = decide({ kind: 'skills', id: 'dead-skill', loaded: 12, consulted: 0, applied: 0 }, EXEMPT, MIN_SESSIONS - 1);
    expect(v.verdict).toBe('KEEP');
});


// ---------------------------------------------------------------------------
// road-to-experience-loop-broadening step 6.4
//
// verify: a low-usage safety-classified asset is not proposed for retirement,
// and a low-usage ordinary asset is.
//
// The suite above uses a HAND-BUILT exempt set, which is the right unit test for
// `decide`. These read the REAL exempt set off the projected rule tree, because
// the defect 6.4 found was in `read_exempt`'s predicate, not in `decide` -- a
// fixture exempt set cannot see it.
// ---------------------------------------------------------------------------

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

import { describe, it } from 'vitest';

import { read_exempt } from '../../src/scripts/utilization_report.js';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..');
const rulesDir = path.join(repoRoot, 'dist', 'agent-src', 'rules');
const exempt = read_exempt(rulesDir);

/** The shape D1 fires on: loaded, never consulted, above the session floor. */
const lowUsage = (id: string) => ({ kind: 'rules', id, loaded: 5, consulted: 0, applied: 0 });

describe('the verify line, both halves', () => {
    it('a low-usage ORDINARY rule is proposed for retirement', () => {
        // The positive control. Without it, an exemption that swallowed
        // everything would satisfy the first half and mean nothing.
        const v = decide(lowUsage('markdown-safe-codeblocks'), exempt, MIN_SESSIONS);
        expect(v.verdict).toBe('REAP');
        expect(v.rule).toBe('D1');
    });

    it('a low-usage SAFETY rule is not', () => {
        const v = decide(lowUsage('engineering-safety-floor'), exempt, MIN_SESSIONS);
        expect(v.verdict).toBe('KEEP');
    });
});

describe('the carve-out covers every safety surface, not four of nine', () => {
    // Widened 2026-08-30. The predicate was `endsWith('-safety-floor')`, which
    // left five safety rules REAP-eligible -- including domain-safety-pii and
    // tool-safety. Low usage is exactly what a working safety floor looks like:
    // it fires rarely, and rarely is not the same as never needed.
    const SAFETY_RULES = [
        'domain-safety-disclaimer',
        'domain-safety-pii',
        'domain-safety-retention',
        'engineering-safety-floor',
        'finance-safety-floor',
        'legal-safety-floor',
        'runtime-safety',
        'strategy-safety-floor',
        'tool-safety',
    ];

    it('every one of them exists in the projected tree', () => {
        // So a rename turns this red rather than silently emptying the sweep.
        const missing = SAFETY_RULES.filter((id) => !fs.existsSync(path.join(rulesDir, `${id}.md`)));
        expect(missing).toEqual([]);
    });

    it('none of them is proposed for retirement on low usage', () => {
        const reaped = SAFETY_RULES.filter((id) => decide(lowUsage(id), exempt, MIN_SESSIONS).verdict === 'REAP');
        expect(reaped).toEqual([]);
    });

    it('the exemption set is exactly those nine — it did not become a blanket', () => {
        // Guards the other direction: a predicate that matched everything would
        // pass every assertion above while disabling retirement entirely.
        expect([...exempt.safety_floors].sort()).toEqual([...SAFETY_RULES].sort());
    });
});

describe('the session floor still wins over everything', () => {
    it('below MIN_SESSIONS no negative verdict is issued, exempt or not', () => {
        expect(decide(lowUsage('markdown-safe-codeblocks'), exempt, MIN_SESSIONS - 1).verdict).toBe('KEEP');
    });
});
