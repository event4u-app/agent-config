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
