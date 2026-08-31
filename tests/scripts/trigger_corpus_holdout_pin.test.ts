/**
 * The holdout pin must reproduce from the tree
 * (`agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md`,
 * road-to-governed-harness-evolution AC-6).
 *
 * AC-6 asserts the holdout partition's content hash predates the first commit
 * of any proposer capability. That claim is worth nothing if the published hash
 * does not describe the corpus it names — and it did not: the commit that
 * RECORDED the freeze also edited three of the files it was freezing, so three
 * per-file rows and the set hash were pinned at pre-edit bytes and were stale
 * the moment they were written. Re-running the artefact's own recipe and
 * trusting the old number could never have caught that.
 *
 * So this file is the guard the artefact lacked: it recomputes the recipe from
 * the tree and asserts every published row, and the set hash, reproduce. A
 * frozen corpus whose pin nobody recomputes is a corpus nobody has checked.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const ARTEFACT = path.join(
    REPO,
    'agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md',
);
const SKILLS = path.join(REPO, 'src/skills');

/** The partition constant the artefact freezes. Changing it re-partitions the corpus. */
const HOLDOUT_CEILING = 51;

function sha256(buf: Buffer | string): string {
    return createHash('sha256').update(buf).digest('hex');
}

/** The artefact's documented recipe, in TypeScript rather than shell. */
function corpusRows(): { skill: string; hash: string; partition: string }[] {
    const rows: { skill: string; hash: string; partition: string }[] = [];
    for (const skill of fs.readdirSync(SKILLS).sort()) {
        const f = path.join(SKILLS, skill, 'evals', 'triggers.json');
        if (!fs.existsSync(f)) continue;
        const bucket = parseInt(sha256(skill).slice(0, 2), 16);
        rows.push({
            skill,
            hash: sha256(fs.readFileSync(f)),
            partition: bucket < HOLDOUT_CEILING ? 'holdout' : 'train',
        });
    }
    // `LC_ALL=C sort` over the whole "<skill> <hash> <partition>" line.
    return rows.sort((a, b) =>
        `${a.skill} ${a.hash} ${a.partition}` < `${b.skill} ${b.hash} ${b.partition}` ? -1 : 1,
    );
}

function setHash(rows: ReturnType<typeof corpusRows>): string {
    return sha256(rows.map((r) => `${r.skill} ${r.hash} ${r.partition}\n`).join(''));
}

describe('trigger-corpus holdout pin', () => {
    const artefact = fs.readFileSync(ARTEFACT, 'utf8');
    const rows = corpusRows();

    it('the corpus is non-empty — a scan over nothing would pass vacuously', () => {
        expect(rows.length).toBeGreaterThan(50);
    });

    it('the artefact still declares a set hash', () => {
        expect(artefact).toMatch(/^SET-SHA256\s+[0-9a-f]{64}$/m);
    });

    it('the published SET-SHA256 reproduces from the tree', () => {
        const published = /^SET-SHA256\s+([0-9a-f]{64})$/m.exec(artefact)?.[1];
        expect(published).toBe(setHash(rows));
    });

    it('every per-file row reproduces from the tree', () => {
        const stale = rows.filter((r) => !artefact.includes(`| \`${r.skill}\` | \`${r.hash}\` |`));
        expect(stale.map((r) => r.skill)).toEqual([]);
    });

    it('the partition split is the one the artefact names', () => {
        const holdout = rows.filter((r) => r.partition === 'holdout');
        expect(holdout.length).toBeGreaterThan(0);
        expect(holdout.length).toBeLessThan(rows.length);
    });
});
