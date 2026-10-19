/**
 * Class-tag redaction of identifiers for stores that keep text (knowledge
 * ingestion, cross-repo retrieval).
 *
 * Detection is the rule table's identifier rows, read recall-first: a store
 * that persists text has no reviewer after it, so a missed value is the costly
 * error and a context word is not required here. The rows' checksums still
 * hold — a number that fails Luhn is not a card, a string that fails mod-97 is
 * not an IBAN. The tag spelling and the counter keys are this consumer's.
 */
import { detect, type EgressRule, IDENTIFIER_RULES, replaceSpans } from './egress_rules.js';

/** The identifier rows with every context requirement dropped. */
export const STORAGE_IDENTIFIER_RULES: readonly EgressRule[] = IDENTIFIER_RULES.map(({ context: _context, ...rest }) => rest);

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
