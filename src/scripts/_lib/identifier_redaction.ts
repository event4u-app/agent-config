/**
 * Class-tag redaction of identifiers for stores that keep text (knowledge
 * ingestion, cross-repo retrieval).
 *
 * Detection is the rule table's identifier rows, read recall-first: a store
 * that persists text has no reviewer after it, so a missed value is the costly
 * error and a context word is not required here. The rows' checksums still
 * hold — a number that fails Luhn is not a card, a string that fails mod-97 is
 * not an IBAN. The tag spelling and the counter keys are this consumer's.
 *
 * Without the context word a digit row must stand on its own shape, so the store
 * tightens four rows where tree text measured false positives (PREREG (b), store
 * reading): phone and card digits may not touch a letter on either side (a
 * digit-led hex SHA is not a card) nor follow a decimal point, and a national
 * number may not continue a `-` or `/` list (`ADR-046/047`); a leading `+` at a line start — a diff's added
 * line — needs a grouped number (`+49 30 …`), a dotted quad is never a phone, and
 * a North-American number keeps its context word unless it is written formatted,
 * because a bare ten-digit integer (`2147483647`) has the same digits.
 */
import { detect, type EgressRule, IDENTIFIER_RULES, replaceSpans } from './egress_rules.js';

/** Store patterns for the rows the shape alone cannot carry; the rest are the table's own. */
const STORE_PATTERN: Readonly<Record<string, RegExp>> = {
    'payment-card': /(?<![0-9A-Za-z.])[0-9](?:[ -]?[0-9]){12,18}(?![0-9A-Za-z])/g,
    'phone-international':
        /(?<![A-Za-z0-9+])(?:(?<!^|\n)|(?=\+[1-9][0-9]{0,2}[ (]))\+[1-9][0-9]{0,2}(?:[ ./-]?(?:\([0-9]{1,6}\)|(?=([0-9]{1,6}))\1)){1,5}(?![0-9A-Za-z])/g,
    'phone-national': /(?<![A-Za-z0-9+(./-])(?:\(0[1-9][0-9]{1,4}\)|0[1-9][0-9]{1,4})(?:[ ./-]?(?=([0-9]{2,8}))\1){1,3}(?![0-9A-Za-z])/g,
};

const DOTTED_QUAD = /^\+?[0-9]{1,3}(?:\.[0-9]{1,3}){3}$/;

/** A North-American number that is written as one: two separators, or a bracketed area code. */
function isFormattedNanp(value: string): boolean {
    return value.includes('(') || (value.match(/[ .-]/g) ?? []).length >= 2;
}

function storeRow(row: EgressRule): EgressRule[] {
    const { context: _context, ...rest } = row;
    if (row.rule === 'phone-nanp') {
        // Two rows: the table's own with its context word, and a formatted shape without one.
        return [row, { ...rest, rule: 'phone-nanp-formatted', validator: isFormattedNanp }];
    }
    const pattern = STORE_PATTERN[row.rule];
    if (!pattern) return [rest];
    if (row.rule === 'phone-international') return [{ ...rest, pattern, exclusions: [...(rest.exclusions ?? []), DOTTED_QUAD] }];
    return [{ ...rest, pattern }];
}

/** The identifier rows as the stores read them: context dropped, except where shape alone is not evidence. */
export const STORAGE_IDENTIFIER_RULES: readonly EgressRule[] = IDENTIFIER_RULES.flatMap(storeRow);

/** Counter key and tag per placeholder type; `CC` predates the table's `CARD`. */
const TAG: Readonly<Record<string, string>> = { CARD: 'CC' };

export function redactIdentifiers(text: string, counters: Record<string, number>): string {
    const spans = detect(text, STORAGE_IDENTIFIER_RULES);
    return replaceSpans(text, spans, (s) => {
        const tag = TAG[s.type] ?? s.type;
        counters[tag] = (counters[tag] ?? 0) + 1;
        return `[${tag}]`;
    });
}
