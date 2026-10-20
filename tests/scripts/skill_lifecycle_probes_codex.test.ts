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
        ]);
        for (const [, row] of rows) {
            expect(row.host).toBe('codex');
            expect(row.expiry).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
        expect(recordProblems(rec as unknown as InjectionRecord)).toEqual([]);
    });
});
