// Phase 4 of road-to-runtime-event-journal: the tier contract describes
// surfaces that already exist and creates none.
//
// The contract's own claims are the assertions here, because "names an existing
// file" and "adds no new storage path" are exactly the two properties that rot
// silently — a tier row pointing at a moved file still reads correctly, and a
// contract that quietly acquires a storage path reads like the one that did not.

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const CONTRACT = join(REPO_ROOT, 'docs', 'contracts', 'runtime-persistence-tiers.md');
const text = readFileSync(CONTRACT, 'utf-8');

/** Every backticked path in the tier table that looks like a repo file. */
function tierTableRows(): { tier: string; cells: string }[] {
    const rows: { tier: string; cells: string }[] = [];
    for (const line of text.split('\n')) {
        const m = line.match(/^\|\s*\*\*(T[0-3])\*\*\s*\|(.*)\|\s*$/);
        if (m) rows.push({ tier: m[1] as string, cells: m[2] as string });
    }
    return rows;
}

describe('runtime persistence tiers — 4.1 named over what exists', () => {
    it('the table declares exactly the four tiers T0..T3', () => {
        expect(tierTableRows().map((r) => r.tier)).toEqual(['T0', 'T1', 'T2', 'T3']);
    });

    it('every tier row names at least one file that exists in this repository', () => {
        const missing: string[] = [];
        for (const row of tierTableRows()) {
            const paths = [...row.cells.matchAll(/`([^`]+)`/g)]
                .map((m) => m[1] as string)
                .filter((p) => /^(src|docs|tests|internal)\//.test(p) && /\.[a-z]+$/.test(p));
            if (paths.length === 0) { missing.push(`${row.tier}: names no repo file at all`); continue; }
            const present = paths.filter((p) => existsSync(join(REPO_ROOT, p)));
            if (present.length === 0) missing.push(`${row.tier}: none of ${paths.join(', ')} exists`);
        }
        expect(missing, missing.join('\n')).toEqual([]);
    });

    it('T3 names its ADR rather than a storage path — a tier nothing writes into has no path to name', () => {
        const t3 = tierTableRows().find((r) => r.tier === 'T3');
        expect(t3, 'no T3 row').toBeDefined();
        expect((t3 as { cells: string }).cells).toMatch(/does not exist/i);
        expect((t3 as { cells: string }).cells).toMatch(/ADR-124/);
    });

    it('the contract states it creates no store, directory or package', () => {
        expect(text).toMatch(/creates no store/i);
        expect(text).toMatch(/THIS CONTRACT CREATES NONE/);
    });
});

describe('runtime persistence tiers — 4.2 promotion is supervised', () => {
    it('names all five stages in order', () => {
        const stages = ['observe', 'candidate', 'evidence', 'review', 'promote'];
        let cursor = -1;
        for (const s of stages) {
            const at = text.indexOf(`**${s}**`);
            expect(at, `stage '${s}' missing or out of order`).toBeGreaterThan(cursor);
            cursor = at;
        }
    });

    it('states that no step promotes on a threshold alone', () => {
        expect(text).toMatch(/No step promotes on a threshold alone/i);
    });

    it('names ADR-094 as closed and untouched', () => {
        expect(text).toMatch(/ADR-094/);
        expect(text).toMatch(/ADR-094 stays closed/i);
        expect(existsSync(join(REPO_ROOT, 'docs/decisions/ADR-094-agent-memory-layer-removal.md'))).toBe(true);
    });

    it('states that no code in this repository writes into a T3 path', () => {
        expect(text).toMatch(/No code in this repository writes into a T3 path/i);
    });
});

describe('runtime persistence tiers — 4.3 degradation is reported, never silent', () => {
    it('reuses the shipped three-state freshness verdict rather than inventing one', () => {
        expect(text).toMatch(/ABSENT \| STALE \| FRESH/);
        // and the source of that vocabulary is real
        expect(existsSync(join(REPO_ROOT, 'src/scripts/code_graph/detect.ts'))).toBe(true);
    });

    it('forbids reading an absent record as an empty success', () => {
        expect(text).toMatch(/never an empty success/i);
        expect(text).toMatch(/AN ABSENT RECORD AND A RECORD CONTAINING NO MATCH ARE NOT THE SAME ANSWER/);
    });

    it('carries the binding line on transitive certainty', () => {
        expect(text).toMatch(/no claim requiring transitive certainty/i);
        // The worked example is the load-bearing half: it is what stops the line
        // from being read as a slogan.
        expect(text).toMatch(/Nothing calls this function/i);
    });
});
