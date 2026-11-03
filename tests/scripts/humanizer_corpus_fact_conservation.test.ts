// road-to-rewrites-that-keep-their-facts 1.1: characterization of the humanizer
// corpus. A rewrite may change how something is said, never what is true; most
// "after" fixtures nevertheless add numbers their "before" never held. This pins
// the count as a ratchet that may fall (a fixture repaired) but never rise (a
// fixture that gained a supplied number).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { diffFacts } from '../../src/scripts/_lib/fact_diff.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'ai-tells');

/** Ceiling: pairs whose after-file supplies a number absent from the before-file. */
const SUPPLIED_CEILING = 17;
/**
 * Ceiling: pairs where the fact witness reports an added literal fact. Scoped to
 * the literal kinds the witness had when this was pinned, so a witness that
 * learns a new class cannot raise a corpus ratchet.
 */
const WITNESS_ADDED_CEILING = 16;
const LITERAL_KINDS = new Set(['url', 'code', 'currency', 'date', 'number', 'name']);

const DIGITS = /(?<![\w.])\d+(?:[.,]\d+)*/g;
const UNIT_WORDS =
    /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|hundred|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)\s+(?:days?|weeks?|months?|years?|hours?|minutes?|people|engineers|customers|teams?|Tage?n?|Wochen?|Monate?n?|Jahre?n?|Stunden?|Minuten?|Kunden|Teams?|Leute|Personen)\b/gi;

interface Pair {
    id: string;
    before: string;
    after: string;
}

function loadPairs(): Pair[] {
    const pairs: Pair[] = [];
    for (const lang of ['en', 'de']) {
        const dir = path.join(ROOT, lang);
        for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.before.md')).sort()) {
            const base = f.replace('.before.md', '');
            pairs.push({
                id: `${lang}/${base}`,
                before: fs.readFileSync(path.join(dir, f), 'utf8'),
                after: fs.readFileSync(path.join(dir, `${base}.after.md`), 'utf8'),
            });
        }
    }
    return pairs;
}

/** A number token or a unit-bound number word the after-file has and the before-file lacks. */
function suppliedNumbers(before: string, after: string): string[] {
    const set = (s: string, re: RegExp) => new Set((s.match(re) ?? []).map((x) => x.toLowerCase()));
    const out: string[] = [];
    for (const re of [DIGITS, UNIT_WORDS]) {
        const b = set(before, re);
        for (const x of set(after, re)) if (!b.has(x)) out.push(x);
    }
    return out;
}

const supplied = (pairs: Pair[]) => pairs.filter((p) => suppliedNumbers(p.before, p.after).length > 0);
const witnessAdded = (pairs: Pair[]) =>
    pairs.filter((p) => diffFacts(p.before, p.after).added.some((f) => LITERAL_KINDS.has(f.kind)));

describe('humanizer corpus fact conservation (ratchet)', () => {
    const pairs = loadPairs();

    it('reads the full corpus', () => {
        expect(pairs.length).toBe(20);
    });

    it(`at most ${SUPPLIED_CEILING} pairs supply a number`, () => {
        expect(supplied(pairs).length).toBeLessThanOrEqual(SUPPLIED_CEILING);
    });

    it(`at most ${WITNESS_ADDED_CEILING} pairs carry a witness-added fact`, () => {
        expect(witnessAdded(pairs).length).toBeLessThanOrEqual(WITNESS_ADDED_CEILING);
    });

    it('the ratchet is sensitive: a supplied number in a clean pair raises the count', () => {
        const clean = pairs.find((p) => suppliedNumbers(p.before, p.after).length === 0);
        expect(clean).toBeDefined();
        const mutated = pairs.map((p) => (p === clean ? { ...p, after: `${p.after}\nIt took 37 days.` } : p));
        expect(supplied(mutated).length).toBe(supplied(pairs).length + 1);
        expect(witnessAdded(mutated).length).toBeGreaterThanOrEqual(witnessAdded(pairs).length);
    });
});
