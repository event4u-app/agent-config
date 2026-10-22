// The token class and the two stopword blocks behind it.
//
// This file exists for one defect and its two edges. The defect: the token
// class was `[a-z][a-z0-9]+`, so a letter outside ASCII ended a token, and a
// German content word was split at its first umlaut into pieces that the
// three-code-point floor then dropped. The first edge: widening it must not
// move ASCII, which the parity suite pins and which is re-asserted here so a
// reader of THIS file can see the claim. The second edge: the German stopword
// block must drop function words without touching the domain nouns a German
// prompt routes on — a block that swallowed `prüfung` would delete exactly the
// signal the widening recovers.
import { describe, expect, it } from 'vitest';

import {
    ENGLISH_STOPWORDS,
    GERMAN_STOPWORDS,
    STOPWORDS,
    tokenize,
} from '../../src/shared/skillRanking';

describe('skillRanking — token class', () => {
    it('keeps-non-ascii-letters inside one token instead of splitting on them', () => {
        // Each of these was reproduced on the ASCII class before the change:
        // `Prüfung` -> {fung}, `Größe` -> {} (both halves under the floor),
        // `Abhängigkeiten` -> {abh, ngigkeiten}.
        expect([...tokenize('Prüfung')]).toEqual(['prüfung']);
        expect([...tokenize('Größe')]).toEqual(['größe']);
        expect([...tokenize('Abhängigkeiten')]).toEqual(['abhängigkeiten']);

        // The failure is not "ranks badly" but "is not indexed", so the
        // assertion that matters is that the OLD fragments are gone.
        const t = tokenize('Abhängigkeiten der Prüfung');
        expect(t.has('abh')).toBe(false);
        expect(t.has('ngigkeiten')).toBe(false);
        expect(t.has('fung')).toBe(false);
    });

    it('is a widening: every ASCII case the parity scorer produced is unchanged', () => {
        expect([...tokenize('Resolve the MERGE conflict in Foo2')].sort()).toEqual([
            'conflict',
            'foo2',
            'merge',
            'resolve',
        ]);
        expect([...tokenize('go to db ci abc')]).toEqual(['abc']);
        expect([...tokenize('merge-conflicts')].sort()).toEqual(['conflicts', 'merge']);
    });

    it('still needs a letter first, and still drops tokens of two code points', () => {
        // A digit-initial run is not a token in either class.
        expect([...tokenize('2fa and 42 and ß9x')]).toEqual(['ß9x']);
        // Two code points, non-ASCII: under the floor exactly as `db` is.
        expect([...tokenize('öl')]).toEqual([]);
    });

    it('splits on punctuation and whitespace, never inside a word', () => {
        expect([...tokenize('Grüße, Größe; Straße!')].sort()).toEqual([
            'größe',
            'grüße',
            'straße',
        ]);
    });
});

describe('skillRanking — stopword blocks', () => {
    it('drops German function words that now survive tokenization', () => {
        // Before the widening most of these could not be produced as one token
        // at all, so the English-only list was never wrong — it was unreachable.
        const t = tokenize('Bitte prüfe die Abhängigkeiten für das neue Modul');
        expect(t.has('die')).toBe(false);
        expect(t.has('für')).toBe(false);
        expect(t.has('das')).toBe(false);
        expect(t.has('bitte')).toBe(false);
        // …and keeps the words the prompt actually routes on.
        expect(t.has('abhängigkeiten')).toBe(true);
        expect(t.has('modul')).toBe(true);
    });

    it('the German block stops none of five English routing content words', () => {
        // A spot check, not a catalogue-wide proof. The author's own reading of
        // the shipped `name + description` before the block was added (not
        // recorded as an artifact) was that its hits are German trigger phrases
        // written into English descriptions, plus `also` and `will`, which are
        // function words in English too.
        //
        // The assertion is the narrow invariant behind that reading: the two
        // blocks may overlap, but a German entry must never be the only thing
        // standing between a prompt and an English content word that carries
        // routing signal. `request` and `review` are two such words.
        // The English half of a German homograph is one: `mit` (the licence),
        // `bin` and `dir` (paths), `man` (pages), `war` and `des` (formats).
        for (const contentWord of ['request', 'review', 'merge', 'deploy', 'render', 'mit', 'bin', 'dir', 'man', 'war', 'des']) {
            expect(STOPWORDS.has(contentWord)).toBe(false);
        }
    });

    it('keeps German DOMAIN nouns — the block is function words, not a translation', () => {
        // Mirroring the English block's `file` / `code` / `task` entries into
        // German would delete the signal the token class was widened to recover.
        for (const noun of ['fehler', 'datei', 'dateien', 'prüfung', 'aufgabe', 'test']) {
            expect(GERMAN_STOPWORDS.has(noun)).toBe(false);
        }
    });

    it('the union is exactly the two blocks and the English one is unchanged', () => {
        expect(STOPWORDS.size).toBe(
            new Set([...ENGLISH_STOPWORDS, ...GERMAN_STOPWORDS]).size,
        );
        for (const w of ENGLISH_STOPWORDS) expect(STOPWORDS.has(w)).toBe(true);
        for (const w of GERMAN_STOPWORDS) expect(STOPWORDS.has(w)).toBe(true);
        // The English block is the parity scorer's list, verbatim, and 69 is
        // its MEASURED distinct size (the literal spells a few words twice).
        // The pin is a tripwire: that block is what the CLI parity suite
        // compares against, so an edit to it should be deliberate enough to
        // re-measure this number.
        expect(ENGLISH_STOPWORDS.size).toBe(69);
        expect(ENGLISH_STOPWORDS.has('für')).toBe(false);
    });
});
