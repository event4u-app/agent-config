// Every routing floor traces to a row of the frozen 0.2 baseline
// (`road-to-routing-assurance-live-floors` 0.4, AC-2). The floors file is a
// derivation, so it is re-derived here and compared, rather than trusted.

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { deriveFloors, type UnitRow } from '../../src/scripts/_lib/routing_baseline.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FLOORS = path.join(REPO, 'docs', 'contracts', 'routing-assurance-floors.json');

interface FloorsFile {
    baseline: string;
    baseline_sha256: string;
    tolerance: number;
    floors: { unit: string; baseline_recall: number; floor: number }[];
}

const floors = JSON.parse(fs.readFileSync(FLOORS, 'utf8')) as FloorsFile;
const baselineText = fs.readFileSync(path.join(REPO, floors.baseline), 'utf8');
const baseline = JSON.parse(baselineText) as { units: UnitRow[]; protocol: { path: string; sha256: string } };

describe('routing floors — derived, never invented', () => {
    it('uses the tolerance the contract registered before any baseline existed', () => {
        expect(floors.tolerance).toBe(0.1);
        expect(fs.readFileSync(path.join(REPO, 'docs', 'contracts', 'routing-assurance-metrics.md'), 'utf8')).toContain(
            'Tolerance, fixed now: 0.10 absolute recall.',
        );
    });

    it('names the exact baseline it was derived from', () => {
        expect(createHash('sha256').update(baselineText).digest('hex')).toBe(floors.baseline_sha256);
    });

    it('the baseline names the protocol file it ran under, byte for byte', () => {
        const protocol = fs.readFileSync(path.join(REPO, baseline.protocol.path), 'utf8');
        expect(createHash('sha256').update(protocol).digest('hex')).toBe(baseline.protocol.sha256);
    });

    it('every floor traces to a baseline row and equals the registered rule applied to it', () => {
        const rows = new Map(baseline.units.map((u) => [u.unit, u]));
        for (const f of floors.floors) expect(rows.has(f.unit)).toBe(true);
        expect(floors.floors).toEqual(deriveFloors(baseline.units, floors.tolerance));
    });
});
