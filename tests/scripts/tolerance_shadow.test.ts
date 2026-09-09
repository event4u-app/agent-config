/**
 * Tolerance shadow records — the three clauses of 4.2's verify.
 *
 * Records exist · they carry no self-reported verdict · the flip criterion was
 * written before the window opened. The middle one is the load-bearing test and
 * the easiest to lose to a later "helpful" field, so it is asserted
 * structurally over the record's own keys rather than by inspection.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import { SHADOW_LOG } from '../../src/scripts/hooks/source_first_gate_hook.js';
import { SHIPPED_TOLERANCE, reconcileValue } from '../../src/scripts/_lib/design_tolerance.js';
import { buildConformanceReport } from '../../src/scripts/_lib/conformance_report.js';
import {
    CANDIDATE_COLOR_THRESHOLDS,
    CANDIDATE_LENGTH_THRESHOLDS,
    FLIP_CRITERION,
    TOLERANCE_SHADOW_RECORD,
    candidatesFor,
    recordToleranceShadow,
    toleranceShadowRecord,
} from '../../src/scripts/_lib/tolerance_shadow.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const tmps: string[] = [];

afterAll(() => {
    for (const d of tmps) fs.rmSync(d, { recursive: true, force: true });
});

const PALETTE = [
    { name: 'color.brand', value: '#3b82f7' },
    { name: 'color.ink', value: '#111827' },
];
const SPACING = [{ name: 'space.4', value: '16px' }];

function colorRecord() {
    return toleranceShadowRecord('color', reconcileValue('color', '#3b82f6', PALETTE));
}

describe('records exist and carry a measurement', () => {
    it('builds a record from a reconciled row', () => {
        const r = colorRecord();
        expect(r).not.toBeNull();
        expect(r?.record).toBe(TOLERANCE_SHADOW_RECORD);
        expect(r?.distance).toBeGreaterThan(0);
        expect(r?.nearest_token).toBe('color.brand');
    });

    // A row with nothing to compare against is NOT recorded as a distance of
    // zero or of infinity. Folding non-observations into the window would
    // report a distribution over a population that includes them.
    it('returns null rather than a fake distance when there is no candidate', () => {
        expect(toleranceShadowRecord('color', reconcileValue('color', '#3b82f6', []))).toBeNull();
    });

    it('records the counterfactual outcome at every candidate threshold', () => {
        const r = colorRecord();
        expect(r?.counterfactual.map((c) => c.threshold)).toEqual([...CANDIDATE_COLOR_THRESHOLDS]);
        // The distance is small, so the loosest candidate reconciles and the
        // tightest does not — the record yields a curve, not a yes/no.
        expect(r?.counterfactual.at(-1)?.would_reconcile).toBe(true);
        expect(r?.counterfactual.at(0)?.would_reconcile).toBe(false);
    });

    it('uses the right candidate spread per axis', () => {
        expect(candidatesFor('color')).toEqual(CANDIDATE_COLOR_THRESHOLDS);
        expect(candidatesFor('length')).toEqual(CANDIDATE_LENGTH_THRESHOLDS);
        const lr = toleranceShadowRecord('length', reconcileValue('length', '15px', SPACING));
        expect(lr?.counterfactual.map((c) => c.threshold)).toEqual([...CANDIDATE_LENGTH_THRESHOLDS]);
    });

    // Throughout the window the mechanism is off, so `acted` is false on every
    // record. A window in which the thing being measured is already acting
    // measures its own effect.
    it('records that the mechanism did not act, under the shipped config', () => {
        const row = reconcileValue('color', '#3b82f6', PALETTE, SHIPPED_TOLERANCE);
        expect(toleranceShadowRecord('color', row)?.acted).toBe(false);
    });
});

describe('no self-reported verdict', () => {
    // Structural, not by inspection: a later field named `was_correct` or
    // `verdict` would slip past a hand-written assertion about today's shape.
    it('the record carries no correctness, quality or verdict field', () => {
        const r = colorRecord();
        expect(r).not.toBeNull();
        const keys = Object.keys(r as object);
        expect(keys).toEqual([
            'record',
            'kind',
            'metric',
            'distance',
            'nearest_token',
            'acted',
            'counterfactual',
        ]);
        for (const key of keys) {
            expect(key).not.toMatch(/correct|verdict|good|bad|quality|score|rating|ok\b/i);
        }
    });

    it('a counterfactual entry says what WOULD happen, never whether it is right', () => {
        const entry = colorRecord()?.counterfactual[0];
        expect(Object.keys(entry as object)).toEqual(['threshold', 'would_reconcile']);
    });
});

describe('the flip criterion was written before the window opened', () => {
    it('is a committed constant, not something the code computes', () => {
        expect(FLIP_CRITERION.length).toBeGreaterThan(200);
        expect(FLIP_CRITERION).toMatch(/Reverse trigger/);
    });

    // Both error directions, named. A criterion that bounded only false
    // reconciliations is satisfied trivially by a threshold of zero.
    it('bounds false reconciliations AND requires the missed share reported', () => {
        expect(FLIP_CRITERION).toMatch(/FALSE-RECONCILIATION/);
        expect(FLIP_CRITERION).toMatch(/MISSED-reconciliation/);
    });

    it('keeps colour and length as separate distributions', () => {
        expect(FLIP_CRITERION).toMatch(/each axis|per axis|EACH axis/i);
    });

    // The one thing meeting the criterion must NOT buy.
    it('does not authorise a shipped default', () => {
        expect(FLIP_CRITERION).toMatch(/owner-reserved/);
        expect(FLIP_CRITERION).toMatch(/not a shipped default/);
    });
});

describe('the window is actually written — not merely described', () => {
    // The defect a blind review caught on this branch: the module documented
    // records riding SHADOW_LOG while having no writer and no caller, so
    // FLIP_CRITERION's reverse trigger ("fewer than 20 records in 8 weeks") was
    // satisfied by construction. A criterion that cannot fail measures nothing.
    function tmpRoot(): string {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-'));
        tmps.push(root);
        return root;
    }

    function logLines(root: string): string[] {
        const f = path.join(root, SHADOW_LOG);
        if (!fs.existsSync(f)) return [];
        return fs.readFileSync(f, 'utf-8').trim().split('\n').filter(Boolean);
    }

    it('recordToleranceShadow appends one line per measurable row', () => {
        const root = tmpRoot();
        const rows = [
            { kind: 'color' as const, row: reconcileValue('color', '#3b82f6', PALETTE) },
            { kind: 'length' as const, row: reconcileValue('length', '15px', SPACING) },
            // Nothing to measure — must be skipped, not written as a zero.
            { kind: 'color' as const, row: reconcileValue('color', '#3b82f6', []) },
        ];
        expect(recordToleranceShadow(root, rows)).toBe(2);
        const lines = logLines(root).map((l) => JSON.parse(l) as Record<string, unknown>);
        expect(lines).toHaveLength(2);
        expect(lines.every((l) => l['record'] === TOLERANCE_SHADOW_RECORD)).toBe(true);
    });

    it('the conformance reporter feeds the window when a root is given', () => {
        const root = tmpRoot();
        buildConformanceReport({
            artifact: '<style>.a{color:#3b82f6;padding:15px}</style>',
            implementation: '<style>.a{color:#3b82f6;padding:15px}</style>',
            tokens: [...PALETTE, ...SPACING],
            shadowRoot: root,
        });
        expect(logLines(root).length).toBeGreaterThan(0);
    });

    // Opt-in, so a test run or a reader inspecting a port does not pollute the
    // distribution with its own fixtures.
    it('writes nothing when no root is given', () => {
        const root = tmpRoot();
        buildConformanceReport({
            artifact: '<style>.a{color:#3b82f6}</style>',
            implementation: '<style>.a{color:#3b82f6}</style>',
            tokens: PALETTE,
        });
        expect(logLines(root)).toEqual([]);
    });
});

describe('no new concern was added', () => {
    // The step's constraint: the estate allows zero new hook concerns, so these
    // records ride the existing shadow gate's log rather than a new one.
    it('reuses the existing shadow log path', () => {
        expect(SHADOW_LOG).toBe(path.join('agents', 'runtime', 'state', 'source-first-gate.jsonl'));
    });

    it('registers no second shadow concern in the manifest', () => {
        const manifest = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'),
            'utf-8',
        );
        expect(manifest).not.toContain('tolerance-shadow:');
        expect(manifest).not.toContain('tolerance_shadow_hook');
    });
});
