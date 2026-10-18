// road-to-a-canvas-the-code-owns 5.1, 6.1, 6.2, 8.3 — `/design-system:sync reconcile`.
import { describe, expect, it } from 'vitest';

import { LEDGER_SCHEMA, type Ledger, type LedgerRow } from '../../src/scripts/_lib/design_sync_ledger.js';
import {
    type ReconcileInput,
    authoritySignals,
    matrixRows,
    reconcileLedger,
} from '../../src/scripts/_lib/design_sync_reconcile.js';
import { resolveUiAuthority } from '../../src/scripts/_lib/ui_authority.js';

const row = (key: string, cls: LedgerRow['class'], kind: LedgerRow['kind'] = 'token'): LedgerRow => ({
    key,
    kind,
    class: cls,
    base: null,
    code: cls.startsWith('remote-only') ? null : 'c',
    remote: '{"props":["variant"]}',
    disposition: cls === 'in-sync' ? 'no-action' : 'pending',
});
const ledger = (rows: LedgerRow[], extra: Partial<Ledger> = {}): Ledger => ({
    schema: LEDGER_SCHEMA,
    scope_root: '.',
    config: '.design-sync/config.json',
    projection: { projectId: 'p', commit: 'abc1234', state: 'prepared' },
    remote_reachable: true,
    rows,
    ...extra,
});
const input = (over: Partial<ReconcileInput> = {}): ReconcileInput => ({
    referenceMaturity: 'finished-comp',
    incumbent: { coherent: true, palette: ['#111'] },
    locks: { palette: false, type_family: false },
    dispositions: {},
    tiers: [],
    owner: 'fe-design',
    ...over,
});

describe('reconcile — authority posture', () => {
    it('authority-posture: conflict rows are pre-filled from the resolver posture, never decided', () => {
        const l = ledger([row('colors.light.primary', 'conflict'), row('radius.md', 'conflict')]);
        const { ledger: out } = reconcileLedger(l, input({ locks: { palette: true, type_family: false } }));
        const byKey = Object.fromEntries(out.rows.map((r) => [r.key, r]));
        expect(byKey['colors.light.primary']?.proposed).toEqual({ side: 'code', primary_source: 'comp', constraints: ['preserve_palette'] });
        expect(byKey['radius.md']?.proposed).toEqual({ side: 'remote', primary_source: 'comp', constraints: ['preserve_palette'] });
        // a proposal is not a disposition
        expect(out.rows.every((r) => r.disposition === 'pending')).toBe(true);
    });

    it('authority-posture: the ledger carries the one resolver call verbatim, conflicts included', () => {
        const i = input({ locks: { palette: true, type_family: true }, userIntent: { change_intent: 'redesign' } });
        const { ledger: out } = reconcileLedger(ledger([row('colors.light.primary', 'conflict')]), i);
        const a = resolveUiAuthority(authoritySignals(i));
        expect(out.authority).toEqual({
            primary_source: a.primary_source,
            change_intent: a.change_intent,
            constraints: a.constraints,
            conflicts: a.conflicts,
            verification: a.verification,
            provenance: a.provenance,
        });
        expect(authoritySignals(i).hard_constraints).toEqual(['preserve_palette', 'preserve_type_family']);
    });

    it('authority-posture: a production incumbent reference points every conflict at the code', () => {
        const { ledger: out } = reconcileLedger(ledger([row('radius.md', 'conflict')]), input({ referenceMaturity: 'production-incumbent' }));
        expect(out.rows[0]?.proposed?.side).toBe('code');
    });

    it('authority-posture: a row left pending keeps the run open; a disposition closes it', () => {
        const l = ledger([row('radius.md', 'conflict')]);
        expect(reconcileLedger(l, input()).errors).toEqual([expect.stringMatching(/radius.md: conflict row has no disposition/)]);
        const done = reconcileLedger(l, input({ dispositions: { 'radius.md': 'keep-code' } }));
        expect(done.errors).toEqual([]);
        expect(done.ledger.rows[0]?.disposition).toBe('keep-code');
    });
});

describe('reconcile — components through the existing owner', () => {
    it('brief-handoff: an imported remote-only component becomes a brief for the UI owner, never a write', () => {
        const l = ledger([row('Hero', 'remote-only:twin', 'component'), row('colors.light.x', 'remote-only:twin')]);
        const { ledger: out, errors } = reconcileLedger(l, input({ dispositions: { Hero: 'import-as-brief', 'colors.light.x': 'take-remote' } }));
        expect(errors).toEqual([]);
        expect(out.briefs).toEqual([
            {
                component: 'Hero',
                spec: expect.stringMatching(/the spec/),
                contract: '{"props":["variant"]}',
                owner: 'fe-design',
                coverage: expect.stringMatching(/honoured, translated or flagged.*writes no component/),
            },
        ]);
    });

    it('brief-handoff: import-as-brief on a token or a code component is refused', () => {
        const l = ledger([row('colors.light.x', 'remote-only:twin'), row('Card', 'conflict', 'component')]);
        const { errors } = reconcileLedger(l, input({ dispositions: { 'colors.light.x': 'import-as-brief', Card: 'keep-as-exploration' } }));
        expect(errors.filter((e) => /applies only to a remote-only component/.test(e))).toHaveLength(2);
    });

    it('taxonomy-recorded: a brief carries the recorded tiers, and none when none were recorded', () => {
        const l = ledger([row('Hero', 'remote-only:collides', 'component')]);
        const set = { dispositions: { Hero: 'import-as-brief' as const } };
        expect(reconcileLedger(l, input({ ...set, tiers: ['primitives', 'patterns'] })).ledger.briefs?.[0]?.['tiers']).toEqual(['primitives', 'patterns']);
        expect(reconcileLedger(l, input(set)).ledger.briefs?.[0]).not.toHaveProperty('tiers');
    });
});

describe('reconcile — fidelity matrix', () => {
    it('matrix-rows: one row per reconciled component, the evidence kind named', () => {
        const rows = [
            { ...row('Button', 'in-sync', 'component') },
            { ...row('Hero', 'remote-only:twin', 'component'), disposition: 'import-as-brief' as const },
            row('Card', 'conflict', 'component'),
            { ...row('radius.md', 'in-sync') },
        ];
        const m = matrixRows(ledger(rows, { baselines: [{ path: 'tests/e2e/Button.spec.ts-snapshots/button.png', projection_commit: 'abc1234' }] }));
        expect(m.map((r) => [r.chapter, r.evidence])).toEqual([
            ['Button', 'element-screenshot'],
            ['Hero', 'not-implemented'],
        ]);
        expect(m[1]?.status).toMatch(/no baseline recorded/);
    });
});
