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

    // Rewritten 2026-08-28. These assertions used to pin `/does not exist/i`
    // and `/ADR-124/` — i.e. they pinned a SUPERSEDED lock. ADR-249 (accepted
    // 2026-08-27, `supersedes: ADR-124, ADR-109`) reversed ADR-124's Class-B
    // row, so a T3 row justified by "Class B is prohibited in core" cites a
    // provision that no longer stands. The tier itself did not move: it is a
    // STORE tier, and the store is still prohibited by the P3 row of
    // resident-process-governance. The tests below pin that, and pin the
    // OVERCORRECTION shut as well.
    it('T3 names its governing contract rather than a storage path — a tier nothing writes into has no path to name', () => {
        const t3 = tierTableRows().find((r) => r.tier === 'T3');
        expect(t3, 'no T3 row').toBeDefined();
        const cells = (t3 as { cells: string }).cells;
        // The live anchor, not the superseded one.
        expect(cells).toMatch(/resident-process-governance\.md/);
        expect(cells).toMatch(/ADR-249/);
        // Still closed, and said so.
        expect(cells).toMatch(/prohibited/i);
        expect(cells).toMatch(/P3/);
    });

    it('T3 does NOT justify itself on the superseded Class-B prohibition', () => {
        const cells = (tierTableRows().find((r) => r.tier === 'T3') as { cells: string }).cells;
        // ADR-124 may be cited elsewhere in the document (its Class-A path and
        // its section-6 state-store test both stand); what the ROW may not do
        // is rest on the row ADR-249 superseded.
        expect(cells).not.toMatch(/Class B is prohibited/i);
        expect(cells).not.toMatch(/does not exist/i);
    });

    it('T3 does not OVERcorrect into "a resident store is now permitted"', () => {
        // The failure in the other direction: ADR-249 permits a supervised
        // PROCESS (P1), never the aggregated cross-session STORE (P3). A row
        // that read the reversal as opening T3 would be as wrong as the row it
        // replaced, and would be wrong in the more expensive direction.
        const cells = (tierTableRows().find((r) => r.tier === 'T3') as { cells: string }).cells;
        expect(cells).toMatch(/not built/i);
        expect(text).toMatch(/P1 does not weaken P3|the aggregated store it would own is not/i);
    });

    it('the correction is recorded in the document, not applied silently', () => {
        // The wrong row shipped in a commit that is already on the branch, so
        // the contract states what changed rather than reading as if it had
        // always been right.
        expect(text).toMatch(/Corrected 2026-08-28/);
        expect(text).toMatch(/superseded lock/i);
    });

    it('both files the corrected T3 row cites actually exist', () => {
        for (const rel of [
            'docs/contracts/resident-process-governance.md',
            'docs/decisions/ADR-249-supervised-resident-process-permitted-under-governance.md',
        ]) {
            expect(existsSync(join(REPO_ROOT, rel)), `${rel} is cited but missing`).toBe(true);
        }
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

    it('prices opening T3 on the live gate — reopening P3 — not on ADR-124 alone', () => {
        expect(text).toMatch(/reopens the \*\*P3\*\* prohibition|decision that reopens P3/);
        expect(text).toMatch(/four governance conditions/i);
        // ADR-124 section 5 is NOT superseded and is still part of the price;
        // what changed is that it is no longer the whole of it.
        expect(text).toMatch(/measured Class-A failure/);
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
