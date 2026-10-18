// road-to-a-canvas-the-code-owns 7.2, 8.1 — `/design-system:sync verify`.
import { describe, expect, it } from 'vitest';

import { LEDGER_SCHEMA, type Ledger } from '../../src/scripts/_lib/design_sync_ledger.js';
import { renderCheckFailures, stampBaselines, verifyLedger } from '../../src/scripts/_lib/design_sync_verify.js';

const ledger = (commit: string | null, extra: Partial<Ledger> = {}): Ledger => ({
    schema: LEDGER_SCHEMA,
    scope_root: '.',
    config: '.design-sync/config.json',
    projection: { projectId: 'p', commit, state: 'user-reported-ran' },
    remote_reachable: true,
    rows: [],
    ...extra,
});
const CLEAN = { checked: 12, failures: 0, variantsIdentical: 0 };

describe('verify — baseline stamp', () => {
    it('stale-baseline: a baseline made against an older projection commit is stale', () => {
        let l = stampBaselines(ledger('aaa1111'), ['tests/e2e/a.spec.ts-snapshots/a.png']);
        expect(l.baselines).toEqual([{ path: 'tests/e2e/a.spec.ts-snapshots/a.png', projection_commit: 'aaa1111' }]);
        expect(verifyLedger(l, { renderCheck: CLEAN, renderDispositions: {} }).stale_baselines).toEqual([]);
        l = { ...stampBaselines({ ...l, projection: { ...l.projection, commit: 'bbb2222' } }, ['tests/e2e/b.spec.ts-snapshots/b.png']) };
        const r = verifyLedger(l, { renderCheck: CLEAN, renderDispositions: {} });
        expect(r.stale_baselines).toEqual(['tests/e2e/a.spec.ts-snapshots/a.png (made against aaa1111, current bbb2222)']);
    });

    it('stale-baseline: with no projection commit staleness is undecidable and reported degraded', () => {
        const l = stampBaselines(ledger(null), ['x-snapshots/a.png']);
        const r = verifyLedger(l, { renderCheck: CLEAN, renderDispositions: {} });
        expect(r.verification).toBe('degraded');
        expect(r.reasons.join()).toMatch(/no projection commit/);
    });
});

describe('verify — render check', () => {
    it('render-check: a non-zero failure count without a disposition fails the run', () => {
        const doc = { summary: { checked: 9, failures: 2 }, variantsIdentical: 1 };
        expect(renderCheckFailures(doc)).toEqual({ 'summary.failures': 2, variantsIdentical: 1 });
        const r = verifyLedger(ledger('aaa1111'), { renderCheck: doc, renderDispositions: { variantsIdentical: 'two variants are intentionally the same' } });
        expect(r.failures).toEqual(['render check summary.failures = 2 with no disposition']);
    });

    it('render-check: a clean report passes and a missing one is unverified, never a pass', () => {
        expect(verifyLedger(ledger('aaa1111'), { renderCheck: CLEAN, renderDispositions: {} })).toMatchObject({ verification: 'verified', failures: [] });
        const missing = verifyLedger(ledger('aaa1111'), { renderCheck: null, renderDispositions: {} });
        expect(missing.verification).toBe('unverified');
        expect(missing.reasons.join()).toMatch(/render-check/);
    });

    it('render-check: an undispositioned ledger row also fails verify', () => {
        const l = ledger('aaa1111', { rows: [{ key: 'Hero', kind: 'component', class: 'remote-only:twin', base: null, code: null, remote: '{}', disposition: 'pending' }] });
        expect(verifyLedger(l, { renderCheck: CLEAN, renderDispositions: {} }).failures).toEqual(['row Hero (remote-only:twin) has no disposition']);
    });
});
