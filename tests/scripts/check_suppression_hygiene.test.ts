/**
 * Suppression hygiene — inventory completeness and the per-entry contract.
 *
 * The two properties worth pinning are the ones a reviewer cannot check by
 * reading: that EVERY suppression-shaped file on disk is declared (an
 * allowlist nobody listed is an allowlist nobody ratchets), and that the
 * entry-key extraction agrees between the working copy and the base ref — a
 * keying mismatch would report every entry as both added and removed, which
 * reads as a catastrophic red for no reason and gets the gate switched off.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
    MIN_REASON_CHARS,
    SUPPRESSION_INVENTORY,
    discoverSuppressionFiles,
    entriesOfSpec,
    loadEntries,
} from '../../src/scripts/check_suppression_hygiene.js';

describe('the inventory covers the tree', () => {
    it('declares every suppression-shaped file that exists', () => {
        const declared = new Set(SUPPRESSION_INVENTORY.map((s) => s.file));
        const undeclared = discoverSuppressionFiles().filter((f) => !declared.has(f));
        expect(undeclared, `undeclared suppression files: ${undeclared.join(', ')}`).toEqual([]);
    });

    it('declares nothing that does not exist', () => {
        const discovered = new Set(discoverSuppressionFiles());
        // gate-violation-baselines.json is matched by the discovery pattern too,
        // so a declared-but-missing file would show up here as a mismatch.
        const missing = SUPPRESSION_INVENTORY.map((s) => s.file).filter((f) => !discovered.has(f));
        expect(missing, `declared but not discovered: ${missing.join(', ')}`).toEqual([]);
    });

    it('finds a non-trivial number of surfaces — a collapsed scan is not a pass', () => {
        expect(discoverSuppressionFiles().length).toBeGreaterThan(5);
    });
});

describe('entry keying is stable across the two read paths', () => {
    it('loadEntries and entriesOfSpec agree, key for key, on every declared file', () => {
        for (const spec of SUPPRESSION_INVENTORY) {
            const viaLoad = loadEntries(spec).map((e) => e.key);
            const raw: unknown = JSON.parse(readFileSync(spec.file, 'utf-8'));
            const viaSpec = entriesOfSpec(spec, raw);
            expect(viaSpec, `${spec.file}: working-copy and base-ref keying disagree`).toEqual(viaLoad);
        }
    });
});

describe('the live corpus satisfies the per-entry contract', () => {
    it('every object-tier entry carries an auditable reason', () => {
        const offenders: string[] = [];
        for (const spec of SUPPRESSION_INVENTORY) {
            if (spec.tier !== 'object') {
                continue;
            }
            for (const entry of loadEntries(spec)) {
                if (entry.reason.length < MIN_REASON_CHARS) {
                    offenders.push(`${spec.file} → ${entry.key}`);
                }
            }
        }
        expect(offenders, `entries without a usable reason: ${offenders.join(', ')}`).toEqual([]);
    });

    it('every declared spec names what its list is for', () => {
        for (const spec of SUPPRESSION_INVENTORY) {
            expect(spec.what.trim(), `${spec.file} has no purpose line`).not.toBe('');
        }
    });
});
