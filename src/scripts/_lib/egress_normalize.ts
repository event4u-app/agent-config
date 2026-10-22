/**
 * Detection through invisible characters and lookalike letters.
 *
 * A zero-width space inside an address, or a Cyrillic `а` in place of a Latin
 * `a`, defeats every pattern while the value still reads whole to a model. So
 * the text is normalised — invisible characters removed, each confusable letter
 * folded to its Latin twin — the table is run on that, and every span is mapped
 * back to the original offsets, so a replacement removes the disguised bytes
 * too. Pure: no I/O.
 */
import { LATIN_TWIN } from './confusables.js';
import { detect, EGRESS_RULES, type EgressRule, type EgressSpan } from './egress_rules.js';

/**
 * Invisible and bidirectional-control characters: soft hyphen, zero-width
 * marks, bidi embeddings and isolates, word joiners, the BOM and the Tag block.
 */
export const HIDDEN_UNICODE_RE = /[­​-‏‪-‮⁠-⁤⁦-⁩﻿\u{E0000}-\u{E007F}]/gu;

export interface Normalized {
    readonly text: string;
    /** For each UTF-16 unit of `text`, the original offsets of the character it came from. */
    readonly originStart: readonly number[];
    readonly originEnd: readonly number[];
    readonly hidden: number;
    readonly folded: number;
}

export function normalizeForDetection(text: string): Normalized {
    const out: string[] = [];
    const originStart: number[] = [];
    const originEnd: number[] = [];
    let hidden = 0;
    let folded = 0;
    let at = 0;
    for (const ch of text) {
        HIDDEN_UNICODE_RE.lastIndex = 0;
        if (HIDDEN_UNICODE_RE.test(ch)) {
            hidden += 1;
        } else {
            const twin = LATIN_TWIN.get(ch.codePointAt(0) as number);
            if (twin !== undefined) folded += 1;
            const emit = twin ?? ch;
            for (let k = 0; k < emit.length; k += 1) {
                originStart.push(at);
                originEnd.push(at + ch.length);
            }
            out.push(emit);
        }
        at += ch.length;
    }
    return { text: out.join(''), originStart, originEnd, hidden, folded };
}

/**
 * `detect`, run on the normalised text with spans in original offsets. With no
 * invisible or confusable character the result is `detect(text)` exactly.
 */
export function detectNormalized(text: string, rules: readonly EgressRule[] = EGRESS_RULES): EgressSpan[] {
    const n = normalizeForDetection(text);
    if (n.hidden === 0 && n.folded === 0) return detect(text, rules);
    return detect(n.text, rules).map((s) => ({
        ...s,
        start: n.originStart[s.start] as number,
        end: n.originEnd[s.end - 1] as number,
    }));
}
