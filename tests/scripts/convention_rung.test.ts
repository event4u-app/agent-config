// road-to-a-noted-that-is-a-write 2.3 — a 30-sentence DE/EN corpus for the
// carrier-rung classifier. The failing direction is a rung that is too STRONG:
// that one becomes a config edit or a check nobody asked for.
import { describe, expect, it } from 'vitest';

import { type ConventionRung, conventionRung } from '../../src/scripts/_lib/convention_rung.js';

const STRENGTH: Record<ConventionRung, number> = { prose: 0, check: 1, config: 2 };

const CORPUS: ReadonlyArray<readonly [string, ConventionRung]> = [
    // config — a formatter or .editorconfig carries it
    ['Use tabs, not spaces.', 'config'],
    ['Benutze Tabs statt Leerzeichen.', 'config'],
    ['Indent with 4 spaces.', 'config'],
    ['Einrückung immer mit 2 Leerzeichen.', 'config'],
    ['Always use single quotes in TypeScript.', 'config'],
    ['Nimm doppelte Anführungszeichen.', 'config'],
    ['Line length is at most 120 characters.', 'config'],
    ['Keine Zeilen länger als 100 Zeichen.', 'config'],
    ['Files end with a final newline.', 'config'],
    ['Use LF line endings everywhere.', 'config'],
    ['Keine Semikolons am Zeilenende.', 'config'],
    // check — a linter, a test or a hook can fail on it
    ['Never commit console.log statements.', 'check'],
    ['Kein var_dump im Code lassen.', 'check'],
    ['No default exports in this repo.', 'check'],
    ['Keine Emojis in Commits.', 'check'],
    ['Functions must be no longer than 40 lines.', 'check'],
    ['Methoden höchstens 5 Parameter.', 'check'],
    ['Commit messages follow the conventional commits format.', 'check'],
    ['Imports must be sorted alphabetically.', 'check'],
    ['Every PHP file declares declare(strict_types=1).', 'check'],
    // prose — only an instruction file can carry it
    ['Keep functions short and readable.', 'prose'],
    ['Halte Funktionen kurz.', 'prose'],
    ['Prefer single quotes where possible.', 'prose'],
    ['Möglichst Tabs verwenden.', 'prose'],
    ['Ask before you deploy anything.', 'prose'],
    ['Schreib verständliche Commit-Nachrichten.', 'prose'],
    ['Prefer composition over inheritance.', 'prose'],
    ['Antworte mir immer auf Deutsch.', 'prose'],
    ['Be concise in pull request descriptions.', 'prose'],
    ['Erkläre Entscheidungen im PR-Text.', 'prose'],
];

describe('conventionRung', () => {
    it('carries exactly 30 sentences, both languages, every rung', () => {
        expect(CORPUS).toHaveLength(30);
        for (const r of ['config', 'check', 'prose'] as const) {
            expect(CORPUS.some(([, want]) => want === r)).toBe(true);
        }
    });

    it.each(CORPUS)('never puts a convention on too strong a rung: %s', (sentence, want) => {
        expect(STRENGTH[conventionRung(sentence)]).toBeLessThanOrEqual(STRENGTH[want]);
    });

    it.each(CORPUS)('classifies %s', (sentence, want) => {
        expect(conventionRung(sentence)).toBe(want);
    });

    it('treats empty and unclassifiable input as prose', () => {
        expect(conventionRung('')).toBe('prose');
        expect(conventionRung('Lorem ipsum dolor.')).toBe('prose');
    });
});
