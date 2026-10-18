// road-to-a-canvas-the-code-owns 4.1 — the design-sync ledger schema.
import { describe, expect, it } from 'vitest';

import {
    LEDGER_SCHEMA,
    PROJECTION_STATES,
    ROW_CLASSES,
    serializeLedger,
    validateLedger,
} from '../../src/scripts/_lib/design_sync_ledger.js';

function ledger(rows: unknown[], projection: Record<string, unknown> = { projectId: 'p1', commit: 'abc1234', state: 'prepared' }): Record<string, unknown> {
    return { schema: LEDGER_SCHEMA, scope_root: '.', config: '.design-sync/config.json', projection, remote_reachable: true, rows };
}
const row = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    key: 'colors.light.primary',
    kind: 'token',
    class: 'conflict',
    base: '#000',
    code: '#111',
    remote: '#222',
    disposition: 'pending',
    ...over,
});

describe('sync ledger schema', () => {
    it('names exactly the eight row classes and four projection states', () => {
        expect([...ROW_CLASSES]).toEqual(['in-sync', 'code-only', 'remote-generated', 'remote-only:collides', 'remote-only:twin', 'conflict', 'orphan', 'unknown']);
        expect([...PROJECTION_STATES]).toEqual(['prepared', 'user-reported-ran', 'host-artifacts-observed', 'picker-confirmed']);
    });

    it('accepts a valid plan-stage ledger, with and without the optional anchor hash', () => {
        expect(validateLedger(ledger([row()]))).toEqual([]);
        expect(validateLedger(ledger([row()], { projectId: null, commit: null, anchor_hash: 'h', state: 'prepared' }))).toEqual([]);
    });

    it('a row without a disposition fails validation at every stage', () => {
        const { disposition: _d, ...bare } = row();
        expect(validateLedger(ledger([bare]))).toEqual([expect.stringMatching(/has no disposition/)]);
        expect(validateLedger(ledger([bare]), 'reconciled')).toEqual([expect.stringMatching(/has no disposition/)]);
    });

    it('pending is accepted after plan and refused once reconciled', () => {
        expect(validateLedger(ledger([row()]), 'reconciled')).toEqual([expect.stringMatching(/still pending/)]);
        expect(validateLedger(ledger([row({ disposition: 'keep-code' })]), 'reconciled')).toEqual([]);
    });

    it('rejects an unknown class, state, scope root or duplicate key', () => {
        expect(validateLedger(ledger([row({ class: 'stale' })])).join()).toMatch(/class must be/);
        expect(validateLedger(ledger([row()], { projectId: 'p', commit: 'c', state: 'synced' })).join()).toMatch(/projection.state/);
        expect(validateLedger({ ...ledger([row()]), scope_root: '' }).join()).toMatch(/scope_root/);
        expect(validateLedger(ledger([row(), row()])).join()).toMatch(/duplicate key/);
    });

    it('serialises deterministically', () => {
        const a = serializeLedger(ledger([row()]) as never);
        const b = serializeLedger(JSON.parse(a) as never);
        expect(a).toBe(b);
    });
});
