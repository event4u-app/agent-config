import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { recordProblems, type InjectionRecord } from '../../src/scripts/_lib/injection_effect.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

type Row = { host?: string; state?: string; expiry?: string };

function load(): Record<string, Row> {
    return JSON.parse(
        readFileSync(path.join(REPO_ROOT, 'src', 'config', 'skill-lifecycle-probes.json'), 'utf8'),
    ) as Record<string, Row>;
}

describe('skill-lifecycle-probes.json (road-to-skills-that-arrive-when-called 0.2)', () => {
    it('has one valid row per probe item, each with a host and an expiry', () => {
        const rec = load();
        const rows = Object.entries(rec).filter(([k]) => !k.startsWith('_'));
        expect(rows.map(([k]) => k)).toEqual([
            'a-same-turn-pickup-symlink',
            'a-same-turn-pickup-copy',
            'b-removed-skill-second-session',
            'c-session-start-reload-flag',
            'd-context-large',
            'e-name-only-listing',
        ]);
        for (const [, row] of rows) {
            expect(row.host).toBe('claude');
            expect(row.expiry).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
        expect(recordProblems(rec as unknown as InjectionRecord)).toEqual([]);
    });

    it('the Phase 4 gate rows (a) symlink and (b) are observed-true', () => {
        const rec = load();
        expect(rec['a-same-turn-pickup-symlink']?.state).toBe('observed-true');
        expect(rec['b-removed-skill-second-session']?.state).toBe('observed-true');
    });
});
