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
import { detect, EGRESS_RULES, type EgressRule, type EgressSpan } from './egress_rules.js';

// Aligned: the n-th code point of FOREIGN, three hex digits each, folds to the
// n-th letter of LATIN. Kept here, not in confusables.ts, so the engine chunk
// does not carry that module's script regexes.
const FOREIGN = '43043543e4404414434454554564584bb50151b41041241541a41c41d41e4204214224234254054064083b13b53bf3bd3c13c53c73ba39139239539639739939a39c39d39f3a13a43a53a7';
const LATIN = 'aeopcyxsijhdqABEKMHOPCTYXSIJaeovpuxkABEZHIKMNOPTYX';

/**
 * The basic-Latin twin of each confusable foreign letter that has one. Every
 * key is in `CONFUSABLE_FOREIGN` (confusables.ts), which a test holds.
 */
export const LATIN_TWIN: ReadonlyMap<number, string> = new Map([...LATIN].map((c, i) => [parseInt(FOREIGN.slice(i * 3, i * 3 + 3), 16), c]));

/**
 * Invisible and bidirectional-control characters: soft hyphen, zero-width
 * marks, bidi embeddings and isolates, word joiners, the BOM and the Tag block.
 */
export const HIDDEN_UNICODE_RE = /[­​-‏‪-‮⁠-⁤⁦-⁩﻿\u{E0000}-\u{E007F}]/gu;

export interface Normalized {
    readonly text: string;
    /** For each UTF-16 unit of `text`, the original offset of the character it came from. */
    readonly origin: readonly number[];
    readonly hidden: number;
    readonly folded: number;
}

export function normalizeForDetection(text: string): Normalized {
    let out = '';
    const origin: number[] = [];
    let hidden = 0;
    let folded = 0;
    let at = 0;
    for (const ch of text) {
        HIDDEN_UNICODE_RE.lastIndex = 0;
        if (HIDDEN_UNICODE_RE.test(ch)) {
            hidden += 1;
        } else {
            const emit = LATIN_TWIN.get(ch.codePointAt(0) as number) ?? ch;
            if (emit !== ch) folded += 1;
            out += emit;
            for (let k = 0; k < emit.length; k += 1) origin.push(at);
        }
        at += ch.length;
    }
    return { text: out, origin, hidden, folded };
}

export interface NormalizedDetection {
    readonly spans: EgressSpan[];
    /**
     * An extent reader such as a rule's `through`, applied to the text the spans
     * were found in, with its end in original offsets. A disguised END marker is
     * then seen by the reader exactly as the disguised BEGIN was by the rule.
     */
    end<S extends EgressSpan>(span: S, read: (text: string, span: S) => number | null): number | null;
}

/**
 * `detect`, run on the normalised text with spans in original offsets. With no
 * invisible or confusable character the result is `detect(text)` exactly.
 */
export function detectWithExtent(text: string, rules: readonly EgressRule[] = EGRESS_RULES): NormalizedDetection {
    const n = normalizeForDetection(text);
    if (n.hidden === 0 && n.folded === 0) return { spans: detect(text, rules), end: (s, read) => read(text, s) };
    const back = (i: number): number => {
        const o = n.origin[i - 1] as number;
        return o + ((text.codePointAt(o) as number) > 0xffff ? 2 : 1);
    };
    const fwd = (o: number): number => {
        let i = 0;
        while (i < n.origin.length && (n.origin[i] as number) < o) i += 1;
        return i;
    };
    return {
        spans: detect(n.text, rules).map((s) => ({ ...s, start: n.origin[s.start] as number, end: back(s.end) })),
        end: (s, read) => {
            const e = read(n.text, { ...s, start: fwd(s.start), end: fwd(s.end) });
            return e === null ? null : back(e);
        },
    };
}

export function detectNormalized(text: string, rules: readonly EgressRule[] = EGRESS_RULES): EgressSpan[] {
    return detectWithExtent(text, rules).spans;
}
