/**
 * The four adversarial fixtures in
 * `tests/fixtures/database-advice/folklore-adversarial.md` exist so a corrected
 * passage can be checked against the case the folklore answer gets wrong.
 *
 * **What this test is, stated honestly.** It is a TEXT check on advice this
 * package ships, not an engine measurement. It asserts that each corrected
 * passage carries the vocabulary that decides its case, and that the folklore
 * formulations are gone. It cannot verify that the advice is true of any
 * particular engine — five of the campaign's engine-behaviour halves were
 * recorded as unverifiable offline, and no passage here asserts one.
 *
 * That is a real limit and the reason the fixtures name BOTH answers: a reader
 * checking this work re-reads the four cases and judges the advice, and the
 * test's job is only to stop the corrected text from silently regressing to the
 * folklore wording it replaced.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(REPO, rel), 'utf-8');

const GUIDELINE = 'docs/guidelines/php/database.md';
const MIGRATION = 'src/skills/laravel-migration/SKILL.md';
const SQL_WRITING = 'src/skills/sql-writing/SKILL.md';
const DATABASE_SKILL = 'src/skills/database/SKILL.md';
const FIXTURES = 'tests/fixtures/database-advice/folklore-adversarial.md';

describe('the adversarial fixture file', () => {
    it('carries four cases, each naming both the folklore and the correct answer', () => {
        const f = read(FIXTURES);
        const cases = f.match(/^## Case \d+ —/gm) ?? [];
        expect(cases).toHaveLength(4);
        expect((f.match(/\*\*Folklore answer:\*\*/g) ?? []).length).toBe(4);
        expect((f.match(/\*\*Correct answer:\*\*/g) ?? []).length).toBe(4);
    });
});

describe('the folklore formulations are gone from the shipped guideline', () => {
    it.each([
        ['most selective column first', GUIDELINE],
        ['needs index', GUIDELINE],
        ['Rewrite as JOIN', GUIDELINE],
        ['proper `onDelete()`', GUIDELINE],
        ['Always include a reversible', MIGRATION],
        ['Use MariaDB syntax', SQL_WRITING],
    ])('%s no longer appears in %s', (needle, file) => {
        expect(read(file)).not.toContain(needle);
    });
});

describe('each corrected passage carries the vocabulary that decides its case', () => {
    it('case 1 — equality before range, selectivity as a tie-break', () => {
        const g = read(GUIDELINE);
        expect(g).toMatch(/equality/i);
        expect(g).toMatch(/range/i);
        // The specific claim the folklore rule got wrong, not just the words.
        expect(g).toMatch(/after the first range predicate/i);
        expect(g).toMatch(/tie-break/i);
    });

    it('case 2 — a full scan can be the correct plan, judged against table size', () => {
        const g = read(GUIDELINE);
        expect(g).toMatch(/full table scan is often the correct\s+plan/i);
        expect(g).toMatch(/rows.*estimate.*against the table/is);
    });

    it('case 3 — correlated rewrites, uncorrelated stays', () => {
        const g = read(GUIDELINE);
        expect(g).toMatch(/correlated/i);
        expect(g).toMatch(/semi-join/i);
        expect(g).toMatch(/driving set/i);
    });

    it('case 4 — three categories kept apart, and "small AND rarely accessed"', () => {
        const g = read(GUIDELINE);
        expect(g).toMatch(/rarely accessed/i);
        expect(g).toMatch(/regardless of table size/i);
        // The three-way split the deciding council asked for explicitly.
        expect(g).toMatch(/integrity constraint/i);
        expect(g).toMatch(/referencing column/i);
        expect(g).toMatch(/optional query-performance index/i);
    });
});

describe('the decisions the council settled are stated where a reader meets them', () => {
    it('the recovery contract is two branches, and the roll-forward branch is auditable', () => {
        const m = read(MIGRATION);
        expect(m).toMatch(/recovery contract/i);
        expect(m).toMatch(/roll-forward/i);
        // The escape-hatch guard: in-file, evidenced, ordered, owned.
        expect(m).toMatch(/in the migration file itself/i);
        expect(m).toMatch(/why restoration is impossible/i);
        expect(m).toMatch(/responsible recovery owner/i);
        // And the same obligation on the other surface, not a different one.
        expect(read(GUIDELINE)).toMatch(/Silence is the violation, not\s+the absence of `down\(\)`/);
    });

    it('referential action is a three-branch decision, not a template default', () => {
        const m = read(MIGRATION);
        expect(m).toMatch(/Referential action is a decision/);
        for (const action of ['cascade', 'restrict', 'set null']) {
            expect(m.toLowerCase()).toContain(action);
        }
        expect(read(GUIDELINE)).toMatch(/\*\*choose\*\* the `onDelete\(\)` action/);
    });

    it('both DB skills state the shared-query / never-shared-migration principle', () => {
        for (const f of [DATABASE_SKILL, SQL_WRITING]) {
            expect(read(f), f).toMatch(/share a query-syntax world/i);
            expect(read(f), f).toMatch(/never share a migration/i);
        }
    });

    it('sql-writing reads the engine before choosing syntax, and names the unknown case', () => {
        const s = read(SQL_WRITING);
        expect(s).toMatch(/Read the engine, then choose the syntax/i);
        expect(s).toMatch(/do not assume one/i);
    });
});
