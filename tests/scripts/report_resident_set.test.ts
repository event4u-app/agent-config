// `road-to-a-resident-set-chosen-on-purpose` step 1.2 — the resident-set report.
// Fixture expectations are derived from the fixture constants, never copied
// from a live run. The repo-tree case pins the one property the report exists
// to keep honest: its alphabetical arm IS what the installer writes today.
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { computeOverrides } from '../../src/scripts/_lib/skill_listing_overrides.js';
import { buildResidentSetReport, main, repoReport, WINDOWS } from '../../src/scripts/report_resident_set.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

describe('buildResidentSetReport — fixture', () => {
    // Budget at 200k is 8,000 chars; at 1M it is 40,000. Each entry costs 3,000,
    // so two fit at 200k and all five at 1M.
    const catalogue = ['alpha', 'bravo', 'charlie', 'delta', 'zulu'].map((name) => ({ name, descriptionChars: 3_000 }));
    const routesTo = new Map([['zulu', 2], ['delta', 1]]);
    const report = buildResidentSetReport(catalogue, { routesTo, packMembers: new Set(['charlie']) }, { perEntryCapChars: 100_000 });

    it('reports both windows', () => {
        expect(report.windows.map((w) => w.contextWindowTokens)).toEqual([...WINDOWS]);
    });

    it('splits alphabetically and by priority at 200k', () => {
        const w = report.windows[0]!;
        expect(w.alphabetical.described).toEqual(['alpha', 'bravo']);
        expect(w.priority.described).toEqual(['zulu', 'delta']);
        expect(w.alphabetical.bare).toHaveLength(3);
        expect(w.priority.bare).toEqual(['charlie', 'alpha', 'bravo']);
    });

    it('describes everything at 1M under both orders', () => {
        const w = report.windows[1]!;
        expect(w.alphabetical.bare).toEqual([]);
        expect(w.priority.bare).toEqual([]);
    });

    it('states the status of every routes_to target per window and arm', () => {
        expect(report.routed.map((r) => r.name)).toEqual(['zulu', 'delta']);
        const zulu = report.routed[0]!;
        expect(zulu.rules).toBe(2);
        expect(zulu.status).toEqual([
            { contextWindowTokens: 200_000, alphabetical: 'name-only', priority: 'described' },
            { contextWindowTokens: 1_000_000, alphabetical: 'described', priority: 'described' },
        ]);
    });

    it('lists a routes_to target that is not in the catalogue as missing, not as described', () => {
        const r = buildResidentSetReport(catalogue, { routesTo: new Map([['ghost', 1]]), packMembers: new Set() });
        expect(r.routed).toEqual([{ name: 'ghost', rules: 1, status: 'not-in-catalogue' }]);
    });
});

describe('report_resident_set — repo tree', () => {
    const report = repoReport(REPO_ROOT);

    it('its alphabetical arm at 200k matches what computeOverrides writes', () => {
        const owned = report.catalogue.map((e) => e.name);
        const installed = computeOverrides(path.join(REPO_ROOT, 'src', 'skills'), owned);
        const w = report.windows[0]!;
        expect(w.contextWindowTokens).toBe(200_000);
        expect([...w.alphabetical.bare].sort()).toEqual(Object.keys(installed).sort());
        expect(w.alphabetical.described.length + w.alphabetical.bare.length).toBe(owned.length);
    });

    it('exits 0 in both output modes', () => {
        const write = process.stdout.write;
        process.stdout.write = (() => true) as typeof process.stdout.write;
        try {
            expect(main([])).toBe(0);
            expect(main(['--json'])).toBe(0);
        } finally {
            process.stdout.write = write;
        }
    });
});
