import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { recordProblems, type InjectionRecord } from '../../src/scripts/_lib/injection_effect.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

type Row = { host?: string; state?: string; expiry?: string };

function load(): Record<string, Row> {
    return JSON.parse(
        readFileSync(path.join(REPO_ROOT, 'src', 'config', 'skill-lifecycle-probes-codex.json'), 'utf8'),
    ) as Record<string, Row>;
}

describe('skill-lifecycle-probes-codex.json (road-to-skills-that-arrive-when-called 0.3)', () => {
    it('has one valid row per probe item, each for codex with an expiry', () => {
        const rec = load();
        const rows = Object.entries(rec).filter(([k]) => !k.startsWith('_'));
        expect(rows.map(([k]) => k)).toEqual([
            'live-pickup-agents-skills',
            'omission-order-and-warning',
            'implicit-disabled-counts-against-budget',
            'double-listing',
            // Added 2026-10-20 by 5.2's arm S3: what a policy-disabled skill
            // loses. 0.3 measured that disabling frees the budget; it did not
            // ask what the model can still reach, and 4.1 shipped on the
            // generous reading until this row was taken.
            'unlisted-skill-not-in-model-list',
            // Added 2026-10-20 for remedy (a) of the blocker that row raised:
            // the same skill, reached through the installer-written finder.
            'unlisted-skill-reached-through-finder',
        ]);
        for (const [, row] of rows) {
            expect(row.host).toBe('codex');
            expect(row.expiry).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
        expect(recordProblems(rec as unknown as InjectionRecord)).toEqual([]);
    });
});
