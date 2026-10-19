/**
 * Class-tag redaction of identifiers for stores that keep text (knowledge
 * ingestion, cross-repo retrieval). Detection is the rule table's identifier
 * rows, so a value is tagged only where its checksum or context holds; the tag
 * spelling and the counter keys are this consumer's.
 */
import { detect, IDENTIFIER_RULES, replaceSpans } from './egress_rules.js';

/** Counter key and tag per placeholder type; `CC` predates the table's `CARD`. */
const TAG: Readonly<Record<string, string>> = { CARD: 'CC' };

export function redactIdentifiers(text: string, counters: Record<string, number>): string {
    const spans = detect(text, IDENTIFIER_RULES);
    return replaceSpans(text, spans, (s) => {
        const tag = TAG[s.type] ?? s.type;
        counters[tag] = (counters[tag] ?? 0) + 1;
        return `[${tag}]`;
    });
}
